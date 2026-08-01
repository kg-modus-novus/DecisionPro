-- XenoDroid BW LSA control + detail + cube schemas (DecisionPro POC)

CREATE SCHEMA IF NOT EXISTS bw_ctl;
CREATE SCHEMA IF NOT EXISTS bw_psa_meta;
CREATE SCHEMA IF NOT EXISTS bw_stg;
CREATE SCHEMA IF NOT EXISTS bw_dso;
CREATE SCHEMA IF NOT EXISTS bw_cube;

CREATE TABLE IF NOT EXISTS bw_ctl.source_system (
  from_sys_id TEXT PRIMARY KEY,
  publisher TEXT NOT NULL,
  tos_grade TEXT NOT NULL CHECK (tos_grade IN ('SAFE','ATTRIBUTABLE','RESTRICTED','OUT_OF_POC','UNKNOWN')),
  base_uri TEXT NOT NULL,
  attribution_notes TEXT NOT NULL DEFAULT '',
  paid_follow_on_todo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS bw_ctl.measure (
  measure_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  unit TEXT NOT NULL,
  grain TEXT NOT NULL,
  provisional_flag BOOLEAN NOT NULL DEFAULT TRUE,
  suppression_policy TEXT NOT NULL DEFAULT 'follow-source'
);

CREATE TABLE IF NOT EXISTS bw_ctl.measure_source (
  measure_id TEXT NOT NULL REFERENCES bw_ctl.measure(measure_id),
  from_sys_id TEXT NOT NULL REFERENCES bw_ctl.source_system(from_sys_id),
  PRIMARY KEY (measure_id, from_sys_id)
);

CREATE TABLE IF NOT EXISTS bw_ctl.data_request (
  data_request_id TEXT PRIMARY KEY,
  from_sys_id TEXT NOT NULL REFERENCES bw_ctl.source_system(from_sys_id),
  target_psa_prefix TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS bw_ctl.load_history (
  load_history_id TEXT PRIMARY KEY,
  data_request_id TEXT NOT NULL REFERENCES bw_ctl.data_request(data_request_id),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  source_uri TEXT NOT NULL DEFAULT '',
  as_of_date DATE,
  row_count INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCEEDED','FAILED','PURGED')),
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS bw_psa_meta.object_index (
  object_key TEXT PRIMARY KEY,
  from_sys_id TEXT NOT NULL,
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  content_hash TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  landed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_enrollment_state (
  state_code TEXT NOT NULL,
  period_ym TEXT NOT NULL,
  medicaid_enrollment NUMERIC,
  chip_enrollment NUMERIC,
  total_enrollment NUMERIC,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (state_code, period_ym, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_enrollment_state_load_class_idx
  ON bw_dso.dso_enrollment_state (load_class);

CREATE TABLE IF NOT EXISTS bw_dso.dso_mco_roster (
  mco_key TEXT NOT NULL,
  mco_label TEXT NOT NULL,
  status TEXT NOT NULL,
  effective_date DATE,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (mco_key, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_mco_roster_load_class_idx
  ON bw_dso.dso_mco_roster (load_class);

CREATE TABLE IF NOT EXISTS bw_cube.cube_exec_landing (
  measure_id TEXT NOT NULL,
  display_value TEXT NOT NULL,
  numeric_value NUMERIC,
  unit TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (measure_id, as_of_date, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS cube_exec_landing_load_class_idx
  ON bw_cube.cube_exec_landing (load_class);
