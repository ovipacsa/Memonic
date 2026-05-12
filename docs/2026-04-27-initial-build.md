# 2026-04-27 — Initial build

Decision log for the first working prototype of Memonic. The session went from an empty workspace (a marketing dossier and a brand profile but no code) to a running Next.js app at `localhost:3000` with persistent local storage of accounts, text posts, and image posts.

## What was built

- A Next.js 14 (App Router, TypeScript) project scaffolded directly into the existing workspace (no `create-next-app`, since the directory already contained the dossier and config files we wanted to keep).
- A SQLite-backed persistence layer using **Node 22.5+'s built-in `node:sqlite`** module — see "node:sqlite over better-sqlite3" below for the reason this differs from the plan.
- Two tables: `users` (with DOB, photo, city, bio) and `posts` (text or image, with rich metadata: char/word counts, image dimensions, KB, locale).
- Auth: bcryptjs password hashing + a 30-day JWT in an `httpOnly` cookie (jose). Two-tier age gate — client-side live readout while typing DOB, then server-side re-validation in `/api/auth/signup`.
- Edge middleware (`middleware.ts`) gating `/feed` and `/api/{posts,me}` on a valid session cookie.
- Two pages: `/` (auth card with signup/login tabs) and `/feed` (masthead, profile rail, composer, search bar, feed).
- A composer that treats text and image as equal citizens — same card chrome, same submit affordance, same metadata strip after posting.
- A `PostCard` that renders both post types with type-specific metadata (chars/words/reading-time for text; dimensions/filesize for images) without showing public engagement counts (per the dossier's "no public like counts" principle).
- Server-side debounced search via SQL `LIKE` against post body, author name, and city.
- The full editorial palette + grain overlay + type system from `competitive-analysis/marketing-plan.html`, translated from inline `<style>` to `app/globals.css` and `tailwind.config.ts`.
- Documentation: a rewritten `CLAUDE.md` (129 lines) and this decision log.

## Decisions and why

### `node:sqlite` over `better-sqlite3`

The plan specified `better-sqlite3`. First install attempt failed because `node-gyp` could not find a Visual Studio C++ toolset on the host (only "Visual Studio core features" — the C++ workload is missing on this Windows machine). Rather than ask the user to install ~6 GB of Visual Studio Build Tools, I switched to **`node:sqlite`** — Node 24 has it built in, the API is synchronous and very close to better-sqlite3, and it requires zero compilation. This left the architecture unchanged: same SQL, same file on disk (`data/memonic.db`), same singleton pattern. Trade-off: `node:sqlite` is marked experimental (the runtime prints a warning), and is less feature-rich than better-sqlite3 (no `pluck()`, no per-statement options for some flags). Acceptable for a prototype; CLAUDE.md's "Coming next" lists swapping back as future work.

### Images stored as base64 data URLs in SQLite

Honors the user's "save … in a local database" instruction literally — one persistence story for accounts, text posts, *and* images. Hard cap of 800 KB per post image and 400 KB per profile photo keeps the DB file small and per-row cost honest. The alternative (filesystem write of binary blobs into `data/uploads/`) would be the right move for production but introduces a second persistence layer and orphan-cleanup logic — out of scope for an evening prototype.

### `bcryptjs` over `bcrypt`

Pure JS, no native build step. Slower than the native `bcrypt`, but for a prototype with a handful of accounts the difference is invisible. Same MSVC-toolset reasoning as the SQLite swap.

### `jose` (JWT in httpOnly cookie) over `iron-session`/`next-auth`

Smallest possible auth surface. JWT in cookie, signed with HS256, 30-day expiry. We need exactly one claim (`userId`); anything heavier is wasted complexity. The secret comes from `MEMONIC_JWT_SECRET` in `.env`; if absent, the lib falls back to a constant *and writes a warning string into the secret* — i.e. it works in dev but produces signatures any developer can forge, which is the desired loud failure mode.

### Splitting `lib/jwt.ts` from `lib/auth.ts`

Discovered mid-implementation: `next/headers`' `cookies()` only works in server components and route handlers, not in middleware (which runs on the edge runtime). Original `lib/auth.ts` mixed JWT primitives with cookie helpers, which forced middleware to import `next/headers` transitively. Split the JWT functions (`signSession`, `verifySession`, `SESSION_COOKIE` constant) into `lib/jwt.ts` (no Next imports), and kept the cookie wrappers in `lib/auth.ts`. Middleware imports from `lib/jwt.ts`; route handlers and server components import from `lib/auth.ts`.

### Spread rows before passing to client components

Got a 500 on `/feed` first render: *"Only plain objects, and a few built-ins, can be passed to Client Components from Server Components."* Cause: `node:sqlite`'s `.get()` and `.all()` return rows with a **null prototype**, which fails Next.js's serializer. Fix: spread (`{ ...row }`) every row in the server component before handing it off to `<ProfileRail>` / `<Feed>`. This is now an invariant — any future server-component → client-component data path needs the same spread.

### No public engagement counts

The dossier states this as a hard product principle ("the author sees the numbers; viewers do not"). I honored it in the prototype by simply *not implementing* a likes/views/replies model rather than building it and hiding it. Easier to add later than to argue about removing.

### Visible per-post metadata is the metadata the *author* would also want to see

Post type pill, author name, city, relative timestamp (with absolute on hover), locale tag, char/word count for text posts, image dimensions + KB for image posts. None of these are engagement signals. They are honest production metadata about the artifact itself — which fits the dossier's editorial register.

### Aesthetic: lifted, not redesigned

The marketing dossier already established the visual identity. I translated it (palette, grain overlay, type stack, drop caps, small-caps section labels, hairline rules) directly into `globals.css` and Tailwind. No second draft of the brand for the product. This both saves time and respects the user's prior creative work — the studio (Mnemonic) defined the brand of the product (Memonic) deliberately, and inventing a new look for the prototype would have undermined that.

## Verification (what I actually ran)

- `npx tsc --noEmit` → clean.
- `npm run dev` → ready in 2.6s, no errors after the post-fix recompile.
- `curl POST /api/auth/signup` with valid DOB → `{ ok: true, userId: ... }`, cookie set.
- `curl POST /api/auth/signup` with DOB making age 12 → `{ error: "You must be at least 14 to join. We computed your age as 12." }`, status 403.
- `curl GET /api/me` with cookie → returns the new user.
- `curl POST /api/posts` (text) → text post created, char_count/word_count populated.
- `curl POST /api/posts` (image, 1×1 PNG data URL) → image post created, dimensions/filesize stored.
- `curl GET /api/posts/search?q=Europe` → 1 result, correct match.
- `curl GET /feed` (with cookie) → 200, full HTML rendered, both posts visible, profile rail populated, masthead present.
- Inspected `data/memonic.db` directly via `node:sqlite` after restart — 1 user, 2 posts. Persistence confirmed across process restarts, not just refreshes.

The dev server is left running on `http://localhost:3000` for the user to preview in a browser.

## Things to watch in follow-up sessions

- The Windows curl client mangled the `ș` in "Timișoara" to `?` on the way *into* the DB. The DB stores whatever it received; the browser would have sent UTF-8 cleanly. Worth retesting with a real browser session.
- `node:sqlite` prints `(node:NNNN) ExperimentalWarning: SQLite is an experimental feature` on first use per process. Harmless but ugly in logs — silenceable with `--no-warnings` if it ever matters.
- Next.js 14.2.13 has a known security advisory; the lockfile was generated against it because the plan pinned that version. Bumping to a patched 14.2.x line is a one-line change in `package.json` and a reinstall.
- The `data/` directory is gitignored, but on the user's first `git init` we should make sure `data/memonic.db` does not accidentally end up tracked.
