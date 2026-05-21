# Quickstart: Purge Account

**Feature**: 004-purge-account | **Date**: 2026-05-21

---

## What This Feature Does

Adds a **PURGE** button to the profile panel on `/feed`. Clicking it opens a neon-styled confirmation dialog. Confirming deactivates the account (soft delete): the user is logged out, cannot log back in, and disappears from all other users' feeds and Signal Members rail. All data is retained in the database.

---

## Files Changed / Added

| File | Change |
|------|--------|
| `lib/db.ts` | Migration: add `deactivated` + `deactivated_at` to `users` |
| `lib/schemas.ts` | Add `purgeResponseSchema` |
| `middleware.ts` | Add per-request `deactivated` check after JWT decode |
| `app/api/auth/purge/route.ts` | **NEW** — soft-delete + cookie clear |
| `app/api/auth/login/route.ts` | Reject deactivated accounts with 403 |
| `app/api/posts/route.ts` | Filter `author.deactivated = 0` |
| `app/api/friends/requests/route.ts` | Filter `from_user.deactivated = 0` |
| `app/feed/page.tsx` | Signal Members query: add `u.deactivated = 0` |
| `components/feed/ProfileRail.tsx` | Add PURGE button + confirmation dialog |

---

## Manual Verification Steps

1. Sign in with a test account.
2. On `/feed`, locate the **PURGE** button at the bottom-right of the profile panel.
3. Click PURGE — confirm the dialog appears with descriptive copy and Cancel/Confirm actions.
4. Click **Cancel** — dialog closes, account is unchanged, you remain signed in.
5. Click PURGE again, then **Confirm** — you are immediately redirected to `/home`.
6. Attempt to sign in with the same credentials — expect a "deactivated" error message.
7. Sign in as a different test account — confirm the purged user is absent from the Signal Members rail and post feed.
8. Inspect the database (`data/memonic.db`) — confirm the user row exists with `deactivated = 1`.

---

## Test Accounts

See `TestUsers.txt` for pre-seeded accounts (password: `Test1234!`). Use one account as the "victim" for the purge test and another to verify visibility exclusion.

---

## Environment

No new environment variables required. The existing `MEMONIC_JWT_SECRET` and `node:sqlite` setup are sufficient.
