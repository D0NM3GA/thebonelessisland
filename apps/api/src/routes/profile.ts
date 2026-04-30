import express from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { requireSession } from "../lib/auth.js";

const patchSchema = z.object({
  steamVisibility: z.enum(["private", "members", "public"]).optional(),
  featureOptIn: z.boolean().optional()
});

export const profileRouter = express.Router();
profileRouter.use(requireSession);

profileRouter.get("/me", async (req, res) => {
  const discordUserId = String(res.locals.userId);
  const result = await db.query(
    `
      SELECT
        u.discord_user_id,
        u.steam_visibility,
        u.feature_opt_in,
        dp.username,
        dp.avatar_url,
        sl.steam_id64
      FROM users u
      INNER JOIN discord_profiles dp ON dp.user_id = u.id
      LEFT JOIN steam_links sl ON sl.user_id = u.id
      WHERE u.discord_user_id = $1
    `,
    [discordUserId]
  );
  res.json({ profile: result.rows[0] ?? null });
});

profileRouter.patch("/me", async (req, res) => {
  const body = patchSchema.parse(req.body);
  const discordUserId = String(res.locals.userId);
  await db.query(
    `
      UPDATE users
      SET steam_visibility = COALESCE($2, steam_visibility),
          feature_opt_in = COALESCE($3, feature_opt_in)
      WHERE discord_user_id = $1
    `,
    [discordUserId, body.steamVisibility ?? null, body.featureOptIn ?? null]
  );
  res.json({ ok: true });
});
