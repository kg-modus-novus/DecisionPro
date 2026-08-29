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
};
