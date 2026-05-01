import express from "express";
import { z } from "zod";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { requireSession } from "../lib/auth.js";
import { enrichGameMetadataFromSteam, enrichMissingGameImages } from "../lib/gameCatalogEnrichment.js";
import { whatCanWePlay } from "../lib/recommend.js";

const createGameNightSchema = z.object({
  title: z.string().trim().min(1).max(120),
  scheduledFor: z.iso.datetime(),
  attendeeIds: z.array(z.string().trim().min(1)).optional()
});

const voteSchema = z.object({
  appId: z.number().int().positive(),
  vote: z.number().int().min(-1).max(1)
});

const finalizeSchema = z.object({
  appId: z.number().int().positive().optional()
});

const recommendationSchema = z.object({
  memberIds: z.array(z.string().trim().min(1)).min(1).optional(),
  sessionLength: z.enum(["short", "long", "any"]).default("any")
});

const manageAttendeesSchema = z.object({
  memberIds: z.array(z.string().trim().min(1)).min(1)
});

type AuthedUser = { id: number; discord_user_id: string };

async function getAuthedUser(discordUserId: string): Promise<AuthedUser | null> {
  const result = await db.query<AuthedUser>(
    `SELECT id, discord_user_id FROM users WHERE discord_user_id = $1`,
    [discordUserId]
  );
  return result.rows[0] ?? null;
}

export const gameNightRouter = express.Router();

async function gameNightExists(id: number): Promise<boolean> {
  const result = await db.query<{ id: number }>(`SELECT id FROM game_nights WHERE id = $1`, [id]);
  return Boolean(result.rows[0]);
}

function canAccessFromSessionOrBot(req: express.Request): boolean {
  if (Boolean(req.session?.userId)) {
    return true;
  }
  const botSecret = req.get("x-island-bot-secret");
  return Boolean(env.BOT_API_SHARED_SECRET) && botSecret === env.BOT_API_SHARED_SECRET;
}

async function ensureUsersForDiscordIds(discordIds: string[]): Promise<void> {
  if (!discordIds.length) return;

  await db.query(
    `
      INSERT INTO users (discord_user_id)
      SELECT UNNEST($1::text[])
      ON CONFLICT (discord_user_id) DO NOTHING
    `,
    [discordIds]
  );

  await db.query(
    `
      INSERT INTO discord_profiles (user_id, username, avatar_url)
      SELECT
        u.id,
        COALESCE(gm.username, 'member-' || u.discord_user_id),
        gm.avatar_url
      FROM users u
      LEFT JOIN guild_members gm
        ON gm.discord_user_id = u.discord_user_id
        AND gm.guild_id = $2
      WHERE u.discord_user_id = ANY($1::text[])
      ON CONFLICT (user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        avatar_url = COALESCE(EXCLUDED.avatar_url, discord_profiles.avatar_url)
    `,
    [discordIds, env.DISCORD_GUILD_ID]
  );
}

async function addAttendeesByDiscordIds(gameNightId: number, discordIds: string[]): Promise<void> {
  if (!discordIds.length) return;
  await ensureUsersForDiscordIds(discordIds);

  await db.query(
    `
      INSERT INTO game_night_attendees (game_night_id, user_id)
      SELECT $1, u.id
      FROM users u
      WHERE u.discord_user_id = ANY($2::text[])
      ON CONFLICT (game_night_id, user_id) DO NOTHING
    `,
    [gameNightId, discordIds]
  );
}


