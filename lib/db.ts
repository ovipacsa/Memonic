import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, "memonic.db");

declare global {
  // eslint-disable-next-line no-var
  var __memonicDb: DatabaseSync | undefined;
}

function bootstrap(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name  TEXT NOT NULL,
      first_name    TEXT,
      family_name   TEXT,
      dob           TEXT NOT NULL,
      photo         TEXT,
      bio           TEXT,
      city          TEXT,
      country       TEXT,
      social_number TEXT,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type          TEXT NOT NULL CHECK (type IN ('text','image')),
      body          TEXT,
      image         TEXT,
      created_at    TEXT NOT NULL,
      client_locale TEXT,
      char_count    INTEGER,
      word_count    INTEGER,
      image_w       INTEGER,
      image_h       INTEGER,
      image_kb      INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);

    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      food_name  TEXT NOT NULL,
      portion    TEXT,
      calories   REAL NOT NULL,
      protein_g  REAL,
      carbs_g    REAL,
      fat_g      REAL,
      notes      TEXT,
      source     TEXT NOT NULL DEFAULT 'text',
      log_date   TEXT NOT NULL,
      logged_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON nutrition_logs(user_id, log_date);

    CREATE TABLE IF NOT EXISTS friend_requests (
      id           TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
      created_at   TEXT NOT NULL,
      responded_at TEXT,
      UNIQUE(from_user_id, to_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_fr_to_user ON friend_requests(to_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_fr_from_user ON friend_requests(from_user_id, status);

    CREATE TABLE IF NOT EXISTS user_blocks (
      id            TEXT PRIMARY KEY,
      blocker_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_until TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      UNIQUE(blocker_id, blocked_id)
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks(blocker_id, blocked_until);
  `);

  // Migration: create tables that may not exist in older DB files
  const tablesMigrate = [
    `CREATE TABLE IF NOT EXISTS user_blocks (
      id            TEXT PRIMARY KEY,
      blocker_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_until TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      UNIQUE(blocker_id, blocked_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks(blocker_id, blocked_until)`,
    `CREATE TABLE IF NOT EXISTS friend_requests (
      id           TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
      created_at   TEXT NOT NULL,
      responded_at TEXT,
      UNIQUE(from_user_id, to_user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_fr_to_user ON friend_requests(to_user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_fr_from_user ON friend_requests(from_user_id, status)`,
  ];
  for (const sql of tablesMigrate) {
    try { d.exec(sql); } catch { /* already exists */ }
  }

  // Migration: add new columns if they don't exist yet (SQLite ALTER TABLE is append-only)
  const migrate = [
    "ALTER TABLE users ADD COLUMN first_name TEXT",
    "ALTER TABLE users ADD COLUMN family_name TEXT",
    "ALTER TABLE users ADD COLUMN country TEXT",
    "ALTER TABLE users ADD COLUMN social_number TEXT",
  ];
  for (const sql of migrate) {
    try { d.exec(sql); } catch { /* column already exists */ }
  }

  // Unique constraint: one social_number per country
  try {
    d.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_country_social
        ON users(country, social_number)
        WHERE country IS NOT NULL AND social_number IS NOT NULL
    `);
  } catch { /* index already exists */ }
}

export function getDb(): DatabaseSync {
  if (!globalThis.__memonicDb) {
    const d = new DatabaseSync(DB_PATH);
    bootstrap(d);
    globalThis.__memonicDb = d;
  }
  return globalThis.__memonicDb;
}

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  first_name: string | null;
  family_name: string | null;
  dob: string;
  photo: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  social_number: string | null;
  created_at: string;
};

export type PostRow = {
  id: string;
  user_id: string;
  type: "text" | "image";
  body: string | null;
  image: string | null;
  created_at: string;
  client_locale: string | null;
  char_count: number | null;
  word_count: number | null;
  image_w: number | null;
  image_h: number | null;
  image_kb: number | null;
};

export type FeedItem = PostRow & {
  author_display_name: string;
  author_photo: string | null;
  author_city: string | null;
};

export type FriendRequestRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
};

export type FriendRequestWithSender = FriendRequestRow & {
  sender_display_name: string;
  sender_photo: string | null;
};

export type UserBlockRow = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  blocked_until: string;
  created_at: string;
};

export type NutritionLogRow = {
  id: string;
  user_id: string;
  food_name: string;
  portion: string | null;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  source: string;
  log_date: string;
  logged_at: string;
};
