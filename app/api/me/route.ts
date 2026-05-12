import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, type UserRow } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  const row = getDb()
    .prepare(
      "SELECT id, email, display_name, dob, photo, bio, city, created_at FROM users WHERE id = ?"
    )
    .get(session.userId) as Omit<UserRow, "password_hash"> | undefined;

  if (!row) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({ user: row });
}
