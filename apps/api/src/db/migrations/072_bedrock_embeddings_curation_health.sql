-- Bedrock Titan embeddings (1024-dim) + news curation health tracking.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    DROP INDEX IF EXISTS general_news_embedding_idx;
    UPDATE general_news SET embedding = NULL;
    ALTER TABLE general_news DROP COLUMN IF EXISTS embedding;
    ALTER TABLE general_news ADD COLUMN embedding vector(1024);
    EXECUTE 'CREATE INDEX IF NOT EXISTS general_news_embedding_idx
               ON general_news USING ivfflat (embedding vector_cosine_ops)
               WITH (lists = 100)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS news_curation_runs (
  id            BIGSERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  run_kind      TEXT NOT NULL DEFAULT 'ingest',
  fetched       INT NOT NULL DEFAULT 0,
  curated       INT NOT NULL DEFAULT 0,
  merged        INT NOT NULL DEFAULT 0,
  duplicates    INT NOT NULL DEFAULT 0,
  failed        INT NOT NULL DEFAULT 0,
  embedded      INT NOT NULL DEFAULT 0,
  provider      TEXT,
  model         TEXT,
  error_summary TEXT,
  cost_usd      NUMERIC(12, 6)
);

CREATE INDEX IF NOT EXISTS news_curation_runs_started_at_idx
  ON news_curation_runs (started_at DESC);

INSERT INTO server_settings (key, value, label, description, is_secret) VALUES
  (
    'news_curation_alert_webhook_url',
    '',
    'News curation alert webhook',
    'Discord webhook URL for news pipeline health alerts (empty = off). Fires when curation produces zero cards despite new articles, or validation failures spike.',
    TRUE
  )
ON CONFLICT (key) DO NOTHING;
