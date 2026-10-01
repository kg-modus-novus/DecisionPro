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

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.CSS = globalThis.CSS || { escape: (s) => s };

beforeEach(() => localStorage.clear());
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
      'At a glance', 'Access to care', 'Spending', 'Health outcomes', 'Plans and providers', 'Waiver waitlists',
      'Long-term care', 'Behavioral health', 'Who is covered', 'Medicaid in my county', 'My district',
    ]);
  });

  it.each(PAGE_VIEWS)('%s renders with no "not loaded yet" or "entered by hand" text', (view) => {
    const host = render(<SimplePage view={view} />);
    expect(host.querySelector('h1').textContent.length).toBeGreaterThan(5);
    expect(host.textContent).not.toMatch(/not loaded yet|entered by hand/i);
    expect(host.querySelector('.sm-gap')).toBeNull();
  });

  it.each(PAGE_VIEWS.filter((v) => !['simple-home', 'simple-county', 'simple-district'].includes(v)))('%s shows sourced measure cards', (view) => {
    const host = render(<SimplePage view={view} />);
    const cards = host.querySelectorAll('.sm-measure');
    expect(cards.length).toBeGreaterThan(3);
    for (const card of cards) expect(card.querySelector('.sm-source a'), card.dataset.measureId).toBeTruthy();
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

describe('StateLanding simple-mode entry', () => {
  it('requests Kentucky with the simple-home entry view', () => {
    const onSelectState = vi.fn();
    const host = render(<StateLanding onSelectState={onSelectState} />);
    click([...host.querySelectorAll('a')].find((a) => a.textContent.includes('Open the simple view')));
    expect(onSelectState).toHaveBeenLastCalledWith('KY', { entryView: 'simple-home' });
    expect(host.querySelector('a[href="?state=KY&view=simple"]')).toBeTruthy();
  });
});
