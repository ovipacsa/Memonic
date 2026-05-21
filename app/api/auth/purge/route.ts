import { NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sql = getDb();
  try {
    await sql`
      UPDATE users
      SET deactivated = TRUE, deactivated_at = NOW()
      WHERE user_id = ${session.userId}::uuid
    `;
  } catch {
    return NextResponse.json({ error: "Failed to deactivate account." }, { status: 500 });
  }

  clearSessionCookie();
  return NextResponse.json({ success: true });
}
