import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { TMSIS_AS_OF_DATE } from './TmsisStateCodeSpendingOwner.js';
import { BACKTEST_NOTE_PREFIX, KNOWN_CASES, SCREEN_DATA_REQUEST_ID } from './ShareAndSurgeCandidateOwner.js';

/**
 * ExportPotentialFraudRadarForUi: a read-only projection of every share-and-surge
 * review candidate in every state (latest SUCCEEDED screen) for the app's
 * Potential Fraud Detection module: the national radar, program blow-ups, case
 * files, the reallocation what-if and the data-coverage page.
 *
 * Serialization only. Candidate figures are the owner's columns as written; the
 * yearly series are the state x code aggregate the screen read; enrollment share
 * per state-year is taken from candidate rows (the owner defines it); load dates
 * come from bw_ctl.load_history. No pattern, score or tier is computed here: the
 * app's PotentialFraudSignalReview program ranks and tiers.
 *
 * Writes alp/potentialFraudRadar.js (compact columns + rows, loaded on demand).
 */

/** Plain wording for codes the screen tends to surface (not AMA descriptors). */
export const PLAIN_CODE_LABELS: Record<string, string> = {
  H2027: 'Psychoeducation, per 15 minutes',
  H0036: 'Community psychiatric supportive treatment, per 15 minutes',
  H0038: 'Peer support services, per 15 minutes',
  H2015: 'Comprehensive community support services, per 15 minutes',
  H2017: 'Psychosocial rehabilitation services, per 15 minutes',
  H0011: 'Acute drug or alcohol detoxification, residential',
  H0047: 'Drug or alcohol services, not otherwise specified',
  H2034: 'Drug or alcohol halfway house services, per day',
  H2020: 'Therapeutic behavioral services, per day',
  H0019: 'Behavioral health residential treatment, per day',
  H0044: 'Supported housing, per month',
  H2016: 'Comprehensive community support services, per day',
  T1019: 'Personal care services, per 15 minutes',
  T1015: 'Clinic visit, all-inclusive',
  T2040: 'Financial management self-directed, per 15 minutes',
  S5108: 'Home care training for the family, per 15 minutes',
  S5125: 'Attendant care services, per 15 minutes',
  G2087: 'Opioid use disorder treatment, monthly bundle',
  97535: 'Self-care and home management training, each 15 minutes',
  90887: 'Interpretation of results to family or others',
  90853: 'Group psychotherapy',
  90834: 'Psychotherapy, 45 minutes',
  97153: 'Adaptive behavior treatment by a technician, each 15 minutes',
  97155: 'Adaptive behavior treatment with protocol modification, each 15 minutes',
  97156: 'Family adaptive behavior treatment guidance, each 15 minutes',
  S9122: 'Home health aide or certified nurse assistant, per hour',
  S9123: 'Nursing care in the home by a registered nurse, per hour',
  S5126: 'Attendant care services, per day',
  T1004: 'Nursing aide services, each 15 minutes',
  92650: 'Auditory evoked potentials screening',
  T1023: 'Program intake assessment',
  G0467: 'Federally qualified health center visit, established patient',
  H0035: 'Mental health partial hospitalization, under 24 hours',
  H0040: 'Assertive community treatment, per diem',
  42830: 'Adenoidectomy, under age 12',
};

const CANDIDATE_COLUMNS = [
  'state', 'hcpcs', 'year', 'pattern', 'statePaid', 'nationalPaid', 'share', 'enrollmentShare', 'excessMultiple',
  'priorYearShare', 'priorYearPaid', 'twoYearsPriorPaid', 'peakShare', 'peakShareYear', 'statesBilling',
  'billingNpis', 'newBillingNpis', 'top10Share', 'reportingComplete', 'knownCaseId',
  'paidAboveEnrollmentLevel', 'paidAbovePriorShareLevel',
] as const;

