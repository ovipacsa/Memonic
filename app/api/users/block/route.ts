import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { userId: targetId } = payload as { userId?: string };
  if (!targetId || typeof targetId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (targetId === session.userId) {
    return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
  }

  const sql = getDb();
  const blockedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO user_blocks (blocker_id, blocked_id, blocked_until)
    VALUES (${session.userId}::uuid, ${targetId}::uuid, ${blockedUntil})
    ON CONFLICT (blocker_id, blocked_id)
    DO UPDATE SET blocked_until = EXCLUDED.blocked_until, created_at = now()
  `;

  await sql`
    DELETE FROM friend_requests
    WHERE (from_user_id = ${session.userId}::uuid AND to_user_id = ${targetId}::uuid)
       OR (from_user_id = ${targetId}::uuid AND to_user_id = ${session.userId}::uuid)
  `;

  return NextResponse.json({ ok: true, blockedUntil: blockedUntil.toISOString() });
}
