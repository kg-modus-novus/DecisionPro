import { FL_OPERATIONAL_SOURCES } from './alp/flOperationalSources.js';

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
