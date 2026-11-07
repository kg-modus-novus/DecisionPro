// CodeXen-Container: v1 kind=object container=ShareAndSurgeCandidateOwner owns=share-and-surge-candidate
import type pg from 'pg';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { TMSIS_AS_OF_DATE, TMSIS_DATA_REQUEST_ID, TMSIS_FROM_SYS_ID, type AccuracyCheck } from './TmsisStateCodeSpendingOwner.js';
import { ALL_STATE_ENROLLMENT_DATA_REQUEST_ID, PI_ENROLLMENT_FROM_SYS_ID } from './RetrieveAndLoad.js';

/**
 * ShareAndSurgeCandidateOwner: owns the share-and-surge review candidate, one
 * per state, HCPCS code, year and pattern. Plan:
 * docs/planning/share-and-surge-screen-codexen-plan.md.
 *
 * Business Action:
 *   DetectShareAndSurgeCandidates   measure each state's share of national
 *     Medicaid spending on each code against its share of national enrollment,
 *     answer the four pattern questions, select the candidates, backtest them
 *     against the known cases, and replace the REAL candidate rows.
 *
 * The four patterns (Empower Oversight's 2026-10-29 screen of the same file):
 *   share-surge           the state's share at least doubled on the prior year
 *                         and sits far above its enrollment share;
 *   tripled-and-growing   paid at least tripled over two years with no down
 *                         year, far above enrollment share;
 *   share-collapse        the share fell by at least 60% from a year that was
 *                         far above enrollment share;
 *   persistent-excess     the share has been far above enrollment share for
 *                         three consecutive years.
 * "Far above" is ENROLLMENT_EXCESS_MULTIPLE times the enrollment share. A code
 * is screened only where at least MINIMUM_STATES_BILLING states bill it (so a
 * one-state billing convention does not register) and the state paid at least
 * MINIMUM_STATE_PAID in the year. A state-year whose publisher months are
 * short is kept and labeled reporting_complete=false, never dropped.
 *
 * Every candidate is a review prompt with status "detected". The screen makes
 * no finding; human dispositions arrive with the API, not here.
 *
 * Leveling what-if (2026-11-07, the Director's requirement): each candidate also
 * carries the dollars the state was paid above two lines, so the app can ask
 * where that money would go if review upheld the candidate. The enrollment line
 * is what the state would have been paid at its share of national enrollment
 * (national paid x enrollment share); the prior-share line is what it would have
 * been paid had its share stayed at the prior year's. Both are first-order:
 * the national total is held constant. Neither is a recovery estimate.
 */

export type KnownCase = {
  id: string;
  state_code: string;
  hcpcs: string;
  year: number;
  pattern: Pattern | '';
  expected: 'detected' | 'not-detected';
  note: string;
};

export type Pattern = 'share-surge' | 'tripled-and-growing' | 'share-collapse' | 'persistent-excess';

export const MINIMUM_STATES_BILLING = 10;
export const MINIMUM_STATE_PAID = 1_000_000;
export const STATE_BILLING_THRESHOLD = 100_000;
export const ENROLLMENT_EXCESS_MULTIPLE = 5;
export const SURGE_SHARE_MULTIPLE = 2;
export const TRIPLE_MULTIPLE = 3;
export const COLLAPSE_FRACTION = 0.6;
export const PERSISTENT_YEARS = 3;
export const REPORTING_TAIL_FRACTION = 0.5;
export const SCREEN_DATA_REQUEST_ID = 'DR-REAL-SHARE-SURGE-SCREEN';
/** The screen run's load-history notes carry the per-case backtest verdicts after this prefix (one note, JSON). */
export const BACKTEST_NOTE_PREFIX = 'backtest-json:';

