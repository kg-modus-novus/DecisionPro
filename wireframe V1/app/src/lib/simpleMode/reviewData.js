// CodeXen: v1 not-applicable
// REVIEW BUILD ONLY — figures entered by hand from published state documents
// for Adam Mather's review (Director decision 2026-10-01). These bypass the BW
// export pipeline on purpose and are labeled "entered by hand" wherever shown.
// Active only when the build sets VITE_DP_REVIEW=1; the public demo never shows them.
import { MCPAR_PLAN_PERIOD } from '../../data/alp/mcparPlanPeriod.js';
import { MCO_MEASURES, MCO_ROWS, formatUsd } from './simpleModeData.js';

export const IS_REVIEW_BUILD = import.meta.env?.VITE_DP_REVIEW === '1';

export const WAIVER_SOURCE = {
  label: 'CHFS, Update on 1915(c) Home and Community Based Waivers, BR Subcommittee on Health and Family Services, Sept 17, 2025 (data as of Sept 2, 2025)',
  url: 'https://apps.legislature.ky.gov/CommitteeDocuments/372/35636/Sept%2017%202025%20CHFS%20Waiver%20Update%20PowerPoint.pdf',
};

export const BH_SOURCE = {
  label: 'DMS, Medicaid Behavioral Health and Substance Abuse Treatment, House Budget Review Subcommittee on Health and Family Services, Feb 12, 2025',
  url: 'https://apps.legislature.ky.gov/CommitteeDocuments/309/34728/HBR%20HFS%20Feb%2012%202025%20DMS%20Lee%20PowerPoint.pdf',
};

export const PLAN_STATUS_SOURCE = {
  label: 'DMS/IPRO, FY2025 Comprehensive Evaluation Summary, July 2025',
  url: 'https://www.chfs.ky.gov/agencies/dms/DMSMCOReports/2025%20FY%20Comprehensive%20Evaluation%20Summary.pdf',
};

// Slide 4 (slot allocations) and slide 5 (days on waitlist).
export const WAIVERS = [
  { id: 'MPW', name: 'Michelle P. Waiver', serves: 'Intellectual or developmental disabilities', funded: 11350, filled: 9981, waitlist: 9686, avgDaysWaiting: 1274 },
  { id: 'SCL', name: 'Supports for Community Living', serves: 'Intellectual or developmental disabilities', funded: 5416, filled: 5005, waitlist: 3742, avgDaysWaiting: 2830 },
  { id: 'HCB', name: 'Home and Community Based', serves: 'Older adults and people with disabilities', funded: 17800, filled: 16083, waitlist: 5360, avgDaysWaiting: 119 },
  { id: 'ABI', name: 'Acquired Brain Injury', serves: 'Adults with a brain injury, rehabilitation', funded: 383, filled: 269, waitlist: 0, avgDaysWaiting: null },
  { id: 'ABI-LTC', name: 'Acquired Brain Injury Long Term Care', serves: 'Adults with a brain injury, ongoing support', funded: 488, filled: 442, waitlist: 0, avgDaysWaiting: null },
  { id: 'MIIW', name: 'Model II Waiver', serves: 'People on a ventilator 12+ hours a day', funded: 100, filled: 14, waitlist: 0, avgDaysWaiting: null },
];
export const WAITLIST_UNDUPLICATED = 16373;
export const WAIVER_NEW_SLOTS_SFY26 = 'SFY 2026 added 500 HCB, 500 Michelle P. and 250 SCL slots.';

// Slides 11 and 13 (MCO paid amounts).
export const BH_SPEND = { sfy2023: 2098998314.77, sfy2024: 2300422123.38, sudSfy2024: 1065394953 };
export const BH_SPEND_BY_PLAN_SFY2024 = {
  'Aetna Better Health': 364488373.83,
  'Anthem Blue Cross/Blue Shield': 270788535.79,
  'Humana Healthy Horizons': 326022999.77,
  'Passport by Molina': 535803866.50,
  'WellCare of KY': 626798349.80,
  'United Healthcare Community Plan': 176519997.69,
};

