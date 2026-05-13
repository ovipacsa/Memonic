import { NextResponse } from "next/server";
import { getDb, type FeedItem } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { newPostSchema } from "@/lib/schemas";
import { wordCount } from "@/lib/format";

export const runtime = "nodejs";

const FEED_LIMIT = 100;
const MAX_IMAGE_BYTES = 800 * 1024;

const FEED_SELECT = `
  p.post_id::text AS id, p.user_id::text, p.type, p.body, p.image,
  p.created_at::text, p.client_locale, p.char_count, p.word_count,
  p.image_w, p.image_h, p.image_kb,
  u.display_name AS author_display_name,
  u.photo        AS author_photo,
  u.city         AS author_city
`;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sql = getDb();
  const posts = await sql<FeedItem[]>`
    SELECT ${sql.unsafe(FEED_SELECT)}
    FROM posts p
    JOIN users u ON u.user_id = p.user_id
    WHERE p.user_id = ${session.userId}::uuid
       OR p.user_id IN (
         SELECT CASE
           WHEN from_user_id = ${session.userId}::uuid THEN to_user_id
           ELSE from_user_id
         END
         FROM friend_requests
         WHERE status = 'accepted'
           AND (from_user_id = ${session.userId}::uuid OR to_user_id = ${session.userId}::uuid)
       )
    ORDER BY p.created_at DESC
    LIMIT ${FEED_LIMIT}
  `;

  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = newPostSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const v = parsed.data;

  if (v.type === "image" && v.image) {
    if (Math.floor(v.image.length * 0.75) > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large. Cap is 800 KB." }, { status: 413 });
    }
  }

  const sql = getDb();
  const body = v.body?.trim() || null;
  const charCount = body ? body.length : null;
  const wcount = body ? wordCount(body) : null;

  const [inserted] = await sql`
    INSERT INTO posts
      (user_id, type, body, image, client_locale, char_count, word_count, image_w, image_h, image_kb)
    VALUES
      (${session.userId}::uuid, ${v.type}, ${body},
       ${v.type === "image" ? (v.image ?? null) : null},
       ${v.clientLocale ?? null}, ${charCount}, ${wcount},
       ${v.imageW ?? null}, ${v.imageH ?? null}, ${v.imageKb ?? null})
    RETURNING post_id
  `;

  const [post] = await sql<FeedItem[]>`
    SELECT ${sql.unsafe(FEED_SELECT)}
    FROM posts p
    JOIN users u ON u.user_id = p.user_id
    WHERE p.post_id = ${inserted.post_id}
  `;

  return NextResponse.json({ post });
}
