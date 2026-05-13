// Run: DATABASE_URL="postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" npx tsx scripts/migrate-sqlite-to-pg.ts
import { DatabaseSync } from "node:sqlite";
import postgres from "postgres";
import { join } from "path";
import { randomUUID } from "crypto";

const SQLITE_PATH = join(process.cwd(), "data", "memonic.db");
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const sqlite = new DatabaseSync(SQLITE_PATH);
const pg = postgres(DATABASE_URL, { max: 1 });

type AnyRow = Record<string, unknown>;

async function main() {
  console.log("Starting migration SQLite → PostgreSQL\n");

  // ── users ──────────────────────────────────────────────────────────────
  const sqliteUsers = sqlite.prepare(
    "SELECT * FROM users ORDER BY created_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqliteUsers.length} users...`);

  const idMap = new Map<string, string>(); // old nanoid TEXT → new UUID

  for (const u of sqliteUsers) {
    const newUuid = randomUUID();
    idMap.set(u.id as string, newUuid);

    await pg`
      INSERT INTO users
        (user_id, email, password_hash, display_name, first_name, family_name,
         dob, photo, bio, city, country, social_number, created_at)
      VALUES (
        ${newUuid}::uuid,
        ${u.email as string},
        ${u.password_hash as string},
        ${u.display_name as string},
        ${(u.first_name as string | null) ?? null},
        ${(u.family_name as string | null) ?? null},
        ${(u.dob as string)}::date,
        ${(u.photo as string | null) ?? null},
        ${(u.bio as string | null) ?? null},
        ${(u.city as string | null) ?? null},
        ${(u.country as string | null) ?? null},
        ${(u.social_number as string | null) ?? null},
        ${(u.created_at as string)}::timestamptz
      )
      ON CONFLICT (user_id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${sqliteUsers.length} users`);

  // ── posts ──────────────────────────────────────────────────────────────
  const sqlitePosts = sqlite.prepare(
    "SELECT * FROM posts ORDER BY created_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqlitePosts.length} posts...`);

  let skippedPosts = 0;
  for (const p of sqlitePosts) {
    const uid = idMap.get(p.user_id as string);
    if (!uid) { skippedPosts++; continue; }

    await pg`
      INSERT INTO posts
        (user_id, type, body, image, created_at, client_locale,
         char_count, word_count, image_w, image_h, image_kb)
      VALUES (
        ${uid}::uuid, ${p.type as string},
        ${(p.body as string | null) ?? null},
        ${(p.image as string | null) ?? null},
        ${(p.created_at as string)}::timestamptz,
        ${(p.client_locale as string | null) ?? null},
        ${(p.char_count as number | null) ?? null},
        ${(p.word_count as number | null) ?? null},
        ${(p.image_w as number | null) ?? null},
        ${(p.image_h as number | null) ?? null},
        ${(p.image_kb as number | null) ?? null}
      )
    `;
  }
  console.log(`  ✓ ${sqlitePosts.length - skippedPosts} posts (${skippedPosts} skipped — missing user)`);

  // ── nutrition_logs ─────────────────────────────────────────────────────
  const sqliteNutrition = sqlite.prepare(
    "SELECT * FROM nutrition_logs ORDER BY logged_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqliteNutrition.length} nutrition logs...`);

  let skippedNutrition = 0;
  for (const n of sqliteNutrition) {
    const uid = idMap.get(n.user_id as string);
    if (!uid) { skippedNutrition++; continue; }

    const rawSource = n.source as string ?? "text";
    const source = ["text","image","quick","manual"].includes(rawSource) ? rawSource : "text";

    await pg`
      INSERT INTO nutrition_logs
        (user_id, food_name, portion, calories, protein_g, carbs_g, fat_g,
         notes, source, log_date, logged_at)
      VALUES (
        ${uid}::uuid,
        ${n.food_name as string},
        ${(n.portion as string | null) ?? null},
        ${n.calories as number},
        ${(n.protein_g as number | null) ?? null},
        ${(n.carbs_g as number | null) ?? null},
        ${(n.fat_g as number | null) ?? null},
        ${(n.notes as string | null) ?? null},
        ${source},
        ${(n.log_date as string)}::date,
        ${(n.logged_at as string)}::timestamptz
      )
    `;
  }
  console.log(`  ✓ ${sqliteNutrition.length - skippedNutrition} nutrition logs`);

  // ── friend_requests ────────────────────────────────────────────────────
  const sqliteFR = sqlite.prepare(
    "SELECT * FROM friend_requests ORDER BY created_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqliteFR.length} friend requests...`);

  let skippedFR = 0;
  for (const fr of sqliteFR) {
    const from = idMap.get(fr.from_user_id as string);
    const to   = idMap.get(fr.to_user_id as string);
    if (!from || !to) { skippedFR++; continue; }

    const respondedAt = (fr.responded_at as string | null) ?? null;

    await pg`
      INSERT INTO friend_requests
        (from_user_id, to_user_id, status, created_at, responded_at)
      VALUES (
        ${from}::uuid, ${to}::uuid,
        ${fr.status as string},
        ${(fr.created_at as string)}::timestamptz,
        ${respondedAt ? pg`${respondedAt}::timestamptz` : null}
      )
      ON CONFLICT (from_user_id, to_user_id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${sqliteFR.length - skippedFR} friend requests`);

  // ── user_blocks ────────────────────────────────────────────────────────
  const sqliteBlocks = sqlite.prepare(
    "SELECT * FROM user_blocks ORDER BY created_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqliteBlocks.length} blocks...`);

  let skippedBlocks = 0;
  for (const b of sqliteBlocks) {
    const blocker = idMap.get(b.blocker_id as string);
    const blocked = idMap.get(b.blocked_id as string);
    if (!blocker || !blocked) { skippedBlocks++; continue; }

    await pg`
      INSERT INTO user_blocks (blocker_id, blocked_id, blocked_until, created_at)
      VALUES (
        ${blocker}::uuid, ${blocked}::uuid,
        ${(b.blocked_until as string)}::timestamptz,
        ${(b.created_at as string)}::timestamptz
      )
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${sqliteBlocks.length - skippedBlocks} blocks`);

  await pg.end();
  console.log("\n✅ Migration complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
