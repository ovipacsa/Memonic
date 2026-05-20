import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const PreferencesBody = z.object({
  weatherWidgetVisible:  z.boolean().optional(),
  currencyWidgetVisible: z.boolean().optional(),
}).refine(
  (d) => d.weatherWidgetVisible !== undefined || d.currencyWidgetVisible !== undefined,
  { message: "At least one preference field required" }
);

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PreferencesBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sql = getDb();
  try {
    const { weatherWidgetVisible, currencyWidgetVisible } = parsed.data;
    if (weatherWidgetVisible !== undefined) {
      await sql`
        UPDATE users SET weather_widget_visible = ${weatherWidgetVisible}
        WHERE user_id = ${session.userId}::uuid
      `;
    }
    if (currencyWidgetVisible !== undefined) {
      await sql`
        UPDATE users SET currency_widget_visible = ${currencyWidgetVisible}
        WHERE user_id = ${session.userId}::uuid
      `;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
