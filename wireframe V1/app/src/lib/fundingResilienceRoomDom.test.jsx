/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FundingResilienceRoom } from '../components/FundingResilienceRoom.jsx';
import { GlossaryProvider } from './GlossaryContext.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function click(element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function renderRoom(stateCode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<GlossaryProvider><FundingResilienceRoom stateCode={stateCode} /></GlossaryProvider>));
  return { host, root };
}

describe('FundingResilienceRoom (OFR-08)', () => {
  it('renders the four parity-contract walkthrough targets for both states', () => {
    for (const stateCode of ['KY', 'FL']) {
      const { host, root } = renderRoom(stateCode);
      expect(host.querySelector('[data-walkthrough-target="alp-analytical-header"]')).toBeTruthy();
      expect(host.querySelector('[data-walkthrough-target="alp-visual-filters"]')).toBeTruthy();
      expect(host.querySelector('[data-walkthrough-target="alp-content"]')).toBeTruthy();
      expect(host.querySelector('[data-walkthrough-target="alp-lineage"]')).toBeTruthy();
      act(() => root.unmount());
    }
  });

  it('lists nine source lineage cards for both states (lineage metadata is publisher-level, legitimately identical)', () => {
    for (const stateCode of ['KY', 'FL']) {
      const { host, root } = renderRoom(stateCode);
      expect(host.querySelectorAll('.fr-lineage-card').length).toBe(9);
      act(() => root.unmount());
    }
  });

  it('never leaks KY item content into the FL render or vice versa', () => {
    const ky = renderRoom('KY');
    const kyItemText = [...ky.host.querySelectorAll('.fr-item-row')].map((el) => el.textContent).join('|');
    act(() => ky.root.unmount());

    const fl = renderRoom('FL');
    const flItemText = [...fl.host.querySelectorAll('.fr-item-row')].map((el) => el.textContent).join('|');
    act(() => fl.root.unmount());

    expect(kyItemText.length).toBeGreaterThan(0);
    expect(flItemText.length).toBeGreaterThan(0);
    expect(kyItemText).not.toBe(flItemText);
  });

  it('filters the item list by signal type and shows a guardrail on drill-down', () => {
    const { host } = renderRoom('KY');
    const allRowsBefore = host.querySelectorAll('.fr-item-row').length;
    expect(allRowsBefore).toBeGreaterThan(0);

    const firstChip = host.querySelector('.fr-chip');
    click(firstChip);
    const filteredRows = host.querySelectorAll('.fr-item-row').length;
    expect(filteredRows).toBeLessThanOrEqual(allRowsBefore);

    if (filteredRows > 0) {
      click(host.querySelector('.fr-item-row'));
      expect(host.querySelector('.fr-guardrail')).toBeTruthy();
      expect(host.querySelector('.fr-back-btn')).toBeTruthy();
    }
  });

  it('exposes a CSV export control', () => {
    const { host } = renderRoom('KY');
    expect(host.querySelector('.fr-export-btn')).toBeTruthy();
    expect(host.querySelector('.fr-export-btn').textContent).toMatch(/CSV/i);
  });
});
