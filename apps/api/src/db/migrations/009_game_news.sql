CREATE TABLE IF NOT EXISTS game_news (
  app_id INTEGER NOT NULL REFERENCES games(app_id) ON DELETE CASCADE,
  gid TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  contents TEXT,
  feed_label TEXT,
  feed_name TEXT,
  feed_type INTEGER,
  is_external_url BOOLEAN NOT NULL DEFAULT FALSE,
  author TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  published_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (app_id, gid)
);

CREATE INDEX IF NOT EXISTS game_news_published_at_idx ON game_news (published_at DESC);
CREATE INDEX IF NOT EXISTS game_news_app_id_idx ON game_news (app_id);

ALTER TABLE games
ADD COLUMN IF NOT EXISTS news_checked_at TIMESTAMPTZ;
