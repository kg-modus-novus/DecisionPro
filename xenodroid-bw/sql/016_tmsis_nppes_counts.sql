-- 2026-11-08 NPPES counts on the state-code spending aggregate (additive only).
-- Plan: docs/planning/potential-fraud-detection-codexen-plan.md (item 9, NPPES join).
-- Staging joins each billing NPI's own NPPES record (enumeration date, primary
-- taxonomy; the Feb 2026 file through a third-party mirror) and loads counts and
-- paid per state x code x year. No provider identity is loaded.
--   new_billing_npis_enumeration_known     new billers with a known enumeration date
--   new_billing_npis_recently_enumerated   of those, enumerated in the year or the year before
--   new_billing_recently_enumerated_paid   their paid
--   taxonomy_known_billing_npis / _paid    billers with a known taxonomy, and their paid
--   off_taxonomy_billing_npis / _paid      of those, outside the code's expected taxonomies
--   expected_taxonomies                    how many taxonomies the code expects (bill 90% of
--                                          its national positive paid, from the data)
-- The columns are nullable: rows loaded before this change carry no NPPES counts
-- (NULL, never a zero), and the radar export refuses a spending load without them.
-- The refusing constraints keep each count within the count it is drawn from.
-- The database performs no business writes: no triggers, no cascades.

ALTER TABLE bw_dso.dso_tmsis_state_code_year ADD COLUMN IF NOT EXISTS new_billing_npis_enumeration_known INTEGER;
ALTER TABLE bw_dso.dso_tmsis_state_code_year ADD COLUMN IF NOT EXISTS new_billing_npis_recently_enumerated INTEGER;
ALTER TABLE bw_dso.dso_tmsis_state_code_year ADD COLUMN IF NOT EXISTS new_billing_recently_enumerated_paid NUMERIC(16,2);
ALTER TABLE bw_dso.dso_tmsis_state_code_year ADD COLUMN IF NOT EXISTS taxonomy_known_billing_npis INTEGER;
ALTER TABLE bw_dso.dso_tmsis_state_code_year ADD COLUMN IF NOT EXISTS taxonomy_known_paid NUMERIC(16,2);
ALTER TABLE bw_dso.dso_tmsis_state_code_year ADD COLUMN IF NOT EXISTS off_taxonomy_billing_npis INTEGER;
ALTER TABLE bw_dso.dso_tmsis_state_code_year ADD COLUMN IF NOT EXISTS off_taxonomy_paid NUMERIC(16,2);
ALTER TABLE bw_dso.dso_tmsis_state_code_year ADD COLUMN IF NOT EXISTS expected_taxonomies INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dso_tmsis_state_code_year_nppes_counts_ck') THEN
    ALTER TABLE bw_dso.dso_tmsis_state_code_year
      ADD CONSTRAINT dso_tmsis_state_code_year_nppes_counts_ck CHECK (
        new_billing_npis_recently_enumerated <= new_billing_npis_enumeration_known
        AND new_billing_npis_enumeration_known <= new_billing_npis
        AND off_taxonomy_billing_npis <= taxonomy_known_billing_npis
        AND taxonomy_known_billing_npis <= billing_npis
        AND expected_taxonomies >= 0
      );
  END IF;
END $$;
