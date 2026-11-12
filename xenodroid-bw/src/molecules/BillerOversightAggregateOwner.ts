// CodeXen-Container: v1 kind=object container=BillerOversightAggregateOwner owns=biller-oversight-aggregate
import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { ParseCsvRecords, Sha256 } from '../adapters/operationalPublicSources.js';
import { TMSIS_DATA_REQUEST_ID, TMSIS_FROM_SYS_ID } from './TmsisStateCodeSpendingOwner.js';
import { SCREEN_DATA_REQUEST_ID } from './ShareAndSurgeCandidateOwner.js';

/**
 * BillerOversightAggregateOwner: owns the biller oversight aggregate staged by
 * scripts/tmsis/stage_oversight_aggregates.py from the HHS Open Data "Medicaid
 * Provider Spending by HCPCS" file joined to NPPES: the screen's state x code
 * series by month, the biller groups followed across every service they bill,
 * the latest year's biller profiles and practice areas, and the codes' labels.
 * Plan: docs/planning/oversight-pages-codexen-plan.md.
 *
 * Business Action:
 *   LoadBillerOversightAggregate   read the staged files, retain them in PSA,
 *                                  reconcile them, and replace the REAL rows
 *                                  under one load history.
 *
 * Rules the owner enforces:
 *  - No provider identity is loaded: counts and dollars only.
 *  - The stage names the screen load its groups and series come from, and that
 *    is the latest SUCCEEDED share-and-surge screen load, so the pages and the
 *    radar describe one screen.
 *  - The groups staged are exactly the screen's qualifying groups (GROUP_PATTERNS,
 *    GROUP_MIN_STATE_PAID, GROUP_MIN_BILLERS), and every month series is for a
 *    state x code the screen names.
 *  - Each file's row count and sha256 are the manifest's.
 *  - A state x code's months add up to its loaded yearly paid (the latest
 *    SUCCEEDED spending load) within MONTH_RECONCILIATION_TOLERANCE_USD a year,
 *    and a code's national months add up to its loaded paid in every state and
 *    unmatched rows that year.
 *  - A group has no more members than the billers loaded for its state, code
 *    and year, and all its members bill in its own year.
 *  - A profile's six cohorts add up to its billers, and it has no more billers
 *    than are loaded for its state, code and year.
 *
 * Run cycle: one CLI process, one load history, one transaction around the
 * replace and the SUCCEEDED status; no lock, retry or timer. The warehouse
 * loaders have no architecture record yet (docs/CODEXEN-SCOPE.md, open for the
 * Director); this owner assumes one CLI load at a time, as every loader does.
 */

export const OVERSIGHT_DATA_REQUEST_ID = 'DR-REAL-BILLER-OVERSIGHT';
/** The groups followed: the billers of a service the screen found surging or tripling, in a year it paid at least GROUP_MIN_STATE_PAID to at least GROUP_MIN_BILLERS billers. */
export const GROUP_PATTERNS = Object.freeze(['share-surge', 'tripled-and-growing']);
export const GROUP_MIN_STATE_PAID = 5_000_000;
export const GROUP_MIN_BILLERS = 11;
/** The qualifying groups of one screen load ($1), as state, hcpcs, year. Shared by the CLI that writes the stage's groups.csv and by the owner's check. */
export const QUALIFYING_GROUPS_SQL = `SELECT DISTINCT state_code AS state, hcpcs, year FROM bw_dso.dso_share_surge_candidate
  WHERE load_class = 'REAL' AND load_history_id = $1 AND pattern = ANY($2::text[]) AND state_paid >= $3 AND billing_npis >= $4
  ORDER BY 1, 2, 3`;
/** Every state x code the screen load ($1) names: the stage's monthly series keys. */
export const SCREEN_STATE_CODES_SQL = `SELECT DISTINCT state_code AS state, hcpcs FROM bw_dso.dso_share_surge_candidate
  WHERE load_class = 'REAL' AND load_history_id = $1 ORDER BY 1, 2`;
/** Twelve months each rounded to the cent, against a yearly figure rounded to the cent: well inside a dollar. */
export const MONTH_RECONCILIATION_TOLERANCE_USD = 1;
/** The cohorts a profile's billers fall in: when they first billed the code in the state, and whether they depend on it. */
export const PROFILE_COHORTS = Object.freeze(['established-depends', 'established-other', 'year-before-depends', 'year-before-other', 'year-depends', 'year-other']);
/** The staged files, in load order. */
export const OVERSIGHT_FILES = Object.freeze(['state_code_month.csv', 'code_month.csv', 'biller_group_year.csv', 'biller_group_service.csv', 'biller_profile.csv', 'biller_profile_area.csv', 'code_labels.csv']);
const INSERT_BATCH = 1000;

export type StateCodeMonthRow = { state_code: string; hcpcs: string; month_ym: string; paid: number; billing_npis: number };
export type CodeMonthRow = { hcpcs: string; month_ym: string; paid: number };
export type GroupYearRow = { group_state: string; group_hcpcs: string; group_year: number; year: number; members: number; members_billing: number; members_paid: number; members_code_paid: number };
export type GroupServiceRow = { group_state: string; group_hcpcs: string; group_year: number; hcpcs: string; year: number; members_billing: number; paid: number };
export type ProfileMeasureRow = { state_code: string; hcpcs: string; year: number; measure: string; count_value: number; paid: number };
export type ProfileAreaRow = { state_code: string; hcpcs: string; year: number; zip3: string; city: string; billers: number; paid: number };
export type CodeLabelRow = { hcpcs: string; label: string };
export type AccuracyCheck = { check_id: string; ok: boolean; expected: string; actual: string; detail: string };