/** Data requests whose latest SUCCEEDED load the coverage page reports. */
const COVERAGE_REQUESTS = [
  'DR-REAL-TMSIS-STATE-CODE-SPENDING', 'DR-REAL-PI-ENROLLMENT-ALL-STATES', SCREEN_DATA_REQUEST_ID, 'DR-REAL-LEIE',
  'DR-REAL-MCPAR-KY', 'DR-REAL-IRS-990-EXTRACT', 'DR-REAL-USASPENDING-AWARD-GRAIN', 'DR-REAL-SAM-RESOLVE',
  'DR-REAL-ORG-CROSSWALK', 'DR-REAL-CMS-OWNERSHIP', 'DR-REAL-MCO-ROSTER', 'DR-REAL-CMS-PROVIDER-KY',
];

type CandidateRead = {
  state_code: string; hcpcs: string; year: number; pattern: string; state_paid: string; national_paid: string;
  share_of_national: string; enrollment_share: string; excess_multiple: string; prior_year_share: string;
  prior_year_paid: string; two_years_prior_paid: string; peak_share: string; peak_share_year: number;
  states_billing: number; billing_npis: number; new_billing_npis: number; top10_share: string;
  reporting_complete: boolean; known_case_id: string | null; paid_above_enrollment_level: string;
  paid_above_prior_share_level: string; spending_load_history_id: string;
};

export class ExportPotentialFraudRadarForUi {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  ExportPath = config.fraudRadarExportPath;
  CandidateCount = 0;
  StateCount = 0;
  StateCodeCount = 0;
  ExportBytes = 0;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const q = <T extends pg.QueryResultRow>(sql: string, args: unknown[] = []) => this.client.query<T>(sql, args).then((r) => r.rows);
      const screenLoads = await q<{ load_history_id: string; started_at: string; completed_at: string; notes: string; row_count: number }>(
        `SELECT load_history_id, started_at, completed_at, notes, row_count FROM bw_ctl.load_history WHERE data_request_id = $1 AND status = 'SUCCEEDED' AND load_class = 'REAL' ORDER BY completed_at DESC LIMIT 1`,
        [SCREEN_DATA_REQUEST_ID],
      );
      if (screenLoads.length === 0) throw new Error('no SUCCEEDED share-and-surge screen to export');
      const screenLoad = screenLoads[0];

      const rows = await q<CandidateRead>(
        `SELECT state_code, hcpcs, year, pattern, state_paid, national_paid, share_of_national, enrollment_share, excess_multiple,
                prior_year_share, prior_year_paid, two_years_prior_paid, peak_share, peak_share_year, states_billing,
                billing_npis, new_billing_npis, top10_share, reporting_complete, known_case_id,
                paid_above_enrollment_level, paid_above_prior_share_level, spending_load_history_id
           FROM bw_dso.dso_share_surge_candidate WHERE load_class = 'REAL' AND load_history_id = $1
          ORDER BY state_code, hcpcs, year, pattern`,
        [screenLoad.load_history_id],
      );
      const spendingLoadId = rows[0]?.spending_load_history_id ?? '';
      const dollars = (v: unknown) => Math.round(Number(v));
      const ratio = (v: unknown) => Number(Number(v).toFixed(5));
      const candidates = rows.map((r) => [
        r.state_code, r.hcpcs, Number(r.year), r.pattern, dollars(r.state_paid), dollars(r.national_paid), ratio(r.share_of_national),
        ratio(r.enrollment_share), Number(Number(r.excess_multiple).toFixed(2)), ratio(r.prior_year_share), dollars(r.prior_year_paid),
        dollars(r.two_years_prior_paid), ratio(r.peak_share), Number(r.peak_share_year), Number(r.states_billing), Number(r.billing_npis),
        Number(r.new_billing_npis), ratio(r.top10_share), Boolean(r.reporting_complete), r.known_case_id ?? '',
        dollars(r.paid_above_enrollment_level), dollars(r.paid_above_prior_share_level),
      ]);
      this.CandidateCount = candidates.length;
      this.StateCount = new Set(rows.map((r) => r.state_code)).size;

      // Enrollment share per state-year as the owner wrote it on candidate rows.
      const enrollmentShare: Record<string, number> = {};
      for (const r of rows) enrollmentShare[`${r.state_code}|${r.year}`] = ratio(r.enrollment_share);

