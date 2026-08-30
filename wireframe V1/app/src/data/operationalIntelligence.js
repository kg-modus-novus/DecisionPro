import { KY_OPERATIONAL_SOURCES } from './alp/kyOperationalSources.js';
import { FL_OPERATIONAL_SOURCES } from './alp/flOperationalSources.js';
import { KY_OPERATIONAL_GOALS } from './operationalGoals.js';
import { FL_OPERATIONAL_GOALS } from './flOperationalGoals.js';

export const PRODUCT_FAMILY = {
  brand: 'DecisionPro',
  subtitle: 'Legislative Modeling & Decision Support System',
  evidenceBadge: 'Choose a state product · public aggregate / de-identified evidence only',
};

export const PRODUCT_STATES = {
  KY: {
    code: 'KY',
    name: 'Kentucky',
    brand: 'DecisionPro Kentucky',
    shortBrand: 'DPro-KY',
    subtitle: 'Legislative Modeling & Decision Support System',
    evidenceBadge: 'Public REAL + labeled gaps',
    routeHint: 'Kentucky product · ?state=KY',
  },
  FL: {
    code: 'FL',
    name: 'Florida',
    brand: 'DecisionPro Florida',
    shortBrand: 'DPro-FL',
    subtitle: 'Legislative Modeling & Decision Support System',
    evidenceBadge: 'AHCA and federal REAL + labeled gaps',
    routeHint: 'Florida product · ?state=FL',
  },
};

const CMS_MCPAR_PAGE = 'https://data.medicaid.gov/dataset/66da70e7-228e-41aa-b041-6f9e433ff237';
const CMS_MCPAR_CSV = 'https://download.medicaid.gov/data/mmcc-mcpar-puf-2024.csv';

const KY_METRICS = new Map(
  (KY_OPERATIONAL_SOURCES.metrics || []).map((metric) => [metric.metricId, metric]),
);

function kyMetric(id, fallback) {
  return KY_METRICS.get(id)?.numericValue ?? fallback;
}
const FL_METRICS = new Map((FL_OPERATIONAL_SOURCES.metrics || []).map((metric) => [metric.metricId, metric]));
function flMetric(id, fallback) { return FL_METRICS.get(id)?.numericValue ?? fallback; }

const HYDRATED_SOURCE_IDS = new Set(
  (KY_OPERATIONAL_SOURCES.metrics || [])
    .filter((metric) => metric.sourceStatus !== 'SOURCE_VERIFIED')
    .map((metric) => metric.fromSysId),
);
const VERIFIED_SOURCE_IDS = new Set(
  (KY_OPERATIONAL_SOURCES.metrics || []).map((metric) => metric.fromSysId),
);
const SOURCE_ID_MAP = {
  CMS_MCPAR_2024: 'CMS_MCPAR',
  CMS_PROVIDER_DATA: 'CMS_PROVIDER_DATA',
  HHS_OIG_LEIE: 'HHS_OIG_LEIE',
  USA_SPENDING: 'USA_SPENDING',
  KY_TRANSPARENCY: 'KY_TRANSPARENCY_SPEND',
  KY_OSBD: 'KY_OSBD_BUDGET',
  KY_DMS_CONTRACTS: 'KY_DMS_MCO_CONTRACTS',
  KY_OPEN_GIS: 'KY_OPEN_GIS',
};

function withHydrationStatus(source) {
  const fromSysId = SOURCE_ID_MAP[source.id];
  if (HYDRATED_SOURCE_IDS.has(fromSysId)) {
    return { ...source, status: 'hydrated', access: `${source.access} · retained PSA + normalized REAL load` };
  }
  if (VERIFIED_SOURCE_IDS.has(fromSysId)) {
    return { ...source, status: 'source-verified', access: `${source.access} · retained governed source manifest` };
  }
  return source;
}

