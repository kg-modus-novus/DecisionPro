-- 2026-09-02 follow-ons (additive only).
-- 1. dso_federal_award carries the USAspending award type (assistance type
--    description, e.g. "Formula Grant", "Project Grant", "Block Grant",
--    "Cooperative Agreement") so award class is a published attribute.
-- 2. dso_county_access_context joins, per state and county, the public
--    denominators the county access briefing lacked: Medicaid members or
--    eligibles (KY DMS monthly county counts / FL AHCA eligibility report),
--    HRSA AHRF primary-care HPSA designation, CMS Care Compare certified
--    nursing-facility beds, and the HCRIS negative-margin rollup.

ALTER TABLE bw_dso.dso_federal_award ADD COLUMN IF NOT EXISTS award_type TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS bw_dso.dso_county_access_context (
  state_code TEXT NOT NULL,
  county_key TEXT NOT NULL,
  county_name TEXT NOT NULL,
  county_fips TEXT,
  medicaid_members NUMERIC,
  medicaid_members_period TEXT,
  medicaid_members_source TEXT,
  hpsa_primary_care_code TEXT,
  hpsa_primary_care_label TEXT,
  hpsa_vintage TEXT,
  certified_snf_beds NUMERIC,
  snf_facility_count NUMERIC,
  low_rated_snf_count NUMERIC,
  hcris_facility_count NUMERIC,
  hcris_negative_margin_count NUMERIC,
  hcris_total_beds NUMERIC,
  hcris_avg_medicaid_day_share NUMERIC,
  from_sys_ids TEXT[] NOT NULL DEFAULT '{}',
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (state_code, county_key, load_class, load_history_id)
);
