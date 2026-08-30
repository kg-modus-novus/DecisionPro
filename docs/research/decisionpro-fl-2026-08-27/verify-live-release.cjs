const fs = require('fs');
const path = require('path');

const playwrightPath = path.join(process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp', 'decisionpro-playwright-runtime', 'node_modules', 'playwright-core');
const { chromium } = require(playwrightPath);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.DECISIONPRO_DEMO_URL || 'https://demo.decisionpro.io/';
const artifacts = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR || path.join(__dirname, 'evidence', 'live-release');
const isolatedRendered = Boolean(process.env.SCRIPTORIUM_UI_DESKTOP_NAME);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function contrastRatio(foreground, background) {
  const parse = (value) => String(value).match(/[\d.]+/g).slice(0, 3).map(Number);
  const luminance = (value) => parse(value)
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce((total, channel, index) => total + (channel * [0.2126, 0.7152, 0.0722][index]), 0);
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: !isolatedRendered, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  const responseErrors = [];
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) consoleErrors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) responseErrors.push(`${response.status()} ${response.url()}`); });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const comparisonLink = page.getByRole('link', { name: /Explore the comparison/i });
  assert(await comparisonLink.count() === 1, 'Comparison tile is missing from the live landing page.');
  const comparisonLinkStyle = await comparisonLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, backgroundColor: style.backgroundColor };
  });
  const comparisonLinkContrast = Number(contrastRatio(comparisonLinkStyle.color, comparisonLinkStyle.backgroundColor).toFixed(2));
  assert(comparisonLinkContrast >= 4.5, `Live comparison CTA contrast is ${comparisonLinkContrast}:1.`);
  const landingScreenshot = path.join(artifacts, 'demo-state-landing.png');
  await page.screenshot({ path: landingScreenshot, fullPage: true });
  await comparisonLink.click();
  await page.waitForLoadState('networkidle');
  assert(new URL(page.url()).searchParams.get('compare') === 'FL', 'Live comparison URL did not retain compare=FL.');
  assert(await page.getByRole('heading', { name: /Florida already has public dashboards/i }).count() === 1, 'Live Florida comparison hero is missing.');
  assert(await page.locator('.comparison-table tbody tr').count() === 8, 'Live comparison matrix is incomplete.');
  assert(await page.locator('.comparison-stats article').count() === 5, 'Live comparison metrics are incomplete.');
  const screenshot = path.join(artifacts, 'demo-fl-comparison.png');
  await page.screenshot({ path: screenshot, fullPage: true });

  const floridaUrl = new URL(baseUrl);
  floridaUrl.searchParams.set('state', 'FL');
  await page.goto(floridaUrl.href, { waitUntil: 'networkidle' });
  assert(await page.getByText('DecisionPro Florida', { exact: true }).count() >= 1, 'Live Florida product identity is missing.');
  const budgetRole = page.getByRole('button', { name: /budget \/ fiscal analyst/i }).first();
  if (await budgetRole.count()) await budgetRole.click();
  const skipGuide = page.getByRole('button', { name: /skip all/i }).first();
  if (await skipGuide.count()) await skipGuide.click().catch(() => {});
  await page.getByRole('heading', { name: /Turn Florida’s public health-care dashboards/i }).waitFor();
  await page.getByRole('button', { name: /^Operational intelligence$/i }).click();
  await page.getByRole('heading', { name: 'Operational intelligence' }).waitFor();
  assert(await page.locator('.ops-goal-tile').count() === 6, 'Live Florida operational goal set is incomplete.');
  await page.locator('.ops-goal-tile').first().click();
  const opportunityText = await page.locator('.ops-opportunity-panel').innerText();
  assert(opportunityText.includes('$17.38M'), 'Live Florida spending opportunity is not calibrated to the hydrated financial review universe.');
  assert(opportunityText.includes('35 files'), 'Live Florida spending opportunity is missing the hydrated machine-readable fee-schedule scope.');
  assert(opportunityText.toLowerCase().includes('observed financial review universe'), 'Live observed financial scope is mislabeled as a modeled savings estimate.');
  const floridaOpportunityScreenshot = path.join(artifacts, 'demo-fl-recalibrated-opportunities.png');
  await page.screenshot({ path: floridaOpportunityScreenshot, fullPage: true });
  await page.getByRole('tab', { name: 'Evidence & Data', exact: true }).click();
  assert((await page.locator('body').innerText()).includes('3,877,393'), 'Live Florida eligibility total is stale or missing.');
  assert((await page.locator('body').innerText()).includes('9,093'), 'Live Florida aggregate LEIE workload is stale or missing.');
  await page.getByRole('button', { name: /^Authoritative sources$/i }).click();
  await page.getByRole('heading', { name: 'Authoritative Sources' }).waitFor();
  const sourceRows = await page.locator('.fl-source-table tbody tr').count();
  assert(sourceRows === 17, `Live Florida source catalogue contains ${sourceRows} rows instead of 17.`);
  const sourceTableText = await page.locator('.fl-source-table').innerText();
  assert(sourceTableText.includes('Centers for Medicare & Medicaid Services'), 'Federal source ownership is mislabeled in the live catalogue.');
  assert(sourceTableText.includes('Florida AHCA'), 'Florida AHCA source ownership is missing from the live catalogue.');
  const floridaScreenshot = path.join(artifacts, 'demo-fl-hydrated-sources.png');
  await page.screenshot({ path: floridaScreenshot, fullPage: true });

  assert(consoleErrors.length === 0 && responseErrors.length === 0, `Live browser errors: ${[...consoleErrors, ...responseErrors].join('; ')}`);
  const result = { passed: true, evidenceClass: isolatedRendered ? 'isolated-rendered' : 'headless-validated', url: page.url(), comparisonRows: 8, metrics: 5, floridaGoalCount: 6, floridaSourceRows: sourceRows, floridaEligibility: 3877393, floridaLeieAggregate: 9093, floridaObservedFinancialReviewUniverse: '$17.38M', floridaAutomationReadyFeeFiles: 35, comparisonLinkContrast, comparisonLinkStyle, landingScreenshot, screenshot, floridaOpportunityScreenshot, floridaScreenshot, consoleErrors, responseErrors };
  fs.writeFileSync(path.join(artifacts, 'live-release-verification.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
