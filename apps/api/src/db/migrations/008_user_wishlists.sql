CREATE TABLE IF NOT EXISTS user_wishlists (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES games(app_id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, app_id)
);

CREATE INDEX IF NOT EXISTS user_wishlists_app_id_idx ON user_wishlists (app_id);
CREATE INDEX IF NOT EXISTS user_wishlists_user_id_idx ON user_wishlists (user_id);
