import { NextResponse } from "next/server";
import { getDb, type FeedItem } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ posts: [], q });

  const wildcard = `%${q}%`;
  const sql = getDb();

  const posts = await sql<FeedItem[]>`
    SELECT
      p.post_id::text AS id, p.user_id::text, p.type, p.body, p.image,
      p.created_at::text, p.client_locale, p.char_count, p.word_count,
      p.image_w, p.image_h, p.image_kb,
      u.display_name AS author_display_name,
      u.photo        AS author_photo,
      u.city         AS author_city
    FROM posts p
    JOIN users u ON u.user_id = p.user_id
    WHERE p.body ILIKE ${wildcard}
       OR u.display_name ILIKE ${wildcard}
       OR u.city ILIKE ${wildcard}
    ORDER BY p.created_at DESC
    LIMIT 100
  `;

  return NextResponse.json({ posts, q });
}
