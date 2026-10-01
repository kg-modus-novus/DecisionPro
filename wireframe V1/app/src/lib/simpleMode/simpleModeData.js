// CodeXen: v1 not-applicable
// View model for simple mode ("Kentucky at a glance"). Presentation only:
// every figure comes from an existing REAL BW export; requirements that have
// no exported data are gap cards with an unblock path, never placeholder numbers.
import { COUNTY_ACCESS_CONTEXT } from '../../data/alp/countyAccessContext.js';
import { MCPAR_PLAN_PERIOD } from '../../data/alp/mcparPlanPeriod.js';
import { KY_COUNTY_SHAPES } from '../../data/alp/kyCountyShapes.js';
import { CountDisclosure } from './countDisclosureProgram.js';
import { PlanComparison } from './planComparisonProgram.js';

const KY_COUNTIES = COUNTY_ACCESS_CONTEXT.byState.KY;
const KY_MCPAR = MCPAR_PLAN_PERIOD.byState.KY;
const KY_MCO_PROGRAM = KY_MCPAR.programs[0];

export const MEMBERS_SOURCE = {
  label: 'Kentucky DMS monthly Medicaid counts by county',
  period: formatMonth(KY_COUNTIES.counties[0]?.membersPeriod),
  sysId: 'KY_DMS_COUNTY_COUNTS',
};

export const MCPAR_SOURCE = {
  label: `CMS Managed Care Program Annual Report (MCPAR) ${MCPAR_PLAN_PERIOD.reportingYear}`,
  period: `Reporting period ending ${KY_MCPAR.reportingPeriodEnd}`,
  uri: MCPAR_PLAN_PERIOD.sourceUri,
  sysId: 'CMS_MCPAR',
};

export const MCPAR_PLAN_COUNT = KY_MCO_PROGRAM.plans.length;

export function formatMonth(period) {
  if (!period) return 'period not reported';
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function formatUsd(value, { compact = false } = {}) {
  if (!Number.isFinite(value)) return 'Not reported';
  if (compact) {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)} billion`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)} million`;
  }
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// ---- Counties -------------------------------------------------------------

const COUNT_DISCLOSURE = new CountDisclosure();
const PLAN_COMPARISON = new PlanComparison();

function discloseCountyMembers() {
  const disclosure = COUNT_DISCLOSURE;
  disclosure.InitializeCountDisclosure();
  disclosure.CountRows = KY_COUNTIES.counties.map((c) => ({ key: c.fips, count: c.medicaidMembers }));
  disclosure.GroupTotalIsShown = true;
  disclosure.DiscloseAggregateCounts();
  return { rows: disclosure.DisclosedRows, totalIsWithheld: disclosure.GroupTotalIsWithheld };
}

const MEMBER_DISCLOSURE = discloseCountyMembers();
const DISCLOSED_MEMBERS = new Map(MEMBER_DISCLOSURE.rows.map((row) => [row.key, row]));
export const MEMBERS_TOTAL_IS_WITHHELD = MEMBER_DISCLOSURE.totalIsWithheld;
const SHAPES_BY_FIPS = new Map(KY_COUNTY_SHAPES.counties.map((s) => [s.fips, s]));

export function titleCaseCounty(name) {
  return String(name || '').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export const KY_COUNTY_ROWS = KY_COUNTIES.counties.map((c) => {
  const disclosed = DISCLOSED_MEMBERS.get(c.fips);
  return {
    fips: c.fips,
    name: titleCaseCounty(c.county),
    members: disclosed.suppressed ? null : c.medicaidMembers,
    membersDisplay: disclosed.display,
    suppressed: disclosed.suppressed,
    hpsaLabel: c.hpsaPrimaryCareLabel || 'Not reported',
    certifiedSnfBeds: c.certifiedSnfBeds,
    snfFacilityCount: c.snfFacilityCount,
    shape: SHAPES_BY_FIPS.get(c.fips) || null,
  };
});

export const KY_MEMBERS_TOTAL = KY_COUNTIES.counties.reduce((sum, c) => sum + (c.medicaidMembers || 0), 0);

// Five quantile bands so the map shows spread rather than one large county.
export function quantileBands(values, bandCount = 5) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const bands = [];
  for (let i = 0; i < bandCount; i += 1) {
    const lo = sorted[Math.floor((i * sorted.length) / bandCount)];
    const hi = sorted[Math.min(sorted.length - 1, Math.floor(((i + 1) * sorted.length) / bandCount) - 1)];
    bands.push({ index: i, min: lo, max: hi });
  }
  return bands;
}

export function bandIndexFor(value, bands) {
  if (!Number.isFinite(value) || !bands.length) return null;
  for (let i = bands.length - 1; i >= 0; i -= 1) if (value >= bands[i].min) return i;
  return 0;
}

export const MEMBER_BANDS = quantileBands(KY_COUNTY_ROWS.map((r) => r.members));

