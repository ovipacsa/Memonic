# Research: Weather Widget — Feed Right Rail

**Phase**: 0 — Outline & Research
**Date**: 2026-05-15
**Branch**: `002-weather-widget`

---

## R-001: Weather Data Source Selection

**Decision**: Browser Geolocation API + Open-Meteo (client-side, no server proxy)

**Rationale**:
Open-Meteo is a free, open-source numerical weather prediction API backed by ECMWF and DWD model data. It requires no API key, supports unrestricted browser-side CORS requests, and returns a structured JSON payload with exactly the fields required: `temperature_2m`, `relative_humidity_2m`, `precipitation_probability`, and `weather_code`. Round-trip latency from a European browser is typically 150–300 ms.

**Alternatives considered**:
- Gemini API: excluded — it is a language model with no live weather data feed; results would be non-deterministic and would consume nutrition AI quota. Decision documented in spec.
- OpenWeatherMap: requires an API key (even on the free tier), which would either expose the key client-side or require a server proxy — both add complexity. Open-Meteo is strictly simpler.
- Server-side weather proxy route: unnecessary — Open-Meteo accepts browser requests directly. Adding a Next.js API route would add latency and server cost for zero benefit.

**Open-Meteo request format**:
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code
  &temperature_unit=celsius
```

**Open-Meteo response shape**:
```json
{
  "current": {
    "time": "2026-05-15T14:00",
    "temperature_2m": 18.5,
    "relative_humidity_2m": 72,
    "precipitation_probability": 20,
    "weather_code": 2
  }
}
```

---

## R-002: WMO Weather Code → Condition Category Mapping

**Decision**: Four condition categories mapped from WMO 4677 codes

| Category | WMO Codes | Visual |
|---|---|---|
| `sunny` | 0 | Full sun, no clouds |
| `partly-cloudy` | 1, 2 | Sun behind cloud |
| `overcast` | 3 | Clouds only |
| `rainy` | 45, 48, 51–82, 95–99 | Clouds with rain drops |
| `rainy` (fallback) | 71–77 (snow) | Same clouds-with-rain illustration for MVP |

Codes not listed (impossible from Open-Meteo current-weather endpoint) default to `overcast`.

---

## R-003: Feed Layout Analysis

**Decision**: Weather widget placed as first child of the existing right-column `<div>` in `app/feed/page.tsx`

**Current layout** (line 87–98 of `app/feed/page.tsx`):
```tsx
<div className="grid gap-10 md:grid-cols-[300px_minmax(0,1fr)_240px]">
  <div className="md:sticky md:top-6 md:self-start space-y-4">
    {/* ProfileRail + DailyStats — left column */}
  </div>
  <Feed initialPosts={posts} />
  <div className="md:sticky md:top-6 md:self-start">
    <PeopleRail people={people} />  {/* right column — 240px */}
  </div>
</div>
```

The right column is 240 px wide, sticky at top-6. The `WeatherWidget` component will be inserted above `PeopleRail` in this column. The cloud toggle button is the topmost element in the column — it appears visually in the "upper right of the page" as requested, adjacent to the Masthead's final letterform.

---

## R-004: Database Schema Change

**Decision**: Add `weather_widget_visible BOOLEAN NOT NULL DEFAULT FALSE` to the `users` table via an idempotent migration

The column defaults to `FALSE` so all existing users start with the widget hidden — no backfill required. The migration is wrapped in a try/catch `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` per the project's idempotent migration convention.

The `UserRow` type in `lib/db.ts` gains a `weatherWidgetVisible: boolean` field. The feed page query adds `weather_widget_visible` to the SELECT list and passes the value to `WeatherWidget` as an `initialVisible` prop.

---

## R-005: User Preference Persistence API

**Decision**: New `PATCH /api/me/preferences` route, auth-gated, with a zod-validated request body

The preference is stored in the `users` table (not a separate table) since it is a single boolean scalar on the user record. A dedicated `preferences` table would be over-engineering for one field.

Request body schema:
```ts
z.object({ weatherWidgetVisible: z.boolean() })
```

The route validates the session, validates the body, and executes:
```sql
UPDATE users SET weather_widget_visible = $1 WHERE user_id = $2
```

The `/api/me` GET route's returned payload gains `weatherWidgetVisible` so the client can read it without a separate round-trip.

---

## R-006: Client-Side Refresh Strategy

**Decision**: Fetch on widget open; cache result in component state; re-fetch if cached data is > 30 minutes old

Weather data is fetched lazily — only when the user opens the widget. A `lastFetched` timestamp is kept in component state. If the widget is closed and reopened within 30 minutes, the cached data is shown immediately. After 30 minutes, a fresh fetch is triggered. This prevents unnecessary network calls on rapid open/close cycles while keeping data reasonably current.

---

## R-007: Animation Approach

**Decision**: Tailwind `transition-opacity` + `duration-300` controlled by a `visible` boolean; SVG weather icons with CSS keyframe animations

The widget panel uses `opacity-0 pointer-events-none` when hidden and `opacity-100` when visible, with `transition-opacity duration-300`. This is pure CSS — no animation library dependency — keeping bundle size impact minimal.

SVG weather icons use `@keyframes` defined in `globals.css`:
- Sun: `glow-pulse` (scale + opacity cycle, 3s ease-in-out infinite)
- Rain drops: `rain-fall` (translateY with stagger, 1.2s linear infinite)
- Cloud drift: `cloud-float` (subtle translateX, 4s ease-in-out infinite)

All keyframe names are prefixed `weather-` to avoid conflicts with existing globals.

---

## R-008: Accessibility

Per Constitution §Accessibility, the cloud toggle button MUST be keyboard-accessible and have a meaningful `aria-label`. Proposed: `aria-label="Toggle weather widget"`. The widget panel MUST have `role="region"` and `aria-label="Local weather"`. Weather illustrations are decorative and use `aria-hidden="true"`.

---

## R-009: Existing Middleware Coverage

The new `PATCH /api/me/preferences` route falls under the `/api/me` path prefix, which is already gated by `middleware.ts` (lines confirmed in CLAUDE.md route table). No middleware change is required.
