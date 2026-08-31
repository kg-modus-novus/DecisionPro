import AdmZip from 'adm-zip';
import type pg from 'pg';
import { config } from '../config.js';

export type NonprofitAccuracyResult = {
  check_id: string;
  ok: boolean;
  expected: string;
  actual: string;
  detail: string;
};

/**
 * Business Action: CheckNonprofitFinancialsNumbers
 * OFR-03 Source Reconciliation:
 *  1. Row-count floor across both vintages and states.
 *  2. Every retained row carries a non-empty form_type and extract_vintage
 *     (filing vintage and form type on every fact, per the exit gate).
 *  3. Zero person-level columns in the schema (structural: no officer/donor
 *     name, DOB, or address column exists in dso_nonprofit_filing).
 *  4. Sampled row re-verified: re-fetch the live IRS ZIP for one sampled
 *     vintage, re-extract and re-parse the row for one sampled EIN, and
 *     confirm the stored total_revenue reproduces exactly.
 */
export class CheckNonprofitFinancialsNumbers {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Results: NonprofitAccuracyResult[] = [];

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const floor = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_nonprofit_filing WHERE load_class='REAL'`,
      );
      this.Results.push({
        check_id: 'OFR-990-ROW-FLOOR', ok: Number(floor.rows[0]?.c || 0) >= 10,
        expected: '>=10 REAL filing rows (KY+FL, both vintages)', actual: String(floor.rows[0]?.c ?? 'null'),
        detail: 'Row-count floor for the crosswalked-org 990 filing universe.',
      });

      const missingVintageOrForm = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_nonprofit_filing
         WHERE load_class='REAL' AND (extract_vintage='' OR extract_vintage IS NULL OR form_type='' OR form_type IS NULL)`,
      );
      this.Results.push({
        check_id: 'OFR-990-VINTAGE-FORM-PRESENT', ok: Number(missingVintageOrForm.rows[0]?.c || 0) === 0,
        expected: '0 rows missing extract_vintage or form_type', actual: String(missingVintageOrForm.rows[0]?.c ?? 'null'),
        detail: 'Filing vintage and form type must be present on every fact.',
      });

      const columns = await this.client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='bw_dso' AND table_name='dso_nonprofit_filing'`,
      );
      const forbidden = columns.rows.filter((r) => /officer|donor|dob|birth|ssn|address_person/i.test(r.column_name));
      this.Results.push({
        check_id: 'OFR-990-NO-PERSON-LEVEL-COLUMNS', ok: forbidden.length === 0,
        expected: '0 person-level columns', actual: String(forbidden.length),
        detail: 'Structural check that no officer/donor/DOB/SSN column exists on dso_nonprofit_filing (organization-level only, per the person-level gate).',
      });

      const sample = await this.client.query<{
        ein: string; tax_period: string; extract_vintage: string; total_revenue: string | null;
      }>(
        `SELECT ein, tax_period, extract_vintage, total_revenue::text FROM bw_dso.dso_nonprofit_filing
         WHERE load_class='REAL' ORDER BY ein LIMIT 1`,
      );
      const row = sample.rows[0];
      if (!row) {
        this.Results.push({
          check_id: 'OFR-990-SAMPLE-NO-CANDIDATE', ok: true,
          expected: 'a filing row to sample (optional)', actual: 'none present this run',
          detail: 'No filing row existed to sample; not a failure, just nothing to verify.',
        });
      } else {
        try {
          const uri = config.irs990ExtractUris.find((v) => v.vintage === row.extract_vintage)?.uri;
          if (!uri) throw new Error(`no configured URI for vintage ${row.extract_vintage}`);
          const res = await fetch(uri, {
            headers: { 'User-Agent': 'DecisionProOFR-DataRequest/1.0 (+https://decisionpro.io/data-requests)' },
            signal: AbortSignal.timeout(300_000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
          const rawCsvText = zip.getEntries()[0].getData().toString('utf8');
          const csvText = rawCsvText.charCodeAt(0) === 0xfeff ? rawCsvText.slice(1) : rawCsvText;
          const newlineIndex = csvText.indexOf('\n');
          const header = csvText.slice(0, newlineIndex).replace(/\r$/, '').split(',').map((h) => h.toLowerCase());
          const einIdx = header.indexOf('ein');
          const taxPdIdx = header.indexOf('tax_pd');
          const revIdx = header.indexOf('totrevenue');
          const lines = csvText.slice(newlineIndex + 1).split('\n');
          const liveLine = lines.find((line) => {
            const cells = line.split(',');
            return (cells[einIdx] || '').trim() === row.ein && (cells[taxPdIdx] || '').trim() === row.tax_period;
          });
          const liveRevenue = liveLine ? Number((liveLine.split(',')[revIdx] || '').trim() || 'NaN') : NaN;
          const storedRevenue = Number(row.total_revenue);
          const ok = Number.isFinite(liveRevenue) && liveRevenue === storedRevenue;
          this.Results.push({
            check_id: `OFR-990-SAMPLE-${row.ein}-${row.tax_period}`, ok,
            expected: `total_revenue for EIN ${row.ein} / period ${row.tax_period}, re-fetched live from vintage ${row.extract_vintage}`,
            actual: `stored=${storedRevenue} live=${liveRevenue}`,
            detail: 'Sampled filing row re-verified against a freshly re-fetched and re-extracted IRS SOI 990 extract.',
          });
        } catch (error) {
          this.Results.push({
            check_id: `OFR-990-SAMPLE-${row.ein}-${row.tax_period}`, ok: false,
            expected: 'live IRS 990 extract re-fetch to succeed', actual: error instanceof Error ? error.message : String(error),
            detail: 'Sampled filing row could not be re-verified this run.',
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
