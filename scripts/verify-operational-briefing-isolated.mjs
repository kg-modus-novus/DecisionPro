import crypto from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

/**
 * Isolated-rendered verification for the Operational briefing strip and the
 * plan-period accountability record (KY + FL). Launch only through the
 * Scriptorium HiddenDesktopRunner so the static server, the driver, and the
 * headed browser share one hidden interactive desktop.
 */
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
const assertions = [];
const screenshots = [];
let staticServer;
let browserServer;
let browser;

try {
  staticServer = await startStaticServer(path.join(repoPath, 'wireframe V1', 'app', 'dist'), webPort);
  browserServer = await chromium.launchServer({ executablePath: browserPath, headless: false, args: ['--disable-gpu', '--disable-background-networking', '--no-first-run'] });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const browserProcess = browserServer.process();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') logs.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => logs.pageErrors.push(error.message));

  for (const state of ['KY', 'FL']) {
    await page.goto(`http://127.0.0.1:${webPort}/?state=${state}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.locator('.role-tile-select').first().click();
    await dismissWalkthrough(page);
    await page.getByRole('button', { name: 'Operational intelligence', exact: true }).click();
    await page.getByRole('heading', { name: 'Operational intelligence', exact: true }).waitFor();
    await dismissWalkthrough(page);

    const strip = page.locator('.ops-briefing-strip');
    await strip.waitFor();
    const stripBox = await strip.boundingBox();
    const gridBox = await page.locator('.ops-goal-grid').boundingBox();
    if (!stripBox || !gridBox) throw new Error(`${state}: briefing strip or goal grid has no layout box.`);
    if (stripBox.y >= gridBox.y) throw new Error(`${state}: briefing strip is not above the goal tiles (strip y=${stripBox.y}, grid y=${gridBox.y}).`);
    assertions.push(`${state}: the briefing strip renders above the goal tile grid (strip top ${Math.round(stripBox.y)}px, grid top ${Math.round(gridBox.y)}px).`);

    const cards = page.locator('.ops-briefing-card');
    const defaultCount = await cards.count();
    if (defaultCount < 3) throw new Error(`${state}: expected 3 briefing cards by default, saw ${defaultCount}.`);
    const headline = (await cards.first().locator('.ops-briefing-headline').textContent()).trim();
    if (!/\?|\.|;/.test(headline)) throw new Error(`${state}: first headline has no sentence punctuation: ${headline}`);

    const aboveFold = 'operational-briefing-above-fold-' + state.toLowerCase() + '.png';
    await page.screenshot({ path: path.join(artifactDir, aboveFold), fullPage: false });
    screenshots.push(aboveFold);

    await page.locator('.ops-briefing-show-all').click();
    const cardCount = await cards.count();
    if (cardCount <= defaultCount) throw new Error(`${state}: "Show all" did not reveal more cards (${defaultCount} -> ${cardCount}).`);
    // The governed rule applies to headlines and ledes; guardrail lines
    // legitimately negate verdict words ("never itself evidence of ... improper").
    const governed = (await strip.locator('.ops-briefing-headline, .ops-briefing-lede').allTextContents()).join(' ').toLocaleLowerCase();
    for (const term of ['waste', 'fraud', 'breach', 'distress', 'improper', 'misconduct', 'violation', 'savings']) {
      if (governed.includes(term)) throw new Error(`${state}: a briefing headline or lede contains prohibited verdict wording "${term}".`);
    }
    assertions.push(`${state}: ${defaultCount} briefing cards render by default and ${cardCount} after "Show all"; the first headline is "${headline}"; no headline or lede contains prohibited verdict wording.`);

    const recordCard = page.locator(`[data-briefing-id="${state}-mcpar-${state === 'KY' ? 'overpayment-concentration' : 'comparability'}"]`);
    await recordCard.waitFor();
    await recordCard.locator('.ops-briefing-toggle').click();
    const table = recordCard.locator('.par-table').first();
    await table.waitFor();
    const headings = await table.locator('th').allTextContents();
    if (!headings.includes('Plan') || !headings.includes('Overpayments reported $')) throw new Error(`${state}: plan-period table headings unexpected: ${JSON.stringify(headings)}`);
    const nonComparable = await recordCard.locator('.par-table td.is-noncomparable').count();
    if (nonComparable < 1) throw new Error(`${state}: no non-comparable cell is shaded in the plan-period table.`);
    assertions.push(`${state}: the plan-period accountability record opens inside the card with plan, overpayment, and derived columns and ${nonComparable} non-comparable cells shaded.`);
    const recordShot = `plan-period-record-${state.toLowerCase()}.png`;
    await recordCard.screenshot({ path: path.join(artifactDir, recordShot) });
    screenshots.push(recordShot);

    if (state === 'KY') {
      // Sanction records now carry the indexed contract section and page.
      const sanctionCard = page.locator('[data-briefing-id="KY-mcpar-sanctions"]');
      await sanctionCard.locator('.ops-briefing-toggle').click();
      const sanctionTable = sanctionCard.locator('.par-table').first();
      await sanctionTable.waitFor();
      const sanctionHeadings = await sanctionTable.locator('th').allTextContents();
      if (!sanctionHeadings.includes('Contract section (indexed)')) throw new Error(`KY: sanction table lacks the contract-section column: ${JSON.stringify(sanctionHeadings)}`);
      const sanctionText = await sanctionTable.textContent();
      if (!/·\s*p\.\s*\d+/.test(sanctionText)) throw new Error('KY: no sanction citation resolved to a contract page.');
      assertions.push('KY: the sanction record shows the indexed contract section and PDF page beside the state\'s own citation.');
      const sanctionShot = 'sanction-record-contract-sections-ky.png';
      await sanctionCard.screenshot({ path: path.join(artifactDir, sanctionShot) });
      screenshots.push(sanctionShot);
      await sanctionCard.locator('.ops-briefing-toggle').click();
    }

    await recordCard.locator('.ops-briefing-open-goal').click();
    const goalHeading = page.locator('.ops-selected-goal h3').first();
    await goalHeading.waitFor();
    const goalText = (await goalHeading.textContent()).trim();
    const expectedGoal = state === 'KY' ? 'Contract Accountability' : 'Strengthen Plan Accountability';
    if (!goalText.includes(expectedGoal)) throw new Error(`${state}: opening the card landed on "${goalText}", expected ${expectedGoal}.`);
    if (await page.locator('.ops-briefing-strip').count() !== 0) throw new Error(`${state}: briefing strip still visible inside the goal detail.`);
    assertions.push(`${state}: "Open in ${expectedGoal}" navigates to that goal page and the strip yields to the goal detail.`);
  }

  if (logs.consoleErrors.length || logs.pageErrors.length) throw new Error(`Browser errors: ${[...logs.consoleErrors, ...logs.pageErrors].join(' | ')}`);

  const sourceFiles = [
    'wireframe V1/app/src/components/OperationalBriefingStrip.jsx',
    'wireframe V1/app/src/components/PlanAccountabilityRecord.jsx',
    'wireframe V1/app/src/components/OperationalActionWorkbench.jsx',
    'wireframe V1/app/src/data/operationalBriefings.js',
    'wireframe V1/app/src/data/alp/mcparPlanPeriod.js',
    'wireframe V1/app/src/styles.css',
  ];
  const source = await Promise.all(sourceFiles.map(async (relativePath) => ({ relativePath, sha256: crypto.createHash('sha256').update(await readFile(path.join(repoPath, relativePath))).digest('hex') })));
  await writeJson('manifest.json', {
    schemaVersion: 1,
    evidenceClass: 'isolated-rendered',
    claim: 'The Operational briefing strip renders above the goal tiles for Kentucky and Florida with governed headlines, opens the plan-period accountability record in place, and deep-links into the accountability goal.',
    repoPath,
    routes: ['?state=KY', '?state=FL'].map((route) => `http://127.0.0.1:${webPort}/${route}`),
    executablePath: browserPath,
    browserVersion: await browser.version(),
    viewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
    processProof: { desktopName, driverPid: process.pid, browserPid: browserProcess?.pid },
    assertions,
    screenshots,
    source,
  });
} catch (error) {
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

async function dismissWalkthrough(page) { const skip = page.getByRole('button', { name: 'Skip All', exact: true }); if (await skip.isVisible().catch(() => false)) await skip.click(); }
async function firstExisting(candidates) { for (const candidate of candidates) { try { await access(candidate); return candidate; } catch { /* continue */ } } throw new Error('No supported Chromium executable found.'); }
async function allocatePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close((error) => error ? reject(error) : resolve(address.port)); }); }); }
async function writeJson(name, value) { await writeFile(path.join(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
async function startStaticServer(root, port) { const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' }; const server = http.createServer(async (request, response) => { try { const requestPath = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname); const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, ''); let target = path.join(root, relative); if (!path.extname(target)) target = path.join(root, 'index.html'); const content = await readFile(target); response.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream' }); response.end(content); } catch { try { const content = await readFile(path.join(root, 'index.html')); response.writeHead(200, { 'content-type': 'text/html' }); response.end(content); } catch { response.writeHead(404); response.end('Not found'); } } }); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); return server; }
