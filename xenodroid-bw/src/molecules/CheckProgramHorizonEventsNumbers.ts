import type pg from 'pg';
import { config } from '../config.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';
import { StripHtmlToLines, ParseWaiverDates } from '../atoms/ParseCmsDemonstrationPage.js';

export type HorizonAccuracyResult = {
  check_id: string;
  ok: boolean;
  expected: string;
  actual: string;
  detail: string;
};

/**
 * Business Action: CheckProgramHorizonEventsNumbers
 * OFR-07 Source Reconciliation: every event must cite a source document and a
 * retrieval date (the plan's exit gate), and a sampled waiver-expiration date
 * is re-verified against a freshly re-fetched CMS demonstration page.
 */
export class CheckProgramHorizonEventsNumbers {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Results: HorizonAccuracyResult[] = [];
  private client_ = new GovernedHttpClient({ requestCeiling: 10 });

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const uncited = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_program_horizon_event
         WHERE load_class='REAL' AND (source_document_uri IS NULL OR source_document_uri = '' OR retrieved_at IS NULL)`,
      );
      this.Results.push({
        check_id: 'OFR-HORIZON-EVERY-EVENT-CITED', ok: Number(uncited.rows[0]?.c || 0) === 0,
        expected: '0 events missing a source_document_uri or retrieved_at', actual: String(uncited.rows[0]?.c ?? 'null'),
        detail: 'Every program_horizon_event must cite its source document and retrieval date — the plan\'s exit gate for this package.',
      });

      const badScope = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_program_horizon_event
         WHERE load_class='REAL' AND event_type='waiver_expiration' AND scope <> 'state'`,
      );
      this.Results.push({
        check_id: 'OFR-HORIZON-WAIVER-SCOPE-IS-STATE', ok: Number(badScope.rows[0]?.c || 0) === 0,
        expected: "0 waiver_expiration events with scope other than 'state'", actual: String(badScope.rows[0]?.c ?? 'null'),
        detail: 'A state-specific demonstration must never be mislabeled national in scope.',
      });

      const badNofoScope = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_program_horizon_event
         WHERE load_class='REAL' AND event_type='nofo_opportunity' AND scope <> 'national'`,
      );
      this.Results.push({
        check_id: 'OFR-HORIZON-NOFO-SCOPE-IS-NATIONAL', ok: Number(badNofoScope.rows[0]?.c || 0) === 0,
        expected: "0 nofo_opportunity events with scope other than 'national'", actual: String(badNofoScope.rows[0]?.c ?? 'null'),
        detail: 'A Grants.gov opportunity is not KY/FL eligibility-verified and must never be labeled state-scoped.',
      });

      const noStatusPrediction = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_program_horizon_event
         WHERE load_class='REAL' AND status ILIKE ANY (ARRAY['%will lapse%','%will not renew%','%denial predicted%','%approved renewal%'])`,
      );
      this.Results.push({
        check_id: 'OFR-HORIZON-NO-RENEWAL-OUTCOME-PREDICTED', ok: Number(noStatusPrediction.rows[0]?.c || 0) === 0,
        expected: '0 events whose status text predicts a renewal outcome', actual: String(noStatusPrediction.rows[0]?.c ?? 'null'),
        detail: 'Every status is a published date/status only — never a predicted renewal outcome, per the plan\'s exit gate.',
      });

      const sampleDemo = config.cms1115DemonstrationPages[0];
      const stored = await this.client.query<{ event_date: string }>(
        `SELECT event_date::text FROM bw_dso.dso_program_horizon_event
         WHERE load_class='REAL' AND event_type='waiver_expiration' AND state_code=$1 LIMIT 1`,
        [sampleDemo.state],
      );
      const storedExpiration = stored.rows[0]?.event_date;
      if (!storedExpiration) {
        this.Results.push({
          check_id: 'OFR-HORIZON-SAMPLE-NO-CANDIDATE', ok: false,
          expected: `a stored waiver_expiration event for ${sampleDemo.state}`, actual: 'none present this run',
          detail: 'No waiver expiration row existed to sample.',
        });
      } else {
        try {
          const { text } = await this.client_.FetchText(sampleDemo.uri);
          const liveDates = ParseWaiverDates(StripHtmlToLines(text));
          const ok = liveDates.expiration === storedExpiration;
          this.Results.push({
            check_id: `OFR-HORIZON-SAMPLE-${sampleDemo.state}-EXPIRATION`, ok,
            expected: `expiration date for ${sampleDemo.program}, re-fetched live from the CMS demonstration page`,
            actual: `stored=${storedExpiration} live=${liveDates.expiration}`,
            detail: 'Sampled waiver expiration date re-verified against a freshly re-fetched CMS demonstration page.',
          });
        } catch (error) {
          this.Results.push({
            check_id: `OFR-HORIZON-SAMPLE-${sampleDemo.state}-EXPIRATION`, ok: false,
            expected: 'live CMS demonstration page re-fetch to succeed', actual: error instanceof Error ? error.message : String(error),
            detail: 'Sampled waiver expiration could not be re-verified this run.',
          });
        }
      }

      this.Status = this.Results.every((r) => r.ok) ? 'SUCCEEDED' : 'FAILED';
      if (this.Status === 'FAILED') {
        this.ErrorMessage = this.Results.filter((r) => !r.ok).map((r) => `${r.check_id}: expected ${r.expected} actual ${r.actual}`).join('; ');
      }
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
