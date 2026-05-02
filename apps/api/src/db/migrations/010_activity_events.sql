CREATE TABLE IF NOT EXISTS activity_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  target_app_id INTEGER REFERENCES games(app_id) ON DELETE SET NULL,
  target_game_night_id BIGINT REFERENCES game_nights(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_events_created_at_idx ON activity_events (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_actor_idx ON activity_events (actor_user_id);
CREATE INDEX IF NOT EXISTS activity_events_event_type_idx ON activity_events (event_type);
