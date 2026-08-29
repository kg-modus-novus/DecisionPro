-- Kentucky operational public-source hydration.
-- Legislative UI consumes aggregate/de-identified cubes; raw public records remain in PSA/DSO.

CREATE TABLE IF NOT EXISTS bw_dso.dso_mcpar_response (
  row_number INTEGER NOT NULL,
  state_name TEXT NOT NULL,
  program_name TEXT NOT NULL,
  reporting_period_start DATE,
  reporting_period_end DATE,
  current_question_number TEXT NOT NULL DEFAULT '',
  question_id TEXT NOT NULL,
  measure_number TEXT NOT NULL DEFAULT '',
  reporting_entity TEXT NOT NULL DEFAULT '',
  response_text TEXT NOT NULL DEFAULT '',
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (row_number, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_mcpar_question_idx
  ON bw_dso.dso_mcpar_response (question_id, load_class);

CREATE TABLE IF NOT EXISTS bw_dso.dso_provider_facility (
  ccn TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  county_name TEXT NOT NULL DEFAULT '',
  ownership_type TEXT NOT NULL DEFAULT '',
  certified_beds NUMERIC,
  residents_per_day NUMERIC,
  overall_rating NUMERIC,
  staffing_rating NUMERIC,
  special_focus_status TEXT NOT NULL DEFAULT '',
  number_of_fines NUMERIC,
  total_fines NUMERIC,
  payment_denials NUMERIC,
  latitude NUMERIC,
  longitude NUMERIC,
  processing_date DATE,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (ccn, load_history_id)
);

CREATE INDEX IF NOT EXISTS dso_provider_facility_county_idx
  ON bw_dso.dso_provider_facility (county_name, load_class);

CREATE TABLE IF NOT EXISTS bw_dso.dso_exclusion_summary (
  state_code TEXT NOT NULL,
  exclusion_type TEXT NOT NULL,
  individual_count INTEGER NOT NULL DEFAULT 0,
  entity_count INTEGER NOT NULL DEFAULT 0,
  npi_count INTEGER NOT NULL DEFAULT 0,
  source_record_count INTEGER NOT NULL DEFAULT 0,
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (state_code, exclusion_type, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_federal_award_context (
  fiscal_year INTEGER NOT NULL,
  program_number TEXT NOT NULL,
  obligation_amount NUMERIC NOT NULL DEFAULT 0,
  period_end_date DATE NOT NULL,
  period_status TEXT NOT NULL CHECK (period_status IN ('COMPLETE','PARTIAL')),
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (fiscal_year, program_number, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_geo_county (
  county_fips TEXT NOT NULL,
  county_name TEXT NOT NULL,
  county_seat TEXT NOT NULL DEFAULT '',
  area_square_miles NUMERIC,
  add_region TEXT NOT NULL DEFAULT '',
  kytc_district INTEGER,
  source_updated_at TIMESTAMPTZ,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (county_fips, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_hospital_facility (
  facility_id TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  county_name TEXT NOT NULL DEFAULT '',
  license_type TEXT NOT NULL DEFAULT '',
  acute_beds INTEGER NOT NULL DEFAULT 0,
  critical_access_beds INTEGER NOT NULL DEFAULT 0,
  psychiatric_beds INTEGER NOT NULL DEFAULT 0,
  rehabilitation_beds INTEGER NOT NULL DEFAULT 0,
  license_expiration DATE,
  source_updated_at TIMESTAMPTZ,
  from_sys_id TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (facility_id, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_dso.dso_public_document (
  document_id TEXT NOT NULL,
  title TEXT NOT NULL,
  document_uri TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT '',
  byte_length INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL DEFAULT '',
  publication_period TEXT NOT NULL DEFAULT '',
  document_status TEXT NOT NULL CHECK (document_status IN ('DOWNLOADED','PAGE_MANIFEST','FAILED')),
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (document_id, load_history_id)
);

CREATE TABLE IF NOT EXISTS bw_cube.cube_operational_source_metric (
  metric_id TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  numeric_value NUMERIC,
  display_value TEXT NOT NULL,
  unit TEXT NOT NULL,
  source_status TEXT NOT NULL CHECK (source_status IN ('API_LOADED','FILE_LOADED','DOCUMENTS_LOADED','SOURCE_VERIFIED','FAILED')),
  from_sys_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (metric_id, load_history_id)
);

CREATE INDEX IF NOT EXISTS cube_operational_source_metric_idx
  ON bw_cube.cube_operational_source_metric (from_sys_id, load_class, as_of_date);