/** The known cases the screen must reproduce before any candidate is exported. */
export const KNOWN_CASES: KnownCase[] = [
  { id: 'dc-h0036-2022', state_code: 'DC', hcpcs: 'H0036', year: 2022, pattern: 'share-surge', expected: 'detected', note: 'District of Columbia community psychiatric support billing, later the subject of federal prosecutions (Empower backtest case)' },
  { id: 'az-h2027-2022', state_code: 'AZ', hcpcs: 'H2027', year: 2022, pattern: 'tripled-and-growing', expected: 'detected', note: 'Arizona psychoeducation before the sober-living prosecutions: its share rose over several years (17% to 70% of national from 2019 to 2022, never doubling in one year), so the pattern that catches it is payments tripling over two years with no down year' },
  { id: 'az-h2027-2024', state_code: 'AZ', hcpcs: 'H2027', year: 2024, pattern: 'share-collapse', expected: 'detected', note: 'Arizona psychoeducation after the 2023 enforcement' },
  { id: 'ky-h2027-2023', state_code: 'KY', hcpcs: 'H2027', year: 2023, pattern: 'share-surge', expected: 'detected', note: 'Kentucky psychoeducation, the year its share tripled' },
  { id: 'ky-h2027-2024', state_code: 'KY', hcpcs: 'H2027', year: 2024, pattern: 'tripled-and-growing', expected: 'detected', note: 'Kentucky psychoeducation at 78% of national payments' },
  { id: 'ky-s5108-convention', state_code: 'KY', hcpcs: 'S5108', year: 0, pattern: '', expected: 'not-detected', note: 'Kentucky home-care training code billed in five states: a one-state convention the ten-state filter must set aside' },
  { id: 'ky-g2087-convention', state_code: 'KY', hcpcs: 'G2087', year: 0, pattern: '', expected: 'not-detected', note: 'Opioid treatment bundle billed in seven states: set aside by the ten-state filter' },
];

type SpendingRow = {
  state_code: string; hcpcs: string; year: number; paid: number; billing_npis: number; new_billing_npis: number; top10_paid: number;
};
type StateMonthRow = { state_code: string; month_ym: string; paid: number };
type EnrollmentRow = { state_code: string; period_ym: string; total_enrollment: number };
/** Rows as Postgres returns them (NUMERIC as text) before the typing atoms run. */
type SpendingRowRead = { state_code: string; hcpcs: string; year: number; paid: string; billing_npis: number; new_billing_npis: number; top10_paid: string };
type StateMonthRowRead = { state_code: string; month_ym: string; paid: string };
type EnrollmentRowRead = { state_code: string; period_ym: string; total_enrollment: string | null };

export type ShareRow = {
  state_code: string; hcpcs: string; year: number;
  paid: number; nationalPaid: number; share: number; enrollmentShare: number; excessMultiple: number;
  priorYearShare: number; priorYearPaid: number; priorYearExcess: number; twoYearsPriorPaid: number;
  peakShare: number; peakShareYear: number; peakExcess: number; peakPaid: number;
  statesBilling: number; billingNpis: number; newBillingNpis: number; top10Share: number; reportingComplete: boolean;
  ShareIsSurging: boolean; SpendingTripledAndKeptGrowing: boolean; ShareCollapsed: boolean; ShareIsPersistentlyAboveEnrollment: boolean;
};

/**
 * leadScore ranks candidates for review: dollars at stake times how far the share runs ahead of enrollment.
 * paidAboveEnrollmentLevel and paidAbovePriorShareLevel are the leveling what-if (never below zero).
 * All three are defined here, read everywhere else.
 */
export type Candidate = ShareRow & { pattern: Pattern; knownCaseId: string; leadScore: number; paidAboveEnrollmentLevel: number; paidAbovePriorShareLevel: number };

export type BacktestResult = { id: string; expected: string; detected: boolean; ok: boolean; note: string };

export class ShareAndSurgeCandidateOwner {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  LoadHistoryID = '';
  SpendingLoadHistoryID = '';
  EnrollmentLoadHistoryID = '';
  KnownCases: KnownCase[] = KNOWN_CASES;
  SpendingRowsRead: SpendingRowRead[] = [];
  StateMonthRowsRead: StateMonthRowRead[] = [];
  EnrollmentRowsRead: EnrollmentRowRead[] = [];
  SpendingRows: SpendingRow[] = [];
  StateMonthRows: StateMonthRow[] = [];
  EnrollmentRows: EnrollmentRow[] = [];
  BacktestIsClean = false;
  NationalPaidByCodeYear: Record<string, number> = {};
  StatesBillingByCodeYear: Record<string, number> = {};
  StateEnrollmentMeanByStateYear: Record<string, number> = {};
  NationalEnrollmentMeanByYear: Record<string, number> = {};
  EnrollmentShareByStateYear: Record<string, number> = {};
  ReportingCompleteByStateYear: Record<string, boolean> = {};
  ShareRows: ShareRow[] = [];
  Candidates: Candidate[] = [];
  BacktestResults: BacktestResult[] = [];
  RowsRead = 0;
  CandidatesDetected = 0;
  KnownCasesDetected = 0;
  KnownNegativesFired = 0;
  CandidatesInserted = 0;
  TransactionIsOpen = false;
  Checks: AccuracyCheck[] = [];
  Notes: string[] = [];
  AsOfDate = TMSIS_AS_OF_DATE;

