import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { SafeObjectSegment } from '../adapters/operationalPublicSources.js';
import { HcrisTotalMargin } from '../atoms/HcrisFinancialMetrics.js';

type FacilityType = 'hospital' | 'snf';
type FacilityRow = {
  ccn: string;
  facilityType: FacilityType;
  reportYear: string;
  facilityName: string;
  state: string;
  county: string;
  numberOfBeds: number | null;
  totalDaysMedicaid: number | null;
  totalDaysAll: number | null;
  netPatientRevenue: number | null;
  totalOtherIncome: number | null;
  netIncome: number | null;
  totalIncome: number | null;
  totalCosts: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalFundBalances: number | null;
  cashOnHand: number | null;
  uncompensatedCare: number | null;
};

const shown = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Case-insensitive field lookup — CMS's Hospital and SNF cost-report
 * datasets use inconsistent casing for the same concept between the two
 * files (e.g. "Total Liabilities" vs "Total liabilities"); learned the hard
 * way in OFR-03 that pinning to one dataset's exact casing breaks silently
 * on the next one. */
function field(row: Record<string, unknown>, ...names: string[]): string {
  const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const name of names) {
    const value = lower.get(name.toLowerCase());
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function num(row: Record<string, unknown>, ...names: string[]): number | null {
  const raw = field(row, ...names);
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

/**
 * Business Action: RetrieveAndLoadFacilityFinancialDistress
 * OFR-04. State-neutral (KY+FL) CMS HCRIS Hospital + SNF cost-report
 * ingestion. Every value is Medicare-cost-report basis, not Medicaid
 * payment truth — labeled at point of use. Florida's own AHCA
 * hospital-financial KPI export remains parameter-blocked
 * (GAP-FL-F-14-PARAMETERS); this is an explicitly labeled federal fallback
 * layer alongside that gap, not a silent replacement for it.
 */
export class RetrieveAndLoadFacilityFinancialDistress {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  FacilityCount = 0;
  MetricCount = 0;
  CountyCount = 0;
  private client_ = new GovernedHttpClient({ requestCeiling: 50 });

  constructor(private client: pg.PoolClient) {}

  private async fetchFacilities(uri: string, facilityType: FacilityType, state: string): Promise<{ rows: FacilityRow[]; raw: unknown[] }> {
    // Live-verified bug (2026-08-31): this CMS data-api endpoint expects the
    // equality operator as a single "=", not "==" as several third-party
    // docs suggest. An unrecognized operator value fails OPEN — the filter
    // is silently dropped and the endpoint returns unfiltered national
    // data instead of erroring. The defense-in-depth check below exists
    // specifically because this failure mode is silent.
    const params = new URLSearchParams({
      'filter[cond][path]': 'State Code',
      'filter[cond][operator]': '=',
      'filter[cond][value]': state,
      size: '2000',
    });
    const { json } = await this.client_.FetchJson<Array<Record<string, unknown>>>(`${uri}?${params.toString()}`);
    // Defense in depth: never trust the filter silently worked. Every row
    // in this response must actually carry the requested state.
    const offState = json.filter((row) => field(row, 'State Code') !== state);
    if (offState.length) {
      throw new Error(`CMS HCRIS filter did not scope to ${state}: ${offState.length} of ${json.length} returned rows carried a different state code`);
    }
    const rows = json.map((row) => {
      const fiscalEnd = field(row, 'Fiscal Year End Date');
      return {
        ccn: field(row, 'Provider CCN'),
        facilityType,
        reportYear: fiscalEnd.slice(0, 4) || 'unknown',
        facilityName: field(row, 'Hospital Name', 'Facility Name'),
        state: field(row, 'State Code'),
        county: field(row, 'County'),
        numberOfBeds: num(row, 'Number of Beds'),
        totalDaysMedicaid: num(row, 'Total Days Title XIX'),
        totalDaysAll: num(row, 'Total Days (V + XVIII + XIX + Unknown)', 'Total Days Total'),
        netPatientRevenue: num(row, 'Net Patient Revenue'),
        totalOtherIncome: num(row, 'Total Other Income'),
        netIncome: num(row, 'Net Income'),
        totalIncome: num(row, 'Total Income'),
        totalCosts: num(row, 'Total Costs'),
        totalAssets: num(row, 'Total Assets'),
        totalLiabilities: num(row, 'Total Liabilities'),
        totalFundBalances: num(row, 'Total Fund Balances'),
        cashOnHand: num(row, 'Cash on Hand and in Banks'),
        uncompensatedCare: num(row, 'Total Unreimbursed and Uncompensated Care'),
      };
    }).filter((r) => r.ccn);
    return { rows, raw: json };
  }

  private async writeFacilityRows(rows: FacilityRow[], fromSysId: string, loadHistoryId: string) {
    const BATCH = 400;
    const COLUMNS_PER_ROW = 17;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values: unknown[] = [];
      const placeholders = batch.map((row, position) => {
        const base = position * COLUMNS_PER_ROW;
        values.push(
          row.ccn, row.facilityType, row.reportYear, row.facilityName, row.state, row.county,
          row.numberOfBeds, row.totalDaysMedicaid, row.totalDaysAll, row.netPatientRevenue, row.totalOtherIncome,
          row.netIncome, row.totalIncome, row.totalCosts, row.totalAssets, row.totalLiabilities,
          row.totalFundBalances,
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15},$${base + 16},$${base + 17},'${fromSysId}','REAL','${loadHistoryId}')`;
      });
      // cash_on_hand and uncompensated_care are appended per-row below since
      // they are kept outside the main batch — handled
      // via a second pass to keep the column/placeholder count easy to audit.
      await this.client.query(
        `INSERT INTO bw_dso.dso_facility_cost_report
         (ccn,facility_type,report_year,facility_name,state_code,county,number_of_beds,
           total_days_medicaid,total_days_all,net_patient_revenue,total_other_income,net_income,total_income,
          total_costs,total_assets,total_liabilities,total_fund_balances,from_sys_id,load_class,load_history_id)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (ccn, facility_type, report_year, load_class, load_history_id) DO NOTHING`,
        values,
      );
      for (const row of batch) {
        await this.client.query(
          `UPDATE bw_dso.dso_facility_cost_report SET cash_on_hand=$1, uncompensated_care=$2
           WHERE ccn=$3 AND facility_type=$4 AND report_year=$5 AND load_class='REAL' AND load_history_id=$6`,
          [row.cashOnHand, row.uncompensatedCare, row.ccn, row.facilityType, row.reportYear, loadHistoryId],
        );
      }
    }
    this.FacilityCount += rows.length;
  }

  private async addMetric(state: string, fromSysId: string, loadHistoryId: string, metricId: string, label: string, value: number, display: string, unit: string) {
    await this.client.query(
      `INSERT INTO bw_cube.cube_facility_distress_metric
       (metric_id,state_code,metric_label,numeric_value,display_value,unit,as_of_date,from_sys_id,load_class,load_history_id)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,'REAL',$8)`,
      [metricId, state, label, value, display, unit, fromSysId, loadHistoryId],
    );
    this.MetricCount += 1;
  }

  private async computeStateMetricsAndCounties(state: string, rows: FacilityRow[], fromSysId: string, loadHistoryId: string) {
    const stateRows = rows.filter((r) => r.state === state);
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-hcris-facility-count', 'Hospital + SNF cost-report facility-years loaded', stateRows.length, shown(stateRows.length), 'facility-years');

    const margins = stateRows
      .map((r) => ({ ccn: r.ccn, county: r.county, margin: HcrisTotalMargin(r.netIncome, r.netPatientRevenue, r.totalOtherIncome) }))
      .filter((r): r is { ccn: string; county: string; margin: number } => r.margin != null);
    if (margins.length) {
      const med = median(margins.map((m) => m.margin));
      await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-hcris-median-total-margin', 'Median total margin (Medicare cost-report basis)', med, pct(med), 'percent');
      const negative = margins.filter((m) => m.margin < 0).length;
      await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-hcris-negative-margin-count', 'Facility-years with a negative total margin', negative, shown(negative), 'facility-years');
    }

    const medicaidShares = stateRows
      .filter((r) => r.totalDaysMedicaid != null && r.totalDaysAll)
      .map((r) => r.totalDaysMedicaid! / r.totalDaysAll!);
    if (medicaidShares.length) {
      const med = median(medicaidShares);
      await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-hcris-median-medicaid-day-share', 'Median share of patient days billed to Medicaid (Title XIX)', med, pct(med), 'percent');
    }

    const uncompensated = stateRows.filter((r) => r.uncompensatedCare != null).reduce((sum, r) => sum + (r.uncompensatedCare || 0), 0);
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-hcris-total-uncompensated-care', 'Total unreimbursed and uncompensated care (Medicare cost-report basis)', uncompensated, `$${shown(uncompensated)}`, 'USD');

    const marginByCcn = new Map(margins.map((m) => [m.ccn, m.margin]));
    const counties = new Map<string, { facilityCount: number; lowMargin: number; beds: number; medicaidShares: number[]; uncompensated: number }>();
    for (const r of stateRows) {
      if (!r.county) continue;
      const entry = counties.get(r.county) || { facilityCount: 0, lowMargin: 0, beds: 0, medicaidShares: [], uncompensated: 0 };
      entry.facilityCount += 1;
      const marginValue = marginByCcn.get(r.ccn);
      if (marginValue != null && marginValue < 0) entry.lowMargin += 1;
      entry.beds += r.numberOfBeds || 0;
      if (r.totalDaysMedicaid != null && r.totalDaysAll) entry.medicaidShares.push(r.totalDaysMedicaid / r.totalDaysAll);
      entry.uncompensated += r.uncompensatedCare || 0;
      counties.set(r.county, entry);
    }
    for (const [county, entry] of counties) {
      await this.client.query(
        `INSERT INTO bw_dso.dso_county_facility_rollup
         (state_code,county,facility_count,low_margin_facility_count,total_beds,avg_medicaid_day_share,total_uncompensated_care,from_sys_id,load_class,load_history_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'REAL',$9)`,
        [state, county, entry.facilityCount, entry.lowMargin, entry.beds,
          entry.medicaidShares.length ? median(entry.medicaidShares) : null, entry.uncompensated, fromSysId, loadHistoryId],
      );
      this.CountyCount += 1;
    }
    const watchlistCounties = [...counties.entries()].filter(([, e]) => e.lowMargin > 0).length;
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-hcris-watchlist-county-count', 'Counties with at least one negative-margin facility (closure-risk review watchlist)', watchlistCounties, shown(watchlistCounties), 'counties');
  }

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    const spec = { requestId: 'DR-REAL-CMS-HCRIS', fromSysId: 'CMS_HCRIS' };
    try {
      await this.client.query(`DELETE FROM bw_dso.dso_facility_cost_report WHERE load_class='REAL'`);
      await this.client.query(`DELETE FROM bw_cube.cube_facility_distress_metric WHERE load_class='REAL'`);
      await this.client.query(`DELETE FROM bw_dso.dso_county_facility_rollup WHERE load_class='REAL'`);

      const allRows: FacilityRow[] = [];
      for (const state of config.ofrStates) {
        for (const [facilityType, uri] of [['hospital', config.hcrisHospitalCostReportUri], ['snf', config.hcrisSnfCostReportUri]] as const) {
          const id = newId('LH-HCRIS');
          await InsertLoadHistory(this.client, {
            load_history_id: id, data_request_id: spec.requestId, started_at: new Date(),
            source_uri: `${uri} (state=${state}, facilityType=${facilityType})`, load_class: 'REAL',
          });
          try {
            const { rows, raw } = await this.fetchFacilities(uri, facilityType, state);
            const bytes = Buffer.from(JSON.stringify(raw));
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const key = `psa/CMS_HCRIS/REAL/${stamp}/${SafeObjectSegment(state)}-${SafeObjectSegment(facilityType)}.json`;
            await psaStore.EnsureRootReady();
            const object = await psaStore.PutObject(key, bytes);
            await this.client.query(
              `INSERT INTO bw_psa_meta.object_index (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length)
               VALUES ($1,$2,$3,'REAL',$4,$5)`,
              [key, spec.fromSysId, id, object.contentHash, object.byteLength],
            );
            await this.writeFacilityRows(rows, spec.fromSysId, id);
            allRows.push(...rows);
            await CompleteLoadHistory(this.client, id, {
              status: 'SUCCEEDED', row_count: rows.length, content_hash: object.contentHash,
              as_of_date: new Date().toISOString().slice(0, 10),
              notes: `${rows.length} ${facilityType} cost-report facility-years for ${state}.`,
            });
          } catch (error) {
            await CompleteLoadHistory(this.client, id, { status: 'FAILED', notes: error instanceof Error ? error.message : String(error) });
            throw error;
          }
        }
      }

      const metricLoadHistoryId = newId('LH-HCRIS-METRICS');
      await InsertLoadHistory(this.client, {
        load_history_id: metricLoadHistoryId, data_request_id: spec.requestId, started_at: new Date(),
        source_uri: 'CMS HCRIS — computed facility-distress metrics', load_class: 'REAL',
      });
      for (const state of config.ofrStates) {
        await this.computeStateMetricsAndCounties(state, allRows, spec.fromSysId, metricLoadHistoryId);
      }
      await CompleteLoadHistory(this.client, metricLoadHistoryId, {
        status: 'SUCCEEDED', row_count: this.MetricCount, as_of_date: new Date().toISOString().slice(0, 10),
        notes: `${this.MetricCount} facility-distress metrics and ${this.CountyCount} county rollups computed.`,
      });

      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
