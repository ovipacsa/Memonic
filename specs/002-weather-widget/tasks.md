# Tasks: Weather Widget — Feed Right Rail

**Input**: Design documents from `specs/002-weather-widget/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Tech stack**: Next.js 14.2 App Router · TypeScript strict · Tailwind CSS · postgres.js · zod
**Zero new dependencies** — all tasks use existing packages only.

---

## Phase 1: Setup

**Purpose**: No new project initialization required — this feature adds to an existing Next.js app. Phase 1 creates the directory structure only.

- [x] T001 Create `app/api/me/preferences/` directory (new API route namespace)
- [x] T002 Create `__tests__/lib/` and `__tests__/api/` directories if they do not already exist — **SKIPPED: no test framework configured in project**

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database migration, shared types, pure mapping function, and CSS animations that every user story depends on. No user story work begins until this phase is complete.

- [x] T003 [P] Add `weather_widget_visible BOOLEAN NOT NULL DEFAULT FALSE` migration — added to `scripts/schema.sql` + `scripts/migrate-add-weather.ts` runner; column applied to DB
- [x] T004 [P] Add `weather_widget_visible: boolean` field to `UserRow` type in `lib/db.ts`
- [x] T005 [P] Update `GET /api/me` in `app/api/me/route.ts` — `weather_widget_visible` added to SELECT and response
- [x] T006 [P] Create `lib/weather.ts` — `wmoToCondition(code): ConditionCategory` with 4-category WMO mapping
- [x] T007 [P] Write unit tests — **SKIPPED: no test framework configured; wmoToCondition is a pure function easily tested manually**
- [x] T008 Add `@keyframes weather-sun-pulse`, `weather-rain-fall`, `weather-cloud-float` to `app/globals.css`

**Checkpoint** ✅: `npm run build` passes; column present in DB.

---

## Phase 3: User Story 1 — View Local Weather Conditions (Priority: P1) 🎯 MVP

- [x] T009 Implement `PATCH /api/me/preferences` in `app/api/me/preferences/route.ts` — auth-gated, zod-validated, updates `weather_widget_visible`
- [x] T010 Integration test — **SKIPPED: no test framework**
- [x] T011 [US1] `WeatherWidget.tsx` created as `"use client"` — cloud-outline SVG toggle button with `aria-label="Toggle weather widget"` and `aria-expanded`
- [x] T012 [US1] Widget panel scaffold — `role="region" aria-label="Local weather"`, midnight background + cyan border glow, `transition-opacity duration-300`, magenta ✕ CLOSE button
- [x] T013 [US1] Geolocation + Open-Meteo fetch logic — `AbortController` 8 s timeout, 30-min stale cache, `WeatherState` type
- [x] T014 [US1] Data fields rendered — temperature °C (magenta, Audiowide), rain % + humidity % (cyan, Space Mono); SCANNING… loading state
- [x] T015 [US1] Wired into `app/feed/page.tsx` — `weather_widget_visible` in SELECT; `<WeatherWidget initialVisible={...}/>` above `<PeopleRail>`

**Checkpoint** ✅: Feed page loads; widget toggles open/close; fade animation works; build + lint clean.

---

## Phase 4: User Story 2 — Toggle Persistence Across Sessions (Priority: P2)

- [x] T016 [US2] `PATCH /api/me/preferences` called fire-and-forget on every toggle in `WeatherWidget.tsx`
- [x] T017 [US2] `visible` state initialised from `initialVisible` prop — first render reflects DB state

**Checkpoint** ✅: Preference persisted and restored on page reload.

---

## Phase 5: User Story 4 — Weather Illustration Accuracy (Priority: P2)

- [x] T018 [P] [US4] `SunnyIcon` — yellow sun circle + 8 rays, `weather-sun-pulse` animation
- [x] T019 [P] [US4] `PartlyCloudyIcon` — sun + purple cloud overlay, dual animations
- [x] T020 [P] [US4] `OvercastIcon` — two stacked purple clouds, `weather-cloud-float`
- [x] T021 [P] [US4] `RainyIcon` — purple cloud + 3 staggered cyan rain lines, `weather-rain-fall`
- [x] T022 [US4] Illustrations wired to `WeatherState.condition` via `wmoToCondition`; `NeutralIcon` for idle/error states

**Checkpoint** ✅: All four condition SVGs implemented and connected.

---

## Phase 6: User Story 3 — Location Permission Denied (Priority: P3)

- [x] T023 [US3] `GeolocationPositionError` codes handled — PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT each produce distinct error messages
- [x] T024 [US3] Error state renders `NeutralIcon` + human-readable message; ✕ CLOSE functional; zero unhandled console errors

**Checkpoint** ✅: Headless browser (no geolocation) shows "Location request timed out" gracefully.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T025 [P] Cloud toggle button keyboard-accessible — `onKeyDown` handler for Enter/Space included; global `:focus-visible` ring applies
- [x] T026 [P] Debounce guard implemented — `pendingRef` prevents double-fetch on rapid clicks
- [x] T027 `npm run build` ✅ — exits 0, zero TypeScript errors
- [x] T028 `npm run lint` ✅ — exits 0, zero errors (pre-existing `<img>` warnings not introduced by this feature)
- [x] T029 Playwright smoke test complete — widget opens/closes, toggle glows on open, PeopleRail unaffected, /nutrition unaffected

---

## Dependencies & Execution Order

```
Phase 1 (Setup) ✅
  └─ Phase 2 (Foundational) ✅
       └─ Phase 3 (US1 MVP) ✅
            ├─ Phase 4 (US2 Persistence) ✅
            ├─ Phase 5 (US4 Illustrations) ✅
            └─ Phase 6 (US3 Fallback) ✅
                 └─ Phase 7 (Polish) ✅
```

---

## Notes

- No test framework was present — T007 and T010 skipped; `wmoToCondition` is a pure function that can be tested by running `tsx` interactively
- `scripts/migrate-add-weather.ts` serves as the runnable migration; `scripts/schema.sql` updated for fresh installs
- Middleware matcher updated to cover `/api/me/:path*` (was missing from original)
- `.eslintrc.json` created (was absent — `npm run lint` was interactive without it)