  constructor(private client: pg.PoolClient) {}

  async DetectShareAndSurgeCandidates() {
    if (this.Status !== 'INITIAL') return;
    this.InitializeScreenRunState();
    try {
      await this.LoadLatestSpendingLoadHistory();
      await this.LoadLatestEnrollmentLoadHistory();
      await this.OpenLoadHistory();
      await this.LoadSpendingRows();
      this.TypeSpendingRows();
      await this.LoadStateMonthRows();
      this.TypeStateMonthRows();
      await this.LoadEnrollmentRows();
      this.TypeEnrollmentRows();
      this.MeasureNationalPaidByCodeYear();
      this.CountStatesBillingEachCodeYear();
      this.MeasureEnrollmentShareByStateYear();
      this.IsStateYearReportingComplete();
      this.MeasureStateShareOfNational();
      this.AttachPriorYearAndPeakContext();
      this.IsShareSurging();
      this.HasSpendingTripledAndKeptGrowing();
      this.HasShareCollapsed();
      this.IsSharePersistentlyAboveEnrollment();
      this.SelectReviewCandidates();
      this.MeasureLevelingWhatIf();
      this.BacktestKnownCases();
      this.RecordScreenChecks();
      this.IsBacktestClean();
      await this.BeginReplaceTransaction();
      await this.DeleteCandidateRows();
      await this.InsertCandidateRows();
      await this.CommitReplaceTransaction();
      await this.CompleteScreen();
      this.MarkScreenSucceeded();
      await this.FailScreen();
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
      await this.RollbackReplaceTransaction();
      await this.FailScreen();
    }
  }

  /** PASSIVE */
  private InitializeScreenRunState() {
    this.Status = 'RUNNING';
    this.ErrorMessage = '';
    this.LoadHistoryID = ''; this.SpendingLoadHistoryID = ''; this.EnrollmentLoadHistoryID = '';
    this.SpendingRowsRead = []; this.StateMonthRowsRead = []; this.EnrollmentRowsRead = []; this.BacktestIsClean = false;
    this.SpendingRows = []; this.StateMonthRows = []; this.EnrollmentRows = [];
    this.NationalPaidByCodeYear = {}; this.StatesBillingByCodeYear = {}; this.ReportingCompleteByStateYear = {};
    this.StateEnrollmentMeanByStateYear = {}; this.NationalEnrollmentMeanByYear = {}; this.EnrollmentShareByStateYear = {};
    this.ShareRows = []; this.Candidates = []; this.BacktestResults = [];
    this.RowsRead = 0; this.CandidatesDetected = 0; this.KnownCasesDetected = 0; this.KnownNegativesFired = 0; this.CandidatesInserted = 0;
    this.TransactionIsOpen = false; this.Checks = []; this.Notes = [];
  }

  /** ACTIVE: the latest SUCCEEDED spending load (the authoritative copy); '' when none. */
  private async LoadLatestSpendingLoadHistory() {
    if (this.SpendingLoadHistoryID !== '') return;
    this.SpendingLoadHistoryID = (await this.client.query<{ load_history_id: string }>(
      `SELECT coalesce(max(load_history_id), '') AS load_history_id FROM (SELECT load_history_id FROM bw_ctl.load_history WHERE data_request_id = $1 AND status = 'SUCCEEDED' AND load_class = 'REAL' ORDER BY completed_at DESC LIMIT 1) latest`,
      [TMSIS_DATA_REQUEST_ID],
    )).rows[0].load_history_id;
    if (this.SpendingLoadHistoryID === '') throw new Error('no SUCCEEDED T-MSIS state-code spending load; run the aggregate load first');
  }

