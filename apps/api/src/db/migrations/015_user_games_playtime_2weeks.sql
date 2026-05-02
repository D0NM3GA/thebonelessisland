-- Track playtime in the last 2 weeks, returned by both GetOwnedGames and
-- GetRecentlyPlayedGames. Zero means not played recently or not yet synced.
ALTER TABLE user_games
ADD COLUMN IF NOT EXISTS playtime_2weeks INTEGER NOT NULL DEFAULT 0;

-- Index to quickly find active players across the crew
CREATE INDEX IF NOT EXISTS user_games_playtime_2weeks_idx
  ON user_games (playtime_2weeks DESC)
  WHERE playtime_2weeks > 0;
