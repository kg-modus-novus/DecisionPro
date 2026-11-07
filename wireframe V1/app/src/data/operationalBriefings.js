/**
 * Operational briefings — the ranked cross-source inferences shown above the
 * goal tiles on each state's Operational Intelligence page.
 *
 * Hand-written aggregation over gate-reconciled BW exports (like
 * operationalGoals.js): it joins already-exported facts, computes no new
 * source figures, and every headline is a governed template. Rules:
 *  - A headline states the joined fact and the open question, never a verdict
 *    (see BRIEFING_HEADLINE_RULE / PROHIBITED_HEADLINE_TERMS, enforced by test).
 *  - kind = 'observed' when every figure is a published fact joined by an
 *    exact key; 'inferred' when a threshold or heuristic selects the rows;
 *    'gap' when the join cannot run because a source slice is not loaded.
 *  - Each briefing names its sources, validation question, and accountable
 *    owner, and points at the goal page or pre-filtered Evidence Room that
 *    carries the underlying record.
 *  - Ranking is decision value (goals touched), then observed before
 *    inferred, then nearest deadline; never novelty.
 */
import { MCPAR_PLAN_PERIOD } from './alp/mcparPlanPeriod.js';
import { FEDERAL_AWARD_GRAIN } from './alp/federalAwardGrain.js';
import { FACILITY_FINANCIAL_DISTRESS } from './alp/facilityFinancialDistress.js';
import { NONPROFIT_FINANCIALS } from './alp/nonprofitFinancials.js';
import { SUBAWARD_FLOW_GRAPH } from './alp/subawardFlowGraph.js';
import { OWNERSHIP_NETWORK } from './alp/ownershipNetwork.js';
import { COUNTY_ACCESS_CONTEXT } from './alp/countyAccessContext.js';
import { FL_OPERATIONAL_SOURCES } from './alp/flOperationalSources.js';
import { KY_OPERATIONAL_SOURCES } from './alp/kyOperationalSources.js';

/**
 * Copy rule for headlines and ledes: they describe what the public evidence
 * shows and why it matters to a decision-maker — the relationship, the
 * exposure, and the question it raises. They never describe DecisionPro
 * itself (what the product added, exports, joins, or should add); that
 * belongs in the plan documents, not on the page.
 */
export const BRIEFING_HEADLINE_RULE = 'Each headline states a joined public fact and the question it raises. None states a verdict, and no plan is ranked on a measure whose reporting definition is unconfirmed.';

export const PRODUCT_COMMENTARY_TERMS = ['decisionpro', 'the goal page', 'the product', 'now carries', 'now join', 'export', 'the room', 'dashboard', 'we built', 'this release'];

/**
 * A headline is read by a legislator or program director, so it uses the
 * language of programs, dollars, facilities, and people — never the language
 * of the data model. Enforced by test on headlines (ledes may name a method).
 */
export const HEADLINE_JARGON_TERMS = ['edge', 'node', 'grain', 'cube', 'join', 'schema', 'identity-resolved', 'exact-derived', 'crosswalk', 'puf', 'rollup', 'record', 'listing'];

export const PROHIBITED_HEADLINE_TERMS = ['waste', 'fraud', 'breach', 'distress', 'improper', 'misconduct', 'violation', 'savings', 'abuse', 'negligen'];

export const BRIEFING_SOURCE_LABELS = {
  CMS_MCPAR: 'CMS MCPAR 2024',
  CMS_HCRIS: 'CMS HCRIS cost reports',
  CMS_PROVIDER_DATA: 'CMS Care Compare',
  USA_SPENDING: 'USAspending',
  GRANTS_GOV: 'Grants.gov',
  IRS_990_EXTRACT: 'IRS Form 990 extract',
  IRS_EO_BMF: 'IRS EO BMF',
  SAM_ENTITY: 'identity crosswalk',
  NPPES: 'NPPES',
  FL_AHCA_COMPLIANCE: 'AHCA compliance dashboard',
  KY_DMS_CONTRACTS: 'KY DMS MCO contracts',
  KY_DMS_COUNTY_COUNTS: 'KY DMS county membership',
  FL_ELIGIBILITY_REPORTS: 'AHCA eligibility report',
  HRSA_AHRF: 'HRSA AHRF (HPSA)',
};

const GOALS = {
  KY: { accountability: 'contract-accountability', integrity: 'program-integrity', access: 'improve-coverage', quality: 'identify-gaps', spending: 'optimize-spending', trend: 'trend-planning' },
  FL: { accountability: 'strengthen-accountability', integrity: 'provider-integrity', access: 'improve-access', quality: 'provider-integrity', spending: 'optimize-spending', trend: 'trend-planning' },
};

