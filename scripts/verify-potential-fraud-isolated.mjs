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
 * data coverage, backtests, and the five oversight pages. Launch only through the Scriptorium
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
  await expectText(page.locator('.pfd-mapblock .pfd-tm-tile[data-state="KY"]'), /KY●\$388M/, 'radar Kentucky tile (worth review that may be shown, HIGH dot)');
  await expectText(page.locator('.pfd-statepanel'), /Kentucky · 2024.*\$388\.\dM worth review of \$\d+\.\dM above the line.*HIGH 1.*VERIFY 3/s, 'radar Kentucky panel');
  assertions.push('Radar header: the lede reads $54.0B to 1,269 flagged services in 2024 with $46.7B above what enrollment predicts, mostly a billing convention; the money bar splits it by tier with "Worth review: $3.7B · HIGH $212.2M (11) + VERIFY $3.5B (74)" and "Likely convention: $40.2B (599)"; the 51-tile map colors Kentucky by the $388M worth review that may be shown (services paid to fewer than 11 billers left out) with a HIGH dot, and the Kentucky panel shows HIGH 1 and VERIFY 3. The first ranked row is Kentucky psychoeducation (H2027), $143.0M, 78.3% of US, suggested HIGH.');
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
  if ((await page.locator('.pfd-filterrows [data-tier]').count()) !== 7) throw new Error('radar does not show seven tier pills');
  if ((await page.locator('.pfd-filterrows [data-pattern]').count()) !== 4) throw new Error('radar does not show four pattern pills');
  await expectText(page.locator('[data-tier="high"]'), /HIGH\s*11/, 'HIGH tier pill count');
  await expectText(page.locator('[data-tier="convention"]'), /CONVENTION\?\s*599/, 'CONVENTION? tier pill count');
  // No billing-code or reporting change is on file yet, so nothing is rated EXPLAINED.
  await expectText(page.locator('[data-tier="explained"]'), /EXPLAINED\s*0/, 'EXPLAINED tier pill count');
  const allMatch = await matchCount();
  if (allMatch !== 1269) throw new Error('radar 2024 matches ' + allMatch + ' rows, expected 1,269');
  // Law and policy: every row carries a tag; "unexplained only" hides the rows with an innocent explanation on file.
  const firstTag = page.locator('.pfd-table tbody tr').first().locator('[data-explanation-tag]');
  await expectText(firstTag, /^safeguard relaxed$/, 'Kentucky psychoeducation tag');
  if ((await page.locator('.pfd-table tbody tr [data-explanation-tag]').count()) !== (await page.locator('.pfd-table tbody tr').count())) throw new Error('a radar row has no law-and-policy tag');
  const innocent = Number(/\((\d+) with an explanation on file\)/.exec(await page.locator('[data-innocent-count]').innerText())?.[1]);
  if (innocent !== 7) throw new Error('the unexplained-only filter reports ' + innocent + ' rows with an explanation on file in 2024, expected 7');
  await page.locator('[data-unexplained-only]').check();
  if ((await matchCount()) !== allMatch - innocent) throw new Error('unexplained only did not hide exactly the ' + innocent + ' explained rows');
  await expectText(page.locator('.pfd-table tbody tr').first().locator('[data-explanation-tag]'), /^safeguard relaxed$/, 'Kentucky psychoeducation stays under unexplained only');
  await page.locator('[data-unexplained-only]').uncheck();
  if ((await matchCount()) !== allMatch) throw new Error('clearing unexplained only did not restore the rows');
  assertions.push('Radar law and policy: every row carries a tag, Kentucky psychoeducation reads "safeguard relaxed", and "Unexplained only" hides exactly the ' + innocent + ' rows of 2024 with an innocent explanation on file while Kentucky psychoeducation stays first.');
  const firstCells = page.locator('.pfd-table tbody tr').first().locator('td');
  if ((await firstCells.nth(7).locator('.pfd-fp i').count()) !== 7) throw new Error('first row fingerprint does not have seven cells');
  if ((await firstCells.nth(3).locator('svg.pfd-spark circle').count()) !== 1) throw new Error('first row sparkline has no marked year');
  if ((await firstCells.nth(5).locator('svg.pfd-sharebar line').count()) !== 1) throw new Error('first row share bar has no enrollment tick');
  assertions.push('Radar rows: six year pills, seven tier pills (HIGH 11, CONVENTION? 599, EXPLAINED 0) and four pattern pills; 1,269 rows match in 2024; each row has a paid sparkline with the year marked, a share bar with the enrollment tick, and a seven-cell signal fingerprint.');
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

  // Score rule: session sliders move the tiers on every page; the program refuses a rule it cannot use; reset restores the starting rule.
  const summary = page.locator('[data-score-rule-summary]');
  const waitSummary = (re) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('[data-score-rule-summary]')?.textContent ?? ''), re.source);
  const pillCount = async (k) => Number((await page.locator(`[data-tier="${k}"] b`).innerText()).replace(/,/g, ''));
  await expectText(summary, /starting rule · HIGH ≥ 70 · VERIFY ≥ 40 · points total 105/, 'score rule summary at start');
  await page.locator('[data-score-rule-toggle]').click();
  const ruleSliders = await page.locator('[data-score-rule]').count();
  if (ruleSliders !== 9) throw new Error('score rule shows ' + ruleSliders + ' sliders, expected 2 cut-offs and 7 weights');
  await page.locator('[data-score-rule="cutoff-high"]').fill('60');
  await waitSummary(/adjusted for this session · HIGH ≥ 60 · VERIFY ≥ 40/);
  await page.waitForFunction(() => Number(document.querySelector('[data-tier="high"] b')?.textContent.replace(/,/g, '')) > 11);
  const high60 = await pillCount('high');
  await expectText(page.locator('[data-score-rule-tier="high"]'), new RegExp('HIGH\\s*' + high60.toLocaleString('en-US') + '\\s*\\(was 11\\)'), 'score rule HIGH against the starting rule');
  if ((await page.locator('[data-score-rule-adjusted]').count()) !== 1) throw new Error('side note does not say the score rule is adjusted');
  await page.locator('[data-score-rule="weight-shareSurge"]').fill('0');
  await waitSummary(/points total 85/);
  const highNoSurge = await pillCount('high');
  if (!(highNoSurge < high60)) throw new Error('dropping the share-surge points did not lower HIGH: ' + high60 + ' then ' + highNoSurge);
  await shot(page, '1g-national-radar-score-rule.png');
  await page.locator('[data-score-rule="cutoff-verify"]').fill('65');
  await expectText(page.locator('[data-score-rule-problem]'), /Not applied: the VERIFY cut-off must be below the HIGH cut-off\. The radar keeps the last rule that worked\./, 'score rule refused');
  if ((await pillCount('high')) !== highNoSurge) throw new Error('a refused rule changed the tiers');
  await shot(page, '1h-national-radar-score-rule-refused.png');
  await page.locator('[data-score-rule-reset]').click();
  await waitSummary(/starting rule · HIGH ≥ 70 · VERIFY ≥ 40 · points total 105/);
  await page.waitForFunction(() => document.querySelector('[data-tier="high"] b')?.textContent === '11');
  if ((await page.locator('[data-score-rule-adjusted], [data-score-rule-problem]').count()) !== 0) throw new Error('reset left the adjusted note or a problem showing');
  await page.locator('[data-score-rule-toggle]').click();
  assertions.push('Score rule: nine sliders (two cut-offs, seven weights); HIGH at 60 lifts HIGH from 11 to ' + high60 + ' (shown against the starting rule, side note says adjusted); share surge at 0 points brings the total to 85 and HIGH to ' + highNoSurge + '; VERIFY at 65 is refused by the program and the tiers stay put; reset restores the starting rule and HIGH 11.');

  // 2. Program blow-up (Kentucky psychoeducation by default): tile-map picker, program list, one-axis chart
  await page.locator('[data-fraud-page="blowups"]').click();
  const blowupH1 = page.locator('.pfd-page h1').first();
  await expectText(blowupH1, /Program blow-up · Kentucky · Psychoeducation.*\(H2027\), 2018/, 'blow-up heading');
  if ((await blowupH1.locator('[data-code-help="H2027"]').count()) !== 1) throw new Error('the blow-up heading has no "?" beside its code');
  const pickerTiles = await page.locator('.pfd-picker .pfd-tm-tile').count();
  if (pickerTiles !== 51) throw new Error(`blow-up tile map has ${pickerTiles} tiles, expected 51`);
  const kyTile = page.locator('.pfd-picker .pfd-tm-tile[data-state="KY"]');
  if ((await kyTile.getAttribute('aria-pressed')) !== 'true') throw new Error('Kentucky tile is not selected');
  const firstProgram = page.locator('.pfd-program').first();
  await expectText(firstProgram, /Psychoeducation.*H2027.*HIGH/s, 'blow-up first program');
  if (!(await firstProgram.getAttribute('class')).includes('is-on')) throw new Error('first program is not highlighted');
  const legendItems = await page.locator('.pfd-grow .pfd-legend .pfd-legend-item').count();
  if (legendItems !== 4) throw new Error(`blow-up chart legend has ${legendItems} entries, expected 4`);
  const pinYears = await page.locator('.pfd-chart [data-policy-pin]').evaluateAll((els) => els.map((e) => e.getAttribute('data-policy-pin')));
  if (pinYears.join(',') !== '2020,2023') throw new Error('blow-up chart policy pins are on ' + pinYears.join(','));
  const policyRows = page.locator('tr[data-event-kind="policy"]');
  if ((await policyRows.count()) !== 6) throw new Error('blow-up dated events list ' + (await policyRows.count()) + ' policy events, expected 6');
  await expectText(policyRows.first(), /2020-02-04.*suspen.*in force when it began/is, 'blow-up first policy event');
  assertions.push('Program blow-up law and policy: the chart pins a policy event on 2020 and on 2023, and the dated events list the six Kentucky events on file with their sources, the 2020 suspension first and "in force when it began".');
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
  await expectText(caseH1, /Psychoeducation.* · H2027/, 'case heading');
  // The "?" beside the code carries its description and opens the glossary at the code's own entry.
  const codeHelp = caseH1.locator('[data-code-help="H2027"]');
  const codeHelpTitle = (await codeHelp.getAttribute('title')) ?? '';
  if (!/^H2027: The HCPCS code for psychoeducational service, billed per 15 minutes\./.test(codeHelpTitle)) throw new Error(`code help title: "${codeHelpTitle.slice(0, 160)}"`);
  await codeHelp.click();
  await expectText(page.locator('.glossary-modal'), /H2027[\s\S]*psychoeducational service, billed per 15 minutes/, 'glossary entry for H2027');
  await shot(page, 'potential-fraud-case-code-glossary-1440x1000.png');
  await page.locator('.glossary-modal .explain-close').click();
  if ((await page.locator('.glossary-modal').count()) !== 0) throw new Error('the glossary stayed open after closing');
  assertions.push('Case file: the "?" beside H2027 shows its description on hover and opens the glossary at H2027 (psychoeducational service, billed per 15 minutes).');
  await expectText(page.locator('.pfd-case-sub'), /Case file · Kentucky 2024 · 8 of 12 public signals fired · 6 checks wait on data · stands at Opened/, 'case subtitle');
  await expectText(page.locator('.pfd-case-title .pfd-tier'), /HIGH · 99/, 'case tier badge');
  const ledger = page.locator('[data-policy-ledger]');
  await expectText(ledger.locator('.pfd-ledger-lead [data-explanation-tag]'), /^safeguard relaxed$/, 'case ledger tag');
  await expectText(ledger.locator('[data-policy-start]'), /The rise this year belongs to starts in 2023\. 3 searches of Kentucky on file \(all partial\), searched through 2026-04-24\./, 'case ledger start and search');
  if ((await ledger.locator('tr[data-policy-group="on file"]').count()) !== 2 || (await ledger.locator('tr[data-policy-group="later"]').count()) !== 4) throw new Error('case ledger does not list two events on file and four later ones');
  await expectText(ledger.locator('tr[data-policy-event="ky-prior-authorization-suspended-2020-02"]'), /2020-02-04.*safeguard relaxed.*in force when it began.*confirmed by a person, 2026-11-11 · counted/s, 'case ledger suspension row');
  if ((await ledger.locator('tr[data-policy-event="ky-prior-authorization-suspended-2020-02"] [data-code-help="H"]').count()) !== 1) throw new Error('the ledger shows a code family with no "?" beside it');
  if (/Greenwood/.test(await ledger.innerText())) throw new Error('the ledger names a person');
  await expectText(page.locator('[data-ledger-answer]'), /On file: safeguard relaxed/, 'ledger answer beside the policy question');
  assertions.push('Case file law and policy: the ledger tags Kentucky psychoeducation 2024 "safeguard relaxed", dates the rise to 2023, reports three partial searches through 2026-04-24, and lists the 2020 suspension (in force when it began, counted) and the 2023 record on file plus four later events, each with its source and a "?" beside its codes; no person is named.');
  await shot(page, '3d-case-file-law-and-policy.png');
  await expectText(page.locator('.pfd-case-sentence'), /Kentucky was paid \$143\.0M, which is 78\.3% of all US payments.*fair share at 1\.8% of US enrollment would be \$3\.2M/s, 'case sentence');
  const fired = await page.locator('[data-check-kind="fired"]').count();
  const pending = await page.locator('[data-check-kind="pending"]').count();
  const tilesTotal = await page.locator('.pfd-sg-tile').count();
  if (fired !== 8 || pending !== 6 || tilesTotal !== 18) throw new Error('case signal grid fired=' + fired + ' pending=' + pending + ' tiles=' + tilesTotal);
  await page.locator('[data-check="displacement"]').click();
  await expectText(page.locator('[data-check-detail]'), /AZ .*70\.3%.*7\.6%/, 'displacement tile detail');
  await page.locator('[data-check="recently-enumerated"]').click();
  await expectText(page.locator('[data-check-detail]'), /37 of 79 new billers were enumerated in 2023 or 2024 \(46\.8%, \$12\.\dM paid\) · NPPES Feb 2026 through a third-party mirror/, 'recently enumerated tile detail');
  if ((await page.locator('[data-check="recently-enumerated"]').getAttribute('data-check-kind')) !== 'fired') throw new Error('recently enumerated tile is not fired');
  await shot(page, '3c-case-file-nppes-enumerated.png');
  await page.locator('[data-check="off-taxonomy"]').click();
  await expectText(page.locator('[data-check-detail]'), /36 of 171 billers, \d+\.\d% of paid .*outside the 17 taxonomies that bill 90% of the code nationally/, 'off-taxonomy tile detail');
  if ((await page.locator('[data-check="off-taxonomy"]').getAttribute('data-check-kind')) !== 'clear') throw new Error('off-taxonomy tile should be clear for Kentucky psychoeducation');
  const listGroups = await page.locator('[data-case-group]').allTextContents();
  if (!listGroups.some((g) => /HIGH · 1/.test(g)) || !listGroups.some((g) => /▸ CONVENTION\? · 32/.test(g))) throw new Error('case list groups: ' + listGroups.join(' | '));
  if ((await page.locator('[data-case="KY|H2027|2024"][aria-pressed="true"]').count()) !== 1) throw new Error('Kentucky psychoeducation is not the selected case');
  assertions.push('Case file: Kentucky psychoeducation 2024 reads HIGH · 99, "8 of 12 public signals fired · 6 checks wait on data", $143.0M paid against a $3.2M fair share; the 18-tile signal grid has 8 fired and 6 waiting tiles, and the displacement tile shows Arizona 70.3% to 7.6%; the case list groups HIGH open and CONVENTION? (32) collapsed.');
  await page.locator('[data-answer="coverage:no"]').click();
  await page.locator('[data-stage="4"]').click();
  await page.locator('[data-closed-as="billing convention"]').click();
  await expectText(page.locator('[data-case-stage]'), /Closed as billing convention/, 'case stage after closing');
  assertions.push('Case file: answering No, stepping to Closed and picking "billing convention" shows "stands at Closed as billing convention".');
  await page.locator('[data-stage="0"]').click();
  if ((await page.locator('[data-closed-as]').count()) !== 0) throw new Error('closed-as reasons still shown after stepping back to Opened');
  await page.locator('[data-case-group="convention"]').click();
  if ((await page.locator('[data-case-group="convention"][aria-expanded="true"]').count()) !== 1) throw new Error('CONVENTION? group did not expand');
  await page.locator('[data-case-group="convention"]').click();
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
  await expectText(page.locator('[data-line="enrollment"]'), /Enrollment share \$722\.0M/, 'reallocation enrollment line total');
  await expectText(page.locator('[data-line="prior-year"]'), /Prior-year share \$105\.0M/, 'reallocation prior-year line total');
  await expectText(page.locator('[data-line="peer-state"]'), /Peer-state median \$744\.0M/, 'reallocation peer-state line total');
  await expectText(page.locator('[data-funnel^="Paid on"]'), /Paid on 40 flagged services.*\$774\.6M/, 'reallocation funnel paid');
  await expectText(page.locator('[data-funnel="Upheld at 60%"]'), /\$433\.2M/, 'reallocation freed at 60%');
  await expectText(page.locator('[data-funnel="Who paid it"]'), /fed \$311\.0M/, 'reallocation federal share');
  await expectText(page.locator('[data-funnel="Available to plan"]'), /\$433\.2M/, 'reallocation available inside Medicaid');
  await expectText(page.locator('[data-allocated]'), /Allocated \$438\.4M of \$433\.2M/, 'reallocation default allocation (the default allocations run $5.2M over)');
  await shot(page, '4-reallocation-what-if.png');
  await page.locator('[data-destination="general-fund"]').click();
  await expectText(page.locator('[data-allocated]'), /over by \$316\.\dM/, 'reallocation over-allocation warning');
  await shot(page, '4b-reallocation-general-fund-over-allocated.png');
  await page.getByRole('button', { name: 'Fit to available' }).click();
  await expectText(page.locator('[data-allocated]'), /Allocated \$121\.\dM of \$122\.2M/, 'reallocation fitted to the state share');
  assertions.push('Reallocation: with the 3 Kentucky services paid to fewer than 11 billers left out (40 of 43; one was paid $0), the line buttons read Enrollment share $722.0M, Prior-year share $105.0M and Peer-state median $744.0M; the funnel runs $774.6M paid to $433.2M upheld at 60% (fed $311.0M) and $433.2M available inside Medicaid, against $438.4M of default allocations; To General Fund flags the over-allocation, and Fit to available rescales the needs to the $122.2M state share.');
  await page.locator('[data-gap="school-clinicians"]').click();
  await page.getByLabel(/Gap for School-based mental health clinicians/).fill('60');
  await page.getByLabel(/Cost per unit for School-based mental health clinicians/).fill('100K');
  await page.locator('[data-need-editor="school-clinicians"]').getByRole('button', { name: 'Save' }).click();
  await expectText(page.locator('[data-need="school-clinicians"]'), /edited this session.*\$0 of \$60\.0M gap/s, 'reallocation edited gap');
  await page.locator('[data-step="school-clinicians:+"]').click();
  await expectText(page.locator('[data-need="school-clinicians"]'), /\$10\.0M of \$60\.0M gap · ≈ 100 clinicians/, 'reallocation edited unit cost and plus step');
  await page.getByRole('button', { name: '+ Add a need' }).click();
  await page.getByLabel('New need', { exact: true }).fill('Dental access, rural counties');
  await page.getByLabel(/New need gap/).fill('25');
  await page.getByLabel('New need cost per unit').fill('$50K');
  await page.getByLabel('New need unit').fill('dental clinics staffed for a year');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expectText(page.locator('[data-need="added-1"]'), /Dental access, rural counties.*Added this session.*\$0 of \$25\.0M gap · ≈ 0 dental clinics/s, 'reallocation added need');
  await page.locator('[data-step="added-1:+"]').click();
  await expectText(page.locator('[data-need="added-1"]'), /\$10\.0M of \$25\.0M gap · ≈ 200 dental clinics/, 'reallocation added need allocated');
  await shot(page, '4c-reallocation-edited-and-added-needs.png');
  assertions.push('Reallocation: editing the school clinicians need to a $60M gap at $100K per clinician and pressing + allocates $10.0M (about 100 clinicians); "+ Add a need" adds "Dental access, rural counties" ($25.0M gap, $50K per clinic), marked added this session, and + allocates $10.0M (about 200 clinics).');
  await page.locator('[data-destination="medicaid"]').click();

  // 5. Tools and data coverage
  await page.locator('[data-fraud-page="tools"]').click();
  await page.getByRole('heading', { name: /Detection tools & data coverage/ }).waitFor();
  const toolTiles = await page.locator('[data-analysis]').count();
  const byStatus = {};
  for (const k of ['running', 'ready', 'needs']) byStatus[k] = await page.locator(`[data-analysis-status="${k}"]`).count();
  if (toolTiles !== 25 || byStatus.running !== 12 || byStatus.ready !== 9 || byStatus.needs !== 4) throw new Error('tools tiles ' + toolTiles + ' ' + JSON.stringify(byStatus));
  await expectText(page.locator('[data-running-count]'), /12 of 25/, 'tools running count');
  await expectText(page.locator('[data-status-count="ready"]'), /Ready to build 9/, 'tools legend ready');
  await expectText(page.locator('[data-status-count="needs"]'), /Needs a data load 4/, 'tools legend needs');
  const rows = await page.locator('[data-tier-row]').count();
  if (rows !== 4) throw new Error('tools tier rows ' + rows);
  await shot(page, '5-tools-and-data-coverage.png');
  await page.locator('[data-source="leie"]').click();
  await expectText(page.locator('[data-tools-detail]'), /exclusion list.*loaded, as of 2026-08-31.*feeds 1 analysis/i, 'tools LEIE source');
  const lit = await page.locator('.pfd-tc-tile:not(.is-dim)').count();
  if (lit !== 1) throw new Error('LEIE should light 1 analysis, lit ' + lit);
  await page.locator('[data-source="tmsis"]').click();
  const litTmsis = await page.locator('.pfd-tc-tile:not(.is-dim)').count();
  await expectText(page.locator('[data-tools-detail]'), new RegExp('feeds ' + litTmsis + ' analyses'), 'tools T-MSIS source');
  await page.locator('[data-source="segments"]').click();
  await expectText(page.locator('[data-source="segments"]'), /not loaded · Enrollment segments/, 'tools missing source chip');
  await expectText(page.locator('[data-tools-detail]'), /not loaded.*feeds 1 analysis/, 'tools segments source');
  const litSegments = await page.locator('.pfd-tc-tile:not(.is-dim)').count();
  if (litSegments !== 1) throw new Error('enrollment segments should light 1 analysis, lit ' + litSegments);
  await shot(page, '5b-tools-source-enrollment-segments.png');
  await page.locator('[data-source="segments"]').click();
  await page.locator('[data-source="nppes"]').click();
  await expectText(page.locator('[data-source="nppes"]'), /partial · NPPES/, 'tools NPPES chip');
  await expectText(page.locator('[data-tools-detail]'), /NPPES NPI registry · partial, through the DR-REAL-TMSIS-STATE-CODE-SPENDING load .*enumeration date and primary taxonomy.*no provider is named · feeds 2 analyses/, 'tools NPPES partial');
  await page.locator('[data-source="nppes"]').click();
  await page.getByRole('button', { name: 'Can health explain it' }).click();
  await expectText(page.locator('[data-tools-detail]'), /Tier D.*running · uses CMS enrollment · would also use NSDUH \/ PLACES/, 'tools tile detail');
  assertions.push('Tools and data coverage: 25 analysis tiles in four tier rows, 12 running (the policy-event overlay among them), 9 ready to build and 4 needing a data load (the true statuses); clicking LEIE lights the one analysis it feeds, T-MSIS spending reports the count it lights, enrollment segments shows as not loaded, and the "Can health explain it" tile names its data and what it waits on.');

  // 6. Backtests
  await page.locator('[data-fraud-page="backtest"]').click();
  await page.getByRole('heading', { name: /Backtests & known cases/ }).waitFor();
  await expectText(page.locator('[data-backtest-headline]'), /7 of 7 pass\. The radar catches the 5 known fraud case-years and leaves the 2 innocent conventions alone\./, 'backtest headline');
  const btCards = await page.locator('[data-backtest-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-backtest-card')));
  if (JSON.stringify(btCards) !== JSON.stringify(['KY|H2027', 'AZ|H2027', 'DC|H0036'])) throw new Error('backtest cards ' + JSON.stringify(btCards));
  await expectText(page.locator('[data-backtest-card="KY|H2027"]'), /Kentucky · psychoeducation H2027\s*2 \/ 2.*HIGH 93.*HIGH 99/, 'backtest KY card');
  await expectText(page.locator('[data-backtest-card="AZ|H2027"]'), /Arizona · psychoeducation H2027\s*2 \/ 2.*HIGH 70.*CLOSED/, 'backtest AZ card');
  await expectText(page.locator('[data-backtest-card="DC|H0036"]'), /psychiatric support H0036\s*1 \/ 1.*VERIFY 59/, 'backtest DC card');
  const enforce = await page.locator('[data-enforcement]').evaluateAll((els) => els.map((e) => e.getAttribute('data-enforcement')));
  if (JSON.stringify(enforce) !== '["2023"]') throw new Error('backtest enforcement lines ' + JSON.stringify(enforce));
  const btPolylines = await page.locator('[data-backtest-card] polyline').count();
  if (btPolylines !== 3) throw new Error('backtest share lines ' + btPolylines);
  await expectText(page.locator('[data-backtest-conventions]'), /2 \/ 2 set aside/, 'backtest conventions chip');
  await expectText(page.locator('[data-convention="ky-s5108-convention"]'), /home-care training S5108.*billed in 5 states/, 'backtest S5108');
  await expectText(page.locator('[data-convention="ky-g2087-convention"]'), /opioid treatment bundle G2087.*billed in 7 states/, 'backtest G2087');
  await expectText(page.locator('[data-backtest-conventions]'), /10-state filter.*\$100,000.*out of 51/, 'backtest filter note');
  await shot(page, '6-backtests.png');
  await page.locator('[data-case="ky-h2027-2024"]').click();
  await page.locator('[data-fraud-page="cases"].is-on').waitFor();
  await expectText(page.locator('.pfd-main'), /psychoeducation/i, 'backtest dot opens the case');
  await page.locator('[data-fraud-page="backtest"]').click();
  await page.locator('[data-backtest-headline]').waitFor();
  assertions.push('Backtests: 7 of 7 pass; three share-of-US cards (Kentucky and Arizona psychoeducation, DC psychiatric support) mark the flagged case-years with tier and score (HIGH 93 and 99, HIGH 70 and CLOSED, VERIFY 59) and the Arizona 2023 enforcement line; the two conventions are drawn at 5 and 7 states billing against the 10-state filter; clicking the Kentucky 2024 point opens its case file.');

  // 7. The five oversight pages
  const pickService = async (state, key) => {
    await page.locator('[data-oversight-state]').selectOption(state);
    if (key) await page.locator('[data-oversight-service]').selectOption(key);
  };
  const newBadges = await page.locator('.pfd-side-new').count();
  if (newBadges !== 5) throw new Error(`side nav shows ${newBadges} NEW badges, expected 5`);
  await page.locator('[data-fraud-page="early"]').click();
  await page.locator('[data-oversight-page="early"]').waitFor({ timeout: 60_000 });
  await pickService('KY', 'KY|H2027');
  await expectText(page.locator('.pfd-page h1'), /Early warning · Kentucky · Psychoeducation/i, 'early warning heading');
  await expectText(page.locator('[data-early-chart]'), /First alert: Jul 2023.*paid \$8\.\dM/s, 'early warning alert box');
  const bars = await page.locator('[data-early-chart] rect[data-month]').count();
  if (bars < 40) throw new Error(`early warning chart has ${bars} month bars`);
  await expectText(page.locator('[data-tile="paid-after-alert"]'), /\$182\.8M.*Aug 2023 – Dec 2024/s, 'paid after the alert');
  await expectText(page.locator('[data-tile="months-to-restriction"]'), /18 months/, 'months to the first restriction');
  await expectText(page.locator('[data-known-outcomes]'), /Arizona.*District of Columbia.*Kentucky/s, 'known cases');
  await expectText(page.locator('[data-first-flags]'), /136.*of 1,269 flags in 2024/s, 'first-time flags');
  assertions.push(`Early warning: Kentucky psychoeducation (H2027) draws ${bars} monthly bars from 2021 with the first alert in July 2023 (May–Jul paid about $8.4M); $182.8M was paid Aug 2023 – Dec 2024 and the first confirmed restriction came 18 months after the alert; the known-case table lists Arizona, DC and Kentucky; 136 of 1,269 flags in 2024 are first-time.`);
  await shot(page, '7a-early-warning.png');

  await page.locator('[data-fraud-page="follow"]').click();
  await page.locator('[data-oversight-page="follow"]').waitFor();
  await pickService('KY', 'KY|H2027');
  await expectText(page.locator('[data-group="KY|H2027|2020"]'), /Kentucky group · the \d+ billers of psychoeducation, per 15 minutes in 2020/i, 'played-out group');
  const svcTiles = await page.locator('[data-group-service]').count();
  if (svcTiles < 2) throw new Error(`played-out group shows ${svcTiles} service tiles`);
  await expectText(page.locator('[data-watch-list="KY|H2027|2024"]'), /171 Kentucky billers of psychoeducation, per 15 minutes in 2024/i, 'watch list');
  await page.locator('[data-national-code]').waitFor();
  await pickService('AZ', 'AZ|H2027');
  await expectText(page.locator('[data-group="AZ|H2027|2022"]'), /the 239 billers of psychoeducation, per 15 minutes in 2022/i, 'Arizona played-out group');
  await expectText(page.locator('[data-tile="group-billing-path"]'), /239 → 206 → 107/, 'Arizona billing path');
  assertions.push(`Follow the billers: Kentucky psychoeducation shows its own 2020 group across ${svcTiles} service tiles, the national split, and the 171 billers of 2024 as a watch list; Arizona psychoeducation shows the 239 billers of 2022 with 239 → 206 → 107 still billing.`);
  await shot(page, '7b-follow-the-billers.png');

  await page.locator('[data-fraud-page="patterns"]').click();
  await page.locator('[data-oversight-page="patterns"]').waitFor();
  await pickService('KY', 'KY|H2027');
  await expectText(page.locator('[data-profile-signs]'), /74%.*126 of 171.*higher than 9\d% of them/s, 'newcomer signs');
  await expectText(page.locator('[data-other-patterns]'), /fewer than 11.*of 27/s, 'withheld million-fast count');
  await expectText(page.locator('[data-areas]'), /ZIP 402 · Louisville.*All other areas, merged/s, 'practice areas');
  const authorized = await page.locator('[data-view="Authorized view · provider list"]').isDisabled();
  if (!authorized) throw new Error('the authorized provider-list view can be picked');
  assertions.push('Provider patterns: Kentucky psychoeducation 2024 shows 74% newcomer billers (126 of 171) ranked above 90% of comparable state services, a withheld million-fast count (fewer than 11 of 27), practice areas with small areas merged, and the authorized provider list disabled as not available.');
  await shot(page, '7c-provider-patterns.png');

  await page.locator('[data-fraud-page="ledger"]').click();
  await page.locator('[data-oversight-page="ledger"]').waitFor();
  await pickService('KY', 'KY|H2027');
  const ledgerRows = await page.locator('[data-ledger-events] tbody tr').count();
  if (ledgerRows < 6) throw new Error(`ledger lists ${ledgerRows} rows`);
  await expectText(page.locator('[data-ledger-row="alert"]'), /Jul 2023.*the rise itself/s, 'ledger first-alert row');
  await expectText(page.locator('[data-ledger-verdict]'), /UNEXPLAINED SO FAR.*safeguard relaxed/s, 'ledger verdict');
  await expectText(page.locator('[data-ledger-split]'), /not yet searched 1,167.*explained 7.*unexplained so far 95/s, 'ledger split');
  await expectText(page.locator('[data-agency-response]'), /No response attached yet/, 'agency response placeholder');
  assertions.push(`Explanation ledger: Kentucky psychoeducation lists ${ledgerRows} rows (the six dated Kentucky events plus the July 2023 first alert), reads UNEXPLAINED SO FAR with the "safeguard relaxed" tag, splits the 2024 radar into 1,167 not yet searched, 7 explained and 95 unexplained so far, and shows the agency response as not yet available.`);
  await shot(page, '7d-explanation-ledger.png');

  await page.locator('[data-fraud-page="brief"]').click();
  await page.locator('[data-oversight-page="brief"]').waitFor();
  await pickService('WV');
  await expectText(page.locator('.pfd-page h1'), /Medicaid spending oversight brief · West Virginia · 2024/, 'brief heading');
  await expectText(page.locator('.pfd-sub').first(), /0\.64%.*55 services.*\$\d+\.\dM above the line in total, leaving out \d+ services? paid to fewer than 11 billers/s, 'brief summary');
  const briefSummary = (await page.locator('.pfd-sub').first().innerText()).match(/(\$\d+\.\dM) above the line in total, leaving out (\d+)/);
  if (await page.locator('.pfd-sub').first().getByText('$300.9M').count()) throw new Error('the brief total still holds the withheld services');
  const briefRows = await page.locator('[data-brief-rows] tbody tr').count();
  if (briefRows !== 10) throw new Error(`brief shows ${briefRows} rows before "show all"`);
  await expectText(page.locator('[data-brief-questions]'), /West Virginia's share of enrollment.*2025 and 2026/s, 'brief questions');
  await expectText(page.locator('[data-data-clock]'), /through Dec 2024.*Feb 2026.*not connected/s, 'data clock');
  await page.locator('[data-brief-show-all]').click();
  const allBriefRows = await page.locator('[data-brief-rows] tbody tr').count();
  const withheldRows = await page.locator('[data-brief-rows] tbody tr', { hasText: 'fewer than 11' }).count();
  if (allBriefRows !== 55 || withheldRows < 1) throw new Error(`brief shows ${allBriefRows} rows, ${withheldRows} withheld`);
  await page.locator('[data-brief-show-all]').click();
  assertions.push(`State oversight brief: West Virginia 2024 holds 0.64% of enrollment, 55 services above the line, ${briefSummary[1]} above it from the services that may be shown (${briefSummary[2]} left out); the first 10 rows show, "show all" lists 55 with ${withheldRows} rows of fewer than 11 billers whose dollars are withheld; the questions name West Virginia and ask for 2025 and 2026; the data clock reads through Dec 2024, published Feb 2026, state claims feed not connected.`);
  await shot(page, '7e-state-oversight-brief.png');

  await page.setViewportSize({ width: 1100, height: 900 });
  const overflow = await page.evaluate(() => { const main = document.querySelector('.pfd-main'); return main ? main.scrollWidth - main.clientWidth : 0; });
  if (overflow > 2) throw new Error(`state brief overflows ${overflow}px at 1100px`);
  assertions.push('State oversight brief: at 1100px wide (a laptop, with the app navigation open) the page has no horizontal overflow outside its tables.');
  await shot(page, '7f-state-oversight-brief-1100.png');
  await page.setViewportSize({ width: 1600, height: 1000 });

  if (logs.consoleErrors.length || logs.pageErrors.length) throw new Error(`Browser errors: ${[...logs.consoleErrors, ...logs.pageErrors].join(' | ')}`);

  const sourceFiles = [
    'wireframe V1/app/src/components/fraud/PotentialFraudDetection.jsx',
    'wireframe V1/app/src/components/fraud/ProgramBlowupPage.jsx',
    'wireframe V1/app/src/components/fraud/fraudVisuals.jsx',
    'wireframe V1/app/src/components/fraud/RadarOverview.jsx',
    'wireframe V1/app/src/components/fraud/CaseFilePage.jsx',
    'wireframe V1/app/src/components/fraud/ReallocationPage.jsx',
    'wireframe V1/app/src/components/fraud/ToolsCoveragePage.jsx',
    'wireframe V1/app/src/components/fraud/BacktestPage.jsx',
    'wireframe V1/app/src/components/fraud/ScoreRulePanel.jsx',
    'wireframe V1/app/src/components/fraud/oversightShared.jsx',
    'wireframe V1/app/src/components/fraud/EarlyWarningPage.jsx',
    'wireframe V1/app/src/components/fraud/FollowBillersPage.jsx',
    'wireframe V1/app/src/components/fraud/ProviderPatternsPage.jsx',
    'wireframe V1/app/src/components/fraud/ExplanationLedgerPage.jsx',
    'wireframe V1/app/src/components/fraud/StateBriefPage.jsx',
    'wireframe V1/app/src/lib/fraud/oversightProgram.js',
    'wireframe V1/app/src/data/alp/oversightAggregates.js',
    'wireframe V1/app/src/lib/fraud/potentialFraudSignalProgram.js',
    'wireframe V1/app/src/lib/fraud/leveledDollarReallocationProgram.js',
    'wireframe V1/app/src/data/alp/potentialFraudRadar.js',
    'wireframe V1/app/src/styles.css',
  ];
  const source = await Promise.all(sourceFiles.map(async (relativePath) => ({ relativePath, sha256: crypto.createHash('sha256').update(await readFile(path.join(repoPath, relativePath))).digest('hex') })));
  await writeJson('manifest.json', {
    schemaVersion: 1,
    evidenceClass: 'isolated-rendered',
    claim: 'The Potential Fraud Detection module renders its eleven pages from the national radar and oversight exports: the radar with real 2024 figures, the Kentucky psychoeducation blow-up and case file, the reallocation what-if, tools and data coverage, the backtest, and the five oversight pages (early warning, follow the billers, provider patterns, explanation ledger, West Virginia state oversight brief).',
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
