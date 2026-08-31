import { KY_OPERATIONAL_SOURCES } from './alp/kyOperationalSources.js';
import { KY_RECOVERY_RECONCILIATION, recoveryReconciliationTotals } from './alp/kyRecoveryReconciliation.js';
import { FEDERAL_AWARD_GRAIN } from './alp/federalAwardGrain.js';
import { ORGANIZATION_CROSSWALK } from './alp/organizationCrosswalk.js';
import { NONPROFIT_FINANCIALS } from './alp/nonprofitFinancials.js';
import { FACILITY_FINANCIAL_DISTRESS } from './alp/facilityFinancialDistress.js';
import { OWNERSHIP_NETWORK } from './alp/ownershipNetwork.js';
import { SUBAWARD_FLOW_GRAPH } from './alp/subawardFlowGraph.js';
import { PROGRAM_HORIZON_EVENTS } from './alp/programHorizonEvents.js';

const metrics = new Map(
  (KY_OPERATIONAL_SOURCES.metrics || []).map((metric) => [metric.metricId, metric]),
);

function metric(id, fallback) {
  const found = metrics.get(id);
  return {
    value: found?.displayValue ?? fallback,
    asOf: found?.asOfDate ?? 'See source record',
    status: found?.sourceStatus ?? 'GAP',
    limitation: found?.provenance?.limitation || 'Validate the source grain and period before use.',
  };
}

const overpayments = metric('ky-mcpar-reported-overpayments', '$5.1M');
const encounterTimeliness = metric('ky-mcpar-min-encounter-timeliness', '74.0%');
const lowRatedFacilities = metric('ky-provider-low-rating', '103');
const nursingFacilities = metric('ky-provider-facilities', '267');
const hospitalBeds = metric('ky-hospital-beds', '18,937');
const hospitalCounties = metric('ky-hospital-counties', '79');
const leieRows = metric('ky-leie-records', '1,755');
const federalObligations = metric('ky-usaspending-latest-complete-fy', '$15.5B');
const budgetDocuments = metric('ky-budget-documents', '7');
const contractDocuments = metric('ky-contract-documents', '5');
const kyOwnership = OWNERSHIP_NETWORK.byState.KY;
const kyOwnershipAsOf = kyOwnership.metrics['ofr-ownership-chain-count']?.asOfDate || 'See source record';
const kyCrosswalk = ORGANIZATION_CROSSWALK.byState.KY;
const kyCrosswalkAsOf = kyCrosswalk.metrics['ofr-crosswalk-identity-records']?.asOfDate || 'See source record';
const kyAwardGrain = FEDERAL_AWARD_GRAIN.byState.KY;
const kyAwardCliff0to6 = kyAwardGrain.fundingCliffCalendar.buckets.find((bucket) => bucket.bucketId === '0-6mo');
const kyAwardCliff6to12 = kyAwardGrain.fundingCliffCalendar.buckets.find((bucket) => bucket.bucketId === '6-12mo');
const kyAwardSingleStream = kyAwardGrain.singleStreamDependency;
const kyAwardAsOf = kyAwardGrain.metrics['ofr-award-count']?.asOfDate || 'See source record';
const kyFacilityDistress = FACILITY_FINANCIAL_DISTRESS.byState.KY;
const kyFacilityDistressAsOf = kyFacilityDistress.metrics['ofr-hcris-facility-count']?.asOfDate || 'See source record';
const kySubaward = SUBAWARD_FLOW_GRAPH.byState.KY;
const kySubawardAsOf = kySubaward.metrics['ofr-subaward-edge-count']?.asOfDate || 'See source record';
const kyHorizon = PROGRAM_HORIZON_EVENTS.byState.KY;
const kyHorizonAsOf = kyHorizon.metrics['ofr-horizon-waiver-expiration-count']?.asOfDate || 'See source record';
const kyHorizonExpirations = kyHorizon.events.items.filter((event) => event.eventType === 'waiver_expiration');
const kyHorizonNofos = kyHorizon.events.items.filter((event) => event.eventType === 'nofo_opportunity' && event.eventDateKind === 'open_date');
const kyNonprofit = NONPROFIT_FINANCIALS.byState.KY;
const kyNonprofitAsOf = kyNonprofit.metrics['ofr-nonprofit-filings-count']?.asOfDate || 'See source record';
const recoveryTotals = recoveryReconciliationTotals(KY_RECOVERY_RECONCILIATION.rows);
const millions = (value) => `$${(value / 1_000_000).toFixed(2)}M`;
const recoveryPlanningRange = `${millions(recoveryTotals.reportedCandidate * KY_RECOVERY_RECONCILIATION.planningEstimate.lowRecoveryRate)}–${millions(recoveryTotals.reportedCandidate * KY_RECOVERY_RECONCILIATION.planningEstimate.highRecoveryRate)}`;
const recoveryCandidatePool = millions(recoveryTotals.reportedCandidate);
const numericMetric = (item) => Number(String(item.value).replace(/[^0-9.-]/g, '')) || 0;
const percent = (part, whole) => `${((part / whole) * 100).toFixed(1)}%`;
const countyReviewCount = Math.ceil(numericMetric(hospitalCounties) * 0.15);
const countyPilotCount = Math.max(1, Math.round(countyReviewCount * 0.25));
const facilityReviewCount = Math.ceil(numericMetric(lowRatedFacilities) * 0.20);
const facilityRemedyCount = Math.max(1, Math.round(facilityReviewCount * 0.50));
const encounterPlanningTarget = 90;
const encounterBaseline = numericMetric(encounterTimeliness);
const encounterPointGain = encounterPlanningTarget - encounterBaseline;
const loadedDocumentCount = numericMetric(budgetDocuments) + numericMetric(contractDocuments);
const recurringPlanningBase = recoveryTotals.reportedCandidate * KY_RECOVERY_RECONCILIATION.planningEstimate.planningRecoveryRate;

const OPPORTUNITY_BENEFITS = {
  'validate-recovery-ledger': {
    absoluteValue: recoveryPlanningRange,
    absoluteLabel: 'modeled recoverable-dollar sensitivity range',
    improvementValue: '10%–50%',
    improvementLabel: 'of the reported candidate pool reconciled as recoverable',
    calculationBasis: `${recoveryCandidatePool} reported candidate pool × 10%–50% sensitivity; not confirmed savings.`,
  },
  'strengthen-repeat-controls': {
    absoluteValue: `${millions(recurringPlanningBase * 0.10)}–${millions(recurringPlanningBase * 0.25)}`,
    absoluteLabel: 'modeled repeat-loss exposure avoided',
    improvementValue: '10%–25%',
    improvementLabel: 'modeled reduction in validated recurring loss',
    calculationBasis: `${millions(recurringPlanningBase)} planning recovery case × 10%–25% recurrence-reduction target; usable only if recurring loss is validated.`,
  },
  'request-network-evidence': {
    absoluteValue: `${countyReviewCount} counties`,
    absoluteLabel: 'moved from capacity signal to validated access decision',
    improvementValue: percent(countyReviewCount, numericMetric(hospitalCounties)),
    improvementLabel: `of the current ${hospitalCounties.value}-county observed layer reviewed`,
    calculationBasis: `First review tranche = 15% of ${hospitalCounties.value} counties represented, rounded up; this measures decision coverage, not access restored.`,
  },
  'capacity-remediation-options': {
    absoluteValue: `${countyPilotCount} county-service gaps`,
    absoluteLabel: 'targeted for restored access in the first pilot',
    improvementValue: percent(countyPilotCount, countyReviewCount),
    improvementLabel: `of the ${countyReviewCount}-county validation tranche remediated`,
    calculationBasis: `Planning pilot = 25% of the ${countyReviewCount}-county review tranche; replace with the validated gap count before authorization.`,
  },
  'facility-validation-queue': {
    absoluteValue: `${facilityReviewCount} facilities`,
    absoluteLabel: 'targeted for corroborated quality review',
    improvementValue: percent(facilityReviewCount, numericMetric(lowRatedFacilities)),
    improvementLabel: `of the ${lowRatedFacilities.value} currently flagged facilities reviewed`,
    calculationBasis: `First monthly review tranche = 20% of ${lowRatedFacilities.value} facilities with 1–2 overall stars, rounded up; validation is not an adverse finding.`,
  },
  'quality-improvement-path': {
    absoluteValue: `${facilityRemedyCount} facilities`,
    absoluteLabel: 'targeted to reach verified remedy milestones',
    improvementValue: percent(facilityRemedyCount, facilityReviewCount),
    improvementLabel: `of the first ${facilityReviewCount}-facility review tranche`,
    calculationBasis: `Planning target = 50% of the ${facilityReviewCount}-facility validation tranche, rounded; replace with measured milestone completion after intervention.`,
  },
  'encounter-corrective-file': {
    absoluteValue: `+${encounterPointGain.toFixed(1)} points`,
    absoluteLabel: `modeled timeliness gain to a ${encounterPlanningTarget}% planning target`,
    improvementValue: percent(encounterPointGain, encounterBaseline),
    improvementLabel: `relative improvement from the ${encounterTimeliness.value} observed baseline`,
    calculationBasis: `${encounterPlanningTarget}% planning target − ${encounterTimeliness.value} observed minimum = ${encounterPointGain.toFixed(1)} percentage points; 90% is a scenario, not a verified contractual threshold.`,
  },
  'hold-dependent-measures': {
    absoluteValue: '0 unsupported releases',
    absoluteLabel: 'target while material data dependencies remain unresolved',
    improvementValue: '100%',
    improvementLabel: 'of materially affected measures labeled or held',
    calculationBasis: 'Governance target: every materially affected measure receives a limitation label or hold before release; actual count depends on the dependency trace.',
  },
  'authorized-match-review': {
    absoluteValue: `${leieRows.value} records`,
    absoluteLabel: 'aggregate candidate workload dispositioned in the authorized system',
    improvementValue: '100%',
    improvementLabel: 'of the current aggregate candidate workload reviewed',
    calculationBasis: `${leieRows.value} Kentucky-address LEIE rows ÷ ${leieRows.value} current rows = 100% review-completion target; rows are not verified matches.`,
  },
  'screening-control-review': {
    absoluteValue: '1 complete cycle',
    absoluteLabel: 'tested from required event through resolved exception',
    improvementValue: '100%',
    improvementLabel: 'required-event screening coverage target',
    calculationBasis: 'Control target: screened required events ÷ all required events = 100%; DecisionPro needs the authorized event denominator to measure actual performance.',
  },
  'authorize-transaction-feed': {
    absoluteValue: '1 complete fiscal period',
    absoluteLabel: 'reconciled from governed payment feed to accounting control total',
    improvementValue: '100%',
    improvementLabel: 'first-period reconciliation coverage target',
    calculationBasis: 'Acceptance target: reconciled dollars ÷ accounting control total = 100% for one complete period before analytical use.',
  },
  'prepare-budget-baseline': {
    absoluteValue: `${loadedDocumentCount} documents`,
    absoluteLabel: 'loaded budget and contract documents reconciled into the baseline',
    improvementValue: '100%',
    improvementLabel: 'coverage of the currently loaded document set',
    calculationBasis: `${budgetDocuments.value} loaded budget documents + ${contractDocuments.value} loaded contract documents = ${loadedDocumentCount}; this is not the full authoritative document universe.`,
  },
};

function input({ id, title, value, summary, sources, asOf, impact, limitation }) {
  return {
    id,
    kind: 'input',
    title,
    value,
    summary,
    sources,
    asOf,
    impact,
    limitation,
  };
}

function transformation({ id, title, summary, method, impact, limitation }) {
  return {
    id,
    kind: 'transformation',
    title,
    summary,
    method,
    impact,
    limitation,
  };
}

