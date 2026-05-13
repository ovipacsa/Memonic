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

  const { requestId, action } = payload as { requestId?: string; action?: string };
  if (!requestId || (action !== "accept" && action !== "decline")) {
    return NextResponse.json(
      { error: "requestId and action ('accept'|'decline') required" },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [request] = await sql`
    SELECT request_id, to_user_id::text, status FROM friend_requests
    WHERE request_id = ${Number(requestId)}
  `;

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.to_user_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "Request already resolved" }, { status: 409 });
  }

  const newStatus = action === "accept" ? "accepted" : "declined";
  await sql`
    UPDATE friend_requests
    SET status = ${newStatus}, responded_at = now()
    WHERE request_id = ${Number(requestId)}
  `;

  return NextResponse.json({ ok: true, status: newStatus });
}
