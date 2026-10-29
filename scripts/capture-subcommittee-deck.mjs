// Captures the screenshots for the 2026-10-28 subcommittee update deck, in isolation.
// Run under HiddenDesktopRunner after `npm run build` in wireframe V1/app:
//   HiddenDesktopRunner.exe <repo> scripts/capture-subcommittee-deck.mjs 420 subcommittee-deck
// Writes one 1440x900 PNG per update and shots.json with the on-screen boxes of
// the elements each slide's callouts point at.
import { access, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const repoPath = process.cwd();
const appPath = path.join(repoPath, 'wireframe V1', 'app');
const artifactDir = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR;
const desktopName = process.env.SCRIPTORIUM_UI_DESKTOP_NAME;
if (!artifactDir || !desktopName) throw new Error('Launch this scenario with HiddenDesktopRunner.');

const { chromium } = loadPlaywright([
  'D:\\non-dbx-dev\\Scriptorium Central\\repos\\the-scriptorium\\package.json',
  'C:\\Augen Studios Dropbox\\Ken Greenwood\\The Scriptorium\\Scriptorium Central\\app\\local repo\\package.json',
]);
const browserPath = await firstExisting([
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]);
const port = await allocatePort();
const shots = [];
let staticServer;
let browserServer;
let browser;

// Each shot: nav tab, optional sub-tab, what to wait for, what to scroll to the top, and callout targets.
const PLAN = [
  { id: 'home', tab: 'At a glance', wait: '.sm-tiles', scroll: null, callouts: { age: '.sm-tile .sm-age', targets: '.sm-account-bar', fresh: '.sm-freshness' } },
  { id: 'card', tab: 'Health outcomes', wait: '.sm-measure', scroll: '#krs-a', before: 'card', callouts: { method: '.sm-estimate-pop', target: '#krs-a .sm-measure .sm-my-target', age: '#krs-a .sm-measure .sm-age' } },
  { id: 'states', tab: 'Compare states', wait: '[data-state-columns]', scroll: '[data-states-measure]', callouts: { columns: '[data-state-columns]', ky: '.sm-states-ky', peers: '.sm-peer-pick' } },
  { id: 'zips', tab: 'Medicaid in my county', subtab: 'zips', wait: '[data-zip-map] path[data-zcta]', scroll: '[data-zip-map]', before: 'zips', callouts: { map: '.sm-zip-svg', panel: '[data-zip-selection]', estimate: '[data-zip-selection] .sm-estimate-chip' } },
  { id: 'local', tab: 'Health outcomes', subtab: 'local', wait: '[data-local-outcomes] [data-local-measure]', scroll: '#local', callouts: { here: '[data-local-measure="mammography"] td', medicaid: '[data-local-measure="mammography"] td:nth-of-type(3)', method: '[data-local-measure="mammography"] .sm-method-btn' }, after: 'clear-area' },
  { id: 'rural', tab: 'Access to care', subtab: 'rural', wait: '[data-rural]', scroll: '#rural', callouts: { facts: '.sm-rural-facts', hpsa: '[data-rural] .sm-table', map: '[data-rural] .sm-map' } },
  { id: 'scenario', tab: 'Access to care', subtab: 'scenario', wait: '[data-scenario]', scroll: '#scenario', before: 'scenario', callouts: { slider: '.sm-scenario-slider', results: '[data-scenario] .sm-rural-facts', map: '[data-scenario] .sm-map' } },
  { id: 'svi', tab: 'Access to care', subtab: 'vulnerability', wait: '[data-svi-compare] [data-svi-quartile]', scroll: '#vulnerability', callouts: { table: '[data-svi-compare] .sm-table', scatter: '.sm-scatter' } },
  { id: 'drivers', tab: 'Spending', subtab: 'drivers-breakdown', wait: '[data-drivers] .sm-drivers li', scroll: '#drivers-breakdown', callouts: { bars: '[data-drivers] .sm-drivers', lede: '.sm-drivers-lede' } },
  { id: 'ledger', tab: 'Health plans (MCOs)', subtab: 'contract-ledger', wait: '[data-ledger] tr[data-contract]', scroll: '#contract-ledger', before: 'ledger', callouts: { status: '[data-ledger] tr[data-contract] .sm-status', detail: '.sm-ledger-detail', split: '[data-ledger] tr[data-contract] td:nth-of-type(4)' } },
  { id: 'hosp-margins', tab: 'Hospitals', subtab: 'margins', wait: '[data-hospital-margins] [data-tier]', scroll: '.sm-subtabs', callouts: { thirds: '.sm-thirds', medians: '.sm-hosp-medians' } },
  { id: 'hosp-prices', tab: 'Hospitals', subtab: 'prices', wait: '[data-hospital-prices] li', scroll: '.sm-subtabs', callouts: { ky: '[data-hospital-prices] .sm-states-ky', answer: '.sm-answer' } },
  { id: 'medicare', tab: 'Payment rates', subtab: 'medicare', wait: '[data-medicare-by-state] li', scroll: '.sm-subtabs', callouts: { lede: '[data-medicare-by-state] .sm-drivers-lede', ky: '[data-medicare-by-state] li.is-ky' } },
  { id: 'medicaid', tab: 'Payment rates', subtab: 'medicaid', wait: '[data-medicaid-vs-medicare] tr[data-fee-state]', scroll: '.sm-subtabs', callouts: { index: '[data-medicaid-vs-medicare] .sm-rural-facts', ky: 'tr[data-fee-state="KY"]', excluded: '[data-medicaid-vs-medicare] .sm-proxy' } },
  { id: 'spread', tab: 'Payment rates', subtab: 'spread', wait: '[data-payment-spread] .sm-measure', scroll: '.sm-subtabs', callouts: { ratio: '[data-payment-spread] .sm-measure .sm-trend-value', quality: '[data-payment-spread] .sm-measure .sm-proxy' } },
  { id: 'tmsis', tab: 'Payment rates', subtab: 'codes', wait: '[data-tmsis] li.is-ky', scroll: '.sm-subtabs', callouts: { ky: '[data-tmsis] .sm-states-ky', caveat: '[data-tmsis] .sm-proxy' } },
  { id: 'sme', tab: 'SME view', wait: '.role-home', scroll: null, callouts: { back: '.left-nav-scroll .nav-primary' } },
];

try {
  staticServer = await startStaticServer(path.join(appPath, 'dist'), port);
  browserServer = await chromium.launchServer({ executablePath: browserPath, headless: false, args: ['--disable-gpu', '--disable-background-networking', '--no-first-run'] });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  // Demo credentials are the project's own published demo values (DemoLoginGate.jsx).
  await page.getByLabel('Password', { exact: true }).fill('Xeno123');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.locator('.sm-home').waitFor();
  const nav = page.locator('.left-nav-scroll');

  for (const step of PLAN) {
    await nav.getByRole('button', { name: step.tab, exact: true }).click();
    if (step.subtab) await page.locator(`[data-subtab="${step.subtab}"]`).click();
    await page.locator(step.wait).first().waitFor({ timeout: 30_000 });
    if (step.before === 'zips') {
      await page.locator('[data-zip-map] select').nth(1).selectOption('21111');
      for (const zip of ['40203', '40211', '40212']) await page.locator(`path[data-zcta="${zip}"]`).click();
      await page.getByRole('button', { name: 'Use these zip codes as my area' }).click();
    }
    if (step.before === 'scenario') await page.locator('[data-scenario] input[type="range"]').fill('10');
    if (step.before === 'ledger') await page.locator('[data-ledger] tr[data-contract] .sm-link').first().click();
    if (step.scroll) {
      await page.locator(step.scroll).first().evaluate((el) => { el.scrollIntoView({ block: 'start' }); });
    } else {
      await page.evaluate(() => document.querySelector('.content-column')?.scrollTo(0, 0));
    }
    if (step.before === 'card') {
      const card = page.locator('#krs-a .sm-measure').first();
      await card.locator('.sm-my-target button').click();
      await card.locator('.sm-target-form input').first().fill('45');
      await card.locator('.sm-target-form button[type="submit"]').click();
      await card.locator('.sm-method-btn').click();
    }
    await page.waitForTimeout(400);
    const boxes = {};
    for (const [key, selector] of Object.entries(step.callouts)) {
      const box = await page.locator(selector).first().boundingBox().catch(() => null);
      if (box) boxes[key] = { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
    }
    const file = `${String(shots.length + 1).padStart(2, '0')}-${step.id}.png`;
    await page.screenshot({ path: path.join(artifactDir, file) });
    shots.push({ id: step.id, file, boxes });
    if (step.after === 'clear-area') await page.locator('.sm-filters select').nth(1).selectOption('');
    if (step.id === 'card') await page.keyboard.press('Escape');
  }
  await writeJson('shots.json', { viewport: { width: 1440, height: 900 }, shots });
} catch (error) {
  await writeJson('failure.json', { message: error instanceof Error ? error.message : String(error), shots });
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (browserServer) await browserServer.close().catch(() => {});
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
}

console.log(JSON.stringify({ passed: true, evidenceClass: 'isolated-rendered', artifactDir, shots: shots.length }));

function loadPlaywright(anchors) {
  for (const anchor of anchors) {
    try { return createRequire(anchor)('playwright-core'); } catch { /* try next */ }
  }
  throw new Error('playwright-core not found in Scriptorium Central.');
}

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* continue */ }
  }
  throw new Error('No supported Chromium executable found.');
}

async function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function writeJson(name, value) {
  await writeFile(path.join(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function startStaticServer(root, listenPort) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${listenPort}`).pathname);
      const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
      let target = path.join(root, relative);
      if (!path.extname(target)) target = path.join(root, 'index.html');
      const content = await readFile(target);
      response.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream' });
      response.end(content);
    } catch {
      const content = await readFile(path.join(root, 'index.html'));
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(content);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(listenPort, '127.0.0.1', resolve);
  });
  return server;
}
