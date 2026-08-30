import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'flOperationalSources.js');
const PSA_ROOT = path.join(ROOT, 'xenodroid-bw', 'var', 'psa', 'fl-ahca');
const BASE = 'https://bi.ahca.myflorida.com';
const USER_AGENT = 'DecisionProFL-DataRequest/1.0 (+https://decisionpro.io/data-requests)';
const MIN_DELAY_MS = Number(process.env.DPRO_FL_DELAY_MS || 3000);
const LARGE_DELAY_MS = Number(process.env.DPRO_FL_LARGE_DELAY_MS || 10000);
const REQUEST_CEILING = Number(process.env.DPRO_FL_REQUEST_CEILING || 60);
const LOAD_CLASS = process.env.DPRO_FL_LOAD_CLASS === 'TEST' ? 'TEST' : 'REAL';
const NO_WRITE = process.argv.includes('--no-write');
const MCPAR_PAGE = 'https://data.medicaid.gov/dataset/66da70e7-228e-41aa-b041-6f9e433ff237';
const MCPAR_CSV = 'https://download.medicaid.gov/data/mmcc-mcpar-puf-2024.csv';

export const WORKBOOKS = [
  { id: 'FL_AHCA_HPT', label: 'Health Plan Transparency', site: 'SMMCDashboard', workbook: 'HealthPlanTransparencyDashboard', view: 'HealthPlanTransparencyDashboard', sheets: [{ id: 'F-04', slug: 'MetricDetails', label: 'Health plan metric definitions', minRows: 20 }, { id: 'F-13', slug: 'HealthPlanTransparencyDashboard', label: 'Health plan transparency KPI', minRows: 1 }] },
  { id: 'FL_AHCA_QUALITY', label: 'Compare Medicaid Quality Initiatives', site: 'FLMedicaid', workbook: 'QualityInitiativesDashboard', view: 'QualityInitiatives', blockedGap: 'GAP-FL-QUALITY-INITIATIVES', sheets: [] },
  { id: 'FL_AHCA_FINANCIAL', label: 'Compare Medicaid Financial Data', site: 'FLMedicaid', workbook: 'CompareMedicaidFinancialData', view: 'FinancialSummarybyTransactionCategory', sheets: [{ id: 'F-12', slug: 'FinancialSummarybyTransactionCategory', label: 'Medicaid financial summary', minRows: 1 }] },
  { id: 'FL_AHCA_PACE', label: 'PACE Report', site: 'AgencyPublic', workbook: 'PACE', view: 'PACEReport', sheets: [{ id: 'F-05', slug: 'PACEReport', label: 'PACE program statistics', minRows: 1 }] },
  { id: 'FL_AHCA_PRIORAUTH', label: 'Prior Authorization Metrics', site: 'AgencyPublic', workbook: 'PriorAuthorization', view: 'PriorAuthorization', sheets: [{ id: 'F-07', slug: 'PriorAuthorization', label: 'Prior authorization metrics', minRows: 1 }] },
  { id: 'FL_AHCA_BEDS', label: 'Licensed Beds', site: 'ABICC', workbook: 'LicensedBeds', view: 'LicensedBedsDash', sheets: [{ id: 'F-02', slug: 'LicensedBedsReport', label: 'Licensed beds report', minRows: 100 }, { id: 'F-06', slug: 'LicensedBedsandProvidersReport', label: 'Licensed beds by provider type', minRows: 1 }, { id: 'F-10', slug: 'LicensedBedsDash', label: 'Licensed beds summary', minRows: 1 }] },
  { id: 'FL_AHCA_IMMIGRATION', label: 'Hospital Immigration Data', site: 'ABICC', workbook: 'IllegalAlienDataDashboard', view: 'HospitalImmigrationMap', sheets: [{ id: 'F-01', slug: 'DetailResponses', label: 'Hospital immigration detail', minRows: 13900 }, { id: 'F-09', slug: 'ExpensebyCounty', label: 'Hospital immigration expense by county', minRows: 1 }] },
  { id: 'FL_AHCA_HOSPITAL_FINANCIAL', label: 'Hospital Financial Data', site: 'ABICC', workbook: 'FinancialDataDashboard', view: 'FinancialDataDashboard', sheets: [{ id: 'F-14', slug: 'FinancialDataDashboard', label: 'Hospital financial KPI', minRows: 0, parameterDriven: true }] },
  { id: 'FL_AHCA_PROVIDERS', label: 'New Providers / Owners', site: 'ABICC', workbook: 'NewProviders-Owners', view: 'NewProviderOwnerMap', sheets: [{ id: 'F-03', slug: 'Report', label: 'New providers and owners', minRows: 100 }] },
  { id: 'FL_AHCA_COMPLIANCE', label: 'Managed Care Compliance Actions', site: 'ABICC', workbook: 'MedicaidManagedCare_15604365119380', view: 'ActionsTaken', sheets: [{ id: 'F-08', slug: 'ActionsbyCategory', label: 'Compliance actions by category', minRows: 1 }, { id: 'F-11', slug: 'ActionsTaken', label: 'Compliance actions KPI', minRows: 1 }] },
  { id: 'FL_AHCA_MALPRACTICE', label: 'Malpractice Claims', site: 'ABICC', workbook: 'AIRSAnnualReport', view: 'ReportingbyFieldOffice', blockedGap: 'GAP-FL-MALPRACTICE', sheets: [] },
];