type FileStats = { rows: number; sha256: string };
type OversightManifest = {
  version: string;
  screenLoadHistoryId: string;
  latestYear: number;
  nppes: string;
  files: Record<string, FileStats>;
  codeLabels: FileStats;
  parameters: Record<string, number>;
};
const INITIAL_MANIFEST: OversightManifest = { version: '', screenLoadHistoryId: '', latestYear: 0, nppes: '', files: {}, codeLabels: { rows: 0, sha256: '' }, parameters: {} };

/** A number from a staged cell; a blank or non-numeric cell is refused. */
function StagedNumber(file: string, r: Record<string, string>, k: string): number {
  const raw = String(r[k] ?? '').trim();
  const n = raw === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${file}: non-numeric ${k} in ${JSON.stringify(r)}`);
  return n;
}

/** A text cell that must not be empty. */
function StagedText(file: string, r: Record<string, string>, k: string): string {
  const v = String(r[k] ?? '').trim();
  if (v === '') throw new Error(`${file}: empty ${k} in ${JSON.stringify(r)}`);
  return v;
}

export function ParseStagedStateCodeMonthCsv(text: string): StateCodeMonthRow[] {
  const f = 'state_code_month.csv';
  return ParseCsvRecords(text).map((r) => {
    const month_ym = StagedText(f, r, 'month');
    if (!/^\d{4}-\d{2}$/.test(month_ym)) throw new Error(`${f}: bad month ${month_ym}`);
    return { state_code: StagedText(f, r, 'state'), hcpcs: StagedText(f, r, 'hcpcs'), month_ym, paid: StagedNumber(f, r, 'paid'), billing_npis: StagedNumber(f, r, 'billing_npis') };
  });
}

export function ParseStagedCodeMonthCsv(text: string): CodeMonthRow[] {
  const f = 'code_month.csv';
  return ParseCsvRecords(text).map((r) => {
    const month_ym = StagedText(f, r, 'month');
    if (!/^\d{4}-\d{2}$/.test(month_ym)) throw new Error(`${f}: bad month ${month_ym}`);
    return { hcpcs: StagedText(f, r, 'hcpcs'), month_ym, paid: StagedNumber(f, r, 'paid') };
  });
}

export function ParseStagedGroupYearCsv(text: string): GroupYearRow[] {
  const f = 'biller_group_year.csv';
  return ParseCsvRecords(text).map((r) => ({
    group_state: StagedText(f, r, 'group_state'), group_hcpcs: StagedText(f, r, 'group_hcpcs'), group_year: StagedNumber(f, r, 'group_year'),
    year: StagedNumber(f, r, 'yr'), members: StagedNumber(f, r, 'members'), members_billing: StagedNumber(f, r, 'members_billing'),
    members_paid: StagedNumber(f, r, 'members_paid'), members_code_paid: StagedNumber(f, r, 'members_code_paid'),
  }));
}

export function ParseStagedGroupServiceCsv(text: string): GroupServiceRow[] {
  const f = 'biller_group_service.csv';
  return ParseCsvRecords(text).map((r) => ({
    group_state: StagedText(f, r, 'group_state'), group_hcpcs: StagedText(f, r, 'group_hcpcs'), group_year: StagedNumber(f, r, 'group_year'),
    hcpcs: StagedText(f, r, 'hcpcs'), year: StagedNumber(f, r, 'yr'), members_billing: StagedNumber(f, r, 'members_billing'), paid: StagedNumber(f, r, 'paid'),
  }));
}

/** The staged profile columns each measure is drawn from: [count column, paid column]; a measure with no paid reads 0. */
export const PROFILE_MEASURE_COLUMNS: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  billers: ['billers', 'paid'],
  'established-depends': ['established_depends_billers', 'established_depends_paid'],
  'established-other': ['established_other_billers', 'established_other_paid'],
  'year-before-depends': ['year_before_depends_billers', 'year_before_depends_paid'],
  'year-before-other': ['year_before_other_billers', 'year_before_other_paid'],
  'year-depends': ['year_depends_billers', 'year_depends_paid'],
  'year-other': ['year_other_billers', 'year_other_paid'],
  'no-payment-before-year-before': ['no_payment_before_billers', 'no_payment_before_paid'],
  'recently-enumerated': ['recently_enumerated_billers', 'recently_enumerated_paid'],
  million: ['million_billers', ''],
  'million-fast': ['million_billers_fast', ''],
  'million-median-months': ['million_median_months', ''],
  'shared-address': ['shared_address_billers', 'shared_address_paid'],
  'shared-addresses': ['shared_addresses', ''],
  top10: ['', 'top10_paid'],
  organization: ['organization_billers', ''],
  individual: ['individual_billers', ''],
});

/** One wide staged profile row as one measure row per PROFILE_MEASURE_COLUMNS entry. A median of no billers is blank and reads 0. */
export function ParseStagedProfileCsv(text: string): ProfileMeasureRow[] {
  const f = 'biller_profile.csv';
  const rows: ProfileMeasureRow[] = [];
  for (const r of ParseCsvRecords(text)) {
    const state_code = StagedText(f, r, 'state'); const hcpcs = StagedText(f, r, 'hcpcs'); const year = StagedNumber(f, r, 'yr');
    const billers = StagedNumber(f, r, 'billers');
    for (const [measure, [countColumn, paidColumn]] of Object.entries(PROFILE_MEASURE_COLUMNS)) {
      const count_value = countColumn === '' ? Math.min(10, billers)
        : measure === 'million-median-months' && String(r[countColumn] ?? '').trim() === '' ? 0 : StagedNumber(f, r, countColumn);
      rows.push({ state_code, hcpcs, year, measure, count_value, paid: paidColumn === '' ? 0 : StagedNumber(f, r, paidColumn) });
    }
  }
  return rows;
}

export function ParseStagedProfileAreaCsv(text: string): ProfileAreaRow[] {
  const f = 'biller_profile_area.csv';
  return ParseCsvRecords(text).map((r) => ({
    state_code: StagedText(f, r, 'state'), hcpcs: StagedText(f, r, 'hcpcs'), year: StagedNumber(f, r, 'yr'),
    zip3: String(r.zip3 ?? '').trim(), city: String(r.city ?? '').trim(), billers: StagedNumber(f, r, 'billers'), paid: StagedNumber(f, r, 'paid'),
  }));
}

export function ParseStagedCodeLabelCsv(text: string): CodeLabelRow[] {
  const f = 'code_labels.csv';
  return ParseCsvRecords(text).map((r) => ({ hcpcs: StagedText(f, r, 'hcpcs'), label: StagedText(f, r, 'label') }));
}

/** Low-level utility: insert rows in batches of INSERT_BATCH with one multi-row insert each; the rows inserted. */
async function InsertRowsInBatches(client: pg.PoolClient, table: string, columns: readonly string[], dateColumn: string, rows: unknown[][]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);
    const values: unknown[] = [];
    const tuples = batch.map((row, j) => {
      values.push(...row);
      return `(${columns.map((c, k) => `$${j * columns.length + k + 1}${c === dateColumn ? '::date' : ''}`).join(',')})`;
    });
    const result = await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(',')}`, values);
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

