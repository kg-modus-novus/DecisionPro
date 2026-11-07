import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { type AccuracyCheck, TMSIS_AS_OF_DATE } from './TmsisStateCodeSpendingOwner.js';
import {
  COLLAPSE_FRACTION, ENROLLMENT_EXCESS_MULTIPLE, KNOWN_CASES, MINIMUM_STATES_BILLING, MINIMUM_STATE_PAID, PERSISTENT_YEARS,
  REPORTING_TAIL_FRACTION, SCREEN_DATA_REQUEST_ID, STATE_BILLING_THRESHOLD, SURGE_SHARE_MULTIPLE, TRIPLE_MULTIPLE,
  type BacktestResult,
} from './ShareAndSurgeCandidateOwner.js';

/**
 * ExportShareAndSurgeForUi: a read-only projection of the share-and-surge review
 * candidates (latest SUCCEEDED screen) for the app's Program Integrity goal and
 * briefings. Serialization only: every figure is read from the warehouse and no
 * pattern is recomputed here. Writes alp/shareAndSurgeScreen.js.
 */

/** Plain wording for codes the screen tends to surface (not AMA descriptors). */
const PLAIN_CODE_LABELS: Record<string, string> = {
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

type CandidateRow = {
  state_code: string; hcpcs: string; year: number; pattern: string; status: string;
  state_paid: string; national_paid: string; share_of_national: string; enrollment_share: string; excess_multiple: string;
  prior_year_share: string; prior_year_paid: string; two_years_prior_paid: string; peak_share: string; peak_share_year: number;
  states_billing: number; billing_npis: number; new_billing_npis: number; top10_share: string; reporting_complete: boolean; known_case_id: string;
  lead_score: string; paid_above_enrollment_level: string; paid_above_prior_share_level: string; spending_load_history_id: string;
};

type Shaped = ReturnType<ExportShareAndSurgeForUi['shape']>;

export class ExportShareAndSurgeForUi {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  ExportPath = config.shareSurgeExportPath;
  ReconciliationStatus: 'PASS' | 'FAIL' | 'n/a' = 'n/a';
  CandidateCount = 0;
  StateCount = 0;

  constructor(private client: pg.PoolClient, private checks: AccuracyCheck[] = [], private notes: string[] = [], private backtest: BacktestResult[] = []) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const screenLoad = await this.client.query<{ load_history_id: string; completed_at: string; notes: string }>(
        `SELECT load_history_id, completed_at, notes FROM bw_ctl.load_history WHERE data_request_id = $1 AND status = 'SUCCEEDED' AND load_class = 'REAL' ORDER BY completed_at DESC LIMIT 1`,
        [SCREEN_DATA_REQUEST_ID],
      );
      if (screenLoad.rows.length === 0) throw new Error('no SUCCEEDED share-and-surge screen to export');
      const screenLoadId = screenLoad.rows[0].load_history_id;

      const candidates = await this.client.query<CandidateRow>(
        `SELECT * FROM bw_dso.dso_share_surge_candidate WHERE load_class = 'REAL' AND load_history_id = $1 ORDER BY state_code, hcpcs, year, pattern`,
        [screenLoadId],
      );
      // The spending load each candidate was screened from (one authoritative pair, CX-SS-08).
      const spendingLoadId = candidates.rows[0]?.spending_load_history_id ?? '';
      const all = candidates.rows.map((r) => this.shape(r));
      this.CandidateCount = all.length;
      this.StateCount = new Set(all.map((c) => c.state)).size;

      // Per flagged code in an OFR state: the state's yearly paid beside the national paid, and the leading states in the
      // latest year, read from the aggregate the screen used. Figures only; shares come from the candidate rows the owner wrote.
      const byState: Record<string, unknown> = {};
      for (const state of config.ofrStates) {
        const mine = all.filter((c) => c.state === state);
        const codes = [...new Set(mine.map((c) => c.hcpcs))];
        const codeContext: Record<string, unknown> = {};
        for (const hcpcs of codes) {
          const series = await this.client.query<{ year: number; state_code: string; paid: string; billing_npis: number; new_billing_npis: number }>(
            `SELECT year, state_code, paid, billing_npis, new_billing_npis FROM bw_dso.dso_tmsis_state_code_year WHERE load_class='REAL' AND load_history_id = $1 AND hcpcs = $2 ORDER BY year, state_code`,
            [spendingLoadId, hcpcs],
          );
          const years = [...new Set(series.rows.map((r) => Number(r.year)))].sort();
          const nationalByYear: Record<number, number> = {};
          for (const r of series.rows) nationalByYear[Number(r.year)] = (nationalByYear[Number(r.year)] ?? 0) + Number(r.paid);
          const stateSeries = years.map((year) => {
            const row = series.rows.find((r) => Number(r.year) === year && r.state_code === state);
            return { year, statePaid: row ? Number(row.paid) : 0, nationalPaid: nationalByYear[year] ?? 0, billingNpis: row ? Number(row.billing_npis) : 0, newBillingNpis: row ? Number(row.new_billing_npis) : 0 };
          });
          const latestYear = years[years.length - 1];
          const leadingStates = series.rows.filter((r) => Number(r.year) === latestYear && r.state_code !== 'UNMATCHED')
            .map((r) => ({ state: r.state_code, paid: Number(r.paid) }))
            .sort((a, b) => b.paid - a.paid).slice(0, 6);
          codeContext[hcpcs] = { hcpcs, codeLabel: PLAIN_CODE_LABELS[hcpcs] ?? `HCPCS ${hcpcs}`, series: stateSeries, latestYear, leadingStates };
        }
        byState[state] = { state, candidateCount: mine.length, codeCount: codes.length, candidates: mine, codeContext, levelingWhatIf: this.levelingWhatIf(mine) };
      }

      const leadingNational = [...all].sort((a, b) => b.leadScore - a.leadScore).slice(0, 40);
      const payload = {
        schema: 'decisionpro/share-and-surge-screen/v1',
        generatedAt: new Date().toISOString(),
        loadClass: 'REAL',
        asOf: TMSIS_AS_OF_DATE,
        screenLoadHistoryId: screenLoadId,
        spendingLoadHistoryId: spendingLoadId,
        note: 'Every row is a review candidate the screen detected, never a finding: a state-code-year whose share of national Medicaid spending moved against its share of national enrollment in one of four patterns. A candidate is explained by coding convention, program design or a known case before anything else is concluded.',
        methodology: {
          source: 'HHS Open Data, Medicaid Provider Spending by HCPCS (T-MSIS, Jan 2018 to Dec 2024, v2026-02-09; cells under 12 beneficiaries or lines suppressed; 2024 preliminary).',
          stateAttribution: 'A row\'s state is the billing provider\'s NPPES practice state (Feb 2026), else the servicing provider\'s, else UNMATCHED. It is where the payment went, not which state program paid or where the member lives.',
          denominator: 'Enrollment share is the state\'s mean monthly Medicaid and CHIP enrollment in the year over the sum across states (CMS Performance Indicator extract retained in the warehouse).',
          patterns: {
            'share-surge': `share at least ${SURGE_SHARE_MULTIPLE}x the prior year and at least ${ENROLLMENT_EXCESS_MULTIPLE}x the enrollment share`,
            'tripled-and-growing': `paid at least ${TRIPLE_MULTIPLE}x two years earlier with no down year, and at least ${ENROLLMENT_EXCESS_MULTIPLE}x the enrollment share`,
            'share-collapse': `share down at least ${COLLAPSE_FRACTION * 100}% from an earlier year that was at least ${ENROLLMENT_EXCESS_MULTIPLE}x the enrollment share`,
            'persistent-excess': `share at least ${ENROLLMENT_EXCESS_MULTIPLE}x the enrollment share for ${PERSISTENT_YEARS} consecutive years`,
          },
          filters: `codes billed (at least $${STATE_BILLING_THRESHOLD.toLocaleString('en-US')}) in at least ${MINIMUM_STATES_BILLING} states; state paid at least $${MINIMUM_STATE_PAID.toLocaleString('en-US')} in the year; a state-year with fewer than twelve publisher months or a month under ${REPORTING_TAIL_FRACTION * 100}% of the trailing median is kept and labeled reportingComplete=false`,
          provenance: 'Patterns follow the screen Empower Oversight described to CMS on 2026-10-29 over the same file; thresholds are DecisionPro\'s, calibrated on the backtest below.',
          enrichment: 'Non-public data that would settle a candidate: DMS claims with modifiers (group vs individual), units and place of service; prior-authorization decisions; MCO encounter data; months after December 2024. Each is DMS or MCO data under a data use agreement.',
          levelingWhatIf: 'Per candidate, the owner records the dollars paid above two lines: the enrollment line (national paid x the state\'s enrollment share) and the prior-share line (national paid x the state\'s prior-year share), each floored at zero with the national total held constant. byState[].levelingWhatIf sums them per year over distinct services (a service-year that meets two patterns counts once). A what-if that sizes a reallocation question if review upholds the candidates; never a recovery estimate, and nothing is owed until a candidate is upheld.',
        },
        knownCases: KNOWN_CASES,
        backtest: this.backtest,
        sourceNotes: this.notes,
        reconciliation: { status: this.checks.length ? (this.checks.every((c) => c.ok) ? 'PASS' : 'FAIL') : 'n/a', claimAllowed: this.checks.length > 0 && this.checks.every((c) => c.ok), checks: this.checks },
        screen: { candidateCount: all.length, stateCount: this.StateCount, loadNotes: screenLoad.rows[0].notes },
        national: { leadingCandidates: leadingNational },
        byState,
      };
      this.ReconciliationStatus = payload.reconciliation.status as 'PASS' | 'FAIL' | 'n/a';
      await fs.mkdir(path.dirname(this.ExportPath), { recursive: true });
      await fs.writeFile(this.ExportPath, generatedModule(payload), 'utf8');
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  /** A candidate row as the app reads it: typed, labeled, nothing recomputed. */
  private shape(r: CandidateRow) {
    const num = (v: string | number) => Number(v);
    return {
      state: r.state_code, hcpcs: r.hcpcs, codeLabel: PLAIN_CODE_LABELS[r.hcpcs] ?? `HCPCS ${r.hcpcs}`, year: Number(r.year), pattern: r.pattern, status: r.status,
      statePaid: num(r.state_paid), nationalPaid: num(r.national_paid), share: num(r.share_of_national), enrollmentShare: num(r.enrollment_share), excessMultiple: num(r.excess_multiple),
      priorYearShare: num(r.prior_year_share), priorYearPaid: num(r.prior_year_paid), twoYearsPriorPaid: num(r.two_years_prior_paid),
      peakShare: num(r.peak_share), peakShareYear: Number(r.peak_share_year), statesBilling: Number(r.states_billing),
      billingNpis: Number(r.billing_npis), newBillingNpis: Number(r.new_billing_npis), top10Share: num(r.top10_share),
      reportingComplete: Boolean(r.reporting_complete), knownCaseId: r.known_case_id, leadScore: num(r.lead_score),
      paidAboveEnrollmentLevel: num(r.paid_above_enrollment_level), paidAbovePriorShareLevel: num(r.paid_above_prior_share_level),
    };
  }

  /**
   * The state's leveling what-if by year: sums of the owner's per-candidate figures over distinct
   * services (a service-year meeting two patterns counts once), with the services ranked by the
   * dollars above the enrollment line in the latest year. Sums only; the lines are the owner's.
   */
  private levelingWhatIf(mine: Shaped[]) {
    // One entry per service-year carrying every pattern it met (the amounts are the same across a share row's patterns).
    const distinct = new Map<string, { row: Shaped; patterns: string[] }>();
    for (const c of mine) {
      const entry = distinct.get(`${c.hcpcs}|${c.year}`) ?? { row: c, patterns: [] };
      entry.patterns.push(c.pattern);
      distinct.set(`${c.hcpcs}|${c.year}`, entry);
    }
    const byYear: Record<number, { year: number; services: number; statePaid: number; aboveEnrollmentLevel: number; abovePriorShareLevel: number; reportingComplete: boolean }> = {};
    for (const { row: c } of distinct.values()) {
      const y = (byYear[c.year] ??= { year: c.year, services: 0, statePaid: 0, aboveEnrollmentLevel: 0, abovePriorShareLevel: 0, reportingComplete: true });
      y.services += 1; y.statePaid += c.statePaid; y.aboveEnrollmentLevel += c.paidAboveEnrollmentLevel; y.abovePriorShareLevel += c.paidAbovePriorShareLevel;
      y.reportingComplete = y.reportingComplete && c.reportingComplete;
    }
    const years = Object.values(byYear).sort((a, b) => a.year - b.year);
    const latestYear = years.length ? years[years.length - 1].year : 0;
    const services = [...distinct.values()].filter(({ row: c }) => c.year === latestYear)
      .map(({ row: c, patterns }) => ({ hcpcs: c.hcpcs, codeLabel: c.codeLabel, patterns: [...patterns].sort(), statePaid: c.statePaid, share: c.share, enrollmentShare: c.enrollmentShare, aboveEnrollmentLevel: c.paidAboveEnrollmentLevel, abovePriorShareLevel: c.paidAbovePriorShareLevel }))
      .sort((a, b) => b.aboveEnrollmentLevel - a.aboveEnrollmentLevel);
    return { latestYear, byYear: years, latest: byYear[latestYear] ?? null, services };
  }
}

function generatedModule(payload: unknown) {
  return `/**\n * Generated by XenoDroid BW export — do not hand-edit.\n * Share-and-surge screen (state x HCPCS x year review candidates), state-neutral (KY + FL candidates with national context).\n * Regenerate: npx tsx src/cli.ts tmsis-screen (or ofr-depot-export) from xenodroid-bw.\n */\nexport const SHARE_AND_SURGE_SCREEN = ${JSON.stringify(payload, null, 2)};\n`;
}
