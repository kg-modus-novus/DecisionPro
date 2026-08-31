import AdmZip from 'adm-zip';
import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { SafeObjectSegment, Sha256 } from '../adapters/operationalPublicSources.js';

type FilingRow = {
  ein: string;
  taxPeriod: string;
  totalRevenue: number | null;
  totalExpenses: number | null;
  totalContributionsGrants: number | null;
  programServiceRevenue: number | null;
  adminCategoryExpense: number | null;
  unrestrictedNetAssetsEnd: number | null;
  totalAssetsEnd: number | null;
  totalLiabilitiesEnd: number | null;
};

const NEEDED_FIELDS = [
  'EIN', 'tax_pd', 'totrevenue', 'totfuncexpns', 'totcntrbgfts', 'totprgmrevnue',
  'unrstrctnetasstsend', 'totassetsend', 'totliabend',
  'compnsatncurrofcr', 'feesforsrvcmgmt', 'legalfees', 'accntingfees', 'feesforsrvclobby', 'feesforsrvcinvstmgmt', 'officexpns',
];

function numOrNull(raw: string | undefined): number | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

const shown = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Business Action: RetrieveAndLoadNonprofitFinancials
 * OFR-03. Ingests the IRS SOI annual Form 990 extract, filtered to the
 * KY+FL nonprofit universe already identified by the OFR-02 EO BMF identity
 * records — "990 extract rows for crosswalked orgs" per the plan, not the
 * full ~345k-row national file. State-neutral: one pass over one combined
 * filtered dataset produces both states' facts and metrics together.
 */
export class RetrieveAndLoadNonprofitFinancials {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  VintageCount = 0;
  FilingCount = 0;
  MetricCount = 0;

  constructor(private client: pg.PoolClient) {}

  private async loadEinUniverse(): Promise<Map<string, { state: string; orgName: string }>> {
    const rows = await this.client.query<{ identifier_value: string; state_code: string; org_name: string }>(
      `SELECT identifier_value, state_code, org_name FROM bw_dso.dso_identity_record
       WHERE load_class='REAL' AND identifier_type='EIN' AND from_sys_id='IRS_EO_BMF'`,
    );
    return new Map(rows.rows.map((r) => [r.identifier_value, { state: r.state_code, orgName: r.org_name }]));
  }

