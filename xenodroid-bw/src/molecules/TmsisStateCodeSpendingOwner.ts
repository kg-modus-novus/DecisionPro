// CodeXen-Container: v1 kind=object container=TmsisStateCodeSpendingOwner owns=state-code-spending-aggregate
import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { ParseCsvRecords, Sha256 } from '../adapters/operationalPublicSources.js';

/**
 * TmsisStateCodeSpendingOwner: owns the published state x HCPCS x year spending
 * aggregate (and the state x month totals beside it) staged from the HHS Open
 * Data "Medicaid Provider Spending by HCPCS" file (T-MSIS 2018-2024,
 * v2026-02-09). Plan: docs/planning/share-and-surge-screen-codexen-plan.md.
 *
 * Business Action:
 *   LoadStateCodeSpendingAggregate   read the staged files, retain them in PSA,
 *                                    reconcile them to the publisher total, and
 *                                    replace the REAL rows under one load history.
 *
 * Rules the owner enforces:
 *  - A state is the billing provider's NPPES practice state, else the servicing
 *    provider's, else UNMATCHED; UNMATCHED rows are loaded so every code-year
 *    still reconciles to the national total (the manifest's publisher total).
 *  - Provider identities are never loaded: the aggregate carries counts of
 *    billing NPIs, of NPIs new to the code in the state that year, and the paid
 *    share of the ten largest billers.
 *  - NPPES counts (item 9, 2026-11-08): of the new billers with a known
 *    enumeration date, those enumerated in the year or the year before
 *    (RECENT_ENUMERATION_WINDOW_YEARS) and their paid; of the billers with a
 *    known taxonomy, those outside the code's expected taxonomies and their paid.
 *    A code's expected taxonomies are the ones that, largest first, bill
 *    EXPECTED_TAXONOMY_PAID_COVERAGE of its national positive paid (from the
 *    data, the Director's choice). Staging computes them from the NPI rows; the
 *    owner refuses a stage made under another window or coverage, with a count
 *    above the count it is drawn from, or with two expected-taxonomy counts for
 *    one code. Paid is not bounded the same way: the publisher file carries
 *    negative adjustments, so a subset's paid can exceed its base's (about 190 of
 *    834,592 staged rows); only counts are bounded.
 *  - The staging script is this owner's staging adapter: it applies the NPPES
 *    rule to the NPI rows (identities never enter the warehouse) and writes the
 *    window and coverage to the manifest, which tmsis-nppes-rule-matches-owner
 *    binds to the constants here; it also names the NPPES copy it joined. The
 *    load records the rule and that label as a structured note
 *    (NPPES_RULE_NOTE_PREFIX) so an export names the rule and copy of its load.
 *  - The state x code x year paid must equal the state x month paid and the
 *    publisher total (less the set-aside rows) within the rounding tolerance,
 *    half a cent per staged row; otherwise the load fails and no row is replaced.
 *
 * Run cycle: one CLI process, one load history, one transaction around the
 * replace; no lock, retry or timer (nothing in the warehouse runs concurrently).
 */

export type StateCodeYearRow = {
  state_code: string;
  hcpcs: string;
  year: number;
  attribution: 'billing-or-servicing' | 'none';
  claim_lines: number;
  paid: number;
  patient_cells: number;
  cells: number;
  billing_npis: number;
  new_billing_npis: number;
  top10_paid: number;
  zero_paid_lines: number;
  new_billing_npis_enumeration_known: number;
  new_billing_npis_recently_enumerated: number;
  new_billing_recently_enumerated_paid: number;
  taxonomy_known_billing_npis: number;
  taxonomy_known_paid: number;
  off_taxonomy_billing_npis: number;
  off_taxonomy_paid: number;
  expected_taxonomies: number;
};

export type StateMonthRow = { state_code: string; month_ym: string; claim_lines: number; paid: number };

type StageManifest = {
  version: string;
  parquetSha256: string;
  publisherTotalPaid: number;
  setAsideRule: string;
  setAsideRows: number;
  setAsidePaid: number;
  keptTotalPaid: number;
  publisherRows: number;
  stateCodeYearRows: number;
  stateMonthRows: number;
  attributionRule: string;
  nppesMirror: string;
  datasetUri: string;
  recentEnumerationWindowYears: number;
  expectedTaxonomyPaidCoverage: number;
  nppesSourceLabel: string;
};