const OWNERS = {
  KY: {
    accountability: 'DMS program integrity lead, with contract management and the responsible reporting entity',
    dataGovernance: 'DMS data stewardship lead, with MCO oversight',
    access: 'DMS program operations lead, with facility oversight and network adequacy',
    quality: 'DMS quality and facility oversight, with program integrity',
    grants: 'DMS federal grants management, with program and budget owners',
    spending: 'DMS program operations, with grants management',
    resilience: 'DMS contract management, with the program owner for the affected service',
  },
  FL: {
    accountability: 'AHCA plan oversight and program integrity, with the responsible plan',
    dataGovernance: 'AHCA data stewardship, with plan oversight',
    access: 'Florida Medicaid network oversight, with facility regulation',
    quality: 'AHCA facility regulation and Medicaid provider oversight',
    grants: 'AHCA and partner-agency grants management, with budget owners',
    spending: 'Florida Medicaid program operations, with grants management',
    resilience: 'AHCA contract management, with the program owner for the affected service',
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));
const wholeMoney = (value) => `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const pct = (share, digits = 0) => `${(Number(share) * 100).toFixed(digits)}%`;
const count = (value) => Number(value || 0).toLocaleString('en-US');
const stateName = (state) => (state === 'FL' ? 'Florida' : 'Kentucky');

export function shortProgramName(program = '') {
  const match = program.match(/\(([A-Z]{2,5})\)\s*$/);
  if (match) return match[1];
  if (/dental/i.test(program)) return 'Dental';
  if (/managed care organization contract/i.test(program)) return 'MCO contract';
  return program.replace(/^Statewide Medicaid Managed Care\s*-\s*/i, '').trim();
}

/** The program with the most reporting plans (ties broken by enrollment). */
export function primaryProgram(stateSlice) {
  const programs = stateSlice?.programs || [];
  return [...programs].sort((a, b) => (b.plans.length - a.plans.length) || ((b.totals?.enrollment || 0) - (a.totals?.enrollment || 0)))[0] || null;
}

function daysUntil(dateString, now) {
  if (!dateString) return null;
  const ms = new Date(`${dateString}T00:00:00Z`).getTime() - now.getTime();
  return Number.isNaN(ms) ? null : Math.ceil(ms / DAY_MS);
}

function withinNextYear(dateString, now) {
  const days = daysUntil(dateString, now);
  return days != null && days >= 0 && days <= 365;
}

/** Normalize an ISO timestamp or a publisher M/D/YYYY date to YYYY-MM-DD. */
function toIsoDate(value) {
  const text = String(value || '').trim();
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

function latestAsOf(...values) {
  return values.map(toIsoDate).filter(Boolean).sort().pop() || 'See source record';
}

function briefing(base) {
  return {
    status: 'Detected',
    kind: 'observed',
    figures: [],
    roomLink: null,
    record: null,
    guardrail: 'A review prompt for human validation — never itself a finding, prediction, or determination.',
    ...base,
    goalsTouched: base.goalsTouched || [base.goalId],
  };
}

// ---------------------------------------------------------------------------
// MCPAR plan-period briefings (Contract Accountability / Strengthen Plan Accountability)
// ---------------------------------------------------------------------------

function planConcentration(state, slice, asOf) {
  const program = primaryProgram(slice);
  if (!program || program.plans.length < 2) return null;
  const top = program.totals.overpaymentShares?.[0];
  if (!top || top.overpaymentShare == null || top.enrollmentShare == null) return null;
  if (top.overpaymentShare < 0.4 || top.overpaymentShare < top.enrollmentShare * 2) return null;
  const plan = program.plans.find((p) => p.plan === top.plan);
  const others = program.plans.length - 1;
  const basisWithheld = plan?.dataQualityFlags?.some((flag) => flag.id.startsWith('PREMIUM'));
  return briefing({
    id: `${state}-mcpar-overpayment-concentration`,
    state,
    kind: 'observed',
    headline: `${top.plan} reports ${pct(top.overpaymentShare)} of the overpayments ${stateName(state)}'s ${shortProgramName(program.program)} plans identified while serving ${pct(top.enrollmentShare)} of members. Is it counting the same way as the other ${others}?`,
    lede: `One reporting entity carries most of the program's reported overpayment dollars while serving a small share of its members${plan?.measures?.encounterTimelyPercent != null && plan.measures.encounterTimelyPercent < 90 ? `, and it also reports the program's lowest encounter-data timeliness (${plan.measures.encounterTimelyPercent}%)` : ''}. Before that figure drives a recovery or contract question, the reporting basis has to be confirmed with this plan and the others.`,
    figures: [
      { label: 'Overpayments reported', value: wholeMoney(top.overpaymentsReported) },
      { label: 'Share of program total', value: pct(top.overpaymentShare, 1) },
      { label: 'Share of enrollment', value: pct(top.enrollmentShare, 1) },
      { label: 'Encounter timeliness', value: plan?.measures?.encounterTimelyPercent == null ? '—' : `${plan.measures.encounterTimelyPercent}%` },
      { label: 'bp of premium', value: basisWithheld ? 'withheld · basis unverified' : plan?.derived?.overpaymentBasisPoints == null ? '—' : `${plan.derived.overpaymentBasisPoints}` },
    ],
    question: `Is ${top.plan}'s overpayment figure reported on the same basis (identified versus recovered, in-year versus cumulative) as the other ${others} ${shortProgramName(program.program)} plans?`,
    owner: OWNERS[state].accountability,
    sourceSystems: ['CMS_MCPAR'],
    goalId: GOALS[state].accountability,
    goalsTouched: [GOALS[state].accountability, GOALS[state].integrity],
    record: { kind: 'mcpar-plan-period', program: program.program },
    guardrail: 'A state-reported annual response. Concentration in one plan is a definition check with a named reporting entity, not evidence of any conduct.',
    asOf,
  });
}

function comparability(state, slice, asOf) {
  const program = primaryProgram(slice);
  if (!program) return null;
  const entries = Object.entries(program.comparability || {}).filter(([, entry]) => entry.dispersion != null);
  if (!entries.length) return null;
  const nonComparable = entries.filter(([, entry]) => !entry.comparable);
  if (!nonComparable.length) return null;
  const appeals = program.comparability.appealsPer1k;
  const lead = appeals?.dispersion != null && !appeals.comparable ? ['appealsPer1k', appeals] : nonComparable.sort((a, b) => b[1].dispersion - a[1].dispersion)[0];
  const labels = { appealsPer1k: 'Appeal rates', overpaymentBasisPoints: 'Overpayment-to-premium ratios', appealDenialShare: 'Appeal denial shares', grievancesPer1k: 'Grievance rates', piInvestigationsPer100k: 'Program-integrity investigation rates' };
  return briefing({
    id: `${state}-mcpar-comparability`,
    state,
    kind: 'observed',
    headline: `${stateName(state)}'s ${program.plans.length} ${shortProgramName(program.program)} plans report ${(labels[lead[0]] || lead[0]).toLowerCase()} that differ ${lead[1].dispersion}×; the spread reflects counting rules, not performance, until each plan's definition is confirmed.`,
    lede: `${nonComparable.length} of ${entries.length} plan-level ratios vary more than ${MCPAR_PLAN_PERIOD.comparabilityRule.dispersionLimit}× between plans in the same program. Spreads that wide reflect how each plan counts (for example whether pharmacy prior-authorization appeals are included), so a plan ranking on these measures would misstate performance and any oversight response built on it would land on the wrong plan.`,
    figures: nonComparable.map(([key, entry]) => ({ label: labels[key] || key, value: `${entry.dispersion}× · ${entry.validPlans} plans` })),
    question: `Which plans count pharmacy prior-authorization appeals, and which report only member-filed appeals? Confirm the question definition with each reporting entity before any plan comparison.`,
    owner: OWNERS[state].dataGovernance,
    sourceSystems: ['CMS_MCPAR'],
    goalId: GOALS[state].accountability,
    record: { kind: 'mcpar-plan-period', program: program.program },
    guardrail: 'Dispersion measures reporting heterogeneity, not plan quality. No league table is produced from a non-comparable measure.',
    asOf,
  });
}

