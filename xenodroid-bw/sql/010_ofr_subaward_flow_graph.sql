-- OFR-06: federal sub-award flow graph, state-neutral (KY + FL).
-- Built entirely from the OFR-01 prime-award universe (dso_federal_award)
-- and USAspending's subawards API — no new FromSysID (still USA_SPENDING).

CREATE TABLE IF NOT EXISTS bw_dso.dso_federal_subaward (
  subaward_id TEXT NOT NULL,
  prime_award_key TEXT NOT NULL,
  state_code TEXT NOT NULL,
  assistance_listing TEXT NOT NULL,
  prime_recipient_name TEXT NOT NULL DEFAULT '',
  sub_recipient_name TEXT NOT NULL DEFAULT '',
  sub_award_number TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  action_date DATE,
  amount NUMERIC,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (subaward_id, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_federal_subaward_state_idx
  ON bw_dso.dso_federal_subaward (state_code, load_class);

-- One row per funder->recipient×period edge, per the plan's funding_edge
-- object. identity_confidence is never silently upgraded: an edge whose
-- sub-recipient name does not exactly match an OFR-02 identity record stays
-- 'unresolved', explicitly labeled, never joined as if it were confirmed.
CREATE TABLE IF NOT EXISTS bw_dso.dso_funding_edge (
  edge_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  source_org TEXT NOT NULL,
  recipient_org TEXT NOT NULL,
  amount NUMERIC,
  action_date DATE,
  assistance_listing TEXT NOT NULL,
  identity_confidence TEXT NOT NULL CHECK (identity_confidence IN ('exact-derived','unresolved')),
  recipient_ein TEXT,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (edge_id, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_funding_edge_state_idx
  ON bw_dso.dso_funding_edge (state_code, load_class);

CREATE TABLE IF NOT EXISTS bw_cube.cube_subaward_metric (
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
