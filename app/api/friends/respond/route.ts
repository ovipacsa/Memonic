import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { FriendRequestRow } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: unknown;
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { requestId, action } = payload as { requestId?: string; action?: string };
  if (!requestId || (action !== "accept" && action !== "decline")) {
    return NextResponse.json({ error: "requestId and action ('accept'|'decline') required" }, { status: 400 });
  }

  const db = getDb();
  const request = db.prepare("SELECT * FROM friend_requests WHERE id = ?").get(requestId) as FriendRequestRow | undefined;

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.to_user_id !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (request.status !== "pending") return NextResponse.json({ error: "Request already resolved" }, { status: 409 });

  const newStatus = action === "accept" ? "accepted" : "declined";
  db.prepare(
    "UPDATE friend_requests SET status = ?, responded_at = ? WHERE id = ?"
  ).run(newStatus, new Date().toISOString(), requestId);

  return NextResponse.json({ ok: true, status: newStatus });
}
