-- Extend general_news with AI-generated subtitle, editorial tags, and crew-relevance explanation.
-- These fields are populated by the updated curation prompt; existing rows stay NULL until recurated.
ALTER TABLE general_news
  ADD COLUMN ai_subtitle        TEXT,
  ADD COLUMN ai_tags            TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN ai_why_recommended TEXT;

-- Per-user feedback on AI summarization quality (not story quality).
CREATE TABLE general_news_feedback (
  user_id    BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  news_id    INTEGER NOT NULL REFERENCES general_news(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, news_id)
);
CREATE INDEX general_news_feedback_news_idx ON general_news_feedback(news_id);
