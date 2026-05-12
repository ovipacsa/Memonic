import { NextResponse } from "next/server";
import { getDb, type FeedItem } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { newPostSchema } from "@/lib/schemas";
import { id } from "@/lib/cuid";
import { wordCount } from "@/lib/format";

export const runtime = "nodejs";

const FEED_LIMIT = 100;
const MAX_IMAGE_BYTES = 800 * 1024; // 800 KB

const FEED_QUERY = `
  SELECT
    p.id, p.user_id, p.type, p.body, p.image, p.created_at,
    p.client_locale, p.char_count, p.word_count,
    p.image_w, p.image_h, p.image_kb,
    u.display_name AS author_display_name,
    u.photo        AS author_photo,
    u.city         AS author_city
  FROM posts p
  JOIN users u ON u.id = p.user_id
  ORDER BY p.created_at DESC
  LIMIT ?
`;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rows = getDb().prepare(FEED_QUERY).all(FEED_LIMIT) as FeedItem[];
  return NextResponse.json({ posts: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = newPostSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const v = parsed.data;

  if (v.type === "image" && v.image) {
    // base64 length to bytes: roughly len * 3/4
    const approxBytes = Math.floor(v.image.length * 0.75);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image too large. Cap is 800 KB." },
        { status: 413 }
      );
    }
  }

  const postId = id();
  const createdAt = new Date().toISOString();
  const body = v.body?.trim() || null;
  const charCount = body ? body.length : null;
  const wcount = body ? wordCount(body) : null;

  getDb()
    .prepare(
      `INSERT INTO posts
        (id, user_id, type, body, image, created_at,
         client_locale, char_count, word_count,
         image_w, image_h, image_kb)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      postId,
      session.userId,
      v.type,
      body,
      v.type === "image" ? v.image ?? null : null,
      createdAt,
      v.clientLocale ?? null,
      charCount,
      wcount,
      v.imageW ?? null,
      v.imageH ?? null,
      v.imageKb ?? null
    );

  const row = getDb()
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
      WHERE p.id = ?`
    )
    .get(postId) as FeedItem;

  return NextResponse.json({ post: row });
}
