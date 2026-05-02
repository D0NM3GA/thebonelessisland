-- AI curation columns for game_news
ALTER TABLE game_news
ADD COLUMN IF NOT EXISTS ai_relevance_score REAL,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_curated_at TIMESTAMPTZ;

-- Index to quickly find un-curated items
CREATE INDEX IF NOT EXISTS game_news_uncurated_idx
  ON game_news (app_id)
  WHERE ai_curated_at IS NULL;
