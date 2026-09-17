/** Crop featured marketing shots to the main product canvas at 2x. */
const fs = require('fs');
const path = require('path');
const screens = path.resolve(__dirname, '..', 'assets', 'screens');
const playwrightPath = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'decisionpro-playwright-runtime', 'node_modules', 'playwright-core');
const { chromium } = require(playwrightPath);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function ready(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}
async function tidy(page) {
  const skip = page.getByRole('button', { name: /^Skip All$/i });
  if (await skip.count()) await skip.click({ timeout: 2000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('.walkthrough-layer').forEach((el) => {
      el.style.setProperty('display', 'none', 'important');
    });
  });
}
async function snapEl(page, selector, name, maxCssHeight = 820) {
  await tidy(page);
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const box = await el.boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  const clip = {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.min(box.width, 1680 - Math.max(0, box.x)),
    height: Math.min(box.height, maxCssHeight, 1050 - Math.max(0, box.y)),
  };
  const dest = path.join(screens, name);
  await page.screenshot({ path: dest, type: 'png', animations: 'disabled', clip });
  const buf = fs.readFileSync(dest);
  process.stdout.write(`${name} ${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)} clip=${Math.round(clip.width)}x${Math.round(clip.height)}\n`);
}
async function signIn(page) {
  const auto = page.getByRole('button', { name: /^AutoLogin$/i });
  if (await auto.count()) {
    await auto.click();
    await ready(page);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });

  await page.goto('http://localhost:5040/?state=KY', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await signIn(page);
  await page.getByRole('button', { name: /^Legislator/ }).first().click();
  await ready(page);
  await tidy(page);
  await page.getByRole('button', { name: /Operational intelligence/i }).click();
  await page.locator('[data-walkthrough-target="operational-briefing"]').waitFor({ timeout: 20000 });
  await ready(page);
  await snapEl(page, 'main.main, .main', 'ky-operational-briefing.png');

  await page.getByRole('button', { name: /Funding & Resilience/i }).first().click();
  await page.locator('.fr-relationship-graph').waitFor({ timeout: 20000 });
  await ready(page);
  await snapEl(page, '.fr-relationship-graph', 'ofr-ownership-graph.png');

  await page.getByRole('button', { name: /Accessible list/i }).click();
  await page.locator('.fr-graph-edge').first().waitFor();
  await snapEl(page, '.fr-graph, .fr-network-shell', 'ky-relationship-evidence.png');
  await page.locator('.fr-graph-edge').first().click();
  await page.locator('.fr-playbook').waitFor();
  await snapEl(page, '.fr-object-page, .fr-content', 'ofr-ownership-playbook.png');

  await page.goto('http://localhost:5040/?state=FL', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await signIn(page);
  const legislator = page.getByRole('button', { name: /^Legislator/ });
  if (await legislator.count()) {
    await legislator.first().click();
    await ready(page);
  }
  await tidy(page);
  await page.getByRole('button', { name: /Facilities & Access/i }).first().click();
  await ready(page);
  await snapEl(page, 'main.main, .main, .fl-workspace', 'fl-evidence-room.png');
  await page.getByRole('button', { name: /Operational intelligence/i }).click();
  await page.locator('[data-walkthrough-target="operational-briefing"]').waitFor({ timeout: 20000 });
  await ready(page);
  await snapEl(page, 'main.main, .main', 'fl-action-tracker.png');

  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
