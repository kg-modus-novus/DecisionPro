import { FL_OPERATIONAL_SOURCES } from './alp/flOperationalSources.js';
import { FEDERAL_AWARD_GRAIN } from './alp/federalAwardGrain.js';
import { ORGANIZATION_CROSSWALK } from './alp/organizationCrosswalk.js';
import { NONPROFIT_FINANCIALS } from './alp/nonprofitFinancials.js';
import { FACILITY_FINANCIAL_DISTRESS } from './alp/facilityFinancialDistress.js';
import { OWNERSHIP_NETWORK } from './alp/ownershipNetwork.js';
import { SUBAWARD_FLOW_GRAPH } from './alp/subawardFlowGraph.js';
import { PROGRAM_HORIZON_EVENTS } from './alp/programHorizonEvents.js';

const metricMap = new Map((FL_OPERATIONAL_SOURCES.metrics || []).map((metric) => [metric.metricId, metric]));
const metric = (id, fallback, unit = 'records') => metricMap.get(id) || { numericValue: fallback, displayValue: Number(fallback).toLocaleString(), unit, asOfDate: 'See source record', limitation: 'Confirm the current source record before action.' };
const source = (id) => FL_OPERATIONAL_SOURCES.sources?.find((item) => item.fromSysId === id);
const currency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
const pct = (value) => `${Math.round(value * 100)}%`;

function input(id, title, item, sources, summary, limitation) {
  return { id, kind: 'input', title, value: item.displayValue, summary, sources, asOf: item.asOfDate, impact: 'Provides a governed public signal for prioritizing human review.', limitation: limitation || item.limitation };
}
function transform(id, title, summary, method, limitation) {
  return { id, kind: 'transformation', title, summary, method, impact: 'Turns disconnected public facts into a reviewable evidence chain.', limitation };
}
function action({ id, title, priority, summary, owner, authority, how, impact, time, cost, savings, measures, guardrail, opportunity }) {
  return { id, kind: 'action', title, reviewPriority: priority, implementationPriority: priority === 1 ? 'Review first' : 'Review next', summary, owner, authority, expectedImpact: impact, timeHorizon: time, how, estimatedCost: cost, estimatedSavings: savings, prerequisites: ['Confirm source period and definition', 'Name an accountable reviewer', 'Record the baseline and stopping rule'], successMeasures: measures, guardrail, opportunity };
}

function goal({ id, label, objective, lead, leadLabel, title, question, confidence, lenses, inputs, transforms, actions }) {
  return { id, label, objective, leadValue: lead.displayValue, leadLabel, reviewPriority: 1, readiness: 'Public evidence hydrated; validate before implementation', cases: [{ id: `${id}-case`, title, question, confidence, impactLenses: lenses, inputs, transformations: transforms, actions }] };
}

const complianceDollars = metric('fl-compliance-assessed', 1_000_000, 'USD');
const paRows = metric('fl-prior-auth-records', 12, 'rows');
const paPlans = metric('fl-prior-auth-plans', 6, 'plans');
const bedRows = metric('fl-licensed-bed-records', 5000, 'records');
const beds = metric('fl-licensed-beds', 100000, 'beds');
const providerApps = metric('fl-new-provider-applications', 1000, 'applications');
const providerCounties = metric('fl-new-provider-counties', 67, 'counties');
const metricDefinitions = metric('fl-health-plan-metric-definitions', 31, 'metrics');
const immigrationRows = metric('fl-immigration-detail-rows', 13921, 'rows');
const immigrationCounties = metric('fl-immigration-counties', 67, 'counties');
const paceRows = metric('fl-pace-records', 20, 'rows');
const eligibles = metric('fl-medicaid-eligibles', 0, 'people');
const eligibilityAnnualChange = metric('fl-medicaid-year-change', 0, 'people');
const eligibilityAnnualChangePercent = metric('fl-medicaid-year-change-percent', 0, 'percent');
const feeScheduleDocuments = metric('fl-fee-schedule-documents', 0, 'documents');
const feeScheduleCategories = metric('fl-fee-schedule-types', 0, 'categories');
const feeScheduleSpreadsheets = metric('fl-fee-schedule-spreadsheets', 0, 'files');
const cmsProviderFacilities = metric('fl-provider-facilities', 0, 'facilities');
const cmsProviderBeds = metric('fl-provider-beds', 0, 'beds');
const cmsProviderLowRated = metric('fl-provider-low-rating', 0, 'facilities');
const cmsProviderEnforcementEvents = metric('fl-provider-enforcement-events', 0, 'events');
const cmsProviderFines = metric('fl-provider-fines', 0, 'USD');
const leieRecords = metric('fl-leie-records', 0, 'records');
const leieNpiRecords = metric('fl-leie-npi', 0, 'records');
const federalObligations = metric('fl-usaspending-latest-complete-fy', 0, 'USD');
const mcparRows = metric('fl-mcpar-rows', 0, 'rows');
const mcparQuestions = metric('fl-mcpar-questions', 0, 'questions');
const mcparEntities = metric('fl-mcpar-entities', 0, 'entities');

const assessed = Number(complianceDollars.numericValue) || 1_000_000;
const planReview = Math.max(1, Math.ceil(Number(paPlans.numericValue || 6) * 0.5));
const countyReview = Math.max(1, Math.ceil(Number(providerCounties.numericValue || 67) * 0.2));
const providerReview = Math.max(1, Math.ceil(Number(providerApps.numericValue || 1000) * 0.1));
const hydratedPublicSources = FL_OPERATIONAL_SOURCES.sources?.filter((item) => item.status === 'REAL data hydrated').length || 0;
const publicSourceCount = FL_OPERATIONAL_SOURCES.sources?.length || 1;
const publicCoveragePercent = Math.round((hydratedPublicSources / publicSourceCount) * 100);
const federalSources = FL_OPERATIONAL_SOURCES.federalSources || [];
const totalHydratedSources = hydratedPublicSources + federalSources.filter((item) => item.status === 'REAL data hydrated').length;
const totalGovernedSources = publicSourceCount + federalSources.length;
const totalCoveragePercent = Math.round((totalHydratedSources / Math.max(1, totalGovernedSources)) * 100);
const percentage = (numerator, denominator, digits = 0) => `${((Number(numerator) / Math.max(1, Number(denominator))) * 100).toFixed(digits)}%`;
const number = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value) || 0);
const normalizeCounty = (value) => String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
const eligibilityByCounty = new Map((FL_OPERATIONAL_SOURCES.analytics?.eligibilityByCounty || []).map((item) => [normalizeCounty(item.county), item]));
const capacitySignals = (FL_OPERATIONAL_SOURCES.analytics?.facilityCapacityByCounty || [])
  .map((item) => ({ ...item, eligible: Number(eligibilityByCounty.get(normalizeCounty(item.county))?.eligible || 0) }))
  .filter((item) => Number(item.beds) > 0 && item.eligible > 0)
  .map((item) => ({ ...item, eligiblePerBed: item.eligible / Number(item.beds) }))
  .sort((left, right) => right.eligiblePerBed - left.eligiblePerBed);
const accessSignalCount = Math.ceil(capacitySignals.length * 0.25);
const accessSignals = capacitySignals.slice(0, accessSignalCount);
const accessSignalEligiblePeople = accessSignals.reduce((total, item) => total + item.eligible, 0);
const firstPlanTranche = Math.max(1, Math.ceil(Number(paPlans.numericValue || 0) * 0.25));
const hospitalCountyUniverse = Number(metric('fl-medicaid-counties', 67).numericValue || 67);
const hospitalUnrepresentedCount = Math.max(0, hospitalCountyUniverse - Number(immigrationCounties.numericValue || 0));
const hospitalCoveragePercent = Math.round((Number(immigrationCounties.numericValue || 0) / Math.max(1, hospitalCountyUniverse)) * 100);
const annualEligibilityChangeMagnitude = Math.abs(Number(eligibilityAnnualChange.numericValue || 0));
const annualEligibilityChangePercentMagnitude = Math.abs(Number(eligibilityAnnualChangePercent.numericValue || 0));

