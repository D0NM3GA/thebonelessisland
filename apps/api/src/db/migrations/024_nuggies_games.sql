-- Server-authoritative Nuggies games: active session table + idempotency store.
-- Backs the /nuggies/games/* endpoints. Both the web casino and the Discord
-- bot are thin clients of the same routes; this schema is the shared mutex.

-- ────────────────────────────────────────────────────────────────────────────
-- nuggies_active_games
-- One row per user max (UNIQUE constraint = the universal "is a game in flight"
-- mutex across web + bot). Stateless games (coinflip, guessnumber) insert a row
-- briefly and DELETE it inside the same resolve transaction; stateful games
-- (blackjack) keep the row alive for the duration of the hand.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nuggies_active_games (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      BIGINT       NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  game_type    TEXT         NOT NULL,
  bet          BIGINT       NOT NULL CHECK (bet > 0),
  state        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  started_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ  NOT NULL,
  surface      TEXT         NOT NULL CHECK (surface IN ('web', 'bot'))
);

CREATE INDEX IF NOT EXISTS nuggies_active_games_expires_idx
  ON nuggies_active_games(expires_at);

-- ────────────────────────────────────────────────────────────────────────────
-- api_idempotency
-- Generic idempotency store for any mutating request that supplies an
-- Idempotency-Key header. Cached for 1 hour; sweep job (or pg_cron later)
-- clears expired rows.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_idempotency (
  key          TEXT         PRIMARY KEY,
  user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint     TEXT         NOT NULL,
  response     JSONB        NOT NULL,
  status_code  INT          NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS api_idempotency_expires_idx
  ON api_idempotency(expires_at);

CREATE INDEX IF NOT EXISTS api_idempotency_user_idx
  ON api_idempotency(user_id);
