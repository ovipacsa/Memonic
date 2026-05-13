# SQLite → PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `node:sqlite` with a local PostgreSQL 17 database using `postgres.js`, migrate all data, update every DB call, and add a probabilistic weighted social graph layer for behavioral prediction.

**Architecture:** PostgreSQL 17 installed via winget. `users.user_id` is UUID (opaque for future public API). All other PKs are `BIGINT GENERATED ALWAYS AS IDENTITY`. All SELECT queries alias PKs as `id` so existing TypeScript types and frontend components need zero changes. Two server-component pages (`feed/page.tsx`, `nutrition/page.tsx`) and 13 API routes are updated from synchronous SQLite calls to async postgres.js tagged-template queries. A second schema layer adds an asymmetric probabilistic user graph (pairwise + group weights, extensible index registry, event-driven + batch computation queue, global visibility flag).

**Tech Stack:** PostgreSQL 17, `postgres` (postgres.js v3), `tsx` (migration script runner), Node.js 24

---

## ⚠️ SCHEMA — review before proceeding past Task 2

```
-- Core tables
users               → user_id UUID PK (gen_random_uuid)
posts               → post_id BIGINT PK,  user_id UUID FK
nutrition_logs      → log_id  BIGINT PK,  user_id UUID FK
friend_requests     → request_id BIGINT PK, from/to_user_id UUID FK
user_blocks         → block_id BIGINT PK, blocker/blocked_id UUID FK

-- Probabilistic graph layer
relation_index_registry   → index_id BIGINT PK — extensible index catalog
user_pair_weights         → (from_user_id, to_user_id) PK — asymmetric w(A→B)
user_pair_index_scores    → (from_user_id, to_user_id, index_id) PK — per-index component scores
user_groups               → group_id BIGINT PK — hyperedge group weights
user_group_members        → (group_id, user_id) PK — group membership
weight_computation_queue  → job_id BIGINT PK — event-driven job queue
weight_system_config      → single-row config (event-driven on/off, batch on/off, visibility flag)
user_risk_scores          → user_id UUID PK — internal moderation/behavioral risk
```

Type upgrades from SQLite:
- Timestamps: `TEXT ISO` → `TIMESTAMPTZ`
- Dates: `TEXT` → `DATE`
- Macros (calories etc.): `REAL` → `NUMERIC(8,2)`
- All FKs to users: `TEXT` nanoid → `UUID`

---

### Task 1: Install PostgreSQL 17 and create database

**Files:** none

- [ ] **Step 1: Install via winget**
```bash
winget install PostgreSQL.PostgreSQL.17
```
Expected: PostgreSQL installs to `C:\Program Files\PostgreSQL\17\`

- [ ] **Step 2: Add psql to PATH (open a new terminal after install)**
```bash
export PATH="/c/Program Files/PostgreSQL/17/bin:$PATH"
psql --version
```
Expected: `psql (PostgreSQL) 17.x`

- [ ] **Step 3: Create database and app role**
```bash
psql -U postgres -c "CREATE DATABASE memonic;"
psql -U postgres -c "CREATE ROLE memonic_app WITH LOGIN PASSWORD 'memonic_dev_pw';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE memonic TO memonic_app;"
psql -U postgres -d memonic -c "GRANT ALL ON SCHEMA public TO memonic_app;"
```
Expected: `CREATE DATABASE`, `CREATE ROLE`, `GRANT` for each command.

- [ ] **Step 4: Verify connection**
```bash
psql "postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" -c "SELECT version();"
```
Expected: PostgreSQL 17 version string.

- [ ] **Step 5: Add DATABASE_URL to .env.local**
Add this line to `.env.local` (create it if it doesn't exist):
```
DATABASE_URL=postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic
```

- [ ] **Step 6: Commit**
```bash
git commit --allow-empty -m "chore: PostgreSQL 17 installed locally, memonic DB created"
```

---

### Task 2: Write and apply PostgreSQL schema

**Files:**
- Create: `scripts/schema.sql`

- [ ] **Step 1: Create scripts/schema.sql**

```sql
-- scripts/schema.sql
-- Apply: psql $DATABASE_URL -f scripts/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  first_name    TEXT,
  family_name   TEXT,
  dob           DATE NOT NULL,
  photo         TEXT,
  bio           TEXT,
  city          TEXT,
  country       TEXT,
  social_number TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower
  ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_country_social
  ON users (country, social_number)
  WHERE country IS NOT NULL AND social_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_created_at
  ON users (created_at);

-- ─── posts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  post_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('text','image')),
  body          TEXT,
  image         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_locale TEXT,
  char_count    INTEGER,
  word_count    INTEGER,
  image_w       INTEGER,
  image_h       INTEGER,
  image_kb      INTEGER
);
CREATE INDEX IF NOT EXISTS posts_user_id     ON posts (user_id);
CREATE INDEX IF NOT EXISTS posts_created_at  ON posts (created_at DESC);

