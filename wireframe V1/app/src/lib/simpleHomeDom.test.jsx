/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIMPLE_TABS, SimpleHome, SimplePage } from '../components/SimpleHome.jsx';
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

describe('Simple view tabs', () => {
  it('lists six tabs in order', () => {
    expect(SIMPLE_TABS.map((t) => t.label)).toEqual([
      'At a glance', 'Plan consolidation', 'Medicaid in my county', 'Waiver waitlists', 'Behavioral health', 'My district',
    ]);
  });

  it('At a glance shows only the headlines and topic chips', () => {
    const host = render(<SimpleHome />);
    expect(host.querySelectorAll('.sm-tile')).toHaveLength(6);
    expect(host.querySelector('path.sm-map-county')).toBeNull();
    expect(host.querySelector('.sm-table')).toBeNull();
    expect(host.textContent).toContain('Medicaid members counted by county');
  });

  it('topic chips and tiles navigate to their tabs', () => {
    const onNavigate = vi.fn();
    const host = render(<SimpleHome onNavigate={onNavigate} />);
    const chip = (label) => [...host.querySelectorAll('.sm-chip')].find((b) => b.textContent === label);
    click(chip('Plan consolidation'));
    expect(onNavigate).toHaveBeenLastCalledWith('simple-plans', undefined);
    click(chip('Waiver waitlists'));
    expect(onNavigate).toHaveBeenLastCalledWith('simple-waivers', undefined);
    click(chip('My district'));
    expect(onNavigate).toHaveBeenLastCalledWith('simple-district', undefined);
    click(host.querySelector('[data-tile-id="county-most"] .sm-tile-body'));
    expect(onNavigate).toHaveBeenLastCalledWith('simple-county', { focusFips: '21111' });
  });

  it('pins a tile first and remembers it in this browser', () => {
    const host = render(<SimpleHome />);
    click(host.querySelector('[data-tile-id="county-fewest"] .sm-pin'));
    expect(host.querySelector('.sm-tile').dataset.tileId).toBe('county-fewest');
    expect(JSON.parse(localStorage.getItem(PINNED_TILES_STORAGE_KEY))).toEqual(['county-fewest']);
  });

  it('county page opens on the focused county and returns to statewide', () => {
    const host = render(<SimplePage view="simple-county" focusFips="21111" />);
    expect(host.querySelectorAll('path.sm-map-county')).toHaveLength(120);
    expect(host.querySelector('.sm-county-panel h3').textContent).toBe('Jefferson County');
    click([...host.querySelectorAll('.sm-county-panel button')].find((b) => b.textContent === 'Back to statewide'));
    expect(host.querySelector('.sm-county-panel h3').textContent).toBe('Statewide');
    expect(host.querySelector('[data-gap-id="gap-demographics"]')).toBeTruthy();
  });

  it('plans page offers only comparable measures and shows flags', () => {
    const onBrowseSources = vi.fn();
    const host = render(<SimplePage view="simple-plans" onBrowseSources={onBrowseSources} />);
    const options = [...host.querySelectorAll('.sm-mco-sort option')].map((o) => o.value);
    expect(options).toContain('enrollment');
    expect(options).not.toContain('appealsPer1k');
    expect(options).not.toContain('premiumPerEnrollee');
    expect(host.querySelector('.sm-flag').textContent).toMatch(/Check before comparing/);
    expect(host.textContent).not.toMatch(/top 3/i);
    click(host.querySelector('.sm-source button'));
    expect(onBrowseSources).toHaveBeenCalledWith('CMS_MCPAR');
  });

  it('public waiver, behavioral health and district pages show gap cards', () => {
    expect(render(<SimplePage view="simple-waivers" review={false} />).querySelector('[data-gap-id="gap-waivers"]')).toBeTruthy();
    expect(render(<SimplePage view="simple-bh" review={false} />).querySelector('[data-gap-id="gap-behavioral-health"]')).toBeTruthy();
    const district = render(<SimplePage view="simple-district" />);
    expect(district.querySelector('[data-gap-id="gap-districts"]')).toBeTruthy();
    expect(district.querySelector('[data-gap-id="gap-add"]')).toBeTruthy();
  });
});

describe('Simple view review build', () => {
  it('is off by default and shows no review content', () => {
    const host = render(<SimplePage view="simple-plans" />);
    expect(host.querySelector('.sm-review-banner')).toBeNull();
    expect(host.textContent).not.toMatch(/Top 3|entered by hand/i);
  });

  it('shows the banner, hand-entered tiles, waivers, behavioral health and a top-3 ranking', () => {
    const home = render(<SimpleHome review />);
    expect(home.querySelector('.sm-review-banner').textContent).toMatch(/not for distribution/);
    expect(home.querySelector('[data-tile-id="review-plans-today"] .sm-tile-value').textContent).toBe('5');
    const plans = render(<SimplePage view="simple-plans" review />);
    expect(plans.querySelectorAll('.sm-top3')).toHaveLength(3);
    expect([...plans.querySelectorAll('tr.is-exited')].map((tr) => tr.textContent)).toEqual([expect.stringMatching(/Anthem/)]);
    expect(render(<SimplePage view="simple-waivers" review />).textContent).toContain('Michelle P. Waiver');
    expect(render(<SimplePage view="simple-bh" review />).textContent).toContain('$2.30 billion');
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
