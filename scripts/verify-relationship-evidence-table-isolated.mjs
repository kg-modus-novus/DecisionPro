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
const configuredBaseUrl = String(process.env.DECISIONPRO_UI_BASE_URL || '').trim();
if (!artifactDir || !desktopName) throw new Error('Launch this scenario with HiddenDesktopRunner.');

const requireFromCentral = createRequire('C:\\Augen Studios Dropbox\\Ken Greenwood\\The Scriptorium\\Scriptorium Central\\app\\local repo\\package.json');
const { chromium } = requireFromCentral('playwright-core');
const browserPath = await firstExisting([
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]);
const webPort = await allocatePort();
const logs = { consoleErrors: [], pageErrors: [] };
let staticServer;
let browserServer;
let browser;

try {
  if (!configuredBaseUrl) staticServer = await startStaticServer(path.join(repoPath, 'wireframe V1', 'app', 'dist'), webPort);
  browserServer = await chromium.launchServer({ executablePath: browserPath, headless: false, args: ['--disable-gpu', '--disable-background-networking', '--no-first-run'] });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const browserProcess = browserServer.process();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })).newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) logs.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => logs.pageErrors.push(error.message));

  const route = configuredBaseUrl ? `${configuredBaseUrl.replace(/\/+$/, '')}/?state=KY` : `http://127.0.0.1:${webPort}/?state=KY`;
  await page.goto(route, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.role-tile-select').first().click();
  await dismissWalkthrough(page);
  await page.getByRole('button', { name: 'Funding & Resilience', exact: true }).click();
  await page.getByRole('heading', { name: 'Funding & Resilience', exact: true }).waitFor();
  await dismissWalkthrough(page);
  await page.locator('.fr-clear-btn').click();
  const graph = page.locator('.fr-relationship-graph');
  await graph.locator('.fr-network-node-target').filter({ hasText: 'SEVEN COUNTIES SERVICES INC' }).click();

  const table = graph.locator('.fr-network-evidence table');
  await table.waitFor();
  const headings = await table.locator('th').allTextContents();
  if (JSON.stringify(headings) !== JSON.stringify(['Action date', 'Amount', 'Prime award', 'Sub-award number'])) throw new Error(`Unexpected table headings: ${JSON.stringify(headings)}`);
  const text = await table.textContent();
  const selectionText = await graph.locator('.fr-network-selection').textContent();
  if (!/6 sub-award actions from 1 prime organization/i.test(selectionText)) throw new Error('Aggregated sub-award action summary was not rendered.');
  if (!/\$19,882,018 across displayed funding relationships/i.test(selectionText)) throw new Error('Aggregated financial context was not rendered.');
  if (!/kentucky cabinet for health and family services/i.test(selectionText)) throw new Error('Reviewed cabinet name was not rendered.');
  if (/health services kentucky cabinet for/i.test(text)) throw new Error('Truncated raw publisher label remained visible in the evidence table.');
  if (await table.locator('tbody tr').count() !== 6) throw new Error('Evidence table did not render the six distinct sub-award actions.');
  if (!/PON2 729 2400003982/i.test(text) || !/\$3,973,426/i.test(text)) throw new Error('Distinguishing sub-award fields were not rendered.');
  if (logs.consoleErrors.length || logs.pageErrors.length) throw new Error(`Browser errors: ${[...logs.consoleErrors, ...logs.pageErrors].join(' | ')}`);

  const screenshot = 'ky-relationship-evidence-table.png';
  await graph.locator('.fr-network-selection').screenshot({ path: path.join(artifactDir, screenshot) });
  const sourceFiles = ['wireframe V1/app/src/components/RelationshipNetworkGraph.jsx', 'wireframe V1/app/src/data/alp/fundingResilienceRoom.js', 'wireframe V1/app/src/lib/relationshipGraphLayout.js', 'wireframe V1/app/src/styles.css'];
  const source = await Promise.all(sourceFiles.map(async (relativePath) => ({ relativePath, sha256: crypto.createHash('sha256').update(await readFile(path.join(repoPath, relativePath))).digest('hex') })));
  await writeJson('manifest.json', { schemaVersion: 1, evidenceClass: 'isolated-rendered', claim: 'The Seven Counties relationship is aggregated while its six distinct sub-award actions remain visible with meaningful transaction fields.', repoPath, route, deployment: configuredBaseUrl ? 'live' : 'local-production-build', executablePath: browserPath, browserVersion: await browser.version(), viewport: { width: 1600, height: 1000, deviceScaleFactor: 1, reducedMotion: 'reduce' }, processProof: { desktopName, driverPid: process.pid, browserPid: browserProcess?.pid }, assertions: ['One organization relationship represents six sub-award actions.', 'The six actions total $19,882,018.', 'Action date, amount, prime award, and sub-award number distinguish each row.', 'The reviewed Kentucky Cabinet for Health and Family Services name is visible.'], screenshots: [screenshot], source });
} catch (error) {
  await writeJson('failure.json', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null });
  throw error;
} finally {
  const cleanup = [];
  if (browser) await browser.close().catch((error) => cleanup.push({ target: 'browser', error: String(error) }));
  if (browserServer) await browserServer.close().catch((error) => cleanup.push({ target: 'browserServer', error: String(error) }));
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
  cleanup.push({ target: 'static-server', exited: true });
  await writeJson('cleanup-assertion.json', { passed: cleanup.every((item) => !item.error), results: cleanup });
  await writeJson('browser-console.json', logs);
}

console.log(JSON.stringify({ passed: true, evidenceClass: 'isolated-rendered', artifactDir }));

async function dismissWalkthrough(page) { const skip = page.getByRole('button', { name: 'Skip All', exact: true }); if (await skip.isVisible().catch(() => false)) await skip.click(); }
async function firstExisting(candidates) { for (const candidate of candidates) { try { await access(candidate); return candidate; } catch { /* continue */ } } throw new Error('No supported Chromium executable found.'); }
async function allocatePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close((error) => error ? reject(error) : resolve(address.port)); }); }); }
async function writeJson(name, value) { await writeFile(path.join(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
async function startStaticServer(root, port) { const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' }; const server = http.createServer(async (request, response) => { try { const requestPath = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname); const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, ''); let target = path.join(root, relative); if (!path.extname(target)) target = path.join(root, 'index.html'); const content = await readFile(target); response.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream' }); response.end(content); } catch { try { const content = await readFile(path.join(root, 'index.html')); response.writeHead(200, { 'content-type': 'text/html' }); response.end(content); } catch { response.writeHead(404); response.end('Not found'); } } }); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); return server; }
