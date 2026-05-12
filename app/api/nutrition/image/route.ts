import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const SYSTEM_PROMPT = `You are a precise nutrition database with computer vision. Identify all visible foods in the image and return ONLY valid JSON — no markdown fences, no explanation — with this exact shape:
{
  "foods": [
    { "name": string, "portion": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number }
  ],
  "total": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number },
  "notes": string
}
Estimate portions from visual cues (plate size, serving utensils, context). Round all numbers to one decimal place. If you cannot identify a food with confidence, include it with a note. "notes" should mention any significant assumptions or low-confidence identifications.`;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB — Gemini inline limit

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });

  const contentType = req.headers.get("content-type") ?? "";

  let base64Data: string;
  let mimeType: string;

  if (contentType.includes("multipart/form-data")) {
    // Uploaded as a file field named "image"
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "image field is required" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large (max 4 MB)" }, { status: 413 });
    }
    const buf = await file.arrayBuffer();
    base64Data = Buffer.from(buf).toString("base64");
    mimeType = file.type || "image/jpeg";
  } else {
    // JSON body: { image: "data:image/jpeg;base64,..." } or { image: "<raw base64>", mimeType: "image/jpeg" }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const imageField = (body as Record<string, unknown>)?.image;
    if (typeof imageField !== "string" || !imageField) {
      return NextResponse.json({ error: "image field is required" }, { status: 400 });
    }

    if (imageField.startsWith("data:")) {
      // data URL
      const comma = imageField.indexOf(",");
      if (comma === -1) return NextResponse.json({ error: "Invalid data URL" }, { status: 400 });
      const meta = imageField.slice(5, comma); // "image/jpeg;base64"
      mimeType = meta.split(";")[0];
      base64Data = imageField.slice(comma + 1);
    } else {
      base64Data = imageField;
      mimeType =
        typeof (body as Record<string, unknown>).mimeType === "string"
          ? ((body as Record<string, unknown>).mimeType as string)
          : "image/jpeg";
    }

    const approxBytes = Math.floor(base64Data.length * 0.75);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large (max 4 MB)" }, { status: 413 });
    }
  }

  const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    console.error("Gemini image error:", err);
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
