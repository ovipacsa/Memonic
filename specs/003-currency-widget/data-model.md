# Data Model: Currency & Commodities Widget

**Branch**: `003-currency-widget` | **Date**: 2026-05-20

---

## Database Changes

### users table — new column

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS currency_widget_visible BOOLEAN NOT NULL DEFAULT FALSE;
```

Additive, idempotent. Default `FALSE` (hidden) matches the weather widget pattern.

---

## TypeScript Types

### `lib/currency.ts`

```typescript
// ISO 3166-1 alpha-2 → ISO 4217
export type CurrencyCode = string; // e.g. "PLN", "EUR", "GBP"
export type CountryCode  = string; // e.g. "PL", "DE", "GB"

export type CurrencyZone =
  | { type: "local"; currencyCode: CurrencyCode; countryCode: CountryCode }
  | { type: "eur";   countryCode: CountryCode }
  | { type: "unknown" };

export type ExchangeRatePair = {
  base:  CurrencyCode;
  quote: CurrencyCode;
  rate:  number;          // mid-market rate, 4 decimal places
};

export type CommodityPrice = {
  label:     string;      // "Brent Crude"
  valueUsd:  number;      // USD per barrel, 2 decimal places
  unit:      "USD/bbl";
  asOf:      string;      // ISO date string from EIA
};

export type CurrencyWidgetData = {
  zone:       CurrencyZone;
  pairs:      ExchangeRatePair[];  // always 2 pairs
  crude:      CommodityPrice | null;
  lastFetched: number;             // Date.now() ms
};

export type CurrencyWidgetStatus = "idle" | "loading" | "ready" | "error";

export type RowStatus = "loading" | "ok" | "unavailable";
```

### Extended `UserRow` (lib/db.ts)

```typescript
export type UserRow = {
  // ... existing fields ...
  weather_widget_visible:  boolean;
  currency_widget_visible: boolean;   // NEW
};
```

### Extended Preferences Zod Schema (app/api/me/preferences/route.ts)

```typescript
const PreferencesBody = z.object({
  weatherWidgetVisible:  z.boolean().optional(),
  currencyWidgetVisible: z.boolean().optional(),
}).refine(
  (d) => d.weatherWidgetVisible !== undefined || d.currencyWidgetVisible !== undefined,
  { message: "At least one preference field required" }
);
```

---

## Country → Currency Lookup Table

`lib/currency.ts` — static map covering EU member states, EEA, and major non-EU European countries:

```typescript
export const COUNTRY_CURRENCY: Record<CountryCode, CurrencyCode> = {
  // EUR-zone (20 EU members + de-facto)
  DE:"EUR", FR:"EUR", IT:"EUR", ES:"EUR", PT:"EUR",
  NL:"EUR", BE:"EUR", AT:"EUR", FI:"EUR", IE:"EUR",
  GR:"EUR", LU:"EUR", MT:"EUR", CY:"EUR", EE:"EUR",
  LV:"EUR", LT:"EUR", SK:"EUR", SI:"EUR", HR:"EUR",
  ME:"EUR", XK:"EUR",
  // Non-EUR EU members
  PL:"PLN", CZ:"CZK", HU:"HUF", RO:"RON", BG:"BGN",
  SE:"SEK", DK:"DKK",
  // Non-EU European
  GB:"GBP", CH:"CHF", NO:"NOK", IS:"ISK",
  RS:"RSD", AL:"ALL", MK:"MKD", MD:"MDL", UA:"UAH",
};

export function resolveCurrencyZone(countryCode: CountryCode | null): CurrencyZone {
  if (!countryCode) return { type: "unknown" };
  const code = COUNTRY_CURRENCY[countryCode.toUpperCase()];
  if (!code) return { type: "unknown" };
  if (code === "EUR") return { type: "eur", countryCode };
  return { type: "local", currencyCode: code, countryCode };
}
```

---

## API Data Flow

```
Browser (CurrencyWidget.tsx)
  │
  ├─► navigator.geolocation.getCurrentPosition()
  │     └─► reverse-geocode via api.bigdatacloud.net/data/reverse-geocode-client
  │           (free, no key, returns countryCode)
  │
  ├─► resolveCurrencyZone(countryCode) → CurrencyZone
  │
  ├─► [if local currency] GET https://api.frankfurter.app/latest?from={LOCAL}&to=EUR,USD
  │   [if EUR zone]       GET https://api.frankfurter.app/latest?from=EUR&to=USD,CNY
  │         └─► ExchangeRatePair[]
  │
  └─► GET /api/commodities/crude-oil  (Next.js server route)
        └─► EIA API (server-side, key in env)
              └─► CommodityPrice | null

Server (app/api/commodities/crude-oil/route.ts)
  └─► 30-min in-memory cache → EIA v2 endpoint
```

---

## Widget State Machine

```
idle ──[toggle open]──► loading ──[data ok]──► ready
                    │                     │
                    └──[geo denied]──► fallback (ready w/ unknown zone)
                    └──[API error]──►  ready (individual rows show "—")
```

Transitions:
- `idle → loading`: User clicks coin toggle (or `initialVisible=true` on page load)
- `loading → ready`: All fetches resolved (success or graceful failure)
- `ready → idle`: User clicks X close button

---

## Crude Oil Server Route Cache

```typescript
// app/api/commodities/crude-oil/route.ts
let cache: { price: CommodityPrice; expiresAt: number } | null = null;
const CACHE_MS = 30 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.price);
  }
  // fetch from EIA, update cache, return
}
```
