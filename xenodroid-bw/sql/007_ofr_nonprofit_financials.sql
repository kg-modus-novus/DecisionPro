-- OFR-03: IRS Form 990 organization-level financials, state-neutral (KY + FL).
--
-- Design note (grounding correction, recorded 2026-08-31): the IRS SOI
-- annual Form 990 extract (the org-level CSV, not the person-level XML
-- e-file corpus, which stays out of OFR scope) does not carry a
-- government-specific grant-revenue field — Part VIII Line 1e (government
-- grants) is not broken out separately from total contributions/gifts/grants
-- (Line 1h) in this extract. "Government-grant dependency" is therefore
-- computed as contribution-and-grant revenue dependency (total
-- contributions/grants over total revenue) with that limitation labeled at
-- point of use, not silently presented as government-specific.
-- The extract also does not carry the Form 990 Part IX functional-expense
-- column split (Program / Management-and-general / Fundraising) — only the
-- Total column plus named expense categories (management fees, legal,
-- accounting, lobbying, investment-management fees, office expenses).
-- "Program-vs-admin expense trend" is therefore computed as a named
-- administrative-category expense share of total functional expenses, not
-- the official Part IX allocation, and is labeled as such.

CREATE TABLE IF NOT EXISTS bw_dso.dso_nonprofit_filing (
  ein TEXT NOT NULL,
  tax_period TEXT NOT NULL,
  form_type TEXT NOT NULL DEFAULT '990',
  extract_vintage TEXT NOT NULL,
  total_revenue NUMERIC,
  total_expenses NUMERIC,
  total_contributions_grants NUMERIC,
  program_service_revenue NUMERIC,
  admin_category_expense NUMERIC,
  unrestricted_net_assets_end NUMERIC,
  total_assets_end NUMERIC,
  total_liabilities_end NUMERIC,
  state_code TEXT NOT NULL DEFAULT '',
  org_name TEXT NOT NULL DEFAULT '',
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (ein, tax_period, extract_vintage, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_nonprofit_filing_state_idx
  ON bw_dso.dso_nonprofit_filing (state_code, load_class);

CREATE INDEX IF NOT EXISTS dso_nonprofit_filing_ein_idx
  ON bw_dso.dso_nonprofit_filing (ein, load_class);

CREATE TABLE IF NOT EXISTS bw_cube.cube_nonprofit_resilience_metric (
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

CREATE INDEX IF NOT EXISTS cube_nonprofit_resilience_metric_state_idx
  ON bw_cube.cube_nonprofit_resilience_metric (state_code, load_class, as_of_date);
