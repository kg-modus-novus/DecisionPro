import type pg from 'pg';
import { config } from '../config.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';

export type FacilityDistressAccuracyResult = {
  check_id: string;
  ok: boolean;
  expected: string;
  actual: string;
  detail: string;
};

function field(row: Record<string, unknown>, ...names: string[]): string {
  const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const name of names) {
    const value = lower.get(name.toLowerCase());
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

/**
 * Business Action: CheckFacilityDistressNumbers
 * OFR-04 Source Reconciliation: row-count floor, and a sampled facility-year
 * re-verified against a freshly re-fetched CMS HCRIS API row (live control
 * total, not a static fixture).
 */
export class CheckFacilityDistressNumbers {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Results: FacilityDistressAccuracyResult[] = [];
  private client_ = new GovernedHttpClient({ requestCeiling: 20 });

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const floor = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_facility_cost_report WHERE load_class='REAL'`,
      );
      this.Results.push({
        check_id: 'OFR-HCRIS-ROW-FLOOR', ok: Number(floor.rows[0]?.c || 0) >= 20,
        expected: '>=20 REAL facility-year rows (KY+FL, hospital+SNF)', actual: String(floor.rows[0]?.c ?? 'null'),
        detail: 'Row-count floor across both facility types and states.',
      });

      const sample = await this.client.query<{
        ccn: string; facility_type: string; state_code: string; total_costs: string | null;
      }>(
        `SELECT ccn, facility_type, state_code, total_costs::text FROM bw_dso.dso_facility_cost_report
         WHERE load_class='REAL' ORDER BY ccn LIMIT 1`,
      );
      const row = sample.rows[0];
      if (!row) {
        this.Results.push({
          check_id: 'OFR-HCRIS-SAMPLE-NO-CANDIDATE', ok: true,
          expected: 'a facility row to sample (optional)', actual: 'none present this run',
          detail: 'No facility row existed to sample; not a failure, just nothing to verify.',
        });
      } else {
        try {
          const uri = row.facility_type === 'hospital' ? config.hcrisHospitalCostReportUri : config.hcrisSnfCostReportUri;
          // See RetrieveAndLoadFacilityFinancialDistress.fetchFacilities for
          // why the operator must be "=" not "==" on this CMS endpoint.
          const params = new URLSearchParams({
            'filter[cond][path]': 'State Code',
            'filter[cond][operator]': '=',
            'filter[cond][value]': row.state_code,
            size: '2000',
          });
          const { json } = await this.client_.FetchJson<Array<Record<string, unknown>>>(`${uri}?${params.toString()}`);
          const live = json.find((r) => field(r, 'Provider CCN') === row.ccn);
          const liveCosts = live ? Number(field(live, 'Total Costs').replace(/,/g, '')) : NaN;
          const storedCosts = Number(row.total_costs);
          const ok = Number.isFinite(liveCosts) && liveCosts === storedCosts;
          this.Results.push({
            check_id: `OFR-HCRIS-SAMPLE-${row.ccn}`, ok,
            expected: `total_costs for CCN ${row.ccn} (${row.facility_type}), re-fetched live from CMS HCRIS`,
            actual: `stored=${storedCosts} live=${liveCosts}`,
            detail: 'Sampled facility-year re-verified against a freshly re-fetched CMS HCRIS API row.',
          });
        } catch (error) {
          this.Results.push({
            check_id: `OFR-HCRIS-SAMPLE-${row.ccn}`, ok: false,
            expected: 'live CMS HCRIS re-fetch to succeed', actual: error instanceof Error ? error.message : String(error),
            detail: 'Sampled facility row could not be re-verified this run.',
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
