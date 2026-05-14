# Tasks: Logo Resize & Reposition

**Input**: Design documents from `specs/001-logo-resize-reposition/`

**Organization**: 3 user stories, 3 source files, no new dependencies. Stories share a single foundational phase (CSS + ReturnDot fix); each story is verified by opening the relevant page in a browser.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Confirm current state and prepare working context.

- [x] T001 Verify branch is `001-logo-resize-reposition` and dev server runs cleanly (`npm run dev`)
- [x] T002 Open `/feed`, `/home`, `/nutrition` in browser and screenshot current Masthead height for before/after comparison

---

## Phase 2: Foundational — CSS & ReturnDot Fixes (Blocking)

**Purpose**: The CSS and ReturnDot changes apply globally. They must land first; user-story phases only touch `Masthead.tsx`.

**⚠️ CRITICAL**: All story phases depend on this phase being complete.

- [x] T003 In `app/globals.css` — remove `vertical-align: middle` from the `.wordmark .dot` rule (dot is now in a flex-col stack, not inline)
- [x] T004 In `components/feed/ReturnDot.tsx` — remove `verticalAlign: "middle"` from the button's inline `style` object

**Checkpoint**: CSS and ReturnDot updated — Masthead.tsx changes can now begin.

---

## Phase 3: User Story 1 — Compact Logo on Feed Page (Priority: P1) 🎯 MVP

**Goal**: `/feed` shows a smaller, centered wordmark with the cyan ReturnDot directly below it, under the "O".

**Independent Test**: Open `/feed`, confirm wordmark is visibly smaller and centered, dot sits below under the "O", clicking dot logs out and redirects to `/home`.

### Implementation for User Story 1

- [x] T005 [US1] In `components/feed/Masthead.tsx` — change `h1` classes:
  - Remove `text-[clamp(40px,13vw,168px)]`
  - Add `text-[clamp(24px,7.5vw,96px)]`
  - Replace `mt-7` with `mt-3`
  - Add `flex flex-col items-center` (makes h1 a vertical stack)
- [x] T006 [US1] In `Masthead.tsx` — wrap the "Memonic" string in `<span>Memonic</span>` so text and dot are separate flex children
- [x] T007 [US1] In `Masthead.tsx` — ensure both `<ReturnDot />` and `<span className="dot">.</span>` remain as direct children of the `h1` after the text span (they are already present; just confirm placement is correct after the restructure)
- [x] T008 [US1] In `Masthead.tsx` — reduce header spacing: change `pb-6` → `pb-3` on the `<header>` and `mb-10` → `mb-6`
- [x] T009 [US1] In `Masthead.tsx` — reduce subtitle top margin: change `mt-3` → `mt-2` on the `<p>` subtitle

**Checkpoint**: US1 complete — `/feed` shows compact centered logo with dot below the "O"; logout works.

---

## Phase 4: User Story 2 — Compact Logo on Home / Auth Page (Priority: P2)

**Goal**: `/home` shows the same compact, centered wordmark as `/feed` (no dot present on this page).

**Independent Test**: Open `/home`, confirm wordmark size and centering match `/feed`; static cyan dot appears below the "O".

### Implementation for User Story 2

- [x] T010 [US2] Open `/home` in browser and verify US1 Masthead changes already propagate (Masthead is a shared component — no code changes needed if it renders correctly)
- [x] T011 [US2] If any `/home`-specific layout override in `app/home/page.tsx` or `AuthCard.tsx` clips or overrides the Masthead, adjust that container only — do not change Masthead.tsx again

**Checkpoint**: US2 complete — `/home` matches `/feed` logo treatment.

---

## Phase 5: User Story 3 — Compact Logo on Nutrition Page (Priority: P3)

**Goal**: `/nutrition` shows the same compact, centered wordmark.

**Independent Test**: Open `/nutrition`, confirm wordmark matches the reduced size and centering on other pages; dot appears below.

### Implementation for User Story 3

- [x] T012 [US3] Open `/nutrition` in browser and verify US1 Masthead changes propagate (same shared component)
- [x] T013 [US3] Verify the Nutrition nav tab (rendered when `active === "nutrition"`) is still correctly positioned below the subtitle after spacing reductions

**Checkpoint**: US3 complete — all three pages present a consistent compact Masthead.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T014 [P] Responsive check — resize browser from 320 px to 1920 px on each page; confirm wordmark never overflows or wraps
- [ ] T015 [P] Verify no CRT/scanline/vignette visual change in any non-Masthead area
- [x] T016 Run `npm run lint && npm run build` — both must pass with zero errors
- [ ] T017 Confirm Masthead height is visibly reduced (≥20% shorter than before-screenshots from T002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all story phases**
- **Phase 3 (US1 /feed)**: Depends on Phase 2
- **Phase 4 (US2 /home)**: Depends on Phase 3 (Masthead changes must be in place)
- **Phase 5 (US3 /nutrition)**: Depends on Phase 3 (same reason)
- **Phase 6 (Polish)**: Depends on all story phases

### Parallel Opportunities

After Phase 2 completes, US2 and US3 verification (T010–T013) can run in parallel since they are read-only browser checks against the shared component changed in US1.

---

## Parallel Example: US2 + US3 verification

```
# After T009 is done, run simultaneously:
Task T010: open /home, verify propagation
Task T012: open /nutrition, verify propagation
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (CSS + ReturnDot)
3. Phase 3: US1 — Masthead.tsx changes
4. **STOP and VALIDATE**: `/feed` fully working with compact logo and dot under "O"
5. Extend to US2 and US3 (verification only — shared component)

### Notes

- The Masthead component is shared — all three pages inherit changes from a single file edit (Masthead.tsx)
- US2 and US3 phases are primarily verification steps; no additional code is expected unless page-level overrides interfere
- `[P]` tasks = different files or browser checks, no file conflicts
