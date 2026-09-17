/**
 * Headless recapture of marketing product screens from the local DecisionPro app.
 * Writes 2x PNGs into website/assets/screens/. Evidence class: headless-validated.
 */
const fs = require('fs');
const path = require('path');

const screens = path.resolve(__dirname, '..', 'assets', 'screens');
const playwrightPath = path.join(process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp', 'decisionpro-playwright-runtime', 'node_modules', 'playwright-core');
const { chromium } = require(playwrightPath);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const appUrl = process.env.DECISIONPRO_APP_URL || 'http://localhost:5040';

async function ready(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(400);
}

async function tidy(page) {
  const skip = page.getByRole('button', { name: /^Skip All$/i });
  if (await skip.count()) {
    await skip.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => {
    const hide = [
      '.ask-sam-dock',
      '[data-walkthrough-target="ask-sam-panel"]',
      '.walkthrough-layer',
      '.walkthrough-overlay',
      '.show-me-overlay',
    ];
    for (const sel of hide) {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty('display', 'none', 'important');
      });
    }
  });
}

async function snap(page, name) {
  await tidy(page);
  await page.waitForTimeout(200);
  const dest = path.join(screens, name);
  await page.screenshot({ path: dest, type: 'png', animations: 'disabled' });
  const buf = fs.readFileSync(dest);
  process.stdout.write(`${name} ${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)} ${(buf.length / 1024).toFixed(0)}KB\n`);
}

async function signIn(page) {
  const auto = page.getByRole('button', { name: /^AutoLogin$/i });
  if (await auto.count()) {
    await auto.click();
    await page.waitForTimeout(800);
    await ready(page);
  }
}

async function enterRole(page, state) {
  await page.goto(`${appUrl}/?state=${state}`, { waitUntil: 'domcontentloaded' });
  await ready(page);
  await signIn(page);
  await page.getByRole('button', { name: /^Legislator/ }).first().click();
  await page.getByRole('heading', { name: /home/i }).first().waitFor({ timeout: 15000 });
  await ready(page);
  await tidy(page);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({
    viewport: { width: 1680, height: 1050 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });

  await page.goto(`${appUrl}/`, { waitUntil: 'domcontentloaded' });
  await ready(page);
  await signIn(page);
  await snap(page, 'state-products.png');

  await page.goto(`${appUrl}/?compare=FL`, { waitUntil: 'domcontentloaded' });
  await ready(page);
  await signIn(page);
  await snap(page, 'fl-comparison.png');

  await enterRole(page, 'KY');
  await page.getByRole('button', { name: /Operational intelligence/i }).click();
  await page.locator('[data-walkthrough-target="operational-briefing"]').waitFor({ timeout: 20000 });
  await ready(page);
  await snap(page, 'ky-operational-briefing.png');

  await page.getByRole('button', { name: /Funding & Resilience/i }).first().click();
  await page.getByRole('heading', { name: /Funding & Resilience/i }).first().waitFor({ timeout: 20000 });
  await ready(page);
  await tidy(page);
  await page.locator('.fr-relationship-graph').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await snap(page, 'ofr-ownership-graph.png');

  await page.getByRole('button', { name: /Accessible list/i }).click();
  await page.locator('.fr-graph-edge').first().waitFor({ timeout: 10000 });
  await snap(page, 'ky-relationship-evidence.png');
  await page.locator('.fr-graph-edge').first().click();
  await page.locator('.fr-playbook').waitFor({ timeout: 10000 });
  await page.locator('.fr-playbook').scrollIntoViewIfNeeded();
  await ready(page);
  await snap(page, 'ofr-ownership-playbook.png');

  await enterRole(page, 'FL');
  await page.getByRole('button', { name: /Facilities & Access/i }).first().click();
  await ready(page);
  await snap(page, 'fl-evidence-room.png');

  await page.getByRole('button', { name: /Operational intelligence/i }).click();
  await page.locator('[data-walkthrough-target="operational-briefing"], [data-walkthrough-target="operational-current-page"]').first().waitFor({ timeout: 20000 });
  await ready(page);
  await snap(page, 'fl-action-tracker.png');

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