  /** ACTIVE: the latest SUCCEEDED all-state enrollment load; '' when none. */
  private async LoadLatestEnrollmentLoadHistory() {
    if (this.EnrollmentLoadHistoryID !== '') return;
    this.EnrollmentLoadHistoryID = (await this.client.query<{ load_history_id: string }>(
      `SELECT coalesce(max(load_history_id), '') AS load_history_id FROM (SELECT load_history_id FROM bw_ctl.load_history WHERE data_request_id = $1 AND status = 'SUCCEEDED' AND load_class = 'REAL' ORDER BY completed_at DESC LIMIT 1) latest`,
      [ALL_STATE_ENROLLMENT_DATA_REQUEST_ID],
    )).rows[0].load_history_id;
    if (this.EnrollmentLoadHistoryID === '') throw new Error('no SUCCEEDED all-state PI enrollment load; run it first');
  }

  /** ACTIVE */
  private async OpenLoadHistory() {
    if (this.LoadHistoryID !== '') return;
    this.LoadHistoryID = newId('LH-SCREEN');
    await InsertLoadHistory(this.client, {
      load_history_id: this.LoadHistoryID, data_request_id: SCREEN_DATA_REQUEST_ID, started_at: new Date(),
      source_uri: `warehouse:${this.SpendingLoadHistoryID}+${this.EnrollmentLoadHistoryID}`, load_class: 'REAL',
    });
  }

  /** ACTIVE: the spending rows of the authoritative load, as read. */
  private async LoadSpendingRows() {
    if (this.SpendingRowsRead.length > 0) return;
    this.SpendingRowsRead = (await this.client.query<SpendingRowRead>(
      `SELECT state_code, hcpcs, year, paid, billing_npis, new_billing_npis, top10_paid FROM bw_dso.dso_tmsis_state_code_year WHERE load_class = 'REAL' AND load_history_id = $1`,
      [this.SpendingLoadHistoryID],
    )).rows;
    this.RowsRead = this.SpendingRowsRead.length;
    if (this.RowsRead === 0) throw new Error('spending load has no rows');
  }

  /** PASSIVE: numeric columns typed. */
  private TypeSpendingRows() {
    this.SpendingRows = this.SpendingRowsRead.map((x) => ({ state_code: x.state_code, hcpcs: x.hcpcs, year: Number(x.year), paid: Number(x.paid), billing_npis: Number(x.billing_npis), new_billing_npis: Number(x.new_billing_npis), top10_paid: Number(x.top10_paid) }));
  }

  /** ACTIVE */
  private async LoadStateMonthRows() {
    if (this.StateMonthRowsRead.length > 0) return;
    this.StateMonthRowsRead = (await this.client.query<StateMonthRowRead>(
      `SELECT state_code, month_ym, paid FROM bw_dso.dso_tmsis_state_month WHERE load_class = 'REAL' AND load_history_id = $1`,
      [this.SpendingLoadHistoryID],
    )).rows;
    if (this.StateMonthRowsRead.length === 0) throw new Error('spending load has no state-month rows');
  }

  /** PASSIVE */
  private TypeStateMonthRows() {
    this.StateMonthRows = this.StateMonthRowsRead.map((x) => ({ state_code: x.state_code, month_ym: x.month_ym, paid: Number(x.paid) }));
  }

  /** ACTIVE */
  private async LoadEnrollmentRows() {
    if (this.EnrollmentRowsRead.length > 0) return;
    this.EnrollmentRowsRead = (await this.client.query<EnrollmentRowRead>(
      `SELECT state_code, period_ym, total_enrollment FROM bw_dso.dso_enrollment_state WHERE load_class = 'REAL' AND load_history_id = $1 AND total_enrollment IS NOT NULL`,
      [this.EnrollmentLoadHistoryID],
    )).rows;
    if (this.EnrollmentRowsRead.length === 0) throw new Error('enrollment load has no rows');
  }

  /** PASSIVE */
  private TypeEnrollmentRows() {
    this.EnrollmentRows = this.EnrollmentRowsRead.map((x) => ({ state_code: x.state_code, period_ym: x.period_ym, total_enrollment: Number(x.total_enrollment) }));
  }

  /** PASSIVE: national paid per code-year includes every attributed and UNMATCHED row. */
  private MeasureNationalPaidByCodeYear() {
    for (const r of this.SpendingRows) {
      const k = `${r.hcpcs}|${r.year}`;
      this.NationalPaidByCodeYear[k] = (this.NationalPaidByCodeYear[k] ?? 0) + r.paid;
    }
  }