export const FL_OPERATIONAL_GOALS = [
  goal({
    id: 'optimize-spending', label: 'Optimize Spending', objective: 'Find recoverable or avoidable dollars by reconciling financial, plan-performance, and enforcement evidence.', lead: complianceDollars, leadLabel: 'published compliance amount assessed', title: 'Reconcile assessed amounts and financial signals to realized value', question: 'Which assessed or financially anomalous amounts represent collected value, unresolved obligations, timing differences, or non-actionable signals?', confidence: 'Moderate · public AHCA aggregates; payment and contract reconciliation required', lenses: ['Spending', 'Plan oversight', 'Budget'],
    inputs: [input('fl-compliance-input', 'Published compliance amount assessed', complianceDollars, ['FL_AHCA_COMPLIANCE'], 'AHCA compliance categories and assessed amounts.'), input('fl-financial-input', 'Managed-care financial summary', metric('fl-f-12-rows', 1), ['FL_AHCA_FINANCIAL'], 'AHCA financial summary output at the currently exported grain.', 'Parameter-driven detail is not promoted until rendered-to-export reconciliation passes.'), input('fl-fee-context', 'Published fee-schedule documents', feeScheduleDocuments, ['FL_FEE_SCHEDULES'], 'Current publication inventory for rate and effective-date context.', 'Published rates are not paid claims or contracted managed-care rates; code descriptions are not republished.')],
    transforms: [transform('fl-period-reconciliation', 'Align plan, contract, and fiscal periods', 'Separates assessment, collection, expenditure, and reporting periods.', 'Normalize plan identities and periods; preserve incompatible grains as separate facts.', 'Assessed dollars are not automatically collected savings.'), transform('fl-value-status', 'Classify realized-value status', 'Classifies candidate value as collected, outstanding, avoided, timing-only, or unresolved.', 'Join authorized payment and contract records when available; otherwise keep the case pending.', 'Public dashboards do not contain authoritative collection ledgers.')],
    actions: [action({ id: 'fl-reconcile-assessments', title: 'Open an assessed-amount realization review', priority: 1, summary: 'Finance and contract oversight should reconcile the public assessed amount to authorized collection and contract records.', owner: 'Florida Medicaid finance and managed-care contract oversight', authority: 'Applicable SMMC contract and agency financial authority; verify exact clause.', how: ['Export the plan/period assessment workpaper.', 'Match each amount to contract authority and collection status.', 'Route only verified outstanding value to the authorized recovery process.'], impact: 'Produces a defensible realization ledger and prevents assessed amounts from being mislabeled as savings.', time: '4–8 weeks after authorized records are available', cost: '$6,000–$18,000 planning estimate for 100–225 loaded staff hours.', savings: `${currency(assessed * 0.1)}–${currency(assessed * 0.4)} modeled realization sensitivity; not confirmed savings.`, measures: ['Assessed dollars reconciled', 'Verified outstanding dollars', 'Collection cycle time'], guardrail: 'Do not label assessed, liquidated-damage, sanction, or financial-variance dollars as savings until realized.', opportunity: { absoluteValue: `${currency(assessed * 0.1)}–${currency(assessed * 0.4)}`, absoluteLabel: 'modeled assessed-value realization range', improvementValue: '10%–40%', improvementLabel: 'of published assessed dollars reconciled as realizable', calculationBasis: `${currency(assessed)} published assessed amount × 10%–40% planning sensitivity; replace with authorized collection history.`, analyzed: 'AHCA compliance action categories, assessed amounts, and managed-care financial context', finding: 'the public facts are not yet reconciled to collection and contract status', potential: 'produce a review-ready realization ledger and route verified balances', caveat: 'Planning sensitivity—not a finding or savings forecast.', confidence: 'MODELED · AUTHORIZED LEDGER REQUIRED' } }), action({ id: 'fl-prevent-repeat-loss', title: 'Test repeat-control remediation', priority: 2, summary: 'After validated cases exist, identify recurring categories and owners.', owner: 'Program integrity and plan oversight', authority: 'Corrective-action and contract-remedy authority.', how: ['Group validated cases by root cause.', 'Choose the least-cost control change.', 'Measure recurrence against the validated baseline.'], impact: 'Reduces repeat administrative loss and review effort.', time: 'One quarter after reconciliation', cost: '$10,000–$35,000 pilot planning range.', savings: `${currency(assessed * 0.05)}–${currency(assessed * 0.15)} modeled avoided exposure.`, measures: ['Recurring cases', 'Avoided assessed exposure', 'Control completion'], guardrail: 'No recurrence claim before cases and denominators are validated.', opportunity: { absoluteValue: `${currency(assessed * 0.05)}–${currency(assessed * 0.15)}`, absoluteLabel: 'modeled recurring exposure avoided', improvementValue: '5%–15%', improvementLabel: 'modeled reduction in validated recurring value', calculationBasis: `${currency(assessed)} public assessed amount × 5%–15% scenario.`, analyzed: 'validated realization cases and compliance categories', finding: 'root causes can be isolated only after reconciliation', potential: 'pilot a control change and measure recurrence', caveat: 'Conditional model—not confirmed avoided cost.', confidence: 'CONDITIONAL · VALIDATED CASES REQUIRED' } })],
  }),
  goal({
    id: 'improve-access', label: 'Improve Coverage & Access', objective: 'Find plan, service, and county access constraints and test the least-cost remedy.', lead: beds, leadLabel: 'published licensed-bed capacity', title: 'Validate capacity and prior-authorization access signals', question: 'Where do capacity, new-provider, PACE, and prior-authorization signals combine into a plausible access constraint?', confidence: 'Moderate · institutional public evidence; Medicaid network sufficiency requires validation', lenses: ['Access', 'Facilities', 'Members'],
    inputs: [input('fl-bed-input', 'Published licensed beds', beds, ['FL_AHCA_BEDS'], 'Licensed capacity by facility/provider type.'), input('fl-provider-input', 'New provider/owner applications', providerApps, ['FL_AHCA_PROVIDERS'], 'Institutional application records aggregated for DecisionPro display.'), input('fl-cms-provider-beds', 'Certified nursing-facility beds', cmsProviderBeds, ['CMS_PROVIDER_DATA'], 'Current CMS institutional capacity context.', 'Medicare certification and bed counts do not establish current Medicaid network participation or appointment availability.'), input('fl-pa-input', 'Prior authorization plan/measure rows', paRows, ['FL_AHCA_PRIORAUTH'], 'Plan-level public prior authorization measures.'), input('fl-eligibility-input', 'Current Medicaid eligibles', eligibles, ['FL_ELIGIBILITY_REPORTS'], 'Statewide point-in-time eligibility with county aggregate detail.', 'Eligibility is not proof of network access, service receipt, or paid claims.')],
    transforms: [transform('fl-county-capacity', 'Build county-service capacity baselines', 'Aligns bed, provider, PACE, and county evidence.', 'Normalize provider type and county; keep licensure distinct from Medicaid participation.', 'Licensed capacity does not establish appointment availability.'), transform('fl-friction-gate', 'Gate access signals with utilization-management evidence', 'Tests whether plan/service friction corroborates a capacity concern.', 'Align plan, service, request type, denominator, and period.', 'High denial or approval rates alone do not prove inappropriate policy.')],
    actions: [action({ id: 'fl-access-validation', title: 'Review the first county-service access tranche', priority: 1, summary: 'Network oversight should validate the highest multi-source access signals.', owner: 'Florida Medicaid network oversight with facility and plan operations', authority: 'Network adequacy, plan oversight, and program operations authority.', how: ['Rank counties only where two independent signals align.', 'Validate Medicaid participation and appointment availability.', 'Document the constraint and least-cost remedy.'], impact: 'Directs intervention to corroborated gaps and avoids statewide responses to false signals.', time: '6–10 weeks', cost: '$12,000–$30,000 planning range.', savings: 'Benefit is access restored; no defensible dollar estimate from public data alone.', measures: ['Counties validated', 'People/service capacity restored', 'Remediation time'], guardrail: 'Do not infer a member-level access failure from institutional counts.', opportunity: { absoluteValue: `${countyReview} counties`, absoluteLabel: 'first county validation tranche', improvementValue: '20%', improvementLabel: 'of counties represented in the current provider layer', calculationBasis: `${providerCounties.displayValue} represented counties × 20% first-tranche planning target.`, analyzed: 'licensed beds, provider/owner applications, PACE, and prior authorization signals', finding: 'public layers can prioritize validation but do not establish Medicaid network sufficiency', potential: 'confirm county-service gaps and choose the least-cost remedy', caveat: 'Decision-coverage target—not access restored.', confidence: 'MODELED · NETWORK VALIDATION REQUIRED' } }), action({ id: 'fl-pa-friction-pilot', title: 'Pilot one validated prior-authorization remedy', priority: 2, summary: 'Clinical policy and plan oversight should select one high-friction, low-value category only after denominator validation.', owner: 'Clinical policy, provider relations, and plan oversight', authority: 'Prior-authorization policy and contract authority.', how: ['Align service/request definitions.', 'Review overturn, extension, and decision-time evidence.', 'Pilot rule clarification, automation, or gold-card criteria with balancing measures.'], impact: 'Reduces avoidable administrative delay without weakening necessary clinical controls.', time: '8–16 weeks', cost: '$25,000–$75,000 pilot planning range.', savings: 'Measure staff/provider hours avoided; dollar value requires validated request volumes and loaded labor rates.', measures: ['Decision time', 'Appeal/overturn rate', 'Provider hours', 'Quality balancing measures'], guardrail: 'Do not optimize approval rates in isolation.', opportunity: { absoluteValue: `${planReview} plans`, absoluteLabel: 'first aligned plan review tranche', improvementValue: '50%', improvementLabel: 'of plans represented in the loaded PA slice', calculationBasis: `${paPlans.displayValue} represented plans × 50% planning tranche, rounded up.`, analyzed: 'public approval, denial, appeal, timeliness, extension, and plan measures', finding: 'plan/service definitions must be aligned before friction can be compared', potential: 'pilot a bounded remedy and measure time saved', caveat: 'Review scope—not predicted approvals or savings.', confidence: 'MODERATE · DEFINITION ALIGNMENT REQUIRED' } })],
  }),
  goal({
    id: 'strengthen-accountability', label: 'Strengthen Plan Accountability', objective: 'Join plan performance, prior authorization, complaints, finance, and compliance into one plan-period record.', lead: metricDefinitions, leadLabel: 'plan metrics with upstream source definitions', title: 'Create one reconciled plan-period accountability record', question: 'Which plan-period signals corroborate one another after population, denominator, target, and contract alignment?', confidence: 'Moderate · multiple official public sources; quarterly series remains a gap', lenses: ['Plans', 'Contracts', 'Quality'],
    inputs: [input('fl-metric-defs', 'Plan metric definitions', metricDefinitions, ['FL_AHCA_HPT'], 'Definitions include upstream source prose not surfaced in the AHCA visual interface.'), input('fl-pa-plan', 'Prior authorization plans', paPlans, ['FL_AHCA_PRIORAUTH'], 'Represented plans in the current public PA export.'), input('fl-compliance-plan', 'Compliance action categories', metric('fl-compliance-categories', 10), ['FL_AHCA_COMPLIANCE'], 'Public action categories and subcategories.')],
    transforms: [transform('fl-plan-identity', 'Reconcile plan identity and contract period', 'Maps aliases, acquisitions, plan classes, and effective periods.', 'Maintain a versioned crosswalk with confidence and reviewer status.', 'An identity mismatch can create false cross-dashboard correlations.'), transform('fl-definition-gate', 'Apply definition and denominator gates', 'Prevents rankings when plan type, population, service, or period differ.', 'Compare only aligned definitions; publish gaps instead of forced rankings.', 'Quarterly series remains unpromoted until rendered reconciliation passes.')],
    actions: [action({ id: 'fl-plan-scorecard', title: 'Prepare a cross-dashboard plan review workpaper', priority: 1, summary: 'Plan oversight should review corroborated signals within aligned plan-period records.', owner: 'Florida Medicaid plan oversight and data stewardship', authority: 'SMMC contract oversight and public reporting authority.', how: ['Approve the plan identity crosswalk.', 'Apply definition gates.', 'Route multi-signal exceptions with named owners and due dates.'], impact: 'Shortens signal-to-case time and makes contradictory evidence visible.', time: '4–8 weeks for the first aligned period', cost: '$15,000–$40,000 planning range.', savings: 'Operational benefit is reduced review/reconciliation time; value requires baseline cycle-time measurement.', measures: ['Aligned plan-period records', 'Signal-to-case time', 'Resolved exceptions'], guardrail: 'No league table across incomparable plans or populations.', opportunity: { absoluteValue: `${metricDefinitions.displayValue} metrics`, absoluteLabel: 'definitions brought under an explicit comparison gate', improvementValue: '100%', improvementLabel: 'of loaded plan metric definitions carrying source provenance', calculationBasis: `${metricDefinitions.displayValue} loaded metric definitions ÷ ${metricDefinitions.displayValue} = 100% provenance target.`, analyzed: 'plan metric definitions, prior authorization, finance, and compliance evidence', finding: 'AHCA domains are separate and require identity/definition alignment', potential: 'produce one reviewable plan-period evidence chain', caveat: 'Coverage metric—not a performance improvement forecast.', confidence: 'REAL · CROSSWALK REVIEW REQUIRED' } })],
  }),
  goal({
    id: 'provider-integrity', label: 'Improve Provider & Facility Oversight', objective: 'Prioritize institutional quality, ownership, capacity, and compliance changes for human review.', lead: providerApps, leadLabel: 'published provider/owner application records', title: 'Build a privacy-safe institutional review queue', question: 'Which facilities need corroborated review after ownership, capacity, quality, or compliance changes?', confidence: 'Moderate · public institutional data; identity and current Medicaid relationship require verification', lenses: ['Providers', 'Facilities', 'Integrity'],
    inputs: [input('fl-apps', 'Provider/owner applications', providerApps, ['FL_AHCA_PROVIDERS'], 'DecisionPro exports only aggregate counts; raw public contact/owner fields remain in governed PSA.'), input('fl-bed-records', 'Licensed-bed records', bedRows, ['FL_AHCA_BEDS'], 'Facility/type capacity records.'), input('fl-cms-facilities', 'Certified nursing facilities', cmsProviderFacilities, ['CMS_PROVIDER_DATA'], 'Current public CMS institutional context.'), input('fl-leie', 'Florida-address exclusion rows', leieRecords, ['HHS_OIG_LEIE'], 'Aggregate public exclusion-type counts only.', 'Address-state filtering is not an identity match or proof of Florida Medicaid participation; verify exact identity in the official OIG system before action.')],
    transforms: [transform('fl-facility-resolution', 'Resolve institutional identity', 'Matches facility/file/license identifiers and preserves uncertainty.', 'Prefer deterministic identifiers; route ambiguous matches to human review.', 'Never use fuzzy matching alone for adverse action.'), transform('fl-change-risk', 'Combine change and capacity signals', 'Prioritizes corroborated ownership/capacity/quality changes.', 'Require at least two independent evidence dimensions before prioritization.', 'A new owner or provider is not itself a risk finding.')],
    actions: [action({ id: 'fl-provider-review', title: 'Disposition the first institutional review tranche', priority: 1, summary: 'Facility and provider oversight should review the highest corroborated institutional changes.', owner: 'Florida AHCA facility regulation and Medicaid provider oversight', authority: 'Applicable licensure, enrollment, and program-integrity authority.', how: ['Resolve facility identity.', 'Verify current status in the owning system.', 'Classify as monitor, validate, remediate, or close.'], impact: 'Focuses staff on corroborated institutional changes while protecting people from unsupported inference.', time: '4–6 weeks', cost: '$8,000–$20,000 planning range.', savings: 'Benefit is earlier risk disposition; dollar value requires validated cases.', measures: ['Cases dispositioned', 'Match precision', 'Time to remediation'], guardrail: 'Legislative views remain aggregate and never expose owner/administrator contact details.', opportunity: { absoluteValue: `${providerReview} records`, absoluteLabel: 'first institutional review tranche', improvementValue: '10%', improvementLabel: 'of loaded provider/owner application records', calculationBasis: `${providerApps.displayValue} applications × 10% first-tranche planning target.`, analyzed: 'provider/owner applications and licensed-bed records', finding: 'institutional changes can be prioritized after identity resolution', potential: 'create a privacy-safe, human-reviewed queue', caveat: 'Workload target—not adverse findings.', confidence: 'MODELED · IDENTITY VERIFICATION REQUIRED' } })],
  }),
  goal({
    id: 'hospital-reporting', label: 'Improve Hospital Reporting', objective: 'Measure hospital reporting completeness and reconcile county-level expense signals without stigmatizing people or facilities.', lead: immigrationRows, leadLabel: 'hospital reporting detail rows', title: 'Reconcile hospital reporting coverage and expense signals', question: 'Are observed changes caused by reporting completeness, hospital mix, service volume, or a validated operational issue?', confidence: 'Moderate · public hospital/quarter detail; policy interpretation requires care', lenses: ['Hospitals', 'Reporting', 'Finance'],
    inputs: [input('fl-hospital-detail', 'Hospital reporting detail', immigrationRows, ['FL_AHCA_IMMIGRATION'], 'Hospital × quarter × measure public reporting records.'), input('fl-hospital-counties', 'Counties represented', immigrationCounties, ['FL_AHCA_IMMIGRATION'], 'County coverage in the loaded hospital layer.')],
    transforms: [transform('fl-reporting-coverage', 'Separate reporting coverage from measured change', 'Computes facility/quarter completeness before comparing totals.', 'Create expected-vs-received reporting cells and caveat incomplete periods.', 'Missing or late responses can distort trends.'), transform('fl-mix-normalization', 'Normalize hospital and period mix', 'Prevents facility/quarter mix changes from being called operational change.', 'Align comparable hospitals, measures, and periods; retain suppressed/incomplete cells.', 'Public aggregate data does not support conclusions about individuals.')],
    actions: [action({ id: 'fl-hospital-completeness', title: 'Close material hospital reporting gaps', priority: 1, summary: 'Hospital reporting operations should resolve material missing or inconsistent facility-period submissions.', owner: 'Florida AHCA hospital reporting program owner', authority: 'Applicable reporting and data-quality authority.', how: ['Calculate expected reporting cells.', 'Contact source owners for material gaps.', 'Reissue the aggregate analysis after correction.'], impact: 'Improves the reliability of county and statewide trends before policy use.', time: '2–6 weeks per reporting cycle', cost: '$5,000–$15,000 planning range.', savings: 'Avoided decision error; no defensible direct dollar estimate.', measures: ['Expected cells received', 'Correction cycle time', 'Reissued measures'], guardrail: 'Do not infer immigration status, eligibility, or conduct about any person from aggregate hospital reports.', opportunity: { absoluteValue: `${immigrationCounties.displayValue} counties`, absoluteLabel: 'reporting coverage subject to completeness validation', improvementValue: '100%', improvementLabel: 'of represented counties carrying a completeness status', calculationBasis: `Governance target: completeness status on all ${immigrationCounties.displayValue} represented counties.`, analyzed: 'hospital × quarter × measure detail and county expense summaries', finding: 'coverage must be established before changes are interpreted', potential: 'publish a completeness-qualified county analysis', caveat: 'Coverage target—not a benefit or eligibility finding.', confidence: 'REAL · COMPLETENESS REVIEW REQUIRED' } })],
  }),
  goal({
    id: 'trend-planning', label: 'Trend & Program Planning', objective: 'Align plan, facility, PACE, financial, eligibility, and rate periods to choose measurable program options.', lead: eligibles, leadLabel: 'current published Florida Medicaid eligibles', title: 'Build a period-aligned Florida planning baseline', question: 'How should capacity and program resources change after enrollment, service mix, rates, quality, and access are aligned?', confidence: 'Moderate · current eligibility and published comparators are hydrated; transaction detail and a continuous normalized series remain incomplete', lenses: ['Planning', 'Budget', 'Programs'],
    inputs: [input('fl-eligibles', 'Current Medicaid eligibles', eligibles, ['FL_ELIGIBILITY_REPORTS'], 'Published statewide and county point-in-time eligibility.'), input('fl-eligibility-year-change', 'Annual eligibility change', eligibilityAnnualChange, ['FL_ELIGIBILITY_REPORTS'], `Published comparator change (${eligibilityAnnualChangePercent.displayValue}).`, 'A change in eligibility does not by itself identify a policy cause or service impact.'), input('fl-pace', 'PACE report rows', paceRows, ['FL_AHCA_PACE'], 'Public PACE program/county statistics.'), input('fl-capacity', 'Licensed capacity', beds, ['FL_AHCA_BEDS'], 'Published licensed-bed capacity.'), input('fl-finance', 'Financial summary output', metric('fl-f-12-rows', 1), ['FL_AHCA_FINANCIAL'], 'Current exported financial summary grain.'), input('fl-federal-awards', 'Latest complete-year federal Medicaid obligations', federalObligations, ['USA_SPENDING'], 'Federal award context by recipient location and fiscal year.', 'Federal obligations are not Florida state-accounting payments or expenditures.'), input('fl-fee-publications', 'Fee-schedule publications', feeScheduleDocuments, ['FL_FEE_SCHEDULES'], 'Published rate/effective-date inventory without republishing code descriptions.')],
    transforms: [transform('fl-period-map', 'Map incompatible reporting periods', 'Aligns fiscal year, calendar quarter, contract period, and effective date.', 'Retain a period crosswalk and refuse comparisons without compatible windows.', 'A workbook publish date is not always the data as-of date.'), transform('fl-scenario-baseline', 'Create baseline and scenario envelopes', 'Separates observed facts, modeled assumptions, and proposed options.', 'Record baseline, absolute and percent target, cost, timing, and balancing measure.', 'Scenario outputs are not forecasts until calibrated against Florida history.')],
    actions: [action({ id: 'fl-planning-baseline', title: 'Approve one cross-domain planning baseline', priority: 1, summary: 'Finance, program operations, and data stewardship should approve aligned definitions and periods before resource scenarios are used.', owner: 'Florida Medicaid finance, program operations, and data stewardship', authority: 'Budget planning and program administration authority.', how: ['Publish the period crosswalk.', 'Reconcile control totals and definitions.', 'Approve a baseline with gaps and scenario assumptions.'], impact: 'Reduces rework and prevents incompatible periods from driving allocation choices.', time: '6–10 weeks', cost: '$20,000–$55,000 planning range.', savings: 'Benefit is avoided baseline error and faster scenario review; realized value requires decision-cycle measurement.', measures: ['Sources aligned', 'Definition exceptions', 'Scenario review cycle time'], guardrail: 'Keep observed, modeled, and proposed values visually distinct.', opportunity: { absoluteValue: `${hydratedPublicSources} public domains`, absoluteLabel: 'hydrated into the governed Florida evidence contract', improvementValue: `${publicCoveragePercent}%`, improvementLabel: `of ${publicSourceCount} inventoried AHCA dashboard and publication domains hydrated`, calculationBasis: `${hydratedPublicSources} sources with REAL data hydrated ÷ ${publicSourceCount} inventoried AHCA domains = ${publicCoveragePercent}%; export-disabled sources remain reference-only gaps.`, analyzed: 'eleven AHCA dashboard domains, eligibility publications, fee-schedule metadata, and federal context', finding: `${hydratedPublicSources} public domains are hydrated while publisher-disabled or unreconciled values remain explicit gaps`, potential: 'approve a cross-domain baseline with current enrollment and effective-date context', caveat: 'Coverage improvement—not program outcome or savings.', confidence: 'VERIFIED PERMISSION COVERAGE · RECONCILIATION REQUIRED' } })],
  }),
];