function topTopics(records) {
  const counts = new Map();
  for (const record of records) {
    const topic = String(record.interventionTopic || 'Not reported').replace(/,.*$/, '');
    counts.set(topic, (counts.get(topic) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([topic, n]) => `${topic} (${n})`);
  return top.join(' and ') || 'Unreported topics';
}

function sanctionsBriefing(state, slice, asOf) {
  const programs = (slice?.programs || []).filter((program) => program.sanctions?.records?.length);
  if (!programs.length) return null;
  const records = programs.flatMap((program) => program.sanctions.records);
  const notRemediated = records.filter((record) => /^no/i.test(String(record.remediationCompleted || ''))).length;
  const inProgress = records.filter((record) => /in progress/i.test(String(record.remediationCompleted || ''))).length;
  const monetary = records.filter((record) => /penalt|liquidated/i.test(String(record.interventionType || ''))).length;
  const dollars = records.reduce((sum, record) => sum + Number(record.dollarAmountValue || 0), 0);
  const clauseCited = records.filter((record) => /\b\d{1,2}\.\d{1,2}\b|appendix/i.test(String(record.interventionReason || ''))).length;
  const resolved = records.filter((record) => Array.isArray(record.citedSections) && record.citedSections.length).length;
  const lead = programs.sort((a, b) => b.sanctions.records.length - a.sanctions.records.length)[0];
  return briefing({
    id: `${state}-mcpar-sanctions`,
    state,
    kind: 'observed',
    headline: `${stateName(state)} reported ${count(records.length)} sanctions and compliance actions against its Medicaid plans; ${count(notRemediated + inProgress)} were still open at the report${clauseCited ? `, and ${count(clauseCited)} cite a specific contract section` : ''}. Which open ones carry a liquidated-damages clause?`,
    lede: `${topTopics(records)} dominate the reasons; only ${wholeMoney(dollars)} in dollar amounts is reported across ${count(records.length)} records, and ${count(notRemediated + inProgress)} remain open. The open records and the sections the state itself cited${resolved ? ` (${count(resolved)} of them located to a page in the plan's contract)` : ''} are where contract follow-up is due.`,
    figures: [
      { label: 'Records', value: count(records.length) },
      { label: 'Monetary penalties or liquidated damages', value: count(monetary) },
      { label: 'Dollar amounts reported', value: wholeMoney(dollars) },
      { label: 'Not remediated / in progress', value: `${count(notRemediated)} / ${count(inProgress)}` },
      ...(resolved ? [{ label: 'Citations resolved to a contract page', value: `${count(resolved)} of ${count(clauseCited)}` }] : []),
    ],
    question: `For each record still open at the report date, what is the current remediation status in the contract file, and does the cited clause carry a liquidated-damages schedule?`,
    owner: OWNERS[state].accountability,
    sourceSystems: state === 'KY' ? ['CMS_MCPAR', 'KY_DMS_CONTRACTS'] : ['CMS_MCPAR'],
    goalId: GOALS[state].accountability,
    goalsTouched: [GOALS[state].accountability, GOALS[state].integrity],
    record: { kind: 'sanctions', program: lead.program },
    guardrail: 'A published state intervention record, shown as reported. Applicability of any clause is the reviewer\'s determination.',
    asOf,
  });
}

function publisherDivergence(state, slice, asOf) {
  if (state !== 'FL') return null;
  const records = (slice?.programs || []).flatMap((program) => program.sanctions?.records || []);
  const dollars = records.reduce((sum, record) => sum + Number(record.dollarAmountValue || 0), 0);
  const metrics = new Map((FL_OPERATIONAL_SOURCES.metrics || []).map((metric) => [metric.metricId, metric]));
  const assessed = metrics.get('fl-compliance-assessed');
  const categories = metrics.get('fl-compliance-categories');
  if (!assessed) return null;
  return briefing({
    id: 'FL-publisher-divergence-compliance',
    state,
    kind: 'observed',
    headline: `Florida's federal managed-care report lists ${count(records.length)} plan sanctions (${wholeMoney(dollars)}) while AHCA's own compliance reporting shows ${assessed.displayValue} assessed across ${categories?.displayValue || 'its'} action categories; the two cover different enforcement universes.`,
    lede: 'CMS\'s annual managed-care report and AHCA\'s own compliance reporting cover different enforcement universes: plan contract sanctions on one side, facility and provider compliance actions on the other. An oversight review that cites one without the other will understate or overstate enforcement activity.',
    figures: [
      { label: 'MCPAR sanction records', value: count(records.length) },
      { label: 'MCPAR dollar amounts', value: wholeMoney(dollars) },
      { label: 'AHCA assessed (permitted export)', value: assessed.displayValue },
      { label: 'AHCA action categories', value: categories?.displayValue || '—' },
    ],
    question: 'Which enforcement universe does each figure cover (plan contract sanctions versus facility and provider compliance actions), and which one should the accountability record cite for plan-period review?',
    owner: OWNERS.FL.dataGovernance,
    sourceSystems: ['CMS_MCPAR', 'FL_AHCA_COMPLIANCE'],
    goalId: GOALS.FL.accountability,
    guardrail: 'A reporting-scope reconciliation prompt. A difference between publishers is not evidence that either report is wrong.',
    asOf: latestAsOf(asOf, assessed.asOfDate),
  });
}

// ---------------------------------------------------------------------------
// Funding & resilience briefings (award grain, HCRIS, 990, sub-awards)
// ---------------------------------------------------------------------------

function runwayComposition(state, now) {
  const grain = FEDERAL_AWARD_GRAIN.byState[state];
  const expiring = (grain?.awards || []).filter((award) => withinNextYear(award.periodEnd, now));
  if (!expiring.length) return null;
  const total = expiring.reduce((sum, award) => sum + Number(award.awardAmount || 0), 0);
  const titleXix = expiring.filter((award) => award.awardClass?.id === 'title-xix-state-grant');
  const titleXixAmount = titleXix.reduce((sum, award) => sum + Number(award.awardAmount || 0), 0);
  const recipientAwards = expiring.filter((award) => award.awardClass?.id !== 'title-xix-state-grant');
  const recipientAmount = recipientAwards.reduce((sum, award) => sum + Number(award.awardAmount || 0), 0);
  if (!titleXix.length) return null;
  const withHistory = titleXix.filter((award) => award.renewalHistory?.priorAwardCount > 0).length;
  return briefing({
    id: `${state}-runway-composition`,
    state,
    kind: 'observed',
    headline: `The routine Title XIX grant is ${pct(titleXixAmount / total)} of ${stateName(state)}'s federal award dollars expiring within a year; the ${count(recipientAwards.length)} awards worth ${money(recipientAmount)} to service providers are where an expiration would reach people.`,
    lede: `The Title XIX grant recurs every federal fiscal year (${count(withHistory)} of ${count(titleXix.length)} have prior periods published) and is not the exposure. The recipient awards, mostly health-center and block-grant funding to organizations that deliver services, are where an unresolved expiration would reach members.`,
    figures: [
      { label: 'Awards ending within 12 months', value: `${count(expiring.length)} · ${money(total)}` },
      { label: 'Title XIX state grant', value: `${count(titleXix.length)} · ${money(titleXixAmount)}` },
      { label: 'With published prior periods', value: `${count(withHistory)} of ${count(titleXix.length)}` },
      { label: 'Recipient awards to review', value: `${count(recipientAwards.length)} · ${money(recipientAmount)}` },
    ],
    question: `For the ${count(recipientAwards.length)} recipient awards, which have a confirmed renewal, extension, or successor in the grant file, and which have none?`,
    owner: OWNERS[state].grants,
    sourceSystems: ['USA_SPENDING'],
    goalId: GOALS[state].trend,
    goalsTouched: [GOALS[state].trend, GOALS[state].accountability],
    roomLink: { roomId: 'funding-resilience', types: ['award-cliff'], label: 'Open the funding runway in Funding & Resilience →' },
    record: {
      kind: 'table',
      caption: 'Recipient awards ending within 12 months, largest first. History only — not a renewal prediction.',
      columns: [
        { key: 'recipient', label: 'Recipient', align: 'left' },
        { key: 'listing', label: 'Listing', align: 'left' },
        { key: 'amount', label: 'Award $' },
        { key: 'ends', label: 'Ends', align: 'left' },
        { key: 'prior', label: 'Prior periods published' },
        { key: 'successors', label: 'Published successor opportunities' },
        { key: 'continuation', label: 'Continuation status', align: 'left' },
      ],
      rows: recipientAwards
        .sort((a, b) => Number(b.awardAmount || 0) - Number(a.awardAmount || 0))
        .slice(0, 25)
        .map((award) => ({
          key: award.awardKey,
          recipient: award.organizationIdentity?.displayName || award.recipientName,
          listing: award.assistanceListing,
          amount: wholeMoney(award.awardAmount),
          ends: award.periodEnd,
          prior: award.renewalHistory?.priorAwardCount ?? 0,
          successors: award.successorOpportunities?.count ?? 0,
          continuation: String(award.continuationAssessment?.status || 'not_assessed').replaceAll('_', ' '),
        })),
    },
    guardrail: 'A listed expiration is a renewal-review prompt, not a predicted funding lapse; award class is a published listing attribute, not a judgment about the recipient.',
    asOf: latestAsOf(grain?.metrics?.['ofr-award-count']?.asOfDate, FEDERAL_AWARD_GRAIN.generatedAt),
    urgencyDays: Math.min(...recipientAwards.map((award) => daysUntil(award.periodEnd, now) ?? 365)),
  });
}

function successorOpportunities(state, now) {
  const grain = FEDERAL_AWARD_GRAIN.byState[state];
  const expiring = (grain?.awards || []).filter((award) => withinNextYear(award.periodEnd, now) && award.awardClass?.id !== 'title-xix-state-grant');
  const matched = expiring.filter((award) => award.successorOpportunities?.count > 0);
  if (!matched.length) return null;
  const opportunities = new Map();
  for (const award of matched) for (const item of award.successorOpportunities.items || []) opportunities.set(item.opportunity, item);
  const listings = [...new Set(matched.map((award) => award.assistanceListing))].sort();
  const unconfirmed = matched.filter((award) => !['confirmed_continued', 'extension_pending', 'temporary_extension'].includes(award.continuationAssessment?.status)).length;
  return briefing({
    id: `${state}-successor-opportunities`,
    state,
    kind: 'inferred',
    headline: `${count(matched.length)} ${stateName(state)} health-center awards expire within a year; ${count(opportunities.size)} federal successor opportunities are open for the same program, and renewal is unconfirmed for ${count(unconfirmed)} of the ${count(matched.length)}.`,
    lede: 'Federal successor funding is already posted for the listing these awards sit under. Whether each recipient applied, and whether the awarding agency shows a continuation or non-competing renewal, is the open question; an opportunity is national in scope and does not establish eligibility or renewal.',
    figures: [
      { label: 'Expiring recipient awards with a match', value: count(matched.length) },
      { label: 'Distinct published opportunities', value: count(opportunities.size) },
      { label: 'Continuation unconfirmed', value: count(unconfirmed) },
      { label: 'Next close date', value: [...opportunities.values()].filter((item) => item.eventDateKind === 'close_date').map((item) => item.eventDate).sort()[0] || 'no close date published' },
    ],
    question: 'Has each recipient applied to the matching opportunity, and does the awarding agency show a continuation or non-competing renewal in the grant file?',
    owner: OWNERS[state].grants,
    sourceSystems: ['USA_SPENDING', 'GRANTS_GOV'],
    goalId: GOALS[state].trend,
    roomLink: { roomId: 'funding-resilience', types: ['award-cliff', 'horizon-nofo'], label: 'Open awards and opportunities in Funding & Resilience →' },
    record: {
      kind: 'table',
      caption: 'Published Grants.gov opportunities under the matching listings (national scope; eligibility not verified).',
      columns: [
        { key: 'opportunity', label: 'Opportunity', align: 'left' },
        { key: 'date', label: 'Date', align: 'left' },
        { key: 'kind', label: 'Date kind', align: 'left' },
        { key: 'status', label: 'Status', align: 'left' },
      ],
      rows: [...opportunities.values()].map((item) => ({ key: item.opportunity, opportunity: item.opportunity, date: item.eventDate, kind: String(item.eventDateKind || '').replaceAll('_', ' '), status: item.status })),
    },
    guardrail: 'A published opportunity is not a continuation award and does not establish recipient eligibility.',
    asOf: latestAsOf(FEDERAL_AWARD_GRAIN.generatedAt),
    urgencyDays: Math.min(...matched.map((award) => daysUntil(award.periodEnd, now) ?? 365)),
  });
}

function cliffCascade(state, now) {
  const graph = SUBAWARD_FLOW_GRAPH.byState[state];
  const edges = (graph?.fundingEdges?.edges || []).filter((edge) => withinNextYear(edge.primeAwardEnd, now));
  if (!edges.length) return null;
  const amount = edges.reduce((sum, edge) => sum + Number(edge.amount || 0), 0);
  const recipients = new Set(edges.map((edge) => edge.recipientEin || edge.recipientOrg.toUpperCase()));
  const primes = new Set(edges.map((edge) => edge.primeAwardKey));
  const resolved = edges.filter((edge) => edge.identityConfidence === 'exact-derived').length;
  return briefing({
    id: `${state}-cliff-cascade`,
    state,
    kind: 'observed',
    headline: `${count(recipients.size)} organizations funded through ${count(primes.size)} federal awards that end within a year stand to lose ${money(amount)} in pass-through funding unless those awards are renewed or replaced.`,
    lede: 'When a prime award ends, the organizations funded beneath it lose pass-through dollars unless the prime is renewed or replaced. These sub-recipients are the second-order exposure of the prime\'s expiration; identity is confirmed on some edges and unresolved on others.',
    figures: [
      { label: 'Pass-through awards under expiring primes', value: count(edges.length) },
      { label: 'Dollars at stake', value: money(amount) },
      { label: 'Organizations funded beneath them', value: count(recipients.size) },
      { label: 'Recipient identity confirmed', value: `${count(resolved)} of ${count(edges.length)}` },
    ],
    question: 'Which of these sub-recipients depend on the expiring prime for a service or capacity the state counts on, and has the prime recipient confirmed pass-through continuity?',
    owner: OWNERS[state].spending,
    sourceSystems: ['USA_SPENDING', 'SAM_ENTITY'],
    goalId: GOALS[state].spending,
    goalsTouched: [GOALS[state].spending, GOALS[state].trend],
    roomLink: { roomId: 'funding-resilience', types: ['subaward-edge'], label: 'Open the sub-award graph in Funding & Resilience →' },
    guardrail: 'A funding-flow map, never itself evidence of duplication or improper coordination; a prime award end date is not a predicted lapse.',
    asOf: latestAsOf(SUBAWARD_FLOW_GRAPH.generatedAt),
    urgencyDays: Math.min(...edges.map((edge) => daysUntil(edge.primeAwardEnd, now) ?? 365)),
  });
}

function programOverlap(state) {
  const graph = SUBAWARD_FLOW_GRAPH.byState[state];
  const recipients = graph?.programOverlap?.recipients || [];
  if (!recipients.length) return null;
  const amount = recipients.reduce((sum, recipient) => sum + Number(recipient.amount || 0), 0);
  return briefing({
    id: `${state}-program-overlap`,
    state,
    kind: 'observed',
    headline: `${count(recipients.length)} ${stateName(state)} organizations draw ${money(amount)} under more than one federal program; whether that funds two services or one service twice is unverified.`,
    lede: 'Organizations funded under both block-grant and Medicaid streams may serve distinct populations or fund the same objective twice. The named list, with listings and dollars, is where a scope reconciliation starts; receiving funds under two programs is not itself duplication.',
    figures: [
      { label: 'Multi-program sub-recipients', value: count(recipients.length) },
      { label: 'Dollars across their edges', value: money(amount) },
      { label: 'Most listings for one recipient', value: count(Math.max(...recipients.map((recipient) => recipient.listings.length))) },
    ],
    question: 'For each recipient, do the programs fund distinct populations or services, or the same objective under two streams?',
    owner: OWNERS[state].spending,
    sourceSystems: ['USA_SPENDING', 'SAM_ENTITY'],
    goalId: GOALS[state].spending,
    roomLink: { roomId: 'funding-resilience', types: ['subaward-edge'], label: 'Open the sub-award graph in Funding & Resilience →' },
    record: {
      kind: 'table',
      caption: 'Identity-resolved sub-recipients with funding under more than one tracked assistance listing.',
      columns: [
        { key: 'recipient', label: 'Sub-recipient', align: 'left' },
        { key: 'listings', label: 'Listings', align: 'left' },
        { key: 'edges', label: 'Edges' },
        { key: 'amount', label: 'Amount $' },
      ],
      rows: recipients.map((recipient) => ({ key: recipient.recipientEin, recipient: recipient.recipientOrg, listings: recipient.listings.join(', '), edges: recipient.edgeCount, amount: wholeMoney(recipient.amount) })),
    },
    guardrail: 'Receiving funds under two programs is a scope question, never itself evidence of duplication.',
    asOf: latestAsOf(SUBAWARD_FLOW_GRAPH.generatedAt),
  });
}

// Same normalization as the warehouse (BuildCountyAccessContext.countyKey),
// including the publisher spelling variants it reconciles.
const COUNTY_ALIASES = { DADE: 'MIAMIDADE', HILLSBOURGH: 'HILLSBOROUGH' };
const countyKey = (name) => {
  const key = String(name || '').toUpperCase().replace(/\bCOUNTY\b/g, '').replace(/[^A-Z]/g, '');
  return COUNTY_ALIASES[key] || key;
};

function countyAccess(state) {
  const facility = FACILITY_FINANCIAL_DISTRESS.byState[state];
  const counties = facility?.countyRollups?.counties || [];
  const allNegative = counties.filter((county) => county.allFacilitiesNegativeMargin);
  if (!allNegative.length) return null;
  const context = new Map((COUNTY_ACCESS_CONTEXT.byState?.[state]?.counties || []).map((row) => [row.countyKey, row]));
  const membersLabel = COUNTY_ACCESS_CONTEXT.byState?.[state]?.membersLabel || 'Medicaid members';
  const enriched = allNegative.map((county) => ({ ...county, context: context.get(countyKey(county.county)) || null }));
  const single = enriched.filter((county) => county.singleFacilityCounty);
  const singleMembers = single.reduce((sum, county) => sum + Number(county.context?.medicaidMembers || 0), 0);
  const singleWithMembers = single.filter((county) => county.context?.medicaidMembers != null).length;
  const hpsaSingle = single.filter((county) => county.context?.hpsaPrimaryCareCode && county.context.hpsaPrimaryCareCode !== '0').length;
  const thinnest = [...enriched].filter((county) => county.context?.snfBedsPer1kMembers != null).sort((a, b) => a.context.snfBedsPer1kMembers - b.context.snfBedsPer1kMembers)[0];
  const highest = [...enriched].sort((a, b) => (b.avgMedicaidDayShare || 0) - (a.avgMedicaidDayShare || 0))[0];
  return briefing({
    id: `${state}-county-access`,
    state,
    kind: 'inferred',
    headline: `In ${count(allNegative.length)} ${stateName(state)} counties every hospital or nursing facility that files a cost report is losing money; ${count(single.length)} of those counties have just one facility${singleWithMembers ? `, together serving ${count(singleMembers)} ${state === 'FL' ? 'Medicaid eligibles' : 'Medicaid members'}` : ''}.`,
    lede: `Where a county's only nursing facility is operating at a loss on a high-Medicaid payer mix, an exit would leave that county's members without local capacity${hpsaSingle ? `; ${count(hpsaSingle)} of the single-facility counties already carry a primary-care shortage designation` : ''}. Members, shortage status, and certified beds per member size that exposure county by county.`,
    figures: [
      { label: 'Counties, all facilities negative', value: count(allNegative.length) },
      { label: 'Of which single-facility', value: count(single.length) },
      { label: `${state === 'FL' ? 'Eligibles' : 'Members'} in single-facility counties`, value: singleWithMembers ? count(singleMembers) : 'not loaded' },
      { label: 'Single-facility counties in a primary-care HPSA', value: singleWithMembers ? `${count(hpsaSingle)} of ${count(single.length)}` : 'not loaded' },
      { label: 'Fewest certified SNF beds per 1,000', value: thinnest ? `${thinnest.county} · ${thinnest.context.snfBedsPer1kMembers}` : highest ? `${highest.county} · ${pct(highest.avgMedicaidDayShare)} Medicaid days` : '—' },
    ],
    question: 'For each single-facility county, what is the nearest alternative capacity for its members, and has the facility\'s current participation and licensure status been confirmed?',
    owner: OWNERS[state].access,
    sourceSystems: ['CMS_HCRIS', 'CMS_PROVIDER_DATA', state === 'FL' ? 'FL_ELIGIBILITY_REPORTS' : 'KY_DMS_COUNTY_COUNTS', 'HRSA_AHRF'],
    goalId: GOALS[state].access,
    roomLink: { roomId: 'funding-resilience', types: ['facility-distress'], label: 'Open the facility list in Funding & Resilience →' },
    record: {
      kind: 'table',
      caption: `Counties where every cost-reporting facility had a negative total margin (Medicare cost-report basis), fewest certified beds per 1,000 ${membersLabel.toLowerCase()} first.`,
      columns: [
        { key: 'county', label: 'County', align: 'left' },
        { key: 'facilities', label: 'Cost-report facilities' },
        { key: 'members', label: state === 'FL' ? 'Eligibles' : 'Members' },
        { key: 'beds', label: 'Certified SNF beds' },
        { key: 'per1k', label: 'Beds / 1,000' },
        { key: 'share', label: 'Avg Medicaid day share' },
        { key: 'hpsa', label: 'Primary-care HPSA', align: 'left' },
        { key: 'single', label: 'Single facility', align: 'left' },
      ],
      rows: [...enriched]
        .sort((a, b) => (a.context?.snfBedsPer1kMembers ?? 1e9) - (b.context?.snfBedsPer1kMembers ?? 1e9) || (b.avgMedicaidDayShare || 0) - (a.avgMedicaidDayShare || 0))
        .map((county) => ({
          key: county.county, county: county.county, facilities: county.facilityCount,
          members: county.context?.medicaidMembers ?? '—', beds: county.context?.certifiedSnfBeds ?? '—', per1k: county.context?.snfBedsPer1kMembers ?? '—',
          share: county.avgMedicaidDayShare == null ? '—' : pct(county.avgMedicaidDayShare),
          hpsa: county.context?.hpsaPrimaryCareLabel ? county.context.hpsaPrimaryCareLabel.replace(' primary-care HPSA', '').replace('No primary-care HPSA designation', 'none') : '—',
          single: county.singleFacilityCounty ? 'yes' : 'no',
        })),
    },
    guardrail: 'Medicare cost-report basis; a negative year is not a closure prediction, and members are a point-in-time count, not people served. Rank for review order only.',
    asOf: latestAsOf(facility?.metrics?.['ofr-hcris-facility-count']?.asOfDate, FACILITY_FINANCIAL_DISTRESS.generatedAt, COUNTY_ACCESS_CONTEXT.generatedAt),
  });
}

function compoundFacility(state) {
  const facility = FACILITY_FINANCIAL_DISTRESS.byState[state];
  const compound = facility?.compoundReviewCandidates;
  if (!compound) return null;
  if (!compound.computable) {
    return briefing({
      id: `${state}-compound-facility-gap`,
      state,
      kind: 'gap',
      headline: `${stateName(state)} facilities running at a loss cannot yet be read against their CMS star ratings: no rating context is loaded for the state.`,
      lede: 'The negative-margin list stands on its own; the quality dimension is missing, so no facility here can be described as both loss-making and low-rated until the rating source is loaded.',
      figures: [{ label: 'Negative-margin facility-years', value: count(facility.negativeMarginWatchlist?.totalCount) }, { label: 'With rating context', value: '0' }],
      question: compound.gap?.unblock || 'Load the state nursing-home slice of CMS Provider Data.',
      owner: 'DecisionPro data operations',
      sourceSystems: ['CMS_HCRIS', 'CMS_PROVIDER_DATA'],
      goalId: GOALS[state].quality,
      guardrail: 'A missing source slice is reported as a gap; no rating is imputed.',
      asOf: latestAsOf(FACILITY_FINANCIAL_DISTRESS.generatedAt),
    });
  }
  const facilities = compound.facilities || [];
  if (!facilities.length) return null;
  const beds = facilities.reduce((sum, item) => sum + Number(item.certifiedBeds || 0), 0);
  const fines = facilities.reduce((sum, item) => sum + Number(item.totalFines || 0), 0);
  return briefing({
    id: `${state}-compound-facility`,
    state,
    kind: 'inferred',
    headline: `${count(facilities.length)} ${stateName(state)} nursing facilities with ${count(beds)} beds are losing money, rated 1–2 stars by CMS, and depend on Medicaid for most of their patient days.`,
    lede: 'A facility that is losing money, rated 1–2 stars, and dependent on Medicaid for most of its days carries a continuity risk and a quality concern at once. Beds and published fines size the exposure; survey and enforcement history tell whether each is already under review.',
    figures: [
      { label: 'Facilities', value: count(facilities.length) },
      { label: 'Certified beds', value: count(beds) },
      { label: 'Published fines', value: wholeMoney(fines) },
      { label: 'Watchlist with rating context', value: `${count(facility.negativeMarginWatchlist?.providerContextCount)} of ${count(facility.negativeMarginWatchlist?.totalCount)}` },
    ],
    question: 'Which of these facilities already sit in a survey, enforcement, or continuity review, and which are new to every queue?',
    owner: OWNERS[state].quality,
    sourceSystems: ['CMS_HCRIS', 'CMS_PROVIDER_DATA'],
    goalId: GOALS[state].quality,
    goalsTouched: [GOALS[state].quality, GOALS[state].access],
    roomLink: { roomId: 'funding-resilience', types: ['facility-distress'], label: 'Open the facility list in Funding & Resilience →' },
    record: {
      kind: 'table',
      caption: 'Compound review candidates, most negative margin first. Medicare cost-report basis; ratings and fines as published by CMS.',
      columns: [
        { key: 'facility', label: 'Facility', align: 'left' },
        { key: 'county', label: 'County', align: 'left' },
        { key: 'margin', label: 'Total margin' },
        { key: 'share', label: 'Medicaid day share' },
        { key: 'rating', label: 'Overall stars' },
        { key: 'beds', label: 'Certified beds' },
        { key: 'fines', label: 'Fines $' },
      ],
      rows: facilities.map((item) => ({ key: item.ccn, facility: item.facilityName, county: item.county, margin: item.totalMargin == null ? '—' : pct(item.totalMargin, 1), share: item.medicaidDayShare == null ? '—' : pct(item.medicaidDayShare), rating: item.overallRating ?? '—', beds: item.certifiedBeds ?? '—', fines: item.totalFines == null ? '—' : wholeMoney(item.totalFines) })),
    },
    guardrail: 'A compound review prompt; never a closure prediction or a quality finding.',
    asOf: latestAsOf(FACILITY_FINANCIAL_DISTRESS.generatedAt),
  });
}

function depotLinkedLiquidity(state) {
  const nonprofit = NONPROFIT_FINANCIALS.byState[state];
  const linked = nonprofit?.depotLinkedCandidates;
  if (!linked?.organizations?.length) return null;
  const low = linked.organizations.filter((org) => org.liquidityMonths != null && org.liquidityMonths < 3);
  if (!low.length) return null;
  const twoPeriods = low.filter((org) => org.lowLiquidityBothPeriods).length;
  return briefing({
    id: `${state}-depot-linked-liquidity`,
    state,
    kind: 'inferred',
    headline: `${count(low.length)} ${stateName(state)} nonprofits that serve Medicaid members or receive federal Medicaid-related funds hold less than three months of reserves; ${count(twoPeriods)} have for two filings running.`,
    lede: `Thin reserves at organizations that deliver Medicaid-adjacent services mean an award delay or expiration would reach operations within a quarter. The two-filing repeat separates persistent thinness from a single year's accounting; ${count(linked.filingsMatched)} such organizations file a Form 990, and these are the least liquid.`,
    figures: [
      { label: 'Depot-linked organizations', value: count(linked.filingsMatched) },
      { label: 'Under 3 months liquidity', value: count(low.length) },
      { label: 'Two consecutive low filings', value: count(twoPeriods) },
      { label: 'Also a sub-award recipient', value: count(low.filter((org) => org.subawardAmount != null).length) },
    ],
    question: 'For each organization, does a tracked award or sub-award end within the review window, and has the program owner confirmed the service that depends on it?',
    owner: OWNERS[state].resilience,
    sourceSystems: ['IRS_990_EXTRACT', 'SAM_ENTITY', 'USA_SPENDING'],
    goalId: GOALS[state].accountability,
    goalsTouched: [GOALS[state].accountability, GOALS[state].trend],
    roomLink: { roomId: 'funding-resilience', types: ['nonprofit-liquidity'], label: 'Open the resilience list in Funding & Resilience →' },
    record: {
      kind: 'table',
      caption: 'Depot-linked organizations under 3 months of unrestricted liquidity, latest filing period per EIN.',
      columns: [
        { key: 'org', label: 'Organization', align: 'left' },
        { key: 'period', label: 'Tax period', align: 'left' },
        { key: 'months', label: 'Liquidity (months)' },
        { key: 'prior', label: 'Prior period' },
        { key: 'links', label: 'Depot links', align: 'left' },
      ],
      rows: low.map((org) => ({ key: org.ein, org: org.orgName, period: org.taxPeriod, months: org.liquidityMonths, prior: org.priorPeriodLiquidityMonths ?? '—', links: org.depotLinks.join('; ') })),
    },
    guardrail: 'A liquidity ratio is a triage prompt, not a diagnosis; organization-level IRS data only.',
    asOf: latestAsOf(NONPROFIT_FINANCIALS.generatedAt),
  });
}

function cmsChains(state) {
  const ownership = OWNERSHIP_NETWORK.byState[state];
  const cms = ownership?.cmsChains;
  if (!cms?.chains?.length) return null;
  const metrics = new Map(((state === 'FL' ? FL_OPERATIONAL_SOURCES : KY_OPERATIONAL_SOURCES).metrics || []).map((metric) => [metric.metricId, metric]));
  const facilityTotal = metrics.get(state === 'FL' ? 'fl-provider-facilities' : 'ky-provider-facilities');
  const exactMatchFacilities = (ownership.ownershipChains?.chains || []).reduce((sum, chain) => sum + Number(chain.facilityCount || 0), 0);
  const lowRated = cms.chains.reduce((sum, chain) => sum + Number(chain.lowRatedFacilityCount || 0), 0);
  const rated = cms.chains.reduce((sum, chain) => sum + Number(chain.ratedFacilityCount || 0), 0);
  const changed = cms.chains.reduce((sum, chain) => sum + Number(chain.changedOwnership12moCount || 0), 0);
  const top = cms.chains[0];
  return briefing({
    id: `${state}-cms-chains`,
    state,
    kind: 'observed',
    headline: `${count(cms.chainCount)} chains run ${facilityTotal?.numericValue ? pct(cms.facilitiesInChains / facilityTotal.numericValue) : count(cms.facilitiesInChains)} of ${stateName(state)}'s nursing facilities; ${top ? `the largest, ${top.displayLabel.replace(/ \(label withheld.*$/, '')}, has ${count(top.lowRatedFacilityCount)} of its ${count(top.ratedFacilityCount)} rated facilities at 1–2 stars` : `${count(lowRated)} of ${count(rated)} rated chain facilities are at 1–2 stars`}.`,
    lede: `Quality and financial patterns concentrate under common ownership: a chain with many low-rated facilities, published fines, or recent ownership changes is a review unit in itself, not a set of unrelated facilities. ${count(cms.withheldLabelCount)} chain labels are withheld because the owner of record is not an organization; those chains are identified by CMS id.`,
    figures: [
      { label: 'CMS-reported chains', value: count(cms.chainCount) },
      { label: 'Facilities in those chains', value: count(cms.facilitiesInChains) },
      { label: 'Rated 1–2 stars', value: `${count(lowRated)} of ${count(rated)} rated` },
      { label: 'Changed ownership in last 12 months', value: count(changed) },
      { label: 'Largest chain', value: top ? `${top.displayLabel.length > 34 ? `${top.displayLabel.slice(0, 32)}…` : top.displayLabel} · ${top.facilityCount}` : '—' },
    ],
    question: 'Which chains combine a high share of 1–2 star facilities with recent ownership changes or published fines, and are any of their members already in a survey or continuity review?',
    owner: OWNERS[state].quality,
    sourceSystems: ['CMS_PROVIDER_DATA'],
    goalId: GOALS[state].integrity,
    goalsTouched: [GOALS[state].integrity, GOALS[state].quality],
    roomLink: { roomId: 'funding-resilience', types: ['ownership-chain'], label: 'Open the chain graph in Funding & Resilience →' },
    record: {
      kind: 'table',
      caption: 'CMS-reported chains, largest first. Labels withheld where the publisher\'s chain name is not an organization; the chain is identified by its CMS id.',
      columns: [
        { key: 'chain', label: 'Chain', align: 'left' },
        { key: 'facilities', label: 'Facilities' },
        { key: 'beds', label: 'Certified beds' },
        { key: 'low', label: '1–2 stars' },
        { key: 'fines', label: 'Fines $' },
        { key: 'changed', label: 'Changed ownership 12 mo' },
      ],
      rows: cms.chains.slice(0, 25).map((chain) => ({ key: chain.chainId, chain: chain.displayLabel, facilities: chain.facilityCount, beds: chain.totalCertifiedBeds, low: `${chain.lowRatedFacilityCount} of ${chain.ratedFacilityCount}`, fines: wholeMoney(chain.publishedFineAmount), changed: chain.changedOwnership12moCount })),
    },
    guardrail: 'Common ownership is a structural fact, never itself a finding of quality failure or improper conduct.',
    asOf: latestAsOf(OWNERSHIP_NETWORK.generatedAt),
  });
}

// ---------------------------------------------------------------------------

function rank(items) {
  const kindOrder = { observed: 0, inferred: 1, gap: 2 };
  return [...items].sort((a, b) => (
    (b.goalsTouched.length - a.goalsTouched.length)
    || (kindOrder[a.kind] - kindOrder[b.kind])
    || ((a.urgencyDays ?? 9999) - (b.urgencyDays ?? 9999))
    || a.id.localeCompare(b.id)
  ));
}

export function buildOperationalBriefings(stateCode = 'KY', now = new Date()) {
  const state = String(stateCode).toUpperCase() === 'FL' ? 'FL' : 'KY';
  const mcpar = MCPAR_PLAN_PERIOD.byState[state];
  const mcparAsOf = latestAsOf(mcpar?.reportingPeriodEnd, MCPAR_PLAN_PERIOD.generatedAt);
  const items = [
    planConcentration(state, mcpar, mcparAsOf),
    comparability(state, mcpar, mcparAsOf),
    sanctionsBriefing(state, mcpar, mcparAsOf),
    publisherDivergence(state, mcpar, mcparAsOf),
    runwayComposition(state, now),
    successorOpportunities(state, now),
    cliffCascade(state, now),
    programOverlap(state),
    countyAccess(state),
    compoundFacility(state),
    cmsChains(state),
    depotLinkedLiquidity(state),
  ].filter(Boolean);
  return rank(items);
}

export const OPERATIONAL_BRIEFINGS = {
  KY: buildOperationalBriefings('KY'),
  FL: buildOperationalBriefings('FL'),
};

export function getOperationalBriefings(stateCode = 'KY') {
  return OPERATIONAL_BRIEFINGS[String(stateCode).toUpperCase() === 'FL' ? 'FL' : 'KY'];
}