const PROVENANCE_COLUMNS = ['from_sys_id', 'as_of_date', 'load_class', 'load_history_id'] as const;

export class BillerOversightAggregateOwner {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  LoadHistoryID = '';
  StageDirectory = config.oversightStageDir;
  ManifestText = '';
  Manifest: OversightManifest = { ...INITIAL_MANIFEST };
  FileBytes: Record<string, Buffer> = {};
  FilePsaKeys: Record<string, string> = {};
  LatestScreenLoadHistoryId = '';
  LatestSpendingLoadHistoryId = '';
  QualifyingGroupKeys = new Set<string>();
  ScreenStateCodeKeys = new Set<string>();
  LoadedYearlyPaid = new Map<string, number>();
  LoadedYearlyBillers = new Map<string, number>();
  LoadedNationalPaid = new Map<string, number>();
  MonthRows: StateCodeMonthRow[] = [];
  CodeMonthRows: CodeMonthRow[] = [];
  GroupYearRows: GroupYearRow[] = [];
  GroupServiceRows: GroupServiceRow[] = [];
  ProfileMeasureRows: ProfileMeasureRow[] = [];
  ProfileAreaRows: ProfileAreaRow[] = [];
  CodeLabelRows: CodeLabelRow[] = [];
  MonthSeriesOffTheirYears = 0;
  CodeMonthsOffTheirYears = 0;
  GroupsOffTheRule = 0;
  MonthSeriesOffTheScreen = 0;
  GroupsAboveTheirBillers = 0;
  GroupsNotWholeInTheirYear = 0;
  ProfilesWhoseCohortsDoNotAdd = 0;
  ProfilesAboveTheirBillers = 0;
  Checks: AccuracyCheck[] = [];
  Notes: string[] = [];
  ReconciliationIsClean = false;
  TransactionIsOpen = false;
  MonthRowsInserted = 0;
  CodeMonthRowsInserted = 0;
  GroupYearRowsInserted = 0;
  GroupServiceRowsInserted = 0;
  ProfileMeasureRowsInserted = 0;
  ProfileAreaRowsInserted = 0;
  CodeLabelRowsInserted = 0;
  RowsInserted = 0;
  RowProvenance: unknown[] = [];
  PsaStamp = '';
  AsOfDate = '';

  constructor(private client: pg.PoolClient) {}