      // Yearly series for every candidate state-code, from the aggregate the screen read.
      const stateCodes = [...new Set(rows.map((r) => `${r.state_code}|${r.hcpcs}`))];
      this.StateCodeCount = stateCodes.length;
      const codes = [...new Set(rows.map((r) => r.hcpcs))];
      const spend = await q<{ state_code: string; hcpcs: string; year: number; paid: string; billing_npis: number; new_billing_npis: number; top10_paid: string }>(
        `SELECT state_code, hcpcs, year, paid, billing_npis, new_billing_npis, top10_paid FROM bw_dso.dso_tmsis_state_code_year
          WHERE load_class = 'REAL' AND load_history_id = $1 AND hcpcs = ANY($2::text[])`,
        [spendingLoadId, codes],
      );
      const wanted = new Set(stateCodes);
      const series: Record<string, Array<[number, number, number, number, number]>> = {};
      const nationalByCode: Record<string, Record<number, number>> = {};
      const statesByCodeYear: Record<string, Array<[string, number]>> = {};
      for (const s of spend) {
        const year = Number(s.year); const paid = dollars(s.paid);
        (nationalByCode[s.hcpcs] ??= {})[year] = (nationalByCode[s.hcpcs][year] ?? 0) + paid;
        if (s.state_code !== 'UNMATCHED') (statesByCodeYear[`${s.hcpcs}|${year}`] ??= []).push([s.state_code, paid]);
        const key = `${s.state_code}|${s.hcpcs}`;
        if (wanted.has(key)) (series[key] ??= []).push([year, paid, Number(s.billing_npis), Number(s.new_billing_npis), dollars(s.top10_paid)]);
      }
      for (const v of Object.values(series)) v.sort((a, b) => a[0] - b[0]);
      // The three largest states per code-year (for "next largest state" and peer context).
      const leadingStates: Record<string, Array<[string, number]>> = {};
      for (const [k, v] of Object.entries(statesByCodeYear)) leadingStates[k] = v.sort((a, b) => b[1] - a[1]).slice(0, 3);
      // Every state's paid in the latest year for each code flagged that year (peer-state line in the reallocation what-if).
      const latestYear = Math.max(...rows.map((r) => Number(r.year)));
      const latestCodes = new Set(rows.filter((r) => Number(r.year) === latestYear).map((r) => r.hcpcs));
      const latestYearStatePaid: Record<string, Array<[string, number]>> = {};
      for (const hcpcs of latestCodes) latestYearStatePaid[hcpcs] = (statesByCodeYear[`${hcpcs}|${latestYear}`] ?? []).filter((x) => x[1] > 0);

      // National Medicaid paid in the file per year (all codes, all states).
      const totals = await q<{ year: number; paid: string }>(
        `SELECT year, SUM(paid) AS paid FROM bw_dso.dso_tmsis_state_code_year WHERE load_class = 'REAL' AND load_history_id = $1 GROUP BY year ORDER BY year`,
        [spendingLoadId],
      );
      // Mean monthly Medicaid and CHIP enrollment per state-year (display figure for the "can health explain it" panel).
      const enrollment = await q<{ state_code: string; year: string; mean_enrollment: string; months: number }>(
        `SELECT state_code, substr(period_ym, 1, 4) AS year, AVG(total_enrollment) AS mean_enrollment, COUNT(*) AS months
           FROM bw_dso.dso_enrollment_state
          WHERE load_class = 'REAL' AND total_enrollment IS NOT NULL
            AND load_history_id = (SELECT load_history_id FROM bw_ctl.load_history WHERE data_request_id = 'DR-REAL-PI-ENROLLMENT-ALL-STATES' AND status = 'SUCCEEDED' ORDER BY completed_at DESC LIMIT 1)
          GROUP BY 1, 2 ORDER BY 1, 2`,
      );
      const meanEnrollment: Record<string, Array<[number, number, number]>> = {};
      for (const e of enrollment) (meanEnrollment[e.state_code] ??= []).push([Number(e.year), Math.round(Number(e.mean_enrollment)), Number(e.months)]);

