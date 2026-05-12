import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { id } from "@/lib/cuid";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: unknown;
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId: targetId } = payload as { userId?: string };
  if (!targetId || typeof targetId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (targetId === session.userId) {
    return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
  }

  const db = getDb();
  const blockedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Upsert block (refresh timer if already blocked)
  const existing = db.prepare(
    "SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?"
  ).get(session.userId, targetId);

  if (existing) {
    db.prepare(
      "UPDATE user_blocks SET blocked_until = ?, created_at = ? WHERE blocker_id = ? AND blocked_id = ?"
    ).run(blockedUntil, now, session.userId, targetId);
  } else {
    db.prepare(
      "INSERT INTO user_blocks (id, blocker_id, blocked_id, blocked_until, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(id(), session.userId, targetId, blockedUntil, now);
  }

  // Remove any existing friendship between the two users
  db.prepare(
    `DELETE FROM friend_requests
     WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`
  ).run(session.userId, targetId, targetId, session.userId);

  return NextResponse.json({ ok: true, blockedUntil });
}