const RANKED_COUNTIES = KY_COUNTY_ROWS.filter((r) => Number.isFinite(r.members)).sort((a, b) => b.members - a.members);
export const MOST_MEMBERS_COUNTIES = RANKED_COUNTIES.slice(0, 5);
export const FEWEST_MEMBERS_COUNTIES = RANKED_COUNTIES.slice(-5).reverse();

// ---- MCOs -----------------------------------------------------------------

// Derived ratios carry the export's MCPAR-COMPARE-v1 verdict; app-computed
// ratios (such as premium per enrollee) have none and are never offered.
const EXPORTED_COMPARABILITY = KY_MCO_PROGRAM.comparability || {};

export const MCO_MEASURES = [
  { id: 'enrollment', label: 'Enrollment', kind: 'count', derived: false, higherLabel: 'Most members first' },
  { id: 'mlrPercent', label: 'Share of premium spent on care (MLR %)', kind: 'percent', derived: false, higherLabel: 'Highest first' },
  { id: 'encounterTimelyPercent', label: 'Encounter data submitted on time (%)', kind: 'percent', derived: false, higherLabel: 'Highest first' },
  { id: 'piInvestigationsPer100k', label: 'Program integrity investigations per 100k members', kind: 'ratio', derived: true, higherLabel: 'Highest first' },
  { id: 'appealsPer1k', label: 'Appeals per 1,000 members', kind: 'ratio', derived: true, higherLabel: 'Highest first' },
  { id: 'grievancesPer1k', label: 'Grievances per 1,000 members', kind: 'ratio', derived: true, higherLabel: 'Highest first' },
];

export const MCO_ROWS = KY_MCO_PROGRAM.plans.map((p) => ({
  plan: p.plan,
  dataQualityFlags: p.dataQualityFlags || [],
  values: {
    enrollment: p.measures.enrollment ?? null,
    mlrPercent: p.measures.mlrPercent ?? null,
    encounterTimelyPercent: p.measures.encounterTimelyPercent ?? null,
    piInvestigationsPer100k: p.derived?.piInvestigationsPer100k ?? null,
    appealsPer1k: p.derived?.appealsPer1k ?? null,
    grievancesPer1k: p.derived?.grievancesPer1k ?? null,
  },
}));

export function compareMcos(measureId) {
  const measure = MCO_MEASURES.find((m) => m.id === measureId) || MCO_MEASURES[0];
  const comparison = PLAN_COMPARISON;
  comparison.InitializePlanComparison();
  comparison.PlanRows = MCO_ROWS;
  comparison.MeasureId = measure.id;
  comparison.MeasureIsDerivedRatio = measure.derived;
  comparison.ExportedComparabilityVerdict = EXPORTED_COMPARABILITY[measure.id]?.comparable === true;
  comparison.OrderPlansOnComparableMeasure();
  return {
    measure,
    comparable: comparison.MeasureIsComparable,
    note: EXPORTED_COMPARABILITY[measure.id]?.note || '',
    rows: comparison.OrderedPlanRows,
  };
}

export const MCO_COMPARABLE_MEASURE_IDS = MCO_MEASURES.filter((m) => compareMcos(m.id).comparable).map((m) => m.id);

// A measure every plan reports identically shows as a column but orders nothing.
export const MCO_UNIFORM_MEASURE_IDS = MCO_MEASURES
  .filter((m) => new Set(MCO_ROWS.map((r) => r.values[m.id]).filter(Number.isFinite)).size === 1)
  .map((m) => m.id);

const MCO_PREMIUM_TOTAL = KY_MCO_PROGRAM.plans.reduce((s, p) => s + (p.measures.premiumRevenue || 0), 0);
const MCO_ENROLLMENT_TOTAL = KY_MCO_PROGRAM.plans.reduce((s, p) => s + (p.measures.enrollment || 0), 0);

