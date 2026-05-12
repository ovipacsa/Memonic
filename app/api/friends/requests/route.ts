import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { FriendRequestWithSender } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const rows = db.prepare(
    `SELECT fr.id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at, fr.responded_at,
            u.display_name AS sender_display_name, u.photo AS sender_photo
     FROM friend_requests fr
     JOIN users u ON u.id = fr.from_user_id
     WHERE fr.to_user_id = ? AND fr.status = 'pending'
     ORDER BY fr.created_at DESC`
  ).all(session.userId) as FriendRequestWithSender[];

  return NextResponse.json({ requests: rows.map((r) => ({ ...r })) });
}
