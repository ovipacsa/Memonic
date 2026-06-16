# Phase 1 Data Model — Assets Price Widget

**Feature**: `005-assets-widget` · **Date**: 2026-06-16

No persistent storage is introduced. All shapes below are TypeScript types in `lib/markets.ts` and the in-flight payload of the proxy route. They are the contract between server and client.

---

## Asset identity

```ts
// lib/markets.ts
export type AssetId = 'silver' | 'gold' | 'spacex';

export type AssetSpec = {
  id: AssetId;
  label: 'Silver' | 'Gold' | 'SpaceX';
  symbol: 'SI=F' | 'GC=F' | 'SPCX';
  market: 'COMEX' | 'NASDAQ';
  // Display currency for the price + delta
  currency: 'USD';
  // Decimals to render in the price readout
  priceDecimals: 2 | 3;
};

export const ASSETS: Readonly<Record<AssetId, AssetSpec>> = {
  silver: { id: 'silver', label: 'Silver', symbol: 'SI=F', market: 'COMEX',  currency: 'USD', priceDecimals: 3 },
  gold:   { id: 'gold',   label: 'Gold',   symbol: 'GC=F', market: 'COMEX',  currency: 'USD', priceDecimals: 2 },
  spacex: { id: 'spacex', label: 'SpaceX', symbol: 'SPCX', market: 'NASDAQ', currency: 'USD', priceDecimals: 2 },
};

export const DEFAULT_ASSET: AssetId = 'silver';
```

**Validation rules**
- Only the three IDs in `ASSETS` are accepted anywhere (proxy `symbol` query, widget state).
- `priceDecimals` is used by the formatter so silver shows 3 decimals (typical for spot/futures) and gold/SPCX show 2.

---

## Market session

```ts
export type MarketSession = {
  tz: 'America/New_York';
  // Inclusive epoch (seconds) for the current regular session, sourced from Yahoo
  // meta.currentTradingPeriod.regular.{start,end} when available.
  openEpoch: number;
  closeEpoch: number;
};

export type MarketStatus = 'open' | 'closed' | 'unknown';
```

`MarketStatus` is derived (not stored). State transitions:

```text
unknown → open    : now ∈ [openEpoch, closeEpoch] and series has points after openEpoch
unknown → closed  : now ∉ session window OR series last point ≤ previousCloseTime
open    → closed  : crossing closeEpoch (next poll observes the transition)
closed  → open    : visibility-resume fetch lands inside a fresh session window
```

The widget reacts to transitions by starting/stopping the poll loop and swapping the render mode.

---

## Price point and intraday series

```ts
export type PricePoint = {
  // Unix epoch seconds
  t: number;
  // Closing price for the 1-minute candle at time t
  price: number;
};

export type IntradaySeries = {
  asset: AssetId;
  symbol: AssetSpec['symbol'];
  // Latest known price; for closed markets, this is the last close
  latest: number;
  // Previous trading day's close, source of the gain/loss baseline
  previousClose: number;
  // Server-resolved status at the moment of fetch
  status: MarketStatus;
  // The regular session window for the trading day represented by `points`
  session: MarketSession;
  // Ordered ascending by t; downsampled by the server to ≤ 240 entries
  points: PricePoint[];
  // Server epoch seconds when this payload was produced (for staleness checks)
  fetchedAt: number;
};
```

**Validation rules** (enforced by zod in `lib/markets.ts`):
- `points.length ≥ 1`.
- `points` strictly increasing in `t`.
- `latest`, `previousClose`, `points[i].price` all finite, positive numbers.
- `openEpoch < closeEpoch`.
- `points[0].t ≥ openEpoch - 60` and `points.at(-1).t ≤ closeEpoch + 60` (one-minute slack).

If any rule fails, the proxy returns 502 `{ error: 'schema' }` and the client renders the error chip.

---

## Computed values (pure, in `lib/markets.ts`)

```ts
// Absolute and percent change vs previousClose
export function computeDelta(series: IntradaySeries): {
  abs: number;
  pct: number;
  direction: 'up' | 'down' | 'flat';
};
```

| Input | Output |
|---|---|
| `latest = 192.50`, `previousClose = 160.95` | `{ abs: 31.55, pct: 19.60, direction: 'up' }` |
| `latest = previousClose` | `{ abs: 0, pct: 0, direction: 'flat' }` |
| `latest < previousClose` | `direction: 'down'` |

```ts
// Returns the index of the series point nearest to a given t
export function bisectNearest(points: PricePoint[], t: number): number;
```

```ts
// Format helpers
export function formatPrice(p: number, decimals: number): string;        // "192.50"
export function formatLocalTime(epochSec: number): string;               // "20:00"
```

---

## Client widget state (component-local)

```ts
type WidgetState =
  | { kind: 'loading'; asset: AssetId }
  | { kind: 'ready'; asset: AssetId; series: IntradaySeries; hoverIndex: number | null }
  | { kind: 'error'; asset: AssetId; reason: 'network' | 'schema' | 'stale' };
```

Transitions:

- `mount` → `loading(silver)`
- fetch success → `ready(asset, series, null)`
- fetch failure → `error(asset, 'network' | 'schema')`
- 60 s since last successful fetch while market open → `error(asset, 'stale')`
- user clicks asset button → abort, reset to `loading(newAsset)`
- visibility hidden → poll paused (state unchanged)
- visibility visible → immediate fetch (state may transition)

No state survives navigation away from `/nutrition` — per FR-015.

---

## Entity summary

| Entity | Lives in | Lifetime | Persisted? |
|---|---|---|---|
| `AssetSpec` | `lib/markets.ts` (const) | Process lifetime | No (code) |
| `MarketSession` | Yahoo response → proxy payload | Per fetch | No |
| `IntradaySeries` | Proxy payload + widget state | Per fetch / until next poll | Server cache only (5 s TTL) |
| `WidgetState` | React state in `AssetsWidget.tsx` | Component lifetime | No |
