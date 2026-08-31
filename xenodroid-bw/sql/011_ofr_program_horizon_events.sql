-- OFR-07: waiver & grant horizon watch, state-neutral (KY + FL).
-- Two source lanes, each explicitly labeled:
--   CMS_1115_DEMO  - Medicaid.gov Section 1115 demonstration pages (KY TEAMKY,
--                    FL MMA): expiration + recently posted milestone documents.
--                    CMS publishes no structured API for this; the page itself
--                    is the source of record, cited by source_document_uri.
--   GRANTS_GOV     - Grants.gov search2 API, live, filtered to the OFR-01
--                    assistance-listing set. National in scope (not
--                    KY/FL-specific eligibility-verified) — attached to both
--                    states with scope='national', never presented as
--                    state-targeted.
-- No renewal outcome is ever predicted: every row is a published date and
-- status, never a forecast.

CREATE TABLE IF NOT EXISTS bw_dso.dso_program_horizon_event (
  event_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('waiver_expiration','waiver_milestone','nofo_opportunity')),
  scope TEXT NOT NULL CHECK (scope IN ('state','national')),
  program TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_date_kind TEXT NOT NULL CHECK (event_date_kind IN ('approval','effective','expiration','document_posted','open_date','close_date')),
  status TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  source_document_uri TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (event_id, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_program_horizon_event_state_idx
  ON bw_dso.dso_program_horizon_event (state_code, load_class);

CREATE INDEX IF NOT EXISTS dso_program_horizon_event_date_idx
  ON bw_dso.dso_program_horizon_event (event_date, load_class);

CREATE TABLE IF NOT EXISTS bw_cube.cube_program_horizon_metric (
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
