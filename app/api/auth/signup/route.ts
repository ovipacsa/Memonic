import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { signupSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/password";
import { isOldEnough, computeAge, MIN_AGE } from "@/lib/age";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = signupSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const v = parsed.data;

  if (!isOldEnough(v.dob)) {
    const age = computeAge(v.dob);
    return NextResponse.json(
      { error: `You must be at least ${MIN_AGE} to join. We computed your age as ${age}.` },
      { status: 403 }
    );
  }

  const sql = getDb();

  const [emailExists] = await sql`
    SELECT user_id FROM users WHERE LOWER(email) = LOWER(${v.email})
  `;
  if (emailExists) {
    return NextResponse.json(
      { error: "An account already exists for that email." },
      { status: 409 }
    );
  }

  const [socialExists] = await sql`
    SELECT user_id FROM users
    WHERE country = ${v.country} AND social_number = ${v.socialNumber}
  `;
  if (socialExists) {
    return NextResponse.json(
      { error: "A Memonic account already exists for that country and social number." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(v.password);
  const displayName = `${v.firstName} ${v.familyName}`.trim();

  const [row] = await sql`
    INSERT INTO users
      (email, password_hash, display_name, first_name, family_name,
       dob, photo, country, social_number)
    VALUES
      (LOWER(${v.email}), ${passwordHash}, ${displayName},
       ${v.firstName}, ${v.familyName},
       ${v.dob}::date, ${v.photo ?? null}, ${v.country}, ${v.socialNumber})
    RETURNING user_id AS id
  `;

  await setSessionCookie(row.id);
  return NextResponse.json({ ok: true, userId: row.id });
}
