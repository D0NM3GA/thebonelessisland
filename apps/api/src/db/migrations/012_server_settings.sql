CREATE TABLE IF NOT EXISTS server_settings (
  key                  TEXT PRIMARY KEY,
  value                TEXT NOT NULL DEFAULT '',
  label                TEXT NOT NULL,
  description          TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO server_settings (key, value, label, description) VALUES
  (
    'discord_guild_id',
    '',
    'Discord Guild ID',
    'The ID of the Discord server this app is gated to. Overrides the DISCORD_GUILD_ID environment variable. Find it in Discord › Server Settings › Widget.'
  ),
  (
    'guild_display_name',
    '',
    'Server Display Name',
    'A friendly label for the Discord server shown in the admin panel. No functional effect.'
  ),
  (
    'parent_role_name',
    '',
    'Admin Role Name',
    'The Discord role name that grants admin access to this app. Overrides the PARENT_ROLE_NAME environment variable.'
  )
ON CONFLICT (key) DO NOTHING;
