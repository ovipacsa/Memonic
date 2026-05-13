import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __memonicSql: postgres.Sql | undefined;
}

export function getDb(): postgres.Sql {
  if (!globalThis.__memonicSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    globalThis.__memonicSql = postgres(url, { max: 10 });
  }
  return globalThis.__memonicSql;
}

// All `id` fields are aliased PKs in SELECT queries (e.g. user_id AS id).
// BIGINT PKs come back as strings from postgres.js by default — kept as string
// to avoid breaking frontend components.

export type UserRow = {
  id: string;           // UUID, aliased from user_id
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
  id: string;           // BIGINT, aliased from post_id
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

export type PersonEntry = {
  id: string;           // UUID, aliased from user_id
  display_name: string;
  city: string | null;
  country: string | null;
  photo: string | null;
};

export type FriendRequestRow = {
  id: string;           // BIGINT, aliased from request_id
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
  id: string;           // BIGINT, aliased from block_id
  blocker_id: string;
  blocked_id: string;
  blocked_until: string;
  created_at: string;
};

export type NutritionLogRow = {
  id: string;           // BIGINT, aliased from log_id
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