gameNightRouter.get("/", requireSession, async (_req, res) => {
  const discordUserId = String(res.locals.userId);
  const user = await getAuthedUser(discordUserId);
  if (!user) {
    res.status(401).json({ error: "User not found for active session" });
    return;
  }

  const nights = await db.query<{
    id: number;
    title: string;
    scheduled_for: string;
    created_by_user_id: number;
    top_game_name: string | null;
    top_game_vote: number | null;
    selected_game_name: string | null;
    selected_app_id: number | null;
    selected_at: string | null;
    attendee_count: number;
    current_user_attending: boolean;
  }>(
    `
      SELECT
        gn.id,
        gn.title,
        gn.scheduled_for,
        gn.created_by_user_id,
        top_game.name AS top_game_name,
        top_game.total_vote AS top_game_vote,
        selected_game.name AS selected_game_name,
        gn.selected_app_id,
        gn.selected_at,
        COUNT(gna.user_id)::int AS attendee_count,
        COALESCE(BOOL_OR(gna.user_id = $1), false) AS current_user_attending
      FROM game_nights gn
      LEFT JOIN LATERAL (
        SELECT g.name, SUM(gnv.vote)::int AS total_vote
        FROM game_night_votes gnv
        INNER JOIN games g ON g.app_id = gnv.app_id
        WHERE gnv.game_night_id = gn.id
        GROUP BY g.name
        ORDER BY total_vote DESC, g.name ASC
        LIMIT 1
      ) top_game ON TRUE
      LEFT JOIN games selected_game ON selected_game.app_id = gn.selected_app_id
      LEFT JOIN game_night_attendees gna ON gna.game_night_id = gn.id
      WHERE gn.scheduled_for >= NOW() - INTERVAL '12 hours'
      GROUP BY
        gn.id,
        gn.title,
        gn.scheduled_for,
        gn.created_by_user_id,
        top_game.name,
        top_game.total_vote,
        selected_game.name,
        gn.selected_app_id,
        gn.selected_at
      ORDER BY gn.scheduled_for ASC
      LIMIT 25
    `,
    [user.id]
  );

  res.json({
    gameNights: nights.rows.map((row) => ({
      id: row.id,
      title: row.title,
      scheduledFor: row.scheduled_for,
      createdByUserId: row.created_by_user_id,
      topGameName: row.top_game_name,
      topGameVote: row.top_game_vote,
      selectedGameName: row.selected_game_name,
      selectedAppId: row.selected_app_id,
      selectedAt: row.selected_at,
      attendeeCount: row.attendee_count,
      currentUserAttending: row.current_user_attending
    }))
  });
});

gameNightRouter.post("/", requireSession, async (req, res) => {
  const body = createGameNightSchema.parse(req.body);
  const discordUserId = String(res.locals.userId);
  const user = await getAuthedUser(discordUserId);

  if (!user) {
    res.status(401).json({ error: "User not found for active session" });
    return;
  }

  const created = await db.query<{ id: number }>(
    `
      INSERT INTO game_nights (title, scheduled_for, created_by_user_id)
      VALUES ($1, $2::timestamptz, $3)
      RETURNING id
    `,
    [body.title, body.scheduledFor, user.id]
  );

  const gameNightId = created.rows[0]?.id;
  if (gameNightId) {
    const attendeeIds = Array.from(new Set([...(body.attendeeIds ?? []), discordUserId]));
    await addAttendeesByDiscordIds(gameNightId, attendeeIds);
  }

  res.status(201).json({ id: gameNightId });
});

gameNightRouter.get("/:id/attendees", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }

  const discordUserId = String(res.locals.userId);
  const user = await getAuthedUser(discordUserId);
  if (!user) {
    res.status(401).json({ error: "User not found for active session" });
    return;
  }

  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }

  const attendees = await db.query<{ discord_user_id: string; username: string }>(
    `
      SELECT u.discord_user_id, dp.username
      FROM game_night_attendees gna
      INNER JOIN users u ON u.id = gna.user_id
      INNER JOIN discord_profiles dp ON dp.user_id = u.id
      WHERE gna.game_night_id = $1
      ORDER BY dp.username ASC
    `,
    [id]
  );

  res.json({
    attendees: attendees.rows.map((row) => ({
      discordUserId: row.discord_user_id,
      username: row.username
    })),
    currentUserIsAttending: attendees.rows.some((row) => row.discord_user_id === discordUserId)
  });
});

gameNightRouter.post("/:id/attendees/me", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }

  const discordUserId = String(res.locals.userId);
  const user = await getAuthedUser(discordUserId);
  if (!user) {
    res.status(401).json({ error: "User not found for active session" });
    return;
  }

  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }

  await db.query(
    `
      INSERT INTO game_night_attendees (game_night_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (game_night_id, user_id) DO NOTHING
    `,
    [id, user.id]
  );

  res.json({ ok: true });
});

gameNightRouter.delete("/:id/attendees/me", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }

  const discordUserId = String(res.locals.userId);
  const user = await getAuthedUser(discordUserId);
  if (!user) {
    res.status(401).json({ error: "User not found for active session" });
    return;
  }

  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }

  await db.query(`DELETE FROM game_night_attendees WHERE game_night_id = $1 AND user_id = $2`, [id, user.id]);
  res.json({ ok: true });
});

gameNightRouter.post("/:id/attendees", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }

  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }

  const body = manageAttendeesSchema.parse(req.body);
  await addAttendeesByDiscordIds(id, body.memberIds);
  res.json({ ok: true, addedMemberIds: body.memberIds });
});

