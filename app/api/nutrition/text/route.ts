import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const SYSTEM_PROMPT = `You are a precise nutrition database. Given a description of food or a meal, return ONLY valid JSON — no markdown fences, no explanation — with this exact shape:
{
  "foods": [
    { "name": string, "portion": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number }
  ],
  "total": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number },
  "notes": string
}
Use reasonable average portion sizes when the user does not specify. Round all numbers to one decimal place. "notes" should mention any significant assumptions.`;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = (body as Record<string, unknown>)?.query;
  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `Food description: ${query.trim()}` },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    console.error("Gemini text error:", err);
    return NextResponse.json({ error: "Gemini request failed" }, { status: 502 });
  }

  const geminiData = (await geminiRes.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let nutrition: unknown;
  try {
    nutrition = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Could not parse Gemini response", raw }, { status: 502 });
  }

  return NextResponse.json({ nutrition });
}
