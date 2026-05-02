-- General gaming news from external sources (RSS feeds + optional News API).
-- Separate from game_news which is Steam-specific and requires a games FK.
CREATE TABLE IF NOT EXISTS general_news (
  id                  SERIAL PRIMARY KEY,
  source_type         TEXT NOT NULL,               -- 'rss' | 'newsapi'
  source_name         TEXT NOT NULL,               -- 'PC Gamer', 'IGN', etc.
  external_id         TEXT NOT NULL,               -- article URL used as dedup key
  title               TEXT NOT NULL,
  url                 TEXT NOT NULL,
  contents            TEXT,
  author              TEXT,
  image_url           TEXT,
  published_at        TIMESTAMPTZ NOT NULL,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_tags        TEXT[] NOT NULL DEFAULT '{}', -- crew game tags that matched this article
  ai_relevance_score  REAL,
  ai_summary          TEXT,
  ai_label            TEXT,                        -- 'top_news' | 'community' | 'personal'
  ai_spoiler_warning  BOOLEAN NOT NULL DEFAULT FALSE,
  ai_curated_at       TIMESTAMPTZ,
  UNIQUE (source_type, external_id)
);

CREATE INDEX IF NOT EXISTS general_news_published_at_idx
  ON general_news (published_at DESC);

CREATE INDEX IF NOT EXISTS general_news_uncurated_idx
  ON general_news (id)
  WHERE ai_curated_at IS NULL;

CREATE INDEX IF NOT EXISTS general_news_relevance_idx
  ON general_news (ai_relevance_score DESC NULLS LAST, published_at DESC)
  WHERE COALESCE(ai_relevance_score, 1) > 0;

-- ── Server settings for news configuration ─────────────────────────────────

INSERT INTO server_settings (key, value, label, description, is_secret) VALUES
  (
    'newsapi_key',
    '',
    'GNews API Key',
    'Optional GNews.io API key for external gaming news queries. Leave blank to use RSS feeds only. Free tier: 100 requests/day.',
    TRUE
  ),
  (
    'news_dev_cap',
    '2',
    'Developer Diversity Cap',
    'Max number of games per developer included in news ingestion. Lower = more variety. Default: 2.',
    FALSE
  ),
  (
    'news_rss_sources',
    'pcgamer,rockpapershotgun,eurogamer,kotaku',
    'RSS News Sources',
    'Comma-separated list of enabled RSS sources. Options: pcgamer, rockpapershotgun, eurogamer, kotaku, ign.',
    FALSE
  ),
  (
    'news_general_enabled',
    'true',
    'External News Feed Enabled',
    'Master toggle for the external gaming news feed on the home page. Disable to show only Steam game news.',
    FALSE
  )
ON CONFLICT (key) DO NOTHING;
