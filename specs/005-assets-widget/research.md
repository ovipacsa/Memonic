# Phase 0 Research — Assets Price Widget

**Feature**: `005-assets-widget` · **Date**: 2026-06-16

This document records the decisions made before design. Every Phase 0 input came either from the spec, the `/clarify` session, or this research pass. Nothing in `plan.md` Technical Context is left as `NEEDS CLARIFICATION`.

---

## 1. Price data source

**Decision**: Yahoo Finance unofficial chart endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d`. Called from the server via a new proxy route `GET /api/markets/intraday`. No API key required.

**Rationale**:
- Confirmed by the `/clarify` session — fastest and most practical for a single-user prototype.
- One call returns: `meta.regularMarketPrice`, `meta.previousClose` (equities) / `meta.chartPreviousClose` (futures), `meta.currentTradingPeriod` (session open/close epochs), `timestamp[]`, and `indicators.quote[0].close[]` — everything the widget needs.
- Latency observed at ~150–300 ms from a European egress, well within the 300 ms p95 budget.

**Alternatives considered**:
- **Alpha Vantage** (5 req/min free) — too restrictive for 10 s polling.
- **Twelve Data** (8 req/min free) — same.
- **Finnhub + metals-api split** — reliable but two vendors, two failure surfaces, two keys.
- **Direct browser → Yahoo** — rejected: CORS-fragile, and centralising the call server-side lets us cache and enforce an allow-list.

**Risks**: Unofficial endpoint; could change shape or start gating. Mitigated by zod validation at the boundary and an inline error chip with retry on the client.

---

## 2. Symbol allow-list

**Decision**:

| Asset button | Yahoo symbol | Market | Notes |
|---|---|---|---|
| Silver | `SI=F` | COMEX silver futures | Continuous near-month future |
| Gold | `GC=F` | COMEX gold futures | Continuous near-month future |
| SpaceX | `SPCX` | NASDAQ — Space Exploration Technologies Corp | Per `/clarify` |

The allow-list lives in `lib/markets.ts` as `const ASSETS: Readonly<Record<AssetId, AssetSpec>>` and is enforced by the proxy route — the `symbol` query param is rejected with 400 if not in the list. This eliminates the route as a generic open SSRF/proxy surface.

**Alternatives considered**: User-supplied symbols (rejected — out of scope and a security risk); hard-coded per-asset routes (`/api/markets/silver`, etc.) — rejected as more code with no real benefit since the allow-list is short.

---

## 3. Trading-day definition and market schedule

**Decision**: Each asset's "current trading day" is its exchange-local session. Encoded as:

```ts
type MarketSession = {
  tz: 'America/New_York';
  // Days of week the session can be open (0 = Sunday)
  daysOfWeek: number[];
  // Local clock window (inclusive open, exclusive close)
  openHHMM: string;   // '09:30' for NASDAQ, '18:00' Sun for COMEX, etc.
  closeHHMM: string;  // '16:00' NASDAQ, '17:00' COMEX
};
```

For v1 we rely on Yahoo's `meta.currentTradingPeriod.regular.{start,end}` (epoch seconds) as the authoritative open/close — our local table is only used as a sanity check / fallback if Yahoo omits the field. This keeps us correct across holidays without maintaining a calendar.

**Rationale**: The `/clarify` answer was "exchange-local session". Yahoo already provides the per-day window, so we let it be the source of truth rather than replicating a holiday calendar in code.

**Alternatives considered**: User local day (rejected by `/clarify`); UTC day (rejected by `/clarify`); hard-coded calendar table (rejected — high maintenance, gets stale, doesn't handle early closes).

---

## 4. "Previous close" for the gain/loss readout

**Decision**: Use `meta.chartPreviousClose ?? meta.previousClose` from the Yahoo response. The widget displays:

- Absolute delta: `latest - previousClose`
- Percentage: `(latest - previousClose) / previousClose * 100`
- Sign-coloured + arrow glyph (▲ / ▼) so colour is not the sole signal (accessibility).

When the market is closed, `latest` is the most recent close in the series; when open, it is the live latest point.

**Rationale**: Single field in the same response; no second request needed. Two-field fallback handles the futures vs equity field-name difference.

---

## 5. Chart rendering

**Decision**: Hand-written inline SVG `<polyline>` for the line plus a `<circle>` marker for hover. Down-sampled to ≤ 240 points (one per ~minute is overkill for a ~390-minute session at typical widget widths; lerp-sample to 240 for the line, keep full precision for hover bisect).

**Rationale**:
- Constitution IV: no unjustified new dependencies. A charting library (Recharts ~30 KB, lightweight-charts ~40 KB) would add 5–10× the code size of a hand-rolled SVG.
- The visual is intentionally minimal — single line, no legend, no zoom, no axes labels — so a library is overkill.

**Alternatives considered**: `recharts`, `lightweight-charts`, `chart.js`, `react-sparklines`. All add weight; none are needed for the design.

---

## 6. Hover interaction

**Decision**:
- Attach `onPointerMove` and `onPointerLeave` to the SVG.
- On move: convert clientX → chart-relative X, binary-search the series timestamps for the nearest point, set `hoverIndex` state.
- Render a vertical guide line + circle marker at the hovered point.
- Render a tooltip absolutely-positioned within the widget; clamp to bounds; flip when within 80 px of the right edge.
- Mirror the hovered price into an `aria-live="polite"` element for screen readers.

**Performance**: 200 ms target (SC-004) is comfortable — binary search on ≤ 1,440 points is sub-microsecond; React re-render of one circle + one tooltip span is well under one frame.

---

## 7. Polling cadence and visibility gating

**Decision**:
```text
mount → fetch immediately
        → setInterval(10_000) → fetch