function withFloridaHydrationStatus(source) {
  const fromSysId = SOURCE_ID_MAP[source.id];
  const hydrated = FL_OPERATIONAL_SOURCES.federalSources?.find((item) => item.fromSysId === fromSysId && item.status === 'REAL data hydrated');
  return hydrated ? { ...source, status: 'hydrated', access: `${source.access} · retained PSA + normalized Florida REAL load` } : source;
}

const SHARED_SOURCES = [
  {
    id: 'CMS_MCPAR_2024',
    label: 'CMS Managed Care Program Annual Report PUF 2024',
    publisher: 'Centers for Medicare & Medicaid Services',
    access: 'Official open-data API / CSV · no paid license',
    cadence: 'Annual',
    status: 'ready',
    href: CMS_MCPAR_PAGE,
    sourceFile: CMS_MCPAR_CSV,
    use: 'Plan financial performance, MLR, encounter reporting, grievances, appeals, access, quality, sanctions/CAPs, program integrity, and evolving prior-authorization reporting.',
    caveat: 'Annual and state-reported. Normalize denominators and reporting periods before comparing plans or states.',
  },
  {
    id: 'CMS_PROVIDER_DATA',
    label: 'CMS Provider Data Catalog',
    publisher: 'Centers for Medicare & Medicaid Services',
    access: 'Official open-data API / CSV · no registration currently required',
    cadence: 'Dataset-specific, often monthly',
    status: 'ready',
    href: 'https://data.cms.gov/provider-data/',
    use: 'Facility capacity, staffing, quality, ownership, deficiencies, fines, and payment denials for Medicare/Medicaid-certified facilities.',
    caveat: 'Medicare certification and quality context is not Medicaid claims or payment truth.',
  },
  {
    id: 'HHS_OIG_LEIE',
    label: 'HHS-OIG List of Excluded Individuals/Entities',
    publisher: 'HHS Office of Inspector General',
    access: 'Official public CSV',
    cadence: 'Monthly',
    status: 'ready',
    href: 'https://www.oig.hhs.gov/exclusions/leie-database-supplement-downloads/',
    use: 'Provider and vendor integrity screening; identify records requiring verified follow-up.',
    caveat: 'Matching requires identity resolution and source verification; a fuzzy match is never an adverse finding.',
  },
  {
    id: 'USA_SPENDING',
    label: 'USAspending API v2',
    publisher: 'U.S. Department of the Treasury',
    access: 'Public API · no authorization currently required',
    cadence: 'Federal reporting cadence',
    status: 'context',
    href: 'https://api.usaspending.gov/',
    use: 'Federal award, grant, recipient, and subaward context for health-program and technology investments.',
    caveat: 'Federal awards are context, not Kentucky or Florida state contract-payment truth.',
  },
];

const KY_SOURCES = [
  {
    id: 'KY_TRANSPARENCY',
    label: 'Kentucky Transparency spending and contract search',
    publisher: 'Commonwealth of Kentucky',
    access: 'Public search; no documented public API found',
    cadence: 'State accounting publication cadence',
    status: 'adapter-needed',
    href: 'https://transparency.ky.gov/search/Pages/spendingsearch.aspx',
    use: 'Contract and non-contract payments, vendor concentration, and payment-to-contract linkage.',
    caveat: 'Use a governed public-file/search adapter; do not treat an undocumented internal endpoint as a supported API.',
  },
  {
    id: 'KY_OSBD',
    label: 'Kentucky Office of State Budget Director publications',
    publisher: 'Commonwealth of Kentucky',
    access: 'Public PDF/office documents; no documented public budget API found',
    cadence: 'Budget biennium plus periodic fiscal reports',
    status: 'adapter-needed',
    href: 'https://osbd.ky.gov/pages/default.aspx',
    use: 'Enacted appropriations, executive recommendations, revenue estimates, and budget-to-actual baselines.',
    caveat: 'Document extraction needs table reconciliation and revision-aware provenance.',
  },
  {
    id: 'KY_DMS_CONTRACTS',
    label: 'Kentucky DMS MCO contracts and amendments',
    publisher: 'Kentucky Department for Medicaid Services',
    access: 'Public web/PDF',
    cadence: 'Contract term and amendment driven',
    status: 'catalogued',
    href: 'https://www.chfs.ky.gov/agencies/dms/dhpo/Pages/mco-contracts.aspx',
    use: 'Obligation, service-level, reporting, remedy, and amendment intelligence.',
    caveat: 'Contract text states obligations; it does not prove delivery or breach without performance evidence.',
  },
  {
    id: 'KY_OPEN_GIS',
    label: 'KyGovMaps Open Data and KyGeoNet services',
    publisher: 'Commonwealth of Kentucky',
    access: 'OGC search API and public ArcGIS REST services',
    cadence: 'Dataset-specific',
    status: 'ready',
    href: 'https://opengisdata.ky.gov/api/search/definition/',
    use: 'County, facility, transportation, and geography joins for access/capacity analysis.',
    caveat: 'Inspect each dataset metadata record for currency, accuracy, and reuse terms.',
  },
];

