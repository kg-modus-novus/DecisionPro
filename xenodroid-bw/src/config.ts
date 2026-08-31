/**
 * XenoDroid BW local configuration.
 * PSA defaults to filesystem (S3 path-shaped). Postgres via docker compose port 5042.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BW_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(BW_ROOT, '..');

export const config = {
  databaseUrl:
    process.env.DECISIONPRO_BW_DATABASE_URL ??
    'postgres://decisionpro:decisionpro_poc_local@127.0.0.1:5042/xenodroid_bw',
  psaRoot: process.env.DECISIONPRO_BW_PSA_ROOT ?? path.join(BW_ROOT, 'data', 'psa'),
  exportPath:
    process.env.DECISIONPRO_BW_EXPORT_PATH ??
    path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'accurateLanding.js'),
  piDatasetCsvUrl:
    process.env.DECISIONPRO_BW_PI_CSV_URL ??
    'https://download.medicaid.gov/data/pi-dataset-june-2026-release.csv',
  piDatasetMetaUri:
    'https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360',
  mcoContractsPageUri: 'https://chfs.ky.gov/agencies/dms/dhpo/Pages/mco-contracts.aspx',
  mcparDatasetId: '66da70e7-228e-41aa-b041-6f9e433ff237',
  mcparCsvUri: 'https://download.medicaid.gov/data/mmcc-mcpar-puf-2024.csv',
  providerDataDatasetId: '4pq5-n9py',
  providerDataKyUri:
    'https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0?conditions%5B0%5D%5Bproperty%5D=state&conditions%5B0%5D%5Bvalue%5D=KY&conditions%5B0%5D%5Boperator%5D=%3D&limit=1500',
  leieCsvUri: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv',
  leiePageUri: 'https://www.oig.hhs.gov/exclusions/leie-database-supplement-downloads/',
  usaSpendingApiUri: 'https://api.usaspending.gov/api/v2/search/spending_over_time/',
  kyCountyServiceUri:
    'https://kygisserver.ky.gov/arcgis/rest/services/WGS84WM_Services/Ky_CountyShading_WGS84WM/MapServer/0',
  kyHospitalServiceUri:
    'https://kygisserver.ky.gov/arcgis/rest/services/WGS84WM_Services/Ky_Hospitals_WGS84WM/MapServer/0',
  kyTransparencyContractsUri: 'https://transparency.ky.gov/search/Pages/contractsearch.aspx',
  kyOsbdBudgetDocumentsUri: 'https://osbd.ky.gov/Publications/Pages/Budget-Documents.aspx',
  operationalSourcesExportPath:
    process.env.DECISIONPRO_BW_OPERATIONAL_SOURCES_EXPORT_PATH ??
    path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'kyOperationalSources.js'),
  recoveryReconciliationExportPath:
    process.env.DECISIONPRO_BW_RECOVERY_RECONCILIATION_EXPORT_PATH ??
    path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'kyRecoveryReconciliation.js'),

  // OFR-01: USAspending award/recipient-grain, state-neutral (KY + FL).
  usaSpendingAwardSearchUri: 'https://api.usaspending.gov/api/v2/search/spending_by_award/',
  usaSpendingAwardDetailBaseUri: 'https://api.usaspending.gov/api/v2/awards/',
  ofrStates: ['KY', 'FL'] as const,
  ofrAwardGrainWindowStart: '2022-10-01',
  // At minimum 93.775/93.777/93.778/93.791 per the OFR plan, plus SAMHSA/HRSA
  // listings that fund Medicaid-adjacent capacity (community health centers,
  // mental-health and substance-use block grants) so single-stream-dependency
  // review candidates are not limited to the core Medicaid grant alone.
  ofrAssistanceListings: [
    { code: '93.775', title: 'State Medicaid Fraud Control Units' },
    { code: '93.777', title: 'State Survey and Certification of Health Care Providers and Suppliers' },
    { code: '93.778', title: 'Medical Assistance Program (Medicaid; Title XIX)' },
    { code: '93.791', title: 'Money Follows the Person Rebalancing Demonstration' },
    { code: '93.224', title: 'Health Center Program (HRSA community health center capacity)' },
    { code: '93.958', title: 'Community Mental Health Services Block Grant (SAMHSA)' },
    { code: '93.959', title: 'Substance Abuse Prevention and Treatment Block Grant (SAMHSA)' },
  ] as const,
  federalAwardGrainExportPath:
    process.env.DECISIONPRO_BW_FEDERAL_AWARD_GRAIN_EXPORT_PATH ??
    path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'federalAwardGrain.js'),

  // OFR-02: identity crosswalk spine, state-neutral (KY + FL).
  samEntityApiUri: 'https://api.sam.gov/entity-information/v3/entities',
  irsEoBmfStateCsvUri: (state: string) => `https://www.irs.gov/pub/irs-soi/eo_${state.toLowerCase()}.csv`,
  cmsProviderDataStateUri: (state: string) =>
    `https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0?conditions%5B0%5D%5Bproperty%5D=state&conditions%5B0%5D%5Bvalue%5D=${state}&conditions%5B0%5D%5Boperator%5D=%3D&limit=1500`,
  nppesApiUri: 'https://npiregistry.cms.hhs.gov/api/',
  organizationCrosswalkExportPath:
    process.env.DECISIONPRO_BW_ORG_CROSSWALK_EXPORT_PATH ??
    path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'organizationCrosswalk.js'),

  // OFR-03: IRS Form 990 SOI annual extract (organization-level financials).
  // Two posting-year vintages give a minimal current-vs-prior-year trend.
  // Scope: Form 990 only (not 990-EZ/990-PF) — the dominant return for the
  // Medicaid-adjacent nonprofit population (community health centers,
  // behavioral-health providers) this package targets; documented scope
  // boundary, not a silent omission.
  irs990ExtractUris: [
    { vintage: '24', uri: 'https://www.irs.gov/pub/irs-soi/24eoextract990.zip' },
    { vintage: '23', uri: 'https://www.irs.gov/pub/irs-soi/23eoextract990.zip' },
  ] as const,
  nonprofitFinancialsExportPath:
    process.env.DECISIONPRO_BW_NONPROFIT_FINANCIALS_EXPORT_PATH ??
    path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'nonprofitFinancials.js'),

  // OFR-04: CMS HCRIS Hospital + SNF cost reports (most recent = FY2023 for both).
  hcrisHospitalCostReportUri: 'https://data.cms.gov/data-api/v1/dataset/44060663-47d8-4ced-a115-b53b4c270acb/data',
  hcrisSnfCostReportUri: 'https://data.cms.gov/data-api/v1/dataset/a69d3df7-3f66-4a0d-b5b8-0d66049bd565/data',
  facilityDistressExportPath:
    process.env.DECISIONPRO_BW_FACILITY_DISTRESS_EXPORT_PATH ??
    path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'facilityFinancialDistress.js'),

  // OFR-05: CMS ownership PUFs (Hospital + SNF "All Owners"). Hospice/HHA
  // are out of scope for this package (no existing KY/FL facility-name
  // base table to scope against without a new CCN source) — documented
  // scope boundary, not a silent omission.
  cmsOwnershipHospitalUri: 'https://data.cms.gov/data-api/v1/dataset/029c119f-f79c-49be-9100-344d31d10344/data',
  cmsOwnershipSnfUri: 'https://data.cms.gov/data-api/v1/dataset/afe44b85-cc6d-40d7-b5df-00ae8910d1d2/data',
  ownershipNetworkExportPath:
    process.env.DECISIONPRO_BW_OWNERSHIP_NETWORK_EXPORT_PATH ??
    path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'ownershipNetwork.js'),

  // OFR-06: USAspending subawards for the OFR-01 prime-award universe.
  usaSpendingSubawardsUri: 'https://api.usaspending.gov/api/v2/subawards/',
  subawardFlowGraphExportPath:
    process.env.DECISIONPRO_BW_SUBAWARD_FLOW_GRAPH_EXPORT_PATH ??
    path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'subawardFlowGraph.js'),
};
