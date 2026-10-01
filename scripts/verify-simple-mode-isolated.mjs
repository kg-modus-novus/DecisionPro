// Isolated rendered check for simple mode ("Kentucky at a glance").
// Run under HiddenDesktopRunner after `npm run build` in wireframe V1/app:
//   HiddenDesktopRunner.exe <repo> scripts/verify-simple-mode-isolated.mjs 240 simple-mode
import crypto from 'node:crypto';
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

// Scriptorium Central moved off Dropbox; try the current checkout, then the legacy path.
const { chromium } = loadPlaywright([
  'D:\\non-dbx-dev\\Scriptorium Central\\repos\\the-scriptorium\\package.json',
  'C:\\Augen Studios Dropbox\\Ken Greenwood\\The Scriptorium\\Scriptorium Central\\app\\local repo\\package.json',
]);
const browserPath = await firstExisting([
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]);
const port = await allocatePort();
const logs = { consoleErrors: [], pageErrors: [] };
const screenshots = [];
const assertions = [];
let staticServer;
let browserServer;
let browser;

try {
  staticServer = await startStaticServer(path.join(appPath, 'dist'), port);
  browserServer = await chromium.launchServer({
    executablePath: browserPath,
    headless: false,
    args: ['--disable-gpu', '--disable-background-networking', '--no-first-run'],
  });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const browserProcess = browserServer.process();
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) logs.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => logs.pageErrors.push(e.message));

  const route = `http://127.0.0.1:${port}/`;
  await page.goto(route, { waitUntil: 'networkidle', timeout: 60_000 });
  // Demo credentials are the project's own published demo values (DemoLoginGate.jsx).
  await page.getByLabel('Password', { exact: true }).fill('Xeno123');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.locator('.app-shell').waitFor();

  await page.getByRole('link', { name: /Open the simple view/ }).click();
  await page.locator('.sm-home').waitFor();
  await expectCount(page.locator('.sm-tile'), 6, 'headline tiles');
  await expectCount(page.locator('path.sm-map-county'), 120, 'county paths');
  await expectCount(page.locator('.sm-table tbody tr'), 6, 'plan rows');
  await shot(page, 'simple-home-desktop.png', true);

  const mapBox = await page.locator('.sm-map-svg').boundingBox();
  if (!mapBox || mapBox.width < 500 || mapBox.height < 150) throw new Error(`Map renders too small: ${JSON.stringify(mapBox)}`);
  assertions.push(`Map renders at ${Math.round(mapBox.width)}×${Math.round(mapBox.height)} px on a 1440 px viewport.`);

  await page.locator('path[data-fips="21111"]').click();
  const panelTitle = await page.locator('.sm-county-panel h3').textContent();
  if (panelTitle !== 'Jefferson County') throw new Error(`County panel shows ${panelTitle}`);
  assertions.push('Clicking Jefferson County on the map opens its breakdown.');
  await page.locator('.sm-map-layout').screenshot({ path: path.join(artifactDir, 'simple-home-county-selected.png') });
  screenshots.push('simple-home-county-selected.png');

  await page.locator('[data-tile-id="county-fewest"] .sm-pin').click();
  const firstTile = await page.locator('.sm-tile').first().getAttribute('data-tile-id');
  if (firstTile !== 'county-fewest') throw new Error('Pinned tile did not move first.');
  await page.reload({ waitUntil: 'networkidle' });
  assertions.push('Pinning a tile moves it first.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route, { waitUntil: 'networkidle' });
  if (await page.getByLabel('Password', { exact: true }).count()) {
    await page.getByLabel('Password', { exact: true }).fill('Xeno123');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.locator('.app-shell').waitFor();
  }
  await page.getByRole('link', { name: /Open the simple view/ }).click();
  await page.locator('.sm-home').waitFor();
  const overflow = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('.sm-home, .sm-section, .sm-tile, .sm-pin, .sm-gap, .sm-footer')]
      .filter((el) => el.getBoundingClientRect().right > limit + 1)
      .map((el) => `${el.className} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { limit, offenders };
  });
  if (overflow.offenders.length) throw new Error(`Overflow at 390px (viewport ${overflow.limit}): ${overflow.offenders.slice(0, 5).join('; ')}`);
  await page.locator('.sm-home').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  assertions.push('No horizontal overflow at a 390 px phone width.');
  await shot(page, 'simple-home-phone.png', false);

  if (logs.consoleErrors.length || logs.pageErrors.length) {
    throw new Error(`Browser errors: ${[...logs.consoleErrors, ...logs.pageErrors].join(' | ')}`);
  }

  const sourceFiles = [
    'wireframe V1/app/src/components/SimpleHome.jsx',
    'wireframe V1/app/src/components/KyCountyHeatMap.jsx',
    'wireframe V1/app/src/components/McoComparison.jsx',
    'wireframe V1/app/src/lib/simpleMode/simpleModeData.js',
    'wireframe V1/app/src/styles.css',
  ];
  const source = await Promise.all(sourceFiles.map(async (relativePath) => ({
    relativePath,
    sha256: crypto.createHash('sha256').update(await readFile(path.join(repoPath, relativePath))).digest('hex'),
  })));
  await writeJson('manifest.json', {
    schemaVersion: 1,
    evidenceClass: 'isolated-rendered',
    claim: 'The Kentucky at a glance page renders from the production build with six headline tiles, a 120-county map with drill-down, the plan comparison table, working pins, and no horizontal overflow on a phone.',
    repoPath,
    routes: { productionBuild: route },
    executablePath: browserPath,
    browserVersion: await browser.version(),
    processProof: { desktopName, driverPid: process.pid, browserPid: browserProcess?.pid },
    assertions,
    screenshots,
    source,
  });
} catch (error) {
  await writeJson('failure.json', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null });
  throw error;
} finally {
  const cleanup = [];
  if (browser) await browser.close().catch((e) => cleanup.push({ target: 'browser', error: String(e) }));
  if (browserServer) await browserServer.close().catch((e) => cleanup.push({ target: 'browserServer', error: String(e) }));
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
  cleanup.push({ target: 'servers', exited: true });
  await writeJson('cleanup-assertion.json', { passed: cleanup.every((item) => !item.error), results: cleanup });
  await writeJson('browser-console.json', logs);
}

console.log(JSON.stringify({ passed: true, evidenceClass: 'isolated-rendered', artifactDir }));

async function shot(page, name, fullPage) {
  await page.screenshot({ path: path.join(artifactDir, name), fullPage });
  screenshots.push(name);
}

async function expectCount(locator, expected, label) {
  const count = await locator.count();
  if (count !== expected) throw new Error(`Expected ${expected} ${label}, found ${count}.`);
  assertions.push(`Renders ${expected} ${label}.`);
}

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
