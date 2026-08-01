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
};
