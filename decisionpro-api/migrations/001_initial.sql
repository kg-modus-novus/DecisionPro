-- decisionpro-api initial schema. ADR-001: T1 A1 L1 R1, tenancy P1 (owner_account_id).
-- Rules (CodeXen canon, "The database performs no business writes"):
--   every foreign key is ON DELETE RESTRICT ON UPDATE RESTRICT;
--   no triggers, no rules, no cascades, no SET NULL / SET DEFAULT.
-- Table names are singular (CodeXen naming). "user" is reserved, so the session table is user_session.

-- Business object Account, owner AccountOwner (src/domain/Account.mjs).
CREATE TABLE account (
  account_id        text PRIMARY KEY,                 -- google:<sub> | apple:<sub>
  provider          text NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_subject  text NOT NULL,
  display_email     text NOT NULL DEFAULT '',          -- shown only to its owner
  account_status    text NOT NULL CHECK (account_status IN ('active')),
  registered_at     timestamptz NOT NULL,
  last_signed_in_at timestamptz NOT NULL,
  sign_in_count     integer NOT NULL DEFAULT 0 CHECK (sign_in_count >= 0),
  UNIQUE (provider, provider_subject)
);

-- D2: sessions (src/platform/sessions.mjs). Lifetime 12 hours (ADR-001 Decision 3 / Identity).
CREATE TABLE user_session (
  session_id     text PRIMARY KEY,                     -- SHA-256 (base64url) of the cookie token; the token itself is never stored
  account_id     text NOT NULL REFERENCES account (account_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  session_status text NOT NULL CHECK (session_status IN ('active', 'ended')),
  created_at     timestamptz NOT NULL,
  expires_at     timestamptz NOT NULL,
  ended_at       timestamptz                           -- null until the session is ended (sign-out or a new sign-in)
);
CREATE INDEX user_session_account_idx ON user_session (account_id);

-- D2: enqueue lock table (src/platform/enqueue.mjs), ADR-001 Decision 3 (L1) and Decision 4 (R1).
CREATE TABLE enqueue_lock (
  lock_key     text PRIMARY KEY,                       -- '<owner_scope>|<lock_object>'
  owner_scope  text NOT NULL,                          -- account id, or COMMITTEE later
  lock_object  text NOT NULL,                          -- TARGET_SET today
  session_id   text NOT NULL REFERENCES user_session (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  acquired_at  timestamptz NOT NULL
);

-- Business object MeasureTarget, owner MeasureTargetOwner (src/domain/MeasureTarget.mjs).
-- Identity (owner_account_id, measure_id). owner_account_id is the P1 tenant key; it holds an
-- account id now and, later, the scope COMMITTEE (ADR-001 Tenancy), so it carries no foreign key
-- to account. There is no delete: retiring is a state.
CREATE TABLE measure_target (
  owner_account_id text NOT NULL,
  measure_id       text NOT NULL,
  target_value     double precision NOT NULL,
  target_unit      text NOT NULL,
  better_direction text NOT NULL DEFAULT '' CHECK (better_direction IN ('', 'higher', 'lower')),
  target_note      text NOT NULL DEFAULT '' CHECK (char_length(target_note) <= 500),
  effective_date   text NOT NULL CHECK (char_length(effective_date) = 10),   -- YYYY-MM-DD
  target_status    text NOT NULL CHECK (target_status IN ('active', 'retired')),
  target_revision  integer NOT NULL CHECK (target_revision >= 1),
  updated_at       timestamptz NOT NULL,
  PRIMARY KEY (owner_account_id, measure_id)
);

-- MeasureTarget's own log: every revision, written only by MeasureTargetOwner.
CREATE TABLE measure_target_revision (
  owner_account_id text NOT NULL,
  measure_id       text NOT NULL,
  target_revision  integer NOT NULL CHECK (target_revision >= 1),
  target_value     double precision NOT NULL,
  target_unit      text NOT NULL,
  better_direction text NOT NULL DEFAULT '',
  target_note      text NOT NULL DEFAULT '',
  effective_date   text NOT NULL CHECK (char_length(effective_date) = 10),   -- YYYY-MM-DD
  target_status    text NOT NULL CHECK (target_status IN ('active', 'retired')),
  recorded_at      timestamptz NOT NULL,
  PRIMARY KEY (owner_account_id, measure_id, target_revision),
  FOREIGN KEY (owner_account_id, measure_id)
    REFERENCES measure_target (owner_account_id, measure_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- D2: operation ledger (src/platform/operationLedger.mjs), ADR-001 Decision 4 (R1).
-- No operation kinds exist yet; each new kind is added to ADR-001 with its attempt cap.
CREATE TABLE operation_ledger (
  operation_id     text PRIMARY KEY,
  operation_kind   text NOT NULL,
  owner_account_id text NOT NULL,
  operation_status text NOT NULL CHECK (operation_status IN ('queued', 'running', 'succeeded', 'failed')),
  attempts         integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts     integer NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  payload          text NOT NULL DEFAULT '{}',
  failure_reason   text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL
);
CREATE INDEX operation_ledger_status_idx ON operation_ledger (operation_status);
