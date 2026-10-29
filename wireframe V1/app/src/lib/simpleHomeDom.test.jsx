/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIMPLE_TABS, SimpleHome, SimplePage } from '../components/SimpleHome.jsx';
import { StateLanding } from '../components/StateLanding.jsx';
import { TILE_LAYOUT_STORAGE_KEY } from './simpleMode/tileLayout.js';
import { DEFAULT_TILE_IDS } from './simpleMode/simpleTiles.js';
import { HOUSE_DISTRICTS } from './simpleMode/geography.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.CSS = globalThis.CSS || { escape: (s) => s };

// Explainer prompts are tested on their own; keep them out of the other page tests.
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('decisionpro.explainers.off', '1'); });
afterEach(() => { document.body.innerHTML = ''; });

function render(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return host;
}

function click(element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
}

function change(select, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const PAGE_VIEWS = SIMPLE_TABS.map((t) => t.view);

describe('Simple view tabs', () => {
  it('lists the release 2 tabs in order', () => {
    expect(SIMPLE_TABS.map((t) => t.label)).toEqual([
      'At a glance', 'Access to care', 'Spending', 'Health outcomes', 'Compare states', 'Health plans (MCOs)', 'Hospitals', 'Payment rates', 'Waiver waitlists',
      'Long-term care', 'Behavioral health', 'Who is covered', 'Medicaid in my county', 'My district',
    ]);
  });

  it.each(PAGE_VIEWS)('%s renders with no "not loaded yet" or "entered by hand" text', (view) => {
    const host = render(<SimplePage view={view} />);
    expect(host.querySelector('h1').textContent.length).toBeGreaterThan(5);
    expect(host.textContent).not.toMatch(/not loaded yet|entered by hand/i);
    expect(host.querySelector('.sm-gap')).toBeNull();
  });

  it.each(PAGE_VIEWS.filter((v) => !['simple-home', 'simple-county', 'simple-district', 'simple-states', 'simple-hospitals', 'simple-rates'].includes(v)))('%s shows sourced measure cards', (view) => {
    const host = render(<SimplePage view={view} />);
    const cards = host.querySelectorAll('.sm-measure');
    expect(cards.length).toBeGreaterThan(3);
    for (const card of cards) {
      expect(card.querySelector('.sm-info-btn'), card.dataset.measureId || card.dataset.tableId).toBeTruthy();
      expect(card.querySelector('.sm-source'), card.dataset.measureId || card.dataset.tableId).toBeNull();
    }
  });
});

describe('At a glance', () => {
  it('shows the briefing strip, the standard dashboard and the facts rail', () => {
    const host = render(<SimpleHome />);
    expect(host.querySelectorAll('.sm-briefing').length).toBeGreaterThanOrEqual(3);
    expect([...host.querySelectorAll('.sm-tile')].map((t) => t.dataset.tileId)).toEqual(DEFAULT_TILE_IDS);
    expect(host.querySelector('.sm-facts h2').textContent).toBe('Kentucky facts');
    expect(host.textContent).toContain('Where is Medicaid money going?');
  });

  it('puts the dashboard before the briefing strip and widens the renewals tile', () => {
    const host = render(<SimpleHome />);
    const dashboard = host.querySelector('.sm-glance-layout');
    const briefings = host.querySelector('.sm-briefings');
    expect(dashboard.compareDocumentPosition(briefings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host.querySelector('[data-tile-id="renewals"]').classList.contains('is-wide')).toBe(true);
    expect(host.querySelector('[data-tile-id="spending"]').classList.contains('is-wide')).toBe(false);
  });

  it('tiles and question chips open their pages', () => {
    const onNavigate = vi.fn();
    const host = render(<SimpleHome onNavigate={onNavigate} />);
    click(host.querySelector('[data-tile-id="waivers"] .sm-tile-body'));
    expect(onNavigate).toHaveBeenLastCalledWith('simple-waivers', { anchor: 'waiver-waitlist-unduplicated' });
    click([...host.querySelectorAll('.sm-chip')].find((b) => b.textContent === 'Can people get care?'));
    expect(onNavigate).toHaveBeenLastCalledWith('simple-access', undefined);
  });

  it('pins, removes, re-adds and reorders tiles, and remembers the layout', () => {
    const host = render(<SimpleHome />);
    click(host.querySelector('[data-tile-id="renewals"] .sm-pin'));
    expect(host.querySelector('.sm-tile').dataset.tileId).toBe('renewals');
    click([...host.querySelectorAll('.sm-chip')].find((b) => b.textContent === 'Customize'));
    click(host.querySelector('[aria-label="Remove Spending"]'));
    expect(host.querySelector('[data-tile-id="spending"]')).toBeNull();
    click([...host.querySelectorAll('.sm-catalog .sm-chip')].find((b) => b.textContent === '+ Spending'));
    expect(host.querySelector('[data-tile-id="spending"]')).toBeTruthy();
    click(host.querySelector('[aria-label="Move Spending earlier"]'));
    const stored = JSON.parse(localStorage.getItem(TILE_LAYOUT_STORAGE_KEY));
    expect(stored.pinned).toEqual(['renewals']);
    expect(stored.shown.indexOf('spending')).toBe(stored.shown.length - 2);
  });

  it('filters by county and population', () => {
    const host = render(<SimpleHome />);
    const [who, where] = host.querySelectorAll('.sm-filters select');
    change(where, 'county:21111');
    expect(host.querySelector('.sm-facts h2').textContent).toBe('Jefferson County');
    expect(host.querySelector('.sm-filter-summary').textContent).toMatch(/Medicaid members in Jefferson County/);
    change(who, 'children');
    expect(host.querySelector('.sm-filter-summary').textContent).toMatch(/children/i);
  });
});

describe('Pages', () => {
  it.each(PAGE_VIEWS)('%s shows no inline method text; estimates explain themselves in a pop-up', (view) => {
    const host = render(<SimplePage view={view} />);
    expect(host.querySelector('.sm-method')).toBeNull();
    expect(host.textContent).not.toMatch(/How this is estimated/);
  });

  it('shows each tile’s source only in its ? pop-up, with the link', () => {
    const host = render(<SimpleHome />);
    const tile = host.querySelector('[data-tile-id="spending"]');
    expect(tile.querySelector('.sm-tile-source')).toBeNull();
    expect(tile.textContent).not.toMatch(/MACPAC/);
    click(tile.querySelector('.sm-info-btn'));
    const pop = tile.querySelector('.sm-estimate-pop');
    expect(pop.textContent).toMatch(/MACPAC/);
    expect(pop.querySelector('a[href^="https://"]')).toBeTruthy();
  });

  it('puts breakdown tables in a card with a ? source button', () => {
    const host = render(<SimplePage view="simple-spending" />);
    const card = host.querySelector('[data-table-id="spending-growth-decomposition"]');
    expect(card.querySelector('h3').textContent).toMatch(/Spending change/);
    expect(card.querySelector('.sm-info-btn')).toBeTruthy();
  });

  it('opens and closes the estimate pop-up from the Estimate pill', () => {
    const host = render(<SimplePage view="simple-spending" />);
    const pill = host.querySelector('[data-measure-id="dms-staff-fte-estimate"] .sm-estimate-chip.is-button');
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    click(pill);
    const pop = host.querySelector('.sm-estimate-pop');
    expect(pop.textContent).toMatch(/How this is estimated/);
    expect(pop.textContent).toMatch(/112,485/);
    click(pop.querySelector('[aria-label="Close"]'));
    expect(host.querySelector('.sm-estimate-pop')).toBeNull();
  });

  it('health outcomes shows the KRS 7A.287 panel and plan results', () => {
    const host = render(<SimplePage view="simple-outcomes" />);
    expect(host.textContent).toContain('KRS 7A.287');
    expect(host.querySelectorAll('.sm-statute-tag')).toHaveLength(6);
    expect(host.querySelector('#by-plan table tbody tr')).toBeTruthy();
    expect(host.querySelectorAll('.sm-estimate-chip').length).toBeGreaterThan(0);
  });

  it('plans page shows all plans side by side with Anthem marked as exited', () => {
    const host = render(<SimplePage view="simple-plans" />);
    const rows = host.querySelectorAll('.sm-scorecard tbody tr');
    expect(rows).toHaveLength(6);
    expect(rows[rows.length - 1].textContent).toMatch(/Anthem/);
    expect(host.querySelector('tr.is-exited')).toBeTruthy();
  });

  it('waiver page shows each waiver and a county map', () => {
    const host = render(<SimplePage view="simple-waivers" />);
    expect(host.textContent).toContain('Michelle P');
    expect(host.querySelectorAll('path.sm-map-county')).toHaveLength(120);
  });

  it('county page opens on the focused county and returns to statewide', () => {
    const host = render(<SimplePage view="simple-county" focusFips="21111" />);
    expect(host.querySelectorAll('path.sm-map-county')).toHaveLength(120);
    expect(host.querySelector('.sm-county-panel h3').textContent).toBe('Jefferson County');
    click([...host.querySelectorAll('.sm-county-panel button')].find((b) => b.textContent === 'Back to statewide'));
    expect(host.querySelector('.sm-county-panel h3').textContent).toBe('Statewide');
  });

  it('district page lists a district’s counties and its legislator', () => {
    const host = render(<SimplePage view="simple-district" />);
    expect(host.textContent).toMatch(/House District 1/);
    expect(host.querySelectorAll('table[aria-label="Counties in this district"] tbody tr').length).toBeGreaterThan(0);
    expect(host.querySelectorAll('path.sm-map-county.is-dimmed').length).toBeGreaterThan(100);
  });
});

describe('My district map', () => {
  it('selects a district by clicking a county, lists split districts, and switches chamber', () => {
    const host = render(<SimplePage view="simple-district" />);
    const title = () => host.querySelector('.sm-section-head h2').textContent;
    click(host.querySelector('path[data-fips="21111"]'));
    const chips = host.querySelectorAll('.sm-split-options .sm-chip');
    expect(chips.length).toBeGreaterThan(5);
    expect(host.querySelector('.sm-split-note').textContent).toMatch(/Jefferson County is split among/);
    expect(title()).toMatch(/House District/);
    click(chips[1]);
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
    const senate = [...host.querySelectorAll('.sm-segmented button')].find((b) => b.textContent.startsWith('Senate'));
    click(senate);
    expect(senate.getAttribute('aria-checked')).toBe('true');
    expect(title()).toMatch(/Senate District/);
    expect(host.querySelector('.sm-split-note').textContent).toMatch(/Senate districts/);
    click(host.querySelector('path[data-fips="21001"]'));
    expect([...host.querySelectorAll('table[aria-label="Counties in this district"] th[scope="row"]')].map((th) => th.textContent)).toContain('Adair');
  });
});

describe('StateLanding simple-mode entry', () => {
  it('requests Kentucky with the simple-home entry view', () => {
    const onSelectState = vi.fn();
    const host = render(<StateLanding onSelectState={onSelectState} />);
    click([...host.querySelectorAll('a')].find((a) => a.textContent.includes('Open the simple view')));
    expect(onSelectState).toHaveBeenLastCalledWith('KY', { entryView: 'simple-home' });
    expect(host.querySelector('a[href="?state=KY&view=simple"]')).toBeTruthy();
  });
});

describe('Data age (subcommittee item #3)', () => {
  it('shows a data-age badge on every dashboard tile', () => {
    const host = render(<SimpleHome />);
    const tiles = [...host.querySelectorAll('.sm-tile')];
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) expect(tile.querySelector('.sm-age')).not.toBeNull();
  });

  it.each(PAGE_VIEWS.filter((v) => !['simple-home', 'simple-county', 'simple-district', 'simple-states', 'simple-hospitals', 'simple-rates'].includes(v)))('%s shows the page freshness line and badges on cards', (view) => {
    const host = render(<SimplePage view={view} />);
    expect(host.querySelector('.sm-freshness')?.textContent).toMatch(/Latest published data/);
    const cards = [...host.querySelectorAll('.sm-measure[data-measure-id]')];
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.querySelector('.sm-age'))).toBe(true);
  });
});