  /** PASSIVE: states (not UNMATCHED) paid at least STATE_BILLING_THRESHOLD on the code in the year. */
  private CountStatesBillingEachCodeYear() {
    for (const r of this.SpendingRows) {
      if (r.state_code === 'UNMATCHED' || r.paid < STATE_BILLING_THRESHOLD) continue;
      const k = `${r.hcpcs}|${r.year}`;
      this.StatesBillingByCodeYear[k] = (this.StatesBillingByCodeYear[k] ?? 0) + 1;
    }
  }

  /**
   * PASSIVE: a state's mean monthly Medicaid and CHIP enrollment in the year
   * (StateEnrollmentMeanByStateYear), the sum of every state's mean
   * (NationalEnrollmentMeanByYear), and the share between them.
   */
  private MeasureEnrollmentShareByStateYear() {
    const months: Record<string, number> = {};
    for (const r of this.EnrollmentRows) {
      const k = `${r.state_code}|${r.period_ym.slice(0, 4)}`;
      this.StateEnrollmentMeanByStateYear[k] = (this.StateEnrollmentMeanByStateYear[k] ?? 0) + r.total_enrollment;
      months[k] = (months[k] ?? 0) + 1;
    }
    for (const k of Object.keys(this.StateEnrollmentMeanByStateYear)) {
      this.StateEnrollmentMeanByStateYear[k] = this.StateEnrollmentMeanByStateYear[k] / months[k];
      const year = k.split('|')[1];
      this.NationalEnrollmentMeanByYear[year] = (this.NationalEnrollmentMeanByYear[year] ?? 0) + this.StateEnrollmentMeanByStateYear[k];
    }
    for (const k of Object.keys(this.StateEnrollmentMeanByStateYear)) {
      const year = k.split('|')[1];
      this.EnrollmentShareByStateYear[k] = this.NationalEnrollmentMeanByYear[year] > 0 ? this.StateEnrollmentMeanByStateYear[k] / this.NationalEnrollmentMeanByYear[year] : 0;
    }
  }

  /** PASSIVE question: a state-year is complete when it has twelve publisher months and none is under half the state's trailing median. */
  private IsStateYearReportingComplete() {
    const byState: Record<string, StateMonthRow[]> = {};
    for (const r of this.StateMonthRows) (byState[r.state_code] ??= []).push(r);
    for (const [state, rows] of Object.entries(byState)) {
      rows.sort((a, b) => a.month_ym.localeCompare(b.month_ym));
      const years = new Set(rows.map((r) => r.month_ym.slice(0, 4)));
      for (const year of years) {
        const inYear = rows.filter((r) => r.month_ym.startsWith(year));
        const yearEnd = `${year}-12`;
        const window = rows.filter((r) => r.month_ym <= yearEnd).slice(-24).map((r) => r.paid).sort((a, b) => a - b);
        const median = window.length ? window[Math.floor(window.length / 2)] : 0;
        const short = inYear.filter((r) => r.paid < REPORTING_TAIL_FRACTION * median).length;
        this.ReportingCompleteByStateYear[`${state}|${year}`] = inYear.length === 12 && short === 0;
      }
    }
  }

  /**
   * PASSIVE: one share row per attributed state-code-year. Share of national
   * and the enrollment-excess multiple are defined here and nowhere else;
   * prior-year and peak context are attached by the next atom from these rows.
   */
  private MeasureStateShareOfNational() {
    for (const r of this.SpendingRows) {
      if (r.state_code === 'UNMATCHED') continue;
      const nationalPaid = this.NationalPaidByCodeYear[`${r.hcpcs}|${r.year}`] ?? 0;
      const enrollmentShare = this.EnrollmentShareByStateYear[`${r.state_code}|${r.year}`] ?? 0;
      const share = nationalPaid > 0 ? r.paid / nationalPaid : 0;
      this.ShareRows.push({
        state_code: r.state_code, hcpcs: r.hcpcs, year: r.year,
        paid: r.paid, nationalPaid, share, enrollmentShare,
        excessMultiple: enrollmentShare > 0 ? share / enrollmentShare : 0,
        priorYearShare: 0, priorYearPaid: 0, priorYearExcess: 0, twoYearsPriorPaid: 0,
        peakShare: 0, peakShareYear: 0, peakExcess: 0, peakPaid: 0,
        statesBilling: this.StatesBillingByCodeYear[`${r.hcpcs}|${r.year}`] ?? 0,
        billingNpis: r.billing_npis, newBillingNpis: r.new_billing_npis, top10Share: r.paid > 0 ? r.top10_paid / r.paid : 0,
        reportingComplete: this.ReportingCompleteByStateYear[`${r.state_code}|${r.year}`] ?? false,
        ShareIsSurging: false, SpendingTripledAndKeptGrowing: false, ShareCollapsed: false, ShareIsPersistentlyAboveEnrollment: false,
      });
    }
    this.ShareRows.sort((a, b) => a.state_code.localeCompare(b.state_code) || a.hcpcs.localeCompare(b.hcpcs) || a.year - b.year);
  }

