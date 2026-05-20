# Tasks: Currency & Commodities Widget

**Input**: Design documents from `specs/003-currency-widget/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api-contracts.md ✅ · quickstart.md ✅

---

## ⚠️ Before You Start

Register for a free EIA API key at https://www.eia.gov/opendata/ and add it to `.env.local`:
```
EIA_API_KEY=your_key_here
```
The crude oil row shows "—" gracefully if the key is absent, so development can proceed without it.

---

## Phase 1: Setup

**Purpose**: No new npm packages needed. Confirm environment is ready.

- [ ] T001 Verify `.env.local` contains `EIA_API_KEY` (or confirm graceful-fallback path is acceptable for this session)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB column, shared types, Masthead extension, and CSS animation — MUST complete before any widget work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Add `currency_widget_visible BOOLEAN NOT NULL DEFAULT FALSE` migration to DB bootstrap in `lib/db.ts` (idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
- [ ] T003 Add `currency_widget_visible: boolean` to `UserRow` type in `lib/db.ts`
- [ ] T004 [P] Implement `lib/currency.ts` — `COUNTRY_CURRENCY` lookup, `CurrencyZone` type, `resolveCurrencyZone()`, `ExchangeRatePair`, `CommodityPrice`, `CurrencyWidgetData` types (see `data-model.md`)
- [ ] T005 [P] Add `leftSlot?: React.ReactNode` prop to `components/feed/Masthead.tsx`; replace the empty `<div />` in the 300px left column with `<div className="hidden md:flex items-center justify-end pr-2 self-stretch">{leftSlot}</div>`
- [ ] T006 [P] Add `@keyframes currency-coin-spin` animation to `app/globals.css` (coin SVG rotation, consistent with existing `weather-sun-pulse` / `weather-cloud-float` patterns)

**Checkpoint**: Run `npm run build` — must pass with no type errors before proceeding.

---

## Phase 3: User Stories 1, 2 & 3 — Core Widget (Priority: P1) 🎯 MVP

**Goal**: Widget is visible, fetches exchange rates and crude oil price, and displays all three data types correctly for both local-currency and EUR-zone users.

**User Stories covered**:
- **US1**: Local currency user sees LOCAL/EUR + LOCAL/USD
- **US2**: EUR-zone user sees EUR/USD + EUR/CNY
- **US3**: Crude oil price row is always present

**Independent Test**: Load `/feed`, click coin toggle, grant geolocation, verify two exchange rate rows + one crude oil row appear within 3 seconds.

- [ ] T007 Implement `app/api/commodities/crude-oil/route.ts` — `GET /api/commodities/crude-oil`; fetch Brent crude from EIA API; 30-min in-memory cache; return `CommodityPrice` JSON; return 503 if `EIA_API_KEY` absent or EIA unavailable (see `contracts/api-contracts.md`)
- [ ] T008 Extend `PATCH /api/me/preferences` in `app/api/me/preferences/route.ts` — add `currencyWidgetVisible: z.boolean().optional()` to `PreferencesBody` zod schema; update SQL to SET `currency_widget_visible` when field is present
- [ ] T009 Update `app/feed/page.tsx` — add `currency_widget_visible` to the `SELECT` query; import and render `<CurrencyWidget initialVisible={meRow.currency_widget_visible} />` in Masthead `leftSlot`
- [ ] T010 [P] Implement `components/feed/CurrencyWidget.tsx` — coin SVG toggle button (`aria-label="Toggle currency widget"`, keyboard-focusable); widget panel with 300 ms fade-in/out (`transition-opacity duration-300`); X close button anchored bottom-right; loading skeleton state; `role="region" aria-label="Currency & commodities"`
- [ ] T011 Wire US1/US2 exchange rate logic into `CurrencyWidget.tsx` — call `navigator.geolocation.getCurrentPosition()`; reverse-geocode via BigDataCloud; call `resolveCurrencyZone()`; branch: local currency → `GET https://api.frankfurter.app/latest?from={LOCAL}&to=EUR,USD`; EUR-zone → `GET https://api.frankfurter.app/latest?from=EUR&to=USD,CNY`; render two `<dt>`/`<dd>` rate rows with 4 decimal places; 6 s fetch timeout
- [ ] T012 Wire US3 crude oil into `CurrencyWidget.tsx` — `GET /api/commodities/crude-oil`; render Brent Crude row showing USD/bbl value to 2 decimal places; show "—" if 503

**Checkpoint**: Smoke test per `quickstart.md` steps 2–6. Both EUR-zone and local-currency paths should work.

---

## Phase 4: User Story 4 — Location Permission Denied (Priority: P2)

**Goal**: Widget degrades gracefully when geolocation is denied, times out, or returns an unrecognised country.

**Independent Test**: Deny geolocation prompt → widget shows EUR/USD + EUR/CNY with "Location unavailable — showing EUR rates" label; crude oil row still loads.