  async LoadBillerOversightAggregate() {
    if (this.Status !== 'INITIAL') return;
    this.InitializeLoadRunState();
    try {
      await this.ReadStageManifest();
      this.ParseStageManifest();
      await this.ReadStagedFiles();
      await this.ReadLatestScreenLoad();
      await this.ReadQualifyingGroups();
      await this.ReadScreenStateCodes();
      await this.ReadLatestSpendingLoad();
      await this.ReadLoadedYearlyFigures();
      await this.OpenLoadHistory();
      this.StampRowProvenance();
      await this.RetainStagedFilesInPsa();
      await this.IndexStagedPsaObjects();
      this.ParseStagedRows();
      this.ReconcileStagedFiles();
      this.CountMonthSeriesOffTheirYears();
      this.CountCodeMonthsOffTheirYears();
      this.CountGroupsOffTheRule();
      this.CountMonthSeriesOffTheScreen();
      this.CountGroupsAboveTheirBillers();
      this.CountGroupsNotWholeInTheirYear();
      this.CountProfilesWhoseCohortsDoNotAdd();
      this.CountProfilesAboveTheirBillers();
      this.ReconcileAgainstSpendingAggregate();
      this.IsReconciliationClean();
      this.MarkReconciliationFailed();
      await this.BeginReplaceTransaction();
      await this.DeleteOversightRows();
      await this.InsertMonthRows();
      await this.InsertCodeMonthRows();
      await this.InsertGroupYearRows();
      await this.InsertGroupServiceRows();
      await this.InsertProfileMeasureRows();
      await this.InsertProfileAreaRows();
      await this.InsertCodeLabelRows();
      this.CountRowsInserted();
      await this.CompleteLoad();
      await this.CommitReplaceTransaction();
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
    this.FileBytes = {};
    this.FilePsaKeys = {};
    this.LatestScreenLoadHistoryId = '';
    this.LatestSpendingLoadHistoryId = '';
    this.QualifyingGroupKeys = new Set();
    this.ScreenStateCodeKeys = new Set();
    this.LoadedYearlyPaid = new Map();
    this.LoadedYearlyBillers = new Map();
    this.LoadedNationalPaid = new Map();
    this.MonthRows = [];
    this.CodeMonthRows = [];
    this.GroupYearRows = [];
    this.GroupServiceRows = [];
    this.ProfileMeasureRows = [];
    this.ProfileAreaRows = [];
    this.CodeLabelRows = [];
    this.MonthSeriesOffTheirYears = 0;
    this.CodeMonthsOffTheirYears = 0;
    this.GroupsOffTheRule = 0;
    this.MonthSeriesOffTheScreen = 0;
    this.GroupsAboveTheirBillers = 0;
    this.GroupsNotWholeInTheirYear = 0;
    this.ProfilesWhoseCohortsDoNotAdd = 0;
    this.ProfilesAboveTheirBillers = 0;
    this.Checks = [];
    this.Notes = [];
    this.ReconciliationIsClean = false;
    this.TransactionIsOpen = false;
    this.MonthRowsInserted = 0;
    this.CodeMonthRowsInserted = 0;
    this.GroupYearRowsInserted = 0;
    this.GroupServiceRowsInserted = 0;
    this.ProfileMeasureRowsInserted = 0;
    this.ProfileAreaRowsInserted = 0;
    this.CodeLabelRowsInserted = 0;
    this.RowsInserted = 0;
    this.RowProvenance = [];
    this.PsaStamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.AsOfDate = '';
  }

  /** ACTIVE: the manifest written by scripts/tmsis/stage_oversight_aggregates.py. */
  private async ReadStageManifest() {
    if (this.ManifestText !== '') return;
    this.ManifestText = await fs.readFile(path.join(this.StageDirectory, 'manifest.json'), 'utf8');
    if (this.ManifestText.trim() === '') throw new Error(`manifest.json in ${this.StageDirectory} is empty`);
  }

  /** PASSIVE: the manifest typed, with a dated version, a screen load and every file's statistics present. */
  private ParseStageManifest() {
    this.Manifest = { ...INITIAL_MANIFEST, ...(JSON.parse(this.ManifestText) as Partial<OversightManifest>) };
    const missing = OVERSIGHT_FILES.filter((f) => f !== 'code_labels.csv' && !(this.Manifest.files?.[f]?.sha256));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.Manifest.version) || this.Manifest.screenLoadHistoryId === '' || missing.length > 0 || !this.Manifest.codeLabels?.sha256) {
      throw new Error(`manifest.json in ${this.StageDirectory} lacks a dated version, the screen load, or file statistics (${missing.join(', ')})`);
    }
    this.AsOfDate = this.Manifest.version;
  }

  /** ACTIVE: every staged file, read whole. */
  private async ReadStagedFiles() {
    for (const f of OVERSIGHT_FILES) {
      if (this.FileBytes[f]) continue;
      this.FileBytes[f] = await fs.readFile(path.join(this.StageDirectory, f));
      if (this.FileBytes[f].length === 0) throw new Error(`${f} is empty`);
    }
  }

  /** ACTIVE: the latest SUCCEEDED share-and-surge screen load. */
  private async ReadLatestScreenLoad() {
    if (this.LatestScreenLoadHistoryId !== '') return;
    const r = await this.client.query(
      `SELECT load_history_id FROM bw_ctl.load_history WHERE data_request_id = $1 AND status = 'SUCCEEDED' AND load_class = 'REAL' ORDER BY completed_at DESC LIMIT 1`,
      [SCREEN_DATA_REQUEST_ID],
    );
    this.LatestScreenLoadHistoryId = r.rows[0]?.load_history_id ?? '';
  }

  /** ACTIVE: the screen's qualifying groups, from the latest screen load. */
  private async ReadQualifyingGroups() {
    if (this.LatestScreenLoadHistoryId === '' || this.QualifyingGroupKeys.size > 0) return;
    const r = await this.client.query(QUALIFYING_GROUPS_SQL, [this.LatestScreenLoadHistoryId, GROUP_PATTERNS, GROUP_MIN_STATE_PAID, GROUP_MIN_BILLERS]);
    this.QualifyingGroupKeys = new Set(r.rows.map((g) => `${g.state}|${g.hcpcs}|${g.year}`));
  }

  /** ACTIVE: every state x code the latest screen load names. */
  private async ReadScreenStateCodes() {
    if (this.LatestScreenLoadHistoryId === '' || this.ScreenStateCodeKeys.size > 0) return;
    const r = await this.client.query(SCREEN_STATE_CODES_SQL, [this.LatestScreenLoadHistoryId]);
    this.ScreenStateCodeKeys = new Set(r.rows.map((g) => `${g.state}|${g.hcpcs}`));
  }

  /** ACTIVE: the latest SUCCEEDED state-code spending load. */
  private async ReadLatestSpendingLoad() {
    if (this.LatestSpendingLoadHistoryId !== '') return;
    const r = await this.client.query(
      `SELECT load_history_id FROM bw_ctl.load_history WHERE data_request_id = $1 AND status = 'SUCCEEDED' AND load_class = 'REAL' ORDER BY completed_at DESC LIMIT 1`,
      [TMSIS_DATA_REQUEST_ID],
    );
    this.LatestSpendingLoadHistoryId = r.rows[0]?.load_history_id ?? '';
    if (this.LatestSpendingLoadHistoryId === '') throw new Error('no SUCCEEDED state-code spending load to reconcile against');
  }

  /** ACTIVE: the spending owner's yearly paid and billers per state, code and year, and each code's paid in every state and unmatched rows per year, from its latest load. */
  private async ReadLoadedYearlyFigures() {
    if (this.LoadedYearlyPaid.size > 0) return;
    const r = await this.client.query(
      `SELECT state_code, hcpcs, year, paid::float8 AS paid, billing_npis FROM bw_dso.dso_tmsis_state_code_year WHERE load_class = 'REAL' AND load_history_id = $1`,
      [this.LatestSpendingLoadHistoryId],
    );
    for (const row of r.rows) {
      const k = `${row.state_code}|${row.hcpcs}|${row.year}`;
      this.LoadedYearlyPaid.set(k, Number(row.paid));
      this.LoadedYearlyBillers.set(k, Number(row.billing_npis));
      const n = `${row.hcpcs}|${row.year}`;
      this.LoadedNationalPaid.set(n, (this.LoadedNationalPaid.get(n) ?? 0) + Number(row.paid));
    }
  }

  /** ACTIVE */
  private async OpenLoadHistory() {
    if (this.LoadHistoryID !== '') return;
    this.LoadHistoryID = newId('LH-OVERSIGHT');
    await InsertLoadHistory(this.client, {
      load_history_id: this.LoadHistoryID,
      data_request_id: OVERSIGHT_DATA_REQUEST_ID,
      started_at: new Date(),
      source_uri: 'https://opendata.hhs.gov/datasets/medicaid-provider-spending',
      load_class: 'REAL',
    });
  }

  /** PASSIVE: the provenance every row of this load carries (PROVENANCE_COLUMNS order). */
  private StampRowProvenance() {
    if (this.LoadHistoryID === '') return;
    this.RowProvenance = [TMSIS_FROM_SYS_ID, this.AsOfDate, 'REAL', this.LoadHistoryID];
  }

  /** ACTIVE: each staged file kept in PSA under this load's stamp. */
  private async RetainStagedFilesInPsa() {
    await psaStore.EnsureRootReady();
    for (const f of OVERSIGHT_FILES) {
      if (this.FilePsaKeys[f]) continue;
      const key = `psa/${TMSIS_FROM_SYS_ID}/REAL/oversight/${this.PsaStamp}/${f}`;
      const landed = await psaStore.PutObject(key, this.FileBytes[f]);
      if (landed.byteLength !== this.FileBytes[f].length) throw new Error(`PSA retained a short ${f}`);
      this.FilePsaKeys[f] = key;
    }
  }

  /** ACTIVE: one index entry per retained file. */
  private async IndexStagedPsaObjects() {
    if (this.LoadHistoryID === '') return;
    for (const f of OVERSIGHT_FILES) {
      await this.client.query(
        `INSERT INTO bw_psa_meta.object_index (object_key, from_sys_id, load_history_id, load_class, content_hash, byte_length)
         VALUES ($1,$2,$3,'REAL',$4,$5)`,
        [this.FilePsaKeys[f], TMSIS_FROM_SYS_ID, this.LoadHistoryID, Sha256(this.FileBytes[f]), this.FileBytes[f].length],
      );
    }
  }

  /** PASSIVE */
  private ParseStagedRows() {
    const text = (f: string) => this.FileBytes[f].toString('utf8');
    this.MonthRows = ParseStagedStateCodeMonthCsv(text('state_code_month.csv'));
    this.CodeMonthRows = ParseStagedCodeMonthCsv(text('code_month.csv'));
    this.GroupYearRows = ParseStagedGroupYearCsv(text('biller_group_year.csv'));
    this.GroupServiceRows = ParseStagedGroupServiceCsv(text('biller_group_service.csv'));
    this.ProfileMeasureRows = ParseStagedProfileCsv(text('biller_profile.csv'));
    this.ProfileAreaRows = ParseStagedProfileAreaCsv(text('biller_profile_area.csv'));
    this.CodeLabelRows = ParseStagedCodeLabelCsv(text('code_labels.csv'));
    this.Notes.push(`staged from HHS v${this.Manifest.version} for screen load ${this.Manifest.screenLoadHistoryId}; NPPES ${this.Manifest.nppes}; parameters ${JSON.stringify(this.Manifest.parameters)}`);
  }

  /** PASSIVE: the stage names the latest screen load, and each file's rows and sha256 are the manifest's. */
  private ReconcileStagedFiles() {
    this.Checks.push({
      check_id: 'oversight-stage-names-latest-screen', ok: this.Manifest.screenLoadHistoryId === this.LatestScreenLoadHistoryId && this.LatestScreenLoadHistoryId !== '',
      expected: this.LatestScreenLoadHistoryId || '(a SUCCEEDED screen load)', actual: this.Manifest.screenLoadHistoryId, detail: 'the screen load the groups and series were drawn from vs the latest SUCCEEDED screen load',
    });
    const parsedRows: Record<string, number> = {
      'state_code_month.csv': this.MonthRows.length,
      'code_month.csv': this.CodeMonthRows.length,
      'biller_group_year.csv': this.GroupYearRows.length,
      'biller_group_service.csv': this.GroupServiceRows.length,
      'biller_profile.csv': this.ProfileMeasureRows.length / Object.keys(PROFILE_MEASURE_COLUMNS).length,
      'biller_profile_area.csv': this.ProfileAreaRows.length,
      'code_labels.csv': this.CodeLabelRows.length,
    };
    for (const f of OVERSIGHT_FILES) {
      const stats = f === 'code_labels.csv' ? this.Manifest.codeLabels : this.Manifest.files[f];
      const hash = Sha256(this.FileBytes[f]);
      this.Checks.push({
        check_id: `oversight-${f.replace('.csv', '').replace(/_/g, '-')}-matches-manifest`, ok: stats.rows === parsedRows[f] && stats.sha256 === hash,
        expected: `${stats.rows} rows, sha256 ${stats.sha256.slice(0, 12)}`, actual: `${parsedRows[f]} rows, sha256 ${hash.slice(0, 12)}`, detail: `${f} parsed vs the manifest`,
      });
    }
  }

  /** PASSIVE: state x code x years whose months do not add up to the loaded yearly paid (or that have no loaded year). */
  private CountMonthSeriesOffTheirYears() {
    const byYear = new Map<string, number>();
    for (const r of this.MonthRows) {
      const k = `${r.state_code}|${r.hcpcs}|${r.month_ym.slice(0, 4)}`;
      byYear.set(k, (byYear.get(k) ?? 0) + r.paid);
    }
    for (const [k, paid] of byYear) {
      const loaded = this.LoadedYearlyPaid.get(k);
      if (loaded === undefined || Math.abs(loaded - paid) > MONTH_RECONCILIATION_TOLERANCE_USD) this.MonthSeriesOffTheirYears += 1;
    }
  }

  /** PASSIVE: code x years whose national months do not add up to the loaded paid in every state and unmatched rows (or that have none loaded). */
  private CountCodeMonthsOffTheirYears() {
    const byYear = new Map<string, number>();
    for (const r of this.CodeMonthRows) {
      const k = `${r.hcpcs}|${r.month_ym.slice(0, 4)}`;
      byYear.set(k, (byYear.get(k) ?? 0) + r.paid);
    }
    for (const [k, paid] of byYear) {
      const loaded = this.LoadedNationalPaid.get(k);
      if (loaded === undefined || Math.abs(loaded - paid) > MONTH_RECONCILIATION_TOLERANCE_USD) this.CodeMonthsOffTheirYears += 1;
    }
  }

  /** PASSIVE: qualifying groups not staged plus staged groups that do not qualify. */
  private CountGroupsOffTheRule() {
    const staged = new Set(this.GroupYearRows.map((r) => `${r.group_state}|${r.group_hcpcs}|${r.group_year}`));
    for (const k of this.QualifyingGroupKeys) if (!staged.has(k)) this.GroupsOffTheRule += 1;
    for (const k of staged) if (!this.QualifyingGroupKeys.has(k)) this.GroupsOffTheRule += 1;
  }

  /** PASSIVE: staged month series for a state x code the screen does not name. */
  private CountMonthSeriesOffTheScreen() {
    const staged = new Set(this.MonthRows.map((r) => `${r.state_code}|${r.hcpcs}`));
    for (const k of staged) if (!this.ScreenStateCodeKeys.has(k)) this.MonthSeriesOffTheScreen += 1;
  }

  /** PASSIVE: groups with more members than billers loaded for their state, code and year (or none loaded). */
  private CountGroupsAboveTheirBillers() {
    const seen = new Set<string>();
    for (const r of this.GroupYearRows) {
      const k = `${r.group_state}|${r.group_hcpcs}|${r.group_year}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const billers = this.LoadedYearlyBillers.get(k);
      if (billers === undefined || r.members > billers) this.GroupsAboveTheirBillers += 1;
    }
  }

  /** PASSIVE: groups whose own year does not have every member billing. */
  private CountGroupsNotWholeInTheirYear() {
    for (const r of this.GroupYearRows) if (r.year === r.group_year && r.members_billing !== r.members) this.GroupsNotWholeInTheirYear += 1;
  }

  /** PASSIVE: profiles whose six cohorts do not add up to their billers. */
  private CountProfilesWhoseCohortsDoNotAdd() {
    const byProfile = new Map<string, { billers: number; cohorts: number }>();
    for (const r of this.ProfileMeasureRows) {
      const k = `${r.state_code}|${r.hcpcs}|${r.year}`;
      const p = byProfile.get(k) ?? { billers: 0, cohorts: 0 };
      if (r.measure === 'billers') p.billers = r.count_value;
      if (PROFILE_COHORTS.includes(r.measure)) p.cohorts += r.count_value;
      byProfile.set(k, p);
    }
    for (const p of byProfile.values()) if (p.billers !== p.cohorts) this.ProfilesWhoseCohortsDoNotAdd += 1;
  }

  /** PASSIVE: profiles with more billers than are loaded for their state, code and year (or none loaded). */
  private CountProfilesAboveTheirBillers() {
    for (const r of this.ProfileMeasureRows) {
      if (r.measure !== 'billers') continue;
      const loaded = this.LoadedYearlyBillers.get(`${r.state_code}|${r.hcpcs}|${r.year}`);
      if (loaded === undefined || r.count_value > loaded) this.ProfilesAboveTheirBillers += 1;
    }
  }

  /** PASSIVE: the counts above, as checks. */
  private ReconcileAgainstSpendingAggregate() {
    const zero = (check_id: string, actual: number, detail: string) => this.Checks.push({ check_id, ok: actual === 0, expected: '0', actual: String(actual), detail });
    zero('oversight-months-add-up-to-years', this.MonthSeriesOffTheirYears, `state x code x years whose months differ from the loaded yearly paid (load ${this.LatestSpendingLoadHistoryId}) by more than $${MONTH_RECONCILIATION_TOLERANCE_USD}`);
    zero('oversight-code-months-add-up-to-years', this.CodeMonthsOffTheirYears, `code x years whose national months differ from the loaded paid in every state and unmatched rows by more than $${MONTH_RECONCILIATION_TOLERANCE_USD}`);
    zero('oversight-groups-follow-the-rule', this.GroupsOffTheRule, `groups staged but not qualifying, or qualifying but not staged (${GROUP_PATTERNS.join(' or ')}, at least $${GROUP_MIN_STATE_PAID.toLocaleString('en-US')} to at least ${GROUP_MIN_BILLERS} billers)`);
    zero('oversight-months-within-the-screen', this.MonthSeriesOffTheScreen, 'staged month series for a state x code the screen does not name');
    zero('oversight-groups-within-billers', this.GroupsAboveTheirBillers, 'groups with more members than the billers loaded for their state, code and year');
    zero('oversight-groups-whole-in-their-year', this.GroupsNotWholeInTheirYear, 'groups not every member of which bills in the group\'s own year');
    zero('oversight-profile-cohorts-add-up', this.ProfilesWhoseCohortsDoNotAdd, 'profiles whose six cohorts do not add up to their billers');
    zero('oversight-profiles-within-billers', this.ProfilesAboveTheirBillers, 'profiles with more billers than are loaded for their state, code and year');
  }

  /** PASSIVE question: writes ReconciliationIsClean. */
  private IsReconciliationClean() {
    this.ReconciliationIsClean = this.Checks.every((c) => c.ok);
  }

  /** PASSIVE: a reconciliation that is not clean fails the load, naming the checks, so no row is replaced. */
  private MarkReconciliationFailed() {
    if (this.ReconciliationIsClean) return;
    this.Status = 'FAILED';
    this.ErrorMessage = `reconciliation failed: ${this.Checks.filter((c) => !c.ok).map((c) => c.check_id).join(', ')}`;
  }

  /** ACTIVE */
  private async BeginReplaceTransaction() {
    if (!this.ReconciliationIsClean || this.TransactionIsOpen) return;
    await this.client.query('BEGIN');
    this.TransactionIsOpen = true;
  }

  /** ACTIVE: the REAL rows of every table this owner keeps, replaced whole. */
  private async DeleteOversightRows() {
    if (!this.TransactionIsOpen) return;
    await this.client.query(`
      DELETE FROM bw_dso.dso_tmsis_state_code_month WHERE load_class = 'REAL';
      DELETE FROM bw_dso.dso_tmsis_code_month WHERE load_class = 'REAL';
      DELETE FROM bw_dso.dso_biller_group_year WHERE load_class = 'REAL';
      DELETE FROM bw_dso.dso_biller_group_service_year WHERE load_class = 'REAL';
      DELETE FROM bw_dso.dso_biller_profile_measure WHERE load_class = 'REAL';
      DELETE FROM bw_dso.dso_biller_profile_area WHERE load_class = 'REAL';
      DELETE FROM bw_dso.dso_hcpcs_label WHERE load_class = 'REAL';`);
  }


  /** ACTIVE */
  private async InsertMonthRows() {
    if (!this.TransactionIsOpen) return;
    this.MonthRowsInserted = await InsertRowsInBatches(this.client, 'bw_dso.dso_tmsis_state_code_month',
      ['state_code', 'hcpcs', 'month_ym', 'paid', 'billing_npis', ...PROVENANCE_COLUMNS], 'as_of_date',
      this.MonthRows.map((r) => [r.state_code, r.hcpcs, r.month_ym, r.paid, r.billing_npis, ...this.RowProvenance]));
    if (this.MonthRowsInserted < this.MonthRows.length) throw new Error(`inserted ${this.MonthRowsInserted} of ${this.MonthRows.length} month rows`);
  }

  /** ACTIVE */
  private async InsertCodeMonthRows() {
    if (!this.TransactionIsOpen) return;
    this.CodeMonthRowsInserted = await InsertRowsInBatches(this.client, 'bw_dso.dso_tmsis_code_month',
      ['hcpcs', 'month_ym', 'paid', ...PROVENANCE_COLUMNS], 'as_of_date',
      this.CodeMonthRows.map((r) => [r.hcpcs, r.month_ym, r.paid, ...this.RowProvenance]));
    if (this.CodeMonthRowsInserted < this.CodeMonthRows.length) throw new Error(`inserted ${this.CodeMonthRowsInserted} of ${this.CodeMonthRows.length} code-month rows`);
  }

  /** ACTIVE */
  private async InsertGroupYearRows() {
    if (!this.TransactionIsOpen) return;
    this.GroupYearRowsInserted = await InsertRowsInBatches(this.client, 'bw_dso.dso_biller_group_year',
      ['group_state', 'group_hcpcs', 'group_year', 'year', 'members', 'members_billing', 'members_paid', 'members_code_paid', ...PROVENANCE_COLUMNS], 'as_of_date',
      this.GroupYearRows.map((r) => [r.group_state, r.group_hcpcs, r.group_year, r.year, r.members, r.members_billing, r.members_paid, r.members_code_paid, ...this.RowProvenance]));
    if (this.GroupYearRowsInserted < this.GroupYearRows.length) throw new Error(`inserted ${this.GroupYearRowsInserted} of ${this.GroupYearRows.length} group-year rows`);
  }

  /** ACTIVE */
  private async InsertGroupServiceRows() {
    if (!this.TransactionIsOpen) return;
    this.GroupServiceRowsInserted = await InsertRowsInBatches(this.client, 'bw_dso.dso_biller_group_service_year',
      ['group_state', 'group_hcpcs', 'group_year', 'hcpcs', 'year', 'members_billing', 'paid', ...PROVENANCE_COLUMNS], 'as_of_date',
      this.GroupServiceRows.map((r) => [r.group_state, r.group_hcpcs, r.group_year, r.hcpcs, r.year, r.members_billing, r.paid, ...this.RowProvenance]));
    if (this.GroupServiceRowsInserted < this.GroupServiceRows.length) throw new Error(`inserted ${this.GroupServiceRowsInserted} of ${this.GroupServiceRows.length} group-service rows`);
  }

  /** ACTIVE */
  private async InsertProfileMeasureRows() {
    if (!this.TransactionIsOpen) return;
    this.ProfileMeasureRowsInserted = await InsertRowsInBatches(this.client, 'bw_dso.dso_biller_profile_measure',
      ['state_code', 'hcpcs', 'year', 'measure', 'count_value', 'paid', ...PROVENANCE_COLUMNS], 'as_of_date',
      this.ProfileMeasureRows.map((r) => [r.state_code, r.hcpcs, r.year, r.measure, r.count_value, r.paid, ...this.RowProvenance]));
    if (this.ProfileMeasureRowsInserted < this.ProfileMeasureRows.length) throw new Error(`inserted ${this.ProfileMeasureRowsInserted} of ${this.ProfileMeasureRows.length} profile measure rows`);
  }

  /** ACTIVE */
  private async InsertProfileAreaRows() {
    if (!this.TransactionIsOpen) return;
    this.ProfileAreaRowsInserted = await InsertRowsInBatches(this.client, 'bw_dso.dso_biller_profile_area',
      ['state_code', 'hcpcs', 'year', 'zip3', 'city', 'billers', 'paid', ...PROVENANCE_COLUMNS], 'as_of_date',
      this.ProfileAreaRows.map((r) => [r.state_code, r.hcpcs, r.year, r.zip3, r.city, r.billers, r.paid, ...this.RowProvenance]));
    if (this.ProfileAreaRowsInserted < this.ProfileAreaRows.length) throw new Error(`inserted ${this.ProfileAreaRowsInserted} of ${this.ProfileAreaRows.length} profile area rows`);
  }

  /** ACTIVE */
  private async InsertCodeLabelRows() {
    if (!this.TransactionIsOpen) return;
    this.CodeLabelRowsInserted = await InsertRowsInBatches(this.client, 'bw_dso.dso_hcpcs_label',
      ['hcpcs', 'label', ...PROVENANCE_COLUMNS], 'as_of_date',
      this.CodeLabelRows.map((r) => [r.hcpcs, r.label, ...this.RowProvenance]));
    if (this.CodeLabelRowsInserted < this.CodeLabelRows.length) throw new Error(`inserted ${this.CodeLabelRowsInserted} of ${this.CodeLabelRows.length} code labels`);
  }

  /** PASSIVE: the rows this load inserted across every table. */
  private CountRowsInserted() {
    if (!this.TransactionIsOpen) return;
    this.RowsInserted = this.MonthRowsInserted + this.CodeMonthRowsInserted + this.GroupYearRowsInserted + this.GroupServiceRowsInserted + this.ProfileMeasureRowsInserted + this.ProfileAreaRowsInserted + this.CodeLabelRowsInserted;
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

  /** ACTIVE: the load marked SUCCEEDED inside the replace transaction, so the rows and the status commit together. */
  private async CompleteLoad() {
    if (this.LoadHistoryID === '' || this.Status !== 'RUNNING' || !this.TransactionIsOpen) return;
    await CompleteLoadHistory(this.client, this.LoadHistoryID, {
      status: 'SUCCEEDED', row_count: this.RowsInserted, content_hash: Sha256(Buffer.from(this.ManifestText, 'utf8')), as_of_date: this.AsOfDate,
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
