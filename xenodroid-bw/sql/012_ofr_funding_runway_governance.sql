-- FRI: additive governance for display labels, continuation evidence, and
-- funding-gap assessments. Raw publisher fields in existing DSO tables remain
-- unchanged. All tables are temporal: refreshes append observations rather
-- than deleting prior evidence.

CREATE TABLE IF NOT EXISTS bw_ctl.organization_display_label (
  label_assertion_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('source-record','exact-identity-cluster')),
  subject_ref TEXT NOT NULL,
  source_identity_id TEXT NOT NULL,
  exact_identity_cluster_ref TEXT,
  display_text TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('government_agency','nonprofit','healthcare_provider','for_profit','other','unknown')),
  method TEXT NOT NULL CHECK (method IN ('source-preferred','official-alias','curated','conservative-format','unreviewed-source-label')),
  authority_ref TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  source_record_ref TEXT NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  review_status TEXT NOT NULL CHECK (review_status IN ('unreviewed','reviewed','superseded')),
  verified_at TIMESTAMPTZ,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (label_assertion_id, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS organization_display_label_subject_idx
  ON bw_ctl.organization_display_label (state_code, subject_kind, subject_ref, load_class, last_observed_at DESC);

CREATE TABLE IF NOT EXISTS bw_dso.dso_award_continuation_evidence (
  evidence_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  award_key TEXT NOT NULL,
  award_id_display TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('award-transaction','taggs-action','waiver-application','waiver-extension','waiver-approval','successor-opportunity','official-ending-notice')),
  published_status TEXT NOT NULL,
  action_date DATE,
  effective_start DATE,
  effective_end DATE,
  amount NUMERIC,
  source_uri TEXT NOT NULL,
  source_record_ref TEXT NOT NULL,
  psa_object_key TEXT NOT NULL,
  source_field_path TEXT NOT NULL,
  retrieval_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  reconciliation_status TEXT NOT NULL CHECK (reconciliation_status IN ('reconciled','unreconciled','conflicting')),
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  supersedes_evidence_id TEXT,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (evidence_id, load_class, load_history_id)
);

CREATE INDEX IF NOT EXISTS award_continuation_evidence_award_idx
  ON bw_dso.dso_award_continuation_evidence (state_code, award_key, load_class, last_observed_at DESC);

CREATE TABLE IF NOT EXISTS bw_cube.cube_funding_gap_assessment (
  assessment_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('federal-award','waiver-authority')),
  subject_ref TEXT NOT NULL,
  continuation_status TEXT NOT NULL CHECK (continuation_status IN ('confirmed_continued','extension_pending','temporary_extension','successor_opportunity_identified','no_public_continuation_found','not_assessed','confirmed_ending','conflicting','stale')),
  continuation_reason_code TEXT NOT NULL,
  gap_status TEXT NOT NULL CHECK (gap_status IN ('not_assessable','monitor','potential_gap','gap_mitigated','confirmed_gap')),
  dependency_status TEXT NOT NULL CHECK (dependency_status IN ('not_assessed','tracked_sources_only','recipient_confirmed')),
  replacement_status TEXT NOT NULL CHECK (replacement_status IN ('not_assessed','none_publicly_identified','candidate_identified','confirmed')),
  service_impact_status TEXT NOT NULL CHECK (service_impact_status IN ('not_assessed','documented')),
  available_balance NUMERIC,
  average_eligible_daily_spend NUMERIC,
  estimated_runout_date DATE,
  gap_amount NUMERIC,
  evidence_refs TEXT[] NOT NULL DEFAULT '{}',
  gap_refs TEXT[] NOT NULL DEFAULT '{}',
  missing_inputs TEXT[] NOT NULL DEFAULT '{}',
  rule_version TEXT NOT NULL,
  summary TEXT NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL,
  stale_after TIMESTAMPTZ NOT NULL,
  assessed_by TEXT NOT NULL,
  load_class TEXT NOT NULL CHECK (load_class IN ('TEST','REAL')),
  load_history_id TEXT NOT NULL REFERENCES bw_ctl.load_history(load_history_id),
  PRIMARY KEY (assessment_id, load_class, load_history_id),
  CHECK (estimated_runout_date IS NULL OR (available_balance IS NOT NULL AND average_eligible_daily_spend > 0)),
  CHECK (gap_status <> 'potential_gap' OR (
    continuation_status IN ('no_public_continuation_found','confirmed_ending') AND
    dependency_status = 'recipient_confirmed' AND
    replacement_status = 'none_publicly_identified' AND
    service_impact_status = 'documented'
  )),
  CHECK (continuation_status <> 'not_assessed' OR (continuation_reason_code <> '' AND cardinality(gap_refs) > 0)),
  CHECK (gap_status <> 'not_assessable' OR (cardinality(missing_inputs) > 0 AND cardinality(gap_refs) > 0)),
  CHECK (gap_amount IS NULL OR gap_status IN ('gap_mitigated','confirmed_gap'))
);

CREATE INDEX IF NOT EXISTS funding_gap_assessment_subject_idx
  ON bw_cube.cube_funding_gap_assessment (state_code, subject_type, subject_ref, load_class, assessed_at DESC);
