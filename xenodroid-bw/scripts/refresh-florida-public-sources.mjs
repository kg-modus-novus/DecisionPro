import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'flOperationalSources.js');
const PSA_ROOT = path.join(ROOT, 'xenodroid-bw', 'var', 'psa', 'fl-ahca');
const BASE = 'https://bi.ahca.myflorida.com';
const PUBLIC_BASE = 'https://ahca.myflorida.com';
const USER_AGENT = 'DecisionProFL-DataRequest/1.0 (+https://decisionpro.io/data-requests)';
const MIN_DELAY_MS = Number(process.env.DPRO_FL_DELAY_MS || 3000);
const LARGE_DELAY_MS = Number(process.env.DPRO_FL_LARGE_DELAY_MS || 10000);
const REQUEST_CEILING = Number(process.env.DPRO_FL_REQUEST_CEILING || 60);
const LOAD_CLASS = process.env.DPRO_FL_LOAD_CLASS === 'TEST' ? 'TEST' : 'REAL';
const NO_WRITE = process.argv.includes('--no-write');
const MCPAR_PAGE = 'https://data.medicaid.gov/dataset/66da70e7-228e-41aa-b041-6f9e433ff237';
const MCPAR_CSV = 'https://download.medicaid.gov/data/mmcc-mcpar-puf-2024.csv';
const PROVIDER_DATA_PAGE = 'https://data.cms.gov/provider-data/dataset/4pq5-n9py';
const PROVIDER_DATA_API = 'https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0?conditions%5B0%5D%5Bproperty%5D=state&conditions%5B0%5D%5Bvalue%5D=FL&conditions%5B0%5D%5Boperator%5D=%3D&limit=1500';
const LEIE_PAGE = 'https://oig.hhs.gov/exclusions/leie-database-supplement-downloads/';
const LEIE_CSV = 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv';
const USASPENDING_PAGE = 'https://www.usaspending.gov/';
const USASPENDING_API = 'https://api.usaspending.gov/api/v2/search/spending_over_time/';
const ELIGIBILITY_PAGE = `${PUBLIC_BASE}/medicaid/medicaid-finance-and-analytics/medicaid-data-analytics/medicaid-eligible-reports.html`;
const FEE_SCHEDULE_PAGE = `${PUBLIC_BASE}/medicaid/rules/rule-59g-4.002-provider-reimbursement-schedules-and-billing-codes.html`;

const FLORIDA_COUNTIES = [
  'ALACHUA', 'BAKER', 'BAY', 'BRADFORD', 'BREVARD', 'BROWARD', 'CALHOUN', 'CHARLOTTE',
  'CITRUS', 'CLAY', 'COLLIER', 'COLUMBIA', 'DADE', 'DESOTO', 'DIXIE', 'DUVAL',
  'ESCAMBIA', 'FLAGLER', 'FRANKLIN', 'GADSDEN', 'GILCHRIST', 'GLADES', 'GULF',
  'HAMILTON', 'HARDEE', 'HENDRY', 'HERNANDO', 'HIGHLANDS', 'HILLSBOROUGH', 'HOLMES',
  'INDIAN RIVER', 'JACKSON', 'JEFFERSON', 'LAFAYETTE', 'LAKE', 'LEE', 'LEON', 'LEVY',
  'LIBERTY', 'MADISON', 'MANATEE', 'MARION', 'MARTIN', 'MONROE', 'NASSAU', 'OKALOOSA',
  'OKEECHOBEE', 'ORANGE', 'OSCEOLA', 'PALM BEACH', 'PASCO', 'PINELLAS', 'POLK',
  'PUTNAM', 'SANTA ROSA', 'SARASOTA', 'SEMINOLE', 'ST JOHNS', 'ST LUCIE', 'SUMTER',
  'SUWANNEE', 'TAYLOR', 'UNION', 'VOLUSIA', 'WAKULLA', 'WALTON', 'WASHINGTON',
];

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