gameNightRouter.delete("/:id/attendees", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }

  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }

  const body = manageAttendeesSchema.parse(req.body);
  await db.query(
    `
      DELETE FROM game_night_attendees gna
      USING users u
      WHERE gna.game_night_id = $1
        AND gna.user_id = u.id
        AND u.discord_user_id = ANY($2::text[])
    `,
    [id, body.memberIds]
  );

  res.json({ ok: true, removedMemberIds: body.memberIds });
});

gameNightRouter.get("/:id/available-games", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }
  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }
  const discordUserId = String(res.locals.userId);
  const user = await getAuthedUser(discordUserId);
  if (!user) {
    res.status(401).json({ error: "User not found for active session" });
    return;
  }

  const attendees = await db.query<{ user_id: number }>(
    `SELECT user_id FROM game_night_attendees WHERE game_night_id = $1`,
    [id]
  );
  const voters = await db.query<{ user_id: number }>(
    `SELECT DISTINCT user_id FROM game_night_votes WHERE game_night_id = $1`,
    [id]
  );

  const participantIds = (attendees.rows.length ? attendees.rows : voters.rows).map((row) => row.user_id);
  if (participantIds.length === 0) {
    res.json({ games: [] });
    return;
  }

  type AvailableGameRow = {
    app_id: number;
    name: string;
    owners: number;
    vote_total: number;
    max_players: number;
    median_session_minutes: number;
    developers: string[];
    tags: string[];
    header_image_url: string | null;
    header_image_provider: string | null;
    header_image_checked_at: string | null;
    current_user_vote: number | null;
  };

  const query = async () =>
    db.query<AvailableGameRow>(
      `
        WITH vote_totals AS (
          SELECT app_id, SUM(vote)::int AS vote_total
          FROM game_night_votes
          WHERE game_night_id = $1
          GROUP BY app_id
        )
        SELECT
          g.app_id,
          g.name,
          COUNT(DISTINCT ug.user_id)::int AS owners,
          COALESCE(vt.vote_total, 0)::int AS vote_total,
          g.max_players,
          g.median_session_minutes,
          g.developers,
          g.tags,
          g.header_image_url,
          g.header_image_provider,
          g.header_image_checked_at,
          uv.vote::int AS current_user_vote
        FROM user_games ug
        INNER JOIN games g ON g.app_id = ug.app_id
        LEFT JOIN vote_totals vt ON vt.app_id = g.app_id
        LEFT JOIN game_night_votes uv
          ON uv.game_night_id = $1
          AND uv.app_id = g.app_id
          AND uv.user_id = $4
        WHERE ug.user_id = ANY($2::bigint[])
        GROUP BY
          g.app_id,
          g.name,
          vt.vote_total,
          g.max_players,
          g.median_session_minutes,
          g.developers,
          g.tags,
          g.header_image_url,
          g.header_image_provider,
          g.header_image_checked_at,
          uv.vote
        HAVING COUNT(DISTINCT ug.user_id) = $3::int
        ORDER BY vote_total DESC, g.name ASC
        LIMIT 200
      `,
      [id, participantIds, participantIds.length, user.id]
    );

  let available = await query();

  const missingMetadataIds = available.rows
    .filter((row) => row.developers.length === 0 && row.tags.length === 0)
    .slice(0, 8)
    .map((row) => row.app_id);
  await enrichGameMetadataFromSteam(missingMetadataIds);

  const missingImageIds = available.rows
    .filter((row) => !row.header_image_url)
    .slice(0, 12)
    .map((row) => row.app_id);
  await enrichMissingGameImages(missingImageIds);

  if (missingMetadataIds.length || missingImageIds.length) {
    available = await query();
  }

  res.json({
    games: available.rows.map((row) => ({
      appId: row.app_id,
      name: row.name,
      owners: row.owners,
      voteTotal: row.vote_total,
      maxPlayers: row.max_players,
      medianSessionMinutes: row.median_session_minutes,
      developers: row.developers,
      tags: row.tags,
      headerImageUrl: row.header_image_url,
      headerImageProvider: row.header_image_provider,
      headerImageCheckedAt: row.header_image_checked_at,
      currentUserVote: row.current_user_vote
    }))
  });
});

