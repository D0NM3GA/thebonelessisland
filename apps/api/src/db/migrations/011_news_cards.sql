CREATE TABLE IF NOT EXISTS news_cards (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🌊',
  tag TEXT,
  source_url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS news_cards_published_at_idx
  ON news_cards (published_at DESC)
  WHERE archived_at IS NULL;
