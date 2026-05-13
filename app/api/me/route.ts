import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  const sql = getDb();
  const [row] = await sql`
    SELECT user_id AS id, email, display_name, dob::text, photo, bio, city, created_at::text
    FROM users WHERE user_id = ${session.userId}::uuid
  `;

  if (!row) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: row });
}