function action({
  id,
  deliverableId,
  title,
  reviewPriority,
  implementationPriority,
  summary,
  owner,
  authority,
  expectedImpact,
  timeHorizon,
  how,
  estimatedCost,
  estimatedSavings,
  prerequisites,
  successMeasures,
  guardrail,
  opportunity,
}) {
  return {
    id,
    deliverableId,
    kind: 'action',
    title,
    reviewPriority,
    implementationPriority,
    summary,
    owner,
    authority,
    expectedImpact,
    timeHorizon,
    how,
    estimatedCost,
    estimatedSavings,
    prerequisites,
    successMeasures,
    guardrail,
    opportunity: {
      ...OPPORTUNITY_BENEFITS[id],
      ...(opportunity || {}),
    },
  };
}

export function rankRecommendationsForReview(actions = []) {
  return [...actions].sort((left, right) => {
    const priorityDifference = Number(left.reviewPriority) - Number(right.reviewPriority);
    return priorityDifference || left.title.localeCompare(right.title);
  });
}

export const KY_OPERATIONAL_GOALS = [
  {
    id: 'optimize-spending',
    label: 'Optimize Spending',
    objective: 'Find recoverable, avoidable, idle, or misallocated dollars without treating variance as proof of waste.',
    leadValue: overpayments.value,
    leadLabel: 'plan-reported overpayment signal',
    reviewPriority: 1,
    readiness: 'Validate before implementation',
    cases: [
      {
        id: 'overpayment-reconciliation',
        title: 'Reconcile plan-reported overpayments to contracts and recoveries',
        question: 'Are reported overpayments already recovered, still outstanding, or not comparable at the available grain?',
        confidence: 'Moderate · official annual report, reconciliation pending',
        impactLenses: ['Spending', 'Contract administration', 'Program integrity'],
        inputs: [
          input({
            id: 'overpayment-input',
            title: 'Plan-reported overpayments',
            value: overpayments.value,
            summary: 'Annual MCPAR dollars reported by Kentucky managed-care reporting entities.',
            sources: ['CMS_MCPAR_2024'],
            asOf: overpayments.asOf,
            impact: 'May identify recoveries, accounting mismatches, or repeat control failures requiring review.',
            limitation: overpayments.limitation,
          }),
          input({
            id: 'contract-input',
            title: 'Current MCO contract documents',
            value: contractDocuments.value,
            summary: 'Effective contract and amendment documents available for obligation and remedy research.',
            sources: ['KY_DMS_CONTRACTS'],
            asOf: contractDocuments.asOf,
            impact: 'Establishes the controlling obligation, reporting requirement, and available remedy.',
            limitation: 'Document indexing does not prove that a clause applies to a specific plan, period, or dollar.',
          }),
          input({
            id: 'payment-gap-input',
            title: 'State payment-to-contract detail',
            value: 'Required feed',
            summary: 'Transaction-grain reconciliation data is not available through a supported Kentucky bulk API.',
            sources: ['KY_TRANSPARENCY'],
            asOf: 'Current labeled gap',
            impact: 'Blocks a defensible outstanding-balance or realized-savings conclusion.',
            limitation: 'A governed export or authorized operator extract is required.',
          }),
        ],
        transformations: [
          transformation({
            id: 'align-plan-period',
            title: 'Align plan, program, contract and period',
            summary: 'Maps each MCPAR reporting entity and reporting year to the effective contract record.',
            method: 'Normalize entity aliases, program membership, contract effective dates and annual reporting periods; reject ambiguous joins.',
            impact: 'Prevents assigning reported dollars to the wrong plan, program, or contract term.',
            limitation: 'The public annual file cannot supply transaction-level recovery status.',
          }),
          transformation({
            id: 'classify-recovery-status',
            title: 'Classify reconciliation status',
            summary: 'Separates reported, validated, recovered, outstanding and non-comparable amounts.',
            method: 'Require a source-backed recovery record and reviewer confirmation before advancing a dollar from reported to validated or recovered.',
            impact: 'Converts a headline amount into a controlled recovery-review queue.',
            limitation: 'Until the payment feed is available, items remain candidates rather than findings.',
          }),
        ],
        actions: [
          action({
            id: 'validate-recovery-ledger',
            deliverableId: 'ky-recovery-reconciliation',
            title: 'Open a plan-by-plan recovery reconciliation',
            reviewPriority: 1,
            implementationPriority: 'Ready to investigate',
            summary: 'DecisionPro has prepared the six-plan public-source reconciliation; DMS reviews and confirms which reported amounts are recovered, outstanding, duplicated, disputed, or non-actionable.',
            owner: 'DMS program integrity lead, supported by contract management and agency finance',
            authority: 'Applicable MCO reporting, audit and recovery provisions; verify exact clause before action.',
            expectedImpact: 'Produces a defensible recovery list, prevents duplicate collection, and identifies control failures that may be allowing repeat overpayments.',
            timeHorizon: '30–60 days after the recovery ledger and contract crosswalk are available',
            how: ['Match each MCPAR amount to the plan, program, contract and reporting period.', 'Compare the candidate amount with the authorized recovery ledger or payment extract.', 'Have a named reviewer classify it as recovered, outstanding, duplicate or non-actionable.', 'Route confirmed outstanding amounts through the applicable contract recovery process.'],
            estimatedCost: 'Not yet costed. Primary cost is DMS, contract and finance staff review plus any work needed to produce the authorized payment extract.',
            estimatedSavings: `Up to ${overpayments.value} is the reported candidate pool—not a savings forecast. Net recoverable dollars remain unknown until reconciliation.`,
            prerequisites: ['Entity/contract crosswalk', 'Authorized recovery ledger or payment extract', 'Named reviewer'],
            successMeasures: ['Candidate dollars reconciled', 'Confirmed outstanding amount', 'Recovery-cycle time'],
            guardrail: 'Do not characterize the reported amount as waste, savings, debt, or misconduct before reconciliation.',
            opportunity: {
              headline: 'Potential recovery opportunity',
              analyzed: `six Kentucky plan reports containing ${recoveryCandidatePool} in reported overpayment candidates`,
              finding: 'The reported candidate pool has not yet been reconciled to authorized recovery records.',
              potential: 'Produce a defensible recovery list and route any confirmed outstanding dollars through the applicable contract process.',
              confidence: 'Modeled from a 10%–50% sensitivity range',
              caveat: 'Planning range—not confirmed savings.',
            },
          }),
          action({
            id: 'strengthen-repeat-controls',
            title: 'Examine repeat control failures after reconciliation',
            reviewPriority: 2,
            implementationPriority: 'Conditional',
            summary: 'DMS contract management should correct the process that caused any validated overpayment pattern to recur.',
            owner: 'DMS contract management lead, supported by program integrity and legal counsel',
            authority: 'Contract remedies and corrective-action authority, subject to verified applicability.',
            expectedImpact: 'Reduces repeat overpayments and repeat reconciliation effort while preserving plan due process.',
            timeHorizon: '60–120 days after a recurring root cause is validated',
            how: ['Group validated cases by root cause and applicable contract clause.', 'Compare process correction, reporting change, corrective-action plan and contractual remedy options.', 'Select the least disruptive control that prevents recurrence and assign a completion date.', 'Measure recurrence after the control is operating.'],
            estimatedCost: 'Not yet estimated; depends on whether the remedy is an internal control change, plan system change, audit, or formal contract action.',
            estimatedSavings: 'Cannot be estimated until the recurring validated dollar amount and expected reduction rate are known.',
            prerequisites: ['Validated recurring issue', 'Root-cause analysis', 'Legal/contract review'],
            successMeasures: ['Repeat finding rate', 'Control completion', 'Validated recoveries'],
            guardrail: 'Remedy selection follows verified facts and authority; the dashboard does not prescribe sanctions.',
            opportunity: {
              headline: 'Prevent repeat overpayments',
              analyzed: 'validated recovery cases, contract obligations, and repeat control patterns',
              finding: 'Recurring root causes can be isolated after the recovery reconciliation establishes which cases are valid.',
              potential: 'Reduce future overpayments and the staff effort required to reconcile the same failure repeatedly.',
              confidence: 'Conditional on validated recurring cases',
              caveat: 'No dollar estimate until recurring validated amounts and an expected reduction rate exist.',
            },
          }),
        ],
      },
    ],
  },
  {
    id: 'improve-coverage',
    label: 'Improve Coverage & Access',
    objective: 'Identify geographic or capacity constraints that could prevent people from reaching needed services.',
    leadValue: hospitalCounties.value,
    leadLabel: 'counties represented in hospital layer',
    reviewPriority: 2,
    readiness: 'Capacity context hydrated',
    cases: [
      {
        id: 'capacity-access-validation',
        title: 'Validate county-level facility capacity and access gaps',
        question: 'Where does published capacity appear thin, and what additional network and travel-time evidence is required?',
        confidence: 'Moderate · facility capacity is public; Medicaid network sufficiency is incomplete',
        impactLenses: ['People', 'Services', 'Provider capacity', 'Districts'],
        inputs: [
          input({ id: 'hospital-beds', title: 'Published licensed hospital beds', value: hospitalBeds.value, summary: 'Licensed-bed capacity from Kentucky hospital GIS.', sources: ['KY_OPEN_GIS'], asOf: hospitalBeds.asOf, impact: 'Provides a statewide capacity baseline for service planning.', limitation: 'Licensed beds do not prove staffed beds, availability, utilization, or Medicaid participation.' }),
          input({ id: 'hospital-counties', title: 'Counties represented', value: hospitalCounties.value, summary: 'Distinct county coverage in the published hospital layer.', sources: ['KY_OPEN_GIS'], asOf: hospitalCounties.asOf, impact: 'Highlights where facility presence requires closer access review.', limitation: 'County presence is not a travel-time or network-adequacy result.' }),
          input({ id: 'nursing-facilities', title: 'Kentucky nursing facilities', value: nursingFacilities.value, summary: 'CMS-certified nursing facilities in Kentucky.', sources: ['CMS_PROVIDER_DATA'], asOf: nursingFacilities.asOf, impact: 'Adds long-term-care capacity and quality context.', limitation: 'Certification data is not current Medicaid network participation or vacancy data.' }),
        ],
        transformations: [
          transformation({ id: 'county-capacity-profile', title: 'Build county capacity profiles', summary: 'Normalizes facilities and beds to county and service-type context.', method: 'Deduplicate facility identity, geocode to county, group by facility/service type, and preserve reporting dates.', impact: 'Makes uneven capacity visible without treating raw counts as access.', limitation: 'Population need, staffed capacity, travel time and network participation remain required.' }),
          transformation({ id: 'access-evidence-gate', title: 'Apply the access-evidence gate', summary: 'Labels apparent gaps as validate, monitor, or supported for action.', method: 'Require aligned population, network, travel-time and service-availability evidence before declaring an access gap.', impact: 'Protects people and providers from decisions based on incomplete capacity proxies.', limitation: 'The current public bundle cannot independently establish network adequacy.' }),
        ],
        actions: [
          action({ id: 'request-network-evidence', title: 'Validate possible county access gaps', reviewPriority: 1, implementationPriority: 'Ready to investigate', summary: 'DMS network oversight should determine whether counties flagged by facility data actually have a Medicaid access problem.', owner: 'DMS network oversight lead, supported by MCO network managers and a geospatial analyst', authority: 'Network reporting and access-monitoring authority; verify plan and service applicability.', expectedImpact: 'Directs remediation to verified access problems and avoids spending money where facility counts only created a false signal.', timeHorizon: '6–10 weeks after current plan rosters and appointment data are received', how: ['Rank counties by facility, bed and service-capacity signals.', 'Obtain current plan rosters, appointment availability, travel-time and population-need data.', 'Test each county by plan and service against the applicable access standard.', 'Publish a validated gap list with responsible plan, affected service and evidence date.'], estimatedCost: 'Not yet costed. Expected inputs are analyst time plus plan-reported network and appointment data; price any new survey or travel-time tooling before approval.', estimatedSavings: 'No direct savings forecast. Benefit is better-targeted network spending and avoided remediation in counties where no gap is validated.', prerequisites: ['County population need', 'Plan network roster', 'Travel-time and appointment evidence'], successMeasures: ['Validated gaps', 'Appointment availability', 'Travel-time compliance', 'Capacity restored'], guardrail: 'Do not infer inadequate access from facility counts or county absence alone.' }),
          action({ id: 'capacity-remediation-options', title: 'Implement the least-cost option for each validated service gap', reviewPriority: 2, implementationPriority: 'Conditional', summary: 'DMS program operations should choose and pilot the least-cost remedy that restores the specific service people cannot reach.', owner: 'DMS program operations lead, with network oversight, procurement and affected MCOs', authority: 'Program, procurement, rate and contract authority as applicable.', expectedImpact: 'Improves timely access while matching spending to the real constraint instead of applying a statewide remedy.', timeHorizon: '60–180 days after the access gap is validated', how: ['Define the affected service, population, geography and access standard.', 'Price contracting, mobile service, telehealth, transportation and targeted rate options.', 'Score options on access gained, time to deploy, workforce feasibility, quality and cost.', 'Pilot the preferred option and expand only if access and quality measures improve.'], estimatedCost: 'Option-specific and not yet estimated; the decision package must include one-time and recurring costs for every viable remedy.', estimatedSavings: 'No defensible savings estimate yet. Quantify avoided emergency use, travel support or excess rate expense only after a baseline and pilot result exist.', prerequisites: ['Validated service gap', 'Cost and workforce analysis', 'Equity and quality safeguards'], successMeasures: ['Access restored', 'Utilization change', 'Quality balancing measures'], guardrail: 'A capacity intervention should not reduce quality, continuity, or fiscal sustainability.' }),
        ],
      },
      {
        id: 'facility-closure-risk-watchlist',
        title: 'Review county-level facility financial-distress signals from CMS cost reports',
        question: 'Which counties have hospitals or nursing facilities with a negative Medicare-cost-report margin, worth a continuity-review look before an access problem develops?',
        confidence: 'Low–moderate · Medicare cost-report basis, sampled live re-verification; not a closure prediction',
        impactLenses: ['Access', 'Facilities', 'Budget'],
        inputs: [
          input({ id: 'hcris-negative-margin', title: 'Facility-years with a negative total margin', value: kyFacilityDistress.metrics['ofr-hcris-negative-margin-count']?.displayValue || 'Not available', summary: 'CMS HCRIS hospital and SNF cost-report filings with net income below zero relative to total income, Medicare cost-report basis.', sources: ['CMS_HCRIS'], asOf: kyFacilityDistressAsOf, impact: 'A standard financial-margin indicator computed the same way for every filer.', limitation: 'A single negative-margin year is not evidence of impending closure; many facilities operate below breakeven in a given year without ceasing operations.' }),
          input({ id: 'hcris-watchlist-counties', title: 'Counties with at least one negative-margin facility', value: kyFacilityDistress.metrics['ofr-hcris-watchlist-county-count']?.displayValue || 'Not available', summary: 'Bounds the county-level review workload to a specific, reproducible signal.', sources: ['CMS_HCRIS'], asOf: kyFacilityDistressAsOf, impact: 'Not yet joined to eligible-population ratios (would require Census/HRSA data not wired into this package) — a facility-count and margin signal only.', limitation: 'County facility counts are not staffed capacity or network adequacy; see the existing Improve Coverage & Access validation case for that distinction.' }),
          input({ id: 'hcris-medicaid-day-share', title: 'Median share of patient days billed to Medicaid', value: kyFacilityDistress.metrics['ofr-hcris-median-medicaid-day-share']?.displayValue || 'Not available', summary: 'Median Title XIX share of total patient days across loaded Kentucky hospital and SNF cost reports.', sources: ['CMS_HCRIS'], asOf: kyFacilityDistressAsOf, impact: 'Flags facilities most exposed to Medicaid rate or policy changes, for cross-reference with the negative-margin watchlist.', limitation: 'Medicare cost-report basis; not Medicaid payment truth or a state accounting figure.' }),
        ],
        transformations: [
          transformation({ id: 'hcris-live-sample-reconciliation', title: 'Reconcile a sampled facility-year against a live re-fetch', summary: 'Every gate run re-verifies one sampled facility\'s total costs against a freshly re-fetched CMS HCRIS API row.', method: 'Pick one loaded CCN, re-query the same CMS data-api/v1 dataset live, and confirm the stored total_costs value reproduces exactly.', impact: 'Catches drift between the retained cost-report facts and the current published source before it reaches a reviewer.', limitation: 'Only one facility is sampled per gate run, not the full loaded set.' }),
          transformation({ id: 'hcris-county-rollup', title: 'Roll facility-level margin signals up to the county', summary: 'Aggregates facility count, negative-margin count, total beds, and uncompensated care by county for a bounded review watchlist.', method: 'Group loaded Kentucky facility-years by the CMS-reported county field; a county enters the watchlist only if at least one facility has a negative margin.', impact: 'Turns a flat facility list into a county-level review starting point.', limitation: 'County assignment follows the CMS filing, not a DMS region or Census geography crosswalk.' }),
        ],
        actions: [
          action({ id: 'review-facility-closure-risk-watchlist', title: 'Route negative-margin facility-years to a continuity-review queue', reviewPriority: 2, implementationPriority: 'Ready to investigate', summary: 'Facility oversight and network adequacy staff should review the negative-margin watchlist as a continuity-planning prompt, not a distress determination.', owner: 'DMS facility oversight, with network adequacy and Medicaid finance', authority: 'Program oversight authority; no adverse action authority implied.', expectedImpact: 'Surfaces facilities and counties worth a closer continuity-planning look before an access problem develops.', timeHorizon: '4–8 weeks for the initial review pass', how: ['Pull the negative-margin facility list and county rollup from the Funding & Resilience Evidence Room.', 'Cross-reference against known network-adequacy or licensure concerns for the same facility.', 'Record reviewed, no-action, or continuity-plan-opened status back into the review record.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is earlier continuity-planning visibility, not a dollar saving.', prerequisites: ['Access to the Funding & Resilience Evidence Room facility list'], successMeasures: ['Facilities reviewed', 'Continuity plans opened where warranted', 'False-flag rate'], guardrail: 'A negative margin is a review prompt only; never describe it as impending closure, financial distress, or a finding without independent verification.', opportunity: { absoluteValue: `${kyFacilityDistress.metrics['ofr-hcris-negative-margin-count']?.displayValue || '0'} facility-years`, absoluteLabel: 'negative-margin facility-years flagged for continuity review', improvementValue: '100%', improvementLabel: 'of flagged facility-years reviewed', calculationBasis: `${kyFacilityDistress.metrics['ofr-hcris-negative-margin-count']?.displayValue || '0'} Kentucky hospital/SNF cost-report filings with a negative total margin; reviewing all of them is the coverage target, not a savings forecast.` } }),
          action({ id: 'cross-reference-medicaid-exposure-watchlist', title: 'Cross-reference high Medicaid-day-share facilities with the negative-margin watchlist', reviewPriority: 3, implementationPriority: 'Ready to investigate', summary: 'Medicaid finance should identify facilities with both a high Medicaid patient-day share and a negative margin, since the two signals together are a stronger continuity-planning prompt than either alone.', owner: 'DMS Medicaid finance, with facility oversight', authority: 'Program oversight authority; no rate-setting or adverse action authority implied.', expectedImpact: 'Concentrates continuity-planning attention on facilities most exposed to both Medicaid funding and financial-margin pressure.', timeHorizon: '4–8 weeks, aligned with the facility-review cycle', how: ['Pull the negative-margin list and rank by Medicaid day share.', 'Confirm current Medicaid participation status for each matched facility.', 'Prioritize matched facilities for the continuity-planning queue.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is earlier, better-targeted continuity-planning visibility.', prerequisites: ['Negative-margin watchlist', 'Medicaid day-share metric'], successMeasures: ['Facilities matched', 'Continuity plans opened where warranted'], guardrail: 'A margin and Medicaid-exposure combination is still a review prompt, not a prediction that a facility will close or reduce services.', opportunity: { absoluteValue: `${kyFacilityDistress.metrics['ofr-hcris-median-medicaid-day-share']?.displayValue || '0%'}`, absoluteLabel: 'median Medicaid patient-day share among loaded Kentucky facilities', improvementValue: '100%', improvementLabel: 'of matched high-exposure, negative-margin facilities reviewed', calculationBasis: 'Cross-referencing the negative-margin watchlist against Medicaid day share is the review target, not a risk score.' } }),
        ],
      },
    ],
  },
  {
    id: 'identify-gaps',
    label: 'Identify Quality Gaps',
    objective: 'Find deteriorating quality signals and distinguish provider performance from capacity and population effects.',
    leadValue: lowRatedFacilities.value,
    leadLabel: 'facilities with 1–2 overall stars',
    reviewPriority: 1,
    readiness: 'Quality signal hydrated',
    cases: [
      {
        id: 'low-rated-facility-review',
        title: 'Review low-rated nursing facilities with local capacity context',
        question: 'Which low ratings are persistent and material, and what service consequences could remediation or capacity loss create?',
        confidence: 'Moderate · published quality context, Medicaid-specific causality not established',
        impactLenses: ['Quality', 'People', 'Long-term care', 'Capacity'],
        inputs: [
          input({ id: 'low-rated-count', title: 'Facilities with 1–2 overall stars', value: lowRatedFacilities.value, summary: 'Kentucky facilities with published CMS overall ratings of one or two stars.', sources: ['CMS_PROVIDER_DATA'], asOf: lowRatedFacilities.asOf, impact: 'Identifies facilities requiring quality and capacity context review.', limitation: lowRatedFacilities.limitation }),
          input({ id: 'facility-universe', title: 'Kentucky nursing-facility universe', value: nursingFacilities.value, summary: 'The statewide certified-facility denominator used for context.', sources: ['CMS_PROVIDER_DATA'], asOf: nursingFacilities.asOf, impact: 'Prevents presenting the flagged count without its facility universe.', limitation: 'Certification status and ratings can change between refreshes.' }),
        ],
        transformations: [
          transformation({ id: 'rating-persistence', title: 'Test rating persistence and components', summary: 'Separates a single published rating from sustained or multi-component deterioration.', method: 'Align refresh periods and compare overall, staffing, inspection, penalty and ownership context where available.', impact: 'Directs review toward persistent, corroborated signals.', limitation: 'Ratings are screening context, not a finding about every resident or service.' }),
          transformation({ id: 'quality-capacity-balance', title: 'Balance quality and local capacity', summary: 'Examines whether an intervention could worsen an existing access constraint.', method: 'Join facility identity and county capacity context; require a continuity assessment for consequential options.', impact: 'Protects residents from quality remedies that unintentionally reduce needed access.', limitation: 'Resident-level outcomes and current occupancy are not present.' }),
        ],
        actions: [
          action({ id: 'facility-validation-queue', title: 'Validate persistent quality problems before intervening', reviewPriority: 1, implementationPriority: 'Ready to investigate', summary: 'Facility quality oversight should identify which low-rated facilities have persistent, corroborated problems that require follow-up.', owner: 'Facility quality oversight lead, supported by Medicaid quality and local capacity analysts', authority: 'Applicable certification, quality-improvement and Medicaid oversight authority.', expectedImpact: 'Concentrates review on sustained problems while protecting residents from abrupt action based on one rating snapshot.', timeHorizon: '4–6 weeks, aligned with the next monthly quality review', how: ['Refresh rating, inspection, staffing, penalty and ownership data.', 'Flag facilities with persistent or multi-component deterioration.', 'Assess local capacity and resident-continuity risk before recommending action.', 'Assign validated facilities to an authorized reviewer with a response date.'], estimatedCost: 'Not yet costed; primarily staff review using existing public data, with additional survey expense only if the authorized reviewer determines it is necessary.', estimatedSavings: 'No direct savings forecast. Expected value is earlier remediation and avoidance of preventable quality deterioration or disruptive capacity loss.', prerequisites: ['Latest rating components', 'Ownership and penalty context', 'Capacity/continuity assessment'], successMeasures: ['Validated cases', 'Remediation cycle time', 'Quality trend', 'Continuity preserved'], guardrail: 'A low star rating is not by itself proof of harm, fraud, or a basis for adverse action.' }),
          action({ id: 'quality-improvement-path', title: 'Apply the least-disruptive effective quality remedy', reviewPriority: 2, implementationPriority: 'Conditional', summary: 'Facility regulation and Medicaid quality leaders should select a remedy matched to each validated deficiency pattern and continuity risk.', owner: 'Facility regulation lead and Medicaid quality leadership, with provider participation', authority: 'Verified facility and program authority.', expectedImpact: 'Improves care quality while minimizing avoidable resident transfers and local capacity disruption.', timeHorizon: '90–180 days after the deficiency pattern is validated', how: ['Document the deficiency pattern, risk and provider response.', 'Compare technical assistance, corrective plan, increased monitoring and authorized remedy options.', 'Select the least-disruptive option likely to correct the problem and set milestones.', 'Escalate only when milestones fail or verified risk requires faster action.'], estimatedCost: 'Remedy-specific and not yet estimated; price agency monitoring, provider corrective work and any continuity support before approval.', estimatedSavings: 'No defensible savings estimate yet. Track avoidable hospitalization, penalty and transfer effects during the intervention before claiming financial benefit.', prerequisites: ['Verified deficiency pattern', 'Provider response', 'Continuity plan'], successMeasures: ['Deficiencies resolved', 'Staffing/quality improvement', 'Resident continuity'], guardrail: 'Select the least disruptive effective option consistent with verified authority and risk.' }),
        ],
      },
    ],
  },
  {
    id: 'contract-accountability',
    label: 'Contract Accountability',
    objective: 'Connect reporting quality and performance signals to applicable contract obligations and controlled remedies.',
    leadValue: encounterTimeliness.value,
    leadLabel: 'lowest reported encounter timeliness',
    reviewPriority: 1,
    readiness: 'Remediation review ready',
    cases: [
      {
        id: 'encounter-remediation',
        title: 'Target encounter-data remediation before relying on downstream measures',
        question: 'Which reporting entity and contract obligations apply to the lowest reported timeliness, and what measures depend on those data?',
        confidence: 'Moderate · official annual response, denominator and contract mapping required',
        impactLenses: ['Accountability', 'Data reliability', 'Services', 'Legislation'],
        inputs: [
          input({ id: 'encounter-timeliness', title: 'Lowest reported encounter-data timeliness', value: encounterTimeliness.value, summary: 'Lowest Kentucky value identified in the annual MCPAR response set.', sources: ['CMS_MCPAR_2024'], asOf: encounterTimeliness.asOf, impact: 'Poor timeliness can delay or weaken utilization, quality and fiscal oversight.', limitation: encounterTimeliness.limitation }),
          input({ id: 'mco-contracts', title: 'Current MCO contract documents', value: contractDocuments.value, summary: 'Contract evidence used to locate reporting, correction and remedy provisions.', sources: ['KY_DMS_CONTRACTS'], asOf: contractDocuments.asOf, impact: 'Determines the applicable obligation and accountable party.', limitation: 'Clause extraction and applicability require reviewer validation.' }),
        ],
        transformations: [
          transformation({ id: 'encounter-definition-alignment', title: 'Align numerator, denominator and entity', summary: 'Tests whether the 74% response is comparable and correctly attributed.', method: 'Resolve question definition, reporting entity, program, response unit and reporting period before ranking.', impact: 'Prevents a misleading plan comparison or false accountability claim.', limitation: 'Annual self-reporting may lag current remediation status.' }),
          transformation({ id: 'dependent-measure-map', title: 'Map dependent decisions and measures', summary: 'Identifies downstream analyses that rely on timely encounter submissions.', method: 'Trace encounter data into utilization, quality, rate, program-integrity and legislative reporting uses.', impact: 'Allows unreliable downstream outputs to be held or caveated until repaired.', limitation: 'Dependency strength varies by measure and must be recorded explicitly.' }),
        ],
        actions: [
          action({ id: 'encounter-corrective-file', title: 'Correct and revalidate late encounter-data files', reviewPriority: 1, implementationPriority: 'Ready to investigate', summary: 'DMS data stewardship should require the responsible reporting entity to correct late or incomplete files and pass defined acceptance checks.', owner: 'DMS data stewardship lead, supported by MCO oversight and the responsible reporting entity', authority: 'Applicable encounter-reporting and corrective-action contract provisions.', expectedImpact: 'Restores timely, reliable data for utilization, quality, rate and program-integrity oversight.', timeHorizon: '30–90 days after entity, denominator and contract applicability are verified', how: ['Confirm the reporting entity, program, period, numerator and denominator.', 'Identify the applicable reporting and correction clause.', 'Issue a correction request with file specification, due date and acceptance criteria.', 'Test the replacement file and release dependent measures only after it passes.'], estimatedCost: 'Not yet costed. Agency cost is data-steward and oversight time; plan remediation cost may be governed by the applicable contract.', estimatedSavings: 'No direct savings estimate. Benefit is avoiding fiscal, quality or enforcement decisions made from materially incomplete data.', prerequisites: ['Entity and denominator validation', 'Applicable contract clause', 'File acceptance criteria'], successMeasures: ['Accepted-file rate', 'Correction cycle time', 'Dependent measures released'], guardrail: 'Do not rank plan performance when source completeness or definitions differ materially.' }),
          action({ id: 'hold-dependent-measures', title: 'Temporarily label or hold unreliable downstream measures', reviewPriority: 2, implementationPriority: 'Conditional', summary: 'Each affected measure owner should stop publishing an overconfident result until the encounter-data dependency is repaired or clearly caveated.', owner: 'Named measure owners, coordinated by data governance', authority: 'Measure-governance and publication controls.', expectedImpact: 'Prevents legislators and program leaders from acting on a result that the underlying encounter data cannot support.', timeHorizon: '1–2 weeks after material dependency is confirmed', how: ['Trace which published measures materially depend on the deficient encounter file.', 'Apply the approved materiality threshold.', 'Label, suppress or hold only the affected output and publish the reason.', 'Restore the output when documented release criteria are met.'], estimatedCost: 'Low administrative effort using existing governance controls; exact staff hours have not been estimated.', estimatedSavings: 'No direct savings forecast. The benefit is avoided decision error, rework and loss of trust.', prerequisites: ['Documented dependency', 'Materiality threshold', 'Publication owner approval'], successMeasures: ['Affected outputs labeled', 'False-green findings avoided', 'Release criteria met'], guardrail: 'Hold only the measures materially affected; preserve unaffected evidence and explain the limitation.' }),
        ],
      },
    ],
  },
  {
    id: 'program-integrity',
    label: 'Protect Program Integrity',
    objective: 'Route credible provider or vendor integrity signals to verified identity review without automated adverse action.',
    leadValue: leieRows.value,
    leadLabel: 'LEIE rows with Kentucky address',
    reviewPriority: 1,
    readiness: 'Aggregate screening context',
    cases: [
      {
        id: 'exclusion-screening',
        title: 'Verify exclusion-screening candidates without fuzzy-match harm',
        question: 'Which aggregate integrity signals justify an authorized identity-resolution review?',
        confidence: 'Low for entity action · aggregate context only',
        impactLenses: ['Program integrity', 'Providers', 'People', 'Due process'],
        inputs: [
          input({ id: 'leie-kentucky', title: 'Kentucky-address LEIE rows', value: leieRows.value, summary: 'Public exclusion rows carrying a Kentucky address, aggregated for legislative display.', sources: ['HHS_OIG_LEIE'], asOf: leieRows.asOf, impact: 'Provides workload context for controlled enrollment screening.', limitation: 'Address state is not identity, current participation, provider role, or proof of an actionable match.' }),
          input({ id: 'provider-universe-integrity', title: 'Certified facility context', value: nursingFacilities.value, summary: 'Public facility universe available for deterministic facility-level comparison.', sources: ['CMS_PROVIDER_DATA'], asOf: nursingFacilities.asOf, impact: 'Supports facility identity context without exposing person-level Medicaid data.', limitation: 'Facility certification does not resolve individual or entity identity.' }),
        ],
        transformations: [
          transformation({ id: 'privacy-separation', title: 'Separate aggregate intelligence from case identity', summary: 'Keeps legislative analytics aggregate while routing case verification to an authorized workflow.', method: 'Expose only counts and categories in DecisionPro; require restricted source verification for any identity-level case.', impact: 'Protects people and providers from disclosure and erroneous automated action.', limitation: 'DecisionPro cannot determine match identity from the aggregate view.' }),
          transformation({ id: 'match-confidence-gate', title: 'Apply deterministic match-confidence gates', summary: 'Classifies a candidate as unresolved until identity fields and source status are verified.', method: 'Require authorized identifiers and current source verification; fuzzy similarity cannot advance an adverse state.', impact: 'Supports integrity work without converting similarity into accusation.', limitation: 'Authorized identity data and human review are required outside the legislative dashboard.' }),
        ],
        actions: [
          action({ id: 'authorized-match-review', title: 'Verify exclusion candidates in the restricted case system', reviewPriority: 1, implementationPriority: 'Ready to investigate', summary: 'Authorized provider-enrollment staff should verify possible exclusion matches using deterministic identifiers and current source records.', owner: 'Provider enrollment screening lead, supported by program integrity', authority: 'Provider-screening authority and restricted access policy.', expectedImpact: 'Finds true exclusions faster while reducing false matches, privacy exposure and unsupported adverse action.', timeHorizon: '2–4 weeks within each monthly screening cycle', how: ['Create the candidate workload from aggregate screening context without exposing identities in DecisionPro.', 'Resolve candidates inside the authorized case system using deterministic identifiers.', 'Recheck the current LEIE source and document human verification.', 'Route only verified matches through the authorized enrollment or payment process.'], estimatedCost: 'Not yet costed; depends on candidate volume, reviewer time and existing identity-resolution tooling.', estimatedSavings: 'Potential improper-payment avoidance is unknown until verified matches, payment exposure and lawful action dates are established.', prerequisites: ['Authorized case system', 'Deterministic identifiers', 'Current LEIE verification'], successMeasures: ['Verified-match precision', 'False-match rate', 'Resolution time'], guardrail: 'Never expose person-level records here or use a fuzzy match for exclusion, payment hold, or adverse action.' }),
          action({ id: 'screening-control-review', title: 'Audit whether every required record is screened on time', reviewPriority: 2, implementationPriority: 'Conditional', summary: 'Program integrity and internal controls should test whether enrollment and payment workflows complete required exclusion checks and resolve exceptions promptly.', owner: 'Program integrity controls lead, supported by internal audit and provider enrollment', authority: 'Internal-control and audit authority.', expectedImpact: 'Reduces missed or delayed screening and gives leadership an aggregate measure of control coverage.', timeHorizon: '4–8 weeks during the next quarterly control review', how: ['Define the records and events that require screening.', 'Compare required events with screening timestamps and outcomes.', 'Age unresolved exceptions and identify the responsible workflow owner.', 'Correct the control gap and retest a complete cycle.'], estimatedCost: 'Not yet costed; primarily internal-control testing and remediation effort, with system cost only if an automation gap is confirmed.', estimatedSavings: 'Cannot be estimated from aggregate data. Quantify avoided improper payments only from verified exceptions and payment exposure.', prerequisites: ['Documented control population', 'Screening timestamps', 'Exception workflow'], successMeasures: ['Screening coverage', 'Exception aging', 'Verified remediation'], guardrail: 'Control-performance measures remain aggregate and do not imply individual wrongdoing.' }),
        ],
      },
      {
        id: 'identity-crosswalk-strengthened-screening',
        title: 'Strengthen exclusion and identity screening with a governed crosswalk',
        question: 'Which organizations have a corroborated cross-source identity link that could speed authorized exclusion or enrollment verification, and which candidate links still need human review?',
        confidence: 'Low for entity action · exact-derived links still require authorized-system verification; inferred links are review candidates only',
        impactLenses: ['Program integrity', 'Providers', 'Due process'],
        inputs: [
          input({ id: 'crosswalk-exact-links', title: 'Exact crosswalk assertions (exact-published + exact-derived)', value: `${kyCrosswalk.methodBreakdown.exactPublished + kyCrosswalk.methodBreakdown.exactDerived} links`, summary: 'Cross-source identity links backed by a same-record fact (NPPES NPI + state Medicaid ID) or a deterministic normalized name-and-address match between two independently published sources (SAM.gov, USAspending, IRS EO BMF, CMS Provider Data, NPPES).', sources: ['SAM_ENTITY', 'USA_SPENDING', 'IRS_EO_BMF', 'CMS_PROVIDER_DATA', 'NPPES'], asOf: kyCrosswalkAsOf, impact: 'Gives authorized screening staff a starting identity link to verify in the restricted case system, instead of starting from name text alone.', limitation: 'An exact-derived link is a strong candidate, not a verified identity; it still requires authorized-system confirmation before any enrollment or payment action.' }),
          input({ id: 'crosswalk-inferred-links', title: 'Inferred crosswalk assertions (review candidates only)', value: `${kyCrosswalk.methodBreakdown.inferred} candidates`, summary: 'Name-similarity-only matches with no independent address confirmation, kept in a separate collection from exact links.', sources: ['SAM_ENTITY', 'USA_SPENDING', 'IRS_EO_BMF', 'CMS_PROVIDER_DATA', 'NPPES'], asOf: kyCrosswalkAsOf, impact: 'Surfaces possible links worth a closer look without ever presenting them as confirmed identity.', limitation: 'Never route an inferred link to enrollment, payment, or exclusion action; it is a lead for human review, not a match.' }),
          input({ id: 'crosswalk-disagreements', title: 'SAM vs USAspending name disagreements (open queue)', value: `${kyCrosswalk.disagreementQueue.length} open`, summary: 'Cases where SAM.gov’s registered legal business name and USAspending’s recipient name for the same UEI do not match closely; never auto-resolved by this pipeline.', sources: ['SAM_ENTITY', 'USA_SPENDING'], asOf: kyCrosswalkAsOf, impact: 'Flags a real corroboration gap between the primary UEI authority and the award-reporting source before either name is trusted for screening.', limitation: 'A disagreement does not itself indicate wrongdoing; it may reflect a legal-name change, an alias, or a reporting lag.' }),
        ],
        transformations: [
          transformation({ id: 'crosswalk-method-separation', title: 'Keep exact and inferred assertions in separate collections', summary: 'Structurally prevents an inferred name-similarity match from ever being queried as if it were confirmed identity.', method: 'Exact and inferred crosswalk assertions live in separate database tables with method-specific CHECK constraints, not just a shared table with a filter flag.', impact: 'Removes an entire class of accidental-promotion bugs between review-candidate and confirmed-identity data.', limitation: 'Structural separation prevents accidental promotion; it does not itself verify an exact-derived link against the authorized case system.' }),
          transformation({ id: 'crosswalk-sample-reconciliation', title: 'Reconcile a sampled exact-derived link against a live re-fetch', summary: 'Every gate run re-verifies one sampled exact-derived assertion against a freshly re-fetched published source record.', method: 'Pick one CCN-anchored exact-derived assertion, re-fetch CMS Provider Data live, and confirm the facility name still matches above a similarity floor.', impact: 'Catches drift between the stored crosswalk and the current published source before it reaches a reviewer.', limitation: 'Only one assertion is sampled per gate run, not the full crosswalk.' }),
        ],
        actions: [
          action({ id: 'route-exact-links-to-screening', title: 'Route exact-derived crosswalk links into the authorized screening workload', reviewPriority: 1, implementationPriority: 'Ready to investigate', summary: 'Provider enrollment screening should treat exact-published and exact-derived crosswalk links as a prioritized starting point for authorized-system identity verification, not as a finished match.', owner: 'Provider enrollment screening lead, supported by program integrity', authority: 'Provider-screening authority and restricted access policy.', expectedImpact: 'Shortens the path from a public-source identity link to an authorized verification decision.', timeHorizon: '2–4 weeks within each monthly screening cycle', how: ['Pull the exact-published and exact-derived link list for the state.', 'Verify each link inside the authorized case system using deterministic identifiers.', 'Record verified, rejected, or needs-more-evidence status back into the review record.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is faster, better-targeted screening, not a dollar saving.', prerequisites: ['Authorized case system access', 'Deterministic identifiers'], successMeasures: ['Links verified', 'False-link rate', 'Time to verification'], guardrail: 'An exact-derived link is a lead, never a confirmed identity or grounds for adverse action on its own.', opportunity: { absoluteValue: `${kyCrosswalk.methodBreakdown.exactPublished + kyCrosswalk.methodBreakdown.exactDerived} links`, absoluteLabel: 'exact crosswalk links available for authorized-system verification', improvementValue: '100%', improvementLabel: 'of exact links routed to verification', calculationBasis: `${kyCrosswalk.methodBreakdown.exactPublished} exact-published + ${kyCrosswalk.methodBreakdown.exactDerived} exact-derived links; verifying all of them is the coverage target, not a finding.` } }),
          action({ id: 'resolve-sam-usaspending-disagreements', title: 'Resolve the open SAM-vs-USAspending name disagreement queue', reviewPriority: 2, implementationPriority: 'Ready to investigate', summary: 'A reviewer should confirm which name is current for each open disagreement (alias, legal-name change, or reporting lag) before either name anchors a screening decision.', owner: 'Program integrity and provider relations', authority: 'Program oversight authority; no adverse action authority implied.', expectedImpact: 'Prevents a stale or mismatched recipient name from anchoring an identity decision.', timeHorizon: 'As needed, ahead of using either name for screening', how: ['Pull the open disagreement queue.', 'Check SAM.gov and the underlying award record directly for the current legal name.', 'Mark each disagreement reviewed with the confirmed name and reason for the mismatch.'], estimatedCost: 'Staff review time only.', estimatedSavings: 'Not quantified; benefit is avoided misidentification.', prerequisites: ['Disagreement queue', 'Access to SAM.gov and USAspending records'], successMeasures: ['Disagreements reviewed', 'Confirmed-name accuracy'], guardrail: 'A name disagreement is a corroboration gap to resolve, never itself evidence of misconduct.', opportunity: { absoluteValue: `${kyCrosswalk.disagreementQueue.length} disagreements`, absoluteLabel: 'open SAM-vs-USAspending name disagreements queued for review', improvementValue: '100%', improvementLabel: 'of open disagreements reviewed and confirmed', calculationBasis: `${kyCrosswalk.disagreementQueue.length} open disagreements between SAM.gov and USAspending recipient names for the same UEI; reviewing all of them is the coverage target, not a finding.` } }),
        ],
      },
      {
        id: 'ownership-churn-review',
        title: 'Review common-ownership chains and recent ownership changes',
        question: 'Which commonly owned facility chains and recent ownership associations are worth a program-integrity review look, without treating ownership itself as a finding?',
        confidence: 'Low for entity action · organization-level CMS ownership data only, exact facility-name match; not an adverse finding',
        impactLenses: ['Program integrity', 'Facilities', 'Due process'],
        inputs: [
          input({ id: 'ownership-chain-count', title: 'Owner organizations controlling more than one loaded facility', value: kyOwnership.metrics['ofr-ownership-chain-count']?.displayValue || 'Not available', summary: 'Common-ownership chains identified from CMS Hospital + SNF "All Owners" data, matched to the OFR-04 Kentucky facility universe by exact facility name.', sources: ['CMS_OWNERSHIP'], asOf: kyOwnershipAsOf, impact: 'Surfaces facility groups under common control for chain-level financial and capacity context.', limitation: 'Common ownership is a structural fact, not evidence of coordinated misconduct, quality problems, or anticompetitive behavior.' }),
          input({ id: 'ownership-recent-churn', title: 'Facilities with an owner association recorded in the last 12 months', value: kyOwnership.metrics['ofr-ownership-recent-churn-count']?.displayValue || 'Not available', summary: 'Review candidates for recent ownership changes, from the CMS ownership association-date field.', sources: ['CMS_OWNERSHIP'], asOf: kyOwnershipAsOf, impact: 'Flags facilities worth a closer look after a recent ownership change, before any program-integrity concern is confirmed.', limitation: 'A recorded association date reflects CMS enrollment filing timing, not necessarily the actual transaction date; a recent association is not itself irregular.' }),
        ],
        transformations: [
          transformation({ id: 'ownership-privacy-transform', title: 'Strip individual owner identity before any fact lands in the warehouse', summary: 'CMS ownership PUFs carry individual owner names and addresses for person-level owners; none of that reaches this product.', method: 'Only organization-level owner facts (organization name, role, percentage, entity-type flags, association date) and an owner_type flag are read from the raw file into any table; the full raw publisher file is retained in PSA with a content hash for audit.', impact: 'Keeps this signal within the person-level gate while still surfacing organization-level ownership structure.', limitation: 'Individual-owner facilities are represented only as an anonymous owner_type=individual count, never by name.' }),
          transformation({ id: 'ownership-facility-name-match', title: 'Match CMS ownership records to the OFR-04 KY+FL facility universe', summary: 'Scopes the national CMS ownership file down to Kentucky and Florida hospitals and SNFs already known from OFR-04.', method: 'Exact match on normalized facility name only (no fuzzy matching) between the CMS ownership file and OFR-04\'s dso_facility_cost_report.', impact: 'Avoids over-claiming coverage from a fuzzy match on ownership data, which feeds a program-integrity-adjacent goal.', limitation: 'A facility whose name differs between the two CMS datasets will not be matched; coverage is a lower bound, not exhaustive.' }),
        ],
        actions: [
          action({ id: 'review-ownership-chains', title: 'Review common-ownership chains for chain-level context', reviewPriority: 4, implementationPriority: 'Ready to investigate', summary: 'Program integrity should review the common-ownership chain list alongside each chain\'s aggregate bed count and financial-margin context from OFR-04.', owner: 'Program integrity, with facility oversight', authority: 'Program oversight authority; no adverse action authority implied.', expectedImpact: 'Gives reviewers chain-level context before evaluating any single-facility signal in isolation.', timeHorizon: '4–8 weeks for the initial review pass', how: ['Pull the ownership-chain list from the Funding & Resilience Evidence Room.', 'Cross-reference each chain\'s facilities against other OFR signals (negative-margin watchlist, crosswalk).', 'Record reviewed or no-action status back into the review record.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is better-contextualized review, not a dollar saving.', prerequisites: ['Access to the Funding & Resilience Evidence Room ownership-chain list'], successMeasures: ['Chains reviewed', 'Cross-referenced signals resolved'], guardrail: 'Common ownership is never itself a finding of anticompetitive conduct, quality failure, or program integrity violation.', opportunity: { absoluteValue: `${kyOwnership.metrics['ofr-ownership-chain-count']?.displayValue || '0'} chains`, absoluteLabel: 'common-ownership chains available for review', improvementValue: '100%', improvementLabel: 'of identified chains reviewed', calculationBasis: `${kyOwnership.metrics['ofr-ownership-chain-count']?.displayValue || '0'} owner organizations controlling more than one loaded Kentucky facility; reviewing all of them is the coverage target, not a finding.` } }),
          action({ id: 'review-recent-ownership-changes', title: 'Review facilities with a recent ownership association', reviewPriority: 5, implementationPriority: 'Ready to investigate', summary: 'Program integrity should confirm current licensure and Medicaid participation status for facilities with a recent ownership association, as routine due diligence.', owner: 'Program integrity, with provider enrollment', authority: 'Program oversight authority; no adverse action authority implied.', expectedImpact: 'Keeps ownership-change due diligence current without treating a recent change as presumptively concerning.', timeHorizon: 'As needed, on a rolling basis', how: ['Pull the recent-ownership-association list.', 'Confirm current licensure and Medicaid participation status for each facility.', 'Record confirmed status back into the review record.'], estimatedCost: 'Staff review time only.', estimatedSavings: 'Not quantified; benefit is current due-diligence coverage.', prerequisites: ['Recent-association facility list', 'Access to licensure/enrollment status records'], successMeasures: ['Facilities reviewed', 'Status confirmed'], guardrail: 'A recent ownership association is a routine due-diligence prompt, never evidence of impropriety.', opportunity: { absoluteValue: `${kyOwnership.metrics['ofr-ownership-recent-churn-count']?.displayValue || '0'} facilities`, absoluteLabel: 'facilities with a recent ownership association flagged for review', improvementValue: '100%', improvementLabel: 'of flagged facilities reviewed', calculationBasis: `${kyOwnership.metrics['ofr-ownership-recent-churn-count']?.displayValue || '0'} facilities with an owner association in the last 12 months; reviewing all of them is the coverage target, not a risk score.` } }),
        ],
      },
    ],
  },
  {
    id: 'trend-planning',
    label: 'Trend & Budget Planning',
    objective: 'Align fiscal periods, appropriations, obligations and service indicators before proposing allocation changes.',
    leadValue: federalObligations.value,
    leadLabel: 'latest complete FY 93.778 obligations',
    reviewPriority: 2,
    readiness: 'Context ready; state transactions gap',
    cases: [
      {
        id: 'budget-trend-reconciliation',
        title: 'Build a reconciled fiscal and service-planning baseline',
        question: 'Are resources aligned with changing enrollment, service demand and contractual obligations?',
        confidence: 'Low–moderate · federal and document context available, transaction baseline incomplete',
        impactLenses: ['Budget', 'Services', 'Legislation', 'Planning'],
        inputs: [
          input({ id: 'federal-obligations', title: 'Latest complete-year 93.778 obligations', value: federalObligations.value, summary: 'Federal award-obligation context for Kentucky under Assistance Listing 93.778.', sources: ['USA_SPENDING'], asOf: federalObligations.asOf, impact: 'Provides an external fiscal-period context for planning and reconciliation.', limitation: federalObligations.limitation }),
          input({ id: 'budget-docs', title: 'Budget documents indexed', value: budgetDocuments.value, summary: 'Current Kentucky budget publications retained with hashes and revision provenance.', sources: ['KY_OSBD'], asOf: budgetDocuments.asOf, impact: 'Provides appropriations and policy context for allocation review.', limitation: 'Tables and revisions require governed extraction and reconciliation.' }),
          input({ id: 'state-transactions', title: 'State transaction baseline', value: 'Required feed', summary: 'Vendor, contract and payment detail needed to measure actual allocation and use.', sources: ['KY_TRANSPARENCY'], asOf: 'Current labeled gap', impact: 'Determines whether budget variances reflect timing, encumbrance, demand, rates, or inefficiency.', limitation: 'No supported analytical bulk export is currently claimed.' }),
        ],
        transformations: [
          transformation({ id: 'fiscal-period-normalization', title: 'Normalize fiscal periods and revisions', summary: 'Aligns budget biennia, state fiscal years, federal fiscal years and document revisions.', method: 'Version budget documents, retain effective dates, and map obligations and future payments only to compatible periods.', impact: 'Prevents misleading comparisons between incompatible fiscal windows.', limitation: 'Obligations are not expenditures; appropriations are not payments.' }),
          transformation({ id: 'variance-explanation-waterfall', title: 'Build a variance-explanation waterfall', summary: 'Separates timing, enrollment, mix, rate, contract and unexplained residual effects.', method: 'Start with the reconciled baseline, apply documented drivers sequentially, and retain the unexplained residual as a review signal.', impact: 'Focuses scarce analytical effort on material unexplained variance.', limitation: 'The waterfall remains incomplete until transaction and service-use data are available.' }),
        ],
        actions: [
          action({ id: 'authorize-transaction-feed', title: 'Establish a supported state payment and contract feed', reviewPriority: 1, implementationPriority: 'Prerequisite', summary: 'Agency finance and data governance should obtain a governed recurring export that connects actual payments with vendors, contracts and fiscal periods.', owner: 'Agency finance data owner and data-governance lead, with the Kentucky source owner', authority: 'Data-sharing, accounting and access authority.', expectedImpact: 'Enables actual budget-to-use, vendor-concentration and payment-to-contract analysis instead of relying on federal or document proxies.', timeHorizon: '8–16 weeks after a source owner and supported export path are agreed', how: ['Name the authoritative source owner and permitted use.', 'Agree the supported export method, fields, definitions, cadence and correction process.', 'Build the governed adapter with provenance, validation and access controls.', 'Reconcile the first complete period to accounting totals before using it analytically.'], estimatedCost: 'Not yet estimated; scope includes source-owner work, adapter development, secure storage, reconciliation and ongoing stewardship.', estimatedSavings: 'No savings can be forecast before the feed exists. It enables later identification of duplicate, idle, concentrated or contract-inconsistent spending.', prerequisites: ['Named source owner', 'Supported export method', 'Field definitions and refresh agreement'], successMeasures: ['Feed authorized', 'Reconciliation pass rate', 'Refresh timeliness'], guardrail: 'Do not scrape undocumented endpoints or represent federal obligations as state expenditure truth.' }),
          action({ id: 'prepare-budget-baseline', title: 'Build the reconciled baseline for the next budget review', reviewPriority: 2, implementationPriority: 'Ready to investigate', summary: 'Budget analysts should extract, version and reconcile authoritative budget tables so later variance analysis starts from the correct enacted baseline.', owner: 'Budget and fiscal analysis lead, supported by a document-data reviewer', authority: 'Public budget analysis and internal review authority.', expectedImpact: 'Reduces reconciliation rework and makes fiscal-period, revision and assumption differences explicit before allocation decisions.', timeHorizon: '4–8 weeks, completed before the next budget-review cycle', how: ['Extract appropriations and relevant policy tables from each authoritative document version.', 'Record effective dates and reconcile amendments or conflicting revisions.', 'Map state, federal and biennial periods through an approved crosswalk.', 'Publish the baseline with explicit gaps and a reviewer sign-off.'], estimatedCost: 'Not yet costed; primarily budget-analyst and document-review effort, with optional extraction-tooling cost.', estimatedSavings: 'No direct savings forecast. Benefit is avoided baseline error and faster identification of unexplained variance once payment data are available.', prerequisites: ['Table extraction review', 'Revision mapping', 'Fiscal-period crosswalk'], successMeasures: ['Tables reconciled', 'Revision conflicts resolved', 'Unexplained variance tracked'], guardrail: 'Label modeled or proposed allocations separately from enacted and observed amounts.' }),
        ],
      },
      {
        id: 'federal-funding-cliff-calendar',
        title: 'Track federal award expirations and single-stream funding concentration',
        question: 'Which federally funded Medicaid-adjacent capacity has an award expiring soon, and which recipients depend on a single OFR-tracked funding stream?',
        confidence: 'Moderate · USAspending award-grain reconciled to control totals; not a renewal-outcome prediction',
        impactLenses: ['Budget', 'Services', 'Planning'],
        inputs: [
          input({ id: 'award-cliff-0-6', title: 'Awards ending in 0–6 months', value: `${kyAwardCliff0to6?.count ?? 0} awards / ${kyAwardCliff0to6?.displayAmount ?? '$0'}`, summary: 'Kentucky federal awards across the OFR-tracked assistance-listing set (93.775/93.777/93.778/93.791/93.224/93.958/93.959) with a published period-of-performance end date in the next 6 months.', sources: ['USA_SPENDING'], asOf: kyAwardAsOf, impact: 'Flags near-term renewal-review candidates before a funding gap could affect service continuity.', limitation: 'A listed expiration is a review prompt, not a predicted funding lapse; most awards renew routinely.' }),
          input({ id: 'award-cliff-6-12', title: 'Awards ending in 6–12 months', value: `${kyAwardCliff6to12?.count ?? 0} awards / ${kyAwardCliff6to12?.displayAmount ?? '$0'}`, summary: 'Same tracked-listing set, next 6–12 month expiration window.', sources: ['USA_SPENDING'], asOf: kyAwardAsOf, impact: 'Extends the renewal-review horizon for advance planning.', limitation: 'Same as the 0–6 month window; not a lapse prediction.' }),
          input({ id: 'award-single-stream', title: 'Recipients funded by exactly one tracked assistance listing', value: `${kyAwardSingleStream.recipientCount} organizations`, summary: 'Recipients whose only award among the OFR-tracked assistance listings falls under a single program.', sources: ['USA_SPENDING'], asOf: kyAwardAsOf, impact: 'Surfaces organizations whose OFR-visible federal funding is concentrated in one stream, for continuity review.', limitation: 'Reflects only the seven OFR-tracked assistance listings, not a recipient\'s full funding portfolio; not evidence of financial distress.' }),
        ],
        transformations: [
          transformation({ id: 'award-grain-reconciliation', title: 'Reconcile award-grain rows to USAspending control totals', summary: 'Every loaded award is checked against a freshly re-fetched USAspending count and a sampled award re-fetch before use.', method: 'Place-of-performance and recipient-location queries are merged and deduplicated by award ID, then a sampled award and a per-listing count are re-fetched live and compared to the stored rows on every gate run.', impact: 'Prevents stale or miscounted award data from driving the cliff calendar.', limitation: 'Reconciliation covers a row-count floor, one control-total re-count, and one sampled award per gate run, not every row on every run.' }),
          transformation({ id: 'award-cliff-and-concentration-buckets', title: 'Bucket expirations and compute single-stream concentration', summary: 'Groups award end dates into 0–6, 6–12, and 12–24 month review windows and flags recipients whose only tracked-listing award falls under one assistance listing.', method: 'Compute months-until-end from each award\'s published period-of-performance end date; group recipients by normalized name and count distinct assistance listings per recipient.', impact: 'Turns a flat award list into a forward-looking renewal calendar and a concentration review list.', limitation: 'Recipient-name normalization is a review candidate, not a verified organizational identity match; the OFR-02 crosswalk will replace it with confidence-labeled identity resolution.' }),
        ],
        actions: [
          action({ id: 'review-federal-award-renewals', title: 'Route near-term award expirations to renewal review', reviewPriority: 2, implementationPriority: 'Ready to investigate', summary: 'Program and grants staff should review the 0–6 and 6–12 month expiration lists against known renewal timelines and application deadlines.', owner: 'DMS federal grants management, with program leads for the funded capacity', authority: 'Grants management and program oversight authority.', expectedImpact: 'Reduces the chance that a routine renewal is missed for lack of visibility, without asserting any award will lapse.', timeHorizon: '2–4 weeks for the initial review pass', how: ['Pull the 0–6 and 6–12 month lists from the Funding & Resilience Evidence Room.', 'Confirm renewal status directly with the awarding agency or recipient for each listed award.', 'Record confirmed renewal, lapse risk, or already-renewed status back into the review record.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is continuity assurance, not a dollar saving.', prerequisites: ['Access to the Funding & Resilience Evidence Room award list'], successMeasures: ['Awards reviewed', 'Renewal status confirmed', 'Unresolved-at-expiration count'], guardrail: 'Do not describe an unreviewed expiration as a funding loss or program failure.', opportunity: { absoluteValue: `${kyAwardCliff0to6?.count ?? 0} awards`, absoluteLabel: 'awards flagged for near-term renewal review (0–6 months)', improvementValue: '100%', improvementLabel: 'of near-term award expirations routed to renewal review', calculationBasis: `${kyAwardCliff0to6?.count ?? 0} awards ending in the next 6 months across the OFR-tracked assistance listings; reviewing all of them is the coverage target, not a savings forecast.` } }),
          action({ id: 'validate-single-stream-recipients', title: 'Validate single-stream-dependent recipients before any funding change', reviewPriority: 3, implementationPriority: 'Ready to investigate', summary: 'Before any state or federal funding change affecting these listings, confirm whether flagged recipients have other funding streams outside this OFR-tracked set.', owner: 'Program integrity and provider relations', authority: 'Program oversight authority; no adverse action authority implied.', expectedImpact: 'Prevents a funding-policy change from unexpectedly destabilizing a recipient whose OFR-visible funding is concentrated in one stream.', timeHorizon: 'As needed, ahead of any funding-policy change touching these listings', how: ['Pull the single-stream-dependent recipient list.', "Confirm each recipient's full funding picture where authorized data allows.", 'Flag any recipient without confirmed alternate funding for continuity planning.'], estimatedCost: 'Staff review time only.', estimatedSavings: 'Not quantified; benefit is avoided service disruption.', prerequisites: ['Single-stream recipient list', "Authorized channel to confirm recipient funding"], successMeasures: ['Recipients validated', 'Continuity plans opened where warranted'], guardrail: 'Single-stream status under this tracked set is a review candidate only, never evidence of financial distress or mismanagement.', opportunity: { absoluteValue: `${kyAwardSingleStream.recipientCount} organizations`, absoluteLabel: 'single-stream-dependent recipients identified for continuity validation', improvementValue: '100%', improvementLabel: 'of flagged recipients validated before any funding-policy change', calculationBasis: `${kyAwardSingleStream.recipientCount} recipients whose only OFR-tracked award falls under one assistance listing; validating all of them is the coverage target, not a risk score.` } }),
        ],
      },
      {
        id: 'nonprofit-financial-resilience-review',
        title: 'Review nonprofit financial-resilience signals from IRS Form 990 filings',
        question: 'Which crosswalked Medicaid-adjacent nonprofits show low liquidity or high contribution/grant dependency worth a continuity-planning look before a funding change lands?',
        confidence: 'Low–moderate · organization-level IRS SOI extract reconciled by sampled live re-fetch; not a distress finding',
        impactLenses: ['Budget', 'Services', 'Planning'],
        inputs: [
          input({ id: 'nonprofit-liquidity', title: 'Median months of unrestricted net-asset liquidity', value: kyNonprofit.metrics['ofr-nonprofit-median-liquidity-months']?.displayValue || 'Not available', summary: 'Median unrestricted net assets divided by average monthly functional expense, across crosswalked Kentucky Form 990 filers.', sources: ['IRS_990_EXTRACT'], asOf: kyNonprofitAsOf, impact: 'A standard nonprofit financial-health reserve indicator, computed the same way for every filer.', limitation: 'A single low-liquidity period is not evidence of distress; many nonprofits run lean by design or hold restricted funds not counted here.' }),
          input({ id: 'nonprofit-low-liquidity-count', title: 'Filings with under 3 months of liquidity', value: kyNonprofit.metrics['ofr-nonprofit-low-liquidity-count']?.displayValue || 'Not available', summary: 'Count of crosswalked Kentucky filing-periods below the 3-month reserve threshold.', sources: ['IRS_990_EXTRACT'], asOf: kyNonprofitAsOf, impact: 'Bounds the review workload to a specific, reproducible threshold.', limitation: 'The 3-month threshold is a common planning convention, not a regulatory or distress standard.' }),
          input({ id: 'nonprofit-contribution-dependency', title: 'Median contribution-and-grant revenue dependency', value: kyNonprofit.metrics['ofr-nonprofit-median-contribution-dependency']?.displayValue || 'Not available', summary: 'Median share of total revenue from contributions and grants (not government-specific — see limitation).', sources: ['IRS_990_EXTRACT'], asOf: kyNonprofitAsOf, impact: 'Flags organizations whose revenue is concentrated in grant/contribution funding, worth cross-referencing against the OFR-01 award-cliff calendar.', limitation: 'The IRS SOI extract does not separately break out government-source grants from all Part VIII Line 1 contributions; this is a broader contribution-and-grant ratio, not government-specific.' }),
        ],
        transformations: [
          transformation({ id: 'nonprofit-crosswalk-filter', title: 'Filter the national 990 extract to the OFR-02 crosswalked KY+FL universe', summary: 'Reduces a ~345,000-row national IRS filing extract to only the organizations already identity-resolved to Kentucky or Florida via the OFR-02 EO BMF crosswalk.', method: 'Match each 990 filing row\'s EIN against the OFR-02 dso_identity_record EIN universe before landing any filing-level facts.', impact: 'Keeps the retained dataset scoped to organizations actually relevant to this product, not the full national nonprofit sector.', limitation: 'Coverage is bounded by the OFR-02 crosswalk\'s own EIN universe (the EO BMF state extract), not a Medicaid-specific provider list.' }),
          transformation({ id: 'nonprofit-ratio-computation', title: 'Compute resilience ratios from retained extract rows only', summary: 'Every ratio is reproducible from the retained, content-hashed IRS SOI extract rows — no external estimate is blended in.', method: 'Liquidity months = unrestricted net assets ÷ (total functional expenses ÷ 12); contribution dependency = total contributions/grants ÷ total revenue.', impact: 'Makes every displayed ratio independently checkable against the cited source row.', limitation: 'Only Form 990 filers are covered (not 990-EZ or 990-PF); smaller or private-foundation-structured organizations are not represented.' }),
        ],
        actions: [
          action({ id: 'review-low-liquidity-filings', title: 'Route low-liquidity filings to a financial-resilience review queue', reviewPriority: 3, implementationPriority: 'Ready to investigate', summary: 'Program and grants staff should review the lowest-liquidity crosswalked filings as a continuity-planning prompt, not a distress determination.', owner: 'DMS program oversight, with grants management for federally funded organizations', authority: 'Program oversight authority; no adverse action authority implied.', expectedImpact: 'Surfaces organizations worth a closer continuity-planning look before a funding or contract change affects them.', timeHorizon: '4–8 weeks for the initial review pass', how: ['Pull the lowest-liquidity filing list from the Funding & Resilience Evidence Room.', 'Cross-reference against the OFR-01 award-cliff calendar and OFR-02 crosswalk for the same organization.', 'Record reviewed, no-action, or continuity-plan-opened status back into the review record.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is earlier continuity-planning visibility, not a dollar saving.', prerequisites: ['Access to the Funding & Resilience Evidence Room filing list'], successMeasures: ['Filings reviewed', 'Continuity plans opened where warranted', 'False-flag rate'], guardrail: 'A liquidity ratio is a review prompt only; never describe it as financial distress, mismanagement, or a finding without independent verification.', opportunity: { absoluteValue: `${kyNonprofit.metrics['ofr-nonprofit-low-liquidity-count']?.displayValue || '0'} filings`, absoluteLabel: 'low-liquidity filings flagged for continuity-planning review', improvementValue: '100%', improvementLabel: 'of flagged filings reviewed', calculationBasis: `${kyNonprofit.metrics['ofr-nonprofit-low-liquidity-count']?.displayValue || '0'} crosswalked Kentucky Form 990 filings under the 3-month liquidity threshold; reviewing all of them is the coverage target, not a savings forecast.` } }),
          action({ id: 'cross-reference-high-dependency-filings', title: 'Cross-reference high grant-dependency filings against the federal award-cliff calendar', reviewPriority: 4, implementationPriority: 'Ready to investigate', summary: 'Grants management should check whether organizations with contribution-and-grant revenue at 80%+ of total revenue also appear on the OFR-01 near-term award-expiration list, since the two signals together are a stronger continuity-planning prompt than either alone.', owner: 'DMS federal grants management, with program oversight', authority: 'Grants management and program oversight authority.', expectedImpact: 'Concentrates continuity-planning attention where funding concentration and near-term award expiration coincide.', timeHorizon: '4–8 weeks, aligned with the award-cliff review cycle', how: ['Pull the high-dependency filing list and the OFR-01 0–6/6–12 month award-expiration lists.', 'Match by crosswalked organization identity where an exact or exact-derived link exists.', 'Prioritize matched organizations for the continuity-planning queue.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is earlier, better-targeted continuity-planning visibility.', prerequisites: ['High-dependency filing list', 'OFR-01 award-cliff calendar', 'OFR-02 crosswalk'], successMeasures: ['Organizations matched', 'Continuity plans opened where warranted'], guardrail: 'A dependency ratio combined with a near-term award expiration is still a review prompt, not a prediction that funding will lapse or that the organization is at risk.', opportunity: { absoluteValue: `${kyNonprofit.metrics['ofr-nonprofit-high-dependency-count']?.displayValue || '0'} filings`, absoluteLabel: 'high grant-dependency filings available for cross-reference', improvementValue: '100%', improvementLabel: 'of high-dependency filings checked against the award-cliff calendar', calculationBasis: `${kyNonprofit.metrics['ofr-nonprofit-high-dependency-count']?.displayValue || '0'} crosswalked Kentucky Form 990 filings with contribution-and-grant revenue at 80%+ of total revenue; checking all of them is the coverage target, not a risk score.` } }),
        ],
      },
      {
        id: 'subaward-funding-concentration-overlap',
        title: 'Review sub-award funding concentration and program overlap',
        question: 'Where is sub-award funding concentrated in a single identity-resolved recipient, and which recipients draw on more than one OFR-tracked federal program, worth a coordination-review look?',
        confidence: 'Low–moderate · identity-resolved edges only for concentration; unresolved edges labeled and excluded from the concentration figure',
        impactLenses: ['Budget', 'Spending', 'Planning'],
        inputs: [
          input({ id: 'subaward-edge-count', title: 'Sub-award funding edges loaded', value: kySubaward.metrics['ofr-subaward-edge-count']?.displayValue || 'Not available', summary: 'Sub-awards found under the OFR-01 prime-award universe, each represented as one funding edge from prime to sub-recipient.', sources: ['USA_SPENDING'], asOf: kySubawardAsOf, impact: 'Maps the funding flow beyond the prime-award grain already covered by OFR-01.', limitation: 'A funding edge is a review map, never itself evidence of duplication, waste, or improper coordination.' }),
          input({ id: 'subaward-top-concentration', title: "Top sub-recipient's share of identity-resolved sub-award dollars", value: kySubaward.metrics['ofr-subaward-top-recipient-concentration']?.displayValue || 'Not available', summary: 'Computed only from edges whose recipient identity was crosswalk-resolved (OFR-02 exact-derived match); unresolved edges are excluded from this figure, not silently included.', sources: ['USA_SPENDING'], asOf: kySubawardAsOf, impact: 'Flags funding concentration worth a closer look, with the identity-confidence caveat stated up front.', limitation: 'Concentration in one recipient is not itself evidence of favoritism or improper award steering.' }),
          input({ id: 'subaward-program-overlap', title: 'Sub-recipients funded under more than one OFR-tracked assistance listing', value: kySubaward.metrics['ofr-subaward-program-overlap-count']?.displayValue || 'Not available', summary: 'Recipients appearing as a sub-recipient under two or more different assistance listings in the OFR-tracked set.', sources: ['USA_SPENDING'], asOf: kySubawardAsOf, impact: 'Surfaces recipients whose funding scope may need reconciliation before describing any overlap as duplicative.', limitation: 'Multiple funding streams to the same recipient can reflect distinct, non-duplicative service scopes; this is a review candidate, not a finding.' }),
        ],
        transformations: [
          transformation({ id: 'subaward-identity-confidence-labeling', title: 'Label every funding edge with an explicit identity confidence', summary: 'A sub-recipient name is matched against the OFR-02 crosswalk\'s identity records; only an exact normalized-name match to an EIN-bearing identity record earns exact-derived confidence.', method: 'Every edge stores identity_confidence as exact-derived or unresolved, enforced by a SQL CHECK constraint; an unresolved edge never carries an identity value.', impact: 'Prevents an unverified sub-recipient name from being silently treated as a confirmed identity in concentration or overlap figures.', limitation: 'Coverage of exact-derived edges is bounded by the OFR-02 crosswalk\'s own EIN universe.' }),
          transformation({ id: 'subaward-live-sample-reconciliation', title: 'Reconcile a sampled subaward against a live re-fetch', summary: 'Every gate run re-verifies one sampled subaward\'s dollar amount against a freshly re-fetched USAspending subawards page.', method: 'Pick one loaded subaward, re-query the same prime award\'s subawards live, and confirm the stored amount reproduces exactly.', impact: 'Catches drift between the retained sub-award facts and the current published source before it reaches a reviewer.', limitation: 'Only one subaward is sampled per gate run, not the full loaded set.' }),
        ],
        actions: [
          action({ id: 'review-subaward-concentration', title: 'Review top-concentration sub-recipients for coordination context', reviewPriority: 5, implementationPriority: 'Ready to investigate', summary: 'Program and grants staff should review the highest-concentration identity-resolved sub-recipients as a coordination-review prompt, not a finding.', owner: 'DMS federal grants management, with program oversight', authority: 'Grants management and program oversight authority.', expectedImpact: 'Gives reviewers a starting point for understanding where sub-award funding concentrates before evaluating any single-recipient signal in isolation.', timeHorizon: '4–8 weeks for the initial review pass', how: ['Pull the funding-edge list from the Funding & Resilience Evidence Room, filtered to exact-derived confidence.', 'Cross-reference against other OFR signals for the same recipient (crosswalk, nonprofit financials).', 'Record reviewed or no-action status back into the review record.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is better-contextualized review, not a dollar saving.', prerequisites: ['Access to the Funding & Resilience Evidence Room funding-edge list'], successMeasures: ['Edges reviewed', 'Cross-referenced signals resolved'], guardrail: 'Funding concentration is never itself evidence of favoritism, waste, or improper award steering.', opportunity: { absoluteValue: kySubaward.metrics['ofr-subaward-top-recipient-concentration']?.displayValue || '0%', absoluteLabel: 'top identity-resolved sub-recipient concentration share', improvementValue: '100%', improvementLabel: 'of high-concentration edges reviewed', calculationBasis: `${kySubaward.metrics['ofr-subaward-edge-count']?.displayValue || '0'} sub-award funding edges loaded; reviewing the highest-concentration identity-resolved recipients is the coverage target, not a finding.` } }),
          action({ id: 'review-subaward-program-overlap', title: 'Review program-overlap sub-recipients before describing any overlap as duplicative', reviewPriority: 6, implementationPriority: 'Ready to investigate', summary: 'Program oversight should reconcile scope and population for sub-recipients funded under more than one OFR-tracked assistance listing before describing the funding as duplicative or overlapping.', owner: 'DMS program oversight, with grants management', authority: 'Program oversight authority; no adverse action authority implied.', expectedImpact: 'Prevents a premature "duplicate funding" conclusion from an unreconciled multi-program signal.', timeHorizon: 'As needed, ahead of any funding-policy or oversight action referencing overlap', how: ['Pull the program-overlap recipient list.', 'Confirm each program\'s distinct scope, population, and deliverables for the recipient.', 'Record confirmed distinct-scope or genuine-overlap status back into the review record.'], estimatedCost: 'Staff review time only.', estimatedSavings: 'Not quantified; benefit is avoided mischaracterization of legitimate multi-program funding.', prerequisites: ['Program-overlap recipient list', 'Program scope documentation for each listing'], successMeasures: ['Recipients reviewed', 'Scope reconciliation completed'], guardrail: 'Never describe a program-overlap recipient as receiving duplicative or wasteful funding without a completed scope reconciliation.', opportunity: { absoluteValue: `${kySubaward.metrics['ofr-subaward-program-overlap-count']?.displayValue || '0'} organizations`, absoluteLabel: 'sub-recipients funded under more than one tracked program', improvementValue: '100%', improvementLabel: 'of overlap recipients scope-reconciled', calculationBasis: `${kySubaward.metrics['ofr-subaward-program-overlap-count']?.displayValue || '0'} sub-recipients funded under multiple OFR-tracked assistance listings; reconciling all of them is the coverage target, not a finding.` } }),
        ],
      },
      {
        id: 'waiver-and-grant-horizon-watch',
        title: 'Track waiver/demonstration expirations and open federal grant opportunities',
        question: 'Which Kentucky Medicaid waiver or demonstration authority has a published expiration approaching, and which open federal funding opportunities under the OFR-tracked listings could support that capacity?',
        confidence: 'Moderate · every event cites its source document and retrieval date; no renewal outcome is predicted',
        impactLenses: ['Budget', 'Services', 'Planning'],
        inputs: [
          input({ id: 'horizon-waiver-expiring', title: 'Waiver/demonstration authorities expiring within 24 months', value: kyHorizon.metrics['ofr-horizon-waiver-expiring-24mo-count']?.displayValue || 'Not available', summary: 'TEAMKY Section 1115 Demonstration authority with a published expiration date in the next 24 months, cited to the CMS demonstration page.', sources: ['CMS_1115_DEMO'], asOf: kyHorizonAsOf, impact: 'Gives grants and program staff lead time to prepare a renewal package well before expiration.', limitation: 'CMS publishes no structured API for this; the demonstration page itself is the cited source. A listed expiration is a published date, never a predicted lapse or renewal outcome.' }),
          input({ id: 'horizon-waiver-milestones', title: 'Recently posted waiver milestone documents', value: kyHorizon.metrics['ofr-horizon-waiver-milestone-count']?.displayValue || 'Not available', summary: 'Recently posted approval, evaluation-design, and implementation-plan documents from the TEAMKY demonstration page\'s Supporting Documents record.', sources: ['CMS_1115_DEMO'], asOf: kyHorizonAsOf, impact: 'Surfaces deliverable and monitoring milestones without requiring a manual check of the CMS page.', limitation: 'Limited to the most recently posted documents captured at retrieval time, not the full historical document set.' }),
          input({ id: 'horizon-open-nofo', title: 'Open or forecasted NOFO opportunities under tracked assistance listings', value: kyHorizon.metrics['ofr-horizon-open-nofo-count']?.displayValue || 'Not available', summary: 'Live Grants.gov search2 results for the seven OFR-tracked assistance listings, filtered to posted or forecasted status.', sources: ['GRANTS_GOV'], asOf: kyHorizonAsOf, impact: 'Flags federal funding opportunities the state or a funded organization could pursue for tracked capacity.', limitation: 'National in scope — Grants.gov does not confirm Kentucky-specific eligibility; each opportunity requires an eligibility check before pursuit.' }),
        ],
        transformations: [
          transformation({ id: 'horizon-event-citation', title: 'Cite every event to its source document and retrieval date', summary: 'No event is loaded without a source_document_uri and a retrieved_at timestamp, enforced by a dedicated reconciliation check on every gate run.', method: 'The CMS demonstration page\'s "Waiver Dates" and "Supporting Documents" blocks, and each Grants.gov opportunity, are captured with their source URI and fetch timestamp at load time.', impact: 'Makes every displayed date independently checkable against its published source.', limitation: 'CMS publishes no structured API for 1115 demonstration metadata; the page itself is the source of record, so a page redesign could require the parser to be updated.' }),
          transformation({ id: 'horizon-no-outcome-prediction', title: 'Never predict a renewal outcome', summary: 'Every event carries a published status only (e.g. approved-through-expiration, posted, forecasted) — never a forecast of whether a waiver will be renewed or a grant awarded.', method: 'A reconciliation check scans every loaded status string for outcome-prediction language and fails the gate if any is found.', impact: 'Keeps the horizon watch a scheduling and preparation tool, not a forecasting tool.', limitation: 'Status reflects what CMS/Grants.gov has published as of the retrieval date; it does not reflect unpublished internal deliberations.' }),
        ],
        actions: [
          action({ id: 'prepare-waiver-renewal-package', title: 'Open renewal-preparation work ahead of the TEAMKY expiration', reviewPriority: 7, implementationPriority: 'Ready to investigate', summary: 'Grants management and program leads should confirm the renewal timeline and begin preparing a renewal package well ahead of the published TEAMKY expiration date, using the standard CMS extension process.', owner: 'DMS federal grants management, with program leads for TEAMKY-funded capacity', authority: 'Grants management and program oversight authority.', expectedImpact: 'Reduces the chance that a routine demonstration renewal is started too late, without asserting the demonstration will lapse.', timeHorizon: 'Begin 18–24 months ahead of the published expiration date', how: ['Pull the waiver expiration event and its source citation from the Funding & Resilience Evidence Room.', 'Confirm the current renewal/extension timeline directly with CMS.', 'Record the confirmed renewal-preparation status back into the review record.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is continuity assurance, not a dollar saving.', prerequisites: ['Access to the Funding & Resilience Evidence Room waiver expiration event'], successMeasures: ['Renewal timeline confirmed', 'Renewal package preparation started', 'Milestone documents reviewed'], guardrail: 'Do not describe a published expiration date as a predicted funding lapse or program failure.', opportunity: { absoluteValue: `${kyHorizonExpirations.length} authority`, absoluteLabel: 'waiver/demonstration authority with a tracked expiration date', improvementValue: '100%', improvementLabel: 'of tracked authorities with a confirmed renewal-preparation status', calculationBasis: `${kyHorizonExpirations.length} tracked 1115 demonstration authority; confirming renewal-preparation status is the coverage target, not a savings forecast.` } }),
          action({ id: 'review-open-nofo-opportunities', title: 'Route open NOFO opportunities to a grants-pursuit review', reviewPriority: 8, implementationPriority: 'Ready to investigate', summary: 'Grants management should review open or forecasted NOFO opportunities under the OFR-tracked assistance listings and confirm Kentucky/provider eligibility before deciding whether to pursue.', owner: 'DMS federal grants management, with program leads for the relevant capacity', authority: 'Grants management authority.', expectedImpact: 'Surfaces federal funding opportunities that might otherwise be missed for lack of a consolidated view.', timeHorizon: 'Ongoing, ahead of each opportunity\'s close date', how: ['Pull the open NOFO opportunity list from the Funding & Resilience Evidence Room.', 'Confirm Kentucky/provider eligibility against the opportunity\'s own eligibility criteria.', 'Record pursue, decline, or not-eligible status back into the review record.'], estimatedCost: 'Staff review time only; no new system cost.', estimatedSavings: 'Not quantified; benefit is not missing an eligible opportunity, not a dollar saving.', prerequisites: ['Open NOFO opportunity list'], successMeasures: ['Opportunities reviewed', 'Eligibility confirmed', 'Pursue/decline decisions recorded'], guardrail: 'A listed opportunity is a review prompt only; never describe it as funding already secured.', opportunity: { absoluteValue: `${kyHorizonNofos.length} opportunities`, absoluteLabel: 'open or forecasted NOFO opportunities under tracked assistance listings', improvementValue: '100%', improvementLabel: 'of open opportunities reviewed for eligibility', calculationBasis: `${kyHorizonNofos.length} open/forecasted Grants.gov opportunities under the OFR-tracked assistance-listing set; reviewing all of them is the coverage target, not a funding forecast.` } }),
        ],
      },
    ],
  },
];

export function getOperationalGoal(goalId) {
  return KY_OPERATIONAL_GOALS.find((goal) => goal.id === goalId) || null;
}
