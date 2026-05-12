# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Memonic** — a social network for Europe. Working prototype built with Next.js 14.2 (App Router) + TypeScript + Tailwind, persisted to a local `node:sqlite` database. Studio: **Mnemonic Studio**. Product: **Memonic**. Marketing dossier: `competitive-analysis/`.

## How to run

```bash
npm install        # one-time
npm run dev        # http://localhost:3000
npm run build      # production build (type-checks + Next.js compile)
npm run lint       # ESLint via next lint
```

Home page: `/home`. Sign-up requires age ≥ 14. Database: `data/memonic.db` (gitignored).

**Required `.env` vars** (create `.env.local`):
```
MEMONIC_JWT_SECRET=<any long random string>
GEMINI_API_KEY=<Google AI Studio key>   # only needed for /nutrition AI features
```

**Test accounts** — see `TestUsers.txt` for 10 pre-seeded EU accounts (password: `Test1234!`). These must be imported manually; the DB starts empty.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2 (App Router) + TypeScript |
| Styling | Tailwind CSS + CSS variables (neon palette + scanlines) |
| Fonts | Monoton, Audiowide, VT323, Space Mono — via `next/font/google` |
| Database | `node:sqlite` (Node 22.5+ built-in, no native compile) |
| Auth | bcryptjs + jose (JWT in httpOnly cookie, 30-day expiry) |
| Validation | zod schemas shared client/server |
| ID generation | nanoid |
| AI | Google Gemini 1.5 Flash (calorie tracker — text + vision) |

## Folder structure

```
app/
  api/auth/{signup,login,logout}/route.ts
  api/me/route.ts
  api/posts/{route.ts,search/route.ts}
  api/nutrition/{text,image,log}/route.ts
  api/friends/{request,respond,requests}/route.ts   # social graph
  api/users/block/route.ts                           # 30-day block
  home/page.tsx          # /home — auth screen (login + signup)
  feed/page.tsx          # /feed — main timeline (auth required)
  nutrition/page.tsx     # /nutrition — calorie tracker (auth required)
  globals.css            # neon palette, scanlines, base typography
  layout.tsx             # fonts + metadata
  page.tsx               # / → redirects to /home
components/
  auth/AuthCard.tsx
  feed/{Masthead,ProfileRail,PeopleRail,SearchBar,Composer,PostCard,Feed,ReturnDot,FriendRequestBanner}.tsx
  nutrition/{NutritionTracker,DailyStats}.tsx
lib/
  age.ts / auth.ts / cuid.ts / db.ts / format.ts / jwt.ts / password.ts / schemas.ts
middleware.ts            # gates /feed, /api/{posts,me,nutrition,friends,users}
```

## Data model

**users**: id, email (UNIQUE), password_hash, display_name, first_name, family_name, dob, photo, bio, city, country, social_number, created_at
- `UNIQUE INDEX` on `(country, social_number)` prevents duplicate accounts per country

**posts**: id, user_id, type ('text'|'image'), body, image (data URL), created_at, client_locale, char_count, word_count, image_w/h/kb

**nutrition_logs**: id, user_id, food_name, portion, calories, protein_g, carbs_g, fat_g, notes, source, log_date, logged_at

**friend_requests**: id, from_user_id, to_user_id, status ('pending'|'accepted'|'declined'), created_at, responded_at
- `UNIQUE(from_user_id, to_user_id)` — one request per pair; directional
- Accepted pairs = friendship; both users see each other's posts in the feed

**user_blocks**: id, blocker_id, blocked_id, blocked_until, created_at
- `UNIQUE(blocker_id, blocked_id)` — upsert refreshes the timer
- Blocked users are excluded from the Signal Members rail for the blocker until `blocked_until`
- Blocking also deletes any existing friendship between the two users

Images stored as base64 data URLs. Hard caps: 800 KB post image, 400 KB profile photo.

## Routes

| Path | Auth | Purpose |
|---|---|---|
| `GET /home` | public | Login + signup (redirects to /feed if signed in) |
| `GET /` | public | Redirects to /home |
| `GET /feed` | required | Timeline — profile rail + composer + search + posts |
| `GET /nutrition` | required | Calorie tracker — AI text, AI image, quick-add, today's log |
| `POST /api/auth/signup` | public | Age-gates ≥ 14; enforces country+social_number uniqueness |
| `POST /api/auth/login` | public | Verifies credentials, sets cookie |
| `POST /api/auth/logout` | required | Clears cookie |
| `GET /api/me` | required | Current user payload |
| `GET /api/posts` | required | Latest 100 posts + author (friends + self only) |
| `POST /api/posts` | required | Create text or image post |
| `GET /api/posts/search?q=` | required | LIKE search against body, display_name, city |
| `POST /api/nutrition/text` | required | Meal text → Gemini calorie/macro estimate |
| `POST /api/nutrition/image` | required | Meal photo → Gemini calorie/macro estimate |
| `GET /api/nutrition/log?date=` | required | Fetch log entries for a date |
| `POST /api/nutrition/log` | required | Save food entries (accepts array) |
| `DELETE /api/nutrition/log?id=` | required | Delete a log entry |
| `POST /api/friends/request` | required | Send friend request; body: `{ toUserId }` |
| `POST /api/friends/respond` | required | Accept or decline; body: `{ requestId, action: 'accept'\|'decline' }` |
| `GET /api/friends/requests` | required | Fetch pending incoming friend requests for current user |
| `POST /api/users/block` | required | Block user for 30 days; body: `{ userId }` |

