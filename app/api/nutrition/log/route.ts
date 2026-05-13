import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, type NutritionLogRow } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date")
    ?? new Date().toISOString().split("T")[0];

  const sql = getDb();
  const logs = await sql<NutritionLogRow[]>`
    SELECT
      log_id::text AS id, user_id::text, food_name, portion,
      calories::float, protein_g::float, carbs_g::float, fat_g::float,
      notes, source, log_date::text, logged_at::text
    FROM nutrition_logs
    WHERE user_id = ${session.userId}::uuid AND log_date = ${date}::date
    ORDER BY logged_at ASC
  `;

  return NextResponse.json({ logs });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const items = Array.isArray(body) ? body : [body];
  const sql = getDb();
  const logDate = new Date().toISOString().split("T")[0];
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

    const validSource =
      typeof source === "string" && ["text","image","quick","manual"].includes(source)
        ? source : "text";

    const [row] = await sql<NutritionLogRow[]>`
      INSERT INTO nutrition_logs
        (user_id, food_name, portion, calories, protein_g, carbs_g, fat_g, notes, source, log_date)
      VALUES
        (${session.userId}::uuid, ${food_name.trim()},
         ${typeof portion === "string" ? portion : null},
         ${calories},
         ${typeof protein_g === "number" ? protein_g : null},
         ${typeof carbs_g === "number" ? carbs_g : null},
         ${typeof fat_g === "number" ? fat_g : null},
         ${typeof notes === "string" ? notes : null},
         ${validSource}, ${logDate}::date)
      RETURNING
        log_id::text AS id, user_id::text, food_name, portion,
        calories::float, protein_g::float, carbs_g::float, fat_g::float,
        notes, source, log_date::text, logged_at::text
    `;
    inserted.push(row);
  }

  return NextResponse.json({ logs: inserted }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const entryId = new URL(req.url).searchParams.get("id");
  if (!entryId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sql = getDb();
  await sql`
    DELETE FROM nutrition_logs
    WHERE log_id = ${Number(entryId)} AND user_id = ${session.userId}::uuid
  `;

  return NextResponse.json({ ok: true });
}