export const EXITED_PLANS = { 'Anthem Blue Cross/Blue Shield': 'Left Kentucky Medicaid on Jan 1, 2025' };
export const CURRENT_PLAN_COUNT = MCO_ROWS.filter((r) => !EXITED_PLANS[r.plan]).length;

export const REVIEW_TILES = [
  {
    id: 'review-plans-today',
    label: 'Managed care plans today',
    value: String(CURRENT_PLAN_COUNT),
    detail: 'Anthem left on Jan 1, 2025. Entered by hand.',
    source: { label: PLAN_STATUS_SOURCE.label },
    target: 'mco',
    handEntered: true,
  },
  {
    id: 'review-waitlist',
    label: 'People waiting for a waiver slot',
    value: WAITLIST_UNDUPLICATED.toLocaleString('en-US'),
    detail: 'Across all six 1915(c) waivers, each person counted once, Sept 2, 2025. Entered by hand.',
    source: { label: 'CHFS waiver update, Sept 17, 2025' },
    target: 'waivers',
    handEntered: true,
  },
  {
    id: 'review-bh-spend',
    label: 'Behavioral health spending by plans',
    value: formatUsd(BH_SPEND.sfy2024, { compact: true }),
    detail: `SFY 2024, up from ${formatUsd(BH_SPEND.sfy2023, { compact: true })}. ${formatUsd(BH_SPEND.sudSfy2024, { compact: true })} was for substance use disorder. Entered by hand.`,
    source: { label: 'DMS behavioral health briefing, Feb 12, 2025' },
    target: 'mco',
    handEntered: true,
  },
];

// Review table: every measure is orderable, including non-comparable and
// app-computed ones, each with the direction treated as "better" (null = none).
const BETTER_DIRECTION = {
  enrollment: null,
  mlrPercent: 'higher',
  encounterTimelyPercent: 'higher',
  piInvestigationsPer100k: 'higher',
  appealsPer1k: 'lower',
  grievancesPer1k: 'lower',
};

export const REVIEW_MCO_MEASURES = [
  ...MCO_MEASURES.map((m) => ({ ...m, better: BETTER_DIRECTION[m.id] ?? null })),
  { id: 'premiumPerEnrollee', label: 'Premium revenue per enrollee (computed)', kind: 'usd', derived: true, better: 'lower' },
  { id: 'bhSpendSfy2024', label: 'Behavioral health spend, SFY 2024 (entered by hand)', kind: 'usd', derived: false, better: null },
];

const PREMIUM_PER_ENROLLEE = new Map(MCPAR_PLAN_PERIOD.byState.KY.programs[0].plans.map((p) => [
  p.plan,
  Number.isFinite(p.measures.premiumRevenue) && p.measures.enrollment > 0 ? p.measures.premiumRevenue / p.measures.enrollment : null,
]));

export const REVIEW_MCO_ROWS = MCO_ROWS.map((row) => ({
  ...row,
  status: EXITED_PLANS[row.plan] || 'Current plan',
  exited: Boolean(EXITED_PLANS[row.plan]),
  values: {
    ...row.values,
    premiumPerEnrollee: PREMIUM_PER_ENROLLEE.get(row.plan) ?? null,
    bhSpendSfy2024: BH_SPEND_BY_PLAN_SFY2024[row.plan] ?? null,
  },
}));

// Top 3 among current plans on the chosen measure. Measures with no
// "better" direction (size, spend) are ordered largest first and get no badge.
export function rankReviewMcos(measureId) {
  const measure = REVIEW_MCO_MEASURES.find((m) => m.id === measureId) || REVIEW_MCO_MEASURES[0];
  const sign = measure.better === 'lower' ? 1 : -1;
  const reporting = REVIEW_MCO_ROWS.filter((r) => Number.isFinite(r.values[measure.id]));
  const missing = REVIEW_MCO_ROWS.filter((r) => !Number.isFinite(r.values[measure.id]));
  const ordered = [...reporting].sort((a, b) => (a.values[measure.id] - b.values[measure.id]) * sign);
  const current = ordered.filter((r) => !r.exited);
  const top3 = measure.better ? new Set(current.slice(0, 3).map((r) => r.plan)) : new Set();
  return { measure, rows: [...ordered, ...missing], top3 };
}
