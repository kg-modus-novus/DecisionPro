const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..');
const playwrightPath = path.join(process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp', 'decisionpro-playwright-runtime', 'node_modules', 'playwright-core');
const { chromium } = require(playwrightPath);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifacts = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR || path.join(root, 'docs', 'evidence', 'website-redesign');
const targetUrl = process.env.DECISIONPRO_MARKETING_URL;

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

function assert(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  let pageUrl = targetUrl;
  if (!pageUrl) {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    pageUrl = `http://127.0.0.1:${server.address().port}`;
  }
  const browser = await chromium.launch({ headless: !process.env.SCRIPTORIUM_UI_DESKTOP_NAME, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource: the server responded with a status of 404')) errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  assert((await page.title()) === 'DecisionPro — Multi-State Public Program Decision Intelligence', 'Multi-state title missing.');
  assert(await page.getByRole('heading', { name: /turned into accountable action/i }).count() === 1, 'Redesigned hero missing.');

  // Operational Intelligence: 22 verbatim headline cards (11 KY + 11 FL), KY shown by default.
  assert(await page.locator('.headline-card').count() === 22, 'Expected 22 briefing headline cards.');
  assert(await page.locator('[data-state-list="KY"] .headline-card:visible').count() === 11, 'Kentucky briefing not visible by default.');
  assert(await page.locator('[data-state-list="FL"] .headline-card:visible').count() === 0, 'Florida briefing should start hidden.');
  await page.locator('[data-state-btn="FL"]').click();
  assert(await page.locator('[data-state-list="FL"] .headline-card:visible').count() === 11, 'Florida briefing toggle failed.');
  assert(await page.locator('[data-state-list="KY"] .headline-card:visible').count() === 0, 'Kentucky briefing should hide after toggle.');

  // Funding & Resilience highlight and state products.
  assert(await page.getByRole('heading', { name: /how resilient is it/i }).count() === 1, 'Funding & Resilience section missing.');
  assert(await page.locator('.signal-grid article').count() === 10, 'Expected 10 Funding & Resilience signal types.');
  assert(await page.locator('.state-card').count() === 2, 'Kentucky and Florida state proof cards are missing.');
  assert(await page.locator('.compare-table > div').count() === 7, 'Capability comparison is incomplete.');
  assert(await page.locator('.proof-grid img').count() === 4, 'Product screenshots are incomplete.');

  const images = page.locator('img');
  for (let index = 0; index < await images.count(); index += 1) {
    await images.nth(index).scrollIntoViewIfNeeded();
    await images.nth(index).evaluate((image) => image.complete || new Promise((resolve) => image.addEventListener('load', resolve, { once: true })));
  }
  assert(await images.evaluateAll((items) => items.every((image) => image.complete && image.naturalWidth > 0)), 'A marketing screenshot failed to load.');

  await page.getByRole('link', { name: 'Read today’s briefing' }).click();
  assert((await page.locator('#headlines').boundingBox()).y < 1050, 'Briefing navigation did not move to the headlines section.');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Desktop page has unexpected horizontal overflow.');
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);

  const screenshot = path.join(artifacts, 'decisionpro-website-redesign.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile page has unexpected horizontal overflow.');
  const mobileScreenshot = path.join(artifacts, 'decisionpro-website-redesign-mobile.png');
  await page.screenshot({ path: mobileScreenshot, fullPage: true });
  const result = { passed: true, evidenceClass: process.env.SCRIPTORIUM_UI_DESKTOP_NAME ? 'isolated-rendered' : 'headless-validated', screenshot, mobileScreenshot, viewport: '1440x1000 and 390x844', title: await page.title(), headlineCards: 22, signalTypes: 10, stateProducts: 2, comparisonCapabilities: 6, proofScreenshots: 4, errors };
  fs.writeFileSync(path.join(artifacts, 'marketing-verification.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  await browser.close();
  if (server.listening) server.close();
})().catch((error) => { fs.mkdirSync(artifacts, { recursive: true }); fs.writeFileSync(path.join(artifacts, 'marketing-error.txt'), `${error.stack || error}\n`); if (server.listening) server.close(); console.error(error); process.exit(1); });
