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
