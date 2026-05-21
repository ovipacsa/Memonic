# Tasks: Purge Account

**Input**: Design documents from `specs/004-purge-account/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Not explicitly requested in spec — omitted per task generation rules.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup

**Purpose**: No new project scaffolding required — this feature extends an existing Next.js application. The single setup task confirms the branch and build baseline.

- [ ] T001 Verify `npm run build` and `npm run lint` pass on branch `004-purge-account` before any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema, session enforcement, and the core purge API must exist before the UI or any query-filtering work can be tested end-to-end.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Add idempotent migration for `deactivated INTEGER DEFAULT 0` and `deactivated_at TEXT` columns + `CREATE INDEX IF NOT EXISTS idx_users_deactivated` in `lib/db.ts`
- [ ] T003 [P] Add `purgeResponseSchema` (zod) to `lib/schemas.ts`
- [ ] T004 Create `app/api/auth/purge/route.ts` — authenticated `POST` handler: `UPDATE users SET deactivated=1, deactivated_at=? WHERE id=?`, clear `memonic_session` cookie (`Max-Age: 0`), return `{ success: true }` (uses `purgeResponseSchema`)
- [ ] T005 Add per-request `deactivated` check to `middleware.ts` — after JWT decode, `SELECT deactivated FROM users WHERE id=?`; if `1` or missing, clear cookie and redirect to `/home`

**Checkpoint**: Foundation ready — purge API works, deactivated sessions are rejected on every request. User story implementation can begin.

---

## Phase 3: User Story 1 — Purge Account via Profile Panel (Priority: P1) 🎯 MVP

**Goal**: Signed-in user can click PURGE in their profile panel, confirm a neon dialog, be logged out, and be unable to log back in or appear to other users.

**Independent Test**: Click PURGE → confirm → redirected to `/home` → re-login attempt returns "deactivated" error → purged user absent from Signal Members rail and feed for another account.

### Implementation

- [ ] T006 [US1] Update `app/api/auth/login/route.ts` — after password verify, check `user.deactivated`; return 403 `{ error: "This account has been deactivated." }` if true
- [ ] T007 [P] [US1] Update `app/api/posts/route.ts` — add `AND author.deactivated = 0` to the feed query so purged users' posts are excluded
- [ ] T008 [P] [US1] Update `app/feed/page.tsx` — add `AND u.deactivated = 0` to the Signal Members `ORDER BY RANDOM() LIMIT 10` query
- [ ] T009 [P] [US1] Update `app/api/friends/requests/route.ts` — add `AND u.deactivated = 0` on the from-user join so pending requests from purged accounts vanish
- [ ] T010 [US1] Add PURGE button to `components/feed/ProfileRail.tsx` — positioned bottom-right of the panel; styled with `color: var(--magenta)`, Space Mono font, `opacity: 0.65` at rest → `1` on hover, `font-size: 10px`, `letter-spacing: 0.2em`; `aria-label="Purge account"`
- [ ] T011 [US1] Add confirmation dialog state and overlay to `components/feed/ProfileRail.tsx` — neon-bordered panel (`border: 1px solid rgba(255,0,160,0.4)`), warning copy explaining permanent deactivation, **Cancel** and **Confirm** buttons; Escape key and Cancel close without action; focus trapped inside dialog while open
- [ ] T012 [US1] Wire PURGE confirm action in `components/feed/ProfileRail.tsx` — `POST /api/auth/purge` on confirm; on 200 call `router.replace("/home")` + `router.refresh()`; on non-200 show inline error inside dialog and keep it open; disable Confirm button while request is in flight

**Checkpoint**: User Story 1 fully functional — purge flow end-to-end works, user is logged out, cannot log back in, absent from all discovery and feed surfaces for other accounts.

---

## Phase 4: User Story 2 — Data Persistence Verification (Priority: P2)

**Goal**: Confirm that all rows associated with a purged account remain in the database intact after deactivation.

**Independent Test**: After completing Phase 3 and purging a test account, inspect `data/memonic.db` with a SQLite browser or `node:sqlite` script — user row exists with `deactivated=1`; posts, nutrition logs, friend request rows are all present and unmodified.

*No new implementation tasks — US2 is satisfied by the soft-delete approach established in Phase 2 (T002, T004) and the query-level filtering in Phase 3 (T007–T009). The only task here is validation.*

- [ ] T013 [US2] Manually verify data persistence per `specs/004-purge-account/quickstart.md` step 8 — inspect `data/memonic.db` post-purge and confirm all user-associated rows are intact with `deactivated = 1` on the user record

**Checkpoint**: Both user stories verified — purge flow works and data is provably intact in the DB.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T014 [P] Run `npm run lint` and fix any issues introduced by this feature
- [ ] T015 [P] Run `npm run build` and confirm type-check passes with zero new errors
- [ ] T016 Run the full quickstart.md verification checklist (all 8 steps) and confirm all pass
- [ ] T017 [P] Update `CLAUDE.md` — add `deactivated` flag and `POST /api/auth/purge` to the data model and route table sections

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: All tasks depend on Phase 2 completion; T007, T008, T009 can run in parallel; T010 must precede T011 which must precede T012
- **Phase 4 (US2)**: Depends on Phase 3 completion (validation only)
- **Phase 5 (Polish)**: Depends on Phase 4; T014 and T015 can run in parallel

### Within Phase 3

```
Phase 2 done
    ├── T006 (login rejection)           — sequential
    ├── T007 [P] (feed query filter)     ─┐
    ├── T008 [P] (Signal Members filter) ─┤ all in parallel
    ├── T009 [P] (friend requests filter)─┘
    ├── T010 (PURGE button)              — sequential
    ├── T011 (confirmation dialog)       — depends on T010
    └── T012 (wire confirm action)       — depends on T011
```

### Suggested MVP Scope

Complete Phases 1–3 (T001–T012). That delivers the full end-to-end purge flow for a single user with all visibility exclusions in place. Phase 4 is a verification step; Phase 5 is housekeeping.

---

## Parallel Execution Examples

### Phase 2 Parallel Opportunities

```
T002 (DB migration)          — must be first
T003 [P] (zod schema)   ─┐
T004 [P] (purge route)   ─┤  can run in parallel after T002
T005 [P] (middleware)    ─┘
```

### Phase 3 Parallel Opportunities

```
T006 (login rejection)              — depends on T002
T007 [P] (feed filter)         ─┐
T008 [P] (Signal Members)      ─┤  depends on T002; all in parallel
T009 [P] (friend requests)     ─┘
T010 → T011 → T012 (UI chain)       — sequential; depends on T004
```

---

## Notes

- `[P]` = different files, no cross-task dependencies within the phase
- `[USN]` = traceability label mapping task to user story N
- Each phase checkpoint is independently testable before proceeding
- The migration in T002 is idempotent — safe to run in dev hot-reload cycles
- The middleware change in T005 adds one indexed SQLite read per authenticated request; negligible for local dev
