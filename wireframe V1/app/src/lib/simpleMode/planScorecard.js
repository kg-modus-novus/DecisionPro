// CodeXen: v1 not-applicable
// Side-by-side plan scorecard for simple mode (presentation only). Joins the
// per-plan rows of sourced measures and the CMS MCPAR plan record on a plan key
// read from each source's own plan name.
import { MCPAR_PLAN_PERIOD } from '../../data/alp/mcparPlanPeriod.js';
import { maybeMeasure } from './sourcedData.js';

export const PLAN_KEYS = ['wellcare', 'passport', 'aetna', 'humana', 'united', 'anthem'];
export const PLAN_NAMES = {
  wellcare: 'WellCare of Kentucky',
  passport: 'Passport by Molina Healthcare',
  aetna: 'Aetna Better Health of Kentucky',
  humana: 'Humana Healthy Horizons in Kentucky',
  united: 'UnitedHealthcare Community Plan',
  anthem: 'Anthem Blue Cross Blue Shield',
};
export const EXITED = { anthem: 'Left Kentucky Medicaid on January 1, 2025' };

export function planKey(name = '') {
  const m = String(name).toLowerCase().match(/wellcare|passport|aetna|humana|united|anthem/);
  return m ? m[0] : null;
}

const MCPAR = MCPAR_PLAN_PERIOD.byState.KY.programs[0];
const MCPAR_BY_PLAN = new Map(MCPAR.plans.map((p) => [planKey(p.plan), p]));
const MCPAR_SOURCE = { publisher: 'CMS', title: `Managed Care Program Annual Report (MCPAR) ${MCPAR_PLAN_PERIOD.reportingYear}`, url: MCPAR_PLAN_PERIOD.sourceUri };

function rowsByPlan(id) {
  const m = maybeMeasure(id);
  return m ? new Map(m.rows.map((r) => [planKey(r.label) || planKey(r.key), r.value])) : new Map();
}

// Columns: sourced per-plan measures, then MCPAR. `better` drives ordering only.
const SOURCED_COLUMNS = [
  { id: 'enrollment-by-plan', short: 'Members', better: null },
  { id: 'pa-standard-denied-pct', short: 'Routine prior authorizations denied', better: 'lower' },
  { id: 'pa-standard-median-days', short: 'Typical wait for a routine prior authorization', better: 'lower' },
  { id: 'pa-overturned-on-appeal-pct', short: 'Appealed denials later approved', better: null },
  { id: 'mco-wcv-well-care', short: 'Well-care visits, ages 3–21', better: 'higher' },
  { id: 'mco-ppc-postpartum', short: 'Postpartum visit', better: 'higher' },
  { id: 'mco-cbp-blood-pressure', short: 'Blood pressure under control', better: 'higher' },
  { id: 'mco-fum-7day', short: 'Seen within 7 days of an ER visit for mental illness', better: 'higher' },
  { id: 'mco-cahps-child-rating-health-plan', short: 'Parents rating the plan 9–10', better: 'higher' },
  { id: 'quality-withhold-dollars-estimate', short: 'Quality withhold at stake', better: null },
  { id: 'eqr-provider-selection-compliance', short: 'State review: credentialing rules', better: 'higher' },
];

const MCPAR_COLUMNS = [
  { key: 'mlrPercent', short: 'Share of premium spent on care (MLR)', unit: 'percent', better: 'higher', from: 'measures' },
  { key: 'appealsPer1k', short: 'Appeals per 1,000 members', unit: 'ratio', better: 'lower', from: 'derived' },
  { key: 'grievancesPer1k', short: 'Grievances per 1,000 members', unit: 'ratio', better: 'lower', from: 'derived' },
  { key: 'encounterTimelyPercent', short: 'Claims data sent to the state on time', unit: 'percent', better: 'higher', from: 'measures' },
];

export const SCORECARD_COLUMNS = [
  ...SOURCED_COLUMNS.map((c) => {
    const m = maybeMeasure(c.id);
    return m ? { ...c, label: c.short, unit: m.unit, period: m.period, estimate: m.method === 'estimate', source: m.source, values: rowsByPlan(c.id) } : null;
  }).filter(Boolean),
  ...MCPAR_COLUMNS.map((c) => ({
    id: `mcpar-${c.key}`,
    label: c.short,
    unit: c.unit,
    better: c.better,
    period: `MCPAR ${MCPAR_PLAN_PERIOD.reportingYear}`,
    estimate: false,
    source: MCPAR_SOURCE,
    values: new Map(PLAN_KEYS.map((k) => [k, MCPAR_BY_PLAN.get(k)?.[c.from]?.[c.key] ?? null])),
  })),
];

/** Columns a visitor may order plans by: not estimates, and not columns every plan reports identically (MLR). */
export const ORDERABLE_COLUMNS = SCORECARD_COLUMNS.filter((c) => {
  if (c.estimate) return false;
  const vals = ['wellcare', 'passport', 'aetna', 'humana', 'united'].map((k) => c.values.get(k)).filter(Number.isFinite);
  return new Set(vals).size > 1;
});

export function scorecardRows(sortColumnId = 'enrollment-by-plan') {
  const col = SCORECARD_COLUMNS.find((c) => c.id === sortColumnId) || SCORECARD_COLUMNS[0];
  const sign = col.better === 'lower' ? 1 : -1;
  const rows = PLAN_KEYS.map((key) => ({ key, name: PLAN_NAMES[key], exited: EXITED[key] || null }));
  const val = (r) => col.values.get(r.key);
  return rows.sort((a, b) => {
    if (a.exited !== b.exited) return a.exited ? 1 : -1;
    const va = val(a);
    const vb = val(b);
    if (!Number.isFinite(va)) return 1;
    if (!Number.isFinite(vb)) return -1;
    return (va - vb) * sign;
  });
}

export const SANCTIONS = (MCPAR.sanctions?.records || []).map((r) => ({
  plan: r.planName,
  type: r.interventionType,
  topic: r.interventionTopic,
  reason: r.interventionReason,
  dollars: r.dollarAmountValue,
  date: r.assessmentDate,
  remediated: r.remediationCompleted,
  citation: r.citedSections?.[0] ? `Contract §${r.citedSections[0].sectionNumber} ${titleCase(r.citedSections[0].sectionTitle)}, p. ${r.citedSections[0].pdfPage}` : null,
}));
export const SANCTIONS_SOURCE = MCPAR_SOURCE;

function titleCase(s = '') {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
