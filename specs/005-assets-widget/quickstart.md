# Quickstart — Assets Price Widget

**Feature**: `005-assets-widget` · **Date**: 2026-06-16

A working notebook for someone (you, future me, a reviewer) picking up the feature. Lists every file that changes, the order to land them, and the manual QA pass.

---

## 1. File manifest

| Action | Path |
|---|---|
| NEW | `lib/markets.ts` |
| NEW | `app/api/markets/intraday/route.ts` |
| NEW | `components/nutrition/AssetsWidget.tsx` |
| MODIFY | `app/nutrition/page.tsx` (mount widget below `<NutritionTracker />`) |
| MODIFY | `middleware.ts` (add `/api/markets/*` to the auth matcher) |
| NEW | `__tests__/lib/markets.test.ts` |
| NEW | `__tests__/api/markets-intraday.test.ts` |

No DB migration. No new env vars. No new npm dependencies.

---

## 2. Suggested implementation order

1. **`lib/markets.ts`** — types, `ASSETS` table, `computeDelta`, `bisectNearest`, `formatPrice`, `formatLocalTime`, and the zod schemas for the Yahoo response + the `IntradaySeries` output.
2. **`__tests__/lib/markets.test.ts`** — unit tests for every pure function.
3. **`app/api/markets/intraday/route.ts`** — symbol allow-list, 6 s timeout, normalisation, 5 s cache, error mapping.
4. **`__tests__/api/markets-intraday.test.ts`** — integration tests with mocked `fetch`.
5. **`middleware.ts`** — include `/api/markets/:path*` in the matcher list (so the route is auth-gated like the others).
6. **`components/nutrition/AssetsWidget.tsx`** — three buttons, SVG chart, current price (top-right), gain/loss readout, hover tooltip, error chip, skeleton.
7. **Polling + visibility wiring** in the widget — `useEffect` for mount/interval, `document.visibilitychange` listener.
8. **Closed-market render mode** — branch in the same component.
9. **`app/nutrition/page.tsx`** — render `<AssetsWidget />` directly under `<NutritionTracker displayName=... />` in the `max-w-[860px]` column so it matches the calorie box width.
10. **`npm run lint && npm run build`** — must pass.

---

## 3. Local smoke test

1. `npm run dev`.
2. Open `/nutrition` (you must be signed in — see `TestUsers.txt`).
3. Verify the widget appears directly beneath the calorie tracker box, at the same width.
4. **Default state**: Silver button is highlighted (active), price + chart visible.
5. **Switch**: click Gold → chart, price, delta update; Gold becomes active. Repeat for SpaceX.
6. **Hover**: drag the cursor across the chart — the tooltip follows and shows the price + a local-time stamp. Move off → tooltip disappears.
7. **Refresh cadence**: leave the tab open for 30 s on an open-market asset — the timestamp of the latest point advances. Use DevTools Network tab to confirm one request every ~10 s.
8. **Visibility pause**: switch to another tab for ≥ 20 s → no network requests during that time. Switch back → one immediate request, then resume the cadence.
9. **Closed-market**: pick an asset whose market is closed at your test time (e.g., SpaceX on a weekend) → "MARKET CLOSED" pill is shown, gain/loss is day-over-day, no periodic requests.
10. **Error path**: in DevTools, throttle to "Offline" for ≥ 6 s during a refresh → inline error chip with "Retry" appears; clicking Retry reissues the fetch.

---

## 4. Manual QA checklist

- [ ] Widget renders directly below the calorie tracker on `/nutrition`.
- [ ] Silver is the default selection on first mount and on page reload.
- [ ] Three buttons labelled Silver / Gold / SpaceX; the active one is visually distinct and `aria-pressed="true"`.
- [ ] Buttons are reachable via Tab and operable with Enter / Space.
- [ ] Current price shown in the top-right corner with the correct decimal count (Silver: 3, Gold: 2, SPCX: 2).
- [ ] Gain/loss carries both an arrow glyph (▲/▼/◆) and a colour.
- [ ] Hover tooltip never clips outside the widget; flips on the right edge.
- [ ] Refresh cadence is ~10 s while market open and tab visible.
- [ ] No requests fire while the tab is hidden.
- [ ] Closed-market mode shows last close and day-over-day delta.
- [ ] Error chip surfaces network and schema failures; retry recovers.
- [ ] `npm run build` and `npm run lint` are clean.
- [ ] Lighthouse / DevTools: no console errors, no React key warnings, no layout shift on first paint (skeleton has the final dimensions).

---

## 5. Agent context update

Update the Speckit reference in `.github/copilot-instructions.md`:

```text
<!-- SPECKIT START -->
Active feature plan: specs/005-assets-widget/plan.md
<!-- SPECKIT END -->
```

(If your block already exists with a previous plan path, just replace the line between the markers.)

---

## 6. Out of scope reminders

- No persistence of the selected asset between sessions.
- No watchlist, alerts, or comparison view.
- No historical (> 1 day) charts.
- No trading actions or external links.
- Read-only widget.

If any of these come up later, file a new spec — don't tack them onto this PR.