      // Backtest verdicts as the screen owner recorded them with its run (never re-decided here).
      const noteParts = String(screenLoad.notes ?? '').split(' | ');
      const backtestNote = noteParts.find((n) => n.startsWith(BACKTEST_NOTE_PREFIX));
      if (!backtestNote) throw new Error('the latest screen run carries no backtest verdicts; rerun tmsis-screen --screen-only');
      const verdicts = new Map((JSON.parse(backtestNote.slice(BACKTEST_NOTE_PREFIX.length)) as Array<{ id: string; detected: boolean; ok: boolean }>).map((v) => [v.id, v]));
      const backtest = KNOWN_CASES.filter((k) => verdicts.has(k.id)).map((k) => ({ ...k, detected: verdicts.get(k.id)!.detected, ok: verdicts.get(k.id)!.ok }));
      const screenNotes = noteParts.filter((n) => !n.startsWith(BACKTEST_NOTE_PREFIX)).join(' | ');

      // Latest load of each source the coverage page names.
      const coverage = await q<{ data_request_id: string; load_history_id: string; completed_at: string; as_of_date: string; row_count: number }>(
        `SELECT DISTINCT ON (data_request_id) data_request_id, load_history_id, completed_at, as_of_date::text AS as_of_date, row_count
           FROM bw_ctl.load_history WHERE status = 'SUCCEEDED' AND load_class = 'REAL' AND data_request_id = ANY($1::text[])
          ORDER BY data_request_id, completed_at DESC`,
        [COVERAGE_REQUESTS],
      );
      const exclusions = await q<{ state_code: string; total: string; npi: string; as_of_date: string }>(
        `SELECT state_code, SUM(source_record_count) AS total, SUM(npi_count) AS npi, MAX(as_of_date)::text AS as_of_date FROM bw_dso.dso_exclusion_summary WHERE load_class = 'REAL' GROUP BY 1 ORDER BY 1`,
      );

      const codeLabels: Record<string, string> = {};
      for (const c of codes) if (PLAIN_CODE_LABELS[c]) codeLabels[c] = PLAIN_CODE_LABELS[c];

      const payload = {
        schema: 'decisionpro/potential-fraud-radar/v1',
        generatedAt: new Date().toISOString(),
        loadClass: 'REAL',
        asOf: TMSIS_AS_OF_DATE,
        screenLoadHistoryId: screenLoad.load_history_id,
        spendingLoadHistoryId: spendingLoadId,
        screenRun: { startedAt: screenLoad.started_at, completedAt: screenLoad.completed_at, notes: screenNotes, rowCount: Number(screenLoad.row_count) },
        candidateColumns: CANDIDATE_COLUMNS,
        candidates,
        seriesColumns: ['year', 'statePaid', 'billingNpis', 'newBillingNpis', 'top10Paid'],
        series,
        nationalByCode,
        leadingStates,
        latestYear,
        latestYearStatePaid,
        enrollmentShare,
        meanEnrollment,
        nationalPaidByYear: Object.fromEntries(totals.map((t) => [Number(t.year), dollars(t.paid)])),
        codeLabels,
        knownCases: KNOWN_CASES,
        backtest,
        coverage: coverage.map((c) => ({ dataRequestId: c.data_request_id, loadHistoryId: c.load_history_id, completedAt: c.completed_at, asOf: c.as_of_date, rowCount: Number(c.row_count) })),
        exclusionSummary: exclusions.map((e) => ({ state: e.state_code, records: Number(e.total), withNpi: Number(e.npi), asOf: e.as_of_date })),
      };
      const text = `/**\n * Generated by XenoDroid BW export — do not hand-edit.\n * Potential Fraud Detection: every share-and-surge review candidate in every state, with yearly series.\n * Regenerate: npx tsx src/cli.ts fraud-radar-export (after tmsis-screen) from xenodroid-bw.\n */\nexport const POTENTIAL_FRAUD_RADAR = ${JSON.stringify(payload)};\n`;
      await fs.mkdir(path.dirname(this.ExportPath), { recursive: true });
      await fs.writeFile(this.ExportPath, text, 'utf8');
      this.ExportBytes = Buffer.byteLength(text);
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
