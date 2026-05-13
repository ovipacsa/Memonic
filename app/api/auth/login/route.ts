import { NextResponse } from "next/server";
import { getDb, type UserRow } from "@/lib/db";
import { loginSchema } from "@/lib/schemas";
import { verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const sql = getDb();
  const [row] = await sql<UserRow[]>`
    SELECT
      user_id AS id, email, password_hash, display_name, first_name, family_name,
      dob::text, photo, bio, city, country, social_number, created_at::text
    FROM users WHERE LOWER(email) = LOWER(${email})
  `;

  if (!row) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  await setSessionCookie(row.id);
  return NextResponse.json({ ok: true, userId: row.id });
}