  /**
   * PASSIVE: each row's prior year, two years prior, and the earlier year with the
   * highest share (the first such year on a tie), read from the share rows
   * themselves. The rows are sorted by state, code and year, so one walk carries
   * the running peak of each state-code group; a scan of every row for every row
   * does not finish on 800,000 state-code-years.
   */
  private AttachPriorYearAndPeakContext() {
    const byKey = new Map(this.ShareRows.map((s) => [`${s.state_code}|${s.hcpcs}|${s.year}`, s]));
    let groupKey = '';
    let peak: ShareRow | undefined;
    for (const s of this.ShareRows) {
      const prior = byKey.get(`${s.state_code}|${s.hcpcs}|${s.year - 1}`);
      const twoPrior = byKey.get(`${s.state_code}|${s.hcpcs}|${s.year - 2}`);
      s.priorYearShare = prior?.share ?? 0;
      s.priorYearPaid = prior?.paid ?? 0;
      s.priorYearExcess = prior?.excessMultiple ?? 0;
      s.twoYearsPriorPaid = twoPrior?.paid ?? 0;
      if (`${s.state_code}|${s.hcpcs}` !== groupKey) { groupKey = `${s.state_code}|${s.hcpcs}`; peak = undefined; }
      if (peak) { s.peakShare = peak.share; s.peakShareYear = peak.year; s.peakExcess = peak.excessMultiple; s.peakPaid = peak.paid; }
      if (!peak || s.share > peak.share) peak = s;
    }
  }

  /** PASSIVE question */
  private IsShareSurging() {
    for (const s of this.ShareRows) {
      s.ShareIsSurging = s.priorYearShare > 0 && s.share >= SURGE_SHARE_MULTIPLE * s.priorYearShare && s.excessMultiple >= ENROLLMENT_EXCESS_MULTIPLE && s.paid >= MINIMUM_STATE_PAID;
    }
  }

  /** PASSIVE question */
  private HasSpendingTripledAndKeptGrowing() {
    for (const s of this.ShareRows) {
      s.SpendingTripledAndKeptGrowing = s.twoYearsPriorPaid > 0 && s.paid >= TRIPLE_MULTIPLE * s.twoYearsPriorPaid
        && s.priorYearPaid >= s.twoYearsPriorPaid && s.paid >= s.priorYearPaid
        && s.excessMultiple >= ENROLLMENT_EXCESS_MULTIPLE && s.paid >= MINIMUM_STATE_PAID;
    }
  }

  /** PASSIVE question */
  private HasShareCollapsed() {
    for (const s of this.ShareRows) {
      s.ShareCollapsed = s.peakShareYear > 0 && s.peakExcess >= ENROLLMENT_EXCESS_MULTIPLE && s.peakPaid >= MINIMUM_STATE_PAID
        && s.share <= (1 - COLLAPSE_FRACTION) * s.peakShare;
    }
  }

  /** PASSIVE question: far above enrollment share this year and the PERSISTENT_YEARS - 1 preceding years. */
  private IsSharePersistentlyAboveEnrollment() {
    const excessByKey = new Map(this.ShareRows.map((s) => [`${s.state_code}|${s.hcpcs}|${s.year}`, s.excessMultiple]));
    for (const s of this.ShareRows) {
      let years = 0;
      for (let y = s.year; y > s.year - PERSISTENT_YEARS; y -= 1) {
        if ((excessByKey.get(`${s.state_code}|${s.hcpcs}|${y}`) ?? 0) >= ENROLLMENT_EXCESS_MULTIPLE) years += 1;
      }
      s.ShareIsPersistentlyAboveEnrollment = years === PERSISTENT_YEARS && s.paid >= MINIMUM_STATE_PAID;
    }
  }

