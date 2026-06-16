---

description: "Task list for the Assets Price Widget feature (005-assets-widget)"
---

# Tasks: Assets Price Widget (Silver / Gold / SpaceX)

**Input**: Design documents from `/specs/005-assets-widget/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contracts.md, quickstart.md

**Tests**: Tests ARE included — Constitution II (Test-First Discipline) is non-negotiable for new public API routes and business-rule branches.

**Organization**: Tasks are grouped by user story so each can be implemented, tested, and demoed independently. The four user stories from the spec map as follows:

| US | Title | Priority |
|---|---|---|
| US1 | Track silver intraday price at a glance | P1 (MVP) |
| US2 | Switch between Silver, Gold, and SpaceX | P2 |
| US3 | Inspect historical points on the intraday graph (hover) | P3 |
| US4 | Closed-market fallback | P2 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in each task

## Path Conventions

- Web application — Next.js App Router (TypeScript).
- New library: `lib/markets.ts`.
- New route: `app/api/markets/intraday/route.ts`.
- New component: `components/nutrition/AssetsWidget.tsx`.
- Tests: `__tests__/lib/*.test.ts`, `__tests__/api/*.test.ts`. (Repo has no runner wired up yet; tests conform to Vitest/Jest syntax — see plan.md §Testing.)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the workspace is ready. No new dependencies, no new env vars, no DB migration for this feature.

- [X] T001 Confirm `npm install` passes on a clean checkout of branch `005-assets-widget` and `npm run dev` boots `/nutrition` without errors
- [ ] T002 [P] Create the `__tests__/lib/` and `__tests__/api/` directories if they do not exist (placeholder `.gitkeep` is fine)
- [X] T003 [P] Verify the SPECKIT block in `.github/copilot-instructions.md` points to `specs/005-assets-widget/plan.md` (set during `/plan`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the shared library, server route, and auth gating that every user story depends on. Until this phase is green, no widget UI can render.

**⚠️ CRITICAL**: No user story work begins until Phase 2 completes.

- [ ] T004 Write failing unit tests for `lib/markets.ts` in `__tests__/lib/markets.test.ts` — cover: symbol allow-list lookup, `computeDelta` (up/down/flat), `bisectNearest`, `formatPrice` (Silver: 3 decimals; Gold/SPCX: 2), `formatLocalTime`, zod schema accept/reject on fixture payloads (futures vs equity, malformed)
- [X] T005 Implement `lib/markets.ts` — `AssetId`, `AssetSpec`, `ASSETS` table, `DEFAULT_ASSET`, `MarketSession`, `MarketStatus`, `PricePoint`, `IntradaySeries`, zod schemas for the Yahoo response and the normalised output, `normalizeYahooResponse`, `downsampleTo(240)`, `computeDelta`, `bisectNearest`, `formatPrice`, `formatLocalTime` — until T004 passes
- [ ] T006 Write failing integration tests for the proxy route in `__tests__/api/markets-intraday.test.ts` (mocked `fetch`) — cases: success → normalised `IntradaySeries`, upstream 5xx → 502 `{ error: 'upstream' }`, malformed payload → 502 `{ error: 'schema' }`, disallowed symbol → 400 `{ error: 'unknown_symbol' }`, second call within 5 s → cache hit (no second `fetch`), upstream timeout → 504 `{ error: 'timeout' }`
- [X] T007 Implement `app/api/markets/intraday/route.ts` — `GET` handler with: symbol allow-list (`SI=F`, `GC=F`, `SPCX`), 6 s `AbortSignal.timeout`, Yahoo `User-Agent` header, zod-validated upstream response, normalisation via `lib/markets.ts`, 5 s module-level `Map` cache keyed by symbol, `Cache-Control: private, max-age=5`, error mapping per [contracts/api-contracts.md](contracts/api-contracts.md) — until T006 passes
- [X] T008 Update `middleware.ts` matcher to include `/api/markets/:path*` so the new route is auth-gated identically to the other `/api/*` routes

**Checkpoint**: `lib/markets.ts` and `GET /api/markets/intraday` work end-to-end. Hitting `/api/markets/intraday?symbol=SI=F` while signed in returns a valid `IntradaySeries`. User story implementation can now begin.

---

## Phase 3: User Story 1 — Silver intraday at a glance (Priority: P1) 🎯 MVP

**Goal**: A signed-in user opens `/nutrition` and sees the Assets widget directly below the calorie tracker, defaulted to Silver, showing today's intraday line chart, the latest price in the top-right, and the gain/loss vs the previous close. Refreshes every 10 s while the tab is visible; pauses when hidden.

**Independent Test**: Load `/nutrition`. Widget appears below the calorie box. Silver button is active. Chart, top-right price, and gain/loss render within 3 s. Polling fires every ~10 s while the tab is focused and stops when the tab is hidden.

### Tests for User Story 1 ⚠️

> Write before implementation; ensure they fail first.

- [ ] T009 [P] [US1] Component test — initial mount renders skeleton, then a chart + price + delta after one mocked `GET /api/markets/intraday?symbol=SI=F` (`__tests__/components/AssetsWidget.mount.test.tsx`)
- [ ] T010 [P] [US1] Component test — visibility gating: hidden → polling cleared; visible → immediate fetch + interval restart (`__tests__/components/AssetsWidget.polling.test.tsx`)

### Implementation for User Story 1

- [X] T011 [US1] Scaffold `components/nutrition/AssetsWidget.tsx` as a `"use client"` component: state machine per `data-model.md` (`loading | ready | error`), default asset = `silver`, `useEffect` mount fetch via `/api/markets/intraday?symbol=SI=F`, abort on unmount
- [X] T012 [US1] Add the polling loop in `components/nutrition/AssetsWidget.tsx`: `setInterval(10_000)` only while market `open` AND `document.visibilityState === 'visible'`; `visibilitychange` listener pauses/resumes; immediate fetch on resume
- [X] T013 [US1] Render the SVG intraday line chart in `components/nutrition/AssetsWidget.tsx` using `<polyline>` against the normalised `points`; size via container width; downsampled to ≤ 240 points server-side, plot all returned points
- [X] T014 [US1] Render the top-right current price and the gain/loss readout in `components/nutrition/AssetsWidget.tsx` using `computeDelta` from `lib/markets.ts`; format with `formatPrice(series.latest, asset.priceDecimals)`; include `▲ / ▼ / ◆` glyph so colour is not the sole signal
- [X] T015 [US1] Add skeleton placeholder + inline error chip + Retry button in `components/nutrition/AssetsWidget.tsx` per FR-014, FR-016, FR-017; staleness watchdog flips to `error('stale')` after 60 s without success
- [X] T016 [US1] Apply Mnemonic palette in `components/nutrition/AssetsWidget.tsx`: `--midnight` background, `--cyan` axes/labels, `--magenta` chart line, `--yellow` for gain glyphs, `--purple` for loss glyphs; fonts: VT323 for price values, Space Mono for labels, Audiowide for the small "Assets" header
- [X] T017 [US1] Mount `<AssetsWidget />` directly beneath `<NutritionTracker />` in `app/nutrition/page.tsx`, keeping the same `max-w-[860px]` column width as the calorie box

**Checkpoint**: Reload `/nutrition` while signed in — widget renders below the calorie box, defaults to Silver, refreshes every 10 s, pauses when the tab is hidden. MVP delivered.

---

## Phase 4: User Story 2 — Switch between Silver, Gold, SpaceX (Priority: P2)

**Goal**: Three buttons below the chart switch the active asset. Clicking a non-active button aborts any in-flight fetch and re-fetches for the new symbol; clicking the active one is a no-op.

**Independent Test**: Click Gold → chart, top-right price, and gain/loss switch to gold; Gold button shows `aria-pressed="true"`. Repeat for SpaceX. Clicking the already-active button does not trigger a fetch (verify in DevTools Network).

### Tests for User Story 2 ⚠️

- [ ] T018 [P] [US2] Component test — clicking Gold triggers a fetch for `?symbol=GC=F` and switches the rendered series; clicking the active button is a no-op (`__tests__/components/AssetsWidget.switch.test.tsx`)
- [ ] T019 [P] [US2] Component test — switching mid-flight aborts the previous fetch (assert the `AbortController.signal.aborted === true`) (`__tests__/components/AssetsWidget.abort.test.tsx`)

### Implementation for User Story 2

- [X] T020 [US2] Add the three-button row at the bottom of `components/nutrition/AssetsWidget.tsx` — `<button type="button" aria-pressed={isActive}>Silver|Gold|SpaceX</button>`; visible focus ring in `--cyan`; keyboard-operable
- [X] T021 [US2] Wire button clicks in `components/nutrition/AssetsWidget.tsx`: if same asset → no-op; otherwise → abort in-flight via `AbortController`, set state `loading(newAsset)`, immediate fetch with the new symbol, keep the polling interval alive
- [X] T022 [US2] Style the active button distinctly in `components/nutrition/AssetsWidget.tsx` (Mnemonic palette: filled magenta bg + midnight text for active; outline cyan otherwise)

**Checkpoint**: All three buttons usable. Active asset clearly indicated. No duplicate fetches on re-click. US1 and US2 both work.

---

## Phase 5: User Story 3 — Hover the chart for point-in-time price (Priority: P3)

**Goal**: Moving the mouse across the chart reveals a tooltip with the price and local time at the hovered point. Leaving the chart dismisses the tooltip and reverts the top-right to the latest price.

**Independent Test**: Hover the chart at multiple positions — a vertical guide + circle marker follow the cursor and a tooltip shows `price` + `HH:MM` local. Move off → indicator disappears within one frame.

### Tests for User Story 3 ⚠️

- [ ] T023 [P] [US3] Component test — `pointermove` over the SVG sets `hoverIndex` to the nearest series point and renders the tooltip; `pointerleave` clears it (`__tests__/components/AssetsWidget.hover.test.tsx`)
- [ ] T024 [P] [US3] Unit test — `bisectNearest` returns the correct index for inputs at boundaries and midpoints (already covered in T004; add explicit edge cases for first/last point) (`__tests__/lib/markets.test.ts`)

### Implementation for User Story 3

- [X] T025 [US3] Add `onPointerMove` and `onPointerLeave` handlers to the SVG in `components/nutrition/AssetsWidget.tsx`: convert `event.clientX` → chart-relative X → series index via `bisectNearest`
- [X] T026 [US3] Render the hover marker in `components/nutrition/AssetsWidget.tsx`: vertical guide line + `<circle>` at the hovered point; tooltip absolutely positioned with `formatPrice` + `formatLocalTime`; clamp inside the widget; flip when within 80 px of the right edge
- [X] T027 [US3] Add `aria-live="polite"` mirror in `components/nutrition/AssetsWidget.tsx` so screen readers receive the hovered (or latest) value; chart container gets `role="img"` + descriptive `aria-label`

**Checkpoint**: Hover works smoothly and accessibly. US1, US2, US3 all independently usable.

---

## Phase 6: User Story 4 — Closed-market fallback (Priority: P2)

**Goal**: When the selected asset's market is closed, the widget shows the most recent close, the day-over-day delta vs the prior close, and a "MARKET CLOSED" indicator. Polling is suspended.

**Independent Test**: View the widget for an asset whose exchange session is closed (e.g., SPCX on a weekend). The top-right shows the last close; the delta is day-over-day; a "MARKET CLOSED" pill is visible; DevTools Network shows no recurring `/api/markets/intraday` calls.

### Tests for User Story 4 ⚠️

- [ ] T028 [P] [US4] Component test — when the fetched payload has `status === 'closed'`, the widget renders the closed-market layout, no `setInterval` is registered, and a single mount-time fetch is observed (`__tests__/components/AssetsWidget.closed.test.tsx`)
- [ ] T029 [P] [US4] Component test — transition `open → closed` across a polled refresh stops the interval after the response is applied (`__tests__/components/AssetsWidget.transition.test.tsx`)

### Implementation for User Story 4

- [X] T030 [US4] Branch the render path in `components/nutrition/AssetsWidget.tsx` on `series.status`: when `closed`, show "MARKET CLOSED" pill, last close in top-right, day-over-day delta, and still draw the curve from the response's `points`
- [X] T031 [US4] Gate the polling loop in `components/nutrition/AssetsWidget.tsx` on `series.status === 'open'`; on transition to `closed`, `clearInterval`; on transition to `open` (resume from hidden + fresh window), restart the interval

**Checkpoint**: Closed-market is friendly and quiet; all four user stories now work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tighten the edges and verify the constitution gates.

- [X] T032 [P] Manual QA pass against `specs/005-assets-widget/quickstart.md` §3 (smoke test) and §4 (manual QA checklist)
- [ ] T033 [P] Visual review on narrow viewports (≤ 360 px) — widget reflows under the calorie box, tooltip never overlaps the top-right price, three buttons stay reachable
- [ ] T034 [P] Accessibility review — `aria-pressed`, focus ring, keyboard operation of all buttons, `role="img"` + `aria-label` summary on the chart, `aria-live` mirror, no colour-only signals
- [X] T035 Run `npm run lint` — must be clean
- [X] T036 Run `npm run build` — must succeed (covers `tsc` strict mode)
- [ ] T037 Verify Constitution IV budgets: `/nutrition` bundle delta ≤ 5 KB gzipped; route response p95 ≤ 300 ms locally; no new runtime npm dependency was introduced
- [ ] T038 Update `CLAUDE.md` "Routes" table to list `GET /api/markets/intraday` and add `AssetsWidget` to the Component notes section

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. Blocks all user stories.
- **Phase 3 (US1, P1 MVP)**: Depends on Phase 2.
- **Phase 4 (US2, P2)**: Depends on Phase 2 + Phase 3 (reuses the widget shell from US1).
- **Phase 5 (US3, P3)**: Depends on Phase 2 + Phase 3 (hover is grafted onto the chart from US1).
- **Phase 6 (US4, P2)**: Depends on Phase 2 + Phase 3 (alternative render branch on the same component).
- **Phase 7 (Polish)**: Depends on all desired user stories landing.

### User Story Dependencies

- **US1 (P1)**: Foundation only — independent.
- **US2 (P2)**: Builds on the widget shell delivered by US1.
- **US3 (P3)**: Builds on the chart delivered by US1; orthogonal to US2.
- **US4 (P2)**: Builds on the widget shell from US1; orthogonal to US2 and US3.

### Within Each User Story

- Tests are written FIRST and must fail before implementation begins (Constitution II).
- Library + types before route; route before component; component shell before polling; polling before hover/closed branches.
- Story complete (and validated against its Independent Test) before moving to the next.

### Parallel Opportunities

- T002, T003 in Phase 1.
- Within Phase 2: T004 and T006 (test files) can be drafted in parallel; implementations T005 and T007 must follow their respective tests.
- Within each user story phase, the two test tasks ([P]) target different files and can be authored in parallel before implementation begins.
- Phase 7 polish tasks T032, T033, T034 are independent and can be parallelised.

---

## Parallel Example: User Story 1

```bash
# Author both component tests for US1 in parallel:
Task: "Component test mount/skeleton in __tests__/components/AssetsWidget.mount.test.tsx"
Task: "Component test polling/visibility in __tests__/components/AssetsWidget.polling.test.tsx"
```

```bash
# Phase 2 — author the two failing test suites in parallel:
Task: "Failing unit tests for lib/markets.ts in __tests__/lib/markets.test.ts"
Task: "Failing integration tests for the proxy in __tests__/api/markets-intraday.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 — Setup
2. Phase 2 — Foundational (library + proxy route + middleware)
3. Phase 3 — US1 (silver default, intraday chart, 10 s polling, visibility gating)
4. STOP and validate against US1 Independent Test.
5. Demo / merge if green — Silver-only is a valid MVP.

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation
2. Phase 3 (US1) → MVP — Silver-only intraday with auto-refresh
3. Phase 4 (US2) → multi-asset switching
4. Phase 6 (US4) → closed-market polish
5. Phase 5 (US3) → hover inspection
6. Phase 7 → polish + constitution gates

### Parallel Team Strategy

With more than one contributor after Phase 2 lands:

- Developer A: US1 (the widget shell — required by everyone else).
- Once US1 ships, Developer B can pick up US2 while Developer C picks up US4 (both edit the same file, so coordinate via branch hand-offs or short PRs).
- US3 (hover) lands last, on top of a stable chart.

---

## Notes

- `[P]` = different files, no in-phase dependencies.
- Constitution II requires tests first for the new public API route and business-rule branches — that is why every phase begins with failing tests.
- The repo has no test runner wired yet; tests are authored in Vitest-compatible syntax so the next PR that adds Vitest picks them up.
- No new runtime npm dependencies; no DB migration; no new env var.
- Commit after each logical group (e.g., "T004+T005: lib/markets.ts with tests").
- Stop at any checkpoint to validate the latest story independently.
