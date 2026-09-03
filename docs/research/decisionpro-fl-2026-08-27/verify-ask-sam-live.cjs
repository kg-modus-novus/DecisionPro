const fs = require('fs');
const path = require('path');

const playwrightPath = path.join(
  process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp',
  'decisionpro-playwright-runtime',
  'node_modules',
  'playwright-core',
);
const { chromium } = require(playwrightPath);

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.DECISIONPRO_DEMO_URL || 'https://demo.decisionpro.io/';
const artifacts = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR
  || path.join(__dirname, 'evidence', 'ask-sam-live');
const isolatedRendered = Boolean(process.env.SCRIPTORIUM_UI_DESKTOP_NAME);
const expectLive = process.env.EXPECT_ASK_SAM_LIVE !== 'false';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: !isolatedRendered, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const apiRequests = [];
  const apiResponses = [];
  const failedRequests = [];

  page.on('request', (request) => {
    if (request.url().includes('/api/ask-sam')) apiRequests.push(request.url());
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/ask-sam')) {
      apiResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/ask-sam')) {
      failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
    }
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: /Open Kentucky/i }).first().click();
  await page.locator('.role-tile-select').first().click();
  const skipGuide = page.getByRole('button', { name: /skip all/i }).first();
  if (await skipGuide.count()) await skipGuide.click();
  const input = page.locator('#ask-sam-input');
  await input.waitFor({ state: 'visible', timeout: 30000 });

  await input.fill('Confirm the DecisionPro assistant API is online in one sentence.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.ask-sam-thinking-overlay').waitFor({ state: 'detached', timeout: 90000 });

  const reply = await page.locator('.ask-sam-msg.sam').last().innerText();
  const unreachableFallback = reply.includes('API unreachable');
  const usedPublicApi = apiRequests.some((url) => url.startsWith('https://decisionpro-ask-sam.vercel.app/'));

  if (expectLive) {
    assert(!unreachableFallback, `Ask Sam fell back as unreachable: ${reply}`);
    assert(usedPublicApi, `Ask Sam did not call the public API: ${apiRequests.join(', ')}`);
    assert(apiResponses.some(({ url, status }) => (
      url === 'https://decisionpro-ask-sam.vercel.app/api/ask-sam' && status === 200
    )), `No successful public Ask Sam response: ${JSON.stringify(apiResponses)}`);
  } else {
    assert(unreachableFallback, 'The current deployment no longer reproduces the expected pre-fix fallback.');
    assert(!usedPublicApi, 'The current deployment unexpectedly called the remediated public API path.');
  }

  const screenshot = path.join(artifacts, 'ask-sam-live.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  const result = {
    passed: true,
    evidenceClass: isolatedRendered ? 'isolated-rendered' : 'headless-validated',
    expectedLive: expectLive,
    url: page.url(),
    unreachableFallback,
    usedPublicApi,
    apiRequests,
    apiResponses,
    failedRequests,
    reply,
    screenshot,
  };
  fs.writeFileSync(
    path.join(artifacts, 'ask-sam-live-verification.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
