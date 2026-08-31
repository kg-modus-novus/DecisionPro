-- OFR-04: CMS HCRIS Hospital + SNF cost-report facility financial distress,
-- state-neutral (KY + FL).
--
-- Design note: every value here is Medicare-cost-report basis (from the
-- annual HCRIS filing), not Medicaid payment truth or a total-payer
-- financial statement — labeled at point of use, per the basis-labeling
-- gate. Florida's own AHCA hospital-financial KPI export (F-14,
-- GAP-FL-F-14-PARAMETERS) remains parameter-blocked at the publisher; this
-- table is an explicitly labeled federal fallback layer alongside that gap,
-- not a silent replacement for it.

CREATE TABLE IF NOT EXISTS bw_dso.dso_facility_cost_report (
  ccn TEXT NOT NULL,
  facility_type TEXT NOT NULL CHECK (facility_type IN ('hospital','snf')),
  report_year TEXT NOT NULL,
  facility_name TEXT NOT NULL DEFAULT '',
  state_code TEXT NOT NULL,
  county TEXT NOT NULL DEFAULT '',
  number_of_beds NUMERIC,
  total_days_medicaid NUMERIC,
  total_days_all NUMERIC,
  net_patient_revenue NUMERIC,
  net_income NUMERIC,
  total_income NUMERIC,
  total_costs NUMERIC,
  total_assets NUMERIC,
  total_liabilities NUMERIC,
  total_fund_balances NUMERIC,
  cash_on_hand NUMERIC,
  uncompensated_care NUMERIC,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (ccn, facility_type, report_year, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_facility_cost_report_state_idx
  ON bw_dso.dso_facility_cost_report (state_code, load_class);

CREATE INDEX IF NOT EXISTS dso_facility_cost_report_county_idx
  ON bw_dso.dso_facility_cost_report (state_code, county, load_class);

CREATE TABLE IF NOT EXISTS bw_cube.cube_facility_distress_metric (
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

CREATE INDEX IF NOT EXISTS cube_facility_distress_metric_state_idx
  ON bw_cube.cube_facility_distress_metric (state_code, load_class, as_of_date);

-- County-level rollup: facility counts, low-margin counts, and aggregate
-- Medicaid-day share and uncompensated care per county. This is a
-- closure-risk *review* watchlist, never a closure prediction.
CREATE TABLE IF NOT EXISTS bw_dso.dso_county_facility_rollup (
  state_code TEXT NOT NULL,
  county TEXT NOT NULL,
  facility_count NUMERIC NOT NULL DEFAULT 0,
  low_margin_facility_count NUMERIC NOT NULL DEFAULT 0,
  total_beds NUMERIC,
  avg_medicaid_day_share NUMERIC,
  total_uncompensated_care NUMERIC,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (state_code, county, load_class, load_history_id)
);
