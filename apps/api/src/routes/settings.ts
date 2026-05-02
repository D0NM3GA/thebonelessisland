import express from "express";
import { z } from "zod";
import { requireParentRole, requireSession } from "../lib/auth.js";
import { ensureSettingsLoaded, getPublicSettings, upsertSetting } from "../lib/serverSettings.js";

export const settingsRouter = express.Router();

settingsRouter.get("/", requireSession, requireParentRole, async (_req, res) => {
  await ensureSettingsLoaded();
  res.json({ settings: getPublicSettings() });
});

const patchSchema = z.object({
  key: z.string().min(1),
  value: z.string()
});

settingsRouter.patch("/", requireSession, requireParentRole, async (req, res) => {
  const { key, value } = patchSchema.parse(req.body);
  const discordUserId = String(res.locals.userId);
  await upsertSetting(key, value, discordUserId);
  // Return the full updated settings so the client can refresh in one round-trip
  res.json({ ok: true, settings: getPublicSettings() });
});
