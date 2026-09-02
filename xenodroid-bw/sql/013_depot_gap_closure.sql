-- 2026-09-02 depot gap closure (additive only).
--
-- 1. dso_provider_facility becomes state-neutral (KY + FL) and carries the
--    CMS Care Compare chain identifier. The publisher's chain_name can be an
--    individual owner's name; only a label that passes the organization-name
--    rule (ChainLabelAtoms) is stored, otherwise chain_label is NULL and
--    chain_label_status records why. No individual's name is ever written.
-- 2. bw_ctl.sam_entity_resolution persists every SAM.gov UEI lookup outcome
--    so a rate-limited run resumes where it stopped instead of starting over;
--    api keys are never stored, only outcomes.
-- 3. bw_dso.dso_contract_section indexes the retained Kentucky MCO contract
--    PDFs by section number so MCPAR sanction citations join to a section
--    title and page. Section text is hashed, not stored.

ALTER TABLE bw_dso.dso_provider_facility ADD COLUMN IF NOT EXISTS state_code TEXT;
ALTER TABLE bw_dso.dso_provider_facility ADD COLUMN IF NOT EXISTS chain_id TEXT;
ALTER TABLE bw_dso.dso_provider_facility ADD COLUMN IF NOT EXISTS chain_label TEXT;
ALTER TABLE bw_dso.dso_provider_facility ADD COLUMN IF NOT EXISTS chain_label_status TEXT;
ALTER TABLE bw_dso.dso_provider_facility ADD COLUMN IF NOT EXISTS chain_facility_count NUMERIC;
ALTER TABLE bw_dso.dso_provider_facility ADD COLUMN IF NOT EXISTS changed_ownership_12mo BOOLEAN;

-- Pre-existing Kentucky rows were loaded before state_code existed; CCNs
-- beginning with 18 are Kentucky by CMS assignment.
UPDATE bw_dso.dso_provider_facility SET state_code='KY' WHERE state_code IS NULL AND ccn LIKE '18%';

CREATE INDEX IF NOT EXISTS dso_provider_facility_state_idx
  ON bw_dso.dso_provider_facility (state_code, load_class);

CREATE TABLE IF NOT EXISTS bw_ctl.sam_entity_resolution (
  uei TEXT NOT NULL,
  state_code TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('resolved','not_found','rate_limited','failed')),
  legal_business_name TEXT,
  registration_status TEXT,
  address_line1 TEXT,
  city TEXT,
  zip TEXT,
  http_status INTEGER,
  attempts INTEGER NOT NULL DEFAULT 1,
  detail TEXT NOT NULL DEFAULT '',
  attempted_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (uei, state_code)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_contract_section (
  section_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  document_file TEXT NOT NULL,
  document_hash TEXT NOT NULL,
  section_number TEXT NOT NULL,
  section_title TEXT NOT NULL,
  pdf_page INTEGER NOT NULL,
  page_count INTEGER NOT NULL,
  text_hash TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (section_id, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_contract_section_plan_idx
  ON bw_dso.dso_contract_section (state_code, plan_name, section_number, load_class);
