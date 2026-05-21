# Research: Purge Account

**Feature**: 004-purge-account | **Date**: 2026-05-21

All technology decisions are inherited from the existing project. No external research was required. This document records the choices made and the alternatives considered.

---

## Decision 1 — Soft-Delete Strategy

**Decision**: Add two columns to the `users` table: `deactivated INTEGER DEFAULT 0` (SQLite boolean) and `deactivated_at TEXT` (ISO timestamp, nullable). No rows are deleted from any table.

**Rationale**: The spec explicitly requires data persistence after purge. An integer flag is idiomatic SQLite (no native BOOLEAN type), cheap to index, and trivially reversible at the database level by an administrator. A separate `deactivated_at` timestamp supports auditability at zero extra query cost.

**Alternatives considered**:
- *Separate `deactivated_users` table*: adds a JOIN to every query; no benefit for a single flag.
- *Hard delete*: rejected — contradicts spec FR-012.
- *Anonymisation (nulling PII fields)*: over-engineered for v1; spec says data must persist unmodified.

---

## Decision 2 — Session Invalidation

**Decision**: On successful purge, the server clears the `memonic_session` httpOnly cookie (sets `maxAge: 0`) in the same response that returns 200. No token blacklist is maintained.

**Rationale**: The existing auth uses stateless JWTs stored in httpOnly cookies. Deleting the cookie is the only session state that exists in the browser; there is nothing to blacklist. A subsequent request with a manually replayed cookie will be rejected because the auth middleware checks `deactivated` on the user row before allowing access (see FR-008).

**Alternatives considered**:
- *Token blacklist / Redis revocation list*: not warranted; the codebase has no cache layer and the JWT TTL is 30 days. The per-request `deactivated` check provides the same guarantee with zero infrastructure.

---

## Decision 3 — Confirmation Dialog

**Decision**: A custom inline React dialog rendered inside `ProfileRail` (conditionally, via local state). No third-party dialog library. Styled with existing CSS variables and Monoton/Space Mono fonts.

**Rationale**: The constitution (Principle III) mandates the Mnemonic Studio palette and the four declared font families. A browser-native `window.confirm()` cannot match the aesthetic. A thin custom dialog (a positioned overlay div) is the minimal compliant solution.

**Alternatives considered**:
- *Browser `confirm()`*: breaks UX consistency (Principle III violation).
- *Radix UI / Headless UI dialog*: adds a new dependency; unjustified for a single dialog (constitution: "prefer the standard library and existing dependencies").

---

## Decision 4 — API Route Placement

**Decision**: `POST /api/auth/purge` — grouped under `/api/auth/` because purging an account is an authentication-state operation (it terminates the session).

**Rationale**: Consistent with the existing auth route family (`/api/auth/login`, `/api/auth/logout`, `/api/auth/signup`). Middleware already gates `/api/auth` endpoints appropriately; logout pattern is a direct model for purge.

---

## Decision 5 — Query Filtering

**Decision**: All queries that surface users or user-owned content must gain a `deactivated = 0` filter on the `users` table:

| Query | Location | Change |
|-------|----------|--------|
| Signal Members rail | `app/feed/page.tsx` (server component) | Add `AND u.deactivated = 0` |
| Post feed | `app/api/posts/route.ts` | Add `AND u.deactivated = 0` to the author JOIN |
| Friend requests display | `app/api/friends/requests/route.ts` | Add `AND u.deactivated = 0` on the `from_user` |
| Login | `app/api/auth/login/route.ts` | After credential check, reject if `deactivated = 1` |
| Auth middleware | `middleware.ts` | JWT decode already done; add DB lookup to check `deactivated` on each authenticated request |

**Note on middleware**: The existing middleware validates the JWT signature but does not query the DB. For the purge guarantee to hold (a replayed cookie is rejected), the middleware must check `deactivated` on each request. This adds one DB read per authenticated request. Given the local SQLite latency this is acceptable; the performance budget allows ≤ 150 ms for read endpoints.

**Alternatives considered**:
- *Middleware skip + rely on cookie deletion*: a user with a saved cookie copy could still access the API. Rejected — FR-008 requires the credential to be rejected, not just the browser session.

---

## No Unresolved Clarifications

All NEEDS CLARIFICATION items from the spec template have been resolved above. Phase 1 may proceed.
