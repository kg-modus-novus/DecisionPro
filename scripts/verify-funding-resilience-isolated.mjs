import crypto from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const repoPath = process.cwd();
const artifactDir = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR;
const desktopName = process.env.SCRIPTORIUM_UI_DESKTOP_NAME;
if (!artifactDir || !desktopName) throw new Error('Launch this scenario with HiddenDesktopRunner.');

const centralPackage = 'C:\\Augen Studios Dropbox\\Ken Greenwood\\The Scriptorium\\Scriptorium Central\\app\\local repo\\package.json';
const requireFromCentral = createRequire(centralPackage);
const { chromium } = requireFromCentral('playwright-core');
const browserCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const browserPath = await firstExisting(browserCandidates);
const webPort = await allocatePort();
const logs = { browserConsole: [], consoleErrors: [], pageErrors: [] };
const assertions = [];
const screenshots = [];
let staticServer;
let browserServer;
let browser;
let cleanupPassed = false;

try {
  staticServer = await startStaticServer(path.join(repoPath, 'wireframe V1', 'app', 'dist'), webPort);
  await waitForHttp(`http://127.0.0.1:${webPort}/?state=KY`, 10_000);

  browserServer = await chromium.launchServer({
    executablePath: browserPath,
    headless: false,
    args: ['--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check'],
  });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const browserProcess = browserServer.process();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('console', (message) => {
    logs.browserConsole.push({ type: message.type(), text: message.text() });
    if (message.type() === 'error') logs.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => logs.pageErrors.push(error.message));

  await verifyState(page, 'KY', webPort, 34);
  await page.getByRole('button', { name: 'Operational intelligence', exact: true }).click();
  await dismissWalkthrough(page);
  await page.locator('.ops-goal-tile').filter({ hasText: 'Protect Program Integrity' }).click();
  await page.locator('.ops-opportunity-tile').filter({ hasText: 'Review common-ownership chains for chain-level context' }).click();
  const inferredLink = page.locator('.ops-goal-use-room-link');
  await inferredLink.waitFor();
  if (!/ownership relationship graph/i.test(await inferredLink.textContent())) throw new Error('Ownership recommendation did not expose the inferred relationship-graph control.');
  await inferredLink.click();
  await page.getByRole('heading', { name: 'Funding & Resilience', exact: true }).waitFor();
  await dismissWalkthrough(page);
  const activeOwnershipChip = page.locator('.fr-chip-active').filter({ hasText: 'Common-ownership chain' });
  if (await activeOwnershipChip.count() !== 1) throw new Error('Operational deep link did not pre-filter ownership evidence.');
  assertions.push('Protect Program Integrity ownership recommendation deep-linked to the pre-filtered Funding & Resilience ownership evidence.');
  await activeOwnershipChip.scrollIntoViewIfNeeded();
  await capture(page, 'ky-operational-ownership-deep-link.png');

  await verifyState(page, 'FL', webPort, 61);

  if (logs.consoleErrors.length || logs.pageErrors.length) {
    throw new Error(`Browser errors: ${[...logs.consoleErrors, ...logs.pageErrors].join(' | ')}`);
  }
  const source = await Promise.all([
    'wireframe V1/app/src/components/FundingResilienceRoom.jsx',
    'wireframe V1/app/src/components/FundingRunwayList.jsx',
    'wireframe V1/app/src/components/RelationshipNetworkGraph.jsx',
    'wireframe V1/app/src/components/OperationalActionWorkbench.jsx',
    'wireframe V1/app/src/data/alp/fundingResilienceRoom.js',
    'wireframe V1/app/src/lib/relationshipGraphLayout.js',
    'wireframe V1/app/src/lib/fundingRunway.js',
    'wireframe V1/app/src/lib/fundingRunwayGovernance.js',
    'wireframe V1/app/src/styles.css',
  ].map(async (relativePath) => {
    const bytes = await readFile(path.join(repoPath, relativePath));
    return { relativePath, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  }));
  await writeJson('manifest.json', {
    schemaVersion: 1,
    evidenceClass: 'isolated-rendered',
    claim: 'KY and FL Funding & Resilience provide deadline-ordered funding runway reporting with days remaining and governed continuation/gap states, plus informative interactive relationship graphs, actionable evidence playbooks, and recommendation-to-evidence navigation.',
    repoPath, route: `http://127.0.0.1:${webPort}/`, executablePath: browserPath,
    browserVersion: await browser.version(), viewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
    processProof: { desktopName, driverPid: process.pid, browserPid: browserProcess?.pid, staticServer: 'in-process production-dist server' },
    assertions, screenshots, source,
  });
} catch (error) {
  await writeJson('failure.json', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null });
  throw error;
} finally {
  const cleanup = [];
  if (browser) await browser.close().catch((error) => cleanup.push({ target: 'browser', error: String(error) }));
  if (browserServer) await browserServer.close().catch((error) => cleanup.push({ target: 'browserServer', error: String(error) }));
  if (staticServer) {
    await new Promise((resolve) => staticServer.close(resolve));
    cleanup.push({ target: 'static-server', exited: true });
  }
  cleanupPassed = cleanup.every((item) => !item.error && item.exited !== false);
  await writeJson('cleanup-assertion.json', { passed: cleanupPassed, results: cleanup });
  await writeJson('browser-console.json', logs.browserConsole);
}

if (!cleanupPassed) throw new Error('Isolated UI cleanup assertion failed.');
console.log(JSON.stringify({ passed: true, evidenceClass: 'isolated-rendered', artifactDir, assertions: assertions.length, screenshots }));

async function verifyState(page, state, port, singleStreamCount) {
  await page.goto(`http://127.0.0.1:${port}/?state=${state}`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.role-tile-select').first().click();
  await dismissWalkthrough(page);
  await page.getByRole('button', { name: 'Funding & Resilience', exact: true }).click();
  await page.getByRole('heading', { name: 'Funding & Resilience', exact: true }).waitFor();
  await dismissWalkthrough(page);
  const guideButtons = page.locator('.fr-how-to-use-btn');
  if (await guideButtons.count() < 7) throw new Error(`${state} did not render all guided workflows.`);
  const singleStreamChip = page.locator('.fr-chip').filter({ hasText: 'Single-stream funding dependency' });
  if (!new RegExp(`\\(${singleStreamCount}\\)`).test(await singleStreamChip.textContent())) throw new Error(`${state} single-stream row count was not rendered.`);
  await guideButtons.filter({ hasText: 'Check funding runway' }).click();
  const runway = page.locator('.fr-runway');
  await runway.waitFor();
  if (await runway.locator('.fr-runway-row').count() < 1) throw new Error(`${state} funding runway has no published deadlines.`);
  const runwayDates = await runway.locator('time').evaluateAll((nodes) => nodes.map((node) => node.dateTime));
  if (JSON.stringify(runwayDates) !== JSON.stringify([...runwayDates].sort())) throw new Error(`${state} funding runway was not ordered by expiration date.`);
  if (!/days left/i.test(await runway.locator('.fr-runway-days').first().textContent())) throw new Error(`${state} runway did not show days remaining.`);
  const runwayText = await runway.textContent();
  if (!/continuation unresolved/i.test(runwayText) || !/public continuation evidence has not yet been fully assessed/i.test(runwayText)) throw new Error(`${state} runway did not expose governed not-assessed continuation evidence.`);
  if (!/gap likelihood assessed\s*0/i.test(runwayText) || !/not assessable with the evidence currently loaded/i.test(runwayText)) throw new Error(`${state} runway overstated or omitted the gap-assessment limitation.`);
  if (!/organization type/i.test(runwayText) || !/award amount/i.test(runwayText) || !/assistance listing/i.test(runwayText)) throw new Error(`${state} runway omitted identity or award context.`);
  if (state === 'KY' && (!/kentucky cabinet for health and family services/i.test(runwayText) || !/publisher label: health services kentucky cabinet for/i.test(runwayText))) {
    throw new Error('KY runway did not use the reviewed cabinet display label with raw publisher provenance.');
  }
  await captureLocator(page.locator('.fr-content'), `${state.toLowerCase()}-funding-runway.png`);
  await runway.locator('.fr-runway-row').first().click();
  const runwayDetail = await page.locator('.fr-object-fields').textContent();
  if (!/time remaining/i.test(runwayDetail) || !/continuation/i.test(runwayDetail) || !/gap assessment/i.test(runwayDetail) || !/evidence still needed/i.test(runwayDetail)) throw new Error(`${state} runway drill-down omitted decision fields.`);
  await page.locator('.fr-back-btn').click();
  await page.locator('.fr-clear-btn').click();
  const graph = page.locator('.fr-relationship-graph');
  await graph.waitFor();
  const network = graph.locator('.fr-network-svg');
  await network.waitFor();
  if (await network.locator('.fr-network-node').count() < 2) throw new Error(`${state} relationship graph has fewer than two nodes.`);
  if (await network.locator('.fr-network-edge-hit').count() < 1) throw new Error(`${state} relationship graph has no graphical connections.`);
  if (!/organization/i.test(await network.locator('.fr-network-node-role').first().textContent())) throw new Error(`${state} funding nodes did not identify their entity role.`);
  if (!/funding shown/i.test(await network.locator('.fr-network-node-metric').first().textContent())) throw new Error(`${state} funding nodes did not show their displayed financial context.`);
  await network.hover();
  await page.mouse.wheel(0, -240);
  if (Number(await network.getAttribute('data-scale')) <= 1) throw new Error(`${state} mouse-wheel zoom did not change the graphical viewport.`);
  await graph.getByRole('button', { name: 'Fit', exact: true }).click();
  await network.locator('.fr-network-node').first().click();
  if (await network.locator('.fr-network-node.is-selected').count() !== 1) throw new Error(`${state} node focus did not select a node.`);
  const fundingDetail = await graph.locator('.fr-network-selection').textContent();
  if (!/entity type/i.test(fundingDetail) || !/financial context/i.test(fundingDetail) || !/across displayed funding relationships/i.test(fundingDetail)) {
    throw new Error(`${state} focused funding node did not explain entity and financial context.`);
  }
  await captureLocator(graph, `${state.toLowerCase()}-funding-resilience-subaward-graph.png`);
  await graph.locator('select').first().selectOption('ownership-chain');
  if (await network.locator('.fr-network-edge-hit').count() < 1) throw new Error(`${state} ownership graph has no graphical connections.`);
  if (await network.getAttribute('data-scale') !== '1.00') throw new Error(`${state} relationship-mode change did not reset the viewport.`);
  if (await network.locator('.fr-network-node.is-selected').count() !== 0) throw new Error(`${state} relationship-mode change retained a stale node selection.`);
  if (/pending a warehouse refresh/i.test(await graph.locator('.fr-graph-guidance').textContent())) {
    throw new Error(`${state} ownership graph showed stale facility-member guidance.`);
  }
  await network.locator('.fr-network-node-target').first().click();
  const ownershipDetail = await graph.locator('.fr-network-selection').textContent();
  if (!/matched facility/i.test(ownershipDetail) || !/no funding amount is represented/i.test(ownershipDetail)) {
    throw new Error(`${state} focused ownership node did not distinguish facility context from funding.`);
  }
  await captureLocator(graph, `${state.toLowerCase()}-funding-resilience-ownership-graph.png`);
  await network.locator('.fr-network-edge-hit').first().focus();
  await network.locator('.fr-network-edge-hit').first().press('Enter');
  const playbook = page.locator('.fr-playbook');
  await playbook.waitFor();
  const playbookText = await playbook.textContent();
  for (const label of ['Goal', 'What to look for', 'Steps', 'How to use the result', 'Success measure']) {
    if (!playbookText.includes(label)) throw new Error(`${state} playbook omitted ${label}.`);
  }
  if (await playbook.locator('ol li').count() < 3) throw new Error(`${state} playbook did not provide at least three steps.`);
  assertions.push(`${state} rendered a deadline-ordered funding runway with days remaining and honest continuation/gap states, seven guided workflows, ${singleStreamCount} single-stream candidates, entity and financial node details, both graphical network modes, cursor-centered mouse-wheel zoom, and a complete edge action playbook.`);
  await capture(page, `${state.toLowerCase()}-funding-resilience-ownership-playbook.png`);
}

async function capture(page, name) {
  await page.screenshot({ path: path.join(artifactDir, name), fullPage: false });
  screenshots.push(name);
}

async function captureLocator(locator, name) {
  await locator.screenshot({ path: path.join(artifactDir, name) });
  screenshots.push(name);
}

async function dismissWalkthrough(page) {
  const skip = page.getByRole('button', { name: 'Skip All', exact: true });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.locator('.walkthrough-layer').waitFor({ state: 'detached' }).catch(() => {});
  }
}

async function firstExisting(candidates) {
  for (const candidate of candidates) { try { await access(candidate); return candidate; } catch { /* continue */ } }
  throw new Error('No supported Chromium executable found.');
}

async function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return; lastError = new Error(String(response.status)); }
    catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function startStaticServer(root, port) {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const candidate = path.resolve(root, relative);
      if (!candidate.startsWith(path.resolve(root))) throw new Error('Invalid static path.');
      let body;
      try { body = await readFile(candidate); }
      catch { body = await readFile(path.join(root, 'index.html')); }
      response.writeHead(200, { 'content-type': mime[path.extname(candidate)] || 'application/octet-stream' });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain' });
      response.end(String(error));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

async function writeJson(name, value) {
  await writeFile(path.join(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