export function decodeHtmlEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export function parseTableauConfig(html) {
  const match = html.match(/<textarea[^>]+id=["']tsConfigContainer["'][^>]*>([\s\S]*?)<\/textarea>/i);
  if (!match) throw new Error('Tableau configuration was not found');
  return JSON.parse(decodeHtmlEntities(match[1].trim()));
}

export function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = (rows.shift() || []).map((v) => v.trim());
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

export function permissionDisposition(config, workbook) {
  const allowed = config.allow_export_data === true || config.allow_export_data === 'true';
  return allowed
    ? { allowed: true, status: 'REAL data hydrated' }
    : { allowed: false, status: 'GAP', gapId: workbook.blockedGap || `GAP-${workbook.id}-EXPORT` };
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const number = (value) => Number(String(value ?? '').replace(/[$,%\s,]/g, '')) || 0;
const cell = (row, name) => row[name] ?? row[Object.keys(row).find((key) => key.toLowerCase() === name.toLowerCase())] ?? '';

function grouped(rows, keyFor, seed, accumulate) {
  const values = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    if (!key || String(key).includes('undefined')) continue;
    const current = values.get(key) || seed(row, key);
    accumulate(current, row);
    values.set(key, current);
  }
  return [...values.values()];
}

export function buildAnalyticalRows(sheet, rows) {
  if (sheet.id === 'F-01') {
    const county = grouped(rows, (row) => row.County, (row, key) => ({ county: key, hospitals: new Set(), reportingCells: 0, latestQuarter: '' }), (item, row) => {
      if (row['Hosp Name']) item.hospitals.add(row['Hosp Name']);
      item.reportingCells += 1;
      if (row['Year Quarter'] > item.latestQuarter) item.latestQuarter = row['Year Quarter'];
    }).map((item) => ({ ...item, hospitals: item.hospitals.size }));
    const series = grouped(rows, (row) => `${row['Year Quarter']}||${row['Measure Names']}`, (row) => ({ period: row['Year Quarter'], measure: row['Measure Names'], value: 0, hospitals: new Set() }), (item, row) => {
      item.value += number(row['Measure Values']);
      if (row['Hosp Name']) item.hospitals.add(row['Hosp Name']);
    }).map((item) => ({ ...item, hospitals: item.hospitals.size }));
    return { hospitalCountyCoverage: county, hospitalMeasureSeries: series };
  }
  if (sheet.id === 'F-02') {
    const counties = grouped(rows, (row) => row.County, (_row, key) => ({ county: key, facilities: new Set(), beds: 0 }), (item, row) => {
      if (row['File Number']) item.facilities.add(row['File Number']);
      item.beds += number(row['Sum of Bed Capacity']);
    }).map((item) => ({ ...item, facilities: item.facilities.size }));
    const types = grouped(rows, (row) => row['Provider Ty'], (_row, key) => ({ providerType: key, facilities: new Set(), beds: 0 }), (item, row) => {
      if (row['File Number']) item.facilities.add(row['File Number']);
      item.beds += number(row['Sum of Bed Capacity']);
    }).map((item) => ({ ...item, facilities: item.facilities.size }));
    return { facilityCapacityByCounty: counties, facilityCapacityByType: types };
  }
  if (sheet.id === 'F-03') {
    const counties = grouped(rows, (row) => row.County, (_row, key) => ({ county: key, applications: 0, providerTypes: new Set(), latestApproval: '' }), (item, row) => {
      item.applications += 1;
      if (row['Provider Type']) item.providerTypes.add(row['Provider Type']);
      if (new Date(row['Day of App Approved Date']) > new Date(item.latestApproval || 0)) item.latestApproval = row['Day of App Approved Date'];
    }).map((item) => ({ ...item, providerTypes: item.providerTypes.size }));
    return { providerApplicationsByCounty: counties };
  }
  if (sheet.id === 'F-05') {
    const counties = rows.map((row) => ({
      county: row.County,
      region: row.Region,
      organization: row['Agency/Agencies Present'],
      status: row['Agency Operational/Application Status'],
      enrollees: number(row['Number of Enrollees Present for (Current Month)']),
      individualsServed: number(row['Unique Individuals Served for the fiscal year up to this point']),
    }));
    return { paceCoverage: counties };
  }
  if (sheet.id === 'F-07') {
    return { priorAuthorizationByPlan: rows.map((row) => ({
      plan: row.Plan,
      measure: row['Measure Names'],
      percent: number(row.Percent),
      events: number(row['How many times this happened']),
      requests: number(row['Out of total requests']),
    })).filter((row) => row.plan) };
  }
  if (sheet.id === 'F-08') {
    return { complianceByCategory: rows.map((row) => ({
      category: row.Category,
      subcategory: row['Sub Category'],
      records: number(row['Number of Records'] || row['Count Label']),
      assessed: number(row['Final Amount Assessed']),
    })) };
  }
  return {};
}

class GovernedClient {
  cookies = new Map(); requestCount = 0; lastRequestAt = 0;
  async fetch(url, { largeExpected = false } = {}) {
    if (this.requestCount >= REQUEST_CEILING) throw new Error(`Request ceiling ${REQUEST_CEILING} reached`);
    const wait = Math.max(0, MIN_DELAY_MS - (Date.now() - this.lastRequestAt));
    if (wait) await sleep(wait);
    let last = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      this.requestCount += 1; this.lastRequestAt = Date.now();
      try {
        const response = await fetch(url, { headers: { Accept: '*/*', 'User-Agent': USER_AGENT, Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }, signal: AbortSignal.timeout(120000) });
        for (const raw of response.headers.getSetCookie?.() || []) { const [pair] = raw.split(';'); const at = pair.indexOf('='); if (at > 0) this.cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!response.ok || (!bytes.length && largeExpected)) throw new Error(`${response.status} ${response.statusText}${!bytes.length ? ' empty response' : ''}`);
        if (bytes.length > 262144) await sleep(LARGE_DELAY_MS);
        return { bytes, status: response.status, finalUrl: response.url || url, mediaType: response.headers.get('content-type') || '' };
      } catch (error) {
        last = error instanceof Error ? error.message : String(error);
        if (attempt < 2) await sleep(5000 * (2 ** attempt));
      }
    }
    throw new Error(`Fetch failed for ${url}: ${last}`);
  }
}

function sourcePage(w) { return `${BASE}/t/${w.site}/views/${w.workbook}/${w.view}`; }
function csvUrl(w, s) { return `${BASE}/t/${w.site}/views/${w.workbook}/${s.slug}.csv?:refresh=y`; }
function rowsAsOf(sheet, rows, published) {
  if (sheet.id === 'F-01') return rows.map((r) => r['Year Quarter']).filter(Boolean).sort().at(-1) || published;
  if (sheet.id === 'F-03') return rows.map((r) => r['Day of App Approved Date']).filter(Boolean).sort((a, b) => new Date(a) - new Date(b)).at(-1) || published;
  return published;
}

function metricSummaries(sheet, rows) {
  if (sheet.id === 'F-01') return [{ id: 'fl-immigration-detail-rows', label: 'Hospital reporting detail rows', value: rows.length, display: compact(rows.length), unit: 'rows' }, { id: 'fl-immigration-counties', label: 'Counties represented in hospital reporting', value: new Set(rows.map((r) => r.County).filter(Boolean)).size, unit: 'counties' }];
  if (sheet.id === 'F-02') return [{ id: 'fl-licensed-bed-records', label: 'Licensed-bed facility/type records', value: rows.length, unit: 'records' }, { id: 'fl-licensed-beds', label: 'Published licensed beds', value: rows.reduce((t, r) => t + number(r.Beds || r['Licensed Beds'] || r['Sum of Bed Capacity']), 0), unit: 'beds' }];
  if (sheet.id === 'F-03') return [{ id: 'fl-new-provider-applications', label: 'Published new provider/owner applications', value: rows.length, unit: 'applications' }, { id: 'fl-new-provider-counties', label: 'Counties with published new provider/owner applications', value: new Set(rows.map((r) => r.County).filter(Boolean)).size, unit: 'counties' }];
  if (sheet.id === 'F-04') return [{ id: 'fl-health-plan-metric-definitions', label: 'Health plan metric definitions with upstream source descriptions', value: rows.length, unit: 'metrics' }];
  if (sheet.id === 'F-05') return [{ id: 'fl-pace-records', label: 'PACE public report rows', value: rows.length, unit: 'rows' }];
  if (sheet.id === 'F-07') return [{ id: 'fl-prior-auth-records', label: 'Prior authorization plan/measure rows', value: rows.length, unit: 'rows' }, { id: 'fl-prior-auth-plans', label: 'Plans represented in prior authorization data', value: new Set(rows.map((r) => r.Plan).filter(Boolean)).size, unit: 'plans' }];
  if (sheet.id === 'F-08') return [{ id: 'fl-compliance-categories', label: 'Compliance action category/subcategory rows', value: rows.length, unit: 'rows' }, { id: 'fl-compliance-assessed', label: 'Published compliance amount assessed', value: rows.reduce((t, r) => t + number(r['Final Amount Assessed']), 0), unit: 'USD' }];
  return [{ id: `fl-${sheet.id.toLowerCase()}-rows`, label: sheet.label, value: rows.length, unit: 'rows' }];
}

function renderModule(payload) { return `/** Generated by refresh-florida-public-sources.mjs. Do not hand edit. */\nexport const FL_OPERATIONAL_SOURCES = ${JSON.stringify(payload, null, 2)};\n`; }

export async function runRefresh() {
  const client = new GovernedClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const robots = await client.fetch(`${BASE}/robots.txt`);
  const robotsText = robots.bytes.toString('utf8');
  if (!/User-agent:\s*\*/i.test(robotsText) || !/Allow:\s*\//i.test(robotsText) || !/ai-train=no/i.test(robotsText)) throw new Error('Publisher policy contract changed; review required before Florida load');
  const sources = []; const federalSources = []; const metrics = []; const gaps = []; const datasets = []; const analytics = {};
  try {
    const fetched = await client.fetch(MCPAR_CSV, { largeExpected: true });
    const rows = parseCsv(fetched.bytes.toString('utf8')).filter((row) => ['FL', 'FLORIDA'].includes(String(cell(row, 'state')).toUpperCase()));
    if (rows.length < 2000) throw new Error(`Florida MCPAR quality gate expected at least 2,000 rows; received ${rows.length}`);
    const contentHash = sha256(fetched.bytes);
    const periods = rows.map((row) => String(cell(row, 'reporting_period_end_date'))).filter(Boolean).sort();
    const asOfDate = periods.at(-1) || '2024-12-31';
    const definitions = [
      ['fl-mcpar-rows', 'Florida MCPAR response rows', rows.length, 'rows'],
      ['fl-mcpar-questions', 'Florida MCPAR question IDs', new Set(rows.map((row) => cell(row, 'question_id')).filter(Boolean)).size, 'questions'],
      ['fl-mcpar-programs', 'Florida MCPAR programs', new Set(rows.map((row) => cell(row, 'program')).filter(Boolean)).size, 'programs'],
      ['fl-mcpar-entities', 'Florida MCPAR reporting entities', new Set(rows.map((row) => cell(row, 'plan_or_bss')).filter(Boolean)).size, 'entities'],
    ];
    for (const [id, label, value, unit] of definitions) metrics.push({ metricId: id, label, numericValue: value, displayValue: value.toLocaleString('en-US'), unit, sourceStatus: 'REAL data hydrated', fromSysId: 'CMS_MCPAR', publisher: 'Centers for Medicare & Medicaid Services', asOfDate, sourcePageUri: MCPAR_PAGE, sourceUri: fetched.finalUrl, contentHash, limitation: 'Annual state-reported managed-care data; align program, entity, denominator, and period before comparison.' });
    analytics.mcparEntityCoverage = grouped(rows, (row) => cell(row, 'Plan_or_BSS') || cell(row, 'Program'), (row, key) => ({ entity: key, program: cell(row, 'Program'), responseRows: 0, questions: new Set(), numericResponses: 0 }), (item, row) => {
      item.responseRows += 1;
      const question = cell(row, 'Question_ID');
      if (question) item.questions.add(question);
      if (String(cell(row, 'Response')).trim() && Number.isFinite(Number(String(cell(row, 'Response')).replace(/[$,%\s,]/g, '')))) item.numericResponses += 1;
    }).map((item) => ({ ...item, questions: item.questions.size }));
    datasets.push({ datasetId: 'F-FED-01', label: 'CMS MCPAR 2024 Florida slice', fromSysId: 'CMS_MCPAR', rowCount: rows.length, byteLength: fetched.bytes.length, asOfDate, sourceUri: fetched.finalUrl, sourcePageUri: MCPAR_PAGE, contentHash, loadClass: LOAD_CLASS, retrievedAt: new Date().toISOString(), privacyTransform: 'Only Florida aggregate/state-reported managed-care rows and summary metrics enter the UI bundle.' });
    federalSources.push({ fromSysId: 'CMS_MCPAR', label: 'CMS Managed Care Program Annual Report PUF 2024', publisher: 'Centers for Medicare & Medicaid Services', status: 'REAL data hydrated', exportAllowed: true, sourcePageUri: MCPAR_PAGE, asOfDate, attribution: 'Source: CMS data.medicaid.gov. Public aggregate/state-reported evidence.' });
    if (!NO_WRITE) { const dir = path.join(PSA_ROOT, 'CMS_MCPAR', LOAD_CLASS, stamp); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'F-FED-01.csv'), fetched.bytes); }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    federalSources.push({ fromSysId: 'CMS_MCPAR', label: 'CMS Managed Care Program Annual Report PUF 2024', publisher: 'Centers for Medicare & Medicaid Services', status: 'FAILED', exportAllowed: true, sourcePageUri: MCPAR_PAGE, error: reason });
    gaps.push({ gapId: 'GAP-FL-CMS-MCPAR-LOAD', label: 'CMS MCPAR Florida slice', reason, sourcePageUri: MCPAR_PAGE, owner: 'DecisionPro data operations', unblock: 'Resolve the official current CMS download and rerun the governed Florida refresh.' });
  }
  for (const workbook of WORKBOOKS) {
    const pageUri = sourcePage(workbook);
    try {
      const page = await client.fetch(`${pageUri}?:embed=y&:isGuestRedirectFromVizportal=y`);
      const config = parseTableauConfig(page.bytes.toString('utf8'));
      const disposition = permissionDisposition(config, workbook);
      const publishedAt = config.workbookLastPublishedAt || null;
      const source = { fromSysId: workbook.id, label: workbook.label, publisher: 'Florida Agency for Health Care Administration', status: disposition.status, exportAllowed: disposition.allowed, viewUnderlyingAllowed: config.allow_view_underlying === true || config.allow_view_underlying === 'true', sourcePageUri: pageUri, workbookName: config.workbookName || workbook.workbook, workbookLuid: config.current_workbook_luid || '', viewId: config.current_view_id || '', workbookLastPublishedAt: publishedAt, visibleSheets: String(config.visible_sheets || '').split('|').filter(Boolean), attribution: 'Source: Florida AHCA. Reference use only; not a replacement source of record and not for model training.', configHash: sha256(page.bytes) };
      sources.push(source);
      if (!disposition.allowed) { gaps.push({ gapId: disposition.gapId, label: workbook.label, reason: 'Publisher workbook configuration has allow_export_data=false.', sourcePageUri: pageUri, owner: 'Florida AHCA / DecisionPro data governance', unblock: 'Obtain written export permission or an alternate authoritative published extract.' }); continue; }
      for (const sheet of workbook.sheets) {
        const uri = csvUrl(workbook, sheet);
        const fetched = await client.fetch(uri, { largeExpected: sheet.minRows > 100 });
        const text = fetched.bytes.toString('utf8').replace(/\uFFFD/g, "'");
        const rows = parseCsv(text);
        if (rows.length < sheet.minRows) throw new Error(`${sheet.id} quality gate expected at least ${sheet.minRows} rows; received ${rows.length}`);
        if (sheet.parameterDriven && rows.length === 0) gaps.push({ gapId: `GAP-FL-${sheet.id}-PARAMETERS`, label: sheet.label, reason: 'The permitted default export is empty because the view requires parameters; no values were promoted.', sourcePageUri: pageUri, owner: 'DecisionPro source reconciliation', unblock: 'Validate parameterized retrieval against the rendered dashboard before promoting values.' });
        const contentHash = sha256(fetched.bytes);
        const asOfDate = rowsAsOf(sheet, rows, publishedAt);
        datasets.push({ datasetId: sheet.id, label: sheet.label, fromSysId: workbook.id, rowCount: rows.length, byteLength: fetched.bytes.length, asOfDate, sourceUri: fetched.finalUrl, sourcePageUri: pageUri, contentHash, loadClass: LOAD_CLASS, retrievedAt: new Date().toISOString(), workbookLuid: source.workbookLuid, viewId: source.viewId, privacyTransform: sheet.id === 'F-03' ? 'Raw public owner/administrator, phone and street fields remain in governed PSA only; UI export contains aggregate counts only.' : 'UI export contains aggregate, non-person-level summaries only.' });
        Object.assign(analytics, buildAnalyticalRows(sheet, rows));
        for (const item of metricSummaries(sheet, rows)) metrics.push({ metricId: item.id, label: item.label, numericValue: item.value, displayValue: item.display || (item.unit === 'USD' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(item.value) : item.value.toLocaleString('en-US')), unit: item.unit, sourceStatus: 'REAL data hydrated', fromSysId: workbook.id, publisher: 'Florida AHCA', asOfDate, sourcePageUri: pageUri, sourceUri: fetched.finalUrl, contentHash, limitation: 'Public aggregate or institutional data is a decision-support signal, not claims-level payment truth or an automated finding.' });
        if (!NO_WRITE) { const dir = path.join(PSA_ROOT, workbook.id, LOAD_CLASS, stamp); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, `${sheet.id}.csv`), fetched.bytes); await fs.writeFile(path.join(dir, `${sheet.id}.config.json`), JSON.stringify(config, null, 2)); }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sources.push({ fromSysId: workbook.id, label: workbook.label, publisher: 'Florida AHCA', status: 'FAILED', exportAllowed: null, sourcePageUri: pageUri, error: message });
      gaps.push({ gapId: `GAP-${workbook.id}-LOAD`, label: workbook.label, reason: message, sourcePageUri: pageUri, owner: 'DecisionPro data operations', unblock: 'Re-run discovery after publisher availability and permission are verified.' });
    }
  }
  gaps.push({ gapId: 'GAP-FL-PLAN-QUARTERLY-SERIES', label: 'Full plan × metric × quarter series', reason: 'Parameterized series retrieval has not passed rendered-to-export reconciliation.', sourcePageUri: sourcePage(WORKBOOKS[0]), owner: 'DecisionPro data stewardship', unblock: 'Validate filter iteration against three rendered plan metrics before promotion.' });
  const payload = { schema: 'decisionpro/fl-operational-sources/v2', generatedAt: new Date().toISOString(), loadClass: LOAD_CLASS, productState: 'FL', publisherPolicy: { sourceUri: `${BASE}/robots.txt`, contentHash: sha256(robots.bytes), contentSignal: 'search=yes, ai-train=no, use=reference', userAgent: USER_AGENT, interpretation: 'Reference use with attribution; no model training, raw-file redistribution, or source-of-record replacement. Technical policy reading, not legal clearance.' }, completionBoundary: 'Permitted AHCA exports and the official CMS MCPAR Florida slice are hydrated as governed public aggregates. Source-native views preserve public interactions where extraction is restricted or parameterized; restricted values are never fabricated.', sourceCount: sources.length, federalSourceCount: federalSources.length, datasetCount: datasets.length, metricCount: metrics.length, sources, federalSources, datasets, metrics, analytics, gaps };
  if (!NO_WRITE) { await fs.mkdir(path.dirname(OUTPUT), { recursive: true }); await fs.writeFile(OUTPUT, renderModule(payload), 'utf8'); }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  runRefresh().then((payload) => process.stdout.write(`${JSON.stringify({ status: 'SUCCEEDED', sourceCount: payload.sourceCount, datasetCount: payload.datasetCount, metricCount: payload.metricCount, gapCount: payload.gaps.length, output: OUTPUT }, null, 2)}\n`)).catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
}