const FL_SOURCES = [
  {
    id: 'FL_AHCA_PLAN',
    label: 'AHCA Health Plan Transparency',
    publisher: 'Florida AHCA',
    access: 'Anonymous Tableau view; export currently permitted by workbook configuration',
    cadence: 'Publisher workbook/data cadence',
    status: 'source-observed',
    href: 'https://bi.ahca.myflorida.com/t/SMMCDashboard/views/HealthPlanTransparencyDashboard/HealthPlanTransparencyDashboard',
    use: 'Plan targets, prior-quarter values, peer rank, complaints, delivery-system performance, and source definitions.',
    caveat: 'Re-check robots and allow_export_data on every load; retain AHCA attribution and do not imply source-of-record replacement.',
  },
  {
    id: 'FL_AHCA_FINANCIAL',
    label: 'AHCA Medicaid financial and hospital financial dashboards',
    publisher: 'Florida AHCA',
    access: 'Anonymous Tableau view; export currently permitted by workbook configuration',
    cadence: 'Annual / publisher workbook cadence',
    status: 'source-observed',
    href: 'https://ahca.myflorida.com/medicaid/agency-dashboards.html',
    use: 'Managed-care service expenditures and hospital financial ratios.',
    caveat: 'Parameter-driven extracts require reconciliation against the rendered view before accurate claims.',
  },
  {
    id: 'FL_AHCA_PRIOR_AUTH',
    label: 'AHCA Prior Authorization Metrics',
    publisher: 'Florida AHCA',
    access: 'Anonymous Tableau view; export currently permitted by workbook configuration',
    cadence: 'Annual',
    status: 'source-observed',
    href: 'https://bi.ahca.myflorida.com/t/AgencyPublic/views/PriorAuthorization/PriorAuthorization',
    use: 'Approval, denial, appeal, timeliness, extension, and service-requirement comparisons by plan.',
    caveat: 'Compare within aligned plan/service populations; different plan types are not automatically peers.',
  },
  {
    id: 'FL_AHCA_COMPLIANCE',
    label: 'AHCA Managed Care Compliance Actions',
    publisher: 'Florida AHCA',
    access: 'Anonymous Tableau view; export currently permitted by workbook configuration',
    cadence: 'Quarterly / publisher update',
    status: 'source-observed',
    href: 'https://bi.ahca.myflorida.com/t/ABICC/views/MedicaidManagedCare_15604365119380/ActionsTaken',
    use: 'Corrective-action plans, liquidated damages, sanctions, categories, periods, and assessed amounts.',
    caveat: 'An action is evidence of an enforcement event, not proof that every associated dollar is recoverable waste.',
  },
  {
    id: 'FL_ELIGIBILITY_REPORTS',
    label: 'Florida Medicaid Eligible Reports',
    publisher: 'Florida AHCA',
    access: 'Public monthly PDF reports',
    cadence: 'Monthly',
    status: 'adapter-needed',
    href: 'https://ahca.myflorida.com/medicaid/medicaid-finance-and-analytics/medicaid-data-analytics/medicaid-eligible-reports.html',
    use: 'Age, assistance category, program group, sex, and county eligibility counts.',
    caveat: 'Corrects the draft ingestion spec: county-level eligibility reports are published, but they are documents rather than a supported API.',
  },
  {
    id: 'FL_FEE_SCHEDULES',
    label: 'Florida Medicaid provider fee schedules',
    publisher: 'Florida AHCA',
    access: 'Public publication pages/files',
    cadence: 'Effective-date driven',
    status: 'adapter-needed',
    href: 'https://ahca.myflorida.com/medicaid.html',
    use: 'Published reimbursement-rate context and effective-date comparisons.',
    caveat: 'Corrects the draft ingestion spec: fee schedules are published outside the Agency Dashboards index; rates are not paid-claims truth.',
  },
  {
    id: 'FL_RESTRICTED_EXPORTS',
    label: 'AHCA Quality Initiatives and malpractice workbooks',
    publisher: 'Florida AHCA',
    access: 'Public rendered view; data export currently disabled',
    cadence: 'Publisher workbook cadence',
    status: 'gap',
    href: 'https://ahca.myflorida.com/medicaid/agency-dashboards.html',
    use: 'Rendered reference only until export permission or another authoritative extract is available.',
    caveat: 'Never ingest when allow_export_data is false, even if an undocumented endpoint happens to return bytes.',
  },
];

