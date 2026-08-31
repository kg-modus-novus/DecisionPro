import type pg from 'pg';
import { config } from '../config.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';

export type SubawardAccuracyResult = {
  check_id: string;
  ok: boolean;
  expected: string;
  actual: string;
  detail: string;
};

/**
 * Business Action: CheckSubawardFlowGraphNumbers
 * OFR-06 Source Reconciliation: structural identity-confidence separation
 * (every edge is exact-derived or unresolved, never anything else — this is
 * also enforced by the SQL CHECK constraint), and a sampled subaward
 * re-verified against a freshly re-fetched USAspending subawards page.
 */
export class CheckSubawardFlowGraphNumbers {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Results: SubawardAccuracyResult[] = [];
  private client_ = new GovernedHttpClient({ requestCeiling: 10 });

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const badConfidence = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_funding_edge
         WHERE load_class='REAL' AND identity_confidence NOT IN ('exact-derived','unresolved')`,
      );
      this.Results.push({
        check_id: 'OFR-SUBAWARD-CONFIDENCE-LABELED', ok: Number(badConfidence.rows[0]?.c || 0) === 0,
        expected: '0 edges with a missing/invalid identity_confidence label', actual: String(badConfidence.rows[0]?.c ?? 'null'),
        detail: 'Every funding edge must be explicitly exact-derived or unresolved; never silently unlabeled.',
      });

      const unresolvedWithEin = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_funding_edge
         WHERE load_class='REAL' AND identity_confidence='unresolved' AND recipient_ein IS NOT NULL`,
      );
      this.Results.push({
        check_id: 'OFR-SUBAWARD-UNRESOLVED-CARRIES-NO-EIN', ok: Number(unresolvedWithEin.rows[0]?.c || 0) === 0,
        expected: '0 unresolved edges carrying a recipient_ein', actual: String(unresolvedWithEin.rows[0]?.c ?? 'null'),
        detail: 'An unresolved edge must never carry an identity value, or it would be presented as more confident than it is.',
      });

      const sample = await this.client.query<{ subaward_id: string; prime_award_key: string; amount: string | null }>(
        `SELECT subaward_id, prime_award_key, amount::text FROM bw_dso.dso_federal_subaward
         WHERE load_class='REAL' ORDER BY subaward_id LIMIT 1`,
      );
      const row = sample.rows[0];
      if (!row) {
        this.Results.push({
          check_id: 'OFR-SUBAWARD-SAMPLE-NO-CANDIDATE', ok: true,
          expected: 'a subaward row to sample (optional)', actual: 'none present this run',
          detail: 'No subaward row existed to sample; not a failure, just nothing to verify.',
        });
      } else {
        try {
          const { json } = await this.client_.FetchJson<{ results: Array<{ id: number; amount: number }> }>(
            config.usaSpendingSubawardsUri,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ award_id: row.prime_award_key, limit: 100, page: 1 }) },
          );
          const live = json.results.find((r) => String(r.id) === row.subaward_id);
          const liveAmount = live?.amount;
          const storedAmount = Number(row.amount);
          const ok = typeof liveAmount === 'number' && liveAmount === storedAmount;
          this.Results.push({
            check_id: `OFR-SUBAWARD-SAMPLE-${row.subaward_id}`, ok,
            expected: `amount for subaward ${row.subaward_id}, re-fetched live from USAspending`,
            actual: `stored=${storedAmount} live=${liveAmount}`,
            detail: 'Sampled subaward re-verified against a freshly re-fetched USAspending subawards page.',
          });
        } catch (error) {
          this.Results.push({
            check_id: `OFR-SUBAWARD-SAMPLE-${row.subaward_id}`, ok: false,
            expected: 'live USAspending subawards re-fetch to succeed', actual: error instanceof Error ? error.message : String(error),
            detail: 'Sampled subaward could not be re-verified this run.',
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
