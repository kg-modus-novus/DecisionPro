// CodeXen: v1 not-applicable
// Opening-page briefings: the largest open questions in the sourced data, in
// the intelligence-brief format (headline + lede + affected population +
// responsible entity + next action + status + as-of). Governed templates: a
// headline states the joined fact and the open question, never a verdict, and
// never describes DecisionPro itself (checked by test against
// PROHIBITED_HEADLINE_TERMS and PRODUCT_COMMENTARY_TERMS). A template whose
// figures are missing is skipped, so no briefing shows an empty number.
import { formatNumber } from './measureModel.js';
import { maybeMeasure } from './sourcedData.js';

const pct = (v) => formatNumber(v, 'percent');
const count = (v) => formatNumber(v, 'count');
const row = (m, key) => m?.rows?.find((r) => r.key === key)?.value;

function has(...values) {
  return values.every((v) => Number.isFinite(v));
}

// CHFS waiver waitlist update to the LRC Waiver Waitlist Management Subcommittee,
// Aug 26, 2026 (data as of Aug 17, 2026), the same deck as waiver-waitlist-unduplicated.
const WAITLIST_HOLDING_OTHER_SLOT = '4,891';

const article = (text) => (/^(8|11|18)/.test(text) ? 'an' : 'a');

const TEMPLATES = [
  () => {
    const waiting = maybeMeasure('waiver-waitlist-unduplicated');
    const added = maybeMeasure('waiver-slots-added-2026-28');
    const notStarted = maybeMeasure('hcbs-allocated-not-started');
    const days = maybeMeasure('waiver-avg-days-waiting');
    const scl = row(days, 'SCL');
    if (!has(waiting?.value, added?.value, notStarted?.value)) return null;
    return {
      id: 'waiver-waitlist',
      questions: ['care', 'money', 'responsible'],
      headline: `${count(waiting.value)} Kentuckians are waiting for a waiver slot and the 2026–2028 budget adds ${count(added.value)}; ${count(notStarted.value)} slots already offered have not started services. How long will someone added to the list today wait?`,
      lede: `${has(scl) ? `Supports for Community Living averaged ${(scl / 365).toFixed(1)} years on the list in July 2026, counting people already offered a slot. ` : ''}${WAITLIST_HOLDING_OTHER_SLOT} people on the list (26%) already hold a slot in another waiver.`,
      affected: 'People with intellectual or developmental disabilities, older adults and people with physical disabilities',
      responsible: 'Department for Medicaid Services, Division of Community Alternatives',
      nextAction: 'Ask the Department for the waitlist by county and the time from a slot offer to the first service',
      status: 'Open question',
      asOf: waiting.period,
      view: 'simple-waivers',
      anchor: 'waitlist',
    };
  },
  () => {
    const pa = maybeMeasure('pa-standard-denied-pct');
    const vals = (pa?.rows || []).map((r) => r.value).filter(Number.isFinite);
    if (vals.length < 2) return null;
    return {
      id: 'prior-authorization',
      questions: ['care', 'money', 'responsible'],
      headline: `Kentucky’s managed care plans denied between ${pct(Math.min(...vals))} and ${pct(Math.max(...vals))} of routine prior-authorization requests in 2025, depending on the plan. Do the differences reflect different rules, different services or different patients?`,
      lede: 'Each plan posts these figures under the federal prior-authorization rule, and plans count requests differently, so the range is a starting point for questions rather than a ranking.',
      affected: 'Members whose treatment needs plan approval, and the providers who request it',
      responsible: 'The five managed care plans; Department for Medicaid Services oversight',
      nextAction: 'Ask each plan for its most-denied services and how many denials are reversed on appeal',
      status: 'Open question',
      asOf: pa.period,
      view: 'simple-plans',
      anchor: 'prior-auth',
    };
  },
  () => {
    const appt = maybeMeasure('bh-appt-routine-within-30-days');
    if (!has(appt?.value, appt?.target?.value)) return null;
    const standard = pct(appt.target.value);
    return {
      id: 'bh-appointments',
      questions: ['care', 'responsible'],
      headline: `When the state’s secret shoppers reached behavioral health centers at their listed location, ${pct(appt.value)} offered a routine appointment within 30 days, against ${article(standard)} ${standard} contract standard. What keeps the rest from meeting it?`,
      lede: 'Many centers in the sample could not be reached at the location the plan directories listed, so the share of directory listings that lead to a timely appointment is lower still.',
      affected: 'Members seeking mental health or addiction care',
      responsible: 'The managed care plans; Department for Medicaid Services network oversight',
      nextAction: 'Ask the Department how plans will correct directory listings and appointment availability',
      status: 'Open question',
      asOf: appt.period,
      view: 'simple-access',
      anchor: 'appointments',
    };
  },
  () => {
    const pmpm = maybeMeasure('benefit-spending-pmpm');
    const dec = maybeMeasure('spending-growth-decomposition');
    const pmpmPct = row(dec, 'pmpm-pct');
    const enrPct = row(dec, 'enrollment-pct');
    if (!has(pmpm?.value, pmpmPct, enrPct)) return null;
    return {
      id: 'cost-per-member',
      questions: ['money', 'health'],
      headline: `Spending per member rose ${pct(pmpmPct)} in federal fiscal year 2024 to ${formatNumber(pmpm.value, 'usd')} a month while enrollment fell ${pct(Math.abs(enrPct))}. How much reflects higher payment rates, and how much a sicker remaining membership?`,
      lede: 'Total spending still rose, because the higher cost per member outweighed the smaller enrollment.',
      affected: 'All members; the state General Fund',
      responsible: 'Department for Medicaid Services, Office of Finance',
      nextAction: 'Ask the Department to split the per-member increase into rate changes, service use and member mix',
      status: 'Open question',
      asOf: pmpm.period,
      view: 'simple-spending',
      anchor: 'drivers',
    };
  },
  () => {
    const fua = maybeMeasure('cs-fua-adult-7day');
    const byPlan = maybeMeasure('mco-fua-7day');
    const planVals = (byPlan?.rows || []).map((r) => r.value).filter(Number.isFinite);
    if (!has(fua?.value, fua?.comparison?.value) || planVals.length < 2) return null;
    return {
      id: 'ed-follow-up',
      questions: ['health', 'responsible'],
      headline: `${pct(fua.value)} of adults seen in an emergency room for substance use had a follow-up visit within 7 days in federal fiscal year 2025, against a ${pct(fua.comparison.value)} median among states; plan rates for ${byPlan.period} ranged from ${pct(Math.min(...planVals))} to ${pct(Math.max(...planVals))}. What would raise the statewide rate?`,
      lede: 'Follow-up after an emergency department visit is one of the six measure areas KRS 7A.287 requires for the managed care plans.',
      affected: 'Adults treated in emergency rooms for substance use',
      responsible: 'The managed care plans',
      nextAction: 'Ask the plans with the lowest follow-up rates how they contact members after an emergency visit',
      status: 'Open question',
      asOf: fua.period,
      view: 'simple-outcomes',
      anchor: 'krs-a',
    };
  },
  () => {
    const meds = maybeMeasure('nf-antianxiety');
    const hosp = maybeMeasure('nf-hosp-per-1000');
    if (!has(meds?.value, meds?.comparison?.value)) return null;
    return {
      id: 'nf-sedatives',
      questions: ['health', 'responsible'],
      headline: `${pct(meds.value)} of long-stay Kentucky nursing home residents receive anti-anxiety or sleep medicine, against ${pct(meds.comparison.value)} nationally${has(hosp?.value, hosp?.comparison?.value) && hosp.value > hosp.comparison.value ? ', and residents are sent to the hospital slightly more often than the national average' : ''}. Which homes account for the difference?`,
      lede: 'Nursing home care is paid by Medicaid outside managed care, so the state contracts with these homes directly.',
      affected: 'Nursing home residents, most of whom Medicaid pays for',
      responsible: 'Nursing homes; Cabinet for Health and Family Services, Office of Inspector General',
      nextAction: 'Ask the Office of Inspector General which homes have the highest rates and what their inspections found',
      status: 'Open question',
      asOf: meds.period,
      view: 'simple-ltc',
      anchor: 'nf-outcomes',
    };
  },
];

export const SIMPLE_BRIEFINGS = TEMPLATES
  .map((build, order) => ({ order, briefing: build() }))
  .filter((x) => x.briefing)
  .sort((a, b) => b.briefing.questions.length - a.briefing.questions.length || a.order - b.order)
  .map((x) => x.briefing);