const FL_SOURCE_META = {
  FL_AHCA_HPT: { id: 'FL_AHCA_HPT', use: 'Plan performance, targets, complaints, delivery-system performance, metric definitions, and upstream source descriptions.', caveat: 'Quarterly series remains gated until rendered-to-export reconciliation passes.' },
  FL_AHCA_QUALITY: { id: 'FL_AHCA_QUALITY', use: 'Potentially Preventable Events and Birth Outcomes rendered reference.', caveat: 'Data export is disabled by the publisher; reference only.' },
  FL_AHCA_FINANCIAL: { id: 'FL_AHCA_FINANCIAL', use: 'Annual managed-care financial summaries by transaction category.', caveat: 'Parameter-driven details require reconciliation before promotion.' },
  FL_AHCA_PACE: { id: 'FL_AHCA_PACE', use: 'PACE program and county statistics.', caveat: 'Program coverage and reporting period must be aligned before comparison.' },
  FL_AHCA_PRIORAUTH: { id: 'FL_AHCA_PRIORAUTH', use: 'Approval, denial, appeal, timeliness, extension, and service-requirement plan measures.', caveat: 'Plan/service populations and denominators must be aligned.' },
  FL_AHCA_BEDS: { id: 'FL_AHCA_BEDS', use: 'Licensed facility capacity by provider and bed type.', caveat: 'Licensed beds do not prove Medicaid participation or appointment availability.' },
  FL_AHCA_IMMIGRATION: { id: 'FL_AHCA_IMMIGRATION', use: 'Hospital reporting completeness and aggregate county expense context.', caveat: 'Aggregate institutional reporting cannot support person-level inference.' },
  FL_AHCA_HOSPITAL_FINANCIAL: { id: 'FL_AHCA_HOSPITAL_FINANCIAL', use: 'Hospital financial ratios and trends.', caveat: 'Parameter-driven export remains a reconciled-evidence requirement.' },
  FL_AHCA_PROVIDERS: { id: 'FL_AHCA_PROVIDERS', use: 'New provider/owner institutional applications and county/provider-type changes.', caveat: 'DecisionPro exports aggregates only; raw public contact fields stay in governed PSA.' },
  FL_AHCA_COMPLIANCE: { id: 'FL_AHCA_COMPLIANCE', use: 'Corrective actions, sanctions, liquidated damages, categories, and assessed amounts.', caveat: 'Assessed amounts are not automatically collected savings.' },
  FL_AHCA_MALPRACTICE: { id: 'FL_AHCA_MALPRACTICE', use: 'Malpractice claims rendered reference.', caveat: 'Data export is disabled by the publisher; reference only.' },
  FL_ELIGIBILITY_REPORTS: { id: 'FL_ELIGIBILITY_REPORTS', use: 'Current statewide and county Medicaid eligibility counts plus published month and year comparators.', caveat: 'Point-in-time eligibility is not average monthly enrollment, service use, paid claims, or proof of access.' },
  FL_FEE_SCHEDULES: { id: 'FL_FEE_SCHEDULES', use: 'Fee-schedule publication, format, category, and effective-date context.', caveat: 'Rates are not paid claims or contracted managed-care rates; copyrighted code descriptions are not republished.' },
};