export function formatMeasure(value, kind) {
  if (!Number.isFinite(value)) return 'Not reported';
  if (kind === 'usd') return formatUsd(value);
  if (kind === 'percent') return `${value}%`;
  if (kind === 'count') return value.toLocaleString('en-US');
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

// ---- Headline tiles (FR-1) ------------------------------------------------

export const HEADLINE_TILES = [
  {
    id: 'members-statewide',
    label: 'Medicaid members counted by county',
    value: MEMBERS_TOTAL_IS_WITHHELD ? 'Withheld' : KY_MEMBERS_TOTAL.toLocaleString('en-US'),
    detail: `Sum of all 120 county counts, ${MEMBERS_SOURCE.period}. Members with no county on file are not included.`,
    source: MEMBERS_SOURCE,
    target: 'map',
  },
  {
    id: 'mco-premium-total',
    label: 'Paid to managed care plans in a year',
    value: formatUsd(MCO_PREMIUM_TOTAL, { compact: true }),
    detail: `Premium revenue reported by all ${KY_MCO_PROGRAM.plans.length} plans for ${MCPAR_PLAN_PERIOD.reportingYear}.`,
    source: MCPAR_SOURCE,
    target: 'mco',
  },
  {
    id: 'mco-premium-per-enrollee',
    label: 'Premium per plan member, statewide',
    value: formatUsd(MCO_PREMIUM_TOTAL / MCO_ENROLLMENT_TOTAL),
    detail: `All plans' reported premium revenue ÷ all plans' reported enrollment, ${MCPAR_PLAN_PERIOD.reportingYear}. A yearly approximation: enrollment is a single reported count, not member-months.`,
    source: MCPAR_SOURCE,
    target: 'mco',
  },
  {
    id: 'mco-count',
    label: `Managed care plans reporting for ${MCPAR_PLAN_PERIOD.reportingYear}`,
    value: String(MCPAR_PLAN_COUNT),
    detail: 'Plan contract changes since then are not loaded yet.',
    source: MCPAR_SOURCE,
    target: 'mco',
  },
  {
    id: 'county-most',
    label: 'Most Medicaid members',
    value: MOST_MEMBERS_COUNTIES[0]?.name || 'Not reported',
    detail: `${MOST_MEMBERS_COUNTIES[0]?.membersDisplay} members, ${MEMBERS_SOURCE.period}.`,
    source: MEMBERS_SOURCE,
    target: 'map',
    focusFips: MOST_MEMBERS_COUNTIES[0]?.fips,
  },
  {
    id: 'county-fewest',
    label: 'Fewest Medicaid members',
    value: FEWEST_MEMBERS_COUNTIES[0]?.name || 'Not reported',
    detail: `${FEWEST_MEMBERS_COUNTIES[0]?.membersDisplay} members, ${MEMBERS_SOURCE.period}.`,
    source: MEMBERS_SOURCE,
    target: 'map',
    focusFips: FEWEST_MEMBERS_COUNTIES[0]?.fips,
  },
];

export const HEADLINE_TILE_IDS = HEADLINE_TILES.map((t) => t.id);

// ---- Gap cards ------------------------------------------------------------

export const SIMPLE_MODE_GAPS = [
  {
    id: 'gap-districts',
    topic: 'Your district',
    title: 'Legislative districts are not loaded yet',
    why: 'The map shows counties. House and Senate district boundaries, and which counties each district covers, are not in DecisionPro yet.',
    unblock: 'Load the LRC House and Senate district boundaries and a county-to-district crosswalk.',
  },
  {
    id: 'gap-add',
    topic: 'Area Development Districts',
    title: 'Area Development District groupings are not loaded yet',
    why: 'Grouping counties into Kentucky’s Area Development Districts needs the official county roster.',
    unblock: 'Load the Kentucky Council of Area Development Districts county roster.',
  },
  {
    id: 'gap-waivers',
    topic: 'Waiver waitlists',
    title: 'Waiver slots and waitlists are not loaded yet',
    why: 'Michelle P., SCL and HCB waiver slots and waitlists are published in Cabinet briefings, not yet loaded through a reconciled export.',
    unblock: 'Load the CHFS 1915(c) waiver update to the Budget Review Subcommittee (Sept 17, 2025), then the CHFS waitlist dashboard when it is published.',
  },
  {
    id: 'gap-behavioral-health',
    topic: 'Behavioral health',
    title: 'Behavioral health spending is not loaded yet',
    why: 'Statewide behavioral health and substance use spending has been reported to committees but is not yet loaded with its source.',
    unblock: 'Load the DMS behavioral health spending figures presented to the Health and Family Services budget subcommittee.',
  },
  {
    id: 'gap-mco-quality',
    topic: 'Plan quality and payment speed',
    title: 'Plan quality scores and payment speed are not loaded yet',
    why: 'HEDIS and member-survey results by plan, and how fast plans pay claims, are not yet in DecisionPro.',
    unblock: 'Load the IPRO external quality review results by plan; request quarterly prompt-pay reports from the Department of Insurance.',
  },
  {
    id: 'gap-plan-contracts',
    topic: 'Plan consolidation',
    title: 'Current plan contracts are not loaded yet',
    why: `The plan comparison uses the ${MCPAR_PLAN_PERIOD.reportingYear} federal report. Which plans hold Kentucky Medicaid contracts today is not yet loaded with its source.`,
    unblock: 'Load the DMS managed care contracts page, with its retrieval date, through BW.',
  },
  {
    id: 'gap-demographics',
    topic: 'Who is covered',
    title: 'Age, sex and program breakdowns are not loaded yet',
    why: 'County counts by age group, sex and program (such as CHIP) are not yet loaded.',
    unblock: 'Load the DMS monthly counts by age, sex and eligibility category.',
  },
];

export const HOT_TOPICS = [
  { id: 'topic-mco', label: 'Plan consolidation', target: 'mco' },
  { id: 'topic-county', label: 'Medicaid in my county', target: 'map' },
  { id: 'topic-waivers', label: 'Waiver waitlists', target: 'gap-waivers' },
  { id: 'topic-bh', label: 'Behavioral health', target: 'gap-behavioral-health' },
  { id: 'topic-district', label: 'My district', target: 'gap-districts' },
];
