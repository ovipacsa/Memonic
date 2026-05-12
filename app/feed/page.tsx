import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, type FeedItem, type UserRow } from "@/lib/db";
import Masthead from "@/components/feed/Masthead";
import ProfileRail from "@/components/feed/ProfileRail";
import Feed from "@/components/feed/Feed";
import DailyStats from "@/components/nutrition/DailyStats";
import PeopleRail, { type PersonEntry } from "@/components/feed/PeopleRail";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const db = getDb();
  const meRow = db
    .prepare(
      "SELECT id, email, display_name, photo, bio, city, created_at FROM users WHERE id = ?"
    )
    .get(session.userId) as Pick<UserRow, "id" | "email" | "display_name" | "photo" | "bio" | "city" | "created_at"> | undefined;

  if (!meRow) redirect("/");
  const me = { ...meRow };

  const peopleRows = db
    .prepare(
      `SELECT id, display_name, city, country, photo
       FROM users
       WHERE id != ?
         AND id NOT IN (
           SELECT blocked_id FROM user_blocks
           WHERE blocker_id = ? AND blocked_until > datetime('now')
         )
         AND id NOT IN (
           SELECT CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END
           FROM friend_requests
           WHERE status = 'accepted'
             AND (from_user_id = ? OR to_user_id = ?)
         )
         AND id NOT IN (
           SELECT to_user_id FROM friend_requests
           WHERE from_user_id = ? AND status = 'pending'
         )
       ORDER BY RANDOM()
       LIMIT 10`
    )
    .all(session.userId, session.userId, session.userId, session.userId, session.userId, session.userId) as PersonEntry[];
  const people = peopleRows.map((p) => ({ ...p }));

  const postRows = db
    .prepare(
      `SELECT
        p.id, p.user_id, p.type, p.body, p.image, p.created_at,
        p.client_locale, p.char_count, p.word_count,
        p.image_w, p.image_h, p.image_kb,
        u.display_name AS author_display_name,
        u.photo        AS author_photo,
        u.city         AS author_city
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ?
         OR p.user_id IN (
           SELECT CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END
           FROM friend_requests
           WHERE status = 'accepted'
             AND (from_user_id = ? OR to_user_id = ?)
         )
      ORDER BY p.created_at DESC
      LIMIT 100`
    )
    .all(session.userId, session.userId, session.userId, session.userId) as FeedItem[];
  const posts = postRows.map((p) => ({ ...p }));

  const today = new Date().toISOString().split("T")[0];
  const nutritionToday = db
    .prepare(
      "SELECT COALESCE(SUM(calories),0) as total_cal, COUNT(*) as entry_count FROM nutrition_logs WHERE user_id = ? AND log_date = ?"
    )
    .get(session.userId, today) as { total_cal: number; entry_count: number };

  return (
    <main className="px-[var(--gutter)] py-[clamp(28px,4vw,56px)]">
      <div className="mx-auto max-w-[var(--max)]">
        <Masthead withReturn />
        <div className="grid gap-10 md:grid-cols-[300px_minmax(0,1fr)_240px]">
          <div className="md:sticky md:top-6 md:self-start space-y-4">
            <ProfileRail me={me} />
            <DailyStats
              totalCalories={nutritionToday.total_cal}
              entryCount={nutritionToday.entry_count}
            />
          </div>
          <Feed initialPosts={posts} />
          <div className="md:sticky md:top-6 md:self-start">
            <PeopleRail people={people} />
          </div>
        </div>

        <footer className="mt-24 border-t border-cyan/30 pt-8 text-center">
          <p className="terminal text-star-soft text-[18px]">
            Set in Monoton &amp; VT323. Signal hosted in{" "}
            <em className="not-italic text-magenta glow-magenta">Frankfurt</em>.
            Mnemonic Studio · Stardate 2026.05.
          </p>
          <p className="terminal mt-3 text-[18px] text-cyan glow-cyan">
            We are, all of us, made of star-stuff.
          </p>
        </footer>
      </div>
    </main>
  );
}
