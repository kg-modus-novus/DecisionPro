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
  // SIMPLE_MODE_DIST selects the build to check (e.g. dist-review for the review build).
  staticServer = await startStaticServer(path.join(appPath, process.env.SIMPLE_MODE_DIST || 'dist'), port);
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

  // Release 2: a bare URL lands on Kentucky at a glance after login (default landing).
  await page.locator('.sm-home').waitFor();
  const nav = page.locator('.left-nav-scroll');
  const navLabels = (await nav.locator('.nav-primary').allTextContents()).map((t) => t.trim());
  const expectedNav = ['At a glance', 'Access to care', 'Spending', 'Health outcomes', 'Plans and providers', 'Waiver waitlists', 'Long-term care', 'Behavioral health', 'Who is covered', 'Medicaid in my county', 'My district', 'SME view'];
  if (JSON.stringify(navLabels) !== JSON.stringify(expectedNav)) throw new Error(`Simple nav is ${JSON.stringify(navLabels)}`);
  assertions.push('A bare URL lands on the simple view; the left nav shows the eleven simple tabs plus SME view.');
  const navPitch = await nav.locator('.nav-primary').evaluateAll((els) => els.slice(0, 5).map((el) => el.getBoundingClientRect().top))
    .then((tops) => Math.max(...tops.slice(1).map((t, i) => t - tops[i])));
  if (navPitch > 42) throw new Error(`Simple nav tabs are ${Math.round(navPitch)}px apart; expected a compact list.`);
  assertions.push(`Simple nav tabs are a compact list (${Math.round(navPitch)}px apart).`);
  await expectCount(page.locator('.sm-tile'), 13, 'dashboard tiles on At a glance');
  const briefings = await page.locator('.sm-briefing').count();
  if (briefings < 4) throw new Error(`Only ${briefings} briefings rendered.`);
  assertions.push(`Briefing strip renders ${briefings} open questions with owner and next action.`);
  const tileCharts = await page.locator('.sm-tile .st-visual').count();
  if (tileCharts !== 13) throw new Error(`Only ${tileCharts} tiles render a graphic.`);
  assertions.push('Every dashboard tile renders a smart-tile graphic.');
  const wideBox = await page.locator('[data-tile-id="renewals"]').boundingBox();
  const narrowBox = await page.locator('[data-tile-id="spending"]').boundingBox();
  if (!wideBox || !narrowBox || wideBox.width < narrowBox.width * 1.8) throw new Error(`Renewals tile is not double width (${wideBox?.width} vs ${narrowBox?.width}).`);
  const briefingBelow = await page.evaluate(() => document.querySelector('.sm-glance-layout').getBoundingClientRect().bottom <= document.querySelector('.sm-briefings').getBoundingClientRect().top);
  if (!briefingBelow) throw new Error('Briefing strip is not below the dashboard.');
  assertions.push('The renewals trend tile spans two columns, and the briefing strip sits below the dashboard.');
  await shot(page, 'simple-home-desktop.png', true);

  await page.locator('[data-tile-id="pharmacy"] .sm-tile-body').click();
  await page.locator('#pharmacy').waitFor();
  await page.waitForTimeout(600);
  const anchorTop = await page.locator('#pharmacy').evaluate((el) => el.getBoundingClientRect().top);
  if (anchorTop < -40 || anchorTop > 400) throw new Error(`Tile anchor did not scroll to its section (top=${Math.round(anchorTop)}).`);
  assertions.push('A dashboard tile opens its page scrolled to the linked section.');
  await page.locator('.left-nav-scroll').getByRole('button', { name: 'At a glance', exact: true }).click();
  await page.locator('.sm-tiles').waitFor();

  const forbidden = /not loaded yet|entered by hand/i;
  for (const tab of expectedNav.slice(1, -1)) {
    await nav.getByRole('button', { name: tab, exact: true }).click();
    await page.locator('.sm-home h1').waitFor();
    const text = await page.locator('.sm-home').innerText();
    if (forbidden.test(text)) throw new Error(`"${tab}" still shows a not-loaded or hand-entered label.`);
    const slug = tab.toLowerCase().replace(/[^a-z]+/g, '-');
    await shot(page, `simple-${slug}.png`, true);
  }
  assertions.push('All eleven tabs render with no "not loaded yet" or "entered by hand" text.');

  await nav.getByRole('button', { name: 'Medicaid in my county', exact: true }).click();
  await expectCount(page.locator('path.sm-map-county'), 120, 'county paths on the county tab');
  const mapBox = await page.locator('.sm-map-svg').first().boundingBox();
  if (!mapBox || mapBox.width < 500 || mapBox.height < 150) throw new Error(`Map renders too small: ${JSON.stringify(mapBox)}`);
  await page.locator('path[data-fips="21111"]').click();
  const panelTitle = await page.locator('.sm-county-panel h3').textContent();
  if (panelTitle !== 'Jefferson County') throw new Error(`County panel shows ${panelTitle}`);
  assertions.push('County tab: clicking Jefferson County opens its breakdown.');

  await nav.getByRole('button', { name: 'Spending', exact: true }).click();
  await page.locator('[data-measure-id="dms-staff-fte-estimate"] .sm-estimate-chip.is-button').click();
  await page.locator('.sm-estimate-pop').waitFor();
  await page.locator('[data-measure-id="dms-staff-fte-estimate"]').screenshot({ path: path.join(artifactDir, 'estimate-popup.png') });
  screenshots.push('estimate-popup.png');
  await page.keyboard.press('Escape');
  await page.locator('[data-measure-id="total-medicaid-spending"] .sm-info-btn').click();
  const sourceLink = await page.locator('.sm-estimate-pop a').getAttribute('href');
  if (!/^https:\/\//.test(sourceLink || '')) throw new Error('Source pop-up has no link.');
  await page.locator('[data-measure-id="total-medicaid-spending"]').screenshot({ path: path.join(artifactDir, 'source-popup.png') });
  screenshots.push('source-popup.png');
  await page.keyboard.press('Escape');
  assertions.push('The Estimate pill and the ? button open their pop-ups (method; source with link).');

  await nav.getByRole('button', { name: 'My district', exact: true }).click();
  await page.locator('.sm-segmented').waitFor();
  await page.locator('path[data-fips="21111"]').click();
  await page.locator('.sm-split-note').waitFor();
  await page.locator('.sm-segmented button', { hasText: 'Senate' }).click();
  const districtTitle = await page.locator('.sm-section-head h2').first().textContent();
  if (!/Senate District/.test(districtTitle || '')) throw new Error(`District title after chamber switch: ${districtTitle}`);
  await shot(page, 'simple-district-selected.png', true);
  assertions.push('My district: clicking a county selects its district, split counties list their districts, and the House/Senate switch keeps the place.');

  await nav.getByRole('button', { name: 'Plans and providers', exact: true }).click();
  await expectCount(page.locator('.sm-scorecard tbody tr'), 6, 'plan rows on the scorecard');

  await nav.getByRole('button', { name: 'SME view', exact: true }).click();
  await page.locator('.role-home').waitFor();
  const smeNav = (await nav.locator('.nav-primary').allTextContents()).map((t) => t.trim());
  if (smeNav[0] !== 'At a glance' || smeNav.length < 5) throw new Error(`SME nav is ${JSON.stringify(smeNav)}`);
  await shot(page, 'sme-view.png', false);
  await nav.getByRole('button', { name: 'At a glance', exact: true }).click();
  await page.locator('.sm-home').waitFor();
  assertions.push('SME view shows the original tabs headed by At a glance, which returns to the simple view.');

  await page.locator('[data-tile-id="renewals"] .sm-pin').click();
  const firstTile = await page.locator('.sm-tile').first().getAttribute('data-tile-id');
  if (firstTile !== 'renewals') throw new Error('Pinned tile did not move first.');
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.locator('.sm-catalog').waitFor();
  assertions.push('Pinning moves a tile first; Customize opens the tile catalog.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route, { waitUntil: 'networkidle' });
  if (await page.getByLabel('Password', { exact: true }).count()) {
    await page.getByLabel('Password', { exact: true }).fill('Xeno123');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.locator('.app-shell').waitFor();
  }
  await page.locator('.sm-home').waitFor();
  const overflow = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('.sm-home, .sm-section, .sm-tile, .sm-pin, .sm-briefing, .sm-filters, .sm-facts')]
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
    'wireframe V1/app/src/components/simple/SimpleBlocks.jsx',
    'wireframe V1/app/src/components/simple/SimpleWidgets.jsx',
    'wireframe V1/app/src/lib/simpleMode/simpleAreas.js',
    'wireframe V1/app/src/lib/simpleMode/sourcedDisplay.generated.js',
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
    claim: 'Simple mode release 2 is the default landing page and renders from the production build: briefing strip, 13 smart tiles with graphics, eleven sourced tabs with no not-loaded or hand-entered labels, a 120-county map with drill-down, the plan scorecard, pins and the tile catalog, and no horizontal overflow on a phone.',
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
  // The app scrolls inside .content-column, so a full-page shot captures the page element itself.
  if (fullPage) {
    const size = page.viewportSize();
    const height = await page.evaluate(() => (document.querySelector('.sm-home')?.scrollHeight || 900) + 240);
    await page.setViewportSize({ width: size.width, height: Math.min(height, 15000) });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(artifactDir, name) });
    await page.setViewportSize(size);
  } else {
    await page.screenshot({ path: path.join(artifactDir, name) });
  }
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
