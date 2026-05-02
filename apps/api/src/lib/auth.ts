import { Request, Response, NextFunction } from "express";
import { db } from "../db/client.js";
import { getGuildId, getParentRoleName } from "./serverSettings.js";

export function requireSession(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.locals.userId = userId;
  next();
}

export async function requireParentRole(req: Request, res: Response, next: NextFunction) {
  const discordUserId = req.session?.userId;
  if (!discordUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const guildId = getGuildId();
  if (!guildId) {
    res.status(503).json({ error: "Guild not configured" });
    return;
  }

  const result = await db.query<{ role_names: string[] }>(
    `
      SELECT COALESCE(role_names, '{}'::text[]) AS role_names
      FROM guild_members
      WHERE guild_id = $1
        AND discord_user_id = $2
        AND in_guild = TRUE
      LIMIT 1
    `,
    [guildId, String(discordUserId)]
  );

  const roleNames = result.rows[0]?.role_names ?? [];
  if (!roleNames.includes(getParentRoleName())) {
    res.status(403).json({ error: "Parent role required" });
    return;
  }

  res.locals.userId = discordUserId;
  next();
}
