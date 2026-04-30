import express from "express";
import { z } from "zod";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { requireSession } from "../lib/auth.js";

const linkSchema = z.object({
  steamId64: z.string().min(10)
});

export const steamRouter = express.Router();
steamRouter.use(requireSession);

steamRouter.post("/link", async (req, res) => {
  const { steamId64 } = linkSchema.parse(req.body);
  const discordUserId = String(res.locals.userId);
  await db.query(
    `
      INSERT INTO steam_links (user_id, steam_id64)
      SELECT id, $2 FROM users WHERE discord_user_id = $1
      ON CONFLICT (user_id)
      DO UPDATE SET steam_id64 = EXCLUDED.steam_id64, linked_at = NOW()
    `,
    [discordUserId, steamId64]
  );
  res.json({ ok: true });
});

steamRouter.post("/unlink", async (_req, res) => {
  const discordUserId = String(res.locals.userId);
  await db.query(
    `DELETE FROM steam_links WHERE user_id = (SELECT id FROM users WHERE discord_user_id = $1)`,
    [discordUserId]
  );
  res.json({ ok: true });
});

steamRouter.post("/sync-owned-games", async (_req, res) => {
  const discordUserId = String(res.locals.userId);
  const link = await db.query<{ user_id: string; steam_id64: string }>(
    `
      SELECT sl.user_id, sl.steam_id64
      FROM steam_links sl
      INNER JOIN users u ON u.id = sl.user_id
      WHERE u.discord_user_id = $1
    `,
    [discordUserId]
  );
  if (!link.rows[0]) {
    res.status(400).json({ error: "No Steam account linked" });
    return;
  }

  if (!env.STEAM_WEB_API_KEY) {
    res.status(400).json({ error: "Missing STEAM_WEB_API_KEY in environment" });
    return;
  }

  try {
    const apiUrl =
      "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/" +
      `?key=${env.STEAM_WEB_API_KEY}&steamid=${link.rows[0].steam_id64}&include_appinfo=1`;
    const steamResponse = await fetch(apiUrl);

    if (!steamResponse.ok) {
      res.status(502).json({ error: "Steam API request failed" });
      return;
    }

    const steamJson = (await steamResponse.json()) as {
      response?: { games?: Array<{ appid: number; name: string; playtime_forever?: number }> };
    };

    if (!steamJson.response) {
      res.status(502).json({ error: "Steam API response format was invalid" });
      return;
    }

    const games = steamJson.response.games ?? [];
    for (const game of games) {
      await db.query(
        `
          INSERT INTO games (app_id, name)
          VALUES ($1, $2)
          ON CONFLICT (app_id) DO UPDATE SET name = EXCLUDED.name
        `,
        [game.appid, game.name]
      );
      await db.query(
        `
          INSERT INTO user_games (user_id, app_id, playtime_minutes)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, app_id)
          DO UPDATE SET playtime_minutes = EXCLUDED.playtime_minutes, last_played_at = NOW()
        `,
        [link.rows[0].user_id, game.appid, game.playtime_forever ?? 0]
      );
    }

    await db.query(`UPDATE steam_links SET last_synced_at = NOW() WHERE user_id = $1`, [link.rows[0].user_id]);
    res.json({ syncedGames: games.length });
  } catch (error) {
    console.error("Steam sync failed", error);
    res.status(502).json({ error: "Unable to sync Steam games right now" });
  }
});
