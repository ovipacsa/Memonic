# Research: Currency & Commodities Widget

**Branch**: `003-currency-widget` | **Date**: 2026-05-20

---

## R-001 — Currency Exchange Rate Data Source

### Options Evaluated

| Option | Key Required | CORS | Data Quality | Latency |
|---|---|---|---|---|
| Frankfurter.app (ECB) | No | Open | Official ECB mid-market | ~100–250 ms |
| ExchangeRate-API | Yes (free tier) | Restricted | Good | ~150–300 ms |
| Open Exchange Rates | Yes | Restricted | Good | ~150–300 ms |
| Gemini API | Existing key | N/A | Non-deterministic (LLM) | 1–5 s |

### Decision

**Frankfurter.app** — client-side, no API key, CORS-open, ECB-sourced, updated on European banking days.

- Endpoint (non-EUR currency): `https://api.frankfurter.app/latest?from={LOCAL}&to=EUR,USD`
- Endpoint (EUR-zone): `https://api.frankfurter.app/latest?from=EUR&to=USD,CNY`
- Response time: < 250 ms. Supports all ECB-published currencies (PLN, CZK, HUF, RON, BGN, SEK, DKK, GBP, CHF, NOK, ISK, CNY, USD, and more).
- CNY confirmed in ECB reference rate set.

### Rationale

Same pattern as the weather widget's Open-Meteo choice: free, key-free, CORS-open, purpose-built for the data type. Gemini is explicitly excluded from financial data paths (FR-014).

---

## R-002 — Crude Oil Price Data Source

### Options Evaluated

| Option | Key Required | Data | Notes |
|---|---|---|---|
| EIA API (eia.gov) | Yes (free, no card) | Brent + WTI daily | Authoritative US govt data; key stored server-side |
| Alpha Vantage | Yes (free, 25 req/day) | Monthly only | Too coarse for a live-feel widget |
| Yahoo Finance v7 (unofficial) | No | Daily futures | No terms for programmatic use; brittle |
| commodities-api.com | Yes (free tier: 100/mo) | Brent daily | Too low quota; requires credit card for signup |

### Decision

**EIA API (U.S. Energy Information Administration)** via a **server-side Next.js proxy route** (`GET /api/commodities/crude-oil`).

- Free API key obtainable at https://www.eia.gov/opendata/ (no credit card).
- Stored as `EIA_API_KEY` in `.env.local` — never exposed to the browser.
- Fetches latest Brent crude spot price (USD/barrel): `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key={KEY}&facets[product][]=EPCBRENT&sort[0][column]=period&sort[0][direction]=desc&length=1`
- Server route caches the result in-memory for 30 minutes to avoid quota exhaustion.
- If `EIA_API_KEY` is not set, the crude oil row shows "—" gracefully (same pattern as Gemini key missing in nutrition).

### Rationale

Crude oil price requires a server-side proxy to protect the API key (unlike Frankfurter.app which is key-free). Routing through a Next.js API route also lets us set a tight timeout and return a clean JSON response to the client regardless of EIA API changes.

---

## R-003 — Country → Currency Mapping

### Decision

**Static TypeScript lookup table** in `lib/currency.ts` — ISO 3166-1 alpha-2 country codes → ISO 4217 currency codes.

- ~35 European entries cover all EU members, EEA, and major non-EU European countries.
- Countries using EUR as de facto currency (Montenegro, Kosovo) map to "EUR".
- Countries not in the map return `null` → fallback to EUR/USD + EUR/CNY display.
- No network call, no dependency, no maintenance burden for the current scope.

---

## R-004 — Geolocation Sharing with WeatherWidget

### Decision

**Independent `navigator.geolocation.getCurrentPosition()` calls** in each widget component.

- Browsers do NOT show a second permission prompt if geolocation permission was already granted in the same session. The second call resolves from the browser's cached position immediately.
- If both widgets open simultaneously on first load, the browser queues both calls behind a single permission prompt and resolves both when the user grants/denies.
- This avoids the complexity of a shared React context while meeting FR-015 (no duplicate prompts).
- Verified behaviour: Chromium, Firefox, and Safari all implement this caching pattern.

---

## R-005 — Toggle Button Design

### Decision

**Coin/currency symbol** using a stylised `¤` (generic currency sign) rendered as SVG — same dimensions and placement as the weather widget's cloud toggle button.

- Sits in the Masthead `leftSlot` (300px column, currently an empty `<div />`).
- Masthead receives a new `leftSlot?: React.ReactNode` prop (mirroring existing `rightSlot`).
- Left column uses `justify-end pr-2` alignment (mirror image of right column's `justify-start pl-2`).
- Coin SVG: cyan outline, magenta fill on active state — consistent with Mnemonic palette.

---

## R-006 — Preference Persistence

### Decision

**Extend existing `PATCH /api/me/preferences` route** to accept `currencyWidgetVisible` alongside the existing `weatherWidgetVisible`.

- Zod schema extended: `PreferencesBody = z.object({ weatherWidgetVisible: z.boolean().optional(), currencyWidgetVisible: z.boolean().optional() })`
- DB: new `currency_widget_visible BOOLEAN NOT NULL DEFAULT FALSE` column on `users`.
- Migration: `ALTER TABLE users ADD COLUMN IF NOT EXISTS currency_widget_visible BOOLEAN NOT NULL DEFAULT FALSE` — additive, idempotent.

---

## R-007 — Bundle Impact

No new npm dependencies. `lib/currency.ts` is ~2 KB (country map + helper functions). `CurrencyWidget.tsx` follows the same lazy-loadable pattern as `WeatherWidget.tsx`. Total feed bundle delta: negligible.