const cleanHtmlText = (value) => decodeHtmlEntities(String(value || '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());

export function parseEligibilityInventory(html, pageUri = ELIGIBILITY_PAGE) {
  return [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const sourceUri = new URL(decodeHtmlEntities(match[1]), pageUri).href;
      const period = sourceUri.match(/\/(\d{6})_/i)?.[1] || null;
      return { period, reportType: cleanHtmlText(match[2]), sourceUri };
    })
    .filter((item) => item.period && /\.pdf(?:\?|$)/i.test(item.sourceUri));
}

export function parseFeeScheduleInventory(html, pageUri = FEE_SCHEDULE_PAGE) {
  const records = [];
  for (const rowMatch of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cleanHtmlText(match[1]));
    if (!cells.length) continue;
    const schedule = cells[0];
    const rowText = cleanHtmlText(rowHtml);
    const effectiveDates = [...new Set(rowText.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\b20\d{2}\b/gi) || [])];
    for (const link of rowHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const sourceUri = new URL(decodeHtmlEntities(link[1]), pageUri).href;
      const extension = sourceUri.match(/\.(pdf|xlsx?|csv)(?:\?|$)/i)?.[1]?.toLowerCase();
      if (!extension) continue;
      records.push({ schedule, documentLabel: cleanHtmlText(link[2]), mediaKind: extension, effectiveDates, sourceUri });
    }
  }
  return records;
}

function publishedNumber(value) {
  const text = String(value || '').trim();
  if (!/^\(?[\d,]+\)?$/.test(text)) return null;
  const parsed = Number(text.replace(/[(),]/g, ''));
  return text.startsWith('(') ? -parsed : parsed;
}

function valuesAfter(items, label, count = 11, fromIndex = 0) {
  const index = items.findIndex((item, itemIndex) => itemIndex >= fromIndex && item === label);
  if (index < 0) return null;
  const values = [];
  for (let cursor = index + 1; cursor < items.length && values.length < count; cursor += 1) {
    const value = publishedNumber(items[cursor]);
    if (value !== null) values.push(value);
  }
  return values.length === count ? { index, values } : null;
}

