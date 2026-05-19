# Quickstart: Weather Widget — Feed Right Rail

**Branch**: `002-weather-widget`

---

## Prerequisites

- Node 22.5+, `npm install` already run
- `.env.local` with `DATABASE_URL` and `MEMONIC_JWT_SECRET`
- PostgreSQL running (local or remote)

---

## Files to Create

| Path | Purpose |
|---|---|
| `lib/weather.ts` | WMO code → ConditionCategory mapping (pure, testable) |
| `components/feed/WeatherWidget.tsx` | Cloud toggle button + widget panel (client component) |
| `app/api/me/preferences/route.ts` | PATCH endpoint for widget visibility preference |

## Files to Modify

| Path | Change |
|---|---|
| `lib/db.ts` | Add `weatherWidgetVisible: boolean` to `UserRow` |
| `app/api/me/route.ts` | SELECT + return `weather_widget_visible` |
| `app/feed/page.tsx` | SELECT `weather_widget_visible`; pass to `<WeatherWidget>`; add `<WeatherWidget>` above `<PeopleRail>` |
| `app/globals.css` | Add `@keyframes` for weather icon animations |

---

## Database Migration

Run once against your PostgreSQL instance (idempotent):

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weather_widget_visible BOOLEAN NOT NULL DEFAULT FALSE;
```

The migration also runs automatically on server startup via the DB bootstrap block.

---

## Smoke Test Sequence

1. `npm run dev` → open `http://localhost:3000/feed`
2. Confirm cloud-shaped button appears top-right of right rail — no overlap with content
3. Click cloud button → browser prompts for location
4. Grant location → widget fades in with temperature, rain %, humidity, and condition illustration
5. Reload page → widget appears open (preference persisted to DB)
6. Click X → widget fades out
7. Reload → widget is closed
8. Deny location permission → widget shows fallback message, no console errors
9. `npm run build` → must pass with zero type errors
10. `npm run lint` → must pass clean

---

## Testing

```bash
npm test                     # run full test suite
npm test -- weather          # run weather-specific tests only
```

Key test files:
- `__tests__/lib/weather.test.ts` — WMO mapping unit tests
- `__tests__/api/me-preferences.test.ts` — PATCH route integration tests
