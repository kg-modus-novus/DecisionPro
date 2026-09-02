import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { ParseCsvRecords, Sha256 } from '../adapters/operationalPublicSources.js';
import { CiteSections, type ContractSection } from './IndexContractSections.js';

/**
 * Business Action: ExportMcparPlanPeriodForUi
 *
 * Builds the plan × program × reporting-period accountability record for
 * Kentucky and Florida from the byte-faithful CMS MCPAR PUF already retained
 * in PSA (KY: data/psa/psa/CMS_MCPAR/REAL; FL: var/psa/fl-ahca/CMS_MCPAR/REAL).
 *
 * Governance:
 *  - Person-level gate: the PUF carries submitter/contact name and e-mail
 *    question IDs. Those question IDs are never read into this record; a
 *    structural check scans the emitted payload for them.
 *  - No-adverse-conclusion gate: every value is a state-reported annual
 *    response. Derived ratios are triage prompts; dispersion above the
 *    comparability threshold marks a measure non-comparable until the
 *    reporting definition is confirmed, and no plan is ranked on it.
 *  - Sanction records are a positional repeating group in the PUF (parallel
 *    lists under sanction_* question IDs). They are aligned by position only
 *    when every list has the same length; otherwise a data-quality gap is
 *    recorded and no record is fabricated.
 */

type CsvRow = Record<string, string>;

type MeasureDef = {
  id: string;
  questionId: string;
  label: string;
  kind: 'count' | 'percent' | 'usd';
};

const PERSON_LEVEL_QUESTION_IDS = new Set([
  'submitterName', 'submitterEmailAddress', 'contactName', 'contactEmailAddress',
]);

const PLAN_MEASURES: MeasureDef[] = [
  { id: 'enrollment', questionId: 'plan_enrollment', label: 'Plan enrollment', kind: 'count' },
  { id: 'mlrPercent', questionId: 'plan_medicalLossRatioPercentage', label: 'Medical loss ratio (%)', kind: 'percent' },
  { id: 'encounterTimelyPercent', questionId: 'plan_encounterDataSubmissionTimelinessCompliancePercentage', label: 'Encounter data submission timeliness compliance (%)', kind: 'percent' },
  { id: 'encounterHipaaPercent', questionId: 'plan_encounterDataSubmissionHipaaCompliancePercentage', label: 'Encounter data HIPAA compliance (%)', kind: 'percent' },
  { id: 'overpaymentsReported', questionId: 'plan_overpaymentReportingToStateDollarAmount', label: 'Overpayments reported to the state ($)', kind: 'usd' },
  { id: 'premiumRevenue', questionId: 'plan_overpaymentReportingToStateCorrespondingYearPremiumRevenue', label: 'Corresponding-year premium revenue ($)', kind: 'usd' },
  { id: 'piInvestigationsOpened', questionId: 'plan_openedProgramIntegrityInvestigations', label: 'Program integrity investigations opened', kind: 'count' },
  { id: 'piInvestigationsResolved', questionId: 'plan_resolvedProgramIntegrityInvestigations', label: 'Program integrity investigations resolved', kind: 'count' },
  { id: 'piReferrals', questionId: 'plan_programIntegrityReferrals', label: 'Program integrity referrals', kind: 'count' },
  { id: 'piStaff', questionId: 'plan_dedicatedProgramIntegrityStaff', label: 'Dedicated program integrity staff', kind: 'count' },
  { id: 'grievancesResolved', questionId: 'plan_resolvedGrievances', label: 'Grievances resolved', kind: 'count' },
  { id: 'accessGrievances', questionId: 'plan_resolvedAccessToCareGrievances', label: 'Access-to-care grievances resolved', kind: 'count' },
  { id: 'qualityGrievances', questionId: 'plan_resolvedQualityOfCareGrievances', label: 'Quality-of-care grievances resolved', kind: 'count' },
  { id: 'appealsResolved', questionId: 'plan_resolvedAppeals', label: 'Appeals resolved', kind: 'count' },
  { id: 'appealsDenied', questionId: 'plan_appealsDenied', label: 'Appeals denied', kind: 'count' },
  { id: 'appealsFavorable', questionId: 'plan_appealsResolvedInFavorOfEnrollee', label: 'Appeals resolved in favor of the enrollee', kind: 'count' },
  { id: 'timelyStandardAppeals', questionId: 'plan_timelyResolvedStandardAppeals', label: 'Standard appeals resolved timely', kind: 'count' },
  { id: 'fairHearingsFiled', questionId: 'plan_stateFairHearingRequestsFiled', label: 'State fair hearing requests filed', kind: 'count' },
  { id: 'fairHearingsFavorable', questionId: 'plan_stateFairHearingRequestsWithFavorableDecision', label: 'State fair hearings with a favorable decision', kind: 'count' },
];

