# Data Model: Purge Account

**Feature**: 004-purge-account | **Date**: 2026-05-21

---

## Schema Changes

### `users` table — two new columns

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `deactivated` | `INTEGER` | `0` | No | SQLite boolean; `1` = deactivated |
| `deactivated_at` | `TEXT` | `NULL` | Yes | ISO 8601 timestamp set at deactivation |

**Migration** (idempotent, wrapped in try/catch per constitution):

```sql
ALTER TABLE users ADD COLUMN deactivated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN deactivated_at TEXT;
CREATE INDEX IF NOT EXISTS idx_users_deactivated ON users(deactivated);
```

The index ensures that the `WHERE u.deactivated = 0` filter added to all read queries does not become a full table scan as the user base grows.

---

## Entities Affected

### User

**New fields:**
- `deactivated: boolean` — when `true`, the user cannot authenticate and is invisible to other members.
- `deactivated_at: string | null` — ISO timestamp of when the account was deactivated; `null` for active accounts.

**State machine:**

```
active (deactivated = 0)
    │
    │  POST /api/auth/purge (confirmed)
    ▼
deactivated (deactivated = 1, deactivated_at = <now>)
    │
    │  (admin DB intervention only — no UI reactivation in v1)
    ▼
active (deactivated = 0)
```

### Session (JWT cookie)

No schema change. The `memonic_session` cookie is cleared by the purge route. Subsequent requests with a replayed cookie are rejected by the middleware's `deactivated` check (one DB read per authenticated request).

### Posts, Nutrition Logs, Friend Requests, User Blocks

No schema change. These rows are retained intact. They are excluded from public-facing queries by filtering on `users.deactivated = 0` at the query level.

---

## Query Changes

### `/api/posts/route.ts` — feed query

Add to the JOIN condition or WHERE clause:

```sql
-- existing JOIN on friend visibility; add:
AND author.deactivated = 0
```

### `app/feed/page.tsx` — Signal Members rail (server component)

Add to the existing `ORDER BY RANDOM() LIMIT 10` query:

```sql
AND u.deactivated = 0
```

### `/api/friends/requests/route.ts` — incoming requests

Add to the query that surfaces pending requests:

```sql
AND from_user.deactivated = 0
```

### `/api/auth/login/route.ts` — login

After verifying the password hash, before issuing the JWT:

```js
if (user.deactivated) {
  return Response.json({ error: "This account has been deactivated." }, { status: 403 });
}
```

### `middleware.ts` — per-request deactivation check

After decoding the JWT, perform a lightweight DB read:

```js
const user = db.prepare("SELECT deactivated FROM users WHERE id = ?").get(payload.sub);
if (!user || user.deactivated) {
  // clear cookie + redirect to /home
}
```

---

## New Zod Schemas (`lib/schemas.ts`)

```ts
// Response schema for purge endpoint
export const purgeResponseSchema = z.object({
  success: z.boolean(),
});
```

No request body schema needed — the purge endpoint takes no payload (the user identity comes from the JWT).

---

## No Existing Tables Deleted or Renamed
