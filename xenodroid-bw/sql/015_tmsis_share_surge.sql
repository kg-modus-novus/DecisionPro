-- 2026-11-07 share-and-surge screen (additive only).
-- Plan: docs/planning/share-and-surge-screen-codexen-plan.md
-- 1. dso_tmsis_state_code_year: the published state x HCPCS x year spending
--    aggregate staged from the HHS Open Data "Medicaid Provider Spending by
--    HCPCS" file (T-MSIS 2018-2024, v2026-02-09). State is the billing
--    provider's NPPES practice state (else servicing, else UNMATCHED); the
--    UNMATCHED rows are kept so every code-year reconciles to the national
--    total. Provider identities are not loaded: only counts and a top-ten share.
-- 2. dso_tmsis_state_month: state x month paid and claim lines, the input to
--    the reporting-completeness gate (the publisher's tail months are short).
-- 3. dso_share_surge_candidate: one row per state, code, year and pattern the
--    screen detected. Every row is a review candidate (status detected), never
--    a finding; later human dispositions arrive with the API, not here.
-- The database performs no business writes: no triggers, no cascades.

CREATE TABLE IF NOT EXISTS bw_dso.dso_tmsis_state_code_year (
  state_code TEXT NOT NULL,
  hcpcs TEXT NOT NULL,
  year INTEGER NOT NULL,
  attribution TEXT NOT NULL CHECK (attribution IN ('billing-or-servicing','none')),
  claim_lines BIGINT NOT NULL,
  paid NUMERIC(16,2) NOT NULL,
  patient_cells BIGINT NOT NULL,
  cells BIGINT NOT NULL,
  billing_npis INTEGER NOT NULL,
  new_billing_npis INTEGER NOT NULL,
  top10_paid NUMERIC(16,2) NOT NULL,
  zero_paid_lines BIGINT NOT NULL,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (state_code, hcpcs, year, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_tmsis_state_code_year_code_idx
  ON bw_dso.dso_tmsis_state_code_year (hcpcs, year, load_class);

CREATE TABLE IF NOT EXISTS bw_dso.dso_tmsis_state_month (
  state_code TEXT NOT NULL,
  month_ym TEXT NOT NULL,
  claim_lines BIGINT NOT NULL,
  paid NUMERIC(16,2) NOT NULL,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (state_code, month_ym, load_class, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_share_surge_candidate (
  state_code TEXT NOT NULL,
  hcpcs TEXT NOT NULL,
  year INTEGER NOT NULL,
  pattern TEXT NOT NULL CHECK (pattern IN ('share-surge','tripled-and-growing','share-collapse','persistent-excess')),
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected')),
  state_paid NUMERIC(16,2) NOT NULL,
  national_paid NUMERIC(16,2) NOT NULL,
  share_of_national NUMERIC(8,5) NOT NULL,
  enrollment_share NUMERIC(8,5) NOT NULL,
  excess_multiple NUMERIC(10,2) NOT NULL,
  prior_year_share NUMERIC(8,5) NOT NULL,
  prior_year_paid NUMERIC(16,2) NOT NULL,
  two_years_prior_paid NUMERIC(16,2) NOT NULL,
  peak_share NUMERIC(8,5) NOT NULL,
  peak_share_year INTEGER NOT NULL,
  states_billing INTEGER NOT NULL,
  billing_npis INTEGER NOT NULL,
  new_billing_npis INTEGER NOT NULL,
  top10_share NUMERIC(8,5) NOT NULL,
  reporting_complete BOOLEAN NOT NULL,
  known_case_id TEXT NOT NULL DEFAULT '',
  lead_score NUMERIC(20,2) NOT NULL,
  paid_above_enrollment_level NUMERIC(16,2) NOT NULL,
  paid_above_prior_share_level NUMERIC(16,2) NOT NULL,
  spending_load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  from_sys_ids TEXT[] NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (state_code, hcpcs, year, pattern, load_class, load_history_id)
);

-- Same day, after the independent CodeXen review (CX-SS-03, CX-SS-08): the lead
-- score is decided by the owner and persisted, and each candidate names the
-- spending load it was screened from so the export reads one authoritative pair.
-- The ADD COLUMN path (a database created before these columns) needs a default to
-- fill existing rows; the default is dropped at once and the same FK is added, so a
-- migrated catalog matches a fresh one. The screen replaces every REAL row on each run.
ALTER TABLE bw_dso.dso_share_surge_candidate ADD COLUMN IF NOT EXISTS lead_score NUMERIC(20,2) NOT NULL DEFAULT 0;
ALTER TABLE bw_dso.dso_share_surge_candidate ALTER COLUMN lead_score DROP DEFAULT;
ALTER TABLE bw_dso.dso_share_surge_candidate ADD COLUMN IF NOT EXISTS spending_load_history_id TEXT NOT NULL DEFAULT '';
ALTER TABLE bw_dso.dso_share_surge_candidate ALTER COLUMN spending_load_history_id DROP DEFAULT;
-- Leveling what-if (the Director's 2026-11-07 requirement): dollars paid above the enrollment-share line
-- and above the prior-year-share line, decided by the owner per candidate; never a recovery estimate.
ALTER TABLE bw_dso.dso_share_surge_candidate ADD COLUMN IF NOT EXISTS paid_above_enrollment_level NUMERIC(16,2) NOT NULL DEFAULT 0;
ALTER TABLE bw_dso.dso_share_surge_candidate ALTER COLUMN paid_above_enrollment_level DROP DEFAULT;
ALTER TABLE bw_dso.dso_share_surge_candidate ADD COLUMN IF NOT EXISTS paid_above_prior_share_level NUMERIC(16,2) NOT NULL DEFAULT 0;
ALTER TABLE bw_dso.dso_share_surge_candidate ALTER COLUMN paid_above_prior_share_level DROP DEFAULT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dso_share_surge_candidate_spending_load_fk') THEN
    DELETE FROM bw_dso.dso_share_surge_candidate WHERE spending_load_history_id = '';
    ALTER TABLE bw_dso.dso_share_surge_candidate
      ADD CONSTRAINT dso_share_surge_candidate_spending_load_fk
      FOREIGN KEY (spending_load_history_id) REFERENCES bw_ctl.load_history(load_history_id);
  END IF;
END $$;
