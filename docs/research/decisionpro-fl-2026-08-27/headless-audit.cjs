const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const ROOT = __dirname;
const EVIDENCE = path.join(ROOT, 'evidence');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const REVIEW_UA = 'DecisionPro-Research/1.0 (+https://decisionpro.io/research)';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function snapshotSemantics(page) {
  return page.evaluate(() => {
    const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const visible = (el) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
    };
    const collect = (selector, limit = 120) => Array.from(document.querySelectorAll(selector))
      .filter(visible)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        text: cleanText(el.innerText || el.textContent).slice(0, 240),
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        href: el.href || null,
      }))
      .filter((item) => item.text || item.ariaLabel || item.title)
      .slice(0, limit);
    return {
      title: document.title,
      url: location.href,
      headings: collect('h1,h2,h3,h4', 80),
      controls: collect('button,select,input,[role="button"],[role="tab"],[role="combobox"]', 160),
      links: collect('a[href]', 160),
      iframes: Array.from(document.querySelectorAll('iframe')).map((frame) => frame.src).filter(Boolean),
      canvasCount: document.querySelectorAll('canvas').length,
      svgCount: document.querySelectorAll('svg').length,
      bodyText: cleanText(document.body.innerText).slice(0, 18000),
    };
  });
}

async function waitForSettledPage(page, timeout = 15000) {
  await page.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(timeout);
}

async function auditFlorida(context) {
  const page = await context.newPage();
  await page.goto('https://ahca.myflorida.com/medicaid/agency-dashboards.html', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await waitForSettledPage(page, 4000);
  const landing = await snapshotSemantics(page);
  const dashboardLinks = landing.links.filter((link) => /dashboard|tableau|bi\.ahca/i.test(`${link.text} ${link.href}`));

  const selected = dashboardLinks.filter((link) => (
    /health plan transparency|financial|prior authorization|compliance/i.test(link.text)
  )).slice(0, 5);

  const dashboards = [];
  for (const [index, link] of selected.entries()) {
    const detail = await context.newPage();
    try {
      await detail.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForSettledPage(detail, 12000);
      const semantics = await snapshotSemantics(detail);
      const frameSemantics = [];
      for (const frame of detail.frames().slice(1)) {
        try {
          frameSemantics.push({
            url: frame.url(),
            headings: await frame.locator('h1,h2,h3,h4').allInnerTexts(),
            controls: await frame.locator('button,select,input,[role="button"],[role="tab"],[role="combobox"]').evaluateAll((els) => els.slice(0, 160).map((el) => ({
              tag: el.tagName.toLowerCase(),
              role: el.getAttribute('role'),
              text: String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240),
              ariaLabel: el.getAttribute('aria-label'),
              title: el.getAttribute('title'),
            }))),
            bodyText: clean(await frame.locator('body').innerText()).slice(0, 18000),
          });
        } catch (error) {
          frameSemantics.push({ url: frame.url(), error: error.message });
        }
      }
      const slug = `fl-${index + 1}-${link.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}`;
      await detail.screenshot({ path: path.join(EVIDENCE, `${slug}.png`), fullPage: true });
      dashboards.push({ link, semantics, frameSemantics, screenshot: `evidence/${slug}.png` });
    } catch (error) {
      dashboards.push({ link, error: error.message });
    } finally {
      await detail.close();
    }
  }
  await page.close();
  return { landing, dashboardLinks, dashboards };
}

async function dismissGuide(page) {
  const skip = page.getByRole('button', { name: /skip all/i });
  if (await skip.count()) await skip.first().click().catch(() => {});
}

async function auditDecisionPro(context) {
  const page = await context.newPage();
  await page.goto('https://demo.decisionpro.io', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForSettledPage(page, 5000);
  const roleSelector = await snapshotSemantics(page);

  await page.getByRole('button', { name: /budget \/ fiscal analyst/i }).first().click();
  await page.waitForTimeout(1800);
  await dismissGuide(page);
  const roleHome = await snapshotSemantics(page);
  await page.screenshot({ path: path.join(EVIDENCE, 'decisionpro-ky-budget-home.png'), fullPage: true });

  const surfaces = [];
  for (const target of ['Authoritative sources', 'Evidence Rooms', 'Legislative Analysis']) {
    const control = page.getByRole('button', { name: new RegExp(`^${target}$`, 'i') });
    if (!await control.count()) {
      surfaces.push({ target, error: 'control not found' });
      continue;
    }
    await control.first().click();
    await page.waitForTimeout(1200);
    const semantics = await snapshotSemantics(page);
    const slug = `decisionpro-ky-${target.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    await page.screenshot({ path: path.join(EVIDENCE, `${slug}.png`), fullPage: true });
    surfaces.push({ target, semantics, screenshot: `evidence/${slug}.png` });
  }

  await page.close();
  return { roleSelector, roleHome, surfaces };
}

(async () => {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const floridaContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      userAgent: REVIEW_UA,
      locale: 'en-US',
    });
    const decisionProContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: 'en-US',
    });
    const result = {
      capturedAt: new Date().toISOString(),
      evidenceClass: 'headless-validated',
      browser: await browser.version(),
      viewport: '1440x1000',
      florida: await auditFlorida(floridaContext),
      decisionProKentucky: await auditDecisionPro(decisionProContext),
    };
    fs.writeFileSync(path.join(EVIDENCE, 'headless-audit.json'), `${JSON.stringify(result, null, 2)}\n`);
    await floridaContext.close();
    await decisionProContext.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