const FL_GOVERNED_SOURCES = (FL_OPERATIONAL_SOURCES.sources || []).map((item) => ({
  ...(FL_SOURCE_META[item.fromSysId] || { id: item.fromSysId, use: 'Official Florida AHCA public dashboard evidence.', caveat: 'Verify definition, grain, period, and source limitation before use.' }),
  label: item.label,
  publisher: item.publisher,
  access: item.exportAllowed === true
    ? `${item.accessMethod || 'Official anonymous public export'} · retained PSA + normalized REAL aggregate load`
    : item.exportAllowed === false
      ? 'Rendered public reference · publisher data export disabled'
      : 'Load failed · see governed gap',
  cadence: item.cadence || 'Publisher workbook/data cadence',
  status: item.status === 'REAL data hydrated' ? 'hydrated' : item.status === 'GAP' ? 'gap' : 'adapter-needed',
  href: item.sourcePageUri,
}));

const OPERATING_LOOP = [
  {
    id: 'detect',
    label: 'Detect',
    text: 'Create a source-backed signal with period, grain, definition, and comparison basis.',
  },
  {
    id: 'validate',
    label: 'Validate',
    text: 'Reconcile the owning source, normalize denominators, and test alternative explanations.',
  },
  {
    id: 'act',
    label: 'Act',
    text: 'Assign an owner, intervention, due date, authority, and expected mechanism.',
  },
  {
    id: 'measure',
    label: 'Measure',
    text: 'Track leading and outcome measures against a baseline and defined review window.',
  },
  {
    id: 'learn',
    label: 'Learn',
    text: 'Retain the decision record; scale, revise, or stop based on observed results.',
  },
];

