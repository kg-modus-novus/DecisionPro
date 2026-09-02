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
  staticServer = await startStaticServer(path.join(repoPath, 'wireframe V1', 'app', 'dist'), webPort);
  browserServer = await chromium.launchServer({ executablePath: browserPath, headless: false, args: ['--disable-gpu', '--disable-background-networking', '--no-first-run'] });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const browserProcess = browserServer.process();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })).newPage();
  page.on('console', (message) => { if (message.type() === 'error') logs.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => logs.pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${webPort}/?state=KY`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.role-tile-select').first().click();
  await dismissWalkthrough(page);
  await page.getByRole('button', { name: 'Funding & Resilience', exact: true }).click();
  await page.getByRole('heading', { name: 'Funding & Resilience', exact: true }).waitFor();
  await dismissWalkthrough(page);
  await page.locator('.fr-clear-btn').click();
  const graph = page.locator('.fr-relationship-graph');
  await graph.locator('.fr-network-node-source').first().click();

  const table = graph.locator('.fr-network-evidence table');
  await table.waitFor();
  const headings = await table.locator('th').allTextContents();
  if (JSON.stringify(headings) !== JSON.stringify(['Assistance listing', 'Recipient EIN', 'Prime organization'])) throw new Error(`Unexpected table headings: ${JSON.stringify(headings)}`);
  const text = await table.textContent();
  if (!/kentucky cabinet for health and family services/i.test(text)) throw new Error('Reviewed cabinet name was not rendered.');
  if (/health services kentucky cabinet for/i.test(text)) throw new Error('Truncated raw publisher label remained visible in the evidence table.');
  if (await table.locator('tbody tr').count() < 1) throw new Error('Evidence table rendered no relationship rows.');
  if (logs.consoleErrors.length || logs.pageErrors.length) throw new Error(`Browser errors: ${[...logs.consoleErrors, ...logs.pageErrors].join(' | ')}`);

  const screenshot = 'ky-relationship-evidence-table.png';
  await graph.locator('.fr-network-selection').screenshot({ path: path.join(artifactDir, screenshot) });
  const sourceFiles = ['wireframe V1/app/src/components/RelationshipNetworkGraph.jsx', 'wireframe V1/app/src/data/alp/fundingResilienceRoom.js', 'wireframe V1/app/src/lib/relationshipGraphLayout.js', 'wireframe V1/app/src/styles.css'];
  const source = await Promise.all(sourceFiles.map(async (relativePath) => ({ relativePath, sha256: crypto.createHash('sha256').update(await readFile(path.join(repoPath, relativePath))).digest('hex') })));
  await writeJson('manifest.json', { schemaVersion: 1, evidenceClass: 'isolated-rendered', claim: 'The focused Kentucky prime organization presents relationship evidence in a headed table and uses the reviewed organization name instead of the truncated publisher label.', repoPath, route: `http://127.0.0.1:${webPort}/?state=KY`, executablePath: browserPath, browserVersion: await browser.version(), viewport: { width: 1600, height: 1000, deviceScaleFactor: 1 }, processProof: { desktopName, driverPid: process.pid, browserPid: browserProcess?.pid }, assertions: ['Table headings are Assistance listing, Recipient EIN, and Prime organization.', 'The reviewed Kentucky Cabinet for Health and Family Services name is visible.', 'The truncated HEALTH SERVICES KENTUCKY CABINET FOR label is absent from the table.'], screenshots: [screenshot], source });
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