export function parseAgeByCountyItems(items) {
  const normalized = items.map((item) => String(item || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const counties = FLORIDA_COUNTIES.map((county) => {
    const found = valuesAfter(normalized, county);
    return found ? { county, ageBands: found.values.slice(0, 10), eligible: found.values[10] } : null;
  }).filter(Boolean);
  const state = valuesAfter(normalized, 'STATE TOTAL');
  const priorMonth = state ? valuesAfter(normalized, 'Last Month', 11, state.index + 1) : null;
  const priorYear = priorMonth ? valuesAfter(normalized, 'Last Year', 11, priorMonth.index + 1) : null;
  if (counties.length !== FLORIDA_COUNTIES.length || !state || !priorMonth || !priorYear) {
    throw new Error(`Eligibility PDF quality gate failed: ${counties.length}/67 counties and state comparison rows=${Boolean(state && priorMonth && priorYear)}`);
  }
  return {
    counties,
    stateTotal: state.values[10],
    priorMonthTotal: priorMonth.values[10],
    priorYearTotal: priorYear.values[10],
  };
}

async function pdfTextItems(bytes) {
  const pdf = await getDocument({ data: new Uint8Array(bytes), disableWorker: true }).promise;
  const items = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    items.push(...content.items.map((item) => item.str));
  }
  return items;
}

function periodEnd(period) {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
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
const compactUsd = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);
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
  async fetch(url, { largeExpected = false, method = 'GET', headers = {}, body } = {}) {
    if (this.requestCount >= REQUEST_CEILING) throw new Error(`Request ceiling ${REQUEST_CEILING} reached`);
    const wait = Math.max(0, MIN_DELAY_MS - (Date.now() - this.lastRequestAt));
    if (wait) await sleep(wait);
    let last = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      this.requestCount += 1; this.lastRequestAt = Date.now();
      try {
        const response = await fetch(url, { method, headers: { Accept: '*/*', 'User-Agent': USER_AGENT, Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...headers }, body, signal: AbortSignal.timeout(120000) });
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
  const publicRobots = await client.fetch(`${PUBLIC_BASE}/robots.txt`);
  const publicRobotsText = publicRobots.bytes.toString('utf8');
  if (!/User-agent:\s*\*/i.test(publicRobotsText) || !/Allow:\s*\//i.test(publicRobotsText) || !/ai-train=no/i.test(publicRobotsText)) throw new Error('AHCA public-site policy contract changed; review required before Florida document load');
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
  try {
    const fetched = await client.fetch(PROVIDER_DATA_API, { largeExpected: true, headers: { Accept: 'application/json' } });
    const rows = JSON.parse(fetched.bytes.toString('utf8')).results || [];
    if (rows.length < 500) throw new Error(`Provider Data quality gate expected at least 500 Florida rows; received ${rows.length}`);
    const contentHash = sha256(fetched.bytes);
    const asOfDate = rows.map((row) => String(cell(row, 'processing_date'))).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10);
    let beds = 0; let lowRated = 0; let fines = 0; let enforcementEvents = 0;
    for (const row of rows) {
      const rating = number(cell(row, 'overall_rating'));
      beds += number(cell(row, 'number_of_certified_beds'));
      fines += number(cell(row, 'total_amount_of_fines_in_dollars'));
      enforcementEvents += number(cell(row, 'number_of_fines')) + number(cell(row, 'number_of_payment_denials'));
      if (rating > 0 && rating <= 2) lowRated += 1;
    }
    analytics.cmsProviderCapacityByCounty = grouped(rows, (row) => cell(row, 'countyparish') || cell(row, 'county_parish'), (_row, key) => ({ county: key, facilities: 0, certifiedBeds: 0, lowRatedFacilities: 0 }), (item, row) => {
      item.facilities += 1;
      item.certifiedBeds += number(cell(row, 'number_of_certified_beds'));
      const rating = number(cell(row, 'overall_rating'));
      if (rating > 0 && rating <= 2) item.lowRatedFacilities += 1;
    });
    const definitions = [
      ['fl-provider-facilities', 'Florida Medicare/Medicaid-certified nursing facilities', rows.length, 'facilities', rows.length.toLocaleString('en-US')],
      ['fl-provider-beds', 'Certified nursing-facility beds', beds, 'beds', beds.toLocaleString('en-US')],
      ['fl-provider-low-rating', 'Nursing facilities with 1–2 overall stars', lowRated, 'facilities', lowRated.toLocaleString('en-US')],
      ['fl-provider-enforcement-events', 'Published fine/payment-denial events', enforcementEvents, 'events', enforcementEvents.toLocaleString('en-US')],
      ['fl-provider-fines', 'Published nursing-facility fine amount', fines, 'USD', compactUsd(fines)],
    ];
    for (const [id, label, value, unit, displayValue] of definitions) metrics.push({ metricId: id, label, numericValue: value, displayValue, unit, sourceStatus: 'REAL data hydrated', fromSysId: 'CMS_PROVIDER_DATA', publisher: 'Centers for Medicare & Medicaid Services', asOfDate, sourcePageUri: PROVIDER_DATA_PAGE, sourceUri: fetched.finalUrl, contentHash, limitation: 'Medicare certification, rating and enforcement context is not Medicaid claims, current network participation, appointment availability, or proof of wrongdoing.' });
    datasets.push({ datasetId: 'F-FED-02', label: 'CMS Provider Data Florida nursing-facility slice', fromSysId: 'CMS_PROVIDER_DATA', rowCount: rows.length, byteLength: fetched.bytes.length, asOfDate, sourceUri: fetched.finalUrl, sourcePageUri: PROVIDER_DATA_PAGE, contentHash, loadClass: LOAD_CLASS, retrievedAt: new Date().toISOString(), privacyTransform: 'Institutional public records only; the UI bundle contains county and statewide aggregates rather than facility contact details.' });
    federalSources.push({ fromSysId: 'CMS_PROVIDER_DATA', label: 'CMS Provider Data Catalog — Florida nursing facilities', publisher: 'Centers for Medicare & Medicaid Services', status: 'REAL data hydrated', exportAllowed: true, sourcePageUri: PROVIDER_DATA_PAGE, asOfDate, attribution: 'Source: CMS Provider Data Catalog. Public institutional evidence.' });
    if (!NO_WRITE) { const dir = path.join(PSA_ROOT, 'CMS_PROVIDER_DATA', LOAD_CLASS, stamp); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'F-FED-02.json'), fetched.bytes); }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    federalSources.push({ fromSysId: 'CMS_PROVIDER_DATA', label: 'CMS Provider Data Catalog — Florida nursing facilities', publisher: 'Centers for Medicare & Medicaid Services', status: 'FAILED', exportAllowed: true, sourcePageUri: PROVIDER_DATA_PAGE, error: reason });
    gaps.push({ gapId: 'GAP-FL-CMS-PROVIDER-LOAD', label: 'CMS Provider Data Florida slice', reason, sourcePageUri: PROVIDER_DATA_PAGE, owner: 'DecisionPro data operations', unblock: 'Resolve the current official CMS dataset version and rerun the governed Florida refresh.' });
  }
  try {
    const fetched = await client.fetch(LEIE_CSV, { largeExpected: true });
    const rows = parseCsv(fetched.bytes.toString('utf8')).filter((row) => String(cell(row, 'state')).toUpperCase() === 'FL');
    if (rows.length < 500) throw new Error(`LEIE quality gate expected at least 500 Florida-address rows; received ${rows.length}`);
    const groups = grouped(rows, (row) => cell(row, 'general') || 'UNCLASSIFIED', (_row, key) => ({ exclusionType: key, records: 0, individuals: 0, entities: 0, withNpi: 0 }), (item, row) => {
      item.records += 1;
      if (cell(row, 'busname')) item.entities += 1; else item.individuals += 1;
      const npi = String(cell(row, 'npi'));
      if (npi && npi !== '0000000000') item.withNpi += 1;
    });
    const aggregate = Buffer.from(JSON.stringify(groups, null, 2));
    const contentHash = sha256(fetched.bytes);
    const asOfDate = new Date().toISOString().slice(0, 10);
    const entities = groups.reduce((sum, group) => sum + group.entities, 0);
    const withNpi = groups.reduce((sum, group) => sum + group.withNpi, 0);
    analytics.leieExclusionSummary = groups;
    for (const [id, label, value] of [
      ['fl-leie-records', 'LEIE rows with Florida address', rows.length],
      ['fl-leie-entities', 'Florida-address business-name exclusion rows', entities],
      ['fl-leie-npi', 'Florida-address exclusion rows with published NPI', withNpi],
    ]) metrics.push({ metricId: id, label, numericValue: value, displayValue: value.toLocaleString('en-US'), unit: 'records', sourceStatus: 'REAL data hydrated', fromSysId: 'HHS_OIG_LEIE', publisher: 'HHS Office of Inspector General', asOfDate, sourcePageUri: LEIE_PAGE, sourceUri: fetched.finalUrl, contentHash, limitation: 'Address-state filtering is not an identity match, proof of Florida Medicaid participation, or authorization for adverse action. Verify exact identity in the official OIG system.' });
    datasets.push({ datasetId: 'F-FED-03', label: 'HHS-OIG LEIE Florida aggregate exclusion summary', fromSysId: 'HHS_OIG_LEIE', rowCount: groups.length, sourceRecordCount: rows.length, byteLength: aggregate.length, asOfDate, sourceUri: fetched.finalUrl, sourcePageUri: LEIE_PAGE, contentHash, loadClass: LOAD_CLASS, retrievedAt: new Date().toISOString(), privacyTransform: 'The official public file is read and hashed in memory; only aggregate exclusion-type counts are retained. Names, dates of birth and addresses are not written to the Florida PSA or UI bundle.' });
    federalSources.push({ fromSysId: 'HHS_OIG_LEIE', label: 'HHS-OIG List of Excluded Individuals/Entities — Florida aggregate', publisher: 'HHS Office of Inspector General', status: 'REAL data hydrated', exportAllowed: true, sourcePageUri: LEIE_PAGE, asOfDate, attribution: 'Source: HHS-OIG LEIE. DecisionPro retains aggregate Florida-address counts only.' });
    if (!NO_WRITE) { const dir = path.join(PSA_ROOT, 'HHS_OIG_LEIE', LOAD_CLASS, stamp); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'F-FED-03.aggregate.json'), aggregate); }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    federalSources.push({ fromSysId: 'HHS_OIG_LEIE', label: 'HHS-OIG LEIE — Florida aggregate', publisher: 'HHS Office of Inspector General', status: 'FAILED', exportAllowed: true, sourcePageUri: LEIE_PAGE, error: reason });
    gaps.push({ gapId: 'GAP-FL-LEIE-LOAD', label: 'HHS-OIG LEIE Florida aggregate', reason, sourcePageUri: LEIE_PAGE, owner: 'DecisionPro data operations', unblock: 'Resolve the current official public file and rerun the aggregate-only transform.' });
  }
  try {
    const now = new Date();
    const currentFiscalYear = now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    const end = now.toISOString().slice(0, 10);
    const requestBody = { group: 'fiscal_year', filters: { time_period: [{ start_date: '2022-10-01', end_date: end }], recipient_locations: [{ country: 'USA', state: 'FL' }], program_numbers: ['93.778'], award_type_codes: ['02', '03', '04', '05', 'F001', 'F002'] } };
    const fetched = await client.fetch(USASPENDING_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    const rows = JSON.parse(fetched.bytes.toString('utf8')).results || [];
    if (!rows.length) throw new Error('USAspending quality gate returned no Florida Assistance Listing 93.778 fiscal-year rows');
    const contentHash = sha256(fetched.bytes);
    const complete = [...rows].filter((row) => Number(row.time_period?.fiscal_year) < currentFiscalYear).sort((a, b) => Number(b.time_period?.fiscal_year) - Number(a.time_period?.fiscal_year))[0];
    const partial = rows.find((row) => Number(row.time_period?.fiscal_year) === currentFiscalYear);
    analytics.federalAwardSeries = rows.map((row) => ({ fiscalYear: Number(row.time_period?.fiscal_year), obligationAmount: Number(row.aggregated_amount) || 0, periodStatus: Number(row.time_period?.fiscal_year) === currentFiscalYear ? 'PARTIAL' : 'COMPLETE' }));
    for (const [id, label, row, periodStatus] of [
      ['fl-usaspending-latest-complete-fy', `FY${complete?.time_period?.fiscal_year} Florida 93.778 obligations`, complete, 'COMPLETE'],
      ['fl-usaspending-current-partial-fy', `FY${currentFiscalYear} Florida 93.778 obligations to date`, partial, 'PARTIAL'],
    ]) {
      if (!row) continue;
      const value = Number(row.aggregated_amount) || 0;
      metrics.push({ metricId: id, label, numericValue: value, displayValue: compactUsd(value), unit: 'USD', sourceStatus: 'REAL data hydrated', fromSysId: 'USA_SPENDING', publisher: 'U.S. Department of the Treasury', asOfDate: periodStatus === 'PARTIAL' ? end : `${row.time_period?.fiscal_year}-09-30`, sourcePageUri: USASPENDING_PAGE, sourceUri: fetched.finalUrl, contentHash, periodStatus, limitation: 'Federal award obligations are context, not Florida state-accounting payments, expenditures, savings, or a causal program-performance measure.' });
    }
    datasets.push({ datasetId: 'F-FED-04', label: 'USAspending Florida Assistance Listing 93.778 obligations by fiscal year', fromSysId: 'USA_SPENDING', rowCount: rows.length, byteLength: fetched.bytes.length, asOfDate: end, sourceUri: fetched.finalUrl, sourcePageUri: USASPENDING_PAGE, contentHash, loadClass: LOAD_CLASS, retrievedAt: new Date().toISOString(), privacyTransform: 'State/program/fiscal-year aggregate award context only.' });
    federalSources.push({ fromSysId: 'USA_SPENDING', label: 'USAspending Assistance Listing 93.778 — Florida', publisher: 'U.S. Department of the Treasury', status: 'REAL data hydrated', exportAllowed: true, sourcePageUri: USASPENDING_PAGE, asOfDate: end, attribution: 'Source: USAspending API. Federal obligation context by recipient location and fiscal year.' });
    if (!NO_WRITE) { const dir = path.join(PSA_ROOT, 'USA_SPENDING', LOAD_CLASS, stamp); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'F-FED-04.json'), fetched.bytes); }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    federalSources.push({ fromSysId: 'USA_SPENDING', label: 'USAspending Assistance Listing 93.778 — Florida', publisher: 'U.S. Department of the Treasury', status: 'FAILED', exportAllowed: true, sourcePageUri: USASPENDING_PAGE, error: reason });
    gaps.push({ gapId: 'GAP-FL-USASPENDING-LOAD', label: 'USAspending Florida 93.778 obligations', reason, sourcePageUri: USASPENDING_PAGE, owner: 'DecisionPro data operations', unblock: 'Resolve the official public API response and rerun the aggregate query.' });
  }
  try {
    const page = await client.fetch(ELIGIBILITY_PAGE);
    const inventory = parseEligibilityInventory(page.bytes.toString('utf8'), page.finalUrl);
    const latest = inventory.filter((item) => /^Age by County$/i.test(item.reportType)).sort((a, b) => a.period.localeCompare(b.period)).at(-1);
    if (inventory.length < 12 || !latest) throw new Error(`Eligibility inventory quality gate expected published monthly files; received ${inventory.length}`);
    const report = await client.fetch(latest.sourceUri, { largeExpected: true });
    const parsed = parseAgeByCountyItems(await pdfTextItems(report.bytes));
    const asOfDate = periodEnd(latest.period);
    const monthChange = parsed.stateTotal - parsed.priorMonthTotal;
    const yearChange = parsed.stateTotal - parsed.priorYearTotal;
    const monthChangePercent = parsed.priorMonthTotal ? (monthChange / parsed.priorMonthTotal) * 100 : 0;
    const yearChangePercent = parsed.priorYearTotal ? (yearChange / parsed.priorYearTotal) * 100 : 0;
    const pageHash = sha256(page.bytes);
    const reportHash = sha256(report.bytes);
    const retrievedAt = new Date().toISOString();
    sources.push({
      fromSysId: 'FL_ELIGIBILITY_REPORTS',
      label: 'Florida Medicaid Eligible Reports',
      publisher: 'Florida Agency for Health Care Administration',
      status: 'REAL data hydrated',
      exportAllowed: true,
      accessMethod: 'Ordinary public monthly PDF downloads',
      sourcePageUri: ELIGIBILITY_PAGE,
      workbookLastPublishedAt: asOfDate,
      attribution: 'Source: Florida AHCA Medicaid Data Analytics. Aggregate counts as of the last day of the published month.',
      configHash: pageHash,
      cadence: 'Monthly',
    });
    datasets.push(
      { datasetId: 'F-DOC-ELIG-INDEX', label: 'Florida Medicaid eligibility report inventory', fromSysId: 'FL_ELIGIBILITY_REPORTS', rowCount: inventory.length, byteLength: page.bytes.length, asOfDate, sourceUri: page.finalUrl, sourcePageUri: ELIGIBILITY_PAGE, contentHash: pageHash, loadClass: LOAD_CLASS, retrievedAt, privacyTransform: 'Only report type, month and official public document URI are normalized.' },
      { datasetId: `F-DOC-ELIG-AGE-COUNTY-${latest.period}`, label: `Medicaid eligibles by age and county ${latest.period}`, fromSysId: 'FL_ELIGIBILITY_REPORTS', rowCount: parsed.counties.length, byteLength: report.bytes.length, asOfDate, sourceUri: report.finalUrl, sourcePageUri: ELIGIBILITY_PAGE, contentHash: reportHash, loadClass: LOAD_CLASS, retrievedAt, privacyTransform: 'Published county and statewide aggregate counts only; no member-level records.' },
    );
    const eligibilityMetrics = [
      ['fl-medicaid-eligibles', 'Florida Medicaid eligibles', parsed.stateTotal, 'people', parsed.stateTotal.toLocaleString('en-US')],
      ['fl-medicaid-month-change', 'Monthly change in Florida Medicaid eligibles', monthChange, 'people', `${monthChange >= 0 ? '+' : ''}${monthChange.toLocaleString('en-US')}`],
      ['fl-medicaid-month-change-percent', 'Monthly percentage change in Florida Medicaid eligibles', monthChangePercent, 'percent', `${monthChangePercent >= 0 ? '+' : ''}${monthChangePercent.toFixed(2)}%`],
      ['fl-medicaid-year-change', 'Annual change in Florida Medicaid eligibles', yearChange, 'people', `${yearChange >= 0 ? '+' : ''}${yearChange.toLocaleString('en-US')}`],
      ['fl-medicaid-year-change-percent', 'Annual percentage change in Florida Medicaid eligibles', yearChangePercent, 'percent', `${yearChangePercent >= 0 ? '+' : ''}${yearChangePercent.toFixed(2)}%`],
      ['fl-medicaid-counties', 'Florida counties in current eligibility report', parsed.counties.length, 'counties', parsed.counties.length.toLocaleString('en-US')],
      ['fl-eligibility-report-files', 'Published eligibility report files inventoried', inventory.length, 'documents', inventory.length.toLocaleString('en-US')],
    ];
    for (const [id, label, value, unit, displayValue] of eligibilityMetrics) metrics.push({ metricId: id, label, numericValue: value, displayValue, unit, sourceStatus: 'REAL data hydrated', fromSysId: 'FL_ELIGIBILITY_REPORTS', publisher: 'Florida AHCA', asOfDate, sourcePageUri: ELIGIBILITY_PAGE, sourceUri: report.finalUrl, contentHash: reportHash, limitation: 'Point-in-time eligibility counts are not monthly averages, service use, paid claims, or proof of coverage access.' });
    analytics.eligibilityByCounty = parsed.counties;
    analytics.eligibilityTrend = [
      { period: latest.period, asOfDate, eligible: parsed.stateTotal, status: 'CURRENT' },
      { period: 'prior-month-comparator', eligible: parsed.priorMonthTotal, status: 'PUBLISHED_COMPARATOR' },
      { period: 'prior-year-comparator', eligible: parsed.priorYearTotal, status: 'PUBLISHED_COMPARATOR' },
    ];
    analytics.eligibilityReportInventory = inventory;
    if (!NO_WRITE) {
      const dir = path.join(PSA_ROOT, 'FL_ELIGIBILITY_REPORTS', LOAD_CLASS, stamp);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'eligibility-index.html'), page.bytes);
      await fs.writeFile(path.join(dir, `age-by-county-${latest.period}.pdf`), report.bytes);
      await fs.writeFile(path.join(dir, 'normalized-aggregate.json'), JSON.stringify({ asOfDate, ...parsed, inventory }, null, 2));
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    sources.push({ fromSysId: 'FL_ELIGIBILITY_REPORTS', label: 'Florida Medicaid Eligible Reports', publisher: 'Florida AHCA', status: 'FAILED', exportAllowed: null, sourcePageUri: ELIGIBILITY_PAGE, error: reason });
    gaps.push({ gapId: 'GAP-FL-ELIGIBILITY-DOCUMENT-LOAD', label: 'Florida Medicaid Eligible Reports', reason, sourcePageUri: ELIGIBILITY_PAGE, owner: 'DecisionPro data operations', unblock: 'Resolve the latest ordinary public report URI or parser definition and rerun the governed refresh.' });
  }
  try {
    const page = await client.fetch(FEE_SCHEDULE_PAGE);
    const inventory = parseFeeScheduleInventory(page.bytes.toString('utf8'), page.finalUrl);
    if (inventory.length < 40) throw new Error(`Fee-schedule inventory quality gate expected at least 40 public documents; received ${inventory.length}`);
    const contentHash = sha256(page.bytes);
    const retrievedAt = new Date().toISOString();
    const schedules = new Set(inventory.map((item) => item.schedule).filter(Boolean));
    const spreadsheets = inventory.filter((item) => ['xls', 'xlsx', 'csv'].includes(item.mediaKind));
    const dated2026Schedules = new Set(inventory.filter((item) => item.effectiveDates.some((date) => /2026/.test(date))).map((item) => item.schedule));
    sources.push({
      fromSysId: 'FL_FEE_SCHEDULES',
      label: 'Florida Medicaid provider fee schedules and billing codes',
      publisher: 'Florida Agency for Health Care Administration',
      status: 'REAL data hydrated',
      exportAllowed: true,
      accessMethod: 'Ordinary public publication page and linked files',
      sourcePageUri: FEE_SCHEDULE_PAGE,
      workbookLastPublishedAt: retrievedAt.slice(0, 10),
      attribution: 'Source: Florida AHCA Rule 59G-4.002 publication page. Inventory metadata only; linked schedules remain the source of record.',
      configHash: contentHash,
      cadence: 'Effective-date driven',
      rightsLimitation: 'CPT codes, descriptions and related data may carry American Medical Association copyright. DecisionPro does not republish code descriptions or raw rate tables in the public UI.',
    });
    datasets.push({ datasetId: 'F-DOC-FEE-INDEX', label: 'Florida Medicaid fee-schedule publication inventory', fromSysId: 'FL_FEE_SCHEDULES', rowCount: inventory.length, byteLength: page.bytes.length, asOfDate: retrievedAt.slice(0, 10), sourceUri: page.finalUrl, sourcePageUri: FEE_SCHEDULE_PAGE, contentHash, loadClass: LOAD_CLASS, retrievedAt, privacyTransform: 'Only schedule title, document label, format, effective-date text and authoritative URI are normalized; CPT descriptions and rate lines are not republished.' });
    const feeMetrics = [
      ['fl-fee-schedule-documents', 'Published fee-schedule and billing-code documents', inventory.length, 'documents'],
      ['fl-fee-schedule-types', 'Published fee-schedule and billing-code categories', schedules.size, 'categories'],
      ['fl-fee-schedule-spreadsheets', 'Published machine-readable fee-schedule files', spreadsheets.length, 'files'],
      ['fl-fee-schedule-current-year-categories', 'Fee-schedule categories carrying a 2026 effective-date reference', dated2026Schedules.size, 'categories'],
    ];
    for (const [id, label, value, unit] of feeMetrics) metrics.push({ metricId: id, label, numericValue: value, displayValue: value.toLocaleString('en-US'), unit, sourceStatus: 'REAL data hydrated', fromSysId: 'FL_FEE_SCHEDULES', publisher: 'Florida AHCA', asOfDate: retrievedAt.slice(0, 10), sourcePageUri: FEE_SCHEDULE_PAGE, sourceUri: page.finalUrl, contentHash, limitation: 'Publication inventory and effective-date context only. Published fee schedules are not paid claims, contracted managed-care rates, realized spending, or permission to republish copyrighted code descriptions.' });
    analytics.feeScheduleInventory = inventory;
    if (!NO_WRITE) {
      const dir = path.join(PSA_ROOT, 'FL_FEE_SCHEDULES', LOAD_CLASS, stamp);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'fee-schedule-index.html'), page.bytes);
      await fs.writeFile(path.join(dir, 'normalized-inventory.json'), JSON.stringify(inventory, null, 2));
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    sources.push({ fromSysId: 'FL_FEE_SCHEDULES', label: 'Florida Medicaid provider fee schedules and billing codes', publisher: 'Florida AHCA', status: 'FAILED', exportAllowed: null, sourcePageUri: FEE_SCHEDULE_PAGE, error: reason });
    gaps.push({ gapId: 'GAP-FL-FEE-SCHEDULE-INVENTORY', label: 'Florida Medicaid fee-schedule inventory', reason, sourcePageUri: FEE_SCHEDULE_PAGE, owner: 'DecisionPro data operations', unblock: 'Resolve the ordinary public publication page structure and rerun the governed refresh without extracting copyrighted descriptions.' });
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
  const payload = { schema: 'decisionpro/fl-operational-sources/v3', generatedAt: new Date().toISOString(), loadClass: LOAD_CLASS, productState: 'FL', publisherPolicy: { sourceUri: `${BASE}/robots.txt`, contentHash: sha256(robots.bytes), publicSiteSourceUri: `${PUBLIC_BASE}/robots.txt`, publicSiteContentHash: sha256(publicRobots.bytes), contentSignal: 'search=yes, ai-train=no, use=reference', userAgent: USER_AGENT, interpretation: 'Reference use with attribution; no model training, raw-file redistribution, source-of-record replacement, disabled-export bypass, or copyrighted code-description republication. Technical policy reading, not legal clearance.' }, completionBoundary: 'Permitted AHCA exports, ordinary public eligibility documents, fee-schedule publication metadata, and the official CMS MCPAR Florida slice are hydrated as governed public aggregates. Source-native views preserve public interactions where extraction is restricted or parameterized; restricted values are never fabricated.', sourceCount: sources.length, federalSourceCount: federalSources.length, datasetCount: datasets.length, metricCount: metrics.length, sources, federalSources, datasets, metrics, analytics, gaps };
  if (!NO_WRITE) { await fs.mkdir(path.dirname(OUTPUT), { recursive: true }); await fs.writeFile(OUTPUT, renderModule(payload), 'utf8'); }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  runRefresh().then((payload) => process.stdout.write(`${JSON.stringify({ status: 'SUCCEEDED', sourceCount: payload.sourceCount, datasetCount: payload.datasetCount, metricCount: payload.metricCount, gapCount: payload.gaps.length, output: OUTPUT }, null, 2)}\n`)).catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
}