// OFR-01: federal award/recipient-grain (USAspending), Florida-only slice —
// never sourced from the Kentucky byState.KY branch of the same export.
const flAwardGrain = FEDERAL_AWARD_GRAIN.byState.FL;
const flAwardAsOf = flAwardGrain.metrics['ofr-award-count']?.asOfDate || 'See source record';
const flAwardCliff0to6 = flAwardGrain.fundingCliffCalendar.buckets.find((bucket) => bucket.bucketId === '0-6mo');
const flAwardCliff6to12 = flAwardGrain.fundingCliffCalendar.buckets.find((bucket) => bucket.bucketId === '6-12mo');
const flAwardSingleStream = flAwardGrain.singleStreamDependency;
const flAwardCliffItem = (bucket) => ({
  displayValue: `${bucket?.count ?? 0} awards / ${bucket?.displayAmount ?? '$0'}`,
  asOfDate: flAwardAsOf,
  limitation: 'A listed expiration is a review prompt, not a predicted funding lapse; most awards renew routinely.',
});
const flAwardSingleStreamItem = {
  displayValue: `${flAwardSingleStream.recipientCount} organizations`,
  asOfDate: flAwardAsOf,
  limitation: "Reflects only the seven OFR-tracked assistance listings, not a recipient's full funding portfolio; not evidence of financial distress.",
};

const flCrosswalk = ORGANIZATION_CROSSWALK.byState.FL;
const flCrosswalkAsOf = flCrosswalk.metrics['ofr-crosswalk-identity-records']?.asOfDate || 'See source record';
const flCrosswalkItem = (displayValue) => ({ displayValue, asOfDate: flCrosswalkAsOf, limitation: 'A crosswalk link is a lead for authorized-system verification, never a confirmed identity on its own.' });

const flOwnership = OWNERSHIP_NETWORK.byState.FL;
const flOwnershipAsOf = flOwnership.metrics['ofr-ownership-chain-count']?.asOfDate || 'See source record';
const flOwnershipItem = (displayValue, limitation) => ({ displayValue, asOfDate: flOwnershipAsOf, limitation });

