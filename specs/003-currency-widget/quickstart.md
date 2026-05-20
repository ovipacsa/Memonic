# Quickstart: Currency & Commodities Widget

**Branch**: `003-currency-widget` | **Date**: 2026-05-20

---

## Prerequisites

1. **EIA API key** — register free at https://www.eia.gov/opendata/
2. Add to `.env.local`:
   ```
   EIA_API_KEY=your_key_here
   ```

---

## File Manifest

| File | Action | Purpose |
|---|---|---|
| `lib/currency.ts` | NEW | Country→currency map, zone resolver, exchange rate types |
| `components/feed/CurrencyWidget.tsx` | NEW | Coin toggle button + widget panel (client component) |
| `app/api/commodities/crude-oil/route.ts` | NEW | Server proxy for EIA Brent crude price |
| `app/api/me/preferences/route.ts` | MODIFY | Accept `currencyWidgetVisible` field |
| `app/feed/page.tsx` | MODIFY | SELECT `currency_widget_visible`; pass to `<CurrencyWidget>`; add `leftSlot` to `<Masthead>` |
| `app/globals.css` | MODIFY | Add `@keyframes currency-coin-spin` animation |
| `components/feed/Masthead.tsx` | MODIFY | Add `leftSlot?: React.ReactNode` prop |
| `lib/db.ts` | MODIFY | Add `currency_widget_visible` to `UserRow` type |
| `__tests__/lib/currency.test.ts` | NEW | Unit tests for `resolveCurrencyZone` and rate formatting |
| `__tests__/api/crude-oil.test.ts` | NEW | Integration tests for `GET /api/commodities/crude-oil` |

---

## Database Migration

The migration runs automatically on app start via idempotent bootstrap in `lib/db.ts` (matching the pattern for `weather_widget_visible`):

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS currency_widget_visible BOOLEAN NOT NULL DEFAULT FALSE;
```

No manual migration step needed in development. Run `npm run dev` — the column is created on first boot.

---

## Smoke Test Sequence

1. `npm run dev` — confirm no startup errors
2. Open http://localhost:3000/feed — confirm coin toggle button visible in Masthead left area
3. Click coin toggle — widget panel fades in
4. Confirm two exchange rate rows appear (or "Location unavailable — showing EUR rates" if geo denied)
5. Confirm Brent Crude row appears with a USD/bbl value (or "—" if `EIA_API_KEY` not set)
6. Click X — widget fades out
7. Reload page — widget state matches last toggle (persisted preference)
8. `npm run build` — must pass with no type errors
9. `npm run lint` — must pass

---

## Fallback States Reference

| Condition | Exchange rate rows | Crude oil row |
|---|---|---|
| Normal (local currency) | LOCAL/EUR + LOCAL/USD | USD/bbl value |
| EUR-zone | EUR/USD + EUR/CNY | USD/bbl value |
| Geo denied / unknown country | EUR/USD + EUR/CNY + label "Location unavailable" | USD/bbl value |
| Frankfurter.app down | "—" for each rate | Unaffected |
| EIA API down or key missing | Unaffected | "—" |
| Both APIs down | "—" for all rows | "—" |
