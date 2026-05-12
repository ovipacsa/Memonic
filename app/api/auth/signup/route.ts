import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { signupSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/password";
import { isOldEnough, computeAge, MIN_AGE } from "@/lib/age";
import { id } from "@/lib/cuid";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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

  const db = getDb();

  const emailExists = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(v.email.toLowerCase());
  if (emailExists) {
    return NextResponse.json(
      { error: "An account already exists for that email." },
      { status: 409 }
    );
  }

  const socialExists = db
    .prepare("SELECT id FROM users WHERE country = ? AND social_number = ?")
    .get(v.country, v.socialNumber);
  if (socialExists) {
    return NextResponse.json(
      { error: "A Memonic account already exists for that country and social number." },
      { status: 409 }
    );
  }

  const userId = id();
  const passwordHash = await hashPassword(v.password);
  const createdAt = new Date().toISOString();
  const displayName = `${v.firstName} ${v.familyName}`.trim();

  db.prepare(
    `INSERT INTO users
      (id, email, password_hash, display_name, first_name, family_name, dob, photo, bio, city, country, social_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    v.email.toLowerCase(),
    passwordHash,
    displayName,
    v.firstName,
    v.familyName,
    v.dob,
    v.photo ?? null,
    null,
    null,
    v.country,
    v.socialNumber,
    createdAt
  );

  await setSessionCookie(userId);

  return NextResponse.json({ ok: true, userId });
}