  /** PASSIVE: the ten-state filter, then one candidate per pattern the row answered; known-case ids attached. */
  private SelectReviewCandidates() {
    const known = new Map(this.KnownCases.filter((k) => k.expected === 'detected').map((k) => [`${k.state_code}|${k.hcpcs}|${k.year}|${k.pattern}`, k.id]));
    for (const s of this.ShareRows) {
      if (s.statesBilling < MINIMUM_STATES_BILLING) continue;
      const patterns: Pattern[] = [];
      if (s.ShareIsSurging) patterns.push('share-surge');
      if (s.SpendingTripledAndKeptGrowing) patterns.push('tripled-and-growing');
      if (s.ShareCollapsed) patterns.push('share-collapse');
      if (s.ShareIsPersistentlyAboveEnrollment) patterns.push('persistent-excess');
      for (const pattern of patterns) {
        this.Candidates.push({ ...s, pattern, knownCaseId: known.get(`${s.state_code}|${s.hcpcs}|${s.year}|${pattern}`) ?? '', leadScore: s.paid * s.excessMultiple, paidAboveEnrollmentLevel: 0, paidAbovePriorShareLevel: 0 });
      }
    }
    this.CandidatesDetected = this.Candidates.length;
  }

  /**
   * PASSIVE: the leveling what-if on each candidate. Above the enrollment line:
   * paid less national paid x enrollment share. Above the prior-share line: paid
   * less national paid x prior-year share (a code the state did not bill the year
   * before has a prior-share line of zero). Both floor at zero and hold the
   * national total constant; they size a question, not a recovery.
   */
  private MeasureLevelingWhatIf() {
    for (const c of this.Candidates) {
      c.paidAboveEnrollmentLevel = Math.max(0, c.paid - c.nationalPaid * c.enrollmentShare);
      c.paidAbovePriorShareLevel = Math.max(0, c.paid - c.nationalPaid * c.priorYearShare);
    }
  }

  /** PASSIVE: every known positive appears; no known negative appears in any year or pattern. */
  private BacktestKnownCases() {
    for (const k of this.KnownCases) {
      const detected = k.expected === 'detected'
        ? this.Candidates.some((c) => c.state_code === k.state_code && c.hcpcs === k.hcpcs && c.year === k.year && (k.pattern === '' || c.pattern === k.pattern))
        : this.Candidates.some((c) => c.state_code === k.state_code && c.hcpcs === k.hcpcs);
      const ok = k.expected === 'detected' ? detected : !detected;
      this.BacktestResults.push({ id: k.id, expected: k.expected, detected, ok, note: k.note });
      if (k.expected === 'detected' && detected) this.KnownCasesDetected += 1;
      if (k.expected === 'not-detected' && detected) this.KnownNegativesFired += 1;
    }
  }

  /** PASSIVE */
  private RecordScreenChecks() {
    const positives = this.KnownCases.filter((k) => k.expected === 'detected').length;
    this.Checks.push({ check_id: 'share-surge-known-positives-detected', ok: this.KnownCasesDetected === positives, expected: String(positives), actual: String(this.KnownCasesDetected), detail: 'known cases the screen must reproduce' });
    this.Checks.push({ check_id: 'share-surge-known-negatives-not-fired', ok: this.KnownNegativesFired === 0, expected: '0', actual: String(this.KnownNegativesFired), detail: 'one-state billing conventions the ten-state filter must set aside' });
    this.Checks.push({ check_id: 'share-surge-candidates-detected', ok: this.CandidatesDetected > 0, expected: '>0', actual: String(this.CandidatesDetected), detail: 'state-code-year-pattern candidates' });
    this.Notes.push(`screened ${this.ShareRows.length} state-code-years from ${this.RowsRead} rows; thresholds: ${MINIMUM_STATES_BILLING} states billing, $${MINIMUM_STATE_PAID.toLocaleString('en-US')} state paid, ${ENROLLMENT_EXCESS_MULTIPLE}x enrollment share, surge ${SURGE_SHARE_MULTIPLE}x prior share, tripled ${TRIPLE_MULTIPLE}x over two years, collapse ${COLLAPSE_FRACTION * 100}% from peak, persistent ${PERSISTENT_YEARS} years, reporting tail under ${REPORTING_TAIL_FRACTION * 100}% of trailing median`);
    // The per-case verdicts, recorded with the screen run so exports read them instead of re-deciding them.
    this.Notes.push(`${BACKTEST_NOTE_PREFIX}${JSON.stringify(this.BacktestResults.map((b) => ({ id: b.id, expected: b.expected, detected: b.detected, ok: b.ok })))}`);
  }

