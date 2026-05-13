import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, type FriendRequestWithSender } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sql = getDb();
  const requests = await sql<FriendRequestWithSender[]>`
    SELECT
      fr.request_id::text AS id,
      fr.from_user_id::text, fr.to_user_id::text,
      fr.status, fr.created_at::text, fr.responded_at::text,
      u.display_name AS sender_display_name,
      u.photo        AS sender_photo
    FROM friend_requests fr
    JOIN users u ON u.user_id = fr.from_user_id
    WHERE fr.to_user_id = ${session.userId}::uuid AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `;

  return NextResponse.json({ requests });
}
