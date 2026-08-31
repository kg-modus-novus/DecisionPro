-- OFR-01: USAspending award/recipient grain, state-neutral (KY + FL).
-- Additive only — does not alter dso_federal_award_context (fiscal-year
-- aggregate grain from the pre-OFR Kentucky-only adapter).

CREATE TABLE IF NOT EXISTS bw_dso.dso_federal_award (
  award_key TEXT NOT NULL,
  state_code TEXT NOT NULL,
  assistance_listing TEXT NOT NULL,
  award_id_display TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_uei TEXT NOT NULL DEFAULT '',
  recipient_id TEXT NOT NULL DEFAULT '',
  award_amount NUMERIC,
  total_outlays NUMERIC,
  period_of_performance_start DATE,
  period_of_performance_end DATE,
  awarding_agency TEXT NOT NULL DEFAULT '',
  awarding_sub_agency TEXT NOT NULL DEFAULT '',
  funding_agency TEXT NOT NULL DEFAULT '',
  location_filter TEXT NOT NULL CHECK (location_filter IN ('place_of_performance', 'recipient_location')),
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (award_key, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_federal_award_state_listing_idx
  ON bw_dso.dso_federal_award (state_code, assistance_listing, load_class);

CREATE INDEX IF NOT EXISTS dso_federal_award_pop_end_idx
  ON bw_dso.dso_federal_award (period_of_performance_end, load_class);

CREATE TABLE IF NOT EXISTS bw_cube.cube_federal_award_metric (
  metric_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  numeric_value NUMERIC,
  display_value TEXT NOT NULL,
  unit TEXT NOT NULL,
  source_status TEXT NOT NULL CHECK (source_status IN ('API_LOADED','FAILED')),
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (metric_id, state_code, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS cube_federal_award_metric_state_idx
  ON bw_cube.cube_federal_award_metric (state_code, load_class, as_of_date);