const KY_PLAYS = [
  {
    id: 'ky-mco-recovery',
    domain: 'Contract & program integrity',
    title: 'Reconcile MCO overpayment recovery and repeat enforcement topics',
    signal: 'MCPAR exposes plan-reported overpayments, program-integrity investigations, sanctions, and corrective-action topics at annual plan/program grain.',
    evidence: ['CMS_MCPAR_2024', 'KY_DMS_CONTRACTS', 'KY_TRANSPARENCY'],
    nextAction: 'Bind the 2024 Kentucky MCPAR rows, map each plan to its effective contract, and reconcile reported overpayment/recovery fields to public contract-payment records before opening a recovery case.',
    owner: 'Medicaid program integrity + contract management',
    validation: 'Percent of candidate dollars reconciled; confirmed recoveries; repeat finding rate after intervention.',
    guardrail: 'A reported overpayment or sanction topic is an investigation lead, not a finding of waste or misconduct.',
    readiness: 'source-ready',
  },
  {
    id: 'ky-encounter-quality',
    domain: 'Data reliability',
    title: 'Target encounter-data remediation where accountability data is least trustworthy',
    signal: 'MCPAR provides plan-level encounter timeliness and quality reporting alongside grievances, appeals, quality, and program-integrity measures.',
    evidence: ['CMS_MCPAR_2024', 'KY_DMS_CONTRACTS'],
    nextAction: 'Create a plan-quarter remediation queue that requires an owning contract clause, defect class, corrected-file due date, and reconciliation result.',
    owner: 'DMS data stewardship + MCO oversight',
    validation: 'Accepted encounter-file rate; correction cycle time; downstream measures released from data-quality hold.',
    guardrail: 'Do not rank plan outcomes when source completeness differs materially.',
    readiness: 'source-ready',
  },
  {
    id: 'ky-budget-variance',
    domain: 'Budget intelligence',
    title: 'Connect appropriations, payments, contract obligations, and outcomes',
    signal: 'Kentucky publishes budget documents and accounting searches, while DecisionPro already holds federal expenditure and enrollment context.',
    evidence: ['KY_OSBD', 'KY_TRANSPARENCY', 'USA_SPENDING'],
    nextAction: 'Build a revision-aware appropriation baseline, bind payments by agency/vendor/contract, then flag material variance only after timing, encumbrance, enrollment, and rate-change explanations are tested.',
    owner: 'Budget/fiscal analysis + agency finance',
    validation: 'Variance explanations resolved; lapsed/idle funds identified; actioned variance dollars; benefit-realization follow-through.',
    guardrail: 'Underspend, overspend, and vendor concentration are signals—not proof of inefficiency.',
    readiness: 'adapter-needed',
  },
  {
    id: 'ky-provider-integrity-access',
    domain: 'Provider integrity & access',
    title: 'Join provider integrity, facility performance, and geographic access',
    signal: 'CMS Provider Data, LEIE, NPPES/public directories, and Kentucky geospatial services can be joined without person-level Medicaid data.',
    evidence: ['CMS_PROVIDER_DATA', 'HHS_OIG_LEIE', 'KY_OPEN_GIS'],
    nextAction: 'Create deterministic facility/entity matches, separate integrity alerts from capacity gaps, and route every fuzzy match to human verification.',
    owner: 'Provider enrollment + quality + network oversight',
    validation: 'Verified match precision; unresolved access gaps; remediation time; post-remediation capacity/quality trend.',
    guardrail: 'Never treat a fuzzy identity match as an exclusion or adverse action.',
    readiness: 'source-ready',
  },
];

const KY_ACTION_EVIDENCE = {
  'KY-ACTION-ENCOUNTER-REMEDIATION': ['CMS_MCPAR_2024', 'KY_DMS_CONTRACTS'],
  'KY-ACTION-OVERPAYMENT-RECONCILIATION': ['CMS_MCPAR_2024', 'KY_DMS_CONTRACTS'],
  'KY-ACTION-PROVIDER-QUALITY-ACCESS': ['CMS_PROVIDER_DATA', 'HHS_OIG_LEIE', 'KY_OPEN_GIS'],
  'KY-ACTION-BUDGET-VARIANCE': ['KY_OSBD', 'KY_DMS_CONTRACTS', 'KY_TRANSPARENCY', 'USA_SPENDING'],
};

const KY_OPERATIONAL_PLAYS = KY_OPERATIONAL_SOURCES.actions?.length
  ? KY_OPERATIONAL_SOURCES.actions.map((action) => ({
      id: action.actionId,
      domain: action.domain,
      title: action.title,
      signal: action.signal,
      evidence: KY_ACTION_EVIDENCE[action.actionId] || [],
      nextAction: action.nextAction,
      owner: action.owner,
      validation: action.successMeasure,
      guardrail: action.guardrail,
      readiness: 'hydrated',
    }))
  : KY_PLAYS;

