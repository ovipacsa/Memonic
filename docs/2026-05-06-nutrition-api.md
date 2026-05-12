# 2026-05-06 — Nutrition API (Gemini integration)

## What was added

Two new API routes under `/api/nutrition/`, both auth-gated via the existing middleware:

| Route | Method | Input | Purpose |
|---|---|---|---|
| `/api/nutrition/text` | POST | `{ query: string }` | Text-based meal description → nutrition data |
| `/api/nutrition/image` | POST | multipart `image` file **or** JSON `{ image: dataURL }` | Photo of food → nutrition data |

Both return:
```json
{
  "nutrition": {
    "foods": [{ "name": "...", "portion": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }],
    "total": { "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 },
    "notes": "..."
  }
}
```

## Model

**`gemini-2.5-flash-lite`** via the Gemini REST API (`generativelanguage.googleapis.com/v1beta`). No SDK — raw `fetch` to keep the dependency list minimal. API key read from `GEMINI_API_KEY` in `.env`.

`responseMimeType: "application/json"` is passed in `generationConfig` so Gemini is constrained to valid JSON output. Temperature is set to 0.2 to reduce hallucination on nutritional facts.

## Decisions

**No Gemini SDK installed.** The project already avoids unnecessary deps (node:sqlite over better-sqlite3, no ORM). Native `fetch` is sufficient for two endpoints.

**Image route accepts both multipart and JSON data URL.** The text-post composer already works with base64 data URLs, so the JSON path lets a future frontend reuse that flow. The multipart path supports a direct `<input type="file">` upload without client-side base64 conversion.

**4 MB image cap** matches the Gemini inline data limit. The existing post image cap is 800 KB (for SQLite storage); the nutrition route does not store images, so the higher limit is appropriate.

**Auth enforced at two layers.** The middleware JWT check guards both routes at the edge. Each route handler also calls `getSession()` defensively (matching the existing `/api/posts` pattern).

**Frontend untouched.** Both routes return structured data; the UI integration is the next step.
