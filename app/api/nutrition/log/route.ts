import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, type NutritionLogRow } from "@/lib/db";
import { id } from "@/lib/cuid";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM nutrition_logs WHERE user_id = ? AND log_date = ? ORDER BY logged_at ASC"
    )
    .all(session.userId, date) as NutritionLogRow[];

  return NextResponse.json({ logs: rows.map((r) => ({ ...r })) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : [body];
  const db = getDb();
  const now = new Date().toISOString();
  const logDate = now.split("T")[0];
  const inserted: NutritionLogRow[] = [];

  for (const item of items) {
    const { food_name, portion, calories, protein_g, carbs_g, fat_g, notes, source } =
      item as Record<string, unknown>;

    if (typeof food_name !== "string" || !food_name.trim()) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }
    if (typeof calories !== "number" || isNaN(calories)) {
      return NextResponse.json({ error: "calories must be a number" }, { status: 400 });
    }

    const newId = id();
    db.prepare(
      `INSERT INTO nutrition_logs
        (id, user_id, food_name, portion, calories, protein_g, carbs_g, fat_g, notes, source, log_date, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newId,
      session.userId,
      food_name.trim(),
      typeof portion === "string" ? portion : null,
      calories,
      typeof protein_g === "number" ? protein_g : null,
      typeof carbs_g === "number" ? carbs_g : null,
      typeof fat_g === "number" ? fat_g : null,
      typeof notes === "string" ? notes : null,
      typeof source === "string" && ["text", "image", "quick"].includes(source) ? source : "text",
      logDate,
      now
    );

    const row = db
      .prepare("SELECT * FROM nutrition_logs WHERE id = ?")
      .get(newId) as NutritionLogRow;
    inserted.push({ ...row });
  }

  return NextResponse.json({ logs: inserted }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get("id");
  if (!entryId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const db = getDb();
  db.prepare(
    "DELETE FROM nutrition_logs WHERE id = ? AND user_id = ?"
  ).run(entryId, session.userId);

  return NextResponse.json({ ok: true });
}
