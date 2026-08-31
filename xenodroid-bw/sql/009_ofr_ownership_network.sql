-- OFR-05: CMS ownership & control network, state-neutral (KY + FL).
--
-- Hard privacy boundary: CMS's "All Owners" PUFs carry person-level fields
-- for individual owners (first/middle/last name, personal address). None of
-- those columns are read into any table here — only organization-level
-- owner facts (organization name, role, percentage, entity-type flags,
-- association date) and an owner_type flag distinguishing individual vs
-- organization WITHOUT the individual's identity. The full raw publisher
-- file is retained in PSA with a content hash for audit, per the
-- person-level gate's PSA-retention allowance.

CREATE TABLE IF NOT EXISTS bw_dso.dso_ownership_interest (
  ccn TEXT NOT NULL,
  facility_type TEXT NOT NULL CHECK (facility_type IN ('hospital','snf')),
  state_code TEXT NOT NULL,
  facility_name TEXT NOT NULL DEFAULT '',
  owner_type TEXT NOT NULL CHECK (owner_type IN ('individual','organization')),
  owner_organization_name TEXT NOT NULL DEFAULT '',
  role_text TEXT NOT NULL DEFAULT '',
  percentage_ownership TEXT NOT NULL DEFAULT '',
  association_date DATE,
  entity_type_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (ccn, facility_type, owner_organization_name, role_text, association_date, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_ownership_interest_state_idx
  ON bw_dso.dso_ownership_interest (state_code, load_class);

CREATE INDEX IF NOT EXISTS dso_ownership_interest_owner_org_idx
  ON bw_dso.dso_ownership_interest (owner_organization_name, load_class) WHERE owner_type = 'organization';

CREATE TABLE IF NOT EXISTS bw_dso.dso_ownership_chain_rollup (
  state_code TEXT NOT NULL,
  owner_organization_name TEXT NOT NULL,
  facility_count NUMERIC NOT NULL DEFAULT 0,
  total_beds NUMERIC,
  avg_total_margin NUMERIC,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (state_code, owner_organization_name, load_class, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_cube.cube_ownership_metric (
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
