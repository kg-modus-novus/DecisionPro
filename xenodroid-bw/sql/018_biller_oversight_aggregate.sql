-- 2026-11-12 biller oversight aggregate (additive only).
-- Plan: docs/planning/oversight-pages-codexen-plan.md
-- Staged by scripts/tmsis/stage_oversight_aggregates.py from the HHS Open Data
-- "Medicaid Provider Spending by HCPCS" file joined to NPPES; loaded and
-- reconciled by BillerOversightAggregateOwner. Counts and dollars only: no NPI,
-- provider name or address is loaded.
-- 1. dso_tmsis_state_code_month: monthly paid and billers for the state x code
--    series the share-and-surge screen flagged (the early-warning page);
--    dso_tmsis_code_month: the same codes' national monthly paid (every state
--    and unmatched rows), for the share of US payments per month.
-- 2. dso_biller_group_year / dso_biller_group_service_year: the billers of a
--    surging or tripling service in a year, followed across every service they
--    bill, per year (follow the billers).
-- 3. dso_biller_profile_measure / dso_biller_profile_area: the latest year's
--    biller profile per state x code, as named measures (a count and its paid),
--    and by three-digit practice ZIP (provider patterns).
-- 4. dso_hcpcs_label: the short description of each code these tables carry.
-- The database performs no business writes: no triggers, no cascades.

CREATE TABLE IF NOT EXISTS bw_dso.dso_tmsis_state_code_month (
  state_code TEXT NOT NULL,
  hcpcs TEXT NOT NULL,
  month_ym TEXT NOT NULL CHECK (month_ym ~ '^\d{4}-\d{2}$'),
  paid NUMERIC(16,2) NOT NULL,
  billing_npis INTEGER NOT NULL CHECK (billing_npis >= 0),
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id) ON DELETE RESTRICT,
  PRIMARY KEY (state_code, hcpcs, month_ym, load_class, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_tmsis_code_month (
  hcpcs TEXT NOT NULL,
  month_ym TEXT NOT NULL CHECK (month_ym ~ '^\d{4}-\d{2}$'),
  paid NUMERIC(16,2) NOT NULL,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id) ON DELETE RESTRICT,
  PRIMARY KEY (hcpcs, month_ym, load_class, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_biller_group_year (
  group_state TEXT NOT NULL,
  group_hcpcs TEXT NOT NULL,
  group_year INTEGER NOT NULL,
  year INTEGER NOT NULL,
  members INTEGER NOT NULL CHECK (members >= 0),
  members_billing INTEGER NOT NULL CHECK (members_billing >= 0 AND members_billing <= members),
  members_paid NUMERIC(16,2) NOT NULL,
  members_code_paid NUMERIC(16,2) NOT NULL,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id) ON DELETE RESTRICT,
  PRIMARY KEY (group_state, group_hcpcs, group_year, year, load_class, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_biller_group_service_year (
  group_state TEXT NOT NULL,
  group_hcpcs TEXT NOT NULL,
  group_year INTEGER NOT NULL,
  hcpcs TEXT NOT NULL,
  year INTEGER NOT NULL,
  members_billing INTEGER NOT NULL CHECK (members_billing >= 0),
  paid NUMERIC(16,2) NOT NULL,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id) ON DELETE RESTRICT,
  PRIMARY KEY (group_state, group_hcpcs, group_year, hcpcs, year, load_class, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_biller_profile_measure (
  state_code TEXT NOT NULL,
  hcpcs TEXT NOT NULL,
  year INTEGER NOT NULL,
  measure TEXT NOT NULL,
  count_value NUMERIC(12,2) NOT NULL,
  paid NUMERIC(16,2) NOT NULL,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id) ON DELETE RESTRICT,
  PRIMARY KEY (state_code, hcpcs, year, measure, load_class, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_biller_profile_area (
  state_code TEXT NOT NULL,
  hcpcs TEXT NOT NULL,
  year INTEGER NOT NULL,
  zip3 TEXT NOT NULL,
  city TEXT NOT NULL,
  billers INTEGER NOT NULL CHECK (billers >= 0),
  paid NUMERIC(16,2) NOT NULL,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id) ON DELETE RESTRICT,
  PRIMARY KEY (state_code, hcpcs, year, zip3, load_class, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_hcpcs_label (
  hcpcs TEXT NOT NULL,
  label TEXT NOT NULL CHECK (label <> ''),
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id) ON DELETE RESTRICT,
  PRIMARY KEY (hcpcs, load_class, load_history_id)
);
