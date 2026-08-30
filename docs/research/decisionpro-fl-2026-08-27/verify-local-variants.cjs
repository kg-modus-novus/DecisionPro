const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const APP = path.join(REPO, 'wireframe V1', 'app');
const EVIDENCE = path.join(__dirname, 'evidence');
const ARTIFACTS = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR || EVIDENCE;
const PLAYWRIGHT = path.join(
  process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp',
  'decisionpro-playwright-runtime',
  'node_modules',
  'playwright-core',
);
const { chromium } = require(PLAYWRIGHT);

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const VITE = path.join(APP, 'node_modules', 'vite', 'bin', 'vite.js');
// Keep the verifier inside DecisionPro's reserved 5040-5049 block. Windows may
// dynamically exclude part of that block; 5042 remains available on this host.
// Keep the isolated verifier off the product's reserved 5040–5049 service block;
// Windows/Docker may reserve or proxy individual ports in that range.
const PREVIEW_PORT = Number(process.env.DECISIONPRO_VERIFY_PORT || (55000 + (process.pid % 800)));
const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const isolated = Boolean(process.env.SCRIPTORIUM_UI_DESKTOP_NAME);

function request(url) {
  return new Promise((resolve, reject) => {
    const call = http.get(url, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    call.setTimeout(1500, () => call.destroy(new Error('readiness timeout')));
    call.once('error', reject);
  });
}

async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = await request(BASE_URL);
      if (status >= 200 && status < 500) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite preview did not become ready at ${BASE_URL}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function textIncludes(page, text) {
  return (await page.locator('body').innerText()).includes(text);
}

async function auditVisibleLinkContrast(page) {
  return page.evaluate(() => {
    function rgb(value) {
      const values = String(value).match(/[\d.]+/g)?.map(Number) || [];
      return values.length >= 3 ? values.slice(0, 3) : [8, 21, 37];
    }
    function luminance([r, g, b]) {
      const channels = [r, g, b].map((value) => {
        const normalized = value / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
    }
    function contrast(foreground, background) {
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    }
    function nearestBackground(element) {
      let current = element;
      while (current) {
        const value = getComputedStyle(current).backgroundColor;
        const alpha = Number(String(value).match(/[\d.]+/g)?.[3] ?? 1);
        if (value !== 'transparent' && alpha >= 0.98) return rgb(value);
        current = current.parentElement;
      }
      return [8, 21, 37];
    }
    return Array.from(document.querySelectorAll('a[href]'))
      .filter((link) => {
        const box = link.getBoundingClientRect();
        const style = getComputedStyle(link);
        return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((link) => {
        const style = getComputedStyle(link);
        const foreground = rgb(style.color);
        const background = nearestBackground(link);
        return {
          text: String(link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
          color: style.color,
          background,
          contrast: Number(contrast(foreground, background).toFixed(2)),
          decoration: style.textDecorationLine,
        };
      });
  });
}

async function auditVisibleButtonContrast(page) {
  return page.evaluate(() => {
    function rgba(value) {
      const values = String(value).match(/[\d.]+/g)?.map(Number) || [];
      if (values.length < 3) return null;
      return [values[0], values[1], values[2], values[3] ?? 1];
    }
    function composite(foreground, background) {
      const alpha = Math.max(0, Math.min(1, foreground[3] ?? 1));
      return [
        (foreground[0] * alpha) + (background[0] * (1 - alpha)),
        (foreground[1] * alpha) + (background[1] * (1 - alpha)),
        (foreground[2] * alpha) + (background[2] * (1 - alpha)),
      ];
    }
    function luminance([r, g, b]) {
      const channels = [r, g, b].map((value) => {
        const normalized = value / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
    }
    function contrast(foreground, background) {
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    }
    function nearestOpaqueBackground(element) {
      let current = element;
      while (current) {
        const parsed = rgba(getComputedStyle(current).backgroundColor);
        if (parsed && parsed[3] >= 0.98) return parsed.slice(0, 3);
        current = current.parentElement;
      }
      return [8, 21, 37];
    }
    function buttonBackgrounds(button, style) {
      const parent = nearestOpaqueBackground(button.parentElement);
      const color = rgba(style.backgroundColor) || [0, 0, 0, 0];
      const base = composite(color, parent);
      const stops = Array.from(String(style.backgroundImage).matchAll(/rgba?\([^)]*\)/g))
        .map((match) => rgba(match[0]))
        .filter(Boolean);
      return stops.length ? stops.map((stop) => composite(stop, base)) : [base];
    }
    return Array.from(document.querySelectorAll('button'))
      .filter((button) => {
        const box = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((button) => {
        const style = getComputedStyle(button);
        const foreground = rgba(style.color)?.slice(0, 3) || [232, 238, 246];
        const backgrounds = buttonBackgrounds(button, style);
        const contrasts = backgrounds.map((background) => contrast(foreground, background));
        return {
          label: (button.getAttribute('aria-label') || button.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 100),
          disabled: button.disabled,
          color: style.color,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage === 'none' ? null : style.backgroundImage,
          contrast: Number(Math.min(...contrasts).toFixed(2)),
        };
      });
  });
}

function assertButtonContrast(buttons, surface) {
  const enabled = buttons.filter((button) => !button.disabled);
  assert(enabled.length > 0, `${surface} has no visible enabled buttons to audit.`);
  const failures = enabled.filter((button) => button.contrast < 4.5);
  assert(failures.length === 0, `${surface} button contrast failed: ${JSON.stringify(failures)}`);
}

async function selectBudgetRole(page) {
  await page.getByRole('button', { name: /budget \/ fiscal analyst/i }).first().click();
  const skip = page.getByRole('button', { name: /skip all/i });
  if (await skip.count()) await skip.first().click().catch(() => {});
}

async function verifyLanding(context, report) {
  const page = await context.newPage();
  const { consoleErrors, responseErrors } = trackPageErrors(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  assert(await textIncludes(page, 'Choose a DecisionPro state product'), 'Neutral state landing was not rendered.');
  assert((await page.title()).startsWith('DecisionPro —'), 'Neutral browser title retained a state label.');
  assert(await page.getByRole('link', { name: /DecisionPro Kentucky/i }).count(), 'Kentucky product tile is missing.');
  assert(await page.getByRole('link', { name: /DecisionPro Florida/i }).count(), 'Florida product tile is missing.');
  assert(new URL(page.url()).searchParams.get('state') === null, 'Bare landing unexpectedly selected a state.');

  const buttonContrast = await auditVisibleButtonContrast(page);
  assertButtonContrast(buttonContrast, 'Neutral landing');

  const zoomField = page.getByRole('combobox', { name: 'Zoom percentage' });
  const zoomSlider = page.getByRole('slider', { name: 'Zoom slider' });
  const decrease = page.getByRole('button', { name: 'Decrease zoom' });
  const increase = page.getByRole('button', { name: 'Increase zoom' });
  assert(await zoomField.count(), 'Editable zoom percentage field is missing.');
  assert(await zoomSlider.count(), 'Zoom slider is missing.');
  await page.getByRole('button', { name: 'Choose zoom percentage' }).click();
  const zoomOptions = await page.getByRole('option').evaluateAll((options) => options.map((option) => Number(String(option.textContent).replace('%', '').trim())));
  assert(zoomOptions.length === 19 && zoomOptions[0] === 20 && zoomOptions.at(-1) === 200, 'Zoom dropdown does not cover 20%-200% in 10% increments.');
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-zoom-dropdown.png'), fullPage: true });
  await page.getByRole('option', { name: '150%' }).click();
  assert(await zoomField.inputValue() === '150', 'Zoom dropdown selection was not applied.');

  await zoomField.fill('135');
  await zoomField.press('Enter');
  assert(await zoomField.inputValue() === '135', 'Typed 135% zoom was not accepted.');
  assert(await page.evaluate(() => localStorage.getItem('decisionpro.ui.zoom.percent.v1')) === '135', 'Typed zoom was not persisted.');
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.getByRole('combobox', { name: 'Zoom percentage' }).inputValue() === '135', 'Zoom did not restore after reload.');

  await page.getByRole('button', { name: 'Increase zoom' }).click();
  assert(await page.getByRole('combobox', { name: 'Zoom percentage' }).inputValue() === '145', 'Increase zoom did not add 10%.');
  await page.getByRole('button', { name: 'Decrease zoom' }).click();
  assert(await page.getByRole('combobox', { name: 'Zoom percentage' }).inputValue() === '135', 'Decrease zoom did not subtract 10%.');

  await page.getByRole('combobox', { name: 'Zoom percentage' }).fill('20');
  await page.getByRole('combobox', { name: 'Zoom percentage' }).press('Enter');
  assert(await page.getByRole('button', { name: 'Decrease zoom' }).isDisabled(), 'Decrease zoom is not bounded at 20%.');
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-zoom-20.png'), fullPage: true });

  await page.getByRole('combobox', { name: 'Zoom percentage' }).fill('200');
  await page.getByRole('combobox', { name: 'Zoom percentage' }).press('Enter');
  assert(await page.getByRole('button', { name: 'Increase zoom' }).isDisabled(), 'Increase zoom is not bounded at 200%.');
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-zoom-200.png'), fullPage: true });

  await page.getByRole('combobox', { name: 'Zoom percentage' }).fill('100');
  await page.getByRole('combobox', { name: 'Zoom percentage' }).press('Enter');
  assert(await page.evaluate(() => window.scrollX) === 0, 'Returning to 100% left the outer page horizontally scrolled.');
  await zoomSlider.focus();
  await zoomSlider.press('ArrowRight');
  await zoomSlider.press('ArrowRight');
  assert(await page.getByRole('combobox', { name: 'Zoom percentage' }).inputValue() === '120', 'Zoom slider did not update the percentage field.');
  await page.getByRole('combobox', { name: 'Zoom percentage' }).fill('100');
  await page.getByRole('combobox', { name: 'Zoom percentage' }).press('Enter');
  assert(await page.evaluate(() => window.scrollX) === 0, 'Final 100% zoom left the outer page horizontally scrolled.');

  const screenshot = path.join(ARTIFACTS, 'local-state-landing.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  const comparisonLink = page.getByRole('link', { name: /Explore the comparison/i });
  assert(await comparisonLink.count() === 1, 'Florida marketing comparison tile is missing from the landing page.');
  const landingLinks = await auditVisibleLinkContrast(page);
  const comparisonLinkContrast = landingLinks.find((link) => link.text.includes('Explore the comparison'));
  assert(comparisonLinkContrast?.contrast >= 4.5, `Florida comparison CTA contrast failed: ${JSON.stringify(comparisonLinkContrast)}`);
  await comparisonLink.click();
  await page.getByRole('heading', { name: /DecisionPro makes the evidence operational/i }).waitFor();
  assert(new URL(page.url()).searchParams.get('compare') === 'FL', 'Comparison page did not retain its neutral comparison URL.');
  assert((await page.title()) === 'DecisionPro Florida — Public Dashboard Comparison', 'Comparison page title is not marketing-specific.');
  assert(await page.locator('.comparison-table tbody tr').count() === 8, 'Comparison matrix does not contain all eight capability rows.');
  assert(await page.locator('.comparison-stats article').count() === 5, 'Comparison hero does not expose five evidence-backed coverage metrics.');
  assert(await textIncludes(page, 'Florida AHCA remains the source of record'), 'Comparison page is missing its source-ownership boundary.');
  const comparisonButtons = await auditVisibleButtonContrast(page);
  assertButtonContrast(comparisonButtons, 'Florida comparison page');
  const comparisonScreenshot = path.join(ARTIFACTS, 'local-fl-marketing-comparison.png');
  await page.screenshot({ path: comparisonScreenshot, fullPage: true });
  await page.getByRole('button', { name: /DecisionPro home/i }).click();
  assert(await textIncludes(page, 'Choose a DecisionPro state product'), 'Comparison Back control did not return to the neutral landing page.');
  assert(new URL(page.url()).searchParams.get('compare') === null, 'Comparison Back control did not clean the comparison URL.');
  report.landing = { url: page.url(), screenshot, comparisonScreenshot, buttonContrast, comparisonButtons, consoleErrors, responseErrors };
  await page.close();
}

function trackPageErrors(page) {
  const consoleErrors = [];
  const responseErrors = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const value = message.text();
    if (!value.startsWith('Failed to load resource: the server responded with a status of 404')) {
      consoleErrors.push(value);
    }
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    if (!url.endsWith('/favicon.ico')) responseErrors.push(`${response.status()} ${url}`);
  });
  return { consoleErrors, responseErrors };
}

async function verifyKentucky(context, report) {
  const page = await context.newPage();
  const { consoleErrors, responseErrors } = trackPageErrors(page);

  await page.goto(`${BASE_URL}/?state=KY`, { waitUntil: 'networkidle' });
  assert(await textIncludes(page, 'DecisionPro Kentucky'), 'Kentucky brand was not rendered.');
  assert((await page.title()).startsWith('DecisionPro Kentucky —'), 'Kentucky browser title is not state-specific.');
  assert(new URL(page.url()).searchParams.get('state') === 'KY', 'Kentucky URL identity was not retained.');
  const selectorButtonContrast = await auditVisibleButtonContrast(page);
  assertButtonContrast(selectorButtonContrast, 'Kentucky role selector');
  await selectBudgetRole(page);
  await page.getByRole('button', { name: /^Operational intelligence$/i }).click();
  await page.getByRole('heading', { name: 'Operational intelligence' }).waitFor();

  const goalTiles = page.locator('.ops-goal-tile');
  assert(await goalTiles.count() === 6, 'Kentucky operational workbench does not expose six goal categories.');
  assert(await page.getByRole('tab', { name: 'Goals', exact: true }).getAttribute('aria-selected') === 'true', 'Goals is not the default operational page.');
  assert(await page.getByRole('tab', { name: 'Evidence & Data', exact: true }).count(), 'Evidence & Data tab is missing.');
  assert(await page.getByRole('tab', { name: 'Data Sources', exact: true }).count(), 'Data Sources tab is missing.');
  const tabPresentation = await page.locator('.ops-page-tabs button').evaluateAll((buttons) => buttons.map((button) => {
    const style = getComputedStyle(button);
    return {
      borderTopWidth: Number.parseFloat(style.borderTopWidth),
      borderRadius: Number.parseFloat(style.borderTopLeftRadius),
      background: style.backgroundColor,
      selected: button.getAttribute('aria-selected') === 'true',
    };
  }));
  const selectedTab = tabPresentation.find((tab) => tab.selected);
  const unselectedTab = tabPresentation.find((tab) => !tab.selected);
  assert(
    tabPresentation.every((tab) => tab.borderTopWidth >= 0.5 && tab.borderRadius >= 3 && tab.background !== 'rgba(0, 0, 0, 0)')
      && selectedTab?.background !== unselectedTab?.background,
    `Operational navigation is not visually represented as tabs: ${JSON.stringify(tabPresentation)}`,
  );
  assert(await textIncludes(page, 'If you want to'), 'Goal intent copy is missing.');
  assert(await textIncludes(page, 'Click here to find recoverable, avoidable'), 'Goal invitation copy is missing.');
  assert(!(await page.locator('[data-ops-item-kind]').count()), 'Goal index exposes detail cards before a goal is selected.');
  await page.locator('.content-column').evaluate((element) => { element.scrollTop = 0; });
  const goalsScreenshot = path.join(ARTIFACTS, 'local-ky-operational-goals.png');
  await page.screenshot({ path: goalsScreenshot });
  const pageHeaderBack = page.locator('.page-title-back-col .content-back-btn');
  await page.getByRole('button', { name: /Optimize Spending/i }).click();
  assert(await page.getByRole('heading', { name: 'Optimize Spending', exact: true }).count(), 'Optimize Spending did not open for page-header Back verification.');
  assert(await page.locator('.glossary-term-link').count() >= 8, 'Optimize Spending does not expose enough inline glossary help for a new user.');
  const modeledBenefitTerm = page.locator('.glossary-term-link').filter({ hasText: /^modeled absolute benefit$/i }).first();
  assert(await modeledBenefitTerm.count(), 'Modeled benefit is not linked to the glossary.');
  await modeledBenefitTerm.click();
  const glossaryDialog = page.getByRole('dialog', { name: 'Terms legislators may want defined', exact: true });
  await glossaryDialog.waitFor();
  assert((await glossaryDialog.innerText()).includes('Modeled benefit'), 'Inline modeled-benefit help did not open the correct glossary entry.');
  await glossaryDialog.getByRole('button', { name: 'Close', exact: true }).click();
  assert(await page.getByRole('heading', { name: 'Optimize Spending', exact: true }).count(), 'Closing inline glossary help navigated away from the goal screen.');
  const nestedInteractive = await page.evaluate(() => document.querySelectorAll('button button, a button, button a').length);
  assert(nestedInteractive === 0, `Operational goal page contains ${nestedInteractive} nested interactive controls.`);
  await pageHeaderBack.click();
  assert(await goalTiles.count() === 6, 'Page-header Back did not return from a goal detail to the Operational Intelligence Goals screen.');
  assert(await page.getByRole('heading', { name: 'Operational intelligence', exact: true }).count(), 'Page-header Back incorrectly exited Operational Intelligence from a goal detail.');

  const goalCases = [
    ['Identify Quality Gaps', 'Review low-rated nursing facilities with local capacity context'],
    ['Contract Accountability', 'Target encounter-data remediation before relying on downstream measures'],
    ['Protect Program Integrity', 'Verify exclusion-screening candidates without fuzzy-match harm'],
    ['Trend & Budget Planning', 'Build a reconciled fiscal and service-planning baseline'],
  ];
  for (const [goalLabel, caseTitle] of goalCases) {
    await page.getByRole('button', { name: new RegExp(goalLabel, 'i') }).click();
    assert(await page.getByRole('heading', { name: goalLabel, exact: true }).count(), `${goalLabel} did not open.`);
    await page.locator('.ops-opportunity-panel').waitFor();
    const prematureDetailItems = page.locator('[data-ops-item-kind]');
    assert(await prematureDetailItems.count() === 0, `${goalLabel} exposes detail data before an opportunity is opened: ${JSON.stringify(await prematureDetailItems.allTextContents())}`);
    assert(await page.locator('.ops-goal-use-guide').count() === 0, `${goalLabel} exposes detail guidance below the opportunity tiles.`);
    assert(await page.getByRole('heading', { name: new RegExp(`DecisionPro analyzed.*${goalLabel === 'Identify Quality Gaps' ? 'facilities' : ''}`, 'i') }).count() || await page.locator('.ops-opportunity-panel').count(), `${goalLabel} is missing its outcome-first opportunity panel.`);
    const opportunityTiles = page.locator('.ops-opportunity-tile');
    assert(await opportunityTiles.count() >= 2, `${goalLabel} does not offer a set of smart opportunity tiles.`);
    assert(await page.locator('.ops-opportunity-benefit-value').count() === (await opportunityTiles.count()) * 2, `${goalLabel} does not show both absolute and relative benefit values on every opportunity.`);
    const benefitValues = await page.locator('.ops-opportunity-benefit-value').allTextContents();
    assert(benefitValues.every((value) => /\d/.test(value)), `${goalLabel} contains a non-numeric benefit value.`);
    assert(!(await textIncludes(page, 'Value after validation')), `${goalLabel} still contains the vague Value after validation placeholder.`);
    assert(await page.locator('.ops-opportunity-calculation').count() === await opportunityTiles.count(), `${goalLabel} does not explain every benefit calculation.`);
    await opportunityTiles.first().locator('.ops-opportunity-open').click();
    await page.locator('.ops-opportunity-detail').waitFor();
    assert(await page.locator('.ops-opportunity-tile').count() === 0, `${goalLabel} opportunity tiles remained on the detail screen.`);
    assert(await textIncludes(page, caseTitle), `${goalLabel} did not render its decision case on the opportunity detail screen.`);
    assert(await page.locator('[data-ops-item-kind="action"]').count() === 1, `${goalLabel} opportunity selection did not narrow the action lane.`);
    assert(await page.locator('.ops-decision-case.is-opportunity-focused').count() === 1, `${goalLabel} focused decision case is not visually identified.`);
    assert(await page.getByRole('heading', { name: 'What to do on this screen', exact: true }).count(), `${goalLabel} is missing permanent how-to guidance.`);
    assert(await textIncludes(page, 'Open the recommended action under Potential actions on this screen'), `${goalLabel} does not identify the exact lane where the user should act next.`);
    assert(await textIncludes(page, 'this opportunity detail is not a filter screen'), `${goalLabel} does not explain where period and scope can be changed.`);
    assert(!(await goalTiles.count()), `${goalLabel} detail page did not replace the goal grid.`);
    await page.locator('.ops-opportunity-detail-back').click();
    assert(await page.locator('.ops-opportunity-tile').count() >= 2, `${goalLabel} opportunity-detail Back did not restore the opportunity tiles.`);
    assert(await page.locator('[data-ops-item-kind]').count() === 0, `${goalLabel} still shows detail data after returning to its opportunity tiles.`);
    await page.getByRole('button', { name: 'All goals', exact: true }).click();
    assert(await goalTiles.count() === 6, `${goalLabel} did not return to the goal index.`);
  }

  await page.getByRole('button', { name: /Improve Coverage & Access/i }).click();
  assert(await page.getByRole('heading', { name: 'Improve Coverage & Access', exact: true }).count(), 'Coverage goal did not open.');
  assert(await textIncludes(page, '12 counties'), 'Coverage goal does not quantify the absolute validation benefit.');
  assert(await textIncludes(page, '15.2%'), 'Coverage goal does not quantify the validation-tranche improvement.');
  assert(await textIncludes(page, '3 county-service gaps'), 'Coverage goal does not quantify the absolute remediation benefit.');
  assert(await textIncludes(page, '25.0%'), 'Coverage goal does not quantify the remediation-tranche improvement.');
  await page.locator('.ops-opportunity-panel').scrollIntoViewIfNeeded();
  assert(await page.locator('.ops-opportunity-panel .glossary-term-link').count() > 0, 'Coverage opportunities do not hyperlink their terminology to the glossary.');
  assert(await page.locator('button button').count() === 0, 'Operational opportunity tiles contain invalid nested buttons.');
  const modeledBenefitGlossary = page.locator('.ops-opportunity-panel .glossary-term-link').filter({ hasText: /^Modeled absolute benefit$/ }).first();
  await modeledBenefitGlossary.click();
  const benefitGlossaryDialog = page.locator('.glossary-modal');
  await benefitGlossaryDialog.waitFor();
  assert((await benefitGlossaryDialog.innerText()).includes('A transparent estimate or target'), 'Modeled-benefit glossary definition is missing or incorrect.');
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-ky-operational-glossary.png') });
  await benefitGlossaryDialog.locator('.explain-close').click();
  assert(await page.locator('.ops-opportunity-panel').count() === 1, 'Opening a glossary term incorrectly navigated away from the opportunity screen.');
  assert(await page.locator('.ops-opportunity-detail').count() === 0, 'Opening a glossary term incorrectly opened the opportunity detail.');
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-ky-coverage-benefits.png') });
  assert(await page.locator('[data-ops-item-kind]').count() === 0, 'Coverage goal exposes detail data below its opportunity tiles.');
  await page.locator('[data-opportunity-id="request-network-evidence"] .ops-opportunity-open').click();
  await page.locator('.ops-opportunity-detail').waitFor();
  assert(await page.getByRole('heading', { name: 'What to do on this screen', exact: true }).count(), 'Coverage goal is missing permanent how-to guidance.');
  assert(await textIncludes(page, 'Open the recommended action under Potential actions on this screen'), 'Coverage guidance does not identify the exact lane where the user should act next.');
  assert(await page.getByRole('heading', { name: 'What to do on this screen', exact: true }).count(), 'Coverage goal is missing permanent how-to guidance.');
  assert(await textIncludes(page, 'Validate county-level facility capacity and access gaps'), 'Coverage decision case did not render.');
  assert(await page.getByRole('heading', { name: 'Inputs', exact: true }).count(), 'Evidence-input lane is missing.');
  assert(await page.getByRole('heading', { name: 'Analysis & transformations', exact: true }).count(), 'Analysis/transformation lane is missing.');
  assert(await page.getByRole('heading', { name: 'Potential actions', exact: true }).count(), 'Potential-action lane is missing.');
  const inputExplanationTrigger = page.locator('[data-ops-item-kind="input"]').first();
  await inputExplanationTrigger.locator('.ops-flow-card-open').click();
  const explanationDialog = page.getByRole('dialog');
  await explanationDialog.waitFor();
  const inputExplanationText = await explanationDialog.innerText();
  assert(inputExplanationText.includes('Where it comes from'), 'Input explanation does not disclose its source.');
  assert(inputExplanationText.includes('How it affects people, services, spending or oversight'), 'Input explanation does not disclose impact.');
  const modalButtonContrast = await auditVisibleButtonContrast(page);
  assertButtonContrast(modalButtonContrast, 'Kentucky operational explanation');
  const modalScreenshot = path.join(ARTIFACTS, 'local-ky-operational-explanation.png');
  await page.screenshot({ path: modalScreenshot });
  await explanationDialog.getByRole('button', { name: 'Close explanation' }).click();
  assert(!(await page.getByRole('dialog').count()), 'Operational explanation did not close.');
  await page.waitForFunction(
    (element) => document.activeElement === element,
    await inputExplanationTrigger.locator('.ops-flow-card-open').elementHandle(),
  );

  await page.locator('.ops-opportunity-detail-back').click();
  await page.getByRole('button', { name: 'All goals', exact: true }).click();
  await page.getByRole('button', { name: /Optimize Spending/i }).click();
  await page.getByRole('heading', { name: 'Optimize Spending', exact: true }).waitFor();
  assert(await textIncludes(page, '$0.51M–$2.54M'), 'Optimize Spending does not announce the modeled recovery planning range.');
  assert(await textIncludes(page, '10%–50%'), 'Optimize Spending does not quantify the relative modeled recovery improvement.');
  assert(await textIncludes(page, '$5.09M in reported overpayment candidates'), 'Optimize Spending does not say what DecisionPro analyzed.');
  assert(await textIncludes(page, 'Planning range—not confirmed savings'), 'Optimize Spending opportunity omits its claim boundary.');
  const recoveryOpportunity = page.locator('[data-opportunity-id="validate-recovery-ledger"]');
  await recoveryOpportunity.locator('.ops-opportunity-open').click();
  await page.locator('.ops-opportunity-detail').waitFor();
  assert(await page.locator('.ops-opportunity-panel').count() === 0, 'Recovery opportunity did not navigate to a separate detail screen.');
  assert(await page.locator('[data-ops-item-kind="action"]').count() === 1, 'Recovery opportunity did not narrow the page to one recommended action.');
  const opportunityButtonContrast = await auditVisibleButtonContrast(page);
  assertButtonContrast(opportunityButtonContrast, 'Optimize Spending opportunity tiles');
  await page.locator('.ops-opportunity-detail-head').scrollIntoViewIfNeeded();
  const opportunityScreenshot = path.join(ARTIFACTS, 'local-ky-spending-opportunities.png');
  await page.screenshot({ path: opportunityScreenshot });
  assert(await page.getByRole('heading', { name: 'What to do on this screen', exact: true }).count(), 'Optimize Spending is missing permanent how-to guidance.');
  assert(await textIncludes(page, 'Open the recommended action under Potential actions on this screen'), 'Optimize Spending guidance does not identify the exact lane where the user should act next.');
  assert(await page.getByRole('heading', { name: 'What to do on this screen', exact: true }).count(), 'Optimize Spending is missing permanent how-to guidance.');
  await page.locator('[data-ops-case-id="overpayment-reconciliation"]').waitFor();
  await page.locator('.ops-goal-use-guide').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-ky-goal-guidance.png') });
  const casePresentation = await page.locator('[data-ops-case-id="overpayment-reconciliation"]').evaluate((element) => {
    const caseStyle = getComputedStyle(element);
    const pageStyle = getComputedStyle(document.querySelector('.ops-view'));
    return {
      caseBackground: caseStyle.backgroundColor,
      pageBackground: pageStyle.backgroundColor,
      borderWidth: Number.parseFloat(caseStyle.borderTopWidth),
      borderColor: caseStyle.borderTopColor,
      boxShadow: caseStyle.boxShadow,
    };
  });
  assert(
    casePresentation.borderWidth >= 1.5
      && (casePresentation.caseBackground !== casePresentation.pageBackground || casePresentation.boxShadow !== 'none'),
    `Decision-case tile is not visually distinct from the page background: ${JSON.stringify(casePresentation)}`,
  );
  const preparedReconciliationTrigger = page.locator('[data-ops-item-kind="action"]').first();
  const actionCardText = (await preparedReconciliationTrigger.innerText()).toLowerCase();
  for (const label of ['who', 'do what', 'how', 'benefit', 'time', 'estimated cost', 'estimated savings']) {
    assert(actionCardText.includes(label), `Potential-action card omits ${label}.`);
  }
  assert(actionCardText.includes('6-plan reconciliation prepared'), 'Prepared DecisionPro deliverable is not identified on the action card.');
  await preparedReconciliationTrigger.locator('.ops-flow-card-open').click();
  await page.getByRole('heading', { name: 'Recovery reconciliation — ready for review', exact: true }).waitFor();
  await pageHeaderBack.click();
  assert(await page.locator('.ops-opportunity-detail').count(), 'Page-header Back did not return from the prepared workpaper to its opportunity detail.');
  assert(await page.getByRole('heading', { name: 'Potential recovery opportunity', exact: true }).count(), 'Returning one screen from the prepared workpaper did not preserve the selected opportunity detail.');
  await preparedReconciliationTrigger.locator('.ops-flow-card-open').click();
  await page.getByRole('heading', { name: 'Recovery reconciliation — ready for review', exact: true }).waitFor();
  assert(await page.getByRole('heading', { name: 'DecisionPro prepared the work; complete the evidence-backed review', exact: true }).count(), 'Recovery screen is missing permanent how-to guidance.');
  assert(await textIncludes(page, 'verify the fixed Review period'), 'Recovery guidance does not identify where to confirm the reporting period.');
  assert(await textIncludes(page, 'a data operator must run the governed MCPAR ingestion outside this dashboard'), 'Recovery guidance does not identify how another period becomes available.');
  assert(await textIncludes(page, 'use Plan scope'), 'Recovery guidance does not identify where to set plan scope.');
  assert(await textIncludes(page, 'click Download recovery-status template on this screen'), 'Recovery guidance does not identify how and where to obtain the review template.');
  const periodControl = page.getByLabel('Review period', { exact: true });
  const scopeControl = page.getByLabel('Plan scope', { exact: true });
  assert(await periodControl.inputValue() === 'CY 2024', 'Recovery period control does not show the loaded period.');
  assert(await periodControl.isDisabled(), 'Recovery period appears configurable even though only one governed period is loaded.');
  assert(await textIncludes(page, 'click ← Decision case, then open the Data Sources tab'), 'Recovery period help does not identify where to inspect source availability.');
  assert(await scopeControl.inputValue() === 'all', 'Recovery scope control does not default to all plans.');
  await page.locator('.recovery-workspace').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-ky-recovery-guidance.png') });
  assert(await page.locator('[data-recovery-plan]').count() === 6, 'Recovery workpaper does not contain six plan rows.');
  assert(await textIncludes(page, '$5,088,460.77'), 'Exact reported candidate total is missing from the workpaper.');
  assert(await textIncludes(page, 'United Healthcare Community Plan'), 'United Healthcare plan row is missing.');
  assert(await textIncludes(page, '$3,196,724.69'), 'United Healthcare reported candidate amount is missing.');
  assert(await page.getByText('Awaiting authorized recovery record', { exact: true }).count() === 6, 'A public-source plan row was preclassified without authorized recovery evidence.');
  assert(await textIncludes(page, 'do not use PHI or person-level records'), 'Safe evidence boundary is missing from the workpaper.');
  assert(await textIncludes(page, '$508,846.08–$2,544,230.39'), 'Planning recovery sensitivity range is missing.');
  assert(await textIncludes(page, 'Planning case: $1,272,115.19'), 'Planning recovery case is missing.');
  assert(await textIncludes(page, '72–120 staff hours'), 'Estimated review effort is missing.');
  assert(await textIncludes(page, '$4,320.00–$9,600.00'), 'Estimated review cost is missing.');
  assert(await textIncludes(page, '3–6 weeks'), 'Estimated completion duration is missing.');
  assert(await textIncludes(page, '25% planning scenario: $95,236.16'), 'Per-plan recovered-amount planning scenario is missing.');
  assert(await page.locator('.recovery-help > button').count() > 20, 'Question-mark explanations are not available across headings and fields.');
  const mcparGlossary = page.locator('.recovery-workspace .glossary-term-link').filter({ hasText: /^MCPAR$/ }).first();
  assert(await mcparGlossary.count(), 'Recovery workpaper does not hyperlink MCPAR to the glossary.');
  await mcparGlossary.click();
  const mcparGlossaryDialog = page.locator('.glossary-modal');
  await mcparGlossaryDialog.waitFor();
  const glossaryScrollbar = await mcparGlossaryDialog.locator('.glossary-term-list').evaluate((element) => ({
    scrollbarColor: getComputedStyle(element).scrollbarColor,
    thumbColor: getComputedStyle(element, '::-webkit-scrollbar-thumb').backgroundColor,
    trackColor: getComputedStyle(element, '::-webkit-scrollbar-track').backgroundColor,
    scrollable: element.scrollHeight > element.clientHeight,
  }));
  assert(glossaryScrollbar.scrollable, 'Glossary term list is not vertically scrollable.');
  assert(
    glossaryScrollbar.scrollbarColor.includes('rgb(143, 220, 255)')
      && glossaryScrollbar.scrollbarColor.includes('rgb(16, 42, 66)'),
    `Glossary scrollbar does not use the DecisionPro accent and navy theme: ${JSON.stringify(glossaryScrollbar)}`,
  );
  assert(glossaryScrollbar.thumbColor === 'rgb(143, 220, 255)', `Glossary scrollbar thumb is not themed: ${JSON.stringify(glossaryScrollbar)}`);
  assert(glossaryScrollbar.trackColor === 'rgb(16, 42, 66)', `Glossary scrollbar track is not themed: ${JSON.stringify(glossaryScrollbar)}`);
  const mcparGlossaryText = await mcparGlossaryDialog.innerText();
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-ky-recovery-glossary.png') });
  assert(mcparGlossaryText.includes('Managed Care Program Annual Report'), 'MCPAR glossary definition is missing.');
  const mcparReference = mcparGlossaryDialog.locator('a[href*="medicaid.gov"]');
  assert(await mcparReference.count(), 'MCPAR glossary entry does not link to the authoritative Medicaid.gov source.');
  await mcparGlossaryDialog.locator('.explain-close').click();
  assert(await page.locator('.recovery-workspace').count() === 1, 'Opening the MCPAR glossary term navigated away from the recovery workpaper.');
  await scopeControl.selectOption('aetna');
  assert(await page.locator('[data-recovery-plan]').count() === 1, 'Plan scope control did not filter the review rows.');
  assert(await textIncludes(page, 'Current view: CY 2024 · Aetna Better Health'), 'Current period and scope are not restated after filtering.');
  const scopedSummary = await page.locator('.recovery-summary').innerText();
  assert(scopedSummary.includes('$380,944.63'), 'Scoped candidate total did not recalculate for Aetna.');
  assert(await textIncludes(page, '$38,094.46–$190,472.32'), 'Scoped planning recovery range did not recalculate for Aetna.');
  assert(await textIncludes(page, '12–20 staff hours'), 'Scoped review effort did not recalculate for Aetna.');
  assert(await textIncludes(page, '$720.00–$1,600.00'), 'Scoped review cost did not recalculate for Aetna.');
  await scopeControl.selectOption('all');
  assert(await page.locator('[data-recovery-plan]').count() === 6, 'All-plan scope did not restore six review rows.');
  await page.getByRole('button', { name: 'Explain Reported candidate', exact: true }).click();
  const candidateHelp = page.getByRole('dialog', { name: 'Reported candidate explanation', exact: true });
  await candidateHelp.waitFor();
  assert((await candidateHelp.innerText()).includes('candidate pool—not confirmed debt, waste, recovery, or savings'), 'Reported-candidate explanation does not justify its meaning.');
  const helpGeometry = await candidateHelp.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const points = [
      [rect.left + 4, rect.top + 4],
      [rect.right - 4, rect.top + 4],
      [rect.left + 4, rect.bottom - 4],
      [rect.right - 4, rect.bottom - 4],
    ];
    return {
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      cornersOnTop: points.every(([x, y]) => element.contains(document.elementFromPoint(x, y))),
    };
  });
  assert(helpGeometry.left >= 0 && helpGeometry.top >= 0 && helpGeometry.right <= helpGeometry.viewportWidth && helpGeometry.bottom <= helpGeometry.viewportHeight, 'Question-mark pop-up is clipped by the viewport.');
  assert(helpGeometry.cornersOnTop, 'Question-mark pop-up is covered by another UI layer.');
  const helpButtonContrast = await auditVisibleButtonContrast(page);
  assertButtonContrast(helpButtonContrast, 'Recovery question-mark explanation');
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-ky-recovery-help.png') });
  await candidateHelp.getByRole('button', { name: 'Close Reported candidate explanation', exact: true }).click();
  const recoveryTableWrap = page.locator('.recovery-table-wrap');
  const horizontalTableScroll = page.getByRole('region', { name: 'Horizontal table scroll', exact: true });
  const topScrollGeometry = await horizontalTableScroll.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    element.dispatchEvent(new Event('scroll'));
    const rect = element.getBoundingClientRect();
    return {
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft,
      height: rect.height, visibility: getComputedStyle(element).visibility,
    };
  });
  assert(topScrollGeometry.scrollWidth > topScrollGeometry.clientWidth && topScrollGeometry.scrollLeft > 0, 'Always-visible horizontal table scrollbar is not functional.');
  assert(topScrollGeometry.height >= 18 && topScrollGeometry.visibility === 'visible', 'Horizontal table scrollbar is not visibly represented.');
  const scrollGeometry = await recoveryTableWrap.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    element.scrollTop = element.scrollHeight;
    return {
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft,
      clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop,
    };
  });
  assert(scrollGeometry.scrollWidth > scrollGeometry.clientWidth && scrollGeometry.scrollLeft > 0, 'Recovery table horizontal scrollbar is not functional.');
  assert(scrollGeometry.scrollHeight > scrollGeometry.clientHeight && scrollGeometry.scrollTop > 0, 'Recovery table bounded viewport is not vertically scrollable.');
  await horizontalTableScroll.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-ky-recovery-scrollbars.png') });
  await horizontalTableScroll.evaluate((element) => { element.scrollLeft = 0; element.dispatchEvent(new Event('scroll')); });
  await recoveryTableWrap.evaluate((element) => { element.scrollLeft = 0; element.scrollTop = 0; });

  const aetnaRow = page.locator('[data-recovery-plan="aetna"]');
  await aetnaRow.locator('select').selectOption('recovered');
  await aetnaRow.locator('input[type="number"]').fill('100000.25');
  assert(await textIncludes(page, '$100,000.25'), 'Confirmed recovered total did not update from reviewer input.');
  const reviewDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review workpaper', exact: true }).click();
  const reviewDownload = await reviewDownloadPromise;
  assert(reviewDownload.suggestedFilename().endsWith('.csv'), 'Review workpaper did not download as CSV.');
  const templateDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery-status template', exact: true }).click();
  const templateDownload = await templateDownloadPromise;
  assert(templateDownload.suggestedFilename().endsWith('.csv'), 'Recovery-status template did not download as CSV.');
  const reconciliationScreenshot = path.join(ARTIFACTS, 'local-ky-recovery-reconciliation.png');
  await page.screenshot({ path: reconciliationScreenshot });
  await page.getByRole('button', { name: /Decision case/i }).click();
  await page.locator('[data-ops-case-id="overpayment-reconciliation"]').waitFor();
  await page.locator('.ops-opportunity-detail-back').click();
  await page.locator('[data-opportunity-id="strengthen-repeat-controls"] .ops-opportunity-open').click();
  await page.locator('.ops-opportunity-detail').waitFor();

  const actionExplanationTrigger = page.locator('[data-ops-item-kind="action"]').first();
  await actionExplanationTrigger.locator('.ops-flow-card-open').click();
  const actionDialog = page.getByRole('dialog');
  await actionDialog.waitFor();
  const actionExplanationText = await actionDialog.innerText();
  const normalizedActionExplanation = actionExplanationText.toLowerCase();
  assert(normalizedActionExplanation.includes('review priority'), 'Action explanation omits review priority.');
  assert(normalizedActionExplanation.includes('implementation status'), 'Action explanation omits implementation status.');
  assert(normalizedActionExplanation.includes('who needs to do it'), 'Action explanation omits accountable actors.');
  assert(normalizedActionExplanation.includes('how they do it'), 'Action explanation omits implementation steps.');
  assert(normalizedActionExplanation.includes('expected benefit'), 'Action explanation omits expected benefit.');
  assert(normalizedActionExplanation.includes('how long it should take'), 'Action explanation omits duration.');
  assert(normalizedActionExplanation.includes('estimated cost and savings'), 'Action explanation omits financial estimates or explicit estimate gaps.');
  assert(normalizedActionExplanation.includes('how success is measured'), 'Action explanation omits success measures.');
  const actionModalScreenshot = path.join(ARTIFACTS, 'local-ky-operational-action-explanation.png');
  await page.screenshot({ path: actionModalScreenshot });
  await actionDialog.getByRole('button', { name: 'Close explanation' }).click();
  await page.waitForFunction(
    (element) => document.activeElement === element,
    await actionExplanationTrigger.locator('.ops-flow-card-open').elementHandle(),
  );
  const activeCase = page.locator('[data-ops-case-id="overpayment-reconciliation"]');
  await activeCase.scrollIntoViewIfNeeded();
  const caseScreenshot = path.join(ARTIFACTS, 'local-ky-operational-case.png');
  await page.screenshot({ path: caseScreenshot });

  await page.getByRole('tab', { name: 'Evidence & Data', exact: true }).click();
  assert(!(await goalTiles.count()), 'Evidence & Data page still shows goal tiles.');
  assert(await textIncludes(page, '1,018'), 'Kentucky MCPAR row count was not rendered.');
  assert(await page.getByRole('heading', { name: 'Hydrated Kentucky operational datasets' }).count(), 'Hydrated Kentucky source section is missing.');
  assert(await textIncludes(page, '8 sources'), 'Hydrated source count was not rendered.');
  assert(await textIncludes(page, '267'), 'CMS facility count was not rendered.');
  assert(await textIncludes(page, '18,937'), 'Kentucky licensed-hospital bed count was not rendered.');
  assert(await textIncludes(page, '$5.1M'), 'MCPAR plan-reported overpayment signal was not rendered.');
  assert(await textIncludes(page, '$15.5B'), 'Latest complete-year federal obligation context was not rendered.');
  assert(await page.getByRole('button', { name: /^Evidence Rooms$/i }).count(), 'Kentucky Evidence Rooms navigation is missing.');
  assert(await page.getByRole('button', { name: /^Authoritative sources$/i }).count(), 'Kentucky source catalogue navigation is missing.');
  assert(await page.getByRole('heading', { name: 'What this version does not claim', exact: true }).count(), 'Evidence limitations are missing.');
  const mcparTerm = page.locator('button[title="Glossary: MCPAR"]').first();
  const evidenceGlossaryLabels = await page.locator('.glossary-term-link').allTextContents();
  assert(await mcparTerm.count(), `MCPAR evidence is not linked to its glossary definition. Visible glossary labels: ${JSON.stringify(evidenceGlossaryLabels)}`);
  await mcparTerm.click();
  await glossaryDialog.waitFor();
  assert((await glossaryDialog.innerText()).includes('Managed Care Program Annual Report'), 'MCPAR glossary definition does not explain the source.');
  assert(await glossaryDialog.getByRole('link', { name: /CMS public MCPAR guidance/i }).count(), 'MCPAR glossary entry is missing its authoritative reference.');
  await glossaryDialog.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('tab', { name: 'Data Sources', exact: true }).click();
  await pageHeaderBack.click();
  assert(await page.locator('#ops-page-evidence').count(), 'Page-header Back skipped Evidence & Data after navigating Evidence & Data → Data Sources.');
  await pageHeaderBack.click();
  assert(await goalTiles.count() === 6, 'A second page-header Back did not return from Evidence & Data to the Operational Intelligence Goals screen.');
  assert(await page.getByRole('heading', { name: 'Operational intelligence', exact: true }).count(), 'Page-header Back incorrectly exited Operational Intelligence while unwinding its tab history.');
  await page.getByRole('tab', { name: 'Data Sources', exact: true }).click();
  assert(!(await page.getByRole('heading', { name: 'Hydrated Kentucky operational datasets' }).count()), 'Data Sources page still shows evidence hydration content.');
  assert(await page.getByRole('heading', { name: 'Supported APIs first; governed document adapters second', exact: true }).count(), 'Free and public source coverage page is missing.');
  assert(await textIncludes(page, 'REAL data hydrated'), 'Hydrated source status is missing.');
  const sourceGlossaryLinks = page.locator('.ops-source-table .glossary-term-link');
  assert(await sourceGlossaryLinks.count() >= 4, 'Data Sources rows do not expose glossary definitions for integrated sources.');
  assert(await page.getByRole('link', { name: 'Open official source ↗', exact: true }).count() >= 4, 'Data Sources rows do not keep separate authoritative source links.');
  assert(await page.locator('.ops-source-table .glossary-term-link').count() > 0, 'Data Sources table does not hyperlink source terminology to the glossary.');
  assert(await page.locator('button button').count() === 0, 'Data Sources page contains invalid nested buttons.');
  const sourceGlossary = page.locator('.ops-source-table .glossary-term-link').filter({ hasText: /CMS Managed Care Program Annual Report PUF 2024/i }).first();
  await sourceGlossary.click();
  const sourceGlossaryDialog = page.locator('.glossary-modal');
  await sourceGlossaryDialog.waitFor();
  assert((await sourceGlossaryDialog.innerText()).includes('Managed Care Program Annual Report'), 'Data-source glossary entry did not open the MCPAR definition.');
  assert(await sourceGlossaryDialog.locator('a[href*="medicaid.gov"]').count(), 'Data-source glossary entry does not include its authoritative reference.');
  await page.screenshot({ path: path.join(ARTIFACTS, 'local-ky-source-glossary.png') });
  await sourceGlossaryDialog.locator('.explain-close').click();
  assert(await page.getByRole('heading', { name: 'Supported APIs first; governed document adapters second', exact: true }).count(), 'Closing a source glossary entry did not preserve the Data Sources page.');
  const catalogButton = page.getByRole('button', { name: 'Open Full Source Catalog', exact: true });
  assert(await catalogButton.count(), 'Kentucky source catalog button label is incorrect.');
  const sourceZoomField = page.getByRole('combobox', { name: 'Zoom percentage' });
  await sourceZoomField.fill('90');
  await sourceZoomField.press('Enter');
  const sourceTableScroll = page.locator('.ops-source-table-wrap');
  const sourceTopScroll = page.getByRole('region', { name: 'Horizontal source table scroll', exact: true });
  const sourceScrollGeometry = await sourceTopScroll.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    element.dispatchEvent(new Event('scroll'));
    const rect = element.getBoundingClientRect();
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollLeft: element.scrollLeft,
      height: rect.height,
      visible: rect.top >= 0 && rect.bottom <= window.innerHeight,
    };
  });
  assert(sourceScrollGeometry.scrollWidth > sourceScrollGeometry.clientWidth && sourceScrollGeometry.scrollLeft > 0, `Data Sources horizontal scrollbar is not functional at 90% zoom: ${JSON.stringify(sourceScrollGeometry)}`);
  assert(sourceScrollGeometry.height >= 18 && sourceScrollGeometry.visible, 'Data Sources horizontal scrollbar is not visibly represented at 90% zoom.');
  const synchronizedSourceScrollLeft = await sourceTableScroll.evaluate((element) => element.scrollLeft);
  assert(synchronizedSourceScrollLeft === sourceScrollGeometry.scrollLeft, 'Data Sources scrollbar did not synchronize with the table.');
  await sourceTopScroll.evaluate((element) => {
    element.scrollLeft = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  const logoBox = await page.getByRole('button', { name: /DecisionPro Kentucky.*open Role Selector/i }).boundingBox();
  assert(logoBox && logoBox.x >= 0 && logoBox.x + logoBox.width <= 1440, 'Kentucky logo is clipped after zoom changes.');
  const logoTextBox = await page.locator('.decisionpro-logo-text strong').boundingBox();
  assert(logoTextBox && logoTextBox.x >= 0 && logoTextBox.x + logoTextBox.width <= 1440, 'Kentucky logo text is clipped after zoom changes.');

  const linkContrast = await auditVisibleLinkContrast(page);
  assert(linkContrast.length > 0, 'Kentucky operational view has no visible links to audit.');
  assert(linkContrast.every((link) => link.color !== 'rgb(0, 0, 238)'), 'A link retained the browser default dark blue.');
  assert(linkContrast.every((link) => link.contrast >= 4.5), `Kentucky link contrast failed: ${JSON.stringify(linkContrast.filter((link) => link.contrast < 4.5))}`);
  assert(linkContrast.every((link) => link.decoration.includes('underline')), 'A text link lacks a non-color underline cue.');
  const buttonContrast = await auditVisibleButtonContrast(page);
  assertButtonContrast(buttonContrast, 'Kentucky operational view');

  await page.locator('.content-column').evaluate((element) => { element.scrollTop = 0; });
  const screenshot = path.join(ARTIFACTS, 'local-ky-operational.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  const zoomField = page.getByRole('combobox', { name: 'Zoom percentage' });
  await zoomField.fill('80');
  await zoomField.press('Enter');
  await catalogButton.scrollIntoViewIfNeeded();
  const catalogButtonBox = await catalogButton.boundingBox();
  assert(
    catalogButtonBox && catalogButtonBox.y >= 0 && catalogButtonBox.y + catalogButtonBox.height <= 1000,
    'Open Full Source Catalog button did not render inside the 80% viewport.',
  );
  const catalogButtonScreenshot = path.join(ARTIFACTS, 'local-ky-source-catalog-button.png');
  await page.screenshot({ path: catalogButtonScreenshot });
  report.kentucky = {
    url: page.url(),
    screenshot,
    goalsScreenshot,
    caseScreenshot,
    modalScreenshot,
    actionModalScreenshot,
    opportunityScreenshot,
    opportunityButtonContrast,
    modalButtonContrast,
    catalogButtonScreenshot,
    catalogButtonZoom: 80,
    mcpArRows: 1018,
    linkContrast,
    selectorButtonContrast,
    buttonContrast,
    consoleErrors,
    responseErrors,
  };
  await page.close();
}

async function verifyFlorida(context, report) {
  const page = await context.newPage();
  const { consoleErrors, responseErrors } = trackPageErrors(page);

  await page.goto(`${BASE_URL}/?state=FL`, { waitUntil: 'networkidle' });
  assert(await textIncludes(page, 'DecisionPro Florida'), 'Florida brand was not rendered.');
  assert((await page.title()).startsWith('DecisionPro Florida —'), 'Florida browser title is not state-specific.');
  const selectorButtonContrast = await auditVisibleButtonContrast(page);
  assertButtonContrast(selectorButtonContrast, 'Florida role selector');
  await selectBudgetRole(page);
  await page.getByRole('heading', { name: /Turn Florida’s public health-care dashboards/i }).waitFor();
  assert(await page.getByRole('button', { name: /^Evidence Rooms$/i }).count(), 'Florida Evidence Rooms navigation is missing.');
  assert(await page.getByRole('button', { name: /Ask Sam/i }).count(), 'Florida Ask Sam surface is missing.');
  assert(await page.locator('.guide-page-btn').count() === 1, 'Florida page guide is missing.');
  if (await page.getByRole('dialog').count()) await page.locator('.walkthrough-scrim').click({ position: { x: 5, y: 5 } });
  assert(await page.locator('.fl-kpi-card').count() >= 4, 'Florida role home did not render smart KPI tiles.');
  const homeScreenshot = path.join(ARTIFACTS, 'local-fl-role-home.png');
  await page.screenshot({ path: homeScreenshot, fullPage: true });

  await page.getByRole('button', { name: /^Operational intelligence$/i }).click();
  await page.getByRole('heading', { name: 'Operational intelligence' }).waitFor();
  assert(await page.getByRole('tab', { name: 'Goals', exact: true }).count(), 'Florida Goals tab is missing.');
  assert(await page.locator('.ops-goal-tile').count() === 6, 'Florida did not render six operational goals.');
  await page.locator('.ops-goal-tile').first().click();
  assert(await page.locator('.ops-opportunity-tile').count() >= 2, 'Florida goal did not render multiple quantified opportunity tiles.');
  assert(await page.locator('.ops-opportunity-benefit-value').count() >= 4, 'Florida opportunities are missing absolute/percentage benefit values.');
  const opportunityScreenshot = path.join(ARTIFACTS, 'local-fl-opportunities.png');
  await page.screenshot({ path: opportunityScreenshot, fullPage: true });

  await page.getByRole('tab', { name: 'Evidence & Data', exact: true }).click();
  assert(await textIncludes(page, '2,501'), 'Florida MCPAR row count was not rendered.');
  assert(await textIncludes(page, '3,877,393'), 'Current Florida Medicaid eligibility total was not rendered.');
  assert(await textIncludes(page, '9,093'), 'Aggregate Florida-address LEIE workload was not rendered.');
  await page.getByRole('tab', { name: 'Data Sources', exact: true }).click();
  assert(await textIncludes(page, 'Florida Medicaid Eligible Reports'), 'Florida eligible-report correction was not rendered.');
  assert(await textIncludes(page, 'Florida Medicaid provider fee schedules'), 'Florida fee-schedule correction was not rendered.');

  await page.getByRole('button', { name: /^Authoritative sources$/i }).click();
  await page.getByRole('heading', { name: 'Authoritative Sources' }).waitFor();
  assert(await page.locator('.fl-source-table tbody tr').count() === 17, 'Florida source catalogue does not contain four federal sources plus all thirteen AHCA dashboard/publication domains.');
  assert(await textIncludes(page, 'GAP-FL-QUALITY-INITIATIVES'), 'Quality Initiatives export restriction is not a visible Gap.');
  assert(await textIncludes(page, 'GAP-FL-MALPRACTICE'), 'Malpractice export restriction is not a visible Gap.');
  const sourcesScreenshot = path.join(ARTIFACTS, 'local-fl-sources.png');
  await page.screenshot({ path: sourcesScreenshot, fullPage: true });
  const linkContrast = await auditVisibleLinkContrast(page);
  assert(linkContrast.length > 0, 'Florida source catalogue has no visible links to audit.');
  assert(linkContrast.every((link) => link.color !== 'rgb(0, 0, 238)'), 'A Florida link retained the browser default dark blue.');
  assert(linkContrast.every((link) => link.contrast >= 4.5), `Florida link contrast failed: ${JSON.stringify(linkContrast.filter((link) => link.contrast < 4.5))}`);
  assert(linkContrast.every((link) => link.decoration.includes('underline')), 'A Florida text link lacks a non-color underline cue.');

  await page.getByRole('button', { name: /^Evidence Rooms$/i }).click();
  await page.getByRole('heading', { name: 'Evidence Rooms' }).waitFor();
  assert(await page.locator('.fl-room-grid button').count() === 8, 'Florida did not render all eight governed Evidence Rooms.');
  await page.locator('.fl-room-grid button').filter({ hasText: 'Facilities & Access' }).click();
  await page.getByRole('heading', { name: 'Facilities & Access' }).waitFor();
  assert(await page.locator('.fl-kpi-card').count() >= 3, 'Florida Facilities & Access room did not render hydrated metrics.');
  assert(await page.locator('.fl-subtabs [role="tab"]').count() === 3, 'Florida evidence room did not expose analysis, source-native, and integrated-report modes.');
  assert(await page.locator('.fl-analytics-table tbody tr').count() > 50, 'Florida facility analysis did not expose county-level comparisons.');
  const roomSearch = page.locator('.fl-filter-row input');
  await roomSearch.fill('Leon');
  assert(await page.locator('.fl-analytics-table tbody tr').count() >= 1, 'Florida facility analysis search did not retain the Leon County result.');
  await roomSearch.fill('');
  await page.getByRole('tab', { name: 'Integrated report', exact: true }).click();
  assert(await textIncludes(page, 'Recommended reviewer sequence'), 'Florida integrated report did not provide a reviewer sequence.');
  await page.getByRole('tab', { name: 'Source-native dashboard', exact: true }).click();
  assert(await page.locator('iframe[title*="authoritative source-native view"]').count() === 1, 'Florida authoritative source-native frame is missing.');
  assert(await textIncludes(page, 'Source-native parity layer'), 'Florida source-native ownership boundary is missing.');
  const roomScreenshot = path.join(ARTIFACTS, 'local-fl-evidence-room.png');
  await page.screenshot({ path: roomScreenshot, fullPage: true });

  await page.getByRole('button', { name: /^Consideration Blender$/i }).click();
  await page.getByRole('heading', { name: 'Consideration Blender', exact: true }).waitFor();
  assert(await page.locator('.fl-weight-grid input[type="range"]').count() === 4, 'Florida Blender did not expose four explicit decision weights.');
  assert(await page.locator('.fl-ranked-goals article').count() === 6, 'Florida Blender did not expose the six-goal ranked consideration set.');
  const actionRows = page.locator('.fl-action-tracker .fl-analytics-table tbody tr');
  assert(await actionRows.count() >= 6, 'Florida action and benefit tracker did not expose accountable actions.');
  const firstStatus = actionRows.first().locator('select');
  await firstStatus.selectOption('Investigating');
  assert((await firstStatus.inputValue()) === 'Investigating', 'Florida action tracker did not retain session status edits.');
  const firstValue = actionRows.first().getByLabel(/realized value/i);
  await firstValue.fill('125000');
  assert((await firstValue.inputValue()) === '125000', 'Florida realized-value tracker did not retain an aggregate value.');
  assert(new URL(page.url()).searchParams.get('state') === 'FL', 'Florida URL identity was not retained.');

  const buttonContrast = await auditVisibleButtonContrast(page);
  assertButtonContrast(buttonContrast, 'Florida operational view');

  const screenshot = path.join(ARTIFACTS, 'local-fl-blender.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  report.florida = {
    url: page.url(),
    screenshot,
    homeScreenshot,
    opportunityScreenshot,
    sourcesScreenshot,
    roomScreenshot,
    mcpArRows: 2501,
    ahcaDomains: 11,
    evidenceRooms: 8,
    operationalGoals: 6,
    dproCapabilityNavigationEnabled: true,
    linkContrast,
    selectorButtonContrast,
    buttonContrast,
    consoleErrors,
    responseErrors,
  };
  await page.close();
}

(async () => {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  const server = spawn(process.execPath, [VITE, 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: APP,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({
      executablePath: CHROME,
      headless: !isolated,
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
    const report = {
      capturedAt: new Date().toISOString(),
      evidenceClass: isolated ? 'isolated-rendered' : 'headless-validated',
      browser: await browser.version(),
      viewport: '1440x1000',
      desktopName: process.env.SCRIPTORIUM_UI_DESKTOP_NAME || null,
    };

    await verifyLanding(context, report);
    await verifyKentucky(context, report);
    await verifyFlorida(context, report);
    assert(report.landing.consoleErrors.length === 0, `Landing console errors: ${report.landing.consoleErrors.join(' | ')}`);
    assert(report.kentucky.consoleErrors.length === 0, `Kentucky console errors: ${report.kentucky.consoleErrors.join(' | ')}`);
    assert(report.florida.consoleErrors.length === 0, `Florida console errors: ${report.florida.consoleErrors.join(' | ')}`);
    assert(report.landing.responseErrors.length === 0, `Landing response errors: ${report.landing.responseErrors.join(' | ')}`);
    assert(report.kentucky.responseErrors.length === 0, `Kentucky response errors: ${report.kentucky.responseErrors.join(' | ')}`);
    assert(report.florida.responseErrors.length === 0, `Florida response errors: ${report.florida.responseErrors.join(' | ')}`);

    await context.close();
    const reportPath = path.join(ARTIFACTS, 'local-variant-verification.json');
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ passed: true, reportPath, evidenceClass: report.evidenceClass }));
  } catch (error) {
    fs.writeFileSync(
      path.join(ARTIFACTS, 'local-variant-failure.json'),
      `${JSON.stringify({
        capturedAt: new Date().toISOString(),
        evidenceClass: isolated ? 'pending-rendered-gate' : 'headless-validation-failed',
        error: error.stack || error.message,
        serverOutput: serverOutput.trim(),
      }, null, 2)}\n`,
    );
    console.error(error.stack || error.message);
    if (serverOutput) console.error(serverOutput.trim());
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
})();