const FL_PLAYS = [
  {
    id: 'fl-plan-accountability',
    domain: 'Plan accountability',
    title: 'Join performance, prior authorization, complaints, and enforcement by plan and period',
    signal: 'AHCA separates these facts across dashboards; DPro-FL can reconcile them into one plan-period evidence chain.',
    evidence: ['FL_AHCA_HPT', 'FL_AHCA_PRIORAUTH', 'FL_AHCA_COMPLIANCE', 'CMS_MCPAR_2024'],
    nextAction: 'Load aligned plan/period/definition members, flag definition breaks, and create a review queue when multiple independent signals deteriorate.',
    owner: 'Plan oversight + quality + contract management',
    validation: 'Time from signal to validated case; corrective actions completed; recurrence and aligned outcome trend.',
    guardrail: 'No cross-plan ranking until plan type, population, service, and denominator are aligned.',
    readiness: 'source-observed',
  },
  {
    id: 'fl-spend-outcomes',
    domain: 'Budget intelligence',
    title: 'Test service-category expenditure growth against enrollment, quality, and access',
    signal: 'AHCA publishes annual MMA service expenditures; federal and AHCA sources provide enrollment and performance context.',
    evidence: ['FL_AHCA_FINANCIAL', 'FL_ELIGIBILITY_REPORTS', 'FL_AHCA_HPT', 'CMS_MCPAR_2024'],
    nextAction: 'Calculate per-member and mix-adjusted change, identify material residuals, then require a documented operational explanation before proposing remediation.',
    owner: 'Medicaid finance + actuarial + program operations',
    validation: 'Explained variance share; validated avoidable cost; savings realized without quality/access deterioration.',
    guardrail: 'Gross spending growth is not waste; enrollment, risk, benefit, price, and service mix must be separated.',
    readiness: 'adapter-needed',
  },
  {
    id: 'fl-prior-auth-friction',
    domain: 'Administrative efficiency',
    title: 'Identify avoidable prior-authorization friction without weakening clinical controls',
    signal: 'AHCA publishes approval, denial, appeal, timeliness, extension, and service-requirement measures by plan.',
    evidence: ['FL_AHCA_PRIORAUTH', 'CMS_MCPAR_2024'],
    nextAction: 'Normalize by service and request type, examine appeal overturns and extension use, then pilot gold-card, rule clarification, or automation only for validated high-friction/low-value categories.',
    owner: 'Clinical policy + plan oversight + provider relations',
    validation: 'Decision time; appeal/overturn rate; provider burden; inappropriate-use and quality balancing measures.',
    guardrail: 'High approval or denial rates alone do not establish correct or incorrect utilization management.',
    readiness: 'source-observed',
  },
  {
    id: 'fl-facility-access',
    domain: 'Facilities & access',
    title: 'Turn licensure, ownership, capacity, quality, and PACE data into access interventions',
    signal: 'AHCA publishes licensed beds, new providers/owners, and PACE; CMS provides facility quality, staffing, and penalties.',
    evidence: ['CMS_PROVIDER_DATA', 'HHS_OIG_LEIE', 'FL_AHCA_FINANCIAL'],
    nextAction: 'Build facility identity and county capacity baselines, then route capacity loss, quality deterioration, and ownership-change combinations to targeted validation.',
    owner: 'Facility regulation + Medicaid network oversight',
    validation: 'Verified access gaps; capacity restored; staffing/quality trend; intervention cycle time.',
    guardrail: 'Facility-level public data is institutional, but small-cell suppression and non-endorsement rules still apply.',
    readiness: 'source-observed',
  },
];

