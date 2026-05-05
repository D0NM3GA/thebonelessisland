-- Forums: categories, threads, posts, reactions, reports, mod log, bans.

CREATE TABLE IF NOT EXISTS forum_categories (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '💬',
  accent_color TEXT NOT NULL DEFAULT '#3b82f6',
  position INT NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS forum_categories_position_idx ON forum_categories(position, id);

CREATE TABLE IF NOT EXISTS forum_threads (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
  author_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INT NOT NULL DEFAULT 0,
  reply_count INT NOT NULL DEFAULT 0,
  last_reply_at TIMESTAMPTZ,
  last_reply_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS forum_threads_category_pinned_recent_idx
  ON forum_threads(category_id, is_pinned DESC, last_reply_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS forum_threads_recent_idx
  ON forum_threads(last_reply_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS forum_threads_author_idx ON forum_threads(author_user_id);

CREATE TABLE IF NOT EXISTS forum_posts (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_op BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS forum_posts_thread_created_idx ON forum_posts(thread_id, created_at);
CREATE INDEX IF NOT EXISTS forum_posts_author_idx ON forum_posts(author_user_id);

CREATE TABLE IF NOT EXISTS forum_post_reactions (
  post_id BIGINT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id, reaction)
);
CREATE INDEX IF NOT EXISTS forum_post_reactions_post_idx ON forum_post_reactions(post_id);

CREATE TABLE IF NOT EXISTS forum_reports (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT REFERENCES forum_posts(id) ON DELETE CASCADE,
  thread_id BIGINT REFERENCES forum_threads(id) ON DELETE CASCADE,
  reporter_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolver_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS forum_reports_status_idx ON forum_reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_mod_log (
  id BIGSERIAL PRIMARY KEY,
  moderator_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_thread_id BIGINT REFERENCES forum_threads(id) ON DELETE SET NULL,
  target_post_id BIGINT REFERENCES forum_posts(id) ON DELETE SET NULL,
  target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS forum_mod_log_recent_idx ON forum_mod_log(created_at DESC);

CREATE TABLE IF NOT EXISTS forum_user_bans (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  banned_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Server settings
INSERT INTO server_settings (key, value, label, description, is_secret) VALUES
  ('forums_enabled',           'true', 'Forums: enabled',                'Master switch for the forum system',                                  false),
  ('forums_post_min_chars',    '2',    'Forums: post min length',        'Minimum characters in a post body',                                   false),
  ('forums_post_max_chars',    '8000', 'Forums: post max length',        'Maximum characters in a post body',                                   false),
  ('forums_title_max_chars',   '160',  'Forums: thread title max',       'Maximum characters in a thread title',                                false),
  ('forums_new_thread_cooldown_secs','30','Forums: new thread cooldown', 'Min seconds between new threads per user',                            false),
  ('forums_reply_cooldown_secs','5',   'Forums: reply cooldown',         'Min seconds between replies per user',                                false),
  ('forums_thread_nuggies',    '5',    'Forums: nuggies per thread',     'Nuggies awarded for posting a new thread (0 to disable)',             false),
  ('forums_reply_nuggies',     '1',    'Forums: nuggies per reply',      'Nuggies awarded for posting a reply (0 to disable)',                  false)
ON CONFLICT (key) DO NOTHING;

-- Default categories
INSERT INTO forum_categories (slug, name, description, icon, accent_color, position) VALUES
  ('general',     'General Discussion',    'Anything island-related. Off-topic chatter goes here.',           '🏝️', '#0ea5e9', 0),
  ('gaming',      'Gaming',                'Game recommendations, builds, strategies, hot takes.',            '🎮', '#a855f7', 1),
  ('hardware',    'PC Hardware & Tech',    'Builds, peripherals, troubleshooting. Show off your rig.',        '🖥️', '#ef4444', 2),
  ('events',      'Game Nights & Events',  'Coordinate sessions, post recaps, plan future nights.',           '🗓️', '#f59e0b', 3),
  ('feedback',    'Site Feedback',         'Bugs, feature requests, suggestions for The Boneless Island.',    '💡', '#22c55e', 4),
  ('off-topic',   'Off-Topic',             'Memes, music, life updates, anything that doesn''t fit.',         '🌊', '#06b6d4', 5)
ON CONFLICT (slug) DO NOTHING;