## Social graph — business logic

### Signal Members rail (`PeopleRail`)
- On every `/feed` page load the server runs `ORDER BY RANDOM() LIMIT 10` to select 10 members.
- The query **excludes**: the current user, active blocks (`blocked_until > now`), and already-accepted friends (they're already in the feed — no need to show them here).
- The rail shows 5 rows at a time; user scrolls to see the remaining 5.
- **Left-click** on a member → confirmation dialog → sends a friend request (`POST /api/friends/request`).
  - Guard: duplicate/existing request or already-friends returns a 409; the UI surfaces the error as a toast.
- **Right-click** on a member → confirmation dialog → blocks them for 30 days (`POST /api/users/block`) and removes them from the visible list immediately in client state.
  - Blocking also purges any existing friendship or pending request between the two users (server-side DELETE).

### Friend requests
- Requests are directional: A→B. Only B can accept or decline.
- A user cannot send a request to someone who has blocked them (server returns 403).
- `FriendRequestBanner` polls `GET /api/friends/requests` every 30 seconds and renders a yellow banner above the Composer for each pending incoming request.
- Accepting updates status to `'accepted'`; declining sets `'declined'`. Both remove the banner entry.

### Post visibility
- The feed query returns only posts where `user_id = self OR user_id IN (accepted friends)`.
- A new user with no friends sees only their own posts — intentional; the Signal Members rail is the discovery mechanism.
- Blocking a mutual friend reverts visibility: their posts disappear from the feed on next load.

### 30-day block
- Stored in `user_blocks` with an absolute `blocked_until` ISO timestamp.
- Blocking a user you've already blocked refreshes the timer (upsert).
- The block is **unilateral**: only the blocker is affected. The blocked user still sees the blocker in their own Signal Members rail (unless they also block back).
- There is no UI to unblock before the 30 days expire (by design — considered friction enough to deter abuse).

## Behaviour notes

- Age gate runs client-side (live readout on DOB field) AND server-side (signup endpoint)
- Sessions: 30-day JWT in `httpOnly` `memonic_session` cookie. Secret: `MEMONIC_JWT_SECRET` in `.env`
- `node:sqlite` returns rows with null prototype — spread (`{ ...row }`) before passing to client components
- DB singleton lives on `global.__memonicDb` to survive Next.js hot-reloads in dev without reopening the file
- DB bootstrap is idempotent: `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` migrations wrapped in try/catch
- `node:sqlite` is marked as `serverComponentsExternalPackages` in `next.config.mjs` so the bundler doesn't try to inline it
- Signup: `first_name` + `family_name` are stored separately; `display_name` is set to `"${firstName} ${familyName}"` at insert time
- Forms use `react-hook-form` + `@hookform/resolvers/zod`; same zod schemas are reused in API route handlers

## Aesthetic system

Mnemonic Studio neon/cyberpunk palette:
- `--midnight` #0D0221, `--magenta` #FF00A0, `--cyan` #00F0FF, `--yellow` #F9F002, `--purple` #9D00FF
- Scanline overlay (`body::before`) + CRT vignette (`body::after`)
- Fonts: VT323 (terminal/body), Space Mono (labels), Monoton (wordmark/display), Audiowide (chrome)
- No public engagement counts — author sees own metrics only

**Do not apply the Mnemonic Studio aesthetic to non-Memonic work.** The two brands are deliberately distinct.

## Component notes

- `Masthead` accepts `active` ("feed" | "nutrition") to highlight the correct nav tab, and an optional `subtitle` prop to override the default tagline. Feed page passes `withReturn` which embeds the pulsing-dot logout button in the wordmark.
- `PostCard` dropcap only activates when `char_count >= 80` — prevents the large drop-cap from rendering on very short posts.
- Global CSS: `select` only gets the chevron arrow SVG (not all inputs — this was a bug that was fixed).
- `ReturnDot` — pulsing cyan dot in the Masthead wordmark on `/feed`; clicking it logs out and redirects to `/home`.
- `PeopleRail` — right-side rail showing 10 random members, 5 visible at a time. Left-click = befriend flow, right-click = ban flow. Accepted friends and blocked users are excluded from the random pool.
- `FriendRequestBanner` — polls every 30 s for pending requests; renders yellow banners above the Composer. Accept/Decline resolve in-place without a page reload.

## Next Steps

1. **Deploy to Vercel** — add `MEMONIC_JWT_SECRET` + `GEMINI_API_KEY` env vars; swap SQLite for Turso/libSQL or deploy to Fly.io with a persistent volume
2. **Food history charts** — weekly calorie trend, per-macro breakdown, most-logged foods
3. **User preferences** — persist daily calorie goal per user; dietary profile (vegan, halal, etc.)
4. **Barcode scanning** — Open Food Facts API + `BarcodeDetector` Web API (ZXing WASM fallback)
5. **Circles** — named groups of 12–30, composer audience picker, "no broadcast by default"
6. **Comments + replies** — text-only, one level deep
7. **i18n** — 24 first-class EU languages (currently only capturing `navigator.language` as metadata)
8. **`better-sqlite3`** — once MSVC toolset is available, swap from experimental `node:sqlite`
9. **Unblock UI** — allow manual early unblock (currently must wait 30 days — by design)
10. **Mutual friend suggestions** — surface "friends of friends" in the Signal Members rail