FL_OPERATIONAL_GOALS.find((entry) => entry.id === 'provider-integrity')?.cases.push({
  id: 'provider-integrity-ownership-churn-review',
  title: 'Review common-ownership chains and recent ownership changes',
  question: 'Which commonly owned Florida facility chains and recent ownership associations are worth a program-integrity review look, without treating ownership itself as a finding?',
  confidence: 'Low for entity action · organization-level CMS ownership data only, exact facility-name match; not an adverse finding',
  impactLenses: ['Providers', 'Integrity', 'Due process'],
  inputs: [
    input('fl-ownership-chain-count', 'Owner organizations controlling more than one loaded facility', flOwnershipItem(flOwnership.metrics['ofr-ownership-chain-count']?.displayValue || 'Not available', 'Common ownership is a structural fact, not evidence of coordinated misconduct, quality problems, or anticompetitive behavior.'), ['CMS_OWNERSHIP'], 'Common-ownership chains identified from CMS Hospital + SNF "All Owners" data, matched to the OFR-04 Florida facility universe by exact facility name.'),
    input('fl-ownership-recent-churn', 'Facilities with an owner association recorded in the last 12 months', flOwnershipItem(flOwnership.metrics['ofr-ownership-recent-churn-count']?.displayValue || 'Not available', 'A recorded association date reflects CMS enrollment filing timing, not necessarily the actual transaction date; a recent association is not itself irregular.'), ['CMS_OWNERSHIP'], 'Review candidates for recent ownership changes, from the CMS ownership association-date field.'),
  ],
  transformations: [
    transform('fl-ownership-privacy-transform', 'Strip individual owner identity before any fact lands in the warehouse', 'CMS ownership PUFs carry individual owner names and addresses for person-level owners; none of that reaches this product.', 'Only organization-level owner facts (organization name, role, percentage, entity-type flags, association date) and an owner_type flag are read from the raw file into any table; the full raw publisher file is retained in PSA with a content hash for audit.', 'Individual-owner facilities are represented only as an anonymous owner_type=individual count, never by name.'),
    transform('fl-ownership-facility-name-match', 'Match CMS ownership records to the OFR-04 KY+FL facility universe', 'Scopes the national CMS ownership file down to Kentucky and Florida hospitals and SNFs already known from OFR-04.', "Exact match on normalized facility name only (no fuzzy matching) between the CMS ownership file and OFR-04's dso_facility_cost_report.", 'A facility whose name differs between the two CMS datasets will not be matched; coverage is a lower bound, not exhaustive.'),
  ],
  actions: [
    action({ id: 'fl-review-ownership-chains', title: 'Review common-ownership chains for chain-level context', priority: 4, summary: "Program integrity should review the common-ownership chain list alongside each chain's aggregate bed count and financial-margin context from OFR-04.", owner: 'Program integrity, with facility oversight', authority: 'Program oversight authority; no adverse action authority implied.', how: ['Pull the ownership-chain list from the Funding & Resilience Evidence Room.', "Cross-reference each chain's facilities against other OFR signals (negative-margin watchlist, crosswalk).", 'Record reviewed or no-action status back into the review record.'], impact: 'Gives reviewers chain-level context before evaluating any single-facility signal in isolation.', time: '4–8 weeks for the initial review pass', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is better-contextualized review, not a dollar saving.', measures: ['Chains reviewed', 'Cross-referenced signals resolved'], guardrail: 'Common ownership is never itself a finding of anticompetitive conduct, quality failure, or program integrity violation.', opportunity: { absoluteValue: `${flOwnership.metrics['ofr-ownership-chain-count']?.displayValue || '0'} chains`, absoluteLabel: 'common-ownership chains available for review', improvementValue: '100%', improvementLabel: 'of identified chains reviewed', calculationBasis: `${flOwnership.metrics['ofr-ownership-chain-count']?.displayValue || '0'} owner organizations controlling more than one loaded Florida facility; reviewing all of them is the coverage target, not a finding.` } }),
    action({ id: 'fl-review-recent-ownership-changes', title: 'Review facilities with a recent ownership association', priority: 5, summary: 'Program integrity should confirm current licensure and Medicaid participation status for facilities with a recent ownership association, as routine due diligence.', owner: 'Program integrity, with provider enrollment', authority: 'Program oversight authority; no adverse action authority implied.', how: ['Pull the recent-ownership-association list.', 'Confirm current licensure and Medicaid participation status for each facility.', 'Record confirmed status back into the review record.'], impact: 'Keeps ownership-change due diligence current without treating a recent change as presumptively concerning.', time: 'As needed, on a rolling basis', cost: 'Staff review time only.', savings: 'Not quantified; benefit is current due-diligence coverage.', measures: ['Facilities reviewed', 'Status confirmed'], guardrail: 'A recent ownership association is a routine due-diligence prompt, never evidence of impropriety.', opportunity: { absoluteValue: `${flOwnership.metrics['ofr-ownership-recent-churn-count']?.displayValue || '0'} facilities`, absoluteLabel: 'facilities with a recent ownership association flagged for review', improvementValue: '100%', improvementLabel: 'of flagged facilities reviewed', calculationBasis: `${flOwnership.metrics['ofr-ownership-recent-churn-count']?.displayValue || '0'} facilities with an owner association in the last 12 months; reviewing all of them is the coverage target, not a risk score.` } }),
  ],
});

FL_OPERATIONAL_GOALS.find((entry) => entry.id === 'provider-integrity')?.cases.push({
  id: 'provider-integrity-crosswalk-screening',
  title: 'Strengthen exclusion and identity screening with a governed crosswalk',
  question: 'Which Florida organizations have a corroborated cross-source identity link that could speed authorized exclusion or enrollment verification, and which candidate links still need human review?',
  confidence: 'Low for entity action · exact-derived links still require authorized-system verification; inferred links are review candidates only',
  impactLenses: ['Providers', 'Integrity', 'Due process'],
  inputs: [
    input('fl-crosswalk-exact-links', 'Exact crosswalk assertions (exact-published + exact-derived)', flCrosswalkItem(`${flCrosswalk.methodBreakdown.exactPublished + flCrosswalk.methodBreakdown.exactDerived} links`), ['SAM_ENTITY', 'USA_SPENDING', 'IRS_EO_BMF', 'CMS_PROVIDER_DATA', 'NPPES'], 'Cross-source identity links backed by a same-record fact (NPPES NPI + state Medicaid ID) or a deterministic normalized name-and-address match between two independently published sources.'),
    input('fl-crosswalk-inferred-links', 'Inferred crosswalk assertions (review candidates only)', flCrosswalkItem(`${flCrosswalk.methodBreakdown.inferred} candidates`), ['SAM_ENTITY', 'USA_SPENDING', 'IRS_EO_BMF', 'CMS_PROVIDER_DATA', 'NPPES'], 'Name-similarity-only matches with no independent address confirmation, kept in a separate collection from exact links.'),
    input('fl-crosswalk-disagreements', 'SAM vs USAspending name disagreements (open queue)', flCrosswalkItem(`${flCrosswalk.disagreementQueue.length} open`), ['SAM_ENTITY', 'USA_SPENDING'], "Cases where SAM.gov's registered legal business name and USAspending's recipient name for the same UEI do not match closely; never auto-resolved by this pipeline."),
  ],
  transformations: [
    transform('fl-crosswalk-method-separation', 'Keep exact and inferred assertions in separate collections', 'Structurally prevents an inferred name-similarity match from ever being queried as if it were confirmed identity.', 'Exact and inferred crosswalk assertions live in separate database tables with method-specific CHECK constraints, not just a shared table with a filter flag.', 'Structural separation prevents accidental promotion; it does not itself verify an exact-derived link against the authorized case system.'),
    transform('fl-crosswalk-sample-reconciliation', 'Reconcile a sampled exact-derived link against a live re-fetch', 'Every gate run re-verifies one sampled exact-derived assertion against a freshly re-fetched published source record.', 'Pick one CCN-anchored exact-derived assertion, re-fetch CMS Provider Data live, and confirm the facility name still matches above a similarity floor.', 'Only one assertion is sampled per gate run, not the full crosswalk.'),
  ],
  actions: [
    action({ id: 'fl-route-exact-links-to-screening', title: 'Route exact-derived crosswalk links into the authorized screening workload', priority: 1, summary: 'Provider enrollment screening should treat exact-published and exact-derived crosswalk links as a prioritized starting point for authorized-system identity verification, not as a finished match.', owner: 'AHCA provider enrollment screening, supported by program integrity', authority: 'Provider-screening authority and restricted access policy.', how: ['Pull the exact-published and exact-derived link list for the state.', 'Verify each link inside the authorized case system using deterministic identifiers.', 'Record verified, rejected, or needs-more-evidence status back into the review record.'], impact: 'Shortens the path from a public-source identity link to an authorized verification decision.', time: '2–4 weeks within each monthly screening cycle', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is faster, better-targeted screening, not a dollar saving.', measures: ['Links verified', 'False-link rate', 'Time to verification'], guardrail: 'An exact-derived link is a lead, never a confirmed identity or grounds for adverse action on its own.', opportunity: { absoluteValue: `${flCrosswalk.methodBreakdown.exactPublished + flCrosswalk.methodBreakdown.exactDerived} links`, absoluteLabel: 'exact crosswalk links available for authorized-system verification', improvementValue: '100%', improvementLabel: 'of exact links routed to verification', calculationBasis: `${flCrosswalk.methodBreakdown.exactPublished} exact-published + ${flCrosswalk.methodBreakdown.exactDerived} exact-derived links; verifying all of them is the coverage target, not a finding.` } }),
    action({ id: 'fl-resolve-sam-usaspending-disagreements', title: 'Resolve the open SAM-vs-USAspending name disagreement queue', priority: 2, summary: 'A reviewer should confirm which name is current for each open disagreement (alias, legal-name change, or reporting lag) before either name anchors a screening decision.', owner: 'Program integrity and provider relations', authority: 'Program oversight authority; no adverse action authority implied.', how: ['Pull the open disagreement queue.', 'Check SAM.gov and the underlying award record directly for the current legal name.', 'Mark each disagreement reviewed with the confirmed name and reason for the mismatch.'], impact: 'Prevents a stale or mismatched recipient name from anchoring an identity decision.', time: 'As needed, ahead of using either name for screening', cost: 'Staff review time only.', savings: 'Not quantified; benefit is avoided misidentification.', measures: ['Disagreements reviewed', 'Confirmed-name accuracy'], guardrail: 'A name disagreement is a corroboration gap to resolve, never itself evidence of misconduct.', opportunity: { absoluteValue: `${flCrosswalk.disagreementQueue.length} disagreements`, absoluteLabel: 'open SAM-vs-USAspending name disagreements queued for review', improvementValue: '100%', improvementLabel: 'of open disagreements reviewed and confirmed', calculationBasis: `${flCrosswalk.disagreementQueue.length} open disagreements between SAM.gov and USAspending recipient names for the same UEI; reviewing all of them is the coverage target, not a finding.` } }),
  ],
});

const flFacilityDistress = FACILITY_FINANCIAL_DISTRESS.byState.FL;
const flFacilityDistressAsOf = flFacilityDistress.metrics['ofr-hcris-facility-count']?.asOfDate || 'See source record';
const flFacilityDistressItem = (displayValue, limitation) => ({ displayValue, asOfDate: flFacilityDistressAsOf, limitation });

FL_OPERATIONAL_GOALS.find((entry) => entry.id === 'improve-access')?.cases.push({
  id: 'improve-access-facility-closure-risk-watchlist',
  title: 'Review county-level facility financial-distress signals from CMS cost reports',
  question: 'Which Florida counties have hospitals or nursing facilities with a negative Medicare-cost-report margin, worth a continuity-review look before an access problem develops?',
  confidence: 'Low–moderate · Medicare cost-report basis, sampled live re-verification; not a closure prediction',
  impactLenses: ['Access', 'Facilities', 'Budget'],
  inputs: [
    input('fl-hcris-negative-margin', 'Facility-years with a negative total margin', flFacilityDistressItem(flFacilityDistress.metrics['ofr-hcris-negative-margin-count']?.displayValue || 'Not available', 'A single negative-margin year is not evidence of impending closure; many facilities operate below breakeven in a given year without ceasing operations.'), ['CMS_HCRIS'], 'CMS HCRIS hospital and SNF cost-report filings with net income below zero relative to total income, Medicare cost-report basis.'),
    input('fl-hcris-watchlist-counties', 'Counties with at least one negative-margin facility', flFacilityDistressItem(flFacilityDistress.metrics['ofr-hcris-watchlist-county-count']?.displayValue || 'Not available', 'County facility counts are not staffed capacity or network adequacy.'), ['CMS_HCRIS'], 'Bounds the county-level review workload to a specific, reproducible signal. Not yet joined to eligible-population ratios.'),
    input('fl-hcris-medicaid-day-share', 'Median share of patient days billed to Medicaid', flFacilityDistressItem(flFacilityDistress.metrics['ofr-hcris-median-medicaid-day-share']?.displayValue || 'Not available', 'Medicare cost-report basis; not Medicaid payment truth or a state accounting figure.'), ['CMS_HCRIS'], 'Median Title XIX share of total patient days across loaded Florida hospital and SNF cost reports.'),
  ],
  transformations: [
    transform('fl-hcris-live-sample-reconciliation', 'Reconcile a sampled facility-year against a live re-fetch', "Every gate run re-verifies one sampled facility's total costs against a freshly re-fetched CMS HCRIS API row.", 'Pick one loaded CCN, re-query the same CMS data-api/v1 dataset live, and confirm the stored total_costs value reproduces exactly.', 'Only one facility is sampled per gate run, not the full loaded set.'),
    transform('fl-hcris-county-rollup', 'Roll facility-level margin signals up to the county', 'Aggregates facility count, negative-margin count, total beds, and uncompensated care by county for a bounded review watchlist.', 'Group loaded Florida facility-years by the CMS-reported county field; a county enters the watchlist only if at least one facility has a negative margin.', 'County assignment follows the CMS filing, not a DMS region or Census geography crosswalk.'),
  ],
  actions: [
    action({ id: 'fl-review-facility-closure-risk-watchlist', title: 'Route negative-margin facility-years to a continuity-review queue', priority: 2, summary: 'Facility oversight and network adequacy staff should review the negative-margin watchlist as a continuity-planning prompt, not a distress determination.', owner: 'AHCA facility oversight, with network adequacy and Medicaid finance', authority: 'Program oversight authority; no adverse action authority implied.', how: ['Pull the negative-margin facility list and county rollup from the Funding & Resilience Evidence Room.', 'Cross-reference against known network-adequacy or licensure concerns for the same facility.', 'Record reviewed, no-action, or continuity-plan-opened status back into the review record.'], impact: 'Surfaces facilities and counties worth a closer continuity-planning look before an access problem develops.', time: '4–8 weeks for the initial review pass', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is earlier continuity-planning visibility, not a dollar saving.', measures: ['Facilities reviewed', 'Continuity plans opened where warranted', 'False-flag rate'], guardrail: 'A negative margin is a review prompt only; never describe it as impending closure, financial distress, or a finding without independent verification.', opportunity: { absoluteValue: `${flFacilityDistress.metrics['ofr-hcris-negative-margin-count']?.displayValue || '0'} facility-years`, absoluteLabel: 'negative-margin facility-years flagged for continuity review', improvementValue: '100%', improvementLabel: 'of flagged facility-years reviewed', calculationBasis: `${flFacilityDistress.metrics['ofr-hcris-negative-margin-count']?.displayValue || '0'} Florida hospital/SNF cost-report filings with a negative total margin; reviewing all of them is the coverage target, not a savings forecast.` } }),
    action({ id: 'fl-cross-reference-medicaid-exposure-watchlist', title: 'Cross-reference high Medicaid-day-share facilities with the negative-margin watchlist', priority: 3, summary: 'Medicaid finance should identify facilities with both a high Medicaid patient-day share and a negative margin, since the two signals together are a stronger continuity-planning prompt than either alone.', owner: 'AHCA Medicaid finance, with facility oversight', authority: 'Program oversight authority; no rate-setting or adverse action authority implied.', how: ['Pull the negative-margin list and rank by Medicaid day share.', 'Confirm current Medicaid participation status for each matched facility.', 'Prioritize matched facilities for the continuity-planning queue.'], impact: 'Concentrates continuity-planning attention on facilities most exposed to both Medicaid funding and financial-margin pressure.', time: '4–8 weeks, aligned with the facility-review cycle', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is earlier, better-targeted continuity-planning visibility.', measures: ['Facilities matched', 'Continuity plans opened where warranted'], guardrail: 'A margin and Medicaid-exposure combination is still a review prompt, not a prediction that a facility will close or reduce services.', opportunity: { absoluteValue: `${flFacilityDistress.metrics['ofr-hcris-median-medicaid-day-share']?.displayValue || '0%'}`, absoluteLabel: 'median Medicaid patient-day share among loaded Florida facilities', improvementValue: '100%', improvementLabel: 'of matched high-exposure, negative-margin facilities reviewed', calculationBasis: 'Cross-referencing the negative-margin watchlist against Medicaid day share is the review target, not a risk score.' } }),
  ],
});

const flSubaward = SUBAWARD_FLOW_GRAPH.byState.FL;
const flSubawardAsOf = flSubaward.metrics['ofr-subaward-edge-count']?.asOfDate || 'See source record';
const flSubawardItem = (displayValue, limitation) => ({ displayValue, asOfDate: flSubawardAsOf, limitation });

FL_OPERATIONAL_GOALS.find((entry) => entry.id === 'trend-planning')?.cases.push({
  id: 'trend-planning-subaward-funding-concentration-overlap',
  title: 'Review sub-award funding concentration and program overlap',
  question: 'Where is Florida sub-award funding concentrated in a single identity-resolved recipient, and which recipients draw on more than one OFR-tracked federal program, worth a coordination-review look?',
  confidence: 'Low–moderate · identity-resolved edges only for concentration; unresolved edges labeled and excluded from the concentration figure',
  impactLenses: ['Budget', 'Programs', 'Planning'],
  inputs: [
    input('fl-subaward-edge-count', 'Sub-award funding edges loaded', flSubawardItem(flSubaward.metrics['ofr-subaward-edge-count']?.displayValue || 'Not available', 'A funding edge is a review map, never itself evidence of duplication, waste, or improper coordination.'), ['USA_SPENDING'], 'Sub-awards found under the OFR-01 prime-award universe, each represented as one funding edge from prime to sub-recipient.'),
    input('fl-subaward-top-concentration', "Top sub-recipient's share of identity-resolved sub-award dollars", flSubawardItem(flSubaward.metrics['ofr-subaward-top-recipient-concentration']?.displayValue || 'Not available', 'Concentration in one recipient is not itself evidence of favoritism or improper award steering.'), ['USA_SPENDING'], 'Computed only from edges whose recipient identity was crosswalk-resolved (OFR-02 exact-derived match); unresolved edges are excluded from this figure, not silently included.'),
    input('fl-subaward-program-overlap', 'Sub-recipients funded under more than one OFR-tracked assistance listing', flSubawardItem(flSubaward.metrics['ofr-subaward-program-overlap-count']?.displayValue || 'Not available', 'Multiple funding streams to the same recipient can reflect distinct, non-duplicative service scopes; this is a review candidate, not a finding.'), ['USA_SPENDING'], 'Recipients appearing as a sub-recipient under two or more different assistance listings in the OFR-tracked set.'),
  ],
  transformations: [
    transform('fl-subaward-identity-confidence-labeling', 'Label every funding edge with an explicit identity confidence', "A sub-recipient name is matched against the OFR-02 crosswalk's identity records; only an exact normalized-name match to an EIN-bearing identity record earns exact-derived confidence.", 'Every edge stores identity_confidence as exact-derived or unresolved, enforced by a SQL CHECK constraint; an unresolved edge never carries an identity value.', "Coverage of exact-derived edges is bounded by the OFR-02 crosswalk's own EIN universe."),
    transform('fl-subaward-live-sample-reconciliation', 'Reconcile a sampled subaward against a live re-fetch', "Every gate run re-verifies one sampled subaward's dollar amount against a freshly re-fetched USAspending subawards page.", "Pick one loaded subaward, re-query the same prime award's subawards live, and confirm the stored amount reproduces exactly.", 'Only one subaward is sampled per gate run, not the full loaded set.'),
  ],
  actions: [
    action({ id: 'fl-review-subaward-concentration', title: 'Review top-concentration sub-recipients for coordination context', priority: 5, summary: 'Program and grants staff should review the highest-concentration identity-resolved sub-recipients as a coordination-review prompt, not a finding.', owner: 'AHCA federal grants management, with program oversight', authority: 'Grants management and program oversight authority.', how: ['Pull the funding-edge list from the Funding & Resilience Evidence Room, filtered to exact-derived confidence.', 'Cross-reference against other OFR signals for the same recipient (crosswalk, nonprofit financials).', 'Record reviewed or no-action status back into the review record.'], impact: 'Gives reviewers a starting point for understanding where sub-award funding concentrates before evaluating any single-recipient signal in isolation.', time: '4–8 weeks for the initial review pass', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is better-contextualized review, not a dollar saving.', measures: ['Edges reviewed', 'Cross-referenced signals resolved'], guardrail: 'Funding concentration is never itself evidence of favoritism, waste, or improper award steering.', opportunity: { absoluteValue: flSubaward.metrics['ofr-subaward-top-recipient-concentration']?.displayValue || '0%', absoluteLabel: 'top identity-resolved sub-recipient concentration share', improvementValue: '100%', improvementLabel: 'of high-concentration edges reviewed', calculationBasis: `${flSubaward.metrics['ofr-subaward-edge-count']?.displayValue || '0'} sub-award funding edges loaded; reviewing the highest-concentration identity-resolved recipients is the coverage target, not a finding.` } }),
    action({ id: 'fl-review-subaward-program-overlap', title: 'Review program-overlap sub-recipients before describing any overlap as duplicative', priority: 6, summary: "Program oversight should reconcile scope and population for sub-recipients funded under more than one OFR-tracked assistance listing before describing the funding as duplicative or overlapping.", owner: 'AHCA program oversight, with grants management', authority: 'Program oversight authority; no adverse action authority implied.', how: ['Pull the program-overlap recipient list.', "Confirm each program's distinct scope, population, and deliverables for the recipient.", 'Record confirmed distinct-scope or genuine-overlap status back into the review record.'], impact: 'Prevents a premature "duplicate funding" conclusion from an unreconciled multi-program signal.', time: 'As needed, ahead of any funding-policy or oversight action referencing overlap', cost: 'Staff review time only.', savings: 'Not quantified; benefit is avoided mischaracterization of legitimate multi-program funding.', measures: ['Recipients reviewed', 'Scope reconciliation completed'], guardrail: 'Never describe a program-overlap recipient as receiving duplicative or wasteful funding without a completed scope reconciliation.', opportunity: { absoluteValue: `${flSubaward.metrics['ofr-subaward-program-overlap-count']?.displayValue || '0'} organizations`, absoluteLabel: 'sub-recipients funded under more than one tracked program', improvementValue: '100%', improvementLabel: 'of overlap recipients scope-reconciled', calculationBasis: `${flSubaward.metrics['ofr-subaward-program-overlap-count']?.displayValue || '0'} sub-recipients funded under multiple OFR-tracked assistance listings; reconciling all of them is the coverage target, not a finding.` } }),
  ],
});

const flNonprofit = NONPROFIT_FINANCIALS.byState.FL;
const flNonprofitAsOf = flNonprofit.metrics['ofr-nonprofit-filings-count']?.asOfDate || 'See source record';

FL_OPERATIONAL_GOALS.find((entry) => entry.id === 'trend-planning')?.cases.push({
  id: 'trend-planning-nonprofit-financial-resilience',
  title: 'Review nonprofit financial-resilience signals from IRS Form 990 filings',
  question: 'Which crosswalked Florida Medicaid-adjacent nonprofits show low liquidity or high contribution/grant dependency worth a continuity-planning look before a funding change lands?',
  confidence: 'Low–moderate · organization-level IRS SOI extract reconciled by sampled live re-fetch; not a distress finding',
  impactLenses: ['Budget', 'Programs', 'Planning'],
  inputs: [
    input('fl-nonprofit-liquidity', 'Median months of unrestricted net-asset liquidity', { displayValue: flNonprofit.metrics['ofr-nonprofit-median-liquidity-months']?.displayValue || 'Not available', asOfDate: flNonprofitAsOf, limitation: 'A single low-liquidity period is not evidence of distress; many nonprofits run lean by design or hold restricted funds not counted here.' }, ['IRS_990_EXTRACT'], 'Median unrestricted net assets divided by average monthly functional expense, across crosswalked Florida Form 990 filers.'),
    input('fl-nonprofit-low-liquidity-count', 'Filings with under 3 months of liquidity', { displayValue: flNonprofit.metrics['ofr-nonprofit-low-liquidity-count']?.displayValue || 'Not available', asOfDate: flNonprofitAsOf, limitation: 'The 3-month threshold is a common planning convention, not a regulatory or distress standard.' }, ['IRS_990_EXTRACT'], 'Count of crosswalked Florida filing-periods below the 3-month reserve threshold.'),
    input('fl-nonprofit-contribution-dependency', 'Median contribution-and-grant revenue dependency', { displayValue: flNonprofit.metrics['ofr-nonprofit-median-contribution-dependency']?.displayValue || 'Not available', asOfDate: flNonprofitAsOf, limitation: 'The IRS SOI extract does not separately break out government-source grants from all Part VIII Line 1 contributions; this is a broader contribution-and-grant ratio, not government-specific.' }, ['IRS_990_EXTRACT'], 'Median share of total revenue from contributions and grants (not government-specific — see limitation).'),
  ],
  transformations: [
    transform('fl-nonprofit-crosswalk-filter', 'Filter the national 990 extract to the OFR-02 crosswalked KY+FL universe', 'Reduces a ~345,000-row national IRS filing extract to only the organizations already identity-resolved to Kentucky or Florida via the OFR-02 EO BMF crosswalk.', "Match each 990 filing row's EIN against the OFR-02 dso_identity_record EIN universe before landing any filing-level facts.", "Coverage is bounded by the OFR-02 crosswalk's own EIN universe (the EO BMF state extract), not a Medicaid-specific provider list."),
    transform('fl-nonprofit-ratio-computation', 'Compute resilience ratios from retained extract rows only', 'Every ratio is reproducible from the retained, content-hashed IRS SOI extract rows — no external estimate is blended in.', 'Liquidity months = unrestricted net assets ÷ (total functional expenses ÷ 12); contribution dependency = total contributions/grants ÷ total revenue.', 'Only Form 990 filers are covered (not 990-EZ or 990-PF); smaller or private-foundation-structured organizations are not represented.'),
  ],
  actions: [
    action({ id: 'fl-review-low-liquidity-filings', title: 'Route low-liquidity filings to a financial-resilience review queue', priority: 3, summary: 'Program and grants staff should review the lowest-liquidity crosswalked filings as a continuity-planning prompt, not a distress determination.', owner: 'AHCA program oversight, with grants management for federally funded organizations', authority: 'Program oversight authority; no adverse action authority implied.', how: ['Pull the lowest-liquidity filing list from the Funding & Resilience Evidence Room.', 'Cross-reference against the OFR-01 award-cliff calendar and OFR-02 crosswalk for the same organization.', 'Record reviewed, no-action, or continuity-plan-opened status back into the review record.'], impact: 'Surfaces organizations worth a closer continuity-planning look before a funding or contract change affects them.', time: '4–8 weeks for the initial review pass', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is earlier continuity-planning visibility, not a dollar saving.', measures: ['Filings reviewed', 'Continuity plans opened where warranted', 'False-flag rate'], guardrail: 'A liquidity ratio is a review prompt only; never describe it as financial distress, mismanagement, or a finding without independent verification.', opportunity: { absoluteValue: `${flNonprofit.metrics['ofr-nonprofit-low-liquidity-count']?.displayValue || '0'} filings`, absoluteLabel: 'low-liquidity filings flagged for continuity-planning review', improvementValue: '100%', improvementLabel: 'of flagged filings reviewed', calculationBasis: `${flNonprofit.metrics['ofr-nonprofit-low-liquidity-count']?.displayValue || '0'} crosswalked Florida Form 990 filings under the 3-month liquidity threshold; reviewing all of them is the coverage target, not a savings forecast.` } }),
    action({ id: 'fl-cross-reference-high-dependency-filings', title: 'Cross-reference high grant-dependency filings against the federal award-cliff calendar', priority: 4, summary: 'Grants management should check whether organizations with contribution-and-grant revenue at 80%+ of total revenue also appear on the OFR-01 near-term award-expiration list, since the two signals together are a stronger continuity-planning prompt than either alone.', owner: 'AHCA federal grants management, with program oversight', authority: 'Grants management and program oversight authority.', how: ['Pull the high-dependency filing list and the OFR-01 0–6/6–12 month award-expiration lists.', 'Match by crosswalked organization identity where an exact or exact-derived link exists.', 'Prioritize matched organizations for the continuity-planning queue.'], impact: 'Concentrates continuity-planning attention where funding concentration and near-term award expiration coincide.', time: '4–8 weeks, aligned with the award-cliff review cycle', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is earlier, better-targeted continuity-planning visibility.', measures: ['Organizations matched', 'Continuity plans opened where warranted'], guardrail: 'A dependency ratio combined with a near-term award expiration is still a review prompt, not a prediction that funding will lapse or that the organization is at risk.', opportunity: { absoluteValue: `${flNonprofit.metrics['ofr-nonprofit-high-dependency-count']?.displayValue || '0'} filings`, absoluteLabel: 'high grant-dependency filings available for cross-reference', improvementValue: '100%', improvementLabel: 'of high-dependency filings checked against the award-cliff calendar', calculationBasis: `${flNonprofit.metrics['ofr-nonprofit-high-dependency-count']?.displayValue || '0'} crosswalked Florida Form 990 filings with contribution-and-grant revenue at 80%+ of total revenue; checking all of them is the coverage target, not a risk score.` } }),
  ],
});

FL_OPERATIONAL_GOALS.find((entry) => entry.id === 'trend-planning')?.cases.push({
  id: 'trend-planning-federal-award-cliff',
  title: 'Track federal award expirations and single-stream funding concentration',
  question: 'Which federally funded Florida Medicaid-adjacent capacity has an award expiring soon, and which recipients depend on a single OFR-tracked funding stream?',
  confidence: 'Moderate · USAspending award-grain reconciled to control totals; not a renewal-outcome prediction',
  impactLenses: ['Budget', 'Programs', 'Planning'],
  inputs: [
    input('fl-award-cliff-0-6', 'Awards ending in 0–6 months', flAwardCliffItem(flAwardCliff0to6), ['USA_SPENDING'], 'Florida federal awards across the OFR-tracked assistance-listing set (93.775/93.777/93.778/93.791/93.224/93.958/93.959) with a published period-of-performance end date in the next 6 months.'),
    input('fl-award-cliff-6-12', 'Awards ending in 6–12 months', flAwardCliffItem(flAwardCliff6to12), ['USA_SPENDING'], 'Same tracked-listing set, next 6–12 month expiration window.'),
    input('fl-award-single-stream', 'Recipients funded by exactly one tracked assistance listing', flAwardSingleStreamItem, ['USA_SPENDING'], "Recipients whose only award among the OFR-tracked assistance listings falls under a single program."),
  ],
  transformations: [
    transform('fl-award-grain-reconciliation', 'Reconcile award-grain rows to USAspending control totals', 'Every loaded award is checked against a freshly re-fetched USAspending count and a sampled award re-fetch before use.', 'Place-of-performance and recipient-location queries are merged and deduplicated by award ID, then a sampled award and a per-listing count are re-fetched live and compared to the stored rows on every gate run.', 'Reconciliation covers a row-count floor, one control-total re-count, and one sampled award per gate run, not every row on every run.'),
    transform('fl-award-cliff-and-concentration-buckets', 'Bucket expirations and compute single-stream concentration', 'Groups award end dates into 0–6, 6–12, and 12–24 month review windows and flags recipients whose only tracked-listing award falls under one assistance listing.', "Compute months-until-end from each award's published period-of-performance end date; group recipients by normalized name and count distinct assistance listings per recipient.", 'Recipient-name normalization is a review candidate, not a verified organizational identity match; the OFR-02 crosswalk will replace it with confidence-labeled identity resolution.'),
  ],
  actions: [
    action({ id: 'fl-review-federal-award-renewals', title: 'Route near-term award expirations to renewal review', priority: 1, summary: 'Program and grants staff should review the 0–6 and 6–12 month expiration lists against known renewal timelines and application deadlines.', owner: 'AHCA federal grants coordination, with program leads for the funded capacity', authority: 'Grants management and program oversight authority.', how: ['Pull the 0–6 and 6–12 month lists from the Funding & Resilience Evidence Room.', 'Confirm renewal status directly with the awarding agency or recipient for each listed award.', 'Record confirmed renewal, lapse risk, or already-renewed status back into the review record.'], impact: 'Reduces the chance that a routine renewal is missed for lack of visibility, without asserting any award will lapse.', time: '2–4 weeks for the initial review pass', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is continuity assurance, not a dollar saving.', measures: ['Awards reviewed', 'Renewal status confirmed', 'Unresolved-at-expiration count'], guardrail: 'Do not describe an unreviewed expiration as a funding loss or program failure.', opportunity: { absoluteValue: `${flAwardCliff0to6?.count ?? 0} awards`, absoluteLabel: 'awards flagged for near-term renewal review (0–6 months)', improvementValue: '100%', improvementLabel: 'of near-term award expirations routed to renewal review', calculationBasis: `${flAwardCliff0to6?.count ?? 0} awards ending in the next 6 months across the OFR-tracked assistance listings; reviewing all of them is the coverage target, not a savings forecast.` } }),
    action({ id: 'fl-validate-single-stream-recipients', title: 'Validate single-stream-dependent recipients before any funding change', priority: 2, summary: 'Before any state or federal funding change affecting these listings, confirm whether flagged recipients have other funding streams outside this OFR-tracked set.', owner: 'Program integrity and provider relations', authority: 'Program oversight authority; no adverse action authority implied.', how: ['Pull the single-stream-dependent recipient list.', "Confirm each recipient's full funding picture where authorized data allows.", 'Flag any recipient without confirmed alternate funding for continuity planning.'], impact: 'Prevents a funding-policy change from unexpectedly destabilizing a recipient whose OFR-visible funding is concentrated in one stream.', time: 'As needed, ahead of any funding-policy change touching these listings', cost: 'Staff review time only.', savings: 'Not quantified; benefit is avoided service disruption.', measures: ['Recipients validated', 'Continuity plans opened where warranted'], guardrail: 'Single-stream status under this tracked set is a review candidate only, never evidence of financial distress or mismanagement.', opportunity: { absoluteValue: `${flAwardSingleStream.recipientCount} organizations`, absoluteLabel: 'single-stream-dependent recipients identified for continuity validation', improvementValue: '100%', improvementLabel: 'of flagged recipients validated before any funding-policy change', calculationBasis: `${flAwardSingleStream.recipientCount} recipients whose only OFR-tracked award falls under one assistance listing; validating all of them is the coverage target, not a risk score.` } }),
  ],
});

const flHorizon = PROGRAM_HORIZON_EVENTS.byState.FL;
const flHorizonAsOf = flHorizon.metrics['ofr-horizon-waiver-expiration-count']?.asOfDate || 'See source record';
const flHorizonExpirations = flHorizon.events.items.filter((event) => event.eventType === 'waiver_expiration');
const flHorizonNofos = flHorizon.events.items.filter((event) => event.eventType === 'nofo_opportunity' && event.eventDateKind === 'open_date');
const flHorizonMilestones = flHorizon.events.items.filter((event) => event.eventType === 'waiver_milestone');

FL_OPERATIONAL_GOALS.find((entry) => entry.id === 'trend-planning')?.cases.push({
  id: 'trend-planning-waiver-and-grant-horizon-watch',
  title: 'Track waiver/demonstration expirations and open federal grant opportunities',
  question: 'Which Florida Medicaid waiver or demonstration authority has a published expiration approaching, and which open federal funding opportunities under the OFR-tracked listings could support that capacity?',
  confidence: 'Moderate · every event cites its source document and retrieval date; no renewal outcome is predicted',
  impactLenses: ['Budget', 'Programs', 'Planning'],
  inputs: [
    input('fl-horizon-waiver-expiring', 'Waiver/demonstration authorities expiring within 24 months', { displayValue: flHorizon.metrics['ofr-horizon-waiver-expiring-24mo-count']?.displayValue || 'Not available', asOfDate: flHorizonAsOf, limitation: 'CMS publishes no structured API for this; the demonstration page itself is the cited source. A listed expiration is a published date, never a predicted lapse or renewal outcome.' }, ['CMS_1115_DEMO'], 'Managed Medical Assistance (MMA) Section 1115 Demonstration authority with a published expiration date in the next 24 months, cited to the CMS demonstration page.'),
    input('fl-horizon-waiver-milestones', 'Recently posted waiver milestone documents', { displayValue: flHorizon.metrics['ofr-horizon-waiver-milestone-count']?.displayValue || 'Not available', asOfDate: flHorizonAsOf, limitation: 'Limited to the most recently posted documents captured at retrieval time, not the full historical document set.' }, ['CMS_1115_DEMO'], "Recently posted amendment, extension, and monitoring documents from the MMA demonstration page's Supporting Documents record."),
    input('fl-horizon-open-nofo', 'Open or forecasted NOFO opportunities under tracked assistance listings', { displayValue: flHorizon.metrics['ofr-horizon-open-nofo-count']?.displayValue || 'Not available', asOfDate: flHorizonAsOf, limitation: 'National in scope — Grants.gov does not confirm Florida-specific eligibility; each opportunity requires an eligibility check before pursuit.' }, ['GRANTS_GOV'], 'Live Grants.gov search2 results for the seven OFR-tracked assistance listings, filtered to posted or forecasted status.'),
  ],
  transformations: [
    transform('fl-horizon-event-citation', 'Cite every event to its source document and retrieval date', 'No event is loaded without a source_document_uri and a retrieved_at timestamp, enforced by a dedicated reconciliation check on every gate run.', 'The CMS demonstration page\'s "Waiver Dates" and "Supporting Documents" blocks, and each Grants.gov opportunity, are captured with their source URI and fetch timestamp at load time.', 'CMS publishes no structured API for 1115 demonstration metadata; the page itself is the source of record, so a page redesign could require the parser to be updated.'),
    transform('fl-horizon-no-outcome-prediction', 'Never predict a renewal outcome', 'Every event carries a published status only (e.g. approved-through-expiration, posted, forecasted) — never a forecast of whether a waiver will be renewed or a grant awarded.', 'A reconciliation check scans every loaded status string for outcome-prediction language and fails the gate if any is found.', 'Status reflects what CMS/Grants.gov has published as of the retrieval date; it does not reflect unpublished internal deliberations.'),
  ],
  actions: [
    action({ id: 'fl-prepare-waiver-renewal-package', title: 'Open renewal-preparation work ahead of the MMA expiration', priority: 7, summary: 'Grants management and program leads should confirm the renewal timeline and begin preparing a renewal package well ahead of the published MMA expiration date, using the standard CMS extension process.', owner: 'AHCA federal grants management, with program leads for MMA-funded capacity', authority: 'Grants management and program oversight authority.', how: ['Pull the waiver expiration event and its source citation from the Funding & Resilience Evidence Room.', 'Confirm the current renewal/extension timeline directly with CMS.', 'Record the confirmed renewal-preparation status back into the review record.'], impact: 'Reduces the chance that a routine demonstration renewal is started too late, without asserting the demonstration will lapse.', time: 'Begin 18–24 months ahead of the published expiration date', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is continuity assurance, not a dollar saving.', measures: ['Renewal timeline confirmed', 'Renewal package preparation started', 'Milestone documents reviewed'], guardrail: 'Do not describe a published expiration date as a predicted funding lapse or program failure.', opportunity: { absoluteValue: `${flHorizonExpirations.length} authority`, absoluteLabel: 'waiver/demonstration authority with a tracked expiration date', improvementValue: '100%', improvementLabel: 'of tracked authorities with a confirmed renewal-preparation status', calculationBasis: `${flHorizonExpirations.length} tracked 1115 demonstration authority; confirming renewal-preparation status is the coverage target, not a savings forecast.` } }),
    action({ id: 'fl-review-open-nofo-opportunities', title: 'Route open NOFO opportunities to a grants-pursuit review', priority: 8, summary: 'Grants management should review open or forecasted NOFO opportunities under the OFR-tracked assistance listings and confirm Florida/provider eligibility before deciding whether to pursue.', owner: 'AHCA federal grants management, with program leads for the relevant capacity', authority: 'Grants management authority.', how: ['Pull the open NOFO opportunity list from the Funding & Resilience Evidence Room.', "Confirm Florida/provider eligibility against the opportunity's own eligibility criteria.", 'Record pursue, decline, or not-eligible status back into the review record.'], impact: 'Surfaces federal funding opportunities that might otherwise be missed for lack of a consolidated view.', time: "Ongoing, ahead of each opportunity's close date", cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is not missing an eligible opportunity, not a dollar saving.', measures: ['Opportunities reviewed', 'Eligibility confirmed', 'Pursue/decline decisions recorded'], guardrail: 'A listed opportunity is a review prompt only; never describe it as funding already secured.', opportunity: { absoluteValue: `${flHorizonNofos.length} opportunities`, absoluteLabel: 'open or forecasted NOFO opportunities under tracked assistance listings', improvementValue: '100%', improvementLabel: 'of open opportunities reviewed for eligibility', calculationBasis: `${flHorizonNofos.length} open/forecasted Grants.gov opportunities under the OFR-tracked assistance-listing set; reviewing all of them is the coverage target, not a funding forecast.` } }),
  ],
});

FL_OPERATIONAL_GOALS.find((entry) => entry.id === 'strengthen-accountability')?.cases.push({
  id: 'strengthen-accountability-waiver-deliverable-milestones',
  title: 'Track waiver deliverable and monitoring-report milestones',
  question: 'Which recently posted Florida MMA demonstration deliverables (evaluation designs, monitoring reports, extension letters) need a completeness or timeliness check against the applicable Special Terms and Conditions?',
  confidence: 'Moderate · every milestone cites its source document and retrieval date; no compliance determination is made',
  impactLenses: ['Plans', 'Contracts', 'Accountability'],
  inputs: [
    input('fl-waiver-milestone-documents', 'Recently posted waiver deliverable documents', { displayValue: flHorizon.metrics['ofr-horizon-waiver-milestone-count']?.displayValue || 'Not available', asOfDate: flHorizonAsOf, limitation: 'A posted document is not itself a completeness or timeliness determination against the Special Terms and Conditions — that requires reviewer judgment against the specific STC clause.' }, ['CMS_1115_DEMO'], "Recently posted Florida MMA demonstration documents (monitoring reports, amendment approvals, extension letters) from the CMS demonstration page's Supporting Documents record."),
    input('fl-waiver-approval-period-context', 'Florida MMA demonstration approval period', { displayValue: flHorizonExpirations[0]?.detail || 'Not available', asOfDate: flHorizonAsOf, limitation: 'The approval period does not itself state individual deliverable due dates; those come from the Special Terms and Conditions.' }, ['CMS_1115_DEMO'], 'The umbrella approval, effective, and expiration dates the deliverable schedule operates under, cited to the same CMS demonstration page.'),
  ],
  transformations: [
    transform('fl-waiver-milestone-citation', 'Cite every milestone to its source document and retrieval date', 'No milestone is loaded without a source_document_uri and a retrieved_at timestamp, enforced by the same OFR-07 reconciliation check used for the funding-cliff calendar.', 'The CMS demonstration page\'s "Supporting Documents" table is captured with its source URI and fetch timestamp at load time.', 'Limited to the most recently posted documents captured at retrieval time, not the full historical document set for the demonstration.'),
    transform('fl-waiver-milestone-type-not-classified', 'Leave deliverable-type and compliance classification to reviewer judgment', "A posted document's title is shown as published — DecisionPro does not classify it as on-time, late, or STC-compliant.", 'No automated STC clause matching or due-date inference is performed; the reviewer supplies the applicable clause and due date.', 'This keeps the initial triage manual; a future package could add a structured STC due-date registry if one becomes available in a reconcilable form.'),
  ],
  actions: [
    action({ id: 'fl-review-waiver-deliverable-milestones', title: 'Route recently posted deliverables to a compliance-timeliness review', priority: 9, summary: 'Grants management and program integrity should check each recently posted deliverable against the applicable Special Terms and Conditions due date and completeness requirement.', owner: 'AHCA federal grants management, with program integrity', authority: 'Grants management and program oversight authority; no adverse contract action implied.', how: ['Pull the recently posted deliverable list from the Funding & Resilience Evidence Room.', 'Match each document to its applicable STC due date and completeness requirement.', 'Record on-time, late, or not-yet-due status back into the review record.'], impact: 'Surfaces deliverables worth a closer compliance-timeliness look without asserting a violation.', time: '2–4 weeks for the initial review pass', cost: 'Staff review time only; no new system cost.', savings: 'Not quantified; benefit is earlier compliance-timeliness visibility, not a dollar saving.', measures: ['Deliverables reviewed', 'Timeliness status recorded'], guardrail: 'A posted document is a review prompt only; never describe it as a confirmed compliance violation or STC breach without independent verification.', opportunity: { absoluteValue: `${flHorizonMilestones.length} documents`, absoluteLabel: 'recently posted waiver deliverable documents available for review', improvementValue: '100%', improvementLabel: 'of posted deliverables checked against applicable STC due dates', calculationBasis: `${flHorizonMilestones.length} recently posted Florida MMA demonstration documents; checking all of them is the coverage target, not a compliance finding.` } }),
    action({ id: 'fl-publish-deliverable-status-log', title: 'Publish a reviewed deliverable-status log for oversight visibility', priority: 10, summary: 'After the timeliness review, publish a running log of reviewed deliverables and their recorded status for legislative and program-oversight visibility.', owner: 'AHCA federal grants management, with legislative liaison', authority: 'Grants management and public-reporting authority.', how: ['Take the reviewed deliverable list from the prior action.', 'Publish reviewed status (on-time, late, not-yet-due) to the standing oversight log.', 'Retain the source citation and retrieval date alongside each logged entry.'], impact: 'Gives oversight bodies a standing view of demonstration deliverable status without requiring a manual CMS page check.', time: 'Ongoing, updated after each review cycle', cost: 'Staff time to maintain the log; no new system cost.', savings: 'Not quantified; benefit is standing oversight visibility, not a dollar saving.', measures: ['Log entries published', 'Log currency (days since last update)'], guardrail: 'The log records reviewed status only — it never asserts an unreviewed document is compliant or non-compliant.', opportunity: { absoluteValue: `${flHorizonMilestones.length} documents`, absoluteLabel: 'deliverables eligible for the oversight log', improvementValue: '100%', improvementLabel: 'of reviewed deliverables logged for oversight visibility', calculationBasis: `${flHorizonMilestones.length} recently posted Florida MMA demonstration documents; logging all reviewed items is the coverage target, not a compliance finding.` } }),
  ],
});

const SECONDARY_OPPORTUNITIES = {
  'strengthen-accountability': { id: 'fl-plan-cycle-time', title: 'Reduce signal-to-review cycle time', absoluteValue: `${paPlans.displayValue} plans`, absoluteLabel: 'represented plans placed on a common review cadence', improvementValue: '25%', improvementLabel: 'modeled reduction in first-cycle reconciliation time', calculationBasis: 'Planning target: apply a 25% cycle-time reduction to the measured pre-DecisionPro baseline; replace after two observed cycles.', potential: 'measure whether one evidence chain reduces reconciliation effort' },
  'provider-integrity': { id: 'fl-county-change-watch', title: 'Establish a county institutional-change watch', absoluteValue: `${providerCounties.displayValue} counties`, absoluteLabel: 'represented counties carrying a current change status', improvementValue: '100%', improvementLabel: 'of represented counties covered by the watch', calculationBasis: `${providerCounties.displayValue} represented counties ÷ ${providerCounties.displayValue} = 100% coverage target; coverage is not risk reduction.`, potential: 'route corroborated institutional changes earlier' },
  'hospital-reporting': { id: 'fl-report-correction-cycle', title: 'Shorten the reporting correction cycle', absoluteValue: `${immigrationRows.displayValue} rows`, absoluteLabel: 'current detail rows subject to automated completeness checks', improvementValue: '20%', improvementLabel: 'modeled reduction in correction cycle time', calculationBasis: 'Planning target: reduce the measured baseline correction cycle by 20%; row coverage is known but the time baseline must be supplied by the program owner.', potential: 'reissue qualified trends sooner after corrections' },
  'trend-planning': { id: 'fl-gap-closure-plan', title: 'Assign every material data gap an owner and unblock path', absoluteValue: `${FL_OPERATIONAL_SOURCES.gaps?.length || 4} gaps`, absoluteLabel: 'current governed gaps assigned for disposition', improvementValue: '100%', improvementLabel: 'of current gaps with owner and unblock path', calculationBasis: `${FL_OPERATIONAL_SOURCES.gaps?.length || 4} current gap records ÷ the same ${FL_OPERATIONAL_SOURCES.gaps?.length || 4} records = 100% governance target.`, potential: 'prevent unavailable data from silently becoming assumptions' },
};

for (const goalItem of FL_OPERATIONAL_GOALS) {
  const decisionCase = goalItem.cases[0];
  const secondary = SECONDARY_OPPORTUNITIES[goalItem.id];
  if (!secondary || decisionCase.actions.length > 1) continue;
  const first = decisionCase.actions[0];
  decisionCase.actions.push({
    ...first,
    id: secondary.id,
    title: secondary.title,
    reviewPriority: 2,
    implementationPriority: 'Review next',
    summary: secondary.potential,
    expectedImpact: secondary.potential,
    estimatedCost: 'Use a 40–120 loaded staff-hour planning range; replace with the accountable owner’s work breakdown before authorization.',
    estimatedSavings: 'No direct savings claim; measure the stated absolute and percentage operational benefit against baseline.',
    opportunity: {
      absoluteValue: secondary.absoluteValue,
      absoluteLabel: secondary.absoluteLabel,
      improvementValue: secondary.improvementValue,
      improvementLabel: secondary.improvementLabel,
      calculationBasis: secondary.calculationBasis,
      analyzed: first.opportunity.analyzed,
      finding: first.opportunity.finding,
      potential: secondary.potential,
      caveat: 'Governance or cycle-time target—not a confirmed service or financial outcome.',
      confidence: 'MODELED · BASELINE MEASUREMENT REQUIRED',
    },
  });
}

// Recalibrate the opportunity layer after every governed hydration refresh.
// Observed review universes are intentionally not presented as savings. Modeled
// tranches remain explicit planning targets until an accountable owner supplies
// the operational baseline, authorized ledger, or validated outcome.
const opportunityModelRefresh = {
  'optimize-spending': {
    leadValue: cmsProviderFines.displayValue,
    leadLabel: 'published nursing-facility fine exposure requiring Medicaid relevance review',
    actions: {
      'fl-reconcile-assessments': {
        title: 'Disposition published enforcement exposure against Medicaid relevance',
        summary: 'Finance and oversight should determine which published federal facility fines or AHCA assessments intersect the current Florida Medicaid program, then record collection and disposition status in the owning system.',
        expectedImpact: 'Creates a defensible financial-exposure register without treating federal fines or public assessments as state savings.',
        estimatedSavings: `No savings booked. The ${currency(Number(cmsProviderFines.numericValue) + Number(complianceDollars.numericValue))} amount is an observed review universe, not recoverable Florida Medicaid dollars.`,
        opportunity: {
          absoluteHeading: 'Observed financial review universe',
          absoluteValue: currency(Number(cmsProviderFines.numericValue) + Number(complianceDollars.numericValue)),
          absoluteLabel: 'published CMS nursing-facility fines plus AHCA assessed amount requiring disposition',
          improvementHeading: 'Disposition target',
          improvementValue: '100%',
          improvementLabel: 'of published financial signals assigned verified program relevance and status',
          calculationBasis: `${cmsProviderFines.displayValue} published CMS nursing-facility fines + ${complianceDollars.displayValue} AHCA assessed amount; no amount is counted as savings.`,
          analyzed: `${cmsProviderEnforcementEvents.displayValue} published fine/payment-denial events, ${cmsProviderFines.displayValue} in published fines, AHCA compliance assessments, and managed-care financial context`,
          finding: 'the public sources expose financial signals but do not establish Florida Medicaid relevance, collection status, recoverability, or savings',
          potential: 'give every published financial signal an accountable disposition and route only verified Florida Medicaid matters',
          caveat: 'Observed exposure—not debt, recoverable value, waste, or savings.',
          confidence: 'OBSERVED UNIVERSE · AUTHORIZED LEDGER REQUIRED',
        },
      },
      'fl-prevent-repeat-loss': {
        title: 'Automate the machine-readable fee-schedule review tranche',
        summary: 'Rate and policy operations should place the machine-readable fee publications under an effective-date and change-review register before assessing payment impact.',
        expectedImpact: 'Reduces manual publication review and prevents stale rate assumptions from entering budget analysis.',
        estimatedSavings: 'No savings claim. Payment impact requires paid claims, contract terms, utilization and an approved rate-change baseline.',
        opportunity: {
          absoluteHeading: 'Observed automation-ready scope',
          absoluteValue: `${feeScheduleSpreadsheets.displayValue} files`,
          absoluteLabel: 'published machine-readable fee-schedule files available for governed change detection',
          improvementHeading: 'Current automatable share',
          improvementValue: percentage(feeScheduleSpreadsheets.numericValue, feeScheduleDocuments.numericValue),
          improvementLabel: `of the ${feeScheduleDocuments.displayValue}-document publication inventory machine-readable today`,
          calculationBasis: `${feeScheduleSpreadsheets.displayValue} machine-readable files ÷ ${feeScheduleDocuments.displayValue} published documents = ${percentage(feeScheduleSpreadsheets.numericValue, feeScheduleDocuments.numericValue)}; the remaining documents require governed document review.`,
          analyzed: `${feeScheduleDocuments.displayValue} published documents across ${feeScheduleCategories.displayValue} fee-schedule and billing-code categories`,
          finding: 'only part of the publication inventory is machine-readable, and publication changes are not paid-claims impact',
          potential: 'establish an effective-date register and automatically flag machine-readable changes for accountable review',
          caveat: 'Automation coverage—not a rate, payment, utilization, or savings estimate.',
          confidence: 'OBSERVED INVENTORY · PAYMENT IMPACT DATA REQUIRED',
        },
      },
    },
  },
  'improve-access': {
    leadValue: eligibles.displayValue,
    leadLabel: 'current published Florida Medicaid eligibles available for county-capacity prioritization',
    actions: {
      'fl-access-validation': {
        title: 'Validate the highest eligible-to-licensed-bed county signals',
        summary: 'Network oversight should review the top quartile of matched counties by Medicaid eligibles per published licensed bed, then verify service-specific participation and availability.',
        expectedImpact: 'Focuses validation on the counties where the public eligibility and licensed-capacity layers show the greatest relative pressure.',
        estimatedSavings: 'No dollar claim. The quantified benefit is a prioritized population and validation workload; access restored must be measured after remediation.',
        opportunity: {
          absoluteHeading: 'Observed priority population',
          absoluteValue: `${number(accessSignalEligiblePeople)} people`,
          absoluteLabel: `published Medicaid eligibles in the ${accessSignalCount}-county top-quartile capacity-signal tranche`,
          improvementHeading: 'Prioritized geography share',
          improvementValue: percentage(accessSignalCount, capacitySignals.length),
          improvementLabel: `of ${capacitySignals.length} counties with matched eligibility and licensed-bed data`,
          calculationBasis: `Rank ${capacitySignals.length} matched counties by published Medicaid eligibles per licensed bed; select the top quartile (${accessSignalCount} counties), containing ${number(accessSignalEligiblePeople)} eligibles.`,
          analyzed: `${eligibles.displayValue} Medicaid eligibles, ${beds.displayValue} licensed beds, ${cmsProviderBeds.displayValue} certified nursing-facility beds, provider applications, and PACE coverage`,
          finding: 'a relative capacity signal can prioritize review but does not establish Medicaid participation, appointment availability, or a service-specific access gap',
          potential: 'validate the highest-pressure county-service combinations and choose the least-cost remedy for confirmed gaps',
          caveat: 'Priority population—not people proven unable to obtain care.',
          confidence: 'DERIVED PUBLIC SIGNAL · NETWORK VALIDATION REQUIRED',
        },
      },
      'fl-pa-friction-pilot': {
        title: 'Align the first prior-authorization plan tranche',
        summary: 'Clinical policy and plan oversight should align request, service, denominator and period definitions for the first four represented plans before selecting a remedy.',
        expectedImpact: 'Creates a comparable first tranche for identifying avoidable administrative friction without optimizing approval rates in isolation.',
        estimatedSavings: 'No dollar claim. Staff and provider time avoided requires validated request volumes, process time and loaded labor rates.',
        opportunity: {
          absoluteHeading: 'Modeled first review tranche',
          absoluteValue: `${firstPlanTranche} plans`,
          absoluteLabel: 'represented plans selected for definition and denominator alignment',
          improvementHeading: 'Initial plan coverage',
          improvementValue: percentage(firstPlanTranche, paPlans.numericValue),
          improvementLabel: `of the ${paPlans.displayValue} plans in the current public prior-authorization slice`,
          calculationBasis: `${paPlans.displayValue} represented plans × 25% planning tranche, rounded up = ${firstPlanTranche} plans; no request outcomes are predicted.`,
          analyzed: `${paRows.displayValue} plan/measure rows across ${paPlans.displayValue} represented plans`,
          finding: 'public plan measures require definition and denominator alignment before friction or performance comparisons are defensible',
          potential: 'produce a comparable first tranche and select one bounded remedy with balancing measures',
          caveat: 'Review-scope model—not predicted approvals, access restored, or savings.',
          confidence: 'MODELED TRANCHE · DEFINITION ALIGNMENT REQUIRED',
        },
      },
    },
  },
  'strengthen-accountability': {
    leadValue: mcparRows.displayValue,
    leadLabel: 'Florida MCPAR response rows available for a governed plan-period evidence chain',
    actions: {
      'fl-plan-scorecard': {
        title: 'Gate every loaded MCPAR response by entity, definition and period',
        summary: 'Plan oversight should attach a comparison status to every loaded MCPAR response before joining it to AHCA plan-performance or prior-authorization signals.',
        expectedImpact: 'Makes incompatible records visible and gives reviewers one traceable plan-period accountability record.',
        estimatedSavings: 'No direct savings claim. Measure reduced reconciliation time after a pre-DecisionPro cycle baseline is recorded.',
        opportunity: {
          absoluteHeading: 'Observed accountability universe',
          absoluteValue: `${mcparRows.displayValue} responses`,
          absoluteLabel: `loaded across ${mcparEntities.displayValue} Florida reporting entities`,
          improvementHeading: 'Comparison-gate target',
          improvementValue: '100%',
          improvementLabel: 'of loaded MCPAR responses assigned aligned, hold or not-comparable status',
          calculationBasis: `${mcparRows.displayValue} loaded response rows ÷ ${mcparRows.displayValue} = 100% governance target across ${mcparEntities.displayValue} reporting entities.`,
          analyzed: `${mcparRows.displayValue} MCPAR responses, ${metricDefinitions.displayValue} AHCA metric definitions, and ${paPlans.displayValue} represented prior-authorization plans`,
          finding: 'cross-dashboard accountability requires explicit entity, population, denominator and period gates',
          potential: 'produce a reviewable plan-period chain without forcing incomparable records into a ranking',
          caveat: 'Evidence-coverage benefit—not a plan-performance improvement forecast.',
          confidence: 'OBSERVED UNIVERSE · CROSSWALK REVIEW REQUIRED',
        },
      },
      'fl-plan-cycle-time': {
        title: 'Approve the MCPAR question-definition dictionary',
        summary: 'Data stewardship should give every loaded MCPAR question identifier an approved interpretation, comparison rule and owner.',
        expectedImpact: 'Reduces repeated interpretation work and prevents question IDs from being compared outside their intended context.',
        estimatedSavings: 'No direct savings claim. Measure interpretation and reconciliation hours before and after dictionary approval.',
        opportunity: {
          absoluteHeading: 'Observed definition workload',
          absoluteValue: `${mcparQuestions.displayValue} question IDs`,
          absoluteLabel: 'distinct MCPAR questions requiring governed interpretation',
          improvementHeading: 'Dictionary coverage target',
          improvementValue: '100%',
          improvementLabel: 'of loaded question IDs assigned definition, comparison rule and owner',
          calculationBasis: `${mcparQuestions.displayValue} distinct loaded question IDs ÷ ${mcparQuestions.displayValue} = 100% dictionary-coverage target.`,
          analyzed: `${mcparQuestions.displayValue} question IDs represented in ${mcparRows.displayValue} Florida MCPAR response rows`,
          finding: 'the hydrated response universe is traceable, but reusable comparison decisions require an approved question dictionary',
          potential: 'turn repeated interpretation into a governed, reusable comparison rule set',
          caveat: 'Governance coverage—not a measured cycle-time reduction.',
          confidence: 'OBSERVED WORKLOAD · OWNER APPROVAL REQUIRED',
        },
      },
    },
  },
  'provider-integrity': {
    leadValue: cmsProviderLowRated.displayValue,
    leadLabel: `nursing facilities with 1–2 overall stars in the ${cmsProviderFacilities.displayValue}-facility public CMS slice`,
    actions: {
      'fl-provider-review': {
        title: 'Validate the public low-rating facility review universe',
        summary: 'Facility and Medicaid oversight should verify current participation, identity and corroborating evidence for the public 1–2 star facility universe before deciding whether review is warranted.',
        expectedImpact: 'Focuses human review on an observed institutional signal while preventing an external rating from becoming an automatic finding.',
        estimatedSavings: 'No savings claim. Value is earlier, defensible disposition; financial impact requires validated Florida Medicaid cases.',
        opportunity: {
          absoluteHeading: 'Observed facility review universe',
          absoluteValue: `${cmsProviderLowRated.displayValue} facilities`,
          absoluteLabel: 'nursing facilities with 1–2 published overall stars',
          improvementHeading: 'Public facility share',
          improvementValue: percentage(cmsProviderLowRated.numericValue, cmsProviderFacilities.numericValue),
          improvementLabel: `of ${cmsProviderFacilities.displayValue} Florida nursing facilities in the CMS slice`,
          calculationBasis: `${cmsProviderLowRated.displayValue} facilities with 1–2 stars ÷ ${cmsProviderFacilities.displayValue} published facilities = ${percentage(cmsProviderLowRated.numericValue, cmsProviderFacilities.numericValue)}; rating alone is not a Medicaid finding.`,
          analyzed: `${cmsProviderFacilities.displayValue} nursing facilities, ${cmsProviderLowRated.displayValue} low-rated facilities, ${cmsProviderEnforcementEvents.displayValue} enforcement events, and Florida provider/owner application aggregates`,
          finding: 'public institutional signals can define a review universe but require current identity, participation and source verification',
          potential: 'classify every reviewed signal as monitor, validate, remediate or close with accountable evidence',
          caveat: 'Observed public rating signal—not proof of poor Medicaid care or wrongdoing.',
          confidence: 'OBSERVED UNIVERSE · PARTICIPATION VERIFICATION REQUIRED',
        },
      },
      'fl-county-change-watch': {
        title: 'Verify NPI-bearing exclusion records before any program match',
        summary: 'Program integrity should use only NPI-bearing public exclusion rows as the first deterministic identity-review tranche, then verify each record in the official OIG system and Florida enrollment system.',
        expectedImpact: 'Reduces ambiguous matching workload and prevents fuzzy or address-only matches from becoming adverse findings.',
        estimatedSavings: 'No savings claim. Measure identity-review hours, match precision and verified active-program cases.',
        opportunity: {
          absoluteHeading: 'Observed identity-ready tranche',
          absoluteValue: `${leieNpiRecords.displayValue} records`,
          absoluteLabel: 'Florida-address LEIE rows carrying a published NPI',
          improvementHeading: 'Deterministic starting share',
          improvementValue: percentage(leieNpiRecords.numericValue, leieRecords.numericValue, 1),
          improvementLabel: `of ${leieRecords.displayValue} Florida-address exclusion rows carrying an NPI`,
          calculationBasis: `${leieNpiRecords.displayValue} NPI-bearing rows ÷ ${leieRecords.displayValue} Florida-address LEIE rows = ${percentage(leieNpiRecords.numericValue, leieRecords.numericValue, 1)}; every candidate still requires official identity and enrollment verification.`,
          analyzed: 'aggregate LEIE exclusion types, NPI availability, public facility context, and Florida institutional application counts',
          finding: 'only a subset of Florida-address exclusion rows carries an NPI suitable for a deterministic first-pass identity review',
          potential: 'create a bounded, human-verified screening queue without persisting person-level LEIE data in DecisionPro',
          caveat: 'Identity-review workload—not a match, exclusion finding, or authorization for adverse action.',
          confidence: 'OBSERVED AGGREGATE · OFFICIAL IDENTITY VERIFICATION REQUIRED',
        },
      },
    },
  },
  'hospital-reporting': {
    leadValue: `${hospitalUnrepresentedCount}`,
    leadLabel: 'counties needing an explicit hospital-reporting coverage disposition',
    actions: {
      'fl-hospital-completeness': {
        title: 'Disposition counties absent from the represented hospital layer',
        summary: 'Hospital reporting operations should classify every county absent from the current layer as legitimately no-reporting-facility, late, incomplete or unresolved.',
        expectedImpact: 'Prevents absence from being silently interpreted as zero activity or complete reporting.',
        estimatedSavings: 'No dollar claim. Benefit is prevention of unsupported county comparisons and faster correction of material omissions.',
        opportunity: {
          absoluteHeading: 'Observed coverage exceptions',
          absoluteValue: `${hospitalUnrepresentedCount} counties`,
          absoluteLabel: `outside the ${immigrationCounties.displayValue}-county represented hospital-reporting layer`,
          improvementHeading: 'Coverage-status target',
          improvementValue: `${hospitalCoveragePercent}%→100%`,
          improvementLabel: 'of Florida counties assigned represented or explained-absence status',
          calculationBasis: `${immigrationCounties.displayValue} represented counties out of ${hospitalCountyUniverse} Florida counties = ${hospitalCoveragePercent}%; classify the remaining ${hospitalUnrepresentedCount} rather than assuming missing or zero.`,
          analyzed: `${immigrationRows.displayValue} hospital reporting rows across ${immigrationCounties.displayValue} represented counties`,
          finding: 'the current public layer does not by itself distinguish a legitimate no-facility county from late, incomplete or unresolved reporting',
          potential: 'publish a complete county coverage-status register before interpreting trends',
          caveat: 'Coverage disposition—not evidence of missing care, immigration status, or reporting noncompliance.',
          confidence: 'OBSERVED COVERAGE · SOURCE-OWNER DISPOSITION REQUIRED',
        },
      },
      'fl-report-correction-cycle': {
        title: 'Apply automated completeness checks to every loaded hospital row',
        summary: 'Hospital reporting operations should run period, measure, facility, duplicate and null checks across the entire loaded detail layer each cycle.',
        expectedImpact: 'Makes correction work reproducible and gives every loaded row an explicit validation status.',
        estimatedSavings: 'No savings claim. Measure correction-cycle hours and reissue time before and after automation.',
        opportunity: {
          absoluteHeading: 'Observed validation universe',
          absoluteValue: `${immigrationRows.displayValue} rows`,
          absoluteLabel: 'current hospital detail rows available for automated structural checks',
          improvementHeading: 'Automated check target',
          improvementValue: '100%',
          improvementLabel: 'of loaded rows assigned structural validation status each cycle',
          calculationBasis: `${immigrationRows.displayValue} loaded rows ÷ ${immigrationRows.displayValue} = 100% automated structural-check coverage target; clinical and source corrections remain human-owned.`,
          analyzed: 'hospital, quarter and measure detail plus county coverage summaries',
          finding: 'the hydrated row universe supports structural validation even though source corrections and interpretation remain with the program owner',
          potential: 'shorten correction triage and reissue completeness-qualified trends sooner',
          caveat: 'Automated validation coverage—not proof that every source value is correct.',
          confidence: 'OBSERVED UNIVERSE · SOURCE CORRECTION REMAINS HUMAN-OWNED',
        },
      },
    },
  },
  'trend-planning': {
    leadValue: number(annualEligibilityChangeMagnitude),
    leadLabel: `annual decline in published Florida Medicaid eligibles (${annualEligibilityChangePercentMagnitude.toFixed(2)}%) requiring explanation before resource reallocation`,
    actions: {
      'fl-planning-baseline': {
        title: 'Explain the published annual eligibility decline before reallocating resources',
        summary: 'Eligibility, finance and program operations should decompose the published statewide decline by available county and age evidence, policy period and known redetermination context before changing resources.',
        expectedImpact: 'Prevents a statewide enrollment movement from becoming an unsupported assumption about access, demand, performance or budget need.',
        estimatedSavings: 'No savings claim. Budget impact requires monthly-average eligibility, FMAP, capitation, service mix, paid claims and state accounting data.',
        opportunity: {
          absoluteHeading: 'Observed annual change',
          absoluteValue: `${number(annualEligibilityChangeMagnitude)} people`,
          absoluteLabel: 'fewer published point-in-time Medicaid eligibles than the prior-year comparator',
          improvementHeading: 'Observed relative change',
          improvementValue: `${annualEligibilityChangePercentMagnitude.toFixed(2)}%`,
          improvementLabel: 'published year-over-year eligibility movement requiring an accountable explanation',
          calculationBasis: `${eligibles.displayValue} current eligibles compared with the publisher's prior-year comparator = ${eligibilityAnnualChange.displayValue} people (${eligibilityAnnualChangePercent.displayValue}).`,
          analyzed: 'current statewide eligibility, publisher comparators, county and age aggregates, fee effective dates, and federal obligation context',
          finding: 'the public data establishes the size of the eligibility movement but not its causes, service impact or budget effect',
          potential: 'approve a period-aligned explanation and prevent unsupported resource reallocation',
          caveat: 'Observed point-in-time enrollment change—not people losing access, reduced need, or budget savings.',
          confidence: 'OBSERVED CHANGE · CAUSAL AND BUDGET VALIDATION REQUIRED',
        },
      },
      'fl-gap-closure-plan': {
        title: 'Close the governed source and reconciliation gaps',
        summary: 'Data stewardship should assign every current gap an owner, permission path, parameter decision or reconciliation test.',
        expectedImpact: 'Raises governed source coverage while preventing unavailable values from silently becoming assumptions.',
        estimatedSavings: 'No savings claim. Measure avoided manual reconciliation and decision rework after gap closure.',
        opportunity: {
          absoluteHeading: 'Governed gap workload',
          absoluteValue: `${FL_OPERATIONAL_SOURCES.gaps?.length || 0} gaps`,
          absoluteLabel: 'current permission, parameter and reconciliation gaps with explicit unblock paths',
          improvementHeading: 'Current source hydration',
          improvementValue: `${totalCoveragePercent}%`,
          improvementLabel: `${totalHydratedSources} of ${totalGovernedSources} governed AHCA and federal sources hydrated`,
          calculationBasis: `${totalHydratedSources} hydrated sources ÷ ${totalGovernedSources} governed sources = ${totalCoveragePercent}%; ${FL_OPERATIONAL_SOURCES.gaps?.length || 0} gap records remain for permission, parameter or reconciliation disposition.`,
          analyzed: `${publicSourceCount} AHCA dashboard/publication sources, ${federalSources.length} federal sources, and all current gap records`,
          finding: `${totalHydratedSources} sources are hydrated while export-disabled and reconciliation limitations remain explicit`,
          potential: 'move toward complete governed coverage without bypassing publisher controls or fabricating restricted values',
          caveat: 'Source-coverage benefit—not a program outcome or savings forecast.',
          confidence: 'VERIFIED SOURCE COVERAGE · EXTERNAL PERMISSION MAY BE REQUIRED',
        },
      },
    },
  },
};

for (const goalItem of FL_OPERATIONAL_GOALS) {
  const refresh = opportunityModelRefresh[goalItem.id];
  if (!refresh) continue;
  goalItem.leadValue = refresh.leadValue;
  goalItem.leadLabel = refresh.leadLabel;
  for (const actionItem of goalItem.cases[0].actions) {
    const actionRefresh = refresh.actions[actionItem.id];
    if (!actionRefresh) continue;
    Object.assign(actionItem, actionRefresh, { opportunity: actionRefresh.opportunity });
  }
}

export const FL_SOURCE_HEALTH = {
  hydrated: FL_OPERATIONAL_SOURCES.sources?.filter((item) => item.status === 'REAL data hydrated').length || 0,
  totalHydrated: totalHydratedSources,
  totalGoverned: totalGovernedSources,
  totalCoveragePercent,
  gaps: FL_OPERATIONAL_SOURCES.gaps?.length || 0,
  generatedAt: FL_OPERATIONAL_SOURCES.generatedAt,
  qualityExportAllowed: source('FL_AHCA_QUALITY')?.exportAllowed === true,
  malpracticeExportAllowed: source('FL_AHCA_MALPRACTICE')?.exportAllowed === true,
};
