import express from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { requireSession } from "../lib/auth.js";
import { whatCanWePlay } from "../lib/recommend.js";

const createGameNightSchema = z.object({
  title: z.string().trim().min(1).max(120),
  scheduledFor: z.iso.datetime()
});

const voteSchema = z.object({
  appId: z.number().int().positive(),
  vote: z.number().int().min(-1).max(1)
});

const recommendationSchema = z.object({
  memberIds: z.array(z.string().trim().min(1)).min(1).optional(),
  sessionLength: z.enum(["short", "long", "any"]).default("any")
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
gameNightRouter.use(requireSession);

async function gameNightExists(id: number): Promise<boolean> {
  const result = await db.query<{ id: number }>(`SELECT id FROM game_nights WHERE id = $1`, [id]);
  return Boolean(result.rows[0]);
}

gameNightRouter.get("/", async (_req, res) => {
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
      LEFT JOIN game_night_attendees gna ON gna.game_night_id = gn.id
      WHERE gn.scheduled_for >= NOW() - INTERVAL '12 hours'
      GROUP BY gn.id, gn.title, gn.scheduled_for, gn.created_by_user_id, top_game.name, top_game.total_vote
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
      attendeeCount: row.attendee_count,
      currentUserAttending: row.current_user_attending
    }))
  });
});

gameNightRouter.post("/", async (req, res) => {
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
    await db.query(
      `
        INSERT INTO game_night_attendees (game_night_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (game_night_id, user_id) DO NOTHING
      `,
      [gameNightId, user.id]
    );
  }

  res.status(201).json({ id: gameNightId });
});

gameNightRouter.get("/:id/attendees", async (req, res) => {
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

gameNightRouter.post("/:id/attendees/me", async (req, res) => {
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

gameNightRouter.delete("/:id/attendees/me", async (req, res) => {
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

gameNightRouter.get("/:id/votes", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid game night id" });
    return;
  }

  const votes = await db.query<{ app_id: number; name: string; total_vote: number }>(
    `
      SELECT g.app_id, g.name, COALESCE(SUM(gnv.vote), 0)::int AS total_vote
      FROM game_night_votes gnv
      INNER JOIN games g ON g.app_id = gnv.app_id
      WHERE gnv.game_night_id = $1
      GROUP BY g.app_id, g.name
      ORDER BY total_vote DESC, g.name ASC
      LIMIT 50
    `,
    [id]
  );

  res.json({
    votes: votes.rows.map((row) => ({
      appId: row.app_id,
      name: row.name,
      totalVote: row.total_vote
    }))
  });
});

gameNightRouter.post("/:id/votes", async (req, res) => {
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

gameNightRouter.post("/:id/recommendations", async (req, res) => {
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
