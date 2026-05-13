-- scripts/schema.sql
-- Apply: psql $DATABASE_URL -f scripts/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  first_name    TEXT,
  family_name   TEXT,
  dob           DATE NOT NULL,
  photo         TEXT,
  bio           TEXT,
  city          TEXT,
  country       TEXT,
  social_number TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower
  ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_country_social
  ON users (country, social_number)
  WHERE country IS NOT NULL AND social_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_created_at
  ON users (created_at);

-- ─── posts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  post_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('text','image')),
  body          TEXT,
  image         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_locale TEXT,
  char_count    INTEGER,
  word_count    INTEGER,
  image_w       INTEGER,
  image_h       INTEGER,
  image_kb      INTEGER
);
CREATE INDEX IF NOT EXISTS posts_user_id     ON posts (user_id);
CREATE INDEX IF NOT EXISTS posts_created_at  ON posts (created_at DESC);

-- ─── nutrition_logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_logs (
  log_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  portion   TEXT,
  calories  NUMERIC(8,2) NOT NULL,
  protein_g NUMERIC(7,2),
  carbs_g   NUMERIC(7,2),
  fat_g     NUMERIC(7,2),
  notes     TEXT,
  source    TEXT NOT NULL DEFAULT 'text'
            CHECK (source IN ('text','image','quick','manual')),
  log_date  DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nutrition_logs_user_date
  ON nutrition_logs (user_id, log_date);

-- ─── friend_requests ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_requests (
  request_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS friend_requests_to_user
  ON friend_requests (to_user_id, status);
CREATE INDEX IF NOT EXISTS friend_requests_from_user
  ON friend_requests (from_user_id, status);

-- ─── user_blocks ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_blocks (
  block_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blocker_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  blocked_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocker
  ON user_blocks (blocker_id, blocked_until);
