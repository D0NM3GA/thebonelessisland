import { env } from "../config.js";
import { db } from "../db/client.js";

type SettingRow = {
  key: string;
  value: string;
  label: string;
  description: string | null;
  updated_at: string;
};

// In-memory cache — refreshed at startup and after every write
let cachedRows: SettingRow[] = [];
let loadedOnce = false;

export async function loadSettings(): Promise<void> {
  const result = await db.query<SettingRow>(
    "SELECT key, value, label, description, updated_at FROM server_settings ORDER BY key"
  );
  cachedRows = result.rows;
  loadedOnce = true;
}

/** Reload only if the cache was never successfully populated (e.g. table didn't exist at startup). */
export async function ensureSettingsLoaded(): Promise<void> {
  if (!loadedOnce) {
    await loadSettings();
  }
}

function cached(key: string): string {
  return cachedRows.find((r) => r.key === key)?.value ?? "";
}

// Synchronous getters — safe to call in any route handler
export function getGuildId(): string {
  return cached("discord_guild_id") || env.DISCORD_GUILD_ID;
}

export function getParentRoleName(): string {
  return cached("parent_role_name") || env.PARENT_ROLE_NAME;
}

// ── Public shape sent to the admin UI ────────────────────────────────────────

export type PublicSetting = {
  key: string;
  value: string;
  label: string;
  description: string | null;
  /** The env-var fallback so the UI can show what will be used when DB value is blank */
  envDefault: string;
  updatedAt: string;
};

const ENV_DEFAULTS: Record<string, string> = {
  discord_guild_id: env.DISCORD_GUILD_ID || "(not set in environment)",
  guild_display_name: "",
  parent_role_name: env.PARENT_ROLE_NAME || "(not set in environment)"
};

export function getPublicSettings(): PublicSetting[] {
  return cachedRows.map((row) => ({
    key: row.key,
    value: row.value,
    label: row.label,
    description: row.description,
    envDefault: ENV_DEFAULTS[row.key] ?? "",
    updatedAt: row.updated_at
  }));
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function upsertSetting(
  key: string,
  value: string,
  discordUserId: string
): Promise<void> {
  const userResult = await db.query<{ id: string }>(
    "SELECT id FROM users WHERE discord_user_id = $1",
    [discordUserId]
  );
  const userId = userResult.rows[0]?.id ?? null;

  await db.query(
    `UPDATE server_settings
     SET value = $1, updated_at = NOW(), updated_by_user_id = $3
     WHERE key = $2`,
    [value.trim(), key, userId]
  );

  // Refresh the in-memory cache immediately so the next request sees the new value
  await loadSettings();
}
