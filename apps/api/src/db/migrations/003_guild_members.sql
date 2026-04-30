CREATE TABLE IF NOT EXISTS guild_members (
  guild_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  in_guild BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, discord_user_id)
);

CREATE INDEX IF NOT EXISTS guild_members_guild_id_idx ON guild_members (guild_id);