export type AccuracyCheck = { check_id: string; ok: boolean; expected: string; actual: string; detail: string };

const INITIAL_MANIFEST: StageManifest = {
  version: '', parquetSha256: '', publisherTotalPaid: 0, setAsideRule: '', setAsideRows: 0, setAsidePaid: 0, keptTotalPaid: 0,
  publisherRows: 0, stateCodeYearRows: 0, stateMonthRows: 0, attributionRule: '', nppesMirror: '', datasetUri: '',
  recentEnumerationWindowYears: 0, expectedTaxonomyPaidCoverage: 0, nppesSourceLabel: '',
};

export const TMSIS_FROM_SYS_ID = 'HHS_OPEN_DATA_TMSIS';
export const TMSIS_DATA_REQUEST_ID = 'DR-REAL-TMSIS-STATE-CODE-SPENDING';
export const TMSIS_AS_OF_DATE = '2026-02-09';
/** Each staged row is rounded to the cent, so the totals may differ by up to half a cent per row. */
export const RECONCILIATION_TOLERANCE_PER_ROW_USD = 0.005;
/** A new biller is recently enumerated when its NPI was enumerated in the year or the year before. */
export const RECENT_ENUMERATION_WINDOW_YEARS = 2;
/** A code expects the taxonomies that, largest first, bill this share of its national positive paid. */
export const EXPECTED_TAXONOMY_PAID_COVERAGE = 0.9;
/** The load's notes carry the NPPES rule it was made under after this prefix (one note, JSON). */
export const NPPES_RULE_NOTE_PREFIX = 'nppes-rule-json:';
const INSERT_BATCH = 1000;

/** Pure parse of the staged state x code x year CSV; rejects a row with a non-numeric amount. */
export function ParseStagedStateCodeYearCsv(text: string): StateCodeYearRow[] {
  const rows: StateCodeYearRow[] = [];
  for (const r of ParseCsvRecords(text)) {
    const num = (k: string) => {
      const raw = String(r[k] ?? '').trim();
      const n = raw === '' ? Number.NaN : Number(raw);
      if (!Number.isFinite(n)) throw new Error(`state_code_year.csv: non-numeric ${k} in ${r.yr}/${r.hcpcs}/${r.state}`);
      return n;
    };
    const state_code = String(r.state || '').trim();
    const hcpcs = String(r.hcpcs || '').trim();
    if (!state_code || !hcpcs) throw new Error('state_code_year.csv: empty state or hcpcs');
    rows.push({
      state_code, hcpcs, year: num('yr'),
      attribution: state_code === 'UNMATCHED' ? 'none' : 'billing-or-servicing',
      claim_lines: num('lines'), paid: num('paid'), patient_cells: num('patient_cells'), cells: num('cells'),
      billing_npis: num('billing_npis'), new_billing_npis: num('new_billing_npis'), top10_paid: num('top10_paid'),
      zero_paid_lines: num('zero_paid_lines'),
      new_billing_npis_enumeration_known: num('new_billing_npis_enumeration_known'),
      new_billing_npis_recently_enumerated: num('new_billing_npis_recently_enumerated'),
      new_billing_recently_enumerated_paid: num('new_billing_recently_enumerated_paid'),
      taxonomy_known_billing_npis: num('taxonomy_known_billing_npis'),
      taxonomy_known_paid: num('taxonomy_known_paid'),
      off_taxonomy_billing_npis: num('off_taxonomy_billing_npis'),
      off_taxonomy_paid: num('off_taxonomy_paid'),
      expected_taxonomies: num('expected_taxonomies'),
    });
  }
  return rows;
}

/** Pure parse of the staged state x month CSV. */
export function ParseStagedStateMonthCsv(text: string): StateMonthRow[] {
  const rows: StateMonthRow[] = [];
  for (const r of ParseCsvRecords(text)) {
    const paidRaw = String(r.paid ?? '').trim(); const linesRaw = String(r.lines ?? '').trim();
    const paid = paidRaw === '' ? Number.NaN : Number(paidRaw); const lines = linesRaw === '' ? Number.NaN : Number(linesRaw);
    const state_code = String(r.state || '').trim(); const month_ym = String(r.month || '').trim();
    if (!Number.isFinite(paid) || !Number.isFinite(lines) || !state_code || !/^\d{4}-\d{2}$/.test(month_ym)) {
      throw new Error(`state_month.csv: bad row ${JSON.stringify(r)}`);
    }
    rows.push({ state_code, month_ym, claim_lines: lines, paid });
  }
  return rows;
}

