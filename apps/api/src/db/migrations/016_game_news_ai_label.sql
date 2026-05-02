-- Additional AI curation output fields from the updated news curator prompt.
-- ai_label: feed category (personal | community | top_news)
-- ai_spoiler_warning: true when the article contains story spoilers
ALTER TABLE game_news
  ADD COLUMN IF NOT EXISTS ai_label TEXT,
  ADD COLUMN IF NOT EXISTS ai_spoiler_warning BOOLEAN NOT NULL DEFAULT FALSE;
