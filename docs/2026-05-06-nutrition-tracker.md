# 2026-05-06 — Nutrition Tracker

## What changed

Added a full calorie-tracking feature at `/nutrition`, accessible only to authenticated users. The feed page (`/feed`) now shows a daily calorie summary in the sidebar that links to the tracker.

## Three ways to log food

1. **Describe It** — free-text textarea; calls `POST /api/nutrition/text` (Gemini 2.5 Flash Lite) to extract structured nutrition data; user confirms and adds all items at once.
2. **Photo Scan** — file upload with live preview; calls `POST /api/nutrition/image` (Gemini vision); detected items shown with checkboxes so the user can deselect anything misidentified before logging.
3. **Quick Add** — manual form (name + calories, optional protein/carbs/fat); zero AI latency for known foods.

## New files

| Path | Purpose |
|---|---|
| `app/nutrition/page.tsx` | Server page — auth guard, passes `displayName` to tracker |
| `components/nutrition/NutritionTracker.tsx` | Main client component — tabs, AI calls, log display |
| `components/nutrition/DailyStats.tsx` | Feed sidebar widget — daily calories link |
| `app/api/nutrition/log/route.ts` | GET / POST / DELETE for nutrition log entries |

## Modified files

| Path | Change |
|---|---|
| `lib/db.ts` | Added `nutrition_logs` table + `NutritionLogRow` type |
| `middleware.ts` | Added `/nutrition` to protected pages and matcher |
| `app/feed/page.tsx` | Queries today's log totals; renders `DailyStats` in sidebar |

## Database

New table `nutrition_logs`:
```sql
id, user_id, food_name, portion, calories, protein_g, carbs_g, fat_g,
notes, source (text|image|quick), log_date (YYYY-MM-DD), logged_at (ISO)
```

Indexed on `(user_id, log_date)` for fast daily queries.

## Daily reset behaviour

The UI always queries `log_date = today`, so each day starts fresh. All historical entries are preserved in the database — the reset is purely a query filter, not a delete.

## Error handling

- Loading spinners on all AI calls (text analysis, image scan, save operations)
- Inline error banners (magenta left-border) on any fetch failure
- 4 MB hard cap on image uploads enforced client-side before the API call