export class TmsisStateCodeSpendingOwner {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  LoadHistoryID = '';
  StageDirectory = config.tmsisStageDir;
  ManifestText = '';
  Manifest: StageManifest = { ...INITIAL_MANIFEST };
  ReconciliationIsClean = false;
  StateCodeYearBytes: Buffer = Buffer.alloc(0);
  StateMonthBytes: Buffer = Buffer.alloc(0);
  StateCodeYearPsaKey = '';
  StateMonthPsaKey = '';
  StateCodeYearRows: StateCodeYearRow[] = [];
  StateMonthRows: StateMonthRow[] = [];
  StateCodeYearPaidSum = 0;
  StateMonthPaidSum = 0;
  NppesCountsOutsideTheirBoundsRows = 0;
  CodesWithSeveralExpectedTaxonomyCounts = 0;
  TransactionIsOpen = false;
  StateCodeYearRowsInserted = 0;
  StateMonthRowsInserted = 0;
  RowsInserted = 0;
  Checks: AccuracyCheck[] = [];
  Notes: string[] = [];
  PsaStamp = '';
  AsOfDate = TMSIS_AS_OF_DATE;

  constructor(private client: pg.PoolClient) {}

  async LoadStateCodeSpendingAggregate() {
    if (this.Status !== 'INITIAL') return;
    this.InitializeLoadRunState();
    try {
      await this.ReadStageManifest();
      this.ParseStageManifest();
      await this.ReadStagedStateCodeYearFile();
      await this.ReadStagedStateMonthFile();
      await this.OpenLoadHistory();
      await this.RetainStateCodeYearInPsa();
      await this.IndexStateCodeYearPsaObject();
      await this.RetainStateMonthInPsa();
      await this.IndexStateMonthPsaObject();
      this.ParseStagedRows();
      this.ReconcileStagedTotals();
      this.CountNppesCountsOutsideTheirBounds();
      this.CountCodesWithSeveralExpectedTaxonomyCounts();
      this.ReconcileNppesCounts();
      this.IsReconciliationClean();
      await this.BeginReplaceTransaction();
      await this.DeleteStateCodeYearRows();
      await this.InsertStateCodeYearRows();
      await this.DeleteStateMonthRows();
      await this.InsertStateMonthRows();
      await this.CommitReplaceTransaction();
      await this.CompleteLoad();
      this.MarkLoadSucceeded();
      await this.FailLoad();
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
      await this.RollbackReplaceTransaction();
      await this.FailLoad();
    }
  }

  /** PASSIVE */
  private InitializeLoadRunState() {
    this.Status = 'RUNNING';
    this.ErrorMessage = '';
    this.LoadHistoryID = '';
    this.ManifestText = '';
    this.Manifest = { ...INITIAL_MANIFEST };
    this.ReconciliationIsClean = false;
    this.StateCodeYearBytes = Buffer.alloc(0);
    this.StateMonthBytes = Buffer.alloc(0);
    this.StateCodeYearPsaKey = '';
    this.StateMonthPsaKey = '';
    this.StateCodeYearRows = [];
    this.StateMonthRows = [];
    this.StateCodeYearPaidSum = 0;
    this.StateMonthPaidSum = 0;
    this.NppesCountsOutsideTheirBoundsRows = 0;
    this.CodesWithSeveralExpectedTaxonomyCounts = 0;
    this.StateCodeYearRowsInserted = 0;
    this.StateMonthRowsInserted = 0;
    this.RowsInserted = 0;
    this.Checks = [];
    this.Notes = [];
    this.TransactionIsOpen = false;
    this.PsaStamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.AsOfDate = TMSIS_AS_OF_DATE;
  }