describe('Navigation (subcommittee item #18)', () => {

  it('keeps the Who / Where filters when the page is left and reopened', () => {
    let host = render(<SimplePage view="simple-access" />);
    const where = host.querySelectorAll('.sm-filters select')[1];
    const option = [...where.options].find((o) => o.value.startsWith('house:'));
    change(where, option.value);
    document.body.innerHTML = '';
    host = render(<SimplePage view="simple-outcomes" />);
    expect(host.querySelectorAll('.sm-filters select')[1].value).toBe(option.value);
  });

  it('says plainly when a selected district has no local figures on the page', () => {
    const host = render(<SimplePage view="simple-access" />);
    const where = host.querySelectorAll('.sm-filters select')[1];
    change(where, [...where.options].find((o) => o.value.startsWith('house:')).value);
    document.body.innerHTML = '';
    const outcomes = render(<SimplePage view="simple-plans" />);
    expect(outcomes.querySelector('.sm-scope-note')?.textContent).toMatch(/every figure on this page is statewide or by health plan/);
  });

  it('names the plans tab plainly', () => {
    expect(SIMPLE_TABS.find((t) => t.view === 'simple-plans').label).toBe('Health plans (MCOs)');
  });
});

describe('My targets, demo mode (subcommittee item #7)', () => {
  function input(el, value) {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('says targets are browser-only drafts when no sign-in is configured', () => {
    const host = render(<SimplePage view="simple-outcomes" />);
    expect(host.querySelector('.sm-account-bar')?.textContent).toMatch(/Demo mode/);
    expect(host.querySelector('.sm-account-bar')?.textContent).not.toMatch(/Sign in/);
  });

  it('sets, shows and removes a draft target on a measure card', async () => {
    const host = render(<SimplePage view="simple-outcomes" />);
    const line = host.querySelector('.sm-my-target');
    const id = line.getAttribute('data-my-target');
    expect(line.textContent).toMatch(/My target \(draft\)/);
    await act(async () => { line.querySelector('button').click(); });
    input(line.querySelector('input'), '150');
    await act(async () => { line.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(line.querySelector('[role="alert"]')?.textContent).toMatch(/between 0 and 100/);
    input(line.querySelector('input'), '60');
    await act(async () => { line.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(line.textContent).toMatch(/60%/);
    expect(JSON.parse(localStorage.getItem('decisionpro.simple.draftTargets'))[id].value).toBe(60);
    await act(async () => { [...line.querySelectorAll('button')].find((b) => b.textContent === 'Change').click(); });
    await act(async () => { [...line.querySelectorAll('button')].find((b) => b.textContent === 'Remove').click(); });
    expect(line.textContent).toMatch(/Set my target/);
  });
});

describe('Compare states (subcommittee item #20)', () => {
  it('ranks every reporting state on a KRS 7A.287 measure and highlights Kentucky and peers', async () => {
    const host = render(<SimplePage view="simple-states" />);
    await act(async () => { await import('./simpleMode/lazy/coresetStates.generated.js'); await new Promise((r) => setTimeout(r, 0)); });
    const section = host.querySelector('[data-states-measure]');
    expect(section).not.toBeNull();
    expect(section.textContent).toMatch(/KRS 7A\.287/);
    expect(section.querySelector('li.is-ky[data-state="KY"]')).not.toBeNull();
    expect(section.querySelectorAll('li.is-peer').length).toBeGreaterThan(0);
    expect(section.querySelectorAll('.sm-state-bars li').length).toBeGreaterThan(20);
    expect(section.querySelector('.sm-age')).not.toBeNull();
  });
});

describe('How it is measured (subcommittee item #14)', () => {
  it('opens a measure’s method, inclusions and source context in a pop-up, not inline', () => {
    const host = render(<SimplePage view="simple-spending" />);
    const card = [...host.querySelectorAll('.sm-measure')].find((c) => c.querySelector('.sm-method-btn'));
    expect(card.textContent).not.toMatch(/How it’s measured/);
    click(card.querySelector('.sm-method-btn'));
    expect(card.querySelector('.sm-estimate-pop')?.textContent).toMatch(/How it’s measured/);
  });

  it('sets a figure someone else published beside DecisionPro’s, labeled unverified', () => {
    const host = render(<SimplePage view="simple-spending" />);
    const card = host.querySelector('.sm-measure[data-measure-id="total-medicaid-spending"]');
    click(card.querySelector('.sm-method-btn'));
    click([...card.querySelectorAll('button')].find((b) => /Compare with a figure/.test(b.textContent)));
    const [value, publisher] = card.querySelectorAll('.sm-other-figure input');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(value, '20000000000'); value.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(publisher, 'Hospital association'); publisher.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { card.querySelector('.sm-other-figure form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    const side = card.querySelector('[data-reconcile="total-medicaid-spending"]');
    expect(side.textContent).toMatch(/Hospital association/);
    expect(side.textContent).toMatch(/not verified/);
  });
});

describe('Contracts and spending drivers (subcommittee items #10, #13)', () => {
  async function settle() { await act(async () => { await import('./simpleMode/lazy/contracts.generated.js'); await new Promise((r) => setTimeout(r, 0)); }); }

  it('lists every contract with its spending, funding split and whether an outcome is defined', async () => {
    const host = render(<SimplePage view="simple-plans" />);
    click(host.querySelector('[data-subtab="contract-ledger"]'));
    await settle();
    const ledger = host.querySelector('[data-ledger]');
    expect(ledger.querySelectorAll('tr[data-contract]').length).toBeGreaterThanOrEqual(20);
    expect(ledger.textContent).toMatch(/No outcome defined/);
    expect(ledger.textContent).not.toMatch(/waste|fraud|breach/i);
    click(ledger.querySelector('tr[data-contract] .sm-link'));
    expect(ledger.querySelector('.sm-ledger-detail')).not.toBeNull();
  });

  it('breaks spending change into enrollment, mix, price and utilization', async () => {
    const host = render(<SimplePage view="simple-spending" />);
    click(host.querySelector('[data-subtab="drivers-breakdown"]'));
    await settle();
    const drivers = host.querySelector('[data-drivers]');
    expect(drivers.querySelectorAll('.sm-drivers li').length).toBeGreaterThanOrEqual(4);
    expect(drivers.textContent).toMatch(/while members fell/);
  });
});

describe('Local views (subcommittee items #1, #8, #23)', () => {
  async function settle() {
    await act(async () => {
      await import('./simpleMode/lazy/local.generated.js');
      await import('../data/alp/kyZctaShapes.js');
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }

  it('builds an area from several zip codes, adds up its figures and makes it the place filter', async () => {
    const host = render(<SimplePage view="simple-county" />);
    click(host.querySelector('[data-subtab="zips"]'));
    await settle();
    const map = host.querySelector('[data-zip-map]');
    expect(map.querySelectorAll('path[data-zcta]').length).toBeGreaterThan(700);
    for (const zip of ['40203', '40211', '40212']) click(map.querySelector(`path[data-zcta="${zip}"]`));
    const panel = map.querySelector('[data-zip-selection]');
    expect(panel.textContent).toMatch(/3 zip codes/);
    expect(panel.textContent).toMatch(/Jefferson/);
    expect(panel.querySelectorAll('.sm-zip-table tbody tr').length).toBe(3);
    click([...panel.querySelectorAll('button')].find((b) => /Use these zip codes/.test(b.textContent)));
    expect(host.querySelectorAll('.sm-filters select')[1].selectedOptions[0].textContent).toMatch(/3 zip codes/);
  });

  it('never shows a zip-code member count from 1 to 10', async () => {
    const host = render(<SimplePage view="simple-county" />);
    click(host.querySelector('[data-subtab="zips"]'));
    await settle();
    const map = host.querySelector('[data-zip-map]');
    click(map.querySelector('path[data-zcta="38079"]'));
    const cells = [...map.querySelectorAll('.sm-zip-table td.is-num')].map((td) => td.textContent);
    expect(cells.every((t) => !/^([1-9]|10)$/.test(t))).toBe(true);
  });

  it('shows local CDC estimates for a selected district beside statewide Medicaid figures', async () => {
    sessionStorage.setItem('decisionpro.simple.filters', JSON.stringify({ population: 'all', geo: { kind: 'house', key: HOUSE_DISTRICTS[0].key } }));
    const host = render(<SimplePage view="simple-outcomes" anchor="local" />);
    await settle();
    const table = host.querySelector('[data-local-outcomes]');
    expect(table.textContent).toMatch(/all adults living there/);
    expect(table.querySelector('[data-local-measure="mammography"]').textContent).toMatch(/%/);
  });

  it('compares an access measure across vulnerability quarters of counties', async () => {
    const host = render(<SimplePage view="simple-access" anchor="vulnerability" />);
    await settle();
    const svi = host.querySelector('[data-svi-compare]');
    expect(svi.querySelectorAll('[data-svi-quartile]').length).toBe(4);
    expect(svi.querySelectorAll('circle.sm-dot').length).toBeGreaterThan(100);
  });
});


describe('Hospitals (subcommittee items #9, #2)', () => {
  it('shows margins in thirds, commercial prices against Medicare and every hospital', async () => {
    const host = render(<SimplePage view="simple-hospitals" />);
    await act(async () => { await import('./simpleMode/lazy/hospitals.generated.js'); await new Promise((r) => setTimeout(r, 0)); });
    expect(host.querySelectorAll('[data-hospital-margins] [data-tier]').length).toBe(3);
    click(host.querySelector('[data-subtab="prices"]'));
    expect(host.querySelector('[data-hospital-prices] li.is-ky[data-state="KY"]')).not.toBeNull();
    expect(host.querySelector('[data-hospital-prices]').textContent).toMatch(/Needs Kentucky claims data/);
    click(host.querySelector('[data-subtab="list"]'));
    expect(host.querySelectorAll('[data-hospital-list] tr[data-ccn]').length).toBeGreaterThan(80);
    expect(host.textContent).not.toMatch(/distress|waste|fraud/i);
  });
});

describe('Rural access and payment scenario (subcommittee items #12, #6)', () => {
  it('shows rural facts, shortage designations by type, and a working scenario', async () => {
    const host = render(<SimplePage view="simple-access" anchor="rural" />);
    await act(async () => { await import('./simpleMode/lazy/rural.generated.js'); await new Promise((r) => setTimeout(r, 0)); });
    const rural = host.querySelector('[data-rural]');
    expect(rural.textContent).toMatch(/living in rural areas/);
    expect(rural.textContent).toMatch(/107 of 120/);
    click(host.querySelector('[data-subtab="scenario"]'));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const scenario = host.querySelector('[data-scenario]');
    const before = scenario.textContent;
    const slider = scenario.querySelector('input[type="range"]');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, '15');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(scenario.textContent).toMatch(/15%/);
    expect(scenario.textContent).not.toBe(before);
    expect(scenario.textContent).toMatch(/not a forecast/);
  });
});

describe('Payment rates (subcommittee items #22, #24, #11)', () => {
  it('shows Medicare by payment area, Medicaid as a percent of Medicare like for like, and spreads', async () => {
    const host = render(<SimplePage view="simple-rates" />);
    await act(async () => { await import('./simpleMode/lazy/fees.generated.js'); await new Promise((r) => setTimeout(r, 0)); });
    const medicare = host.querySelector('[data-medicare-by-state]');
    expect(medicare.querySelector('li.is-ky')).not.toBeNull();
    expect(medicare.textContent).toMatch(/practice costs/);
    click(host.querySelector('[data-subtab="medicaid"]'));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const medicaid = host.querySelector('[data-medicaid-vs-medicare]');
    expect(medicaid.querySelector('tr[data-fee-state="KY"]')).not.toBeNull();
    expect(medicaid.textContent).toMatch(/never charges/);
    click(host.querySelector('[data-subtab="spread"]'));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(host.querySelectorAll('[data-payment-spread] .sm-measure').length).toBe(4);
  });
});

describe('Procedure codes across states (subcommittee item #21)', () => {
  it('ranks the states with usable data on what Medicaid paid per claim line, and lists those left out', async () => {
    const host = render(<SimplePage view="simple-rates" anchor="codes" />);
    await act(async () => { await import('./simpleMode/lazy/tmsis.generated.js'); await new Promise((r) => setTimeout(r, 0)); });
    const t = host.querySelector('[data-tmsis]');
    expect(t.querySelectorAll('.sm-state-bars li').length).toBeGreaterThan(40);
    expect(t.querySelector('li.is-ky[data-state="KY"]')).not.toBeNull();
    expect(t.querySelectorAll('li.is-grey').length).toBe(0);
    expect(t.textContent).toMatch(/Not compared:.*CMS rates its data unusable/);
    expect(t.textContent).toMatch(/claim lines/);
  });
});

describe('Sub-tabs and the horizontal state view', () => {
  it('puts each newer analysis on its own sub-tab, with the original sections as Overview', () => {
    const host = render(<SimplePage view="simple-access" />);
    const tabs = [...host.querySelectorAll('[data-subtab]')].map((b) => b.textContent);
    expect(tabs).toEqual(['Overview', 'Rural Kentucky', 'Payment scenario', 'Social vulnerability']);
    expect(host.querySelector('#shortages')).not.toBeNull();
    expect(host.querySelector('#rural')).toBeNull();
    click(host.querySelector('[data-subtab="rural"]'));
    expect(host.querySelector('#rural')).not.toBeNull();
    expect(host.querySelector('#shortages')).toBeNull();
  });

  it('opens the sub-tab that holds a tile’s anchor', () => {
    const host = render(<SimplePage view="simple-spending" anchor="pharmacy" />);
    expect(host.querySelector('[data-subtab="overview"]').getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('#pharmacy')).not.toBeNull();
  });

  it('shows every state as a column above the long ranked list', async () => {
    const host = render(<SimplePage view="simple-states" />);
    await act(async () => { await import('./simpleMode/lazy/coresetStates.generated.js'); await new Promise((r) => setTimeout(r, 0)); });
    const columns = host.querySelector('[data-state-columns]');
    const list = host.querySelector('.sm-state-bars');
    expect(columns.querySelectorAll('g[data-state]').length).toBe(list.querySelectorAll('li').length);
    expect(columns.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(columns.querySelector('g.is-ky[data-state="KY"]')).not.toBeNull();
  });
});

describe('Sub-tabs in the left nav', () => {
  it('lists each page’s sub-tabs for the nav, Overview first where the page has original sections', async () => {
    const { SIMPLE_SUBTABS } = await import('../components/SimpleHome.jsx');
    expect(SIMPLE_SUBTABS['simple-access'].map((t) => t.label)).toEqual(['Overview', 'Rural Kentucky', 'Payment scenario', 'Social vulnerability']);
    expect(SIMPLE_SUBTABS['simple-rates'].map((t) => t.id)).toEqual(['medicare', 'medicaid', 'spread', 'deprivation', 'codes']);
    expect(SIMPLE_SUBTABS['simple-hospitals']).toHaveLength(5);
    expect(SIMPLE_SUBTABS['simple-county'].map((t) => t.id)).toEqual(['counties', 'zips']);
    expect(SIMPLE_SUBTABS['simple-home']).toBeUndefined();
  });

  it('opens the hospital and county sub-tab a nav anchor names, and reports pill clicks back', async () => {
    const seen = [];
    const host = render(<SimplePage view="simple-hospitals" anchor="list" onSubtabChange={(id) => seen.push(id)} />);
    await act(async () => { await import('./simpleMode/lazy/hospitals.generated.js'); await new Promise((r) => setTimeout(r, 0)); });
    expect(host.querySelector('[data-subtab="list"]').getAttribute('aria-selected')).toBe('true');
    click(host.querySelector('[data-subtab="prices"]'));
    expect(seen).toEqual(['prices']);
    document.body.innerHTML = '';
    const county = render(<SimplePage view="simple-county" anchor="zips" />);
    expect(county.querySelector('[data-subtab="zips"]').getAttribute('aria-selected')).toBe('true');
  });
});

describe('Explainer prompt (Director request 2026-10-28)', () => {
  beforeEach(() => sessionStorage.removeItem('decisionpro.explainers.off'));

  it('offers the explainer the first time a sub-tab with a new function opens, once per session', () => {
    let host = render(<SimplePage view="simple-access" anchor="rural" />);
    const dialog = host.querySelector('[data-explainer="rural-kentucky"]');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.textContent).toMatch(/Would you like to watch/);
    click(host.querySelector('[data-explainer-later]'));
    expect(host.querySelector('[data-explainer]')).toBeNull();
    document.body.innerHTML = '';
    host = render(<SimplePage view="simple-access" anchor="rural" />);
    expect(host.querySelector('[data-explainer]')).toBeNull();
    expect(host.querySelector('[data-explainer-launch="rural-kentucky"]')).not.toBeNull();
  });

  it('never offers again after "Don’t show again", even in a new session', () => {
    let host = render(<SimplePage view="simple-states" />);
    click(host.querySelector('[data-explainer-never]'));
    sessionStorage.clear();
    document.body.innerHTML = '';
    host = render(<SimplePage view="simple-states" />);
    expect(host.querySelector('[data-explainer]')).toBeNull();
  });

  it('plays the video in the dialog, and pages without a new function show no prompt', () => {
    let host = render(<SimplePage view="simple-rates" />);
    click(host.querySelector('[data-explainer-watch="medicare-by-state"]'));
    expect(host.querySelector('video.sm-explainer-video').getAttribute('src')).toBe('explainers/decisionpro-medicare-by-state.mp4');
    document.body.innerHTML = '';
    host = render(<SimplePage view="simple-waivers" />);
    expect(host.querySelector('[data-explainer]')).toBeNull();
    expect(host.querySelector('[data-explainer-launch]')).toBeNull();
  });

  it('offers the three card videos on At a glance', () => {
    const host = render(<SimplePage view="simple-home" />);
    expect([...host.querySelectorAll('[data-explainer-watch]')].map((b) => b.dataset.explainerWatch)).toEqual(['data-age', 'how-measured', 'my-target']);
  });
});

describe('Hospital data fixes', () => {
  it('finds UofL Hospital under Jefferson County and shows thirds that add to 100%', async () => {
    const host = render(<SimplePage view="simple-hospitals" anchor="list" />);
    await act(async () => { await import('./simpleMode/lazy/hospitals.generated.js'); await new Promise((r) => setTimeout(r, 0)); });
    const search = host.querySelector('.sm-hosp-search');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'Jefferson');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.querySelector('[data-hospital-list]').textContent).toMatch(/University Of Louisville Hospital/);
    expect(host.querySelector('[data-hospital-list]').textContent).not.toMatch(/Mc Cracken|Deaconessmadisonville/);
    click(host.querySelector('[data-subtab="margins"]'));
    const shares = [...host.querySelectorAll('[data-tier] small')].map((s) => Number(s.textContent.match(/(\d+)%/)[1]));
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('Payment rates fixes', () => {
  it('opens a code posted only unsplit in that setting, and shows no Medicare rate instead of $0', async () => {
    const host = render(<SimplePage view="simple-rates" anchor="medicaid" />);
    await act(async () => { await import('./simpleMode/lazy/fees.generated.js'); await new Promise((r) => setTimeout(r, 0)); });
    const box = host.querySelector('[data-medicaid-vs-medicare]');
    change(box.querySelector('select'), '97153');
    expect(box.querySelectorAll('tr[data-fee-state]').length).toBeGreaterThan(0);
    expect(box.querySelector('[role="radio"][aria-checked="true"]').textContent).toBe('Not split');
    change(box.querySelector('select'), 'H0004');
    expect(box.textContent).not.toMatch(/\$0\.00/);
    change(box.querySelector('select'), '90837');
    expect(box.textContent).not.toMatch(/col\d/);
  });
});
