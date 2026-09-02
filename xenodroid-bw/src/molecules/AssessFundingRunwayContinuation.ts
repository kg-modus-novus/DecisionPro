import type pg from 'pg';
import {
  AssessPotentialFundingGap,
  DaysRemainingFromEndDate,
  FUNDING_GAP_RULE_VERSION,
  GapRefsForContinuationSnapshot,
  IsContinuationEvidenceFresh,
  ResolveContinuationDispositionFromEvidence,
} from '../atoms/FundingRunwayGovernanceAtoms.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { Sha256 } from '../adapters/operationalPublicSources.js';

type AwardRow = {
  award_key: string;
  state_code: string;
  period_of_performance_end: string | null;
};

type EvidenceRow = {
  state_code: string;
  award_key: string;
  evidence_id: string;
  evidence_type: string;
  last_observed_at: string;
};

/**
 * Business Action: AssessFundingRunwayContinuation (Release B)
 * Converts reconciled public continuation evidence into disposition and gap
 * assessments. Transaction pages establish search completeness; they never
 * alone confirm continuation.
 */
export class AssessFundingRunwayContinuation {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  AssessmentCount = 0;
  ReconciledSearchCount = 0;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    const loadHistoryId = newId('LH-FRI-B');
    const now = new Date();
    try {
      await InsertLoadHistory(this.client, {
        load_history_id: loadHistoryId,
        data_request_id: 'DR-REAL-FUNDING-RUNWAY-GOVERNANCE-A',
        started_at: now,
        source_uri: 'DecisionPro governed Release B continuation assessment over reconciled public evidence',
        load_class: 'REAL',
      });

      const awards = await this.client.query<AwardRow>(
        `SELECT DISTINCT ON (award_key, state_code) award_key, state_code, period_of_performance_end::text
         FROM bw_dso.dso_federal_award
         WHERE load_class='REAL' AND period_of_performance_end IS NOT NULL
         ORDER BY award_key, state_code, period_of_performance_end DESC`,
      );
      const pages = await this.client.query<{ object_key: string }>(
        `SELECT object_key
         FROM bw_psa_meta.object_index
         WHERE from_sys_id='USA_SPENDING' AND load_class='REAL'
           AND object_key LIKE 'psa/USA_SPENDING/REAL/transactions/%'`,
      );
      const reconciledAwards = new Set<string>();
      for (const row of pages.rows) {
        const parts = row.object_key.split('/');
        const stateCode = parts[4];
        const awardKey = parts[5];
        if (stateCode && awardKey) reconciledAwards.add(`${stateCode}|${awardKey}`);
      }

      const evidenceRows = await this.client.query<EvidenceRow>(
        `SELECT state_code, award_key, evidence_id, evidence_type, last_observed_at::text
         FROM bw_dso.dso_award_continuation_evidence
         WHERE load_class='REAL'`,
      );
      const evidenceByAward = new Map<string, EvidenceRow[]>();
      for (const row of evidenceRows.rows) {
        const key = `${row.state_code}|${row.award_key}`;
        const bucket = evidenceByAward.get(key) || [];
        bucket.push(row);
        evidenceByAward.set(key, bucket);
      }

      const staleAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      for (const award of awards.rows) {
        const awardKey = `${award.state_code}|${award.award_key}`;
        const publicSearchReconciled = reconciledAwards.has(awardKey);
        const rows = evidenceByAward.get(awardKey) || [];
        const latestObserved = rows.reduce<string | null>((latest, row) => {
          if (!latest || row.last_observed_at > latest) return row.last_observed_at;
          return latest;
        }, null);
        const snapshot = {
          publicSearchReconciled,
          evidenceFresh: publicSearchReconciled && IsContinuationEvidenceFresh(latestObserved, now),
          evidenceIds: rows.map((row) => row.evidence_id),
          evidenceTypes: rows.map((row) => row.evidence_type),
        };
        if (publicSearchReconciled) this.ReconciledSearchCount += 1;

        const continuation = ResolveContinuationDispositionFromEvidence(snapshot);
        const daysRemaining = DaysRemainingFromEndDate(award.period_of_performance_end, now);
        const gap = AssessPotentialFundingGap({
          daysRemaining,
          continuationStatus: continuation.status,
          dependencyStatus: 'not_assessed',
          replacementStatus: 'not_assessed',
          serviceImpactStatus: 'not_assessed',
          publicSearchReconciled,
          evidenceFresh: snapshot.evidenceFresh,
        });
        const gapRefs = GapRefsForContinuationSnapshot(publicSearchReconciled);
        const gapSummary = gap.status === 'not_assessable'
          ? 'Gap likelihood is not assessable until recipient dependency, balance/burn, replacement funding, and service impact evidence are loaded.'
          : gap.status === 'monitor'
            ? 'Monitor — current evidence does not establish a potential gap.'
            : 'Potential gap — all required evidence predicates are present.';

        const assessmentId = `FRI-ASSESS-${Sha256(Buffer.from(`${award.state_code}|${award.award_key}|${now.toISOString()}|B`)).slice(0, 20)}`;
        await this.client.query(
          `INSERT INTO bw_cube.cube_funding_gap_assessment
           (assessment_id,state_code,subject_type,subject_ref,continuation_status,continuation_reason_code,
            gap_status,dependency_status,replacement_status,service_impact_status,evidence_refs,gap_refs,
            missing_inputs,rule_version,summary,assessed_at,stale_after,assessed_by,load_class,load_history_id)
           VALUES ($1,$2,'federal-award',$3,$4,$5,$6,'not_assessed','not_assessed','not_assessed',$7,$8,$9,$10,$11,$12,$13,
            'DecisionPro governed Release B','REAL',$14)`,
          [
            assessmentId, award.state_code, award.award_key, continuation.status, continuation.reasonCode,
            gap.status, snapshot.evidenceIds, gapRefs, gap.missingInputs, FUNDING_GAP_RULE_VERSION,
            `${continuation.summary} ${gapSummary}`.trim(), now, staleAfter, loadHistoryId,
          ],
        );
        this.AssessmentCount += 1;
      }

      if (this.ReconciledSearchCount > 0) {
        await this.client.query(
          `INSERT INTO bw_ctl.gap_object (gap_id,title,need,rooms,paid_follow_on,load_history_id)
           VALUES ('GAP-FRI-LEGACY-RAW-CAPTURE','Byte-faithful USAspending capture loaded for deadline-window awards',
             $1,ARRAY['funding-resilience'],'Refresh public transaction evidence on schedule',$2)
           ON CONFLICT (gap_id) DO UPDATE SET title=EXCLUDED.title,need=EXCLUDED.need,load_history_id=EXCLUDED.load_history_id`,
          [
            `${this.ReconciledSearchCount} deadline-window awards now carry reconciled byte-faithful USAspending transaction pages. TAGGS/CMS continuation normalization remains incomplete.`,
            loadHistoryId,
          ],
        );
      }

      await CompleteLoadHistory(this.client, loadHistoryId, {
        status: 'SUCCEEDED',
        row_count: this.AssessmentCount,
        as_of_date: now.toISOString().slice(0, 10),
        notes: `Release B: ${this.ReconciledSearchCount} reconciled public searches; ${this.AssessmentCount} continuation/gap assessments written.`,
      });
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
      try { await CompleteLoadHistory(this.client, loadHistoryId, { status: 'FAILED', notes: this.ErrorMessage }); } catch { /* retain original */ }
    }
  }
}