const SANCTION_FIELDS = [
  ['planName', 'sanction_planName'],
  ['interventionType', 'sanction_interventionType'],
  ['interventionTopic', 'sanction_interventionTopic'],
  ['interventionReason', 'sanction_interventionReason'],
  ['dollarAmount', 'sanction_dollarAmount'],
  ['noncomplianceInstances', 'sanction_noncomplianceInstances'],
  ['assessmentDate', 'sanction_assessmentDate'],
  ['remediationDate', 'sanction_remediationDate'],
  ['remediationCompleted', 'sanction_remediationCompleted'],
  ['correctiveActionPlan', 'sanction_correctiveActionPlan'],
] as const;

const PROGRAM_CONTEXT_QUESTIONS: Array<[string, string]> = [
  ['contractTitleAndDate', 'program_contractTitleAndDate'],
  ['contractUrl', 'program_contractUrl'],
  ['networkAdequacyChallenges', 'program_networkAdequacyChallenges'],
  ['networkAdequacyGapResponse', 'program_networkAdequacyGapResponseEfforts'],
  ['encounterTimelinessStandard', 'program_encounterDataSubmissionTimelinessStandardDefinition'],
];

const COMPARABILITY_DISPERSION_LIMIT = 10;
const STATE_NAMES: Record<string, string[]> = { KY: ['KY', 'KENTUCKY'], FL: ['FL', 'FLORIDA'] };

/** Header-tolerant cell accessor: exact, lower-case, or BOM-prefixed key. */
function cell(row: CsvRow, name: string): string {
  const value = row[name] ?? row[name.toLowerCase()] ?? row[`﻿${name}`] ?? row[`﻿${name.toLowerCase()}`];
  return value == null ? '' : String(value).trim();
}

