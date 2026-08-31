-- OFR-02: identity crosswalk spine, state-neutral (KY + FL).
--
-- Design note (grounding correction, recorded 2026-08-31 after live API
-- verification): no accessible public source publishes a UEI+EIN pair, or
-- any other cross-identifier pair, together in one record.
--   - SAM.gov Entity Management API (even with the Director-provisioned key)
--     does not expose EIN/TIN — that field requires FOUO access not granted
--     to this key's tier. Verified live: a full-section entity lookup for a
--     known UEI returned entityRegistration/coreData/assertions with no
--     ein/tin/taxIdentification field anywhere in the response.
--   - USAspending recipient records (award-grain and recipient-profile
--     endpoints) also do not expose EIN.
-- The one genuine same-record ("exact-published") cross-identifier fact
-- available is NPPES: an organizational NPI record can carry an embedded
-- state Medicaid provider identifier in its `identifiers[]` array (code
-- '05'). Every other cross-source link in this spine is therefore computed
-- from name/address matching across single-source identity records and is
-- classified 'exact-derived' (exact normalized name+address match) or
-- 'inferred' (fuzzy name match only) — never 'exact-published'.

-- Single-source identity facts, one row per source record.
CREATE TABLE IF NOT EXISTS bw_dso.dso_identity_record (
  source_row_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('UEI','EIN','NPI','CCN')),
  identifier_value TEXT NOT NULL,
  org_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  address_line1 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  extra_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (source_row_id, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_identity_record_match_idx
  ON bw_dso.dso_identity_record (state_code, normalized_name, load_class);

CREATE INDEX IF NOT EXISTS dso_identity_record_type_idx
  ON bw_dso.dso_identity_record (identifier_type, identifier_value, load_class);

-- Exact assertions: 'exact-published' (same-record fact, e.g. NPPES
-- NPI+state-Medicaid-ID) or 'exact-derived' (deterministic name+address
-- match across two independently published records). Never 'inferred' —
-- enforced structurally, not just by convention.
CREATE TABLE IF NOT EXISTS bw_ctl.organization_crosswalk_exact (
  assertion_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  match_method TEXT NOT NULL CHECK (match_method IN ('exact-published','exact-derived')),
  left_identifier_type TEXT NOT NULL,
  left_identifier_value TEXT NOT NULL,
  right_identifier_type TEXT NOT NULL,
  right_identifier_value TEXT NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0.85 AND confidence <= 1.0),
  evidence_citation TEXT NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'unvalidated' CHECK (validation_status IN ('unvalidated','sample-verified')),
  from_sys_ids TEXT[] NOT NULL DEFAULT '{}',
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (assertion_id, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS organization_crosswalk_exact_state_idx
  ON bw_ctl.organization_crosswalk_exact (state_code, load_class);

-- Inferred assertions: a strictly separate collection, never joined onto a
-- REAL presentation path as confirmed identity. match_method is always
-- 'inferred' — a CHECK constraint, not just an export-time filter.
CREATE TABLE IF NOT EXISTS bw_ctl.organization_crosswalk_inferred (
  assertion_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  match_method TEXT NOT NULL CHECK (match_method = 'inferred'),
  left_identifier_type TEXT NOT NULL,
  left_identifier_value TEXT NOT NULL,
  right_identifier_type TEXT NOT NULL,
  right_identifier_value TEXT NOT NULL,
  -- Confidence is the raw computed name-similarity score (0..1) — it is not
  -- artificially capped below the exact-assertion floor. Method
  -- classification (inferred vs exact-derived) is decided by whether an
  -- independent address/ZIP match corroborated the name match, not by a
  -- confidence-value threshold, so a high-similarity inferred row is
  -- expected and legitimate: it means the name matched closely but no
  -- second identifier confirmed it.
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1.0),
  evidence_citation TEXT NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'unvalidated' CHECK (validation_status IN ('unvalidated','sample-verified')),
  from_sys_ids TEXT[] NOT NULL DEFAULT '{}',
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (assertion_id, load_class, load_history_id)
);

ALTER TABLE bw_ctl.organization_crosswalk_inferred DROP CONSTRAINT IF EXISTS organization_crosswalk_inferred_confidence_check;
ALTER TABLE bw_ctl.organization_crosswalk_inferred ADD CONSTRAINT organization_crosswalk_inferred_confidence_check CHECK (confidence >= 0 AND confidence <= 1.0);

CREATE INDEX IF NOT EXISTS organization_crosswalk_inferred_state_idx
  ON bw_ctl.organization_crosswalk_inferred (state_code, load_class);

-- SAM.gov vs USAspending recipient-name corroboration queue. Never silently
-- resolved: every disagreement stays 'open' until a human reviewer closes it
-- (no automated resolution path exists in this package).
CREATE TABLE IF NOT EXISTS bw_ctl.organization_crosswalk_disagreement (
  disagreement_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  uei TEXT NOT NULL,
  sam_name TEXT NOT NULL,
  usaspending_name TEXT NOT NULL,
  similarity_score NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed')),
  from_sys_ids TEXT[] NOT NULL DEFAULT '{}',
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (disagreement_id, load_class, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_cube.cube_crosswalk_metric (
  metric_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  numeric_value NUMERIC,
  display_value TEXT NOT NULL,
  unit TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (metric_id, state_code, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS cube_crosswalk_metric_state_idx
  ON bw_cube.cube_crosswalk_metric (state_code, load_class, as_of_date);
