# API Contracts: Currency & Commodities Widget

**Branch**: `003-currency-widget` | **Date**: 2026-05-20

---

## Internal API — New Route

### `GET /api/commodities/crude-oil`

**Auth**: Required (existing session middleware)
**Purpose**: Server-side proxy for Brent crude price from EIA; protects API key

**Response (200 OK)**:
```json
{
  "label": "Brent Crude",
  "valueUsd": 82.34,
  "unit": "USD/bbl",
  "asOf": "2026-05-19"
}
```

**Response (503 — EIA unavailable or key missing)**:
```json
{ "error": "Commodity data unavailable" }
```

**Caching**: 30-minute in-memory server cache. Shared across all requests within the cache window.

**Environment**: Requires `EIA_API_KEY` in `.env.local`. If absent, returns 503 immediately (same pattern as `GEMINI_API_KEY`).

---

## Internal API — Modified Route

### `PATCH /api/me/preferences`

Extended to accept `currencyWidgetVisible` alongside the existing `weatherWidgetVisible`.

**Request body (either or both fields required)**:
```json
{ "currencyWidgetVisible": true }
{ "weatherWidgetVisible": false }
{ "weatherWidgetVisible": true, "currencyWidgetVisible": false }
```

**Response (200)**:
```json
{ "ok": true }
```

**Validation**: At least one field must be present; each field, if present, must be boolean.

---

## External APIs (client-side)

### Frankfurter.app — Exchange Rates

**Base URL**: `https://api.frankfurter.app`
**Key**: None required
**CORS**: Open

**Non-EUR local currency**:
```
GET /latest?from=PLN&to=EUR,USD
→ { "amount": 1, "base": "PLN", "date": "2026-05-19",
    "rates": { "EUR": 0.2341, "USD": 0.2531 } }
```

**EUR-zone user**:
```
GET /latest?from=EUR&to=USD,CNY
→ { "amount": 1, "base": "EUR", "date": "2026-05-19",
    "rates": { "USD": 1.0823, "CNY": 7.8112 } }
```

**Timeout**: 6 seconds. On timeout or non-200: show "—" for affected pairs.
**Update cadence**: ECB business days only. Weekend/holiday: returns last available rate with date field.

---

## External APIs (server-side)

### EIA (U.S. Energy Information Administration)

**Base URL**: `https://api.eia.gov/v2`
**Key**: Free — register at https://www.eia.gov/opendata/ (stored as `EIA_API_KEY`)

**Brent crude spot price**:
```
GET /petroleum/pri/spt/data/
  ?api_key={EIA_API_KEY}
  &facets[product][]=EPCBRENT
  &sort[0][column]=period
  &sort[0][direction]=desc
  &length=1
→ {
    "response": {
      "data": [{
        "period": "2026-05-19",
        "product": "EPCBRENT",
        "value": "82.34",
        "unit": "$/bbl"
      }]
    }
  }
```

**Server timeout**: 8 seconds. On failure: route returns 503; client shows "—" in crude oil row.

---

## Reverse Geocoding (client-side)

### BigDataCloud Reverse Geocode

**URL**: `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude={lat}&longitude={lon}&localityLanguage=en`
**Key**: None required
**CORS**: Open
**Returns**: `{ "countryCode": "PL", "city": "Warsaw", ... }`
**Fallback**: If this call fails, `countryCode` is null → widget shows EUR/USD + EUR/CNY with "Location unavailable" label.
