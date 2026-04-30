import express from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { requireSession } from "../lib/auth.js";

const createGameNightSchema = z.object({
  title: z.string().trim().min(1).max(120),
  scheduledFor: z.iso.datetime()
});

const voteSchema = z.object({
  appId: z.number().int().positive(),
  vote: z.number().int().min(-1).max(1)
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

gameNightRouter.get("/", async (_req, res) => {
  const nights = await db.query<{
    id: number;
    title: string;
    scheduled_for: string;
    created_by_user_id: number;
    top_game_name: string | null;
    top_game_vote: number | null;
  }>(
    `
      SELECT
        gn.id,
        gn.title,
        gn.scheduled_for,
        gn.created_by_user_id,
        top_game.name AS top_game_name,
        top_game.total_vote AS top_game_vote
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
      WHERE gn.scheduled_for >= NOW() - INTERVAL '12 hours'
      ORDER BY gn.scheduled_for ASC
      LIMIT 25
    `
  );

  res.json({
    gameNights: nights.rows.map((row) => ({
      id: row.id,
      title: row.title,
      scheduledFor: row.scheduled_for,
      createdByUserId: row.created_by_user_id,
      topGameName: row.top_game_name,
      topGameVote: row.top_game_vote
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

  res.status(201).json({ id: created.rows[0]?.id });
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

  const nightExists = await db.query<{ id: number }>(`SELECT id FROM game_nights WHERE id = $1`, [id]);
  if (!nightExists.rows[0]) {
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