-- ─── nutrition_logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_logs (
  log_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  portion   TEXT,
  calories  NUMERIC(8,2) NOT NULL,
  protein_g NUMERIC(7,2),
  carbs_g   NUMERIC(7,2),
  fat_g     NUMERIC(7,2),
  notes     TEXT,
  source    TEXT NOT NULL DEFAULT 'text'
            CHECK (source IN ('text','image','quick','manual')),
  log_date  DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nutrition_logs_user_date
  ON nutrition_logs (user_id, log_date);

-- ─── friend_requests ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_requests (
  request_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS friend_requests_to_user
  ON friend_requests (to_user_id, status);
CREATE INDEX IF NOT EXISTS friend_requests_from_user
  ON friend_requests (from_user_id, status);

-- ─── user_blocks ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_blocks (
  block_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blocker_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  blocked_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocker
  ON user_blocks (blocker_id, blocked_until);
```

- [ ] **Step 2: Apply schema**
```bash
psql "postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" -f scripts/schema.sql
```
Expected: one `CREATE EXTENSION`, five `CREATE TABLE`, nine `CREATE INDEX`.

- [ ] **Step 3: Verify**
```bash
psql "postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" -c "\dt"
```
Expected: 5 rows — friend_requests, nutrition_logs, posts, user_blocks, users.

- [ ] **Step 4: Commit**
```bash
git add scripts/schema.sql
git commit -m "feat(db): PostgreSQL schema — UUID user PKs, BIGINT entity PKs, TIMESTAMPTZ"
```

---

### Task 2b: Write and apply probabilistic graph schema

**Files:**
- Create: `scripts/schema-graph.sql`

- [ ] **Step 1: Create scripts/schema-graph.sql**

```sql
-- scripts/schema-graph.sql
-- Probabilistic weighted social graph layer.
-- Apply AFTER schema.sql: psql $DATABASE_URL -f scripts/schema-graph.sql
--
-- Design: asymmetric pairwise weights w(A→B) ∈ [0.000001, 0.999999],
-- extensible index registry (add indexes = INSERT, no migration),
-- group hyperedge weights w(A,B,C,...), event-driven + batch computation queue,
-- global visibility flag, per-user risk scores for internal moderation.

-- ─── relation_index_registry ─────────────────────────────────────────────────
-- One row per behavioral index. Add a new index = INSERT a row here, then
-- start writing scores into user_pair_index_scores for that index_id.
-- No schema migration ever needed to extend the system.
CREATE TABLE IF NOT EXISTS relation_index_registry (
  index_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT NOT NULL,
  formula_hint        TEXT,             -- human note on computation method
  contribution_weight NUMERIC(5,4) NOT NULL DEFAULT 0.2
                      CHECK (contribution_weight > 0 AND contribution_weight <= 1),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the 5 initial behavioral indexes.
-- Contribution weights sum to 1.0 across active indexes (enforced in app logic).
INSERT INTO relation_index_registry (slug, description, formula_hint, contribution_weight) VALUES
  ('connection_strength',
   'Strength of direct and indirect social connection between two users',
   'mutual_friends / max_possible + direct_request_accepted_bonus',
   0.25),
  ('behavioral_tempo',
   'Similarity in activity frequency, session timing, and post cadence',
   'cosine_similarity(activity_time_series_A, activity_time_series_B)',
   0.20),
  ('content_affinity',
   'Topic and sentiment overlap across posts (computed via Gemini API)',
   'cosine_similarity(topic_vector_A, topic_vector_B) from Gemini embeddings',
   0.25),
  ('interaction_reciprocity',
   'Asymmetric signal ratio: how much A engages with B vs B with A',
   'log(1 + A_to_B_signals) / log(1 + max(A_to_B, B_to_A))',
   0.15),
  ('temporal_copresence',
   'Overlap in active hours and days between two users',
   'jaccard(active_hour_buckets_A, active_hour_buckets_B)',
   0.15)
ON CONFLICT (slug) DO NOTHING;

-- ─── user_pair_weights ───────────────────────────────────────────────────────
-- Asymmetric pairwise weights. w(A→B) ≠ w(B→A).
-- component_scores JSONB: {slug: score} snapshot used as ML model input.
-- model_version: stamps which formula/model computed this weight — enables A/B testing.
-- is_visible_to_user: overridden by weight_system_config.scores_visible_to_users.
CREATE TABLE IF NOT EXISTS user_pair_weights (
  from_user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  to_user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  weight            NUMERIC(7,6) NOT NULL
                    CHECK (weight >= 0.000001 AND weight <= 0.999999),
  component_scores  JSONB NOT NULL DEFAULT '{}',
  model_version     TEXT NOT NULL DEFAULT 'v0-weighted-avg',
  is_visible_to_user BOOLEAN NOT NULL DEFAULT false,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_user_id, to_user_id),
  CHECK (from_user_id <> to_user_id)
);
CREATE INDEX IF NOT EXISTS upw_from_user  ON user_pair_weights (from_user_id);
CREATE INDEX IF NOT EXISTS upw_to_user    ON user_pair_weights (to_user_id);
CREATE INDEX IF NOT EXISTS upw_weight     ON user_pair_weights (weight DESC);
CREATE INDEX IF NOT EXISTS upw_components ON user_pair_weights USING GIN (component_scores);

-- ─── user_pair_index_scores ──────────────────────────────────────────────────
-- Raw per-index scores per directed pair. These are the inputs to the weight formula.
-- raw_signal JSONB: debug/audit data showing what events drove the score.
CREATE TABLE IF NOT EXISTS user_pair_index_scores (
  from_user_id UUID   NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  to_user_id   UUID   NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  index_id     BIGINT NOT NULL REFERENCES relation_index_registry(index_id),
  score        NUMERIC(7,6) NOT NULL
               CHECK (score >= 0.0 AND score <= 1.0),
  raw_signal   JSONB  NOT NULL DEFAULT '{}',
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_user_id, to_user_id, index_id)
);
CREATE INDEX IF NOT EXISTS upis_pair  ON user_pair_index_scores (from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS upis_index ON user_pair_index_scores (index_id);

-- ─── user_groups (hyperedge group weights) ───────────────────────────────────
-- A group is a set of 3+ users with a combined behavioral weight.
-- member_ids_hash: deterministic hash of sorted member UUIDs for dedup lookups.
CREATE TABLE IF NOT EXISTS user_groups (
  group_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  weight           NUMERIC(7,6) NOT NULL
                   CHECK (weight >= 0.000001 AND weight <= 0.999999),
  member_count     INTEGER NOT NULL CHECK (member_count >= 2),
  member_ids_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 of sorted UUIDs, for dedup
  component_scores JSONB NOT NULL DEFAULT '{}',
  model_version    TEXT NOT NULL DEFAULT 'v0-weighted-avg',
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ug_weight ON user_groups (weight DESC);

CREATE TABLE IF NOT EXISTS user_group_members (
  group_id BIGINT NOT NULL REFERENCES user_groups(group_id) ON DELETE CASCADE,
  user_id  UUID   NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS ugm_user ON user_group_members (user_id);

-- ─── weight_computation_queue ────────────────────────────────────────────────
-- Event-driven recomputation queue. Application events INSERT rows here.
-- A background worker SELECTs pending jobs, recomputes affected pair weights,
-- then marks them done. Can be disabled via weight_system_config.event_driven_enabled.
CREATE TABLE IF NOT EXISTS weight_computation_queue (
  job_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trigger_event    TEXT NOT NULL,        -- 'new_post','new_friend','block','login'
  affected_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  related_user_id  UUID REFERENCES users(user_id) ON DELETE SET NULL,
  priority         SMALLINT NOT NULL DEFAULT 5
                   CHECK (priority BETWEEN 1 AND 10),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','done','failed')),
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ
);
-- Partial index — only pending jobs need to be fast-scanned by the worker.
CREATE INDEX IF NOT EXISTS wcq_pending
  ON weight_computation_queue (priority, created_at)
  WHERE status = 'pending';

-- ─── weight_system_config ────────────────────────────────────────────────────
-- Single-row global config. Boolean PRIMARY KEY + CHECK enforces exactly one row.
-- Toggle event_driven_enabled / batch_enabled at runtime with a simple UPDATE.
CREATE TABLE IF NOT EXISTS weight_system_config (
  id                     BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  event_driven_enabled   BOOLEAN NOT NULL DEFAULT true,
  batch_enabled          BOOLEAN NOT NULL DEFAULT true,
  batch_cron_schedule    TEXT NOT NULL DEFAULT '0 2 * * *',  -- 2 AM UTC daily
  scores_visible_to_users BOOLEAN NOT NULL DEFAULT false,    -- global visibility flag
  current_model_version  TEXT NOT NULL DEFAULT 'v0-weighted-avg',
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO weight_system_config DEFAULT VALUES
  ON CONFLICT (id) DO NOTHING;

-- ─── user_risk_scores ────────────────────────────────────────────────────────
-- Per-user behavioral and moderation risk scores. Internal only.
-- risk_signals JSONB: raw audit trail of what drove the score.
-- Used for both content ranking (internal) and moderation queue prioritisation.
CREATE TABLE IF NOT EXISTS user_risk_scores (
  user_id         UUID NOT NULL PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  behavioral_risk NUMERIC(5,4) CHECK (behavioral_risk BETWEEN 0 AND 1),
  content_risk    NUMERIC(5,4) CHECK (content_risk BETWEEN 0 AND 1),
  network_risk    NUMERIC(5,4) CHECK (network_risk BETWEEN 0 AND 1),
  risk_signals    JSONB NOT NULL DEFAULT '{}',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Apply graph schema**
```bash
psql "postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" -f scripts/schema-graph.sql
```
Expected: `CREATE TABLE` × 7, `CREATE INDEX` × 10, `INSERT 5` (index registry seed).

- [ ] **Step 3: Verify registry seeded**
```bash
psql "postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" \
  -c "SELECT slug, contribution_weight, is_active FROM relation_index_registry ORDER BY index_id;"
```
Expected: 5 rows — connection_strength, behavioral_tempo, content_affinity, interaction_reciprocity, temporal_copresence.

- [ ] **Step 4: Verify config row**
```bash
psql "postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" \
  -c "SELECT event_driven_enabled, batch_enabled, scores_visible_to_users FROM weight_system_config;"
```
Expected: `t | t | f`

- [ ] **Step 5: Commit**
```bash
git add scripts/schema-graph.sql
git commit -m "feat(db): probabilistic user graph schema — pairwise weights, group hyperedges, extensible index registry"
```

---

### Task 3: Install postgres.js, update next.config.mjs

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1: Install postgres.js and tsx**
```bash
npm install postgres
npm install --save-dev tsx
```

- [ ] **Step 2: Rewrite next.config.mjs** — remove `node:sqlite` from serverComponentsExternalPackages

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 3: Commit**
```bash
git add next.config.mjs package.json package-lock.json
git commit -m "chore(db): install postgres.js + tsx; remove node:sqlite Next.js external"
```

---

### Task 4: Rewrite lib/db.ts

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: Rewrite lib/db.ts**

```typescript
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __memonicSql: postgres.Sql | undefined;
}

export function getDb(): postgres.Sql {
  if (!globalThis.__memonicSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    globalThis.__memonicSql = postgres(url, { max: 10 });
  }
  return globalThis.__memonicSql;
}

// All `id` fields are aliased PKs in SELECT queries (e.g. user_id AS id).
// BIGINT PKs come back as strings from postgres.js by default — kept as string
// to avoid breaking frontend components.

export type UserRow = {
  id: string;           // UUID, aliased from user_id
  email: string;
  password_hash: string;
  display_name: string;
  first_name: string | null;
  family_name: string | null;
  dob: string;
  photo: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  social_number: string | null;
  created_at: string;
};

export type PostRow = {
  id: string;           // BIGINT, aliased from post_id
  user_id: string;
  type: "text" | "image";
  body: string | null;
  image: string | null;
  created_at: string;
  client_locale: string | null;
  char_count: number | null;
  word_count: number | null;
  image_w: number | null;
  image_h: number | null;
  image_kb: number | null;
};

export type FeedItem = PostRow & {
  author_display_name: string;
  author_photo: string | null;
  author_city: string | null;
};

export type PersonEntry = {
  id: string;           // UUID, aliased from user_id
  display_name: string;
  city: string | null;
  country: string | null;
  photo: string | null;
};

export type FriendRequestRow = {
  id: string;           // BIGINT, aliased from request_id
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
};

export type FriendRequestWithSender = FriendRequestRow & {
  sender_display_name: string;
  sender_photo: string | null;
};

export type UserBlockRow = {
  id: string;           // BIGINT, aliased from block_id
  blocker_id: string;
  blocked_id: string;
  blocked_until: string;
  created_at: string;
};

export type NutritionLogRow = {
  id: string;           // BIGINT, aliased from log_id
  user_id: string;
  food_name: string;
  portion: string | null;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  source: string;
  log_date: string;
  logged_at: string;
};
```

- [ ] **Step 2: Verify db.ts compiles in isolation**
```bash
npx tsc --noEmit 2>&1 | grep "lib/db"
```
Expected: no errors for `lib/db.ts`.

- [ ] **Step 3: Commit**
```bash
git add lib/db.ts
git commit -m "feat(db): rewrite lib/db.ts with postgres.js singleton client"
```

---

### Task 5: Update app/feed/page.tsx (server component — 4 queries)

**Files:**
- Modify: `app/feed/page.tsx`

- [ ] **Step 1: Replace all 4 getDb() calls with postgres.js**

Replace the entire block from `const db = getDb();` through `const nutritionToday = ...` with:

```typescript
  const sql = getDb();

  const [meRow] = await sql<Pick<UserRow, "id"|"email"|"display_name"|"photo"|"bio"|"city"|"created_at">[]>`
    SELECT user_id AS id, email, display_name, photo, bio, city, created_at::text
    FROM users WHERE user_id = ${session.userId}::uuid
  `;
  if (!meRow) redirect("/");
  const me = meRow;

  const people = await sql<PersonEntry[]>`
    SELECT user_id AS id, display_name, city, country, photo
    FROM users
    WHERE user_id != ${session.userId}::uuid
      AND user_id NOT IN (
        SELECT blocked_id FROM user_blocks
        WHERE blocker_id = ${session.userId}::uuid AND blocked_until > now()
      )
      AND user_id NOT IN (
        SELECT CASE
          WHEN from_user_id = ${session.userId}::uuid THEN to_user_id
          ELSE from_user_id
        END
        FROM friend_requests
        WHERE status = 'accepted'
          AND (from_user_id = ${session.userId}::uuid OR to_user_id = ${session.userId}::uuid)
      )
      AND user_id NOT IN (
        SELECT to_user_id FROM friend_requests
        WHERE from_user_id = ${session.userId}::uuid AND status = 'pending'
      )
    ORDER BY RANDOM()
    LIMIT 10
  `;

  const posts = await sql<FeedItem[]>`
    SELECT
      p.post_id::text AS id, p.user_id::text, p.type, p.body, p.image,
      p.created_at::text, p.client_locale, p.char_count, p.word_count,
      p.image_w, p.image_h, p.image_kb,
      u.display_name AS author_display_name,
      u.photo        AS author_photo,
      u.city         AS author_city
    FROM posts p
    JOIN users u ON u.user_id = p.user_id
    WHERE p.user_id = ${session.userId}::uuid
       OR p.user_id IN (
         SELECT CASE
           WHEN from_user_id = ${session.userId}::uuid THEN to_user_id
           ELSE from_user_id
         END
         FROM friend_requests
         WHERE status = 'accepted'
           AND (from_user_id = ${session.userId}::uuid OR to_user_id = ${session.userId}::uuid)
       )
    ORDER BY p.created_at DESC
    LIMIT 100
  `;

  const today = new Date().toISOString().split("T")[0];
  const [nutritionToday] = await sql<{ total_cal: number; entry_count: number }[]>`
    SELECT
      COALESCE(SUM(calories), 0)::float AS total_cal,
      COUNT(*)::int AS entry_count
    FROM nutrition_logs
    WHERE user_id = ${session.userId}::uuid AND log_date = ${today}::date
  `;
```

Also update the import at the top — add `PersonEntry` to the import from `@/lib/db` and remove the `type PersonEntry` import from PeopleRail if it was imported there:

```typescript
import { getDb, type FeedItem, type UserRow, type PersonEntry } from "@/lib/db";
```

- [ ] **Step 2: Remove the duplicate PersonEntry type from PeopleRail.tsx import if present**
```bash
grep -n "PersonEntry" D:/Claude/BuildFrontEndAutomation/components/feed/PeopleRail.tsx | head -5
```
If `PeopleRail.tsx` exports its own `PersonEntry` type, the import in `feed/page.tsx` needs to use only one source. Use the one from `@/lib/db`.

- [ ] **Step 3: Verify TypeScript for this file**
```bash
npx tsc --noEmit 2>&1 | grep "feed/page"
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add app/feed/page.tsx lib/db.ts
git commit -m "feat(db): migrate feed page server queries to postgres.js"
```

---

### Task 6: Update app/nutrition/page.tsx (server component — 1 query)

**Files:**
- Modify: `app/nutrition/page.tsx`

- [ ] **Step 1: Replace getDb() call**

Replace `const db = getDb();` and the `.prepare(...).get(...)` call with:

```typescript
  const sql = getDb();
  const [meRow] = await sql<Pick<UserRow, "id"|"display_name">[]>`
    SELECT user_id AS id, display_name FROM users WHERE user_id = ${session.userId}::uuid
  `;
  if (!meRow) redirect("/home");
```

- [ ] **Step 2: Commit**
```bash
git add app/nutrition/page.tsx
git commit -m "feat(db): migrate nutrition page server query to postgres.js"
```

---

### Task 7: Update app/api/auth/signup/route.ts

**Files:**
- Modify: `app/api/auth/signup/route.ts`

- [ ] **Step 1: Rewrite signup route**

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { signupSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/password";
import { isOldEnough, computeAge, MIN_AGE } from "@/lib/age";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = signupSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const v = parsed.data;

  if (!isOldEnough(v.dob)) {
    const age = computeAge(v.dob);
    return NextResponse.json(
      { error: `You must be at least ${MIN_AGE} to join. We computed your age as ${age}.` },
      { status: 403 }
    );
  }

  const sql = getDb();

  const [emailExists] = await sql`
    SELECT user_id FROM users WHERE LOWER(email) = LOWER(${v.email})
  `;
  if (emailExists) {
    return NextResponse.json(
      { error: "An account already exists for that email." },
      { status: 409 }
    );
  }

  const [socialExists] = await sql`
    SELECT user_id FROM users
    WHERE country = ${v.country} AND social_number = ${v.socialNumber}
  `;
  if (socialExists) {
    return NextResponse.json(
      { error: "A Memonic account already exists for that country and social number." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(v.password);
  const displayName = `${v.firstName} ${v.familyName}`.trim();

  const [row] = await sql`
    INSERT INTO users
      (email, password_hash, display_name, first_name, family_name,
       dob, photo, country, social_number)
    VALUES
      (LOWER(${v.email}), ${passwordHash}, ${displayName},
       ${v.firstName}, ${v.familyName},
       ${v.dob}::date, ${v.photo ?? null}, ${v.country}, ${v.socialNumber})
    RETURNING user_id AS id
  `;

  await setSessionCookie(row.id);
  return NextResponse.json({ ok: true, userId: row.id });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/auth/signup/route.ts
git commit -m "feat(db): migrate signup route to postgres.js"
```

---

### Task 8: Update app/api/auth/login/route.ts

**Files:**
- Modify: `app/api/auth/login/route.ts`

- [ ] **Step 1: Rewrite login route**

```typescript
import { NextResponse } from "next/server";
import { getDb, type UserRow } from "@/lib/db";
import { loginSchema } from "@/lib/schemas";
import { verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const sql = getDb();
  const [row] = await sql<UserRow[]>`
    SELECT
      user_id AS id, email, password_hash, display_name, first_name, family_name,
      dob::text, photo, bio, city, country, social_number, created_at::text
    FROM users WHERE LOWER(email) = LOWER(${email})
  `;

  if (!row) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  await setSessionCookie(row.id);
  return NextResponse.json({ ok: true, userId: row.id });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/auth/login/route.ts
git commit -m "feat(db): migrate login route to postgres.js"
```

---

### Task 9: Update app/api/me/route.ts

**Files:**
- Modify: `app/api/me/route.ts`

- [ ] **Step 1: Rewrite me route**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  const sql = getDb();
  const [row] = await sql`
    SELECT user_id AS id, email, display_name, dob::text, photo, bio, city, created_at::text
    FROM users WHERE user_id = ${session.userId}::uuid
  `;

  if (!row) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: row });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/me/route.ts
git commit -m "feat(db): migrate me route to postgres.js"
```

---

### Task 10: Update app/api/posts/route.ts

**Files:**
- Modify: `app/api/posts/route.ts`

- [ ] **Step 1: Rewrite posts route**

```typescript
import { NextResponse } from "next/server";
import { getDb, type FeedItem } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { newPostSchema } from "@/lib/schemas";
import { wordCount } from "@/lib/format";

export const runtime = "nodejs";

const FEED_LIMIT = 100;
const MAX_IMAGE_BYTES = 800 * 1024;

const FEED_SELECT = `
  p.post_id::text AS id, p.user_id::text, p.type, p.body, p.image,
  p.created_at::text, p.client_locale, p.char_count, p.word_count,
  p.image_w, p.image_h, p.image_kb,
  u.display_name AS author_display_name,
  u.photo        AS author_photo,
  u.city         AS author_city
`;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sql = getDb();
  const posts = await sql<FeedItem[]>`
    SELECT ${sql.unsafe(FEED_SELECT)}
    FROM posts p
    JOIN users u ON u.user_id = p.user_id
    WHERE p.user_id = ${session.userId}::uuid
       OR p.user_id IN (
         SELECT CASE
           WHEN from_user_id = ${session.userId}::uuid THEN to_user_id
           ELSE from_user_id
         END
         FROM friend_requests
         WHERE status = 'accepted'
           AND (from_user_id = ${session.userId}::uuid OR to_user_id = ${session.userId}::uuid)
       )
    ORDER BY p.created_at DESC
    LIMIT ${FEED_LIMIT}
  `;

  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = newPostSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const v = parsed.data;

  if (v.type === "image" && v.image) {
    if (Math.floor(v.image.length * 0.75) > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large. Cap is 800 KB." }, { status: 413 });
    }
  }

  const sql = getDb();
  const body = v.body?.trim() || null;
  const charCount = body ? body.length : null;
  const wcount = body ? wordCount(body) : null;

  const [inserted] = await sql`
    INSERT INTO posts
      (user_id, type, body, image, client_locale, char_count, word_count, image_w, image_h, image_kb)
    VALUES
      (${session.userId}::uuid, ${v.type}, ${body},
       ${v.type === "image" ? (v.image ?? null) : null},
       ${v.clientLocale ?? null}, ${charCount}, ${wcount},
       ${v.imageW ?? null}, ${v.imageH ?? null}, ${v.imageKb ?? null})
    RETURNING post_id
  `;

  const [post] = await sql<FeedItem[]>`
    SELECT ${sql.unsafe(FEED_SELECT)}
    FROM posts p
    JOIN users u ON u.user_id = p.user_id
    WHERE p.post_id = ${inserted.post_id}
  `;

  return NextResponse.json({ post });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/posts/route.ts
git commit -m "feat(db): migrate posts route to postgres.js with friend-filtered feed"
```

---

### Task 11: Update app/api/posts/search/route.ts

**Files:**
- Modify: `app/api/posts/search/route.ts`

- [ ] **Step 1: Rewrite search route** — `ILIKE` replaces `LIKE ... COLLATE NOCASE`

```typescript
import { NextResponse } from "next/server";
import { getDb, type FeedItem } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ posts: [], q });

  const wildcard = `%${q}%`;
  const sql = getDb();

  const posts = await sql<FeedItem[]>`
    SELECT
      p.post_id::text AS id, p.user_id::text, p.type, p.body, p.image,
      p.created_at::text, p.client_locale, p.char_count, p.word_count,
      p.image_w, p.image_h, p.image_kb,
      u.display_name AS author_display_name,
      u.photo        AS author_photo,
      u.city         AS author_city
    FROM posts p
    JOIN users u ON u.user_id = p.user_id
    WHERE p.body ILIKE ${wildcard}
       OR u.display_name ILIKE ${wildcard}
       OR u.city ILIKE ${wildcard}
    ORDER BY p.created_at DESC
    LIMIT 100
  `;

  return NextResponse.json({ posts, q });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/posts/search/route.ts
git commit -m "feat(db): migrate search route to postgres.js (ILIKE)"
```

---

### Task 12: Update app/api/friends/request/route.ts

**Files:**
- Modify: `app/api/friends/request/route.ts`

- [ ] **Step 1: Rewrite friend request route**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { toUserId } = payload as { toUserId?: string };
  if (!toUserId || typeof toUserId !== "string") {
    return NextResponse.json({ error: "toUserId required" }, { status: 400 });
  }
  if (toUserId === session.userId) {
    return NextResponse.json({ error: "Cannot befriend yourself" }, { status: 400 });
  }

  const sql = getDb();

  const [target] = await sql`
    SELECT user_id FROM users WHERE user_id = ${toUserId}::uuid
  `;
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [blocked] = await sql`
    SELECT block_id FROM user_blocks
    WHERE blocker_id = ${toUserId}::uuid
      AND blocked_id = ${session.userId}::uuid
      AND blocked_until > now()
  `;
  if (blocked) return NextResponse.json({ error: "Cannot send request at this time" }, { status: 403 });

  const [existing] = await sql`
    SELECT request_id, status FROM friend_requests
    WHERE (from_user_id = ${session.userId}::uuid AND to_user_id = ${toUserId}::uuid)
       OR (from_user_id = ${toUserId}::uuid AND to_user_id = ${session.userId}::uuid)
  `;
  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "Already friends" }, { status: 409 });
    }
    if (existing.status === "pending") {
      return NextResponse.json({ error: "Request already pending" }, { status: 409 });
    }
  }

  const [row] = await sql`
    INSERT INTO friend_requests (from_user_id, to_user_id)
    VALUES (${session.userId}::uuid, ${toUserId}::uuid)
    RETURNING request_id::text AS id
  `;

  return NextResponse.json({ ok: true, requestId: row.id });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/friends/request/route.ts
git commit -m "feat(db): migrate friend request route to postgres.js"
```

---

### Task 13: Update app/api/friends/requests/route.ts

**Files:**
- Modify: `app/api/friends/requests/route.ts`

- [ ] **Step 1: Rewrite friend requests list route**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, type FriendRequestWithSender } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sql = getDb();
  const requests = await sql<FriendRequestWithSender[]>`
    SELECT
      fr.request_id::text AS id,
      fr.from_user_id::text, fr.to_user_id::text,
      fr.status, fr.created_at::text, fr.responded_at::text,
      u.display_name AS sender_display_name,
      u.photo        AS sender_photo
    FROM friend_requests fr
    JOIN users u ON u.user_id = fr.from_user_id
    WHERE fr.to_user_id = ${session.userId}::uuid AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `;

  return NextResponse.json({ requests });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/friends/requests/route.ts
git commit -m "feat(db): migrate friend requests list route to postgres.js"
```

---

### Task 14: Update app/api/friends/respond/route.ts

**Files:**
- Modify: `app/api/friends/respond/route.ts`

- [ ] **Step 1: Rewrite friend respond route**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { requestId, action } = payload as { requestId?: string; action?: string };
  if (!requestId || (action !== "accept" && action !== "decline")) {
    return NextResponse.json(
      { error: "requestId and action ('accept'|'decline') required" },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [request] = await sql`
    SELECT request_id, to_user_id::text, status FROM friend_requests
    WHERE request_id = ${Number(requestId)}
  `;

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.to_user_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "Request already resolved" }, { status: 409 });
  }

  const newStatus = action === "accept" ? "accepted" : "declined";
  await sql`
    UPDATE friend_requests
    SET status = ${newStatus}, responded_at = now()
    WHERE request_id = ${Number(requestId)}
  `;

  return NextResponse.json({ ok: true, status: newStatus });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/friends/respond/route.ts
git commit -m "feat(db): migrate friend respond route to postgres.js"
```

---

### Task 15: Update app/api/users/block/route.ts

**Files:**
- Modify: `app/api/users/block/route.ts`

- [ ] **Step 1: Rewrite block route** — uses `ON CONFLICT ... DO UPDATE` instead of SELECT+branch

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { userId: targetId } = payload as { userId?: string };
  if (!targetId || typeof targetId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (targetId === session.userId) {
    return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
  }

  const sql = getDb();
  const blockedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO user_blocks (blocker_id, blocked_id, blocked_until)
    VALUES (${session.userId}::uuid, ${targetId}::uuid, ${blockedUntil})
    ON CONFLICT (blocker_id, blocked_id)
    DO UPDATE SET blocked_until = EXCLUDED.blocked_until, created_at = now()
  `;

  await sql`
    DELETE FROM friend_requests
    WHERE (from_user_id = ${session.userId}::uuid AND to_user_id = ${targetId}::uuid)
       OR (from_user_id = ${targetId}::uuid AND to_user_id = ${session.userId}::uuid)
  `;

  return NextResponse.json({ ok: true, blockedUntil: blockedUntil.toISOString() });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/users/block/route.ts
git commit -m "feat(db): migrate block route to postgres.js (upsert via ON CONFLICT)"
```

---

### Task 16: Update app/api/nutrition/log/route.ts

**Files:**
- Modify: `app/api/nutrition/log/route.ts`

- [ ] **Step 1: Rewrite nutrition log route**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, type NutritionLogRow } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date")
    ?? new Date().toISOString().split("T")[0];

  const sql = getDb();
  const logs = await sql<NutritionLogRow[]>`
    SELECT
      log_id::text AS id, user_id::text, food_name, portion,
      calories::float, protein_g::float, carbs_g::float, fat_g::float,
      notes, source, log_date::text, logged_at::text
    FROM nutrition_logs
    WHERE user_id = ${session.userId}::uuid AND log_date = ${date}::date
    ORDER BY logged_at ASC
  `;

  return NextResponse.json({ logs });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const items = Array.isArray(body) ? body : [body];
  const sql = getDb();
  const logDate = new Date().toISOString().split("T")[0];
  const inserted: NutritionLogRow[] = [];

  for (const item of items) {
    const { food_name, portion, calories, protein_g, carbs_g, fat_g, notes, source } =
      item as Record<string, unknown>;

    if (typeof food_name !== "string" || !food_name.trim()) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }
    if (typeof calories !== "number" || isNaN(calories)) {
      return NextResponse.json({ error: "calories must be a number" }, { status: 400 });
    }

    const validSource =
      typeof source === "string" && ["text","image","quick","manual"].includes(source)
        ? source : "text";

    const [row] = await sql<NutritionLogRow[]>`
      INSERT INTO nutrition_logs
        (user_id, food_name, portion, calories, protein_g, carbs_g, fat_g, notes, source, log_date)
      VALUES
        (${session.userId}::uuid, ${food_name.trim()},
         ${typeof portion === "string" ? portion : null},
         ${calories},
         ${typeof protein_g === "number" ? protein_g : null},
         ${typeof carbs_g === "number" ? carbs_g : null},
         ${typeof fat_g === "number" ? fat_g : null},
         ${typeof notes === "string" ? notes : null},
         ${validSource}, ${logDate}::date)
      RETURNING
        log_id::text AS id, user_id::text, food_name, portion,
        calories::float, protein_g::float, carbs_g::float, fat_g::float,
        notes, source, log_date::text, logged_at::text
    `;
    inserted.push(row);
  }

  return NextResponse.json({ logs: inserted }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const entryId = new URL(req.url).searchParams.get("id");
  if (!entryId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sql = getDb();
  await sql`
    DELETE FROM nutrition_logs
    WHERE log_id = ${Number(entryId)} AND user_id = ${session.userId}::uuid
  `;

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/nutrition/log/route.ts
git commit -m "feat(db): migrate nutrition log route to postgres.js"
```

---

### Task 17: Verify nutrition/text and nutrition/image routes need no changes

**Files:** none (verification only)

- [ ] **Step 1: Confirm these routes do not call getDb()**
```bash
grep "getDb" app/api/nutrition/text/route.ts app/api/nutrition/image/route.ts
```
Expected: no matches. Both routes call Gemini API and return estimates; persisting to DB is done by the client calling `/api/nutrition/log`.

If `getDb()` is found: apply the same async postgres.js pattern used in Task 16.

---

### Task 18: Remove lib/cuid.ts dependency (IDs now generated by DB)

**Files:**
- Modify: `lib/cuid.ts` (keep file, mark deprecated so nanoid import doesn't break the build)

- [ ] **Step 1: Check if any remaining files import id() from lib/cuid**
```bash
grep -rn "from.*cuid\|lib/cuid" app/ lib/ components/ --include="*.ts" --include="*.tsx"
```
Expected after Tasks 7–16: no matches (all route files now use DB-generated IDs).

If matches remain: remove the `id()` calls from those files, using `RETURNING` in the INSERT instead.

- [ ] **Step 2: Once all callers are gone, delete lib/cuid.ts**
```bash
git rm lib/cuid.ts
```

- [ ] **Step 3: Commit**
```bash
git commit -m "chore: remove lib/cuid.ts — IDs generated by PostgreSQL"
```

---

### Task 19: Write and run the data migration script

**Files:**
- Create: `scripts/migrate-sqlite-to-pg.ts`

- [ ] **Step 1: Create scripts/migrate-sqlite-to-pg.ts**

```typescript
// Run: DATABASE_URL="postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" npx tsx scripts/migrate-sqlite-to-pg.ts
import { DatabaseSync } from "node:sqlite";
import postgres from "postgres";
import { join } from "path";
import { randomUUID } from "crypto";

const SQLITE_PATH = join(process.cwd(), "data", "memonic.db");
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const sqlite = new DatabaseSync(SQLITE_PATH);
const pg = postgres(DATABASE_URL, { max: 1 });

type AnyRow = Record<string, unknown>;

async function main() {
  console.log("Starting migration SQLite → PostgreSQL\n");

  // ── users ──────────────────────────────────────────────────────────────
  const sqliteUsers = sqlite.prepare(
    "SELECT * FROM users ORDER BY created_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqliteUsers.length} users...`);

  const idMap = new Map<string, string>(); // old nanoid TEXT → new UUID

  for (const u of sqliteUsers) {
    const newUuid = randomUUID();
    idMap.set(u.id as string, newUuid);

    await pg`
      INSERT INTO users
        (user_id, email, password_hash, display_name, first_name, family_name,
         dob, photo, bio, city, country, social_number, created_at)
      VALUES (
        ${newUuid}::uuid,
        ${u.email as string},
        ${u.password_hash as string},
        ${u.display_name as string},
        ${(u.first_name as string | null) ?? null},
        ${(u.family_name as string | null) ?? null},
        ${(u.dob as string)}::date,
        ${(u.photo as string | null) ?? null},
        ${(u.bio as string | null) ?? null},
        ${(u.city as string | null) ?? null},
        ${(u.country as string | null) ?? null},
        ${(u.social_number as string | null) ?? null},
        ${(u.created_at as string)}::timestamptz
      )
      ON CONFLICT (user_id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${sqliteUsers.length} users`);

  // ── posts ──────────────────────────────────────────────────────────────
  const sqlitePosts = sqlite.prepare(
    "SELECT * FROM posts ORDER BY created_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqlitePosts.length} posts...`);

  let skippedPosts = 0;
  for (const p of sqlitePosts) {
    const uid = idMap.get(p.user_id as string);
    if (!uid) { skippedPosts++; continue; }

    await pg`
      INSERT INTO posts
        (user_id, type, body, image, created_at, client_locale,
         char_count, word_count, image_w, image_h, image_kb)
      VALUES (
        ${uid}::uuid, ${p.type as string},
        ${(p.body as string | null) ?? null},
        ${(p.image as string | null) ?? null},
        ${(p.created_at as string)}::timestamptz,
        ${(p.client_locale as string | null) ?? null},
        ${(p.char_count as number | null) ?? null},
        ${(p.word_count as number | null) ?? null},
        ${(p.image_w as number | null) ?? null},
        ${(p.image_h as number | null) ?? null},
        ${(p.image_kb as number | null) ?? null}
      )
    `;
  }
  console.log(`  ✓ ${sqlitePosts.length - skippedPosts} posts (${skippedPosts} skipped — missing user)`);

  // ── nutrition_logs ─────────────────────────────────────────────────────
  const sqliteNutrition = sqlite.prepare(
    "SELECT * FROM nutrition_logs ORDER BY logged_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqliteNutrition.length} nutrition logs...`);

  let skippedNutrition = 0;
  for (const n of sqliteNutrition) {
    const uid = idMap.get(n.user_id as string);
    if (!uid) { skippedNutrition++; continue; }

    const rawSource = n.source as string ?? "text";
    const source = ["text","image","quick","manual"].includes(rawSource) ? rawSource : "text";

    await pg`
      INSERT INTO nutrition_logs
        (user_id, food_name, portion, calories, protein_g, carbs_g, fat_g,
         notes, source, log_date, logged_at)
      VALUES (
        ${uid}::uuid,
        ${n.food_name as string},
        ${(n.portion as string | null) ?? null},
        ${n.calories as number},
        ${(n.protein_g as number | null) ?? null},
        ${(n.carbs_g as number | null) ?? null},
        ${(n.fat_g as number | null) ?? null},
        ${(n.notes as string | null) ?? null},
        ${source},
        ${(n.log_date as string)}::date,
        ${(n.logged_at as string)}::timestamptz
      )
    `;
  }
  console.log(`  ✓ ${sqliteNutrition.length - skippedNutrition} nutrition logs`);

  // ── friend_requests ────────────────────────────────────────────────────
  const sqliteFR = sqlite.prepare(
    "SELECT * FROM friend_requests ORDER BY created_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqliteFR.length} friend requests...`);

  let skippedFR = 0;
  for (const fr of sqliteFR) {
    const from = idMap.get(fr.from_user_id as string);
    const to   = idMap.get(fr.to_user_id as string);
    if (!from || !to) { skippedFR++; continue; }

    const respondedAt = (fr.responded_at as string | null) ?? null;

    await pg`
      INSERT INTO friend_requests
        (from_user_id, to_user_id, status, created_at, responded_at)
      VALUES (
        ${from}::uuid, ${to}::uuid,
        ${fr.status as string},
        ${(fr.created_at as string)}::timestamptz,
        ${respondedAt ? pg`${respondedAt}::timestamptz` : null}
      )
      ON CONFLICT (from_user_id, to_user_id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${sqliteFR.length - skippedFR} friend requests`);

  // ── user_blocks ────────────────────────────────────────────────────────
  const sqliteBlocks = sqlite.prepare(
    "SELECT * FROM user_blocks ORDER BY created_at ASC"
  ).all() as AnyRow[];
  console.log(`Migrating ${sqliteBlocks.length} blocks...`);

  let skippedBlocks = 0;
  for (const b of sqliteBlocks) {
    const blocker = idMap.get(b.blocker_id as string);
    const blocked = idMap.get(b.blocked_id as string);
    if (!blocker || !blocked) { skippedBlocks++; continue; }

    await pg`
      INSERT INTO user_blocks (blocker_id, blocked_id, blocked_until, created_at)
      VALUES (
        ${blocker}::uuid, ${blocked}::uuid,
        ${(b.blocked_until as string)}::timestamptz,
        ${(b.created_at as string)}::timestamptz
      )
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${sqliteBlocks.length - skippedBlocks} blocks`);

  await pg.end();
  console.log("\n✅ Migration complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the migration**
```bash
DATABASE_URL="postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" npx tsx scripts/migrate-sqlite-to-pg.ts
```
Expected:
```
Starting migration SQLite → PostgreSQL
Migrating N users...
  ✓ N users
Migrating N posts...
  ✓ N posts (0 skipped — missing user)
...
✅ Migration complete.
```

- [ ] **Step 3: Verify row counts match SQLite**
```bash
psql "postgresql://memonic_app:memonic_dev_pw@localhost:5432/memonic" -c "
  SELECT 'users'           AS tbl, COUNT(*) FROM users
  UNION ALL SELECT 'posts',         COUNT(*) FROM posts
  UNION ALL SELECT 'nutrition_logs',COUNT(*) FROM nutrition_logs
  UNION ALL SELECT 'friend_requests',COUNT(*) FROM friend_requests
  UNION ALL SELECT 'user_blocks',   COUNT(*) FROM user_blocks;
"
```
Compare against SQLite:
```bash
sqlite3 data/memonic.db "
  SELECT 'users', COUNT(*) FROM users;
  SELECT 'posts', COUNT(*) FROM posts;
  SELECT 'nutrition_logs', COUNT(*) FROM nutrition_logs;
  SELECT 'friend_requests', COUNT(*) FROM friend_requests;
  SELECT 'user_blocks', COUNT(*) FROM user_blocks;
"
```

- [ ] **Step 4: Commit**
```bash
git add scripts/migrate-sqlite-to-pg.ts
git commit -m "feat(db): SQLite→PostgreSQL migration script with UUID user ID mapping"
```

---

### Task 20: Full build verification and smoke test

- [ ] **Step 1: Type-check the entire project**
```bash
npx tsc --noEmit 2>&1
```
Expected: 0 errors.

- [ ] **Step 2: Build check**
```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds with no errors.

- [ ] **Step 3: Start dev server**
```bash
npm run dev
```
Expected: server starts on http://localhost:3000 without errors.

- [ ] **Step 4: Smoke test — login**
Open http://localhost:3000/home.
Log in with a migrated test account (password: `Test1234!`).
Expected: redirects to `/feed`, posts visible.

- [ ] **Step 5: Smoke test — create a post**
Type a post in the Composer and submit.
Expected: post appears in feed immediately.

- [ ] **Step 6: Smoke test — nutrition page**
Navigate to `/nutrition`, log a food entry via quick-add.
Expected: entry appears in today's log, daily stats update.

- [ ] **Step 7: Final commit**
```bash
git add -A
git commit -m "feat: complete SQLite→PostgreSQL migration — postgres.js, UUID users, BIGINT entities"
```

---

## Files changed summary

| File | Action |
|---|---|
| `scripts/schema.sql` | CREATE — core 5 tables |
| `scripts/schema-graph.sql` | CREATE — probabilistic graph layer (8 tables) |
| `scripts/migrate-sqlite-to-pg.ts` | CREATE |
| `lib/db.ts` | REWRITE |
| `lib/cuid.ts` | DELETE (after all callers removed) |
| `next.config.mjs` | MODIFY (remove node:sqlite external) |
| `app/feed/page.tsx` | MODIFY (4 queries) |
| `app/nutrition/page.tsx` | MODIFY (1 query) |
| `app/api/auth/signup/route.ts` | MODIFY |
| `app/api/auth/login/route.ts` | MODIFY |
| `app/api/me/route.ts` | MODIFY |
| `app/api/posts/route.ts` | MODIFY |
| `app/api/posts/search/route.ts` | MODIFY |
| `app/api/friends/request/route.ts` | MODIFY |
| `app/api/friends/requests/route.ts` | MODIFY |
| `app/api/friends/respond/route.ts` | MODIFY |
| `app/api/users/block/route.ts` | MODIFY |
| `app/api/nutrition/log/route.ts` | MODIFY |