gameNightRouter.get("/:id/votes", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }
  const discordUserId = String(res.locals.userId);
  const user = await getAuthedUser(discordUserId);
  if (!user) {
    res.status(401).json({ error: "User not found for active session" });
    return;
  }

  const votes = await db.query<{ app_id: number; name: string; total_vote: number; current_user_vote: number | null }>(
    `
      SELECT
        g.app_id,
        g.name,
        COALESCE(SUM(gnv.vote), 0)::int AS total_vote,
        MAX(CASE WHEN gnv.user_id = $2 THEN gnv.vote END)::int AS current_user_vote
      FROM game_night_votes gnv
      INNER JOIN games g ON g.app_id = gnv.app_id
      WHERE gnv.game_night_id = $1
      GROUP BY g.app_id, g.name
      ORDER BY total_vote DESC, g.name ASC
      LIMIT 50
    `,
    [id, user.id]
  );

  res.json({
    votes: votes.rows.map((row) => ({
      appId: row.app_id,
      name: row.name,
      totalVote: row.total_vote,
      currentUserVote: row.current_user_vote
    }))
  });
});

gameNightRouter.post("/:id/votes", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }

  const body = voteSchema.parse(req.body);
  const discordUserId = String(res.locals.userId);
  const user = await getAuthedUser(discordUserId);

  if (!user) {
    res.status(401).json({ error: "User not found for active session" });
    return;
  }

  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }

  const gameExists = await db.query<{ app_id: number }>(`SELECT app_id FROM games WHERE app_id = $1`, [body.appId]);
  if (!gameExists.rows[0]) {
    res.status(404).json({ error: "Game not found. Sync Steam games first." });
    return;
  }

  await db.query(
    `
      INSERT INTO game_night_votes (game_night_id, user_id, app_id, vote)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (game_night_id, user_id, app_id)
      DO UPDATE SET vote = EXCLUDED.vote
    `,
    [id, user.id, body.appId, body.vote]
  );

  res.json({ ok: true });
});

gameNightRouter.post("/:id/finalize", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }
  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }

  const body = finalizeSchema.parse(req.body ?? {});
  let selectedAppId = body.appId;

  if (!selectedAppId) {
    const top = await db.query<{ app_id: number }>(
      `
        SELECT gnv.app_id
        FROM game_night_votes gnv
        WHERE gnv.game_night_id = $1
        GROUP BY gnv.app_id
        ORDER BY SUM(gnv.vote) DESC, gnv.app_id ASC
        LIMIT 1
      `,
      [id]
    );
    selectedAppId = top.rows[0]?.app_id;
  }

  if (!selectedAppId) {
    res.status(400).json({ error: "No votes found to finalize from" });
    return;
  }

  const gameExists = await db.query<{ app_id: number }>(`SELECT app_id FROM games WHERE app_id = $1`, [selectedAppId]);
  if (!gameExists.rows[0]) {
    res.status(404).json({ error: "Selected game does not exist" });
    return;
  }

  await db.query(
    `
      UPDATE game_nights
      SET selected_app_id = $2, selected_at = NOW()
      WHERE id = $1
    `,
    [id, selectedAppId]
  );

  res.json({ ok: true, selectedAppId });
});

gameNightRouter.delete("/:id/finalize", requireSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }
  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }

  await db.query(
    `
      UPDATE game_nights
      SET selected_app_id = NULL, selected_at = NULL
      WHERE id = $1
    `,
    [id]
  );

  res.json({ ok: true });
});

gameNightRouter.post("/:id/recommendations", async (req, res) => {
  if (!canAccessFromSessionOrBot(req)) {
    res.status(401).json({ error: "Not authorized to access game night recommendations" });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }

  const body = recommendationSchema.parse(req.body ?? {});
  if (!(await gameNightExists(id))) {
    res.status(404).json({ error: "Game night not found" });
    return;
  }

  let memberIds = body.memberIds ?? [];

  if (memberIds.length === 0) {
    const attendees = await db.query<{ discord_user_id: string }>(
      `
        SELECT u.discord_user_id
        FROM game_night_attendees gna
        INNER JOIN users u ON u.id = gna.user_id
        WHERE gna.game_night_id = $1
      `,
      [id]
    );
    memberIds = attendees.rows.map((row) => row.discord_user_id);
  }

  if (memberIds.length === 0) {
    const voters = await db.query<{ discord_user_id: string }>(
      `
        SELECT DISTINCT u.discord_user_id
        FROM game_night_votes gnv
        INNER JOIN users u ON u.id = gnv.user_id
        WHERE gnv.game_night_id = $1
      `,
      [id]
    );
    memberIds = voters.rows.map((row) => row.discord_user_id);
  }

  if (memberIds.length === 0) {
    res.status(400).json({ error: "No member IDs provided and no attendees/voters found for this game night" });
    return;
  }

  const recommendations = await whatCanWePlay({
    memberIds,
    sessionLength: body.sessionLength,
    maxGroupSize: memberIds.length
  });

  res.json({
    source: body.memberIds?.length ? "request-member-ids" : "night-attendees-or-voters",
    memberIds,
    recommendations
  });
});