export const OPERATIONAL_INTELLIGENCE = {
  KY: {
    product: PRODUCT_STATES.KY,
    snapshot: {
      label: 'CMS MCPAR 2024 · Kentucky slice',
      rows: kyMetric('ky-mcpar-rows', 1018),
      questionIds: kyMetric('ky-mcpar-questions', 176),
      programs: kyMetric('ky-mcpar-programs', 1),
      reportingEntities: kyMetric('ky-mcpar-entities', 9),
      retrievedAt: KY_OPERATIONAL_SOURCES.generatedAt?.slice(0, 10) || '2026-08-27',
      source: CMS_MCPAR_PAGE,
      note: KY_OPERATIONAL_SOURCES.metricCount
        ? 'Hydrated from the retained official CSV through XenoDroid BW. Reporting entities include plans and state support systems; do not label every entity as an active MCO.'
        : 'Live official CSV probe. Reporting entities include plans and state support systems; do not label all nine as active MCOs.',
    },
    sources: [...SHARED_SOURCES, ...KY_SOURCES].map(withHydrationStatus),
    hydratedSources: KY_OPERATIONAL_SOURCES,
    goals: KY_OPERATIONAL_GOALS,
    plays: KY_OPERATIONAL_PLAYS,
    differentiator: 'Kentucky already has the richer legislative decision workflow; the new MCPAR bind fills plan-accountability gaps without waiting for a new state dashboard.',
    limitations: [
      'No public claim/encounter grain for causal cost attribution.',
      'Kentucky budget and contract documents are now retained and catalogued; table-level obligation extraction and payment-to-contract reconciliation still require governed validation.',
      'Kentucky Transparency is source-verified through the public portal, but no supported contract API is claimed; a supported export or governed operator extract is still needed for transaction-grain analytics.',
      'MCPAR is annual and state-reported, so period alignment and reconciliation are mandatory.',
    ],
  },
  FL: {
    product: PRODUCT_STATES.FL,
    snapshot: {
      label: 'CMS MCPAR 2024 · Florida slice',
      rows: flMetric('fl-mcpar-rows', 2501),
      questionIds: flMetric('fl-mcpar-questions', 182),
      programs: flMetric('fl-mcpar-programs', 4),
      reportingEntities: flMetric('fl-mcpar-entities', 17),
      retrievedAt: FL_OPERATIONAL_SOURCES.generatedAt?.slice(0, 10) || '2026-08-27',
      source: CMS_MCPAR_PAGE,
      note: 'Official federal Florida slice. Reporting entities span MMA, LTC, dental, support systems, and program variants; comparisons require aligned program membership.',
    },
    sources: [
      ...SHARED_SOURCES.map(withFloridaHydrationStatus),
      ...(FL_GOVERNED_SOURCES.length ? FL_GOVERNED_SOURCES : FL_SOURCES),
      ...FL_SOURCES.filter((item) => ['FL_ELIGIBILITY_REPORTS', 'FL_FEE_SCHEDULES'].includes(item.id) && !FL_GOVERNED_SOURCES.some((source) => source.id === item.id)),
    ],
    hydratedSources: FL_OPERATIONAL_SOURCES,
    goals: FL_OPERATIONAL_GOALS,
    plays: FL_PLAYS,
    differentiator: 'DPro-FL competes by joining AHCA domains into a single evidence-to-action record with cross-state federal benchmarks, not by reproducing eleven disconnected Tableau workbooks.',
    limitations: [
      'AHCA export permissions and robots policy can change and must be checked on every run.',
      'Quality Initiatives and malpractice data export are currently blocked and remain labeled gaps.',
      'Permitted AHCA exports, current eligibility aggregates, and fee-schedule publication metadata are retained through the governed REAL refresh; parameter-driven series and export-disabled workbooks remain explicit gaps.',
    ],
  },
};

export function normalizeProductState(value) {
  return String(value || '').toUpperCase() === 'FL' ? 'FL' : 'KY';
}

export function parseProductState(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.hasOwn(PRODUCT_STATES, normalized) ? normalized : null;
}

export function getProductState(value) {
  return PRODUCT_STATES[normalizeProductState(value)];
}

export function getOperationalIntelligence(value) {
  return OPERATIONAL_INTELLIGENCE[normalizeProductState(value)];
}

export { OPERATING_LOOP };
