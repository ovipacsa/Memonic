import { NextResponse } from "next/server";
import { getDb, type FeedItem } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const SEARCH_QUERY = `
  SELECT
    p.id, p.user_id, p.type, p.body, p.image, p.created_at,
    p.client_locale, p.char_count, p.word_count,
    p.image_w, p.image_h, p.image_kb,
    u.display_name AS author_display_name,
    u.photo        AS author_photo,
    u.city         AS author_city
  FROM posts p
  JOIN users u ON u.id = p.user_id
  WHERE p.body LIKE ? COLLATE NOCASE
     OR u.display_name LIKE ? COLLATE NOCASE
     OR u.city LIKE ? COLLATE NOCASE
  ORDER BY p.created_at DESC
  LIMIT 100
`;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return NextResponse.json({ posts: [], q });

  const wildcard = `%${q}%`;
  const rows = getDb()
    .prepare(SEARCH_QUERY)
    .all(wildcard, wildcard, wildcard) as FeedItem[];

  return NextResponse.json({ posts: rows, q });
}