  /** ACTIVE: the stage manifest text written by scripts/tmsis/stage_tmsis_aggregates.py. */
  private async ReadStageManifest() {
    if (this.ManifestText !== '') return;
    this.ManifestText = await fs.readFile(path.join(this.StageDirectory, 'manifest.json'), 'utf8');
    if (this.ManifestText.trim() === '') throw new Error(`manifest.json in ${this.StageDirectory} is empty`);
  }

  /** PASSIVE: the manifest typed, with the fields the reconciliation needs present. */
  private ParseStageManifest() {
    this.Manifest = { ...INITIAL_MANIFEST, ...(JSON.parse(this.ManifestText) as Partial<StageManifest>) };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.Manifest.version) || !(this.Manifest.publisherTotalPaid > 0) || !(this.Manifest.keptTotalPaid > 0)) {
      throw new Error(`manifest.json in ${this.StageDirectory} lacks a dated version, publisherTotalPaid or keptTotalPaid`);
    }
    // The publisher version date is the as-of date of every row loaded from it.
    this.AsOfDate = this.Manifest.version;
  }

  /** ACTIVE */
  private async ReadStagedStateCodeYearFile() {
    if (this.StateCodeYearBytes.length > 0) return;
    this.StateCodeYearBytes = await fs.readFile(path.join(this.StageDirectory, 'state_code_year.csv'));
    if (this.StateCodeYearBytes.length === 0) throw new Error('state_code_year.csv is empty');
  }

  /** ACTIVE */
  private async ReadStagedStateMonthFile() {
    if (this.StateMonthBytes.length > 0) return;
    this.StateMonthBytes = await fs.readFile(path.join(this.StageDirectory, 'state_month.csv'));
    if (this.StateMonthBytes.length === 0) throw new Error('state_month.csv is empty');
  }

  /** ACTIVE */
  private async OpenLoadHistory() {
    if (this.LoadHistoryID !== '') return;
    this.LoadHistoryID = newId('LH-TMSIS');
    await InsertLoadHistory(this.client, {
      load_history_id: this.LoadHistoryID,
      data_request_id: TMSIS_DATA_REQUEST_ID,
      started_at: new Date(),
      source_uri: this.Manifest.datasetUri || 'https://opendata.hhs.gov/datasets/medicaid-provider-spending',
      load_class: 'REAL',
    });
  }

  /** ACTIVE */
  private async RetainStateCodeYearInPsa() {
    if (this.StateCodeYearPsaKey !== '') return;
    const key = `psa/${TMSIS_FROM_SYS_ID}/REAL/${this.PsaStamp}/state_code_year.csv`;
    await psaStore.EnsureRootReady();
    const landed = await psaStore.PutObject(key, this.StateCodeYearBytes);
    if (landed.byteLength !== this.StateCodeYearBytes.length) throw new Error('PSA retained a short state_code_year.csv');
    this.StateCodeYearPsaKey = key;
  }

  /** ACTIVE */
  private async IndexStateCodeYearPsaObject() {
    if (this.StateCodeYearPsaKey === '') return;
    await this.client.query(
      `INSERT INTO bw_psa_meta.object_index (object_key, from_sys_id, load_history_id, load_class, content_hash, byte_length)
       VALUES ($1,$2,$3,'REAL',$4,$5)`,
      [this.StateCodeYearPsaKey, TMSIS_FROM_SYS_ID, this.LoadHistoryID, Sha256(this.StateCodeYearBytes), this.StateCodeYearBytes.length],
    );
  }

  /** ACTIVE */
  private async RetainStateMonthInPsa() {
    if (this.StateMonthPsaKey !== '') return;
    const key = `psa/${TMSIS_FROM_SYS_ID}/REAL/${this.PsaStamp}/state_month.csv`;
    const landed = await psaStore.PutObject(key, this.StateMonthBytes);
    if (landed.byteLength !== this.StateMonthBytes.length) throw new Error('PSA retained a short state_month.csv');
    this.StateMonthPsaKey = key;
  }

  /** ACTIVE */
  private async IndexStateMonthPsaObject() {
    if (this.StateMonthPsaKey === '') return;
    await this.client.query(
      `INSERT INTO bw_psa_meta.object_index (object_key, from_sys_id, load_history_id, load_class, content_hash, byte_length)
       VALUES ($1,$2,$3,'REAL',$4,$5)`,
      [this.StateMonthPsaKey, TMSIS_FROM_SYS_ID, this.LoadHistoryID, Sha256(this.StateMonthBytes), this.StateMonthBytes.length],
    );
  }

  /** PASSIVE */
  private ParseStagedRows() {
    this.StateCodeYearRows = ParseStagedStateCodeYearCsv(this.StateCodeYearBytes.toString('utf8'));
    this.StateMonthRows = ParseStagedStateMonthCsv(this.StateMonthBytes.toString('utf8'));
    this.StateCodeYearPaidSum = this.StateCodeYearRows.reduce((s, r) => s + r.paid, 0);
    this.StateMonthPaidSum = this.StateMonthRows.reduce((s, r) => s + r.paid, 0);
    this.Notes.push(`staged ${this.StateCodeYearRows.length} state-code-year rows and ${this.StateMonthRows.length} state-month rows from HHS v${this.Manifest.version} (parquet sha256 ${this.Manifest.parquetSha256.slice(0, 12)}); ${this.Manifest.attributionRule}; NPPES ${this.Manifest.nppesMirror}`);
  }

  /** PASSIVE: the three paid totals agree within the rounding tolerance (half a cent per staged row) and the row counts match the manifest. */
  private ReconcileStagedTotals() {
    const tolerance = RECONCILIATION_TOLERANCE_PER_ROW_USD * Math.max(this.StateCodeYearRows.length, this.StateMonthRows.length, 1);
    const within = (a: number, b: number) => Math.abs(a - b) <= tolerance;
    this.Checks.push({
      check_id: 'tmsis-state-code-year-vs-publisher-total', ok: within(this.StateCodeYearPaidSum, this.Manifest.keptTotalPaid),
      expected: this.Manifest.keptTotalPaid.toFixed(2), actual: this.StateCodeYearPaidSum.toFixed(2), detail: `sum of staged state x code x year paid (incl. UNMATCHED) vs publisher total less the set-aside (${this.Manifest.setAsideRows} rows, $${this.Manifest.setAsidePaid.toFixed(2)}: ${this.Manifest.setAsideRule})`,
    });
    this.Checks.push({
      check_id: 'tmsis-state-month-vs-publisher-total', ok: within(this.StateMonthPaidSum, this.Manifest.keptTotalPaid),
      expected: this.Manifest.keptTotalPaid.toFixed(2), actual: this.StateMonthPaidSum.toFixed(2), detail: 'sum of staged state x month paid vs publisher total less the set-aside',
    });
    this.Checks.push({
      check_id: 'tmsis-state-code-year-row-count', ok: this.StateCodeYearRows.length === this.Manifest.stateCodeYearRows,
      expected: String(this.Manifest.stateCodeYearRows), actual: String(this.StateCodeYearRows.length), detail: 'rows parsed vs manifest row count',
    });
    this.Checks.push({
      check_id: 'tmsis-state-month-row-count', ok: this.StateMonthRows.length === this.Manifest.stateMonthRows,
      expected: String(this.Manifest.stateMonthRows), actual: String(this.StateMonthRows.length), detail: 'rows parsed vs manifest row count',
    });
  }

  /** PASSIVE: staged rows where an NPPES count exceeds the count it is drawn from (recently enumerated over enumeration known over new billers; off-taxonomy over taxonomy known over billers). */
  private CountNppesCountsOutsideTheirBounds() {
    for (const r of this.StateCodeYearRows) {
      if (r.new_billing_npis_recently_enumerated > r.new_billing_npis_enumeration_known
        || r.new_billing_npis_enumeration_known > r.new_billing_npis
        || r.off_taxonomy_billing_npis > r.taxonomy_known_billing_npis
        || r.taxonomy_known_billing_npis > r.billing_npis
        || r.expected_taxonomies < 0) this.NppesCountsOutsideTheirBoundsRows += 1;
    }
  }

  /** PASSIVE: codes whose staged rows disagree on how many taxonomies the code expects (one figure per code). */
  private CountCodesWithSeveralExpectedTaxonomyCounts() {
    const byCode = new Map<string, Set<number>>();
    for (const r of this.StateCodeYearRows) {
      if (!byCode.has(r.hcpcs)) byCode.set(r.hcpcs, new Set());
      byCode.get(r.hcpcs)!.add(r.expected_taxonomies);
    }
    for (const counts of byCode.values()) if (counts.size > 1) this.CodesWithSeveralExpectedTaxonomyCounts += 1;
  }

  /** PASSIVE: the stage was made under the owner's NPPES rule, no NPPES count is outside its bounds, and each code has one expected-taxonomy count. */
  private ReconcileNppesCounts() {
    const stagedRule = `window ${this.Manifest.recentEnumerationWindowYears} years, coverage ${this.Manifest.expectedTaxonomyPaidCoverage}`;
    this.Checks.push({
      check_id: 'tmsis-nppes-rule-matches-owner',
      ok: this.Manifest.recentEnumerationWindowYears === RECENT_ENUMERATION_WINDOW_YEARS && this.Manifest.expectedTaxonomyPaidCoverage === EXPECTED_TAXONOMY_PAID_COVERAGE
        && this.Manifest.nppesSourceLabel.trim() !== '',
      expected: `window ${RECENT_ENUMERATION_WINDOW_YEARS} years, coverage ${EXPECTED_TAXONOMY_PAID_COVERAGE}`, actual: stagedRule,
      detail: 'the stage manifest\'s recent-enumeration window and expected-taxonomy coverage vs the owner\'s rule, and the NPPES copy it names',
    });
    this.Checks.push({
      check_id: 'tmsis-nppes-counts-within-base', ok: this.NppesCountsOutsideTheirBoundsRows === 0,
      expected: '0', actual: String(this.NppesCountsOutsideTheirBoundsRows), detail: 'staged rows with an NPPES count above the count it is drawn from, or a negative expected-taxonomy count',
    });
    this.Checks.push({
      check_id: 'tmsis-nppes-expected-taxonomies-one-per-code', ok: this.CodesWithSeveralExpectedTaxonomyCounts === 0,
      expected: '0', actual: String(this.CodesWithSeveralExpectedTaxonomyCounts), detail: 'codes whose staged rows disagree on the expected-taxonomy count',
    });
    this.Notes.push(`${NPPES_RULE_NOTE_PREFIX}${JSON.stringify({ recentEnumerationWindowYears: RECENT_ENUMERATION_WINDOW_YEARS, expectedTaxonomyPaidCoverage: EXPECTED_TAXONOMY_PAID_COVERAGE, source: this.Manifest.nppesSourceLabel })}`);
  }

  /** PASSIVE question: writes ReconciliationIsClean; when it is not, records the failure so no row is replaced. */
  private IsReconciliationClean() {
    const failed = this.Checks.filter((c) => !c.ok);
    this.ReconciliationIsClean = failed.length === 0;
    if (this.ReconciliationIsClean) return;
    this.Status = 'FAILED';
    this.ErrorMessage = `reconciliation failed: ${failed.map((c) => c.check_id).join(', ')}`;
  }

  /** ACTIVE */
  private async BeginReplaceTransaction() {
    if (!this.ReconciliationIsClean || this.TransactionIsOpen) return;
    await this.client.query('BEGIN');
    this.TransactionIsOpen = true;
  }

  /** ACTIVE */
  private async DeleteStateCodeYearRows() {
    if (!this.TransactionIsOpen) return;
    await this.client.query(`DELETE FROM bw_dso.dso_tmsis_state_code_year WHERE load_class = 'REAL'`);
  }

  /** ACTIVE: one multi-row insert per batch (the warehouse's batched-insert convention). */
  private async InsertStateCodeYearRows() {
    if (!this.TransactionIsOpen) return;
    const cols = 24;
    for (let i = 0; i < this.StateCodeYearRows.length; i += INSERT_BATCH) {
      const rows = this.StateCodeYearRows.slice(i, i + INSERT_BATCH);
      const values: unknown[] = [];
      const tuples = rows.map((r, j) => {
        const b = j * cols;
        values.push(r.state_code, r.hcpcs, r.year, r.attribution, r.claim_lines, r.paid, r.patient_cells, r.cells,
          r.billing_npis, r.new_billing_npis, r.top10_paid, r.zero_paid_lines,
          r.new_billing_npis_enumeration_known, r.new_billing_npis_recently_enumerated, r.new_billing_recently_enumerated_paid,
          r.taxonomy_known_billing_npis, r.taxonomy_known_paid, r.off_taxonomy_billing_npis, r.off_taxonomy_paid, r.expected_taxonomies,
          TMSIS_FROM_SYS_ID, this.AsOfDate, 'REAL', this.LoadHistoryID);
        return `(${Array.from({ length: cols }, (_, k) => `$${b + k + 1}${k === 21 ? '::date' : ''}`).join(',')})`;
      });
      const result = await this.client.query(
        `INSERT INTO bw_dso.dso_tmsis_state_code_year
          (state_code, hcpcs, year, attribution, claim_lines, paid, patient_cells, cells, billing_npis, new_billing_npis,
           top10_paid, zero_paid_lines,
           new_billing_npis_enumeration_known, new_billing_npis_recently_enumerated, new_billing_recently_enumerated_paid,
           taxonomy_known_billing_npis, taxonomy_known_paid, off_taxonomy_billing_npis, off_taxonomy_paid, expected_taxonomies,
           from_sys_id, as_of_date, load_class, load_history_id)
         VALUES ${tuples.join(',')}`,
        values,
      );
      this.StateCodeYearRowsInserted += result.rowCount ?? 0;
    }
    if (this.StateCodeYearRowsInserted < this.StateCodeYearRows.length) throw new Error(`inserted ${this.StateCodeYearRowsInserted} of ${this.StateCodeYearRows.length} state-code-year rows`);
  }

  /** ACTIVE */
  private async DeleteStateMonthRows() {
    if (!this.TransactionIsOpen) return;
    await this.client.query(`DELETE FROM bw_dso.dso_tmsis_state_month WHERE load_class = 'REAL'`);
  }

  /** ACTIVE */
  private async InsertStateMonthRows() {
    if (!this.TransactionIsOpen) return;
    const cols = 8;
    for (let i = 0; i < this.StateMonthRows.length; i += INSERT_BATCH) {
      const rows = this.StateMonthRows.slice(i, i + INSERT_BATCH);
      const values: unknown[] = [];
      const tuples = rows.map((r, j) => {
        const b = j * cols;
        values.push(r.state_code, r.month_ym, r.claim_lines, r.paid, TMSIS_FROM_SYS_ID, this.AsOfDate, 'REAL', this.LoadHistoryID);
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6}::date,$${b + 7},$${b + 8})`;
      });
      const result = await this.client.query(
        `INSERT INTO bw_dso.dso_tmsis_state_month (state_code, month_ym, claim_lines, paid, from_sys_id, as_of_date, load_class, load_history_id)
         VALUES ${tuples.join(',')}`,
        values,
      );
      this.StateMonthRowsInserted += result.rowCount ?? 0;
    }
    if (this.StateMonthRowsInserted < this.StateMonthRows.length) throw new Error(`inserted ${this.StateMonthRowsInserted} of ${this.StateMonthRows.length} state-month rows`);
    this.RowsInserted = this.StateCodeYearRowsInserted + this.StateMonthRowsInserted;
  }

  /** ACTIVE */
  private async CommitReplaceTransaction() {
    if (!this.TransactionIsOpen) return;
    await this.client.query('COMMIT');
    this.TransactionIsOpen = false;
  }

  /** ACTIVE (error path only) */
  private async RollbackReplaceTransaction() {
    if (!this.TransactionIsOpen) return;
    await this.client.query('ROLLBACK');
    this.TransactionIsOpen = false;
  }

  /** ACTIVE */
  private async CompleteLoad() {
    if (this.LoadHistoryID === '' || this.Status !== 'RUNNING') return;
    await CompleteLoadHistory(this.client, this.LoadHistoryID, {
      status: 'SUCCEEDED', row_count: this.RowsInserted, content_hash: this.Manifest.parquetSha256, as_of_date: this.AsOfDate,
      notes: this.Notes.join(' | '),
    });
  }

  /** PASSIVE: the run reached its end with reconciliation clean. */
  private MarkLoadSucceeded() {
    if (this.Status !== 'RUNNING') return;
    this.Status = 'SUCCEEDED';
  }

  /** ACTIVE (failed runs only) */
  private async FailLoad() {
    if (this.LoadHistoryID === '' || this.Status !== 'FAILED') return;
    await CompleteLoadHistory(this.client, this.LoadHistoryID, { status: 'FAILED', notes: this.ErrorMessage });
  }
}
