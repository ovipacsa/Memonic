# Data Model: Weather Widget — Feed Right Rail

**Phase**: 1 — Design
**Date**: 2026-05-15

---

## Database Changes

### users table — new column

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weather_widget_visible BOOLEAN NOT NULL DEFAULT FALSE;
```

**Migration strategy**: Additive-only. `DEFAULT FALSE` means no backfill is needed. Wrapped in `try/catch` per project idempotency convention.

---

## TypeScript Types

### Updated `UserRow` (lib/db.ts)

Add one field to the existing `UserRow` type:

```ts
weatherWidgetVisible: boolean;   // maps to weather_widget_visible column
```

### New client-side types (components/feed/WeatherWidget.tsx)

```ts
type ConditionCategory = 'sunny' | 'partly-cloudy' | 'overcast' | 'rainy';

type WeatherState = {
  temperatureC: number;          // degrees Celsius
  rainProbabilityPct: number;    // 0–100
  humidityPct: number;           // 0–100
  condition: ConditionCategory;
  lastFetched: number;           // Date.now() ms timestamp
};

type WeatherWidgetProps = {
  initialVisible: boolean;       // from DB; used for first render
  userId: string;                // to POST preference updates
};
```

### Zod schema — preference update (app/api/me/preferences/route.ts)

```ts
const PreferencesBody = z.object({
  weatherWidgetVisible: z.boolean(),
});
```

---

## WMO Code → ConditionCategory Mapping

Defined as a pure function in `lib/weather.ts`:

```ts
export function wmoToCondition(code: number): ConditionCategory {
  if (code === 0) return 'sunny';
  if (code <= 2)  return 'partly-cloudy';
  if (code === 3) return 'overcast';
  // fog, drizzle, rain, showers, snow (fallback), thunderstorm
  return 'rainy';
}
```

This function is the sole place the mapping lives — tested independently of the component.

---

## State Transitions

```
Widget state machine (client-side):

  HIDDEN (initialVisible=false)
    │  user clicks cloud button
    ▼
  LOADING (fetching geolocation + weather)
    │  success
    ▼
  VISIBLE (WeatherState populated)
    │  user clicks X  OR  user clicks cloud button
    ▼
  HIDDEN (preference saved to DB)

  LOADING
    │  geolocation denied / timeout / API error
    ▼
  ERROR (fallback message shown, widget still dismissible)
    │  user clicks X
    ▼
  HIDDEN
```

---

## Data Flow

```
Feed page (server)
  └─ SELECT weather_widget_visible FROM users
       └─ Pass as initialVisible prop to <WeatherWidget>

WeatherWidget (client component)
  ├─ Cloud button clicked
  │    ├─ navigator.geolocation.getCurrentPosition()
  │    │    └─ fetch Open-Meteo API (client → Open-Meteo CDN)
  │    │         └─ parse response → WeatherState
  │    └─ PATCH /api/me/preferences { weatherWidgetVisible: true }
  │
  └─ X button clicked
       └─ PATCH /api/me/preferences { weatherWidgetVisible: false }

PATCH /api/me/preferences (server route)
  └─ UPDATE users SET weather_widget_visible = $1 WHERE user_id = $2
```