  /** PASSIVE question: writes BacktestIsClean; when it is not, records the failure so no candidate row is replaced. */
  private IsBacktestClean() {
    const failed = this.Checks.filter((c) => !c.ok);
    this.BacktestIsClean = failed.length === 0;
    if (this.BacktestIsClean) return;
    this.Status = 'FAILED';
    this.ErrorMessage = `backtest failed: ${failed.map((c) => `${c.check_id} expected ${c.expected} actual ${c.actual}`).join('; ')}`;
  }

  /** ACTIVE */
  private async BeginReplaceTransaction() {
    if (!this.BacktestIsClean || this.TransactionIsOpen) return;
    await this.client.query('BEGIN');
    this.TransactionIsOpen = true;
  }

  /** ACTIVE */
  private async DeleteCandidateRows() {
    if (!this.TransactionIsOpen) return;
    await this.client.query(`DELETE FROM bw_dso.dso_share_surge_candidate WHERE load_class = 'REAL'`);
  }

  /** ACTIVE: one multi-row insert per batch. */
  private async InsertCandidateRows() {
    if (!this.TransactionIsOpen) return;
    const cols = 29;
    const batch = 500;
    for (let i = 0; i < this.Candidates.length; i += batch) {
      const rows = this.Candidates.slice(i, i + batch);
      const values: unknown[] = [];
      const tuples = rows.map((c, j) => {
        const b = j * cols;
        values.push(c.state_code, c.hcpcs, c.year, c.pattern, 'detected', c.paid.toFixed(2), c.nationalPaid.toFixed(2), c.share.toFixed(5), c.enrollmentShare.toFixed(5),
          c.excessMultiple.toFixed(2), c.priorYearShare.toFixed(5), c.priorYearPaid.toFixed(2), c.twoYearsPriorPaid.toFixed(2), c.peakShare.toFixed(5), c.peakShareYear,
          c.statesBilling, c.billingNpis, c.newBillingNpis, c.top10Share.toFixed(5), c.reportingComplete, c.knownCaseId, c.leadScore.toFixed(2),
          c.paidAboveEnrollmentLevel.toFixed(2), c.paidAbovePriorShareLevel.toFixed(2),
          this.SpendingLoadHistoryID, [TMSIS_FROM_SYS_ID, PI_ENROLLMENT_FROM_SYS_ID], this.AsOfDate, 'REAL', this.LoadHistoryID);
        return `(${Array.from({ length: cols }, (_, k) => `$${b + k + 1}${k === 26 ? '::date' : ''}`).join(',')})`;
      });
      const result = await this.client.query(
        `INSERT INTO bw_dso.dso_share_surge_candidate
          (state_code, hcpcs, year, pattern, status, state_paid, national_paid, share_of_national, enrollment_share,
           excess_multiple, prior_year_share, prior_year_paid, two_years_prior_paid, peak_share, peak_share_year,
           states_billing, billing_npis, new_billing_npis, top10_share, reporting_complete, known_case_id, lead_score,
           paid_above_enrollment_level, paid_above_prior_share_level,
           spending_load_history_id, from_sys_ids, as_of_date, load_class, load_history_id)
         VALUES ${tuples.join(',')}`,
        values,
      );
      this.CandidatesInserted += result.rowCount ?? 0;
    }
    if (this.CandidatesInserted < this.Candidates.length) throw new Error(`inserted ${this.CandidatesInserted} of ${this.Candidates.length} candidates`);
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
  private async CompleteScreen() {
    if (this.LoadHistoryID === '' || this.Status !== 'RUNNING') return;
    await CompleteLoadHistory(this.client, this.LoadHistoryID, { status: 'SUCCEEDED', row_count: this.CandidatesInserted, as_of_date: this.AsOfDate, notes: this.Notes.join(' | ') });
  }

  /** PASSIVE: the run reached its end with every check clean. */
  private MarkScreenSucceeded() {
    if (this.Status !== 'RUNNING') return;
    this.Status = 'SUCCEEDED';
  }

  /** ACTIVE (error path only) */
  private async FailScreen() {
    if (this.LoadHistoryID === '' || this.Status !== 'FAILED') return;
    await CompleteLoadHistory(this.client, this.LoadHistoryID, { status: 'FAILED', notes: this.ErrorMessage });
  }
}
