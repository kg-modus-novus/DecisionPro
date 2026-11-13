import { access, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

/**
 * Isolated-rendered verification for direct links (lib/workspaceLinks.js): each of the five oversight pages of
 * Potential Fraud Detection, and one evidence room, opened cold from its link, through the demo sign-in, lands on
 * that page and keeps the address. Takes a top-of-page screenshot of each. Launch only through the Scriptorium
 * HiddenDesktopRunner so the static server, the driver and the headed browser share one hidden interactive desktop.
 */
const repoPath = process.cwd();
const artifactDir = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR;
const desktopName = process.env.SCRIPTORIUM_UI_DESKTOP_NAME;
if (!artifactDir || !desktopName) throw new Error('Launch this scenario with HiddenDesktopRunner.');

const requireFromCentral = createRequire(['D:/non-dbx-dev/Scriptorium Central/repos/the-scriptorium/package.json', 'C:/Augen Studios Dropbox/Ken Greenwood/The Scriptorium/Scriptorium Central/app/local repo/package.json'].find((candidate) => existsSync(candidate)) ?? 'D:/non-dbx-dev/Scriptorium Central/repos/the-scriptorium/package.json');
const { chromium } = requireFromCentral('playwright-core');
const browserPath = await firstExisting([
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]);

const LINKS = [
  { name: 'link-1-early-warning.png', query: 'role=legislator&go=fraud&fraud=early&fstate=KY', heading: /^Early warning · Kentucky/ },
  { name: 'link-2-follow-the-billers.png', query: 'role=legislator&go=fraud&fraud=follow&fstate=KY', heading: /^Follow the billers/ },
  { name: 'link-3-provider-patterns.png', query: 'role=legislator&go=fraud&fraud=patterns&fstate=KY', heading: /^Provider patterns · Kentucky/ },
  { name: 'link-4-explanation-ledger.png', query: 'role=legislator&go=fraud&fraud=ledger&fstate=KY', heading: /^Explanation ledger · Kentucky/ },
  { name: 'link-5-state-oversight-brief.png', query: 'role=legislator&go=fraud&fraud=brief&fstate=KY', heading: /oversight brief · Kentucky/ },
  { name: 'link-6-evidence-room.png', query: 'role=oversight-auditor&go=evidence&room=mco', heading: /^MCO Accountability/ },
  // A HIGH case file whose 2024 dollars went to 6 billers: the page shows no dollar figure, share or top-ten share.
  { name: 'link-7-withheld-case-file.png', query: 'role=legislator&go=fraud&fraud=cases&fstate=NJ&fid=NJ%7C99499%7C2024', heading: /99499/, expect: { selector: '.pfd-case-sentence', text: /went to fewer than 11 billers, so the dollars and its share of US payments are withheld/ }, absent: { selector: '.pfd-case-facts', text: /Top 10 take \d/ } },
];

const webPort = await allocatePort();
const liveBase = (process.env.DIRECT_LINKS_BASE_URL ?? '').replace(/\/+$/, '');
const siteBase = liveBase || `http://127.0.0.1:${webPort}`;
const logs = { consoleErrors: [], pageErrors: [] };
const assertions = [];
const screenshots = [];
let staticServer;
let browserServer;
let browser;
let activePage;

try {
  // DIRECT_LINKS_BASE_URL (e.g. https://demo.decisionpro.io) checks a deployed site instead of the local build.
  if (!liveBase) staticServer = await startStaticServer(path.join(repoPath, 'wireframe V1', 'app', 'dist'), webPort);
  browserServer = await chromium.launchServer({ executablePath: browserPath, headless: false, args: ['--disable-gpu', '--disable-background-networking', '--no-first-run'] });
  browser = await chromium.connect(browserServer.wsEndpoint());
  for (const link of LINKS) {
    // A fresh context per link: the sign-in is in memory, so each link is opened as a new visitor would.
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.addInitScript(() => sessionStorage.setItem('decisionpro.explainers.off', '1'));
    const page = await context.newPage();
    activePage = page;
    // A failed load is judged by its URL (the console message carries none); the site has no favicon, which is not a defect.
    page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) logs.consoleErrors.push(message.text()); });
    page.on('response', (response) => { if (response.status() >= 400 && new URL(response.url()).pathname !== '/favicon.ico') logs.consoleErrors.push(`${response.status()} ${response.url()}`); });
    page.on('pageerror', (error) => logs.pageErrors.push(error.message));
    const address = `/?state=KY&view=sme&${link.query}`;
    await page.goto(`${siteBase}${address}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await signInWithDemoCredentials(page);
    await dismissWalkthrough(page);
    const heading = page.locator('h1, h2').filter({ hasText: link.heading }).first();
    await heading.waitFor({ state: 'visible', timeout: 30_000 });
    await dismissWalkthrough(page);
    const roleSelector = await page.locator('.role-tile-select').count();
    if (roleSelector) throw new Error(`${link.query}: the role selector showed`);
    const search = await page.evaluate(() => window.location.search);
    const expected = new URLSearchParams(link.query);
    const actual = new URLSearchParams(search);
    if (link.expect) {
      const shown = (await page.locator(link.expect.selector).first().textContent()) ?? '';
      if (!link.expect.text.test(shown)) throw new Error(`${link.query}: ${link.expect.selector} reads "${shown.slice(0, 200)}"`);
      const other = (await page.locator(link.absent.selector).first().textContent()) ?? '';
      if (link.absent.text.test(other)) throw new Error(`${link.query}: ${link.absent.selector} still shows "${other.slice(0, 200)}"`);
      assertions.push(`${link.query}: ${link.expect.selector} reads "${shown.trim().slice(0, 140)}" and ${link.absent.selector} shows no top-ten share.`);
    }
    for (const [key, value] of expected) {
      if (actual.get(key) !== value) throw new Error(`${link.query}: address lost ${key}=${value} (now ${search})`);
    }
    await page.evaluate(() => { document.querySelector('.pfd-main')?.scrollTo(0, 0); window.scrollTo(0, 0); });
    await page.screenshot({ path: path.join(artifactDir, link.name), fullPage: false });
    screenshots.push(link.name);
    assertions.push(`${address} opens "${(await heading.textContent()).trim().slice(0, 90)}" after sign-in, with no role selector, and the address still names the page.`);
    await context.close();
  }
  if (logs.consoleErrors.length || logs.pageErrors.length) throw new Error(`Browser errors: ${[...logs.consoleErrors, ...logs.pageErrors].join(' | ')}`);
  await writeJson('manifest.json', {
    schemaVersion: 1,
    evidenceClass: 'isolated-rendered',
    claim: 'A direct link to any of the five oversight pages of Potential Fraud Detection, a case file, or an evidence room opens that page after the demo sign-in and keeps the page in the address; a case file paid to fewer than 11 billers shows no dollar figure, share or top-ten share.',
    desktopName,
    site: siteBase.startsWith('http://127.0.0.1') ? 'local build (wireframe V1/app/dist)' : siteBase,
    viewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
    assertions,
    screenshots,
  });
} catch (error) {
  if (activePage) await activePage.screenshot({ path: path.join(artifactDir, 'failure.png') }).catch(() => {});
  await writeJson('failure.json', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null, assertions });
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

async function writeJson(name, value) { await writeFile(path.join(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
async function signInWithDemoCredentials(page) { const gate = await readFile(path.join(repoPath, 'wireframe V1', 'app', 'src', 'components', 'DemoLoginGate.jsx'), 'utf8'); const demoPassword = gate.match(/DEMO_PASSWORD = '([^']+)'/)?.[1]; if (!demoPassword) throw new Error('Demo password constant not found in DemoLoginGate.jsx.'); await page.getByLabel('Password', { exact: true }).fill(demoPassword); await page.getByRole('button', { name: 'Login', exact: true }).click(); }
async function dismissWalkthrough(page) { for (const name of ['Skip All', 'Not now']) { const button = page.getByRole('button', { name, exact: true }); if (await button.isVisible().catch(() => false)) await button.click(); } }
async function firstExisting(candidates) { for (const candidate of candidates) { try { await access(candidate); return candidate; } catch { /* continue */ } } throw new Error('No supported Chromium executable found.'); }
async function allocatePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close((error) => error ? reject(error) : resolve(address.port)); }); }); }
async function startStaticServer(root, port) { const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' }; const server = http.createServer(async (request, response) => { try { const requestPath = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname); const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, ''); let target = path.join(root, relative); if (!path.extname(target)) target = path.join(root, 'index.html'); const content = await readFile(target); response.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream' }); response.end(content); } catch { try { const content = await readFile(path.join(root, 'index.html')); response.writeHead(200, { 'content-type': 'text/html' }); response.end(content); } catch { response.writeHead(404); response.end('Not found'); } } }); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); return server; }