  private async fetchZipBytes(uri: string): Promise<Buffer> {
    let lastError = '';
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await fetch(uri, {
          headers: { 'User-Agent': 'DecisionProOFR-DataRequest/1.0 (+https://decisionpro.io/data-requests)' },
          signal: AbortSignal.timeout(300_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return Buffer.from(await res.arrayBuffer());
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
    throw new Error(`IRS 990 extract fetch failed for ${uri}: ${lastError}`);
  }

  private parseFilteredRows(rawCsvText: string, einUniverse: Map<string, unknown>): FilingRow[] {
    // Two real, live-observed vintage differences: the 24-vintage header
    // uses "EIN", the 23-vintage uses "ein" (and carries a leading UTF-8
    // BOM). Both are handled generically here rather than pinned to one
    // vintage's exact casing/encoding.
    const csvText = rawCsvText.charCodeAt(0) === 0xfeff ? rawCsvText.slice(1) : rawCsvText;
    const newlineIndex = csvText.indexOf('\n');
    const header = csvText.slice(0, newlineIndex).replace(/\r$/, '').split(',');
    const idx = new Map(header.map((name, i) => [name.toLowerCase(), i]));
    for (const field of NEEDED_FIELDS) {
      if (!idx.has(field.toLowerCase())) throw new Error(`IRS 990 extract missing expected field "${field}" — column layout may have changed`);
    }
    const einIdx = idx.get('ein')!;
    const out: FilingRow[] = [];
    let cursor = newlineIndex + 1;
    const length = csvText.length;
    while (cursor < length) {
      let end = csvText.indexOf('\n', cursor);
      if (end === -1) end = length;
      const line = csvText.slice(cursor, end).replace(/\r$/, '');
      cursor = end + 1;
      if (!line) continue;
      // Cheap pre-check on raw split before committing to full parse; the
      // 990 summary extract's numeric/coded fields never contain embedded
      // commas, so a plain split is safe and much faster than a quote-aware
      // parse across 345k rows.
      const cells = line.split(',');
      const ein = (cells[einIdx] || '').trim();
      if (!einUniverse.has(ein)) continue;
      const get = (name: string) => cells[idx.get(name)!];
      out.push({
        ein,
        taxPeriod: (get('tax_pd') || '').trim(),
        totalRevenue: numOrNull(get('totrevenue')),
        totalExpenses: numOrNull(get('totfuncexpns')),
        totalContributionsGrants: numOrNull(get('totcntrbgfts')),
        programServiceRevenue: numOrNull(get('totprgmrevnue')),
        adminCategoryExpense: [get('feesforsrvcmgmt'), get('legalfees'), get('accntingfees'), get('feesforsrvclobby'), get('feesforsrvcinvstmgmt'), get('officexpns')]
          .map(numOrNull).reduce((sum: number, v) => sum + (v || 0), 0),
        unrestrictedNetAssetsEnd: numOrNull(get('unrstrctnetasstsend')),
        totalAssetsEnd: numOrNull(get('totassetsend')),
        totalLiabilitiesEnd: numOrNull(get('totliabend')),
      });
    }
    return out;
  }

  private async writeFilingRows(vintage: string, rows: FilingRow[], universe: Map<string, { state: string; orgName: string }>, fromSysId: string, loadHistoryId: string) {
    const BATCH = 400;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values: unknown[] = [];
      const COLUMNS_PER_ROW = 13;
      const placeholders = batch.map((row, position) => {
        const base = position * COLUMNS_PER_ROW;
        const meta = universe.get(row.ein)!;
        values.push(
          row.ein, row.taxPeriod, vintage, row.totalRevenue, row.totalExpenses, row.totalContributionsGrants,
          row.programServiceRevenue, row.adminCategoryExpense, row.unrestrictedNetAssetsEnd,
          row.totalAssetsEnd, row.totalLiabilitiesEnd, meta.state, meta.orgName,
        );
        return `($${base + 1},$${base + 2},'990',$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},'${fromSysId}','REAL','${loadHistoryId}')`;
      });
      await this.client.query(
        `INSERT INTO bw_dso.dso_nonprofit_filing
         (ein,tax_period,form_type,extract_vintage,total_revenue,total_expenses,total_contributions_grants,
          program_service_revenue,admin_category_expense,unrestricted_net_assets_end,total_assets_end,
          total_liabilities_end,state_code,org_name,from_sys_id,load_class,load_history_id)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (ein, tax_period, extract_vintage, load_class, load_history_id) DO NOTHING`,
        values,
      );
    }
  }

  private async addMetric(state: string, fromSysId: string, loadHistoryId: string, metricId: string, label: string, value: number, display: string, unit: string) {
    await this.client.query(
      `INSERT INTO bw_cube.cube_nonprofit_resilience_metric
       (metric_id,state_code,metric_label,numeric_value,display_value,unit,as_of_date,from_sys_id,load_class,load_history_id)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,'REAL',$8)`,
      [metricId, state, label, value, display, unit, fromSysId, loadHistoryId],
    );
    this.MetricCount += 1;
  }

  private async computeStateMetrics(state: string, allFilings: FilingRow[], universe: Map<string, { state: string; orgName: string }>, fromSysId: string, loadHistoryId: string) {
    const filings = allFilings.filter((f) => universe.get(f.ein)?.state === state);
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-nonprofit-filings-count', 'Form 990 filing-period rows loaded', filings.length, shown(filings.length), 'filings');

    const liquidityMonths = filings
      .filter((f) => f.unrestrictedNetAssetsEnd != null && f.totalExpenses)
      .map((f) => (f.unrestrictedNetAssetsEnd! / (f.totalExpenses! / 12)));
    if (liquidityMonths.length) {
      const med = median(liquidityMonths);
      await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-nonprofit-median-liquidity-months', 'Median months of unrestricted net assets vs. average monthly expense', med, `${med.toFixed(1)} months`, 'months');
      const low = liquidityMonths.filter((m) => m < 3).length;
      await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-nonprofit-low-liquidity-count', 'Filings with under 3 months of unrestricted net-asset liquidity', low, shown(low), 'filings');
    }

    const dependencyRatios = filings
      .filter((f) => f.totalContributionsGrants != null && f.totalRevenue)
      .map((f) => f.totalContributionsGrants! / f.totalRevenue!);
    if (dependencyRatios.length) {
      const med = median(dependencyRatios);
      await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-nonprofit-median-contribution-dependency', 'Median contribution-and-grant revenue share of total revenue', med, pct(med), 'percent');
      const high = dependencyRatios.filter((r) => r >= 0.8).length;
      await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-nonprofit-high-dependency-count', 'Filings with contribution-and-grant revenue at 80%+ of total revenue', high, shown(high), 'filings');
    }

    const adminShares = filings
      .filter((f) => f.adminCategoryExpense != null && f.totalExpenses)
      .map((f) => f.adminCategoryExpense! / f.totalExpenses!);
    if (adminShares.length) {
      const med = median(adminShares);
      await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-nonprofit-median-admin-category-share', 'Median named-administrative-category expense share of total functional expenses', med, pct(med), 'percent');
    }
  }

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    const spec = { requestId: 'DR-REAL-IRS-990-EXTRACT', fromSysId: 'IRS_990_EXTRACT' };
    try {
      const universe = await this.loadEinUniverse();
      if (!universe.size) throw new Error('OFR-03 requires the OFR-02 IRS_EO_BMF identity universe to be loaded first (organization_crosswalk gates on OFR-02)');

      await this.client.query(`DELETE FROM bw_dso.dso_nonprofit_filing WHERE load_class='REAL'`);
      await this.client.query(`DELETE FROM bw_cube.cube_nonprofit_resilience_metric WHERE load_class='REAL'`);

      const allFilings: FilingRow[] = [];
      for (const { vintage, uri } of config.irs990ExtractUris) {
        const id = newId('LH-990');
        await InsertLoadHistory(this.client, {
          load_history_id: id, data_request_id: spec.requestId, started_at: new Date(),
          source_uri: uri, load_class: 'REAL',
        });
        try {
          const zipBytes = await this.fetchZipBytes(uri);
          const zip = new AdmZip(zipBytes);
          const entry = zip.getEntries()[0];
          if (!entry) throw new Error('IRS 990 extract ZIP contained no entries');
          const csvBytes = entry.getData();
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const key = `psa/IRS_990_EXTRACT/REAL/${stamp}/${SafeObjectSegment(vintage)}-${SafeObjectSegment(entry.entryName)}`;
          await psaStore.EnsureRootReady();
          const object = await psaStore.PutObject(key, csvBytes);
          await this.client.query(
            `INSERT INTO bw_psa_meta.object_index (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length)
             VALUES ($1,$2,$3,'REAL',$4,$5)`,
            [key, spec.fromSysId, id, object.contentHash, object.byteLength],
          );

          const rows = this.parseFilteredRows(csvBytes.toString('utf8'), universe);
          await this.writeFilingRows(vintage, rows, universe, spec.fromSysId, id);
          allFilings.push(...rows);
          this.FilingCount += rows.length;

          await CompleteLoadHistory(this.client, id, {
            status: 'SUCCEEDED', row_count: rows.length, content_hash: Sha256(csvBytes),
            as_of_date: new Date().toISOString().slice(0, 10),
            notes: `Vintage ${vintage}: ${rows.length} of the national extract's rows matched the OFR-02 KY+FL EIN universe (${universe.size} EINs).`,
          });
        } catch (error) {
          await CompleteLoadHistory(this.client, id, { status: 'FAILED', notes: error instanceof Error ? error.message : String(error) });
          throw error;
        }
        this.VintageCount += 1;
      }

      const metricLoadHistoryId = newId('LH-990-METRICS');
      await InsertLoadHistory(this.client, {
        load_history_id: metricLoadHistoryId, data_request_id: spec.requestId, started_at: new Date(),
        source_uri: 'IRS 990 extract — computed resilience metrics', load_class: 'REAL',
      });
      for (const state of config.ofrStates) {
        await this.computeStateMetrics(state, allFilings, universe, spec.fromSysId, metricLoadHistoryId);
      }
      await CompleteLoadHistory(this.client, metricLoadHistoryId, {
        status: 'SUCCEEDED', row_count: this.MetricCount, as_of_date: new Date().toISOString().slice(0, 10),
        notes: `${this.MetricCount} resilience metrics computed across ${config.ofrStates.length} states.`,
      });

      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
