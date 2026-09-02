import type pg from 'pg';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { ResolveOrganizationDisplayLabel, SourceIdentityId } from '../atoms/OrganizationDisplayLabelAtoms.js';
import { Sha256 } from '../adapters/operationalPublicSources.js';

type AwardRow = {
  award_key: string; state_code: string; award_id_display: string; recipient_name: string;
  recipient_uei: string; recipient_id: string; period_of_performance_end: string;
};

const GAP_REFS = [
  'GAP-FRI-LEGACY-RAW-CAPTURE', 'GAP-FRI-GRANT-ADMIN', 'GAP-FRI-RUNWAY-BASIS',
  'GAP-FRI-SERVICE-DEPENDENCY', 'GAP-FRI-REPLACEMENT-FUNDING',
];
const MISSING_INPUTS = [
  'Reconciled public continuation search', 'Recipient-confirmed funding dependency',
  'Available balance and eligible burn rate', 'Documented service or capacity impact',
  'Completed replacement-funding assessment', 'Operational lead time and accountable owner',
];

/**
 * Business Action: LoadFundingRunwayGovernance (Release A)
 * Produces display assertions and honest defaults. It intentionally emits no
 * monitor or gap conclusion before Releases B/C hydrate the required evidence.
 */
export class LoadFundingRunwayGovernance {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  LabelCount = 0;
  AssessmentCount = 0;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    const loadHistoryId = newId('LH-FRI-A');
    try {
      await InsertLoadHistory(this.client, {
        load_history_id: loadHistoryId,
        data_request_id: 'DR-REAL-FUNDING-RUNWAY-GOVERNANCE-A',
        started_at: new Date(),
        source_uri: 'DecisionPro governed Release A over existing USAspending award facts',
        load_class: 'REAL',
      });

      const gaps = [
        ['GAP-FRI-LEGACY-RAW-CAPTURE', 'Byte-faithful USAspending capture not yet loaded', 'Rehydrate award evidence with original response bytes and append-only observations.'],
        ['GAP-FRI-GRANT-ADMIN', 'Grant administration continuation disposition unavailable', 'Provide an authorized aggregate Notice of Award or grant-status feed.'],
        ['GAP-FRI-RUNWAY-BASIS', 'Available balance and eligible burn rate unavailable', 'Provide reconciled state accounting/grant-management balance and spend definitions.'],
        ['GAP-FRI-SERVICE-DEPENDENCY', 'Award-to-service dependency unavailable', 'Program owner validates supported services, capacity, materiality, and lead time.'],
        ['GAP-FRI-REPLACEMENT-FUNDING', 'Replacement funding or mitigation unavailable', 'Budget or grants owner provides approved replacement or bridge evidence.'],
      ];
      for (const [gapId, title, need] of gaps) {
        await this.client.query(
          `INSERT INTO bw_ctl.gap_object (gap_id,title,need,rooms,paid_follow_on,load_history_id)
           VALUES ($1,$2,$3,ARRAY['funding-resilience'],'Release B/C governed evidence hydration',$4)
           ON CONFLICT (gap_id) DO UPDATE SET title=EXCLUDED.title,need=EXCLUDED.need,rooms=EXCLUDED.rooms,paid_follow_on=EXCLUDED.paid_follow_on,load_history_id=EXCLUDED.load_history_id`,
          [gapId, title, need, loadHistoryId],
        );
      }

      const awards = await this.client.query<AwardRow>(
        `SELECT DISTINCT ON (award_key, state_code) award_key,state_code,award_id_display,recipient_name,
           recipient_uei,recipient_id,period_of_performance_end::text
         FROM bw_dso.dso_federal_award
         WHERE load_class='REAL' AND period_of_performance_end IS NOT NULL
         ORDER BY award_key,state_code,period_of_performance_end DESC`,
      );
      const now = new Date();
      const staleAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const insertedLabels = new Set<string>();
      for (const award of awards.rows) {
        const sourceIdentityId = SourceIdentityId({
          awardKey: award.award_key, recipientUei: award.recipient_uei, recipientId: award.recipient_id,
        });
        const label = ResolveOrganizationDisplayLabel(award.recipient_name, sourceIdentityId);
        const labelId = `FRI-LABEL-${Sha256(Buffer.from(`${award.state_code}|${sourceIdentityId}|${label.displayText}`)).slice(0, 20)}`;
        if (!insertedLabels.has(labelId)) await this.client.query(
          `INSERT INTO bw_ctl.organization_display_label
           (label_assertion_id,state_code,subject_kind,subject_ref,source_identity_id,display_text,raw_text,
            entity_type,method,authority_ref,source_uri,source_record_ref,confidence,review_status,verified_at,
            first_observed_at,last_observed_at,content_hash,load_class,load_history_id)
           VALUES ($1,$2,'source-record',$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,'REAL',$16)`,
          [labelId, award.state_code, sourceIdentityId, label.displayText, label.rawText, label.entityType,
            label.method, label.authorityRef, label.sourceUri, award.award_key, label.confidence,
            label.reviewStatus, label.verifiedAt, now, label.contentHash, loadHistoryId],
        );
        if (!insertedLabels.has(labelId)) {
          insertedLabels.add(labelId);
          this.LabelCount += 1;
        }

        const assessmentId = `FRI-ASSESS-${Sha256(Buffer.from(`${award.state_code}|${award.award_key}|${now.toISOString()}`)).slice(0, 20)}`;
        await this.client.query(
          `INSERT INTO bw_cube.cube_funding_gap_assessment
           (assessment_id,state_code,subject_type,subject_ref,continuation_status,continuation_reason_code,
            gap_status,dependency_status,replacement_status,service_impact_status,evidence_refs,gap_refs,
            missing_inputs,rule_version,summary,assessed_at,stale_after,assessed_by,load_class,load_history_id)
           VALUES ($1,$2,'federal-award',$3,'not_assessed','legacy_source_public_search_not_run',
            'not_assessable','not_assessed','not_assessed','not_assessed','{}',$4,$5,'FRI-GAP-v1',
            'Continuation has not been assessed; gap likelihood is not assessable from a published end date.',
            $6,$7,'DecisionPro governed Release A','REAL',$8)`,
          [assessmentId, award.state_code, award.award_key, GAP_REFS, MISSING_INPUTS, now, staleAfter, loadHistoryId],
        );
        this.AssessmentCount += 1;
      }

      await CompleteLoadHistory(this.client, loadHistoryId, {
        status: 'SUCCEEDED', row_count: this.AssessmentCount, as_of_date: now.toISOString().slice(0, 10),
        notes: `Release A: ${this.LabelCount} label observations and ${this.AssessmentCount} not-assessed/not-assessable defaults. Releases B/C remain incomplete.`,
      });
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
      try { await CompleteLoadHistory(this.client, loadHistoryId, { status: 'FAILED', notes: this.ErrorMessage }); } catch { /* retain original error */ }
    }
  }
}
