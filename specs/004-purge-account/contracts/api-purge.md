# API Contract: POST /api/auth/purge

**Feature**: 004-purge-account | **Date**: 2026-05-21

---

## Endpoint

`POST /api/auth/purge`

**Auth**: Required — `memonic_session` httpOnly cookie (existing middleware).

**Request body**: None.

---

## Responses

### 200 OK — Account deactivated

Sets `Set-Cookie: memonic_session=; Max-Age=0; HttpOnly; Path=/` to clear the session.

```json
{ "success": true }
```

### 401 Unauthorized — Not authenticated

```json
{ "error": "Unauthorized" }
```

### 500 Internal Server Error — DB failure

```json
{ "error": "Failed to deactivate account." }
```

---

## Side Effects (in order, atomic)

1. Set `users.deactivated = 1` and `users.deactivated_at = <ISO now>` for the calling user.
2. Clear the `memonic_session` cookie in the response headers.

No other tables are modified. No rows are deleted.

---

## Idempotency

Calling this endpoint on an already-deactivated account returns 200 (no error) — the `UPDATE` is a no-op if `deactivated` is already `1`.

---

## Client Flow

```
User clicks PURGE
  → confirmation dialog shown
  → user confirms
  → POST /api/auth/purge
  → 200: router.replace("/home") + router.refresh()
  → non-200: show inline error, keep dialog open
```
