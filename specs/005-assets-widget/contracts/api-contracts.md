# Phase 1 Contracts — Assets Price Widget

**Feature**: `005-assets-widget` · **Date**: 2026-06-16

Three contracts:
1. The **new internal HTTP route** the widget calls.
2. The **upstream Yahoo Finance contract** the route depends on (documented to make schema validation explicit).
3. The **client ↔ widget interaction contract** (button semantics, accessibility, error UI).

---

## 1. Internal route: `GET /api/markets/intraday`

**Purpose**: Server-side proxy that fetches a single asset's intraday series from Yahoo Finance, validates and normalises the response, and serves a stable shape to the widget.

**Auth**: Required. Covered by `middleware.ts` once `/api/markets/*` is added to the matcher.

### Request

```
GET /api/markets/intraday?symbol={SI=F|GC=F|SPCX}
```

| Param | Required | Notes |
|---|---|---|
| `symbol` | yes | Must be one of `SI=F`, `GC=F`, `SPCX`. Anything else → 400. |

No request body.

### Response — 200 OK

```jsonc
{
  "asset": "silver",
  "symbol": "SI=F",
  "latest": 30.524,
  "previousClose": 30.110,
  "status": "open",
  "session": {
    "tz": "America/New_York",
    "openEpoch": 1718616600,
    "closeEpoch": 1718658000
  },
  "points": [
    { "t": 1718616660, "price": 30.112 },
    { "t": 1718616720, "price": 30.118 }
    // ... ≤ 240 entries, ascending in t
  ],
  "fetchedAt": 1718640012
}
```

Shape matches `IntradaySeries` from [data-model.md](../data-model.md). zod-validated before responding (defensive — even our own serializer is checked).

### Response — error

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "error": "unknown_symbol" }` | `symbol` not in allow-list |
| 401 | (middleware default) | No session cookie |
| 502 | `{ "error": "upstream" }` | Yahoo returned non-2xx or fetch threw |
| 502 | `{ "error": "schema" }` | Yahoo body failed zod validation |
| 504 | `{ "error": "timeout" }` | Upstream fetch exceeded 6 s |

### Caching

- **Server**: module-level `Map<symbol, { fetchedAt, payload }>` with 5 s TTL. Multiple requests for the same symbol within 5 s return the cached payload (and do not refresh `fetchedAt` for the client).
- **HTTP**: `Cache-Control: private, max-age=5` to discourage intermediary caches.

### Timeouts and limits

- Upstream fetch timeout: 6 s (`AbortSignal.timeout(6000)`).
- Maximum points returned: 240 (server downsamples).

---

## 2. Upstream: Yahoo Finance chart endpoint (external, unofficial)

**URL template**:
```
https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d
```

**Method**: `GET`. No auth. The route sets a sensible `User-Agent` header to reduce risk of generic-bot rejection.

**Subset of the response we depend on** (validated with zod):

```ts
{
  chart: {
    result: [
      {
        meta: {
          // Equities
          previousClose?: number;
          // Futures
          chartPreviousClose?: number;
          regularMarketPrice: number;
          regularMarketTime?: number;        // epoch sec
          currentTradingPeriod?: {
            regular: { start: number; end: number; };
          };
        };
        timestamp: number[];
        indicators: {
          quote: [
            { close: (number | null)[]; }
          ];
        };
      }
    ];
    error: null | { code: string; description: string; };
  };
}
```

**Normalisation rules**:
- `previousClose := meta.chartPreviousClose ?? meta.previousClose` (futures vs equity).
- `latest := meta.regularMarketPrice`.
- `points` = pairs of `(timestamp[i], close[i])` where `close[i]` is non-null; downsampled to ≤ 240 via even-step decimation.
- `session.openEpoch / closeEpoch` = `meta.currentTradingPeriod.regular.start / end`; if absent, falls back to the first / last entry in `timestamp[]`.
- `status` = `open` if `now ∈ [openEpoch, closeEpoch]` AND `regularMarketTime ≥ openEpoch`; else `closed`.

If `chart.error !== null` or `chart.result.length === 0`, the route responds 502 `{ "error": "upstream" }`.

**Failure modes accepted as v1 risk**: Yahoo may change field names, gate by region, or return rate-limit pages. All produce the same observable: 502 + retry chip in the widget. Documented in plan `Risk Register`.

---

## 3. Client ↔ widget interaction contract

### Mount

- Widget renders below the calorie tracker on `/nutrition`.
- Initial state: `loading('silver')`.
- Issues one `GET /api/markets/intraday?symbol=SI=F`.

### Polling

- On successful first fetch, starts a 10 s `setInterval`.
- On `document.visibilitychange === 'hidden'`: `clearInterval`, abort in-flight fetch. State preserved (no flicker on return).
- On `document.visibilitychange === 'visible'`: immediate fetch + restart interval.

### Asset switch

- Clicking a button:
  - If the clicked button is already active: no-op (FR-012 acceptance #2).
  - Otherwise: abort in-flight, set state `loading(newAsset)`, immediate fetch with the new symbol. Interval continues.

### Hover

- `onPointerMove` on the chart SVG:
  - Convert `event.clientX` → series index via `bisectNearest`.
  - Set `hoverIndex`. Render guide line, marker, tooltip with `formatPrice` + `formatLocalTime`.
- `onPointerLeave`: clear `hoverIndex`. Top-right reverts to `latest`.
- `aria-live="polite"` span mirrors the hovered (or latest) value for screen readers.

### Closed-market mode

- If response `status === 'closed'`:
  - No polling started (or stopped if it was open and crossed close).
  - Render: top-right = last close; below = day-over-day delta; corner pill = "MARKET CLOSED".
  - Chart still drawn from the response's `points` (most recent session).

### Error

- Non-2xx OR data older than 60 s OR fetch rejection:
  - State → `error(asset, reason)`.
  - Render inline chip: text describing condition, `aria-live="polite"`, a "Retry" `<button>`.
  - Retry: clear error, fetch again immediately.
- Other two assets remain functional (state per-asset isn't shared; only the active one renders).

### Accessibility contract

- Each button: `<button type="button" aria-pressed={isActive}>{label}</button>`; keyboard-focusable; visible focus ring.
- Chart `role="img"` + `aria-label` summary: e.g. `"SpaceX intraday: $192.50, up $31.55 (19.6%) versus previous close."`.
- All deltas have a leading `▲`/`▼`/`◆` glyph — colour is not the sole signal.
- The "MARKET CLOSED" indicator is text, not colour-only.
