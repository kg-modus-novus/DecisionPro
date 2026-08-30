const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const APP = path.join(REPO, 'wireframe V1', 'app');
const ARTIFACTS = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR || path.join(__dirname, 'evidence', 'page-guides');
const PLAYWRIGHT = path.join(
  process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp',
  'decisionpro-playwright-runtime',
  'node_modules',
  'playwright-core',
);
const { chromium } = require(PLAYWRIGHT);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const VITE = path.join(APP, 'node_modules', 'vite', 'bin', 'vite.js');
const PORT = 55800 + (process.pid % 500);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PRODUCT_STATE = String(process.env.DPRO_GUIDE_STATE || 'KY').toUpperCase() === 'FL' ? 'FL' : 'KY';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const status = await new Promise((resolve, reject) => {
        const request = http.get(BASE_URL, (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode));
        });
        request.on('error', reject);
        request.setTimeout(1000, () => request.destroy());
      });
      if (status >= 200 && status < 500) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('DecisionPro preview did not become ready.');
}

async function verifyGuide(page, pageName, expectedTitle, screenshotName, options = {}) {
  const guideButton = page.locator('.guide-page-btn');
  assert(await guideButton.count() === 1, `${pageName} does not expose one Guide button.`);
  assert(await guideButton.evaluate((element) => element.classList.contains('guide-needs-attention')), `${pageName} Guide does not glow before its walkthrough is seen.`);
  if (!options.alreadyOpen) await guideButton.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const title = await dialog.getByRole('heading').innerText();
  assert(title === expectedTitle, `${pageName} opened “${title}” instead of “${expectedTitle}”.`);
  await page.screenshot({ path: path.join(ARTIFACTS, screenshotName) });
  const progress = await dialog.locator('.walkthrough-progress').innerText();
  const total = Number(progress.match(/of\s+(\d+)/i)?.[1] || 0);
  assert(total > 0, `${pageName} guide did not report its step count.`);
  for (let stepIndex = 0; stepIndex < total; stepIndex += 1) {
    assert(await page.locator('.walkthrough-highlight').count() === 1, `${pageName} guide step ${stepIndex + 1} is not anchored to a visible page target.`);
    const geometry = await dialog.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    assert(
      geometry.left >= 0 && geometry.top >= 0
        && geometry.right <= geometry.viewportWidth && geometry.bottom <= geometry.viewportHeight,
      `${pageName} guide step ${stepIndex + 1} is clipped: ${JSON.stringify(geometry)}`,
    );
    const finish = dialog.getByRole('button', { name: 'Finish', exact: true });
    if (await finish.count()) {
      const continueNext = dialog.getByRole('button', { name: 'Continue with Next Page', exact: true });
      assert(await continueNext.count() === 1, `${pageName} final step is missing Continue with Next Page.`);
      await page.screenshot({ path: path.join(ARTIFACTS, screenshotName.replace('.png', '-final.png')) });
      if (options.continueToTitle) {
        await continueNext.click();
        await page.getByRole('dialog').getByRole('heading', { name: options.continueToTitle, exact: true }).waitFor();
      } else {
        await finish.click();
      }
    } else {
      await dialog.getByRole('button', { name: 'Next', exact: true }).click();
      await page.waitForTimeout(400);
    }
  }
  if (!options.continueToTitle) {
    await dialog.waitFor({ state: 'detached' });
    assert(!(await guideButton.evaluate((element) => element.classList.contains('guide-needs-attention'))), `${pageName} Guide still glows after the walkthrough was finished.`);
  }
  return {
    pageName,
    title,
    steps: total,
    continueButton: true,
    continuedTo: options.continueToTitle || null,
    allAnchored: true,
    allInViewport: true,
  };
}

async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const previewLog = fs.openSync(path.join(ARTIFACTS, 'vite-preview.log'), 'a');
  const preview = spawn(process.execPath, [VITE, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: APP,
    windowsHide: true,
    stdio: ['ignore', previewLog, previewLog],
  });
  let browser;
  const results = [];
  try {
    await waitForServer();
    browser = await chromium.launch({
      executablePath: CHROME,
      headless: !process.env.SCRIPTORIUM_UI_DESKTOP_NAME,
    });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?state=${PRODUCT_STATE}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /budget \/ fiscal analyst/i }).first().click();
    await page.getByRole('dialog').waitFor();
    const glowStyle = await page.locator('.guide-page-btn').evaluate((element) => {
      const style = getComputedStyle(element);
      return { animationName: style.animationName, animationDuration: style.animationDuration };
    });
    assert(glowStyle.animationName === 'guide-attention-glow', `Guide glow animation is not active: ${JSON.stringify(glowStyle)}`);
    assert(glowStyle.animationDuration === '3.4s', `Guide glow is not slow enough: ${JSON.stringify(glowStyle)}`);

    results.push(await verifyGuide(page, 'Legislator Home', 'Budget / Fiscal Analyst summary and priorities', 'guide-role-home.png', {
      alreadyOpen: true,
      continueToTitle: 'Operational Intelligence overview',
    }));
    results.push(await verifyGuide(page, 'Operational Intelligence', 'Operational Intelligence overview', 'guide-operational.png', {
      alreadyOpen: true,
      continueToTitle: 'Authoritative Sources overview',
    }));
    results.push(await verifyGuide(page, 'Authoritative Sources', 'Authoritative Sources overview', 'guide-sources.png', {
      alreadyOpen: true,
      continueToTitle: 'Evidence Rooms overview',
    }));
    results.push(await verifyGuide(page, 'Evidence Rooms', 'Evidence Rooms overview', 'guide-evidence-rooms.png', {
      alreadyOpen: true,
      continueToTitle: 'Consideration Blender overview',
    }));
    results.push(await verifyGuide(page, 'Consideration Blender', 'Consideration Blender overview', 'guide-blender.png', {
      alreadyOpen: true,
      continueToTitle: 'Legislative Analysis overview',
    }));
    results.push(await verifyGuide(page, 'Legislative Analysis', 'Legislative Analysis overview', 'guide-legislation.png', {
      alreadyOpen: true,
    }));

    await context.close();
    fs.writeFileSync(path.join(ARTIFACTS, 'page-guide-results.json'), JSON.stringify({
      evidenceClass: process.env.SCRIPTORIUM_UI_DESKTOP_NAME ? 'isolated-rendered' : 'headless-validated',
      productState: PRODUCT_STATE,
      baseUrl: BASE_URL,
      results,
    }, null, 2));
  } finally {
    await browser?.close().catch(() => {});
    preview.kill();
    fs.closeSync(previewLog);
  }
}

main().catch((error) => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS, 'page-guide-error.txt'), error.stack || String(error));
  process.exitCode = 1;
});
