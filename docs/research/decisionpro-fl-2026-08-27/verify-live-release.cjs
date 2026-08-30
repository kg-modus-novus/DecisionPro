const fs = require('fs');
const path = require('path');

const playwrightPath = path.join(process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp', 'decisionpro-playwright-runtime', 'node_modules', 'playwright-core');
const { chromium } = require(playwrightPath);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.DECISIONPRO_DEMO_URL || 'https://demo.decisionpro.io/';
const artifacts = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR || path.join(__dirname, 'evidence', 'live-release');

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
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
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
  assert(consoleErrors.length === 0 && responseErrors.length === 0, `Live browser errors: ${[...consoleErrors, ...responseErrors].join('; ')}`);
  const screenshot = path.join(artifacts, 'demo-fl-comparison.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  const result = { passed: true, evidenceClass: 'headless-validated', url: page.url(), comparisonRows: 8, metrics: 5, comparisonLinkContrast, comparisonLinkStyle, landingScreenshot, screenshot, consoleErrors, responseErrors };
  fs.writeFileSync(path.join(artifacts, 'live-release-verification.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