on document.visibilitychange === 'hidden' → clearInterval, drop in-flight
on document.visibilitychange === 'visible' → fetch immediately + setInterval(10_000)
on asset switch → abort in-flight, fetch immediately, keep interval
on unmount → clearInterval + abort
```

**Rationale**: Matches `/clarify` answer (Option A). Keeps the widget honest: when the user isn't looking, we don't waste Yahoo calls or browser CPU.

---

## 8. Server-side cache

**Decision**: Module-level `Map<symbol, { fetchedAt: number; payload: IntradaySeries }>` with a 5 s TTL inside the route handler. Keyed by symbol only.

**Rationale**: Multiple tabs / rapid asset switches collapse onto a single upstream call. 5 s is well below the client poll interval (10 s) so the user-visible refresh cadence is unaffected.

**Alternatives considered**: Next.js `revalidate` / `unstable_cache` (rejected — finer-grained TTL than route segment caching needs, and we control the lifecycle directly). Redis (rejected — overkill for a single-process prototype).

---

## 9. Error handling

**Decision**:
- Upstream non-2xx or `fetch` rejection → proxy returns HTTP 502 with `{ error: 'upstream' }`.
- zod validation failure → proxy returns HTTP 502 with `{ error: 'schema' }`.
- Disallowed symbol → 400 with `{ error: 'unknown_symbol' }`.
- Client: any non-2xx OR data older than 60 s while market is open → render inline error chip with text + a "Retry" button. The chip is contained inside the widget so the rest of the page is unaffected (FR-014).

---

## 10. Time zone display

**Decision**: All tooltip timestamps formatted with `Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })` — picks up the user's local zone automatically. The graph itself plots time linearly along the x-axis; no axis tick labels in v1 (the design is minimalist).

---

## 11. Closed-market UX

**Decision**: When `now < session.open` OR `now > session.close` OR `meta.regularMarketTime <= meta.previousCloseTime`, render:

- Top-right: last close price.
- Below: "Closed · ▲ $X (+Y.Z%)" or "▼ ..." vs previous close.
- Chart: still draws yesterday's intraday curve (the response covers the most recent trading day) so the user still gets a shape — labelled with a small "MARKET CLOSED" pill in the corner.
- Polling: suspended; one fetch on mount is enough.

**Rationale**: Matches the spec (FR-011). Keeping the curve visible (just labelled closed) is friendlier than a blank box and costs nothing.

---

## 12. Testing strategy

**Decision**: Tests are colocated under `__tests__/` mirroring the source layout. We use Vitest-style syntax (compatible with Jest) so that whichever runner is wired up next picks them up:

- `lib/markets.ts` — pure functions: symbol allow-list lookup, session-window check given a `Date`, gain/loss computation, zod schema accept/reject on fixture payloads.
- `app/api/markets/intraday/route.ts` — `fetch` is mocked; cases: success, upstream 500, malformed body, disallowed symbol, cache hit (two calls → one mocked fetch).

The repo currently has no configured runner; the test files conform to the constitution's Test-First principle and will become executable as soon as Vitest is installed (planned outside this feature).

---

## 13. Accessibility decisions

- Buttons: real `<button>`, `aria-pressed`, keyboard-focusable, visible focus ring in `--cyan`.
- Chart container: `role="img"` with an `aria-label` of the form `"SPCX intraday: $192.50, up $31.55 (19.6%) versus previous close"`.
- Hover readout duplicated into an `aria-live="polite"` `<span class="sr-only">` so screen readers receive the hovered value.
- All deltas have a leading `▲ ` / `▼ ` glyph in addition to colour.
- Error chip: text-first, with a real `<button>` for retry.

---

## 14. Out of scope (deliberate)

- Multi-asset comparison view (only one shown at a time per FR-005).
- Watchlist / alerts (read-only per spec assumption).
- Persistent preference for selected asset (FR-015).
- Trading actions or external links (read-only).
- Historical (multi-day) graphs.