function numberOrNull(value: string | undefined): number | null {
  if (value == null) return null;
  const cleaned = value.replace(/[$,%\s]/g, '');
  if (!cleaned || /^n\/?a$/i.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function latestFile(root: string, fileName: string) {
  let stamps: string[] = [];
  try { stamps = (await fs.readdir(root)).sort(); } catch { return null; }
  for (const stamp of stamps.reverse()) {
    const candidate = path.join(root, stamp, fileName);
    try { await fs.access(candidate); return candidate; } catch { /* keep looking */ }
  }
  return null;
}

function generatedModule(payload: unknown) {
  return `/**
 * Generated by XenoDroid BW export — do not hand-edit.
 * CMS MCPAR plan-period accountability record, state-neutral (KY + FL).
 * Every value is a state-reported annual response — an investigation lead,
 * never proof of breach, waste, or misconduct. No submitter or contact
 * fields are read from the publisher file.
 */
export const MCPAR_PLAN_PERIOD = ${JSON.stringify(payload, null, 2)};
`;
}

type Check = { check_id: string; ok: boolean; expected: string; actual: string; detail: string };

export class ExportMcparPlanPeriodForUi {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  ExportPath = config.mcparPlanPeriodExportPath;
  StateCount = 0;
  PlanCount = 0;
  SanctionCount = 0;
  ReconciliationStatus: 'PASS' | 'FAIL' = 'FAIL';
  Checks: Check[] = [];

  private contractSections: ContractSection[] = [];

  constructor(private client: pg.PoolClient | null = null) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      if (this.client) {
        // Kentucky contract section index (IndexContractSections) — lets a
        // sanction citation such as "26.13" or "Appendix A" resolve to a
        // section title and PDF page. Absent index → no citations, no gap
        // fabricated.
        const sections = await this.client.query<{ section_id: string; plan_name: string; document_file: string; document_hash: string; section_number: string; section_title: string; pdf_page: number; page_count: number; text_hash: string; excerpt: string }>(
          `SELECT DISTINCT ON (section_id) section_id, plan_name, document_file, document_hash, section_number, section_title, pdf_page, page_count, text_hash, excerpt
           FROM bw_dso.dso_contract_section WHERE load_class='REAL' ORDER BY section_id, load_history_id DESC`,
        );
        this.contractSections = sections.rows.map((s) => ({
          sectionId: s.section_id, plan: s.document_file.match(/contract-\d+-([A-Za-z]+)\./)?.[1] || s.plan_name, mcparPlanName: s.plan_name,
          documentFile: s.document_file, documentHash: s.document_hash, sectionNumber: s.section_number, sectionTitle: s.section_title,
          pdfPage: Number(s.pdf_page), pageCount: Number(s.page_count), textHash: s.text_hash, excerpt: s.excerpt,
        }));
      }
      const sources = {
        KY: await latestFile(path.join(config.psaRoot, 'psa', 'CMS_MCPAR', 'REAL'), 'mcpar-2024.csv'),
        FL: await latestFile(path.join(config.floridaPsaRoot, 'CMS_MCPAR', 'REAL'), 'F-FED-01.csv'),
      };
      const byState: Record<string, unknown> = {};
      for (const state of config.ofrStates) {
        const file = sources[state];
        if (!file) {
          byState[state] = this.gapSlice(state, `No retained MCPAR PUF found in PSA for ${state}.`);
          continue;
        }
        const bytes = await fs.readFile(file);
        const rows = ParseCsvRecords(bytes.toString('utf8')) as CsvRow[];
        const stateRows = rows.filter((row) => STATE_NAMES[state].includes(cell(row, 'State').toUpperCase()));
        const floor = state === 'KY' ? 500 : 2000;
        this.Checks.push({
          check_id: `MCPAR-${state}-ROW-FLOOR`, ok: stateRows.length >= floor,
          expected: `>=${floor} ${state} rows`, actual: String(stateRows.length),
          detail: 'Same quality gate the governed loaders apply to the MCPAR PUF slice.',
        });
        byState[state] = this.buildStateSlice(state, stateRows, {
          psaPath: path.relative(config.psaRoot, file).split(path.sep).join('/'),
          contentHash: Sha256(bytes),
          byteLength: bytes.length,
        });
        this.StateCount += 1;
      }

      await this.reconcileAgainstWarehouse(byState);

      const payload = {
        schema: 'decisionpro/mcpar-plan-period/v1',
        generatedAt: new Date().toISOString(),
        loadClass: 'REAL',
        publisher: 'Centers for Medicare & Medicaid Services',
        sourceUri: config.mcparCsvUri,
        reportingYear: '2024',
        measureCatalog: PLAN_MEASURES,
        comparabilityRule: {
          id: 'MCPAR-COMPARE-v1',
          dispersionLimit: COMPARABILITY_DISPERSION_LIMIT,
          text: `A derived plan-level ratio whose largest valid value exceeds its smallest by more than ${COMPARABILITY_DISPERSION_LIMIT}× is marked non-comparable until the reporting definition is confirmed with the reporting entities; no plan is ranked on a non-comparable measure.`,
        },
        personLevelGate: 'Submitter and contact question IDs are never read into this record.',
        reconciliation: { status: 'PASS', claimAllowed: true, checks: [] as Check[] },
        byState,
      };

      const serialized = JSON.stringify(payload);
      const leaked = [...PERSON_LEVEL_QUESTION_IDS].filter((id) => serialized.includes(id));
      this.Checks.push({
        check_id: 'MCPAR-NO-PERSON-LEVEL-FIELDS', ok: leaked.length === 0,
        expected: '0 submitter/contact question IDs in the export', actual: String(leaked.length),
        detail: 'Structural scan of the emitted payload for the PUF person-level question IDs.',
      });
      this.ReconciliationStatus = this.Checks.every((check) => check.ok) ? 'PASS' : 'FAIL';
      payload.reconciliation = { status: this.ReconciliationStatus, claimAllowed: this.ReconciliationStatus === 'PASS', checks: this.Checks };

      await fs.mkdir(path.dirname(this.ExportPath), { recursive: true });
      await fs.writeFile(this.ExportPath, generatedModule(payload), 'utf8');
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  private gapSlice(state: string, reason: string) {
    return {
      state,
      gap: { gapId: `GAP-MCPAR-PLAN-PERIOD-${state}`, reason, unblock: 'Run the governed operational refresh so the MCPAR PUF lands in PSA, then re-run ofr-depot-export.' },
      programs: [],
    };
  }

  private buildStateSlice(state: string, rows: CsvRow[], source: { psaPath: string; contentHash: string; byteLength: number }) {
    const programs = [...new Set(rows.map((row) => cell(row, 'Program')).filter(Boolean))].sort();
    // The PUF publishes M/D/YYYY; normalize to ISO so the as-of date sorts and
    // renders like every other export's date.
    const toIso = (value: string) => {
      const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
      return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
    };
    const periodEnd = rows.map((row) => toIso(cell(row, 'Reporting_Period_End_Date'))).filter((value): value is string => Boolean(value)).sort().at(-1) || null;
    const programSlices = programs.map((program) => this.buildProgram(state, program, rows.filter((row) => cell(row, 'Program') === program)));
    return {
      state,
      source,
      rowCount: rows.length,
      reportingPeriodEnd: periodEnd,
      programs: programSlices,
    };
  }

  private buildProgram(state: string, program: string, rows: CsvRow[]) {
    const plans = [...new Set(rows.map((row) => cell(row, 'Plan_or_BSS')).filter(Boolean))].sort();
    const responsesFor = (plan: string, questionId: string) => rows
      .filter((row) => cell(row, 'Plan_or_BSS') === plan && cell(row, 'Question_ID') === questionId)
      .map((row) => cell(row, 'Response'));

    const planRecords = plans
      .map((plan) => {
        const measures: Record<string, number | null> = {};
        let answered = 0;
        for (const measure of PLAN_MEASURES) {
          const responses = responsesFor(plan, measure.questionId);
          const value = responses.length ? numberOrNull(responses[0]) : null;
          measures[measure.id] = value;
          if (responses.length) answered += 1;
        }
        return { plan, measures, answered };
      })
      // Business-support-system rows (MMIS, eligibility system) answer none of
      // the plan measures; they are reporting entities but not plans.
      .filter((record) => record.answered > 0);

    const derived = planRecords.map((record) => {
      const m = record.measures;
      const flags: Array<{ id: string; text: string }> = [];
      const enrollment = m.enrollment && m.enrollment > 0 ? m.enrollment : null;
      const premium = m.premiumRevenue && m.premiumRevenue > 0 ? m.premiumRevenue : null;
      if (m.appealsDenied != null && m.appealsResolved != null && m.appealsDenied > m.appealsResolved) {
        flags.push({ id: 'APPEALS-DENIED-EXCEED-RESOLVED', text: 'Appeals denied exceed appeals resolved; confirm the reporting definition before comparing.' });
      }
      if (m.timelyStandardAppeals === 0 && (m.appealsResolved ?? 0) > 0) {
        flags.push({ id: 'TIMELY-APPEALS-ZERO', text: 'Zero timely standard appeals reported against a non-zero resolved count; confirm whether the field was answered.' });
      }
      if (enrollment && premium && premium < enrollment * 100) {
        flags.push({ id: 'PREMIUM-BASIS-UNVERIFIED', text: 'Reported premium revenue is implausibly small for the reported enrollment; the overpayment-to-premium ratio is withheld until the basis is confirmed.' });
      }
      if (m.overpaymentsReported != null && premium == null) {
        flags.push({ id: 'PREMIUM-NOT-REPORTED', text: 'Premium revenue not reported or zero; overpayment-to-premium ratio not computable.' });
      }
      const premiumUsable = premium != null && !flags.some((flag) => flag.id === 'PREMIUM-BASIS-UNVERIFIED');
      return {
        plan: record.plan,
        measures: m,
        derived: {
          overpaymentBasisPoints: premiumUsable && m.overpaymentsReported != null ? round((m.overpaymentsReported / premium!) * 10_000, 2) : null,
          appealsPer1k: enrollment && m.appealsResolved != null ? round((m.appealsResolved / enrollment) * 1000, 1) : null,
          appealDenialShare: m.appealsResolved && m.appealsDenied != null ? round(m.appealsDenied / m.appealsResolved, 3) : null,
          grievancesPer1k: enrollment && m.grievancesResolved != null ? round((m.grievancesResolved / enrollment) * 1000, 1) : null,
          piInvestigationsPer100k: enrollment && m.piInvestigationsOpened != null ? round((m.piInvestigationsOpened / enrollment) * 100_000, 1) : null,
        },
        dataQualityFlags: flags,
      };
    });

    const totalOverpayments = derived.reduce((sum, record) => sum + (record.measures.overpaymentsReported ?? 0), 0);
    const totalEnrollment = derived.reduce((sum, record) => sum + (record.measures.enrollment ?? 0), 0);
    const overpaymentShares = derived
      .map((record) => ({
        plan: record.plan,
        overpaymentsReported: record.measures.overpaymentsReported ?? 0,
        overpaymentShare: totalOverpayments > 0 ? round((record.measures.overpaymentsReported ?? 0) / totalOverpayments, 3) : null,
        enrollmentShare: totalEnrollment > 0 ? round((record.measures.enrollment ?? 0) / totalEnrollment, 3) : null,
      }))
      .sort((a, b) => b.overpaymentsReported - a.overpaymentsReported);

    const comparability = Object.fromEntries(
      (['overpaymentBasisPoints', 'appealsPer1k', 'appealDenialShare', 'grievancesPer1k', 'piInvestigationsPer100k'] as const).map((id) => {
        const values = derived.map((record) => record.derived[id]).filter((value): value is number => value != null && value > 0);
        const dispersion = values.length >= 2 ? round(Math.max(...values) / Math.min(...values), 1) : null;
        return [id, {
          validPlans: values.length,
          dispersion,
          comparable: dispersion != null ? dispersion <= COMPARABILITY_DISPERSION_LIMIT : false,
          note: dispersion == null
            ? 'Fewer than two plans reported a usable value.'
            : dispersion <= COMPARABILITY_DISPERSION_LIMIT
              ? 'Dispersion within the comparability limit; still confirm definitions before ranking.'
              : `Dispersion ${dispersion}× exceeds the ${COMPARABILITY_DISPERSION_LIMIT}× limit: treat as non-comparable until the reporting definition is confirmed.`,
        }];
      }),
    );

    const sanctions = this.alignSanctions(state, program, rows);
    const programContext = Object.fromEntries(
      PROGRAM_CONTEXT_QUESTIONS.map(([key, questionId]) => [key, rows
        .filter((row) => !cell(row, 'Plan_or_BSS') && cell(row, 'Question_ID') === questionId)
        .map((row) => cell(row, 'Response'))
        .filter(Boolean)]),
    );

    this.PlanCount += derived.length;
    return {
      program,
      plans: derived,
      totals: {
        planCount: derived.length,
        enrollment: totalEnrollment,
        overpaymentsReported: round(totalOverpayments, 2),
        overpaymentShares,
      },
      comparability,
      sanctions,
      programContext,
    };
  }

  private alignSanctions(state: string, program: string, rows: CsvRow[]) {
    const lists = SANCTION_FIELDS.map(([key, questionId]) => ({
      key,
      questionId,
      values: rows.filter((row) => cell(row, 'Question_ID') === questionId).map((row) => cell(row, 'Response')),
    }));
    // remediationDate is a conditional sub-question (answered only when a
    // remediation date exists), so it is a sparse list that cannot be aligned
    // by position. It is excluded from the alignment gate and exported as
    // null whenever its length differs from the record count.
    const CONDITIONAL_FIELDS = new Set(['remediationDate']);
    const lengths = lists.map((list) => list.values.length);
    const present = lists.filter((list) => list.values.length > 0 && !CONDITIONAL_FIELDS.has(list.key));
    const recordCount = Math.max(0, ...present.map((list) => list.values.length));
    const aligned = present.length > 0 && present.every((list) => list.values.length === recordCount);
    this.Checks.push({
      check_id: `MCPAR-${state}-SANCTION-ALIGNMENT-${program.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40)}`,
      ok: recordCount === 0 || aligned,
      expected: 'Every answered sanction_* list (except the conditional remediationDate) the same length',
      actual: lengths.join('/'),
      detail: 'Sanction records are aligned by list position only when every answered field has the same record count.',
    });
    if (recordCount === 0) return { note: 'No sanction records reported for this program.', aligned: true, records: [] as unknown[], byPlan: [] as unknown[] };
    if (!aligned) {
      return {
        note: 'Sanction lists have unequal lengths in the PUF; records were not aligned. Data-quality gap recorded instead of a fabricated record.',
        aligned: false,
        gap: { gapId: `GAP-MCPAR-SANCTION-ALIGNMENT-${state}`, reason: `Unequal sanction list lengths: ${lengths.join('/')}` },
        records: [] as unknown[],
        byPlan: [] as unknown[],
      };
    }
    const records = Array.from({ length: recordCount }, (_, index) => {
      const record: Record<string, string | number | null> = { index: index + 1 };
      for (const list of lists) {
        if (CONDITIONAL_FIELDS.has(list.key) && list.values.length !== recordCount) { record[list.key] = null; continue; }
        record[list.key] = list.values[index] ?? '';
      }
      record.dollarAmountValue = numberOrNull(String(record.dollarAmount ?? ''));
      return record;
    }) as Array<Record<string, unknown>>;
    if (state === 'KY' && this.contractSections.length) {
      for (const record of records) {
        record.citedSections = CiteSections(String(record.interventionReason || ''), this.contractSections, String(record.planName || '') || null);
      }
    }
    const byPlanMap = new Map<string, { plan: string; records: number; dollarAmount: number; monetaryPenalties: number; correctiveActionPlans: number; notRemediated: number; inProgress: number; topics: Record<string, number> }>();
    for (const record of records) {
      const plan = String(record.planName || 'Not reported');
      const current = byPlanMap.get(plan) || { plan, records: 0, dollarAmount: 0, monetaryPenalties: 0, correctiveActionPlans: 0, notRemediated: 0, inProgress: 0, topics: {} };
      current.records += 1;
      current.dollarAmount += Number(record.dollarAmountValue || 0);
      const type = String(record.interventionType || '').toLowerCase();
      if (/penalt|liquidated/.test(type)) current.monetaryPenalties += 1;
      if (String(record.correctiveActionPlan || '') === 'Yes') current.correctiveActionPlans += 1;
      const remediation = String(record.remediationCompleted || '').toLowerCase();
      if (remediation.startsWith('no')) current.notRemediated += 1;
      if (remediation.includes('in progress')) current.inProgress += 1;
      const topic = String(record.interventionTopic || 'Not reported');
      current.topics[topic] = (current.topics[topic] || 0) + 1;
      byPlanMap.set(plan, current);
    }
    this.SanctionCount += records.length;
    return {
      note: 'State-reported sanction, corrective-action, and compliance-letter records as published in the MCPAR PUF; the clause or reason text is the state\'s own citation. A record is a published intervention, never a DecisionPro finding.',
      aligned: true,
      records,
      byPlan: [...byPlanMap.values()].sort((a, b) => b.records - a.records),
    };
  }

  private async reconcileAgainstWarehouse(byState: Record<string, unknown>) {
    if (!this.client) {
      this.Checks.push({
        check_id: 'MCPAR-WAREHOUSE-RECONCILIATION', ok: true, expected: 'warehouse metrics available',
        actual: 'offline (no client)', detail: 'Warehouse reconciliation skipped: export ran without a database client.',
      });
      return;
    }
    const ky = byState.KY as { rowCount?: number; programs?: Array<{ totals: { overpaymentsReported: number } }> } | undefined;
    if (!ky?.rowCount) return;
    const rowMetric = await this.client.query<{ numeric_value: string | null }>(
      `SELECT numeric_value::text FROM bw_cube.cube_operational_source_metric
       WHERE metric_id='ky-mcpar-rows' AND load_class='REAL' ORDER BY as_of_date DESC, load_history_id DESC LIMIT 1`,
    );
    const expectedRows = rowMetric.rows[0]?.numeric_value == null ? null : Number(rowMetric.rows[0].numeric_value);
    this.Checks.push({
      check_id: 'MCPAR-KY-ROWS-MATCH-WAREHOUSE', ok: expectedRows == null || expectedRows === ky.rowCount,
      expected: expectedRows == null ? 'no warehouse metric' : String(expectedRows), actual: String(ky.rowCount),
      detail: 'Kentucky PUF row count re-read from PSA must equal the hydrated ky-mcpar-rows metric.',
    });
    const overpaymentMetric = await this.client.query<{ numeric_value: string | null }>(
      `SELECT numeric_value::text FROM bw_cube.cube_operational_source_metric
       WHERE metric_id='ky-mcpar-reported-overpayments' AND load_class='REAL' ORDER BY as_of_date DESC, load_history_id DESC LIMIT 1`,
    );
    const expectedOverpayments = overpaymentMetric.rows[0]?.numeric_value == null ? null : Number(overpaymentMetric.rows[0].numeric_value);
    const actualOverpayments = (ky.programs || []).reduce((sum, program) => sum + program.totals.overpaymentsReported, 0);
    this.Checks.push({
      check_id: 'MCPAR-KY-OVERPAYMENTS-MATCH-WAREHOUSE',
      ok: expectedOverpayments == null || Math.abs(expectedOverpayments - actualOverpayments) < 1,
      expected: expectedOverpayments == null ? 'no warehouse metric' : expectedOverpayments.toFixed(2), actual: actualOverpayments.toFixed(2),
      detail: 'Sum of plan-level overpayments must equal the hydrated ky-mcpar-reported-overpayments metric.',
    });
  }
}
