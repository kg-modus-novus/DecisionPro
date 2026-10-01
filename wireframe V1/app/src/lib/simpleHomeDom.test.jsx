/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleHome } from '../components/SimpleHome.jsx';
import { StateLanding } from '../components/StateLanding.jsx';
import { PINNED_TILES_STORAGE_KEY } from './simpleMode/pinnedTiles.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

describe('SimpleHome', () => {
  it('renders headlines, a 120-county map, the plan table and gap cards', () => {
    const host = render(<SimpleHome onOpenFullWorkspace={() => {}} onBrowseSources={() => {}} />);
    expect(host.querySelectorAll('.sm-tile')).toHaveLength(6);
    expect(host.querySelectorAll('path.sm-map-county')).toHaveLength(120);
    expect(host.querySelectorAll('.sm-table tbody tr')).toHaveLength(6);
    expect(host.querySelectorAll('.sm-gap').length).toBeGreaterThanOrEqual(5);
    expect(host.textContent).toContain('Medicaid members counted by county');
  });

  it('opens a county breakdown and returns to statewide', () => {
    const host = render(<SimpleHome />);
    click(host.querySelector('path[data-fips="21111"]'));
    expect(host.querySelector('.sm-county-panel h3').textContent).toBe('Jefferson County');
    click([...host.querySelectorAll('.sm-county-panel button')].find((b) => b.textContent === 'Back to statewide'));
    expect(host.querySelector('.sm-county-panel h3').textContent).toBe('Statewide');
  });

  it('pins a tile first and remembers it in this browser', () => {
    const host = render(<SimpleHome />);
    const pin = host.querySelector('[data-tile-id="county-fewest"] .sm-pin');
    click(pin);
    expect(host.querySelector('.sm-tile').dataset.tileId).toBe('county-fewest');
    expect(JSON.parse(localStorage.getItem(PINNED_TILES_STORAGE_KEY))).toEqual(['county-fewest']);
  });

  it('only offers comparable measures for ordering', () => {
    const host = render(<SimpleHome />);
    const options = [...host.querySelectorAll('.sm-mco-sort option')].map((o) => o.value);
    expect(options).toContain('enrollment');
    expect(options).not.toContain('appealsPer1k');
    expect(options).not.toContain('premiumPerEnrollee');
    expect(options).not.toContain('mlrPercent');
    expect(host.querySelector('.sm-flag').textContent).toMatch(/Check before comparing/);
    expect(host.textContent).not.toMatch(/top 3|best plan|worst plan/i);
  });

  it('routes source links and the full-workspace button', () => {
    const onBrowseSources = vi.fn();
    const onOpenFullWorkspace = vi.fn();
    const host = render(<SimpleHome onBrowseSources={onBrowseSources} onOpenFullWorkspace={onOpenFullWorkspace} />);
    click([...host.querySelectorAll('.sm-source button')][0]);
    expect(onBrowseSources).toHaveBeenCalledWith('KY_DMS_COUNTY_COUNTS');
    click(host.querySelector('.sm-cta'));
    expect(onOpenFullWorkspace).toHaveBeenCalled();
  });
});

describe('SimpleHome review build', () => {
  it('is off by default and shows no review content', () => {
    const host = render(<SimpleHome />);
    expect(host.querySelector('.sm-review-banner')).toBeNull();
    expect(host.textContent).not.toMatch(/Top 3|entered by hand/i);
  });

  it('shows the draft banner, hand-entered tiles, waivers and a top-3 ranking', () => {
    const host = render(<SimpleHome review />);
    expect(host.querySelector('.sm-review-banner').textContent).toMatch(/not for distribution/);
    expect(host.querySelector('[data-tile-id="review-plans-today"] .sm-tile-value').textContent).toBe('5');
    expect(host.textContent).toContain('Michelle P. Waiver');
    expect(host.querySelectorAll('.sm-top3')).toHaveLength(3);
    expect([...host.querySelectorAll('tr.is-exited')].map((tr) => tr.textContent)).toEqual([expect.stringMatching(/Anthem/)]);
    expect(host.querySelector('[data-gap-id="gap-waivers"]')).toBeNull();
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
