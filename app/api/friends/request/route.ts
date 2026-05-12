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

  const { toUserId } = payload as { toUserId?: string };
  if (!toUserId || typeof toUserId !== "string") {
    return NextResponse.json({ error: "toUserId required" }, { status: 400 });
  }
  if (toUserId === session.userId) {
    return NextResponse.json({ error: "Cannot befriend yourself" }, { status: 400 });
  }

  const db = getDb();

  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(toUserId);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check if blocked by target
  const blocked = db.prepare(
    "SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ? AND blocked_until > datetime('now')"
  ).get(toUserId, session.userId);
  if (blocked) return NextResponse.json({ error: "Cannot send request at this time" }, { status: 403 });

  // Check existing request in either direction
  const existing = db.prepare(
    `SELECT id, status FROM friend_requests
     WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`
  ).get(session.userId, toUserId, toUserId, session.userId) as { id: string; status: string } | undefined;

  if (existing) {
    if (existing.status === "accepted") return NextResponse.json({ error: "Already friends" }, { status: 409 });
    if (existing.status === "pending") return NextResponse.json({ error: "Request already pending" }, { status: 409 });
  }

  const requestId = id();
  db.prepare(
    "INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
  ).run(requestId, session.userId, toUserId, new Date().toISOString());

  return NextResponse.json({ ok: true, requestId });
}