- [ ] T013 Add geo-denied/timeout/unknown-country fallback to `CurrencyWidget.tsx` — catch `GeolocationPositionError` and BigDataCloud failure; resolve `CurrencyZone` as `{ type: "unknown" }`; display EUR/USD + EUR/CNY pairs with a visible label `"Location unavailable — showing EUR rates"`; ensure no unhandled console errors
- [ ] T014 Add per-row error isolation to `CurrencyWidget.tsx` — wrap Frankfurter.app fetch in try/catch independently from crude oil fetch; a Frankfurter failure shows "—" only for exchange rate rows; crude oil row status is independent; verify both can fail independently without collapsing the widget

**Checkpoint**: Deny geo in browser DevTools → confirm fallback label appears; crude oil row unaffected.

---

## Phase 5: User Story 5 — Data Staleness & Refresh (Priority: P3)

**Goal**: Widget shows a "last updated" timestamp and refreshes data after 30 minutes without requiring a full page reload.

**Independent Test**: Open widget, note timestamp, wait 31 minutes (or mock `Date.now()`), trigger a fresh open/close cycle → verify timestamp updates.

- [ ] T015 Add `lastFetched` timestamp display to `CurrencyWidget.tsx` — show `"Updated [HH:MM]"` or `"as of [date]"` below the rate rows using Space Mono font at reduced opacity; update on every successful fetch
- [ ] T016 Implement 30-min client-side cache in `CurrencyWidget.tsx` — store `lastFetched: number` in component state; on widget open, skip refetch if `Date.now() - lastFetched < 30 * 60 * 1000`; on stale weekend/holiday Frankfurter response, display the `date` field from the API as `"as of YYYY-MM-DD"`

**Checkpoint**: Open widget, close, reopen within 30 min → no new network requests for exchange rates. Reopen after 30 min → fresh fetch, updated timestamp.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tests, accessibility verification, build gates.

- [ ] T017 [P] Write unit tests for `lib/currency.ts` in `__tests__/lib/currency.test.ts` — cover: `resolveCurrencyZone` for EUR-zone country, local-currency country, unknown country, null input; cover all 22 eurozone entries; cover at least 5 non-EUR entries
- [ ] T018 [P] Write integration tests for `GET /api/commodities/crude-oil` in `__tests__/api/crude-oil.test.ts` — cover: successful EIA response, cache hit (second call, no EIA fetch), EIA timeout (503 returned), missing `EIA_API_KEY` (503 returned)
- [ ] T019 Keyboard and screen-reader pass — verify: coin toggle is Tab-reachable; X button is Tab-reachable; `aria-label` on toggle and panel region; rate rows use `<dt>`/`<dd>` semantics; coin SVG has `aria-hidden="true"`
- [ ] T020 Run full smoke test sequence from `quickstart.md` — steps 1–9 including `npm run build` + `npm run lint`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US1+US2+US3)**: Depends on Phase 2 — T010/T011/T012 depend on T004/T005/T006
- **Phase 4 (US4)**: Depends on Phase 3 (extends CurrencyWidget.tsx)
- **Phase 5 (US5)**: Depends on Phase 4 (adds to CurrencyWidget.tsx state)
- **Phase 6 (Polish)**: Depends on all prior phases; T017/T018 can run in parallel

### Within Phase 3

```
T007 (crude oil route) ──────────────────────────────────► T012 (wire crude oil)
T008 (preferences route) ─────────────────────────────────► T009 (feed page)
T004 (lib/currency.ts) ──► T011 (wire exchange rates) ────► T009
T005 (Masthead leftSlot) ─► T010 (widget shell) ──────────► T009
```

T007, T008, T010 can all start in parallel once Phase 2 is complete.

### Parallel Opportunities

```bash
# Phase 2 — run all in parallel after T002/T003:
T004  lib/currency.ts
T005  Masthead leftSlot prop
T006  globals.css animation

# Phase 3 — run in parallel:
T007  crude oil API route
T008  extend preferences route
T010  CurrencyWidget shell

# Phase 6 — run in parallel:
T017  unit tests (currency.ts)
T018  integration tests (crude-oil route)
```

---

## Implementation Strategy

### MVP (US1 + US2 + US3 only — Phase 2 + Phase 3)

1. Complete Phase 2: Foundational
2. Complete Phase 3: Core widget (exchange rates + crude oil)
3. **STOP and validate**: smoke test per `quickstart.md`
4. The widget is fully functional for all European users — ship or demo

### Incremental Delivery

1. Phase 2 → Phase 3: Widget live, both currency zones work, crude oil visible
2. Phase 4: Graceful geo-denied fallback added
3. Phase 5: Timestamp + 30-min cache added
4. Phase 6: Tests + CI gate green

---

## Notes

- `[P]` = parallelisable (different files, no shared state)
- `[US1]`/`[US2]` etc. = traceability to spec user story
- US1 + US2 + US3 are all P1 and handled together in Phase 3 (they're facets of the same component, not independently deployable)
- Prefer committing after each phase checkpoint
- If `EIA_API_KEY` is unavailable, Phase 3 can still be completed — crude oil row just shows "—"
