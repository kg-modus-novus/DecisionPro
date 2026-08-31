import type pg from 'pg';
import { config } from '../config.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';

export type FederalAwardAccuracyResult = {
  check_id: string;
  ok: boolean;
  expected: string;
  actual: string;
  detail: string;
};

/**
 * Business Action: CheckFederalAwardGrainNumbers
 * OFR-01 Source Reconciliation for award/recipient-grain facts:
 *  1. Control-total re-count via USAspending spending_by_award_count for one
 *     sampled state/listing, compared to the stored place-of-performance row
 *     count for that state/listing.
 *  2. Sampled single-award re-fetch via the USAspending award detail endpoint,
 *     asserting stored award_amount equals the freshly re-fetched total_obligation.
 *  3. Row-count floor across all loaded state/listing combinations.
 */
export class CheckFederalAwardGrainNumbers {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Results: FederalAwardAccuracyResult[] = [];
  private client_ = new GovernedHttpClient();

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const totalRows = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_federal_award WHERE load_class='REAL'`,
      );
      const floor = Number(totalRows.rows[0]?.c || 0);
      this.Results.push({
        check_id: 'OFR-AWARD-ROW-FLOOR',
        ok: floor >= 20,
        expected: '>=20 REAL award-grain rows (KY+FL combined)',
        actual: String(floor),
        detail: 'Row-count floor across all state x assistance-listing combinations.',
      });

      const sample = await this.client.query<{
        state_code: string; assistance_listing: string; award_key: string; award_amount: string | null;
      }>(
        `SELECT state_code, assistance_listing, award_key, award_amount::text
         FROM bw_dso.dso_federal_award
         WHERE load_class='REAL' AND location_filter='place_of_performance'
         ORDER BY award_amount DESC NULLS LAST LIMIT 1`,
      );
      const controlRow = sample.rows[0];
      if (controlRow) {
        const countRes = await this.client_.FetchJson<{ results: Record<string, number> }>(
          config.usaSpendingAwardSearchUri.replace('spending_by_award/', 'spending_by_award_count/'),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filters: {
                award_type_codes: ['02', '03', '04', '05'],
                program_numbers: [controlRow.assistance_listing],
                place_of_performance_locations: [{ country: 'USA', state: controlRow.state_code }],
                time_period: [{ start_date: config.ofrAwardGrainWindowStart, end_date: new Date().toISOString().slice(0, 10) }],
              },
            }),
          },
        );
        const apiCount = Object.values(countRes.json.results || {}).reduce((a, b) => a + (Number(b) || 0), 0);
        const storedCount = await this.client.query<{ c: string }>(
          `SELECT COUNT(*)::int AS c FROM bw_dso.dso_federal_award
           WHERE load_class='REAL' AND location_filter='place_of_performance'
             AND state_code=$1 AND assistance_listing=$2`,
          [controlRow.state_code, controlRow.assistance_listing],
        );
        this.Results.push({
          check_id: `OFR-AWARD-CONTROL-${controlRow.state_code}-${controlRow.assistance_listing}`,
          ok: apiCount === Number(storedCount.rows[0]?.c || -1),
          expected: String(apiCount),
          actual: String(storedCount.rows[0]?.c ?? 'null'),
          detail: `USAspending spending_by_award_count re-fetch (place-of-performance) vs stored place-of-performance row count for ${controlRow.state_code} / ${controlRow.assistance_listing}.`,
        });

        const detail = await this.client_.FetchJson<{ total_obligation: number }>(
          `${config.usaSpendingAwardDetailBaseUri}${encodeURIComponent(controlRow.award_key)}/`,
        );
        const expectedAmount = Number(controlRow.award_amount);
        const actualAmount = Number(detail.json.total_obligation);
        this.Results.push({
          check_id: `OFR-AWARD-SAMPLE-${controlRow.award_key}`,
          ok: Math.abs(expectedAmount - actualAmount) < 0.5,
          expected: String(expectedAmount),
          actual: String(actualAmount),
          detail: `Sampled award ${controlRow.award_key} re-fetched from USAspending award-detail endpoint; total_obligation vs stored award_amount.`,
        });
      } else {
        this.Results.push({
          check_id: 'OFR-AWARD-CONTROL-NO-SAMPLE',
          ok: false,
          expected: 'at least one place_of_performance award row to sample',
          actual: '0',
          detail: 'No award rows available for control-total or sampled reconciliation.',
        });
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
