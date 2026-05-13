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

  const { toUserId } = payload as { toUserId?: string };
  if (!toUserId || typeof toUserId !== "string") {
    return NextResponse.json({ error: "toUserId required" }, { status: 400 });
  }
  if (toUserId === session.userId) {
    return NextResponse.json({ error: "Cannot befriend yourself" }, { status: 400 });
  }

  const sql = getDb();

  const [target] = await sql`
    SELECT user_id FROM users WHERE user_id = ${toUserId}::uuid
  `;
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [blocked] = await sql`
    SELECT block_id FROM user_blocks
    WHERE blocker_id = ${toUserId}::uuid
      AND blocked_id = ${session.userId}::uuid
      AND blocked_until > now()
  `;
  if (blocked) return NextResponse.json({ error: "Cannot send request at this time" }, { status: 403 });

  const [existing] = await sql`
    SELECT request_id, status FROM friend_requests
    WHERE (from_user_id = ${session.userId}::uuid AND to_user_id = ${toUserId}::uuid)
       OR (from_user_id = ${toUserId}::uuid AND to_user_id = ${session.userId}::uuid)
  `;
  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "Already friends" }, { status: 409 });
    }
    if (existing.status === "pending") {
      return NextResponse.json({ error: "Request already pending" }, { status: 409 });
    }
  }

  const [row] = await sql`
    INSERT INTO friend_requests (from_user_id, to_user_id)
    VALUES (${session.userId}::uuid, ${toUserId}::uuid)
    RETURNING request_id::text AS id
  `;

  return NextResponse.json({ ok: true, requestId: row.id });
}
