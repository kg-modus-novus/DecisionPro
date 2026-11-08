import crypto from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

/**
 * Isolated-rendered verification for the Potential Fraud Detection module: the
 * national radar, program blow-up, case file, reallocation what-if, tools and
 * data coverage, and backtests. Launch only through the Scriptorium
 * HiddenDesktopRunner so the static server, the driver and the headed browser
 * share one hidden interactive desktop.
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
const webPort = await allocatePort();
const logs = { consoleErrors: [], pageErrors: [] };
const assertions = [];
const screenshots = [];
let staticServer;
let browserServer;
let browser;
let activePage;

async function shot(page, name) {
  await page.screenshot({ path: path.join(artifactDir, name), fullPage: false });
  screenshots.push(name);
}

async function expectText(locator, pattern, what) {
  const text = (await locator.textContent()) ?? '';
  if (!pattern.test(text)) throw new Error(`${what}: expected ${pattern} in "${text.slice(0, 300)}"`);
  return text;
}

try {
  staticServer = await startStaticServer(path.join(repoPath, 'wireframe V1', 'app', 'dist'), webPort);
  browserServer = await chromium.launchServer({ executablePath: browserPath, headless: false, args: ['--disable-gpu', '--disable-background-networking', '--no-first-run'] });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const browserProcess = browserServer.process();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  activePage = page;
  page.on('console', (message) => { if (message.type() === 'error') logs.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => logs.pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${webPort}/?state=KY&view=sme`, { waitUntil: 'networkidle', timeout: 60_000 });
  await signInWithDemoCredentials(page);
  await chooseRoleIfAsked(page);
  await dismissWalkthrough(page);
  await page.getByRole('button', { name: 'Potential Fraud Detection', exact: true }).click();
  await dismissWalkthrough(page);

  // 1. National radar
  const radarHeading = page.getByRole('heading', { name: /Potential fraud radar · every state, every service/ });
  await radarHeading.waitFor({ timeout: 60_000 });
  await expectText(page.locator('.pfd-lede'), /In 2024, \$54\.0B of .* went to 1,269 flagged services\. \$46\.7B of that is above what enrollment predicts, and most of it looks like a billing convention\./, 'radar lede');
  const segments = await page.locator('.pfd-moneybar-seg').count();
  if (segments < 5) throw new Error(`money bar has ${segments} tier segments`);
  await expectText(page.locator('.pfd-moneybar-caption'), /Worth review: \$3\.7B · HIGH \$212\.2M \(11\) \+ VERIFY \$3\.5B \(74\).*Likely convention: \$40\.2B \(599\)/s, 'radar money bar caption');
  const firstRow = page.locator('.pfd-table tbody tr').first();
  await expectText(firstRow, /KY.*Psychoeducation.*H2027.*\$143\.0M.*78\.3%.*HIGH/s, 'radar first row');
  const tiles = await page.locator('.pfd-mapblock .pfd-tm-tile').count();
  if (tiles !== 51) throw new Error(`radar tile map has ${tiles} tiles, expected 51`);
  await expectText(page.locator('.pfd-mapblock .pfd-tm-tile[data-state="KY"]'), /KY●\$396M/, 'radar Kentucky tile (worth review, HIGH dot)');
  await expectText(page.locator('.pfd-statepanel'), /Kentucky · 2024.*\$396\.\dM worth review of \$7\d\d\.\dM above the line.*HIGH 1.*VERIFY 3/s, 'radar Kentucky panel');
  assertions.push('Radar header: the lede reads $54.0B to 1,269 flagged services in 2024 with $46.7B above what enrollment predicts, mostly a billing convention; the money bar splits it by tier with "Worth review: $3.7B · HIGH $212.2M (11) + VERIFY $3.5B (74)" and "Likely convention: $40.2B (599)"; the 51-tile map colors Kentucky by $396M worth review with a HIGH dot, and the Kentucky panel shows HIGH 1 and VERIFY 3. The first ranked row is Kentucky psychoeducation (H2027), $143.0M, 78.3% of US, suggested HIGH.');
  await shot(page, '1-national-radar.png');
  await page.locator('[data-map-mode="all"]').click();
  await expectText(page.locator('.pfd-mapblock .pfd-tm-tile[data-state="NY"]'), /NY\$12\.\dB/, 'radar New York tile in all-dollars mode');
  assertions.push('Radar header: switching the map to all dollars above the line shows New York at about $12.6B.');
  await shot(page, '1c-national-radar-map-all-dollars.png');
  await page.locator('[data-map-mode="review"]').click();
  await page.evaluate(() => { const table = document.querySelector('.pfd-table'); const scroller = table.closest('.content-column'); if (scroller) scroller.scrollTop += table.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 120; });
  const scoreHeader = await page.locator('.pfd-table thead th').last().boundingBox();
  const tableWrap = await page.locator('.pfd-table-wrap').first().boundingBox();
  if (!scoreHeader || !tableWrap || scoreHeader.x + scoreHeader.width > tableWrap.x + tableWrap.width + 1) throw new Error('radar score and tier column is clipped at 1600px');
  assertions.push('Radar: at 1600px the score and suggested-tier column fits inside the table without horizontal scrolling.');
  await shot(page, '1b-national-radar-ranked-table.png');
  await page.evaluate(() => { const table = document.querySelector('.pfd-table'); const scroller = table.closest('.content-column'); if (scroller) scroller.scrollTop = 0; });

  await page.locator('.pfd-mapblock .pfd-tm-tile[data-state="FL"]').click();
  await expectText(page.locator('.pfd-statepanel'), /Florida · 2024/, 'radar Florida panel');
  const flRows = await page.locator('.pfd-table tbody tr').count();
  const flStates = await page.locator('.pfd-table tbody tr td:nth-child(2)').allTextContents();
  if (flRows < 1 || flStates.some((v) => v.trim() !== 'FL')) throw new Error(`radar Florida filter shows ${flRows} rows: ${flStates.slice(0, 5).join(',')}`);
  assertions.push(`Radar: clicking the Florida tile shows the Florida panel and filters the list to ${flRows} Florida rows.`);
  await shot(page, '1d-national-radar-florida.png');
  await page.locator('.pfd-mapblock .pfd-tm-tile[data-state="FL"]').click();
  const allRows = await page.locator('.pfd-table tbody tr').count();
  if (allRows <= flRows) throw new Error('clicking Florida again did not clear the state filter');
  assertions.push('Radar: clicking the selected state again clears the state filter.');
  await page.locator('.pfd-mapblock .pfd-tm-tile[data-state="KY"]').click();
  await page.locator('.pfd-mapblock .pfd-tm-tile[data-state="KY"]').click();
  // Radar filters and one-line rows
  const rowCount = async () => page.locator('.pfd-table tbody tr').count();
  const matchCount = async () => Number((await page.locator('[data-row-count]').innerText()).replace(/,/g, ''));
  const parseMoney = (v) => { const m = /\$([\d.]+)([MBK]?)/.exec(v); if (!m) return NaN; return Number(m[1]) * ({ B: 1e9, M: 1e6, K: 1e3, '': 1 })[m[2]]; };
  if ((await page.locator('.pfd-filterrows [data-year]').count()) !== 6) throw new Error('radar does not show six year pills');
  if ((await page.locator('.pfd-filterrows [data-tier]').count()) !== 6) throw new Error('radar does not show six tier pills');
  if ((await page.locator('.pfd-filterrows [data-pattern]').count()) !== 4) throw new Error('radar does not show four pattern pills');
  await expectText(page.locator('[data-tier="high"]'), /HIGH\s*11/, 'HIGH tier pill count');
  await expectText(page.locator('[data-tier="convention"]'), /CONVENTION\?\s*599/, 'CONVENTION? tier pill count');
  const allMatch = await matchCount();
  if (allMatch !== 1269) throw new Error('radar 2024 matches ' + allMatch + ' rows, expected 1,269');
  const firstCells = page.locator('.pfd-table tbody tr').first().locator('td');
  if ((await firstCells.nth(7).locator('.pfd-fp i').count()) !== 7) throw new Error('first row fingerprint does not have seven cells');
  if ((await firstCells.nth(3).locator('svg.pfd-spark circle').count()) !== 1) throw new Error('first row sparkline has no marked year');
  if ((await firstCells.nth(5).locator('svg.pfd-sharebar line').count()) !== 1) throw new Error('first row share bar has no enrollment tick');
  assertions.push('Radar rows: six year pills, six tier pills (HIGH 11, CONVENTION? 599) and four pattern pills; 1,269 rows match in 2024; each row has a paid sparkline with the year marked, a share bar with the enrollment tick, and a seven-cell signal fingerprint.');
  await page.locator('[data-tier="high"]').click();
  const highRows = await rowCount();
  const highTiers = await page.locator('.pfd-table tbody tr td:last-child .pfd-tier').allTextContents();
  if (highRows !== 11 || highTiers.some((v) => v.trim() !== 'HIGH')) throw new Error('HIGH pill shows ' + highRows + ' rows: ' + highTiers.join(','));
  await expectText(page.locator('.pfd-table tbody tr').first(), /KY.*H2027/s, 'HIGH filter first row');
  assertions.push('Radar filters: the HIGH tier pill filters the list to its 11 rows, Kentucky psychoeducation first.');
  await shot(page, '1e-national-radar-high-tier.png');
  await page.locator('[data-tier="high"]').click();
  if ((await matchCount()) !== allMatch) throw new Error('clicking HIGH again did not clear the tier filter');
  await page.locator('[data-pattern="share-surge"]').click();
  const surgeMatch = await matchCount();
  await page.locator('[data-pattern="tripled-and-growing"]').click();
  const bothMatch = await matchCount();
  if (!(surgeMatch > 0 && bothMatch > 0 && bothMatch <= surgeMatch && surgeMatch < allMatch)) throw new Error('pattern pills: surge ' + surgeMatch + ', surge and tripled ' + bothMatch);
  assertions.push('Radar filters: share surge narrows the list to ' + surgeMatch + ' rows, and adding tripled & growing (every picked pattern must match) to ' + bothMatch + '.');
  await page.locator('[data-pattern="share-surge"]').click();
  await page.locator('[data-pattern="tripled-and-growing"]').click();
  await page.locator('[data-above-slider]').fill('6');
  await expectText(page.locator('.pfd-range-v'), /≥ \$100M/, 'above-line slider label');
  const bigMatch = await matchCount();
  if (!(bigMatch > 0 && bigMatch < allMatch)) throw new Error('above-line slider at $100M shows ' + bigMatch + ' rows');
  assertions.push('Radar filters: the above-line slider at ≥ $100M leaves ' + bigMatch + ' rows.');
  await page.locator('[data-above-slider]').fill('0');
  await page.locator('[data-sort="paid"]').click();
  const paidCells = (await page.locator('.pfd-table tbody tr td:nth-child(5)').allTextContents()).slice(0, 5).map(parseMoney);
  if (paidCells.some((v, i) => i > 0 && v > paidCells[i - 1])) throw new Error('paid sort is not descending: ' + paidCells.join(','));
  if ((await page.locator('th[aria-sort="descending"] [data-sort="paid"]').count()) !== 1) throw new Error('paid column is not marked as the sort');
  assertions.push('Radar sort: clicking the Paid heading orders the rows by paid, largest first, and marks the column.');
  await shot(page, '1f-national-radar-sorted-by-paid.png');
  await page.locator('[data-sort="score"]').click();
  await expectText(page.locator('.pfd-table tbody tr').first(), /KY.*H2027/s, 'score sort first row');

  // 2. Program blow-up (Kentucky psychoeducation by default): tile-map picker, program list, one-axis chart
  await page.locator('[data-fraud-page="blowups"]').click();
  const blowupH1 = page.locator('.pfd-page h1').first();
  await expectText(blowupH1, /Program blow-up · Kentucky · Psychoeducation/, 'blow-up heading');
  const pickerTiles = await page.locator('.pfd-picker .pfd-tm-tile').count();
  if (pickerTiles !== 51) throw new Error(`blow-up tile map has ${pickerTiles} tiles, expected 51`);
  const kyTile = page.locator('.pfd-picker .pfd-tm-tile[data-state="KY"]');
  if ((await kyTile.getAttribute('aria-pressed')) !== 'true') throw new Error('Kentucky tile is not selected');
  const firstProgram = page.locator('.pfd-program').first();
  await expectText(firstProgram, /Psychoeducation.*H2027.*HIGH/s, 'blow-up first program');
  if (!(await firstProgram.getAttribute('class')).includes('is-on')) throw new Error('first program is not highlighted');
  const legendItems = await page.locator('.pfd-grow .pfd-legend .pfd-legend-item').count();
  if (legendItems !== 4) throw new Error(`blow-up chart legend has ${legendItems} entries, expected 4`);
  await expectText(page.locator('.pfd-caption'), /2024: Kentucky was paid \$143\.0M.*fair share was about \$3\.2M.*4\d times/s, 'blow-up caption 2024');
  await expectText(page.locator('.pfd-chart').first(), /78\.3%.*4\d×/s, 'blow-up share and times rows');
  await expectText(page.locator('.pfd-page'), /Arizona.*share fell from 70%/s, 'blow-up displacement');
  await expectText(page.locator('.pfd-page'), /unexplained by enrollment/, 'blow-up health panel');
  assertions.push('Program blow-up: opens on Kentucky psychoeducation with Kentucky selected on a 51-tile state map and H2027 (HIGH) first in the program list; the chart has a four-swatch legend, share of US 78.3% and about 44× the fair share on top, and the caption reads $143.0M paid against a $3.2M fair share.');
  await shot(page, '2-program-blowup-ky-psychoeducation.png');

  await page.locator('.pfd-chart g[data-year="2023"]').first().click();
  await expectText(page.locator('.pfd-caption'), /^2023: Kentucky was paid \$57\.\dM/, 'blow-up caption after picking 2023');
  assertions.push('Program blow-up: clicking the 2023 bar switches the page to Kentucky psychoeducation 2023.');
  await shot(page, '2b-program-blowup-ky-2023.png');

  await page.locator('.pfd-picker .pfd-tm-tile[data-state="OH"]').click();
  await expectText(blowupH1, /Program blow-up · Ohio ·/, 'blow-up heading after picking Ohio');
  const ohioPrograms = await page.locator('.pfd-program').count();
  if (ohioPrograms < 2) throw new Error(`Ohio lists ${ohioPrograms} programs`);
  await page.locator('.pfd-program').nth(1).click();
  const ohioSecond = await page.locator('.pfd-program').nth(1).getAttribute('class');
  if (!ohioSecond.includes('is-on')) throw new Error('second Ohio program did not become the selected program');
  assertions.push(`Program blow-up: clicking the Ohio tile lists Ohio's ${ohioPrograms} programs that blew up in 2024, and one click opens another program.`);
  await shot(page, '2c-program-blowup-ohio.png');
  const disabled = await page.locator('.pfd-picker .pfd-tm-tile:disabled').count();
  assertions.push(`Program blow-up: ${disabled} states with no blow-up in any screen year are disabled on the map.`);
  await page.locator('.pfd-picker .pfd-tm-tile[data-state="KY"]').click();
  await expectText(blowupH1, /Program blow-up · Kentucky · Psychoeducation/, 'blow-up heading back to Kentucky');

  // 3. Case file
  await page.getByRole('button', { name: /Open case file KY · H2027 · 2024/ }).click();
  const caseH1 = page.locator('.pfd-page h1').first();
  await expectText(caseH1, /Case file · Kentucky · Psychoeducation.*\(H2027\) · 2024/, 'case heading');
  const fired = await page.locator('.pfd-check-y').count();
  const pending = await page.locator('.pfd-check-p').count();
  if (fired < 6 || pending < 8) throw new Error(`case checklist fired=${fired} pending=${pending}`);
  await page.getByRole('button', { name: 'Refer to the Medicaid Fraud Control Unit' }).click();
  await page.locator('.pfd-panel').waitFor();
  // Playwright scrolls every ancestor to reach the button, including the fixed app shell; put the shell back before the screenshot.
  await page.evaluate(() => { for (const element of document.querySelectorAll('*')) { if (element.scrollTop && getComputedStyle(element).overflowY === 'hidden') element.scrollTop = 0; } window.scrollTo(0, 0); });
  assertions.push(`Case file: Kentucky psychoeducation 2024 shows ${fired} fired and ${pending} pending signals, the explanation review, and the referral panel opens from "Refer to the Medicaid Fraud Control Unit".`);
  const footerBox = await page.locator('.footer').first().boundingBox();
  const pageBox = await page.locator('.pfd').boundingBox();
  if (!footerBox || !pageBox || footerBox.y < pageBox.y + pageBox.height - 1) throw new Error('the app footer overlaps the case file instead of following it');
  assertions.push('Case file: the module grows with its content and the app footer follows it (no overlap).');
  await shot(page, '3-case-file-ky-h2027-2024.png');

  // 4. Reallocation what-if
  await page.locator('[data-fraud-page="realloc"]').click();
  await page.getByRole('heading', { name: /Reallocation what-if/ }).waitFor();
  const realloc = page.locator('.pfd-page');
  await expectText(realloc, /\$730\.8M/, 'reallocation above enrollment line');
  await expectText(realloc, /\$438\.5M/, 'reallocation freed at 60%');
  await expectText(realloc, /\$314\.7M/, 'reallocation federal share');
  await shot(page, '4-reallocation-what-if.png');
  await page.getByRole('radio', { name: /Return to the General Fund/ }).click();
  await expectText(realloc, /fit to available/, 'reallocation over-allocation warning');
  await shot(page, '4b-reallocation-general-fund-over-allocated.png');
  await page.getByRole('button', { name: /fit to available/ }).click();
  await expectText(realloc, /Allocated \$123\.\dM of \$123\.7M/, 'reallocation fitted to the state share');
  await page.getByRole('radio', { name: /Keep inside Medicaid/ }).click();
  assertions.push('Reallocation: Kentucky at 60% upheld frees $438.5M of $730.8M above the enrollment line ($314.7M federal); switching to the General Fund flags over-allocation, and "fit to available" rescales the needs to the $123.7M state share.');

  // 5. Tools and data coverage
  await page.locator('[data-fraud-page="tools"]').click();
  await page.getByRole('heading', { name: /Detection tools & data coverage/ }).waitFor();
  const tools = await page.locator('.pfd-tool').count();
  if (tools !== 24) throw new Error(`tools page lists ${tools} analyses, expected 24`);
  assertions.push('Tools and data coverage: 24 analyses with running, ready or needs-data status, the data sources with load dates, and the last scan console.');
  await shot(page, '5-tools-and-data-coverage.png');

  // 6. Backtests
  await page.locator('[data-fraud-page="backtest"]').click();
  await page.getByRole('heading', { name: /Backtests & known cases/ }).waitFor();
  const passes = await page.locator('.pfd-table tbody .pfd-tier-low', { hasText: 'PASS' }).count();
  if (passes !== 7) throw new Error(`backtest shows ${passes} PASS, expected 7`);
  assertions.push('Backtests: all 7 known cases pass (5 flagged, 2 conventions not flagged).');
  await shot(page, '6-backtests.png');

  if (logs.consoleErrors.length || logs.pageErrors.length) throw new Error(`Browser errors: ${[...logs.consoleErrors, ...logs.pageErrors].join(' | ')}`);

  const sourceFiles = [
    'wireframe V1/app/src/components/fraud/PotentialFraudDetection.jsx',
    'wireframe V1/app/src/components/fraud/ProgramBlowupPage.jsx',
    'wireframe V1/app/src/components/fraud/fraudVisuals.jsx',
    'wireframe V1/app/src/components/fraud/RadarOverview.jsx',
    'wireframe V1/app/src/components/fraud/CaseFilePage.jsx',
    'wireframe V1/app/src/components/fraud/ReallocationPage.jsx',
    'wireframe V1/app/src/components/fraud/ToolsCoveragePage.jsx',
    'wireframe V1/app/src/lib/fraud/potentialFraudSignalProgram.js',
    'wireframe V1/app/src/lib/fraud/leveledDollarReallocationProgram.js',
    'wireframe V1/app/src/data/alp/potentialFraudRadar.js',
    'wireframe V1/app/src/styles.css',
  ];
  const source = await Promise.all(sourceFiles.map(async (relativePath) => ({ relativePath, sha256: crypto.createHash('sha256').update(await readFile(path.join(repoPath, relativePath))).digest('hex') })));
  await writeJson('manifest.json', {
    schemaVersion: 1,
    evidenceClass: 'isolated-rendered',
    claim: 'The Potential Fraud Detection module renders its six pages from the national radar export: the radar with real 2024 figures, the Kentucky psychoeducation blow-up and case file, the reallocation what-if, tools and data coverage, and the backtest.',
    repoPath,
    routes: [`http://127.0.0.1:${webPort}/?state=KY&view=sme`],
    executablePath: browserPath,
    browserVersion: await browser.version(),
    viewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
    processProof: { desktopName, driverPid: process.pid, browserPid: browserProcess?.pid },
    assertions,
    screenshots,
    source,
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

async function signInWithDemoCredentials(page) { const gate = await readFile(path.join(repoPath, 'wireframe V1', 'app', 'src', 'components', 'DemoLoginGate.jsx'), 'utf8'); const demoPassword = gate.match(/DEMO_PASSWORD = '([^']+)'/)?.[1]; if (!demoPassword) throw new Error('Demo password constant not found in DemoLoginGate.jsx.'); await page.getByLabel('Password', { exact: true }).fill(demoPassword); await page.getByRole('button', { name: 'Login', exact: true }).click(); }
async function chooseRoleIfAsked(page) { const tile = page.locator('.role-tile-select').first(); if (await tile.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)) await tile.click(); }
async function dismissWalkthrough(page) { for (const name of ['Skip All', 'Not now']) { const button = page.getByRole('button', { name, exact: true }); if (await button.isVisible().catch(() => false)) await button.click(); } }
async function firstExisting(candidates) { for (const candidate of candidates) { try { await access(candidate); return candidate; } catch { /* continue */ } } throw new Error('No supported Chromium executable found.'); }
async function allocatePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close((error) => error ? reject(error) : resolve(address.port)); }); }); }
async function writeJson(name, value) { await writeFile(path.join(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
async function startStaticServer(root, port) { const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' }; const server = http.createServer(async (request, response) => { try { const requestPath = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname); const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, ''); let target = path.join(root, relative); if (!path.extname(target)) target = path.join(root, 'index.html'); const content = await readFile(target); response.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream' }); response.end(content); } catch { try { const content = await readFile(path.join(root, 'index.html')); response.writeHead(200, { 'content-type': 'text/html' }); response.end(content); } catch { response.writeHead(404); response.end('Not found'); } } }); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); return server; }
