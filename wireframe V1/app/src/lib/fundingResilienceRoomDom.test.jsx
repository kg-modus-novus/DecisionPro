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

  it('leads with a plain-language "how to use" guide before the technical detail', () => {
    const { host } = renderRoom('KY');
    const guide = host.querySelector('.fr-how-to-use');
    expect(guide).toBeTruthy();
    expect(guide.textContent).toMatch(/how to use this information/i);
    expect(guide.querySelectorAll('li').length).toBeGreaterThanOrEqual(3);
    expect(guide.textContent).toMatch(/review candidate/i);
    // The guide must render before the KPI/chart/filter section in document order.
    const summary = host.querySelector('.fr-summary');
    expect(guide.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('searches by name and clears via the clear-filters control', () => {
    const { host } = renderRoom('KY');
    const searchInput = host.querySelector('.fr-search-input');
    expect(searchInput).toBeTruthy();
    const allRowsBefore = host.querySelectorAll('.fr-item-row').length;

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(searchInput, 'zzz-no-such-organization-zzz');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.querySelectorAll('.fr-item-row').length).toBe(0);
    expect(host.textContent).toMatch(/no rows match/i);

    click(host.querySelector('.fr-clear-btn'));
    expect(host.querySelectorAll('.fr-item-row').length).toBe(allRowsBefore);
  });

  it('sorts by urgency (soonest deadline / worst ratio first) when the toggle is on', () => {
    const { host } = renderRoom('KY');
    const urgentToggle = [...host.querySelectorAll('.fr-toggle input[type="checkbox"]')][1];
    expect(urgentToggle).toBeTruthy();
    click(urgentToggle);
    // Sorting must not throw and must still render rows.
    expect(host.querySelectorAll('.fr-item-row').length).toBeGreaterThan(0);
  });

  it('applies a "how to use" quick action: filters, sorts, and scrolls to content', () => {
    const { host } = renderRoom('KY');
    const runwayBtn = [...host.querySelectorAll('.fr-how-to-use-btn')].find((b) => b.textContent.includes('Check funding runway'));
    expect(runwayBtn).toBeTruthy();
    click(runwayBtn);
    const activeChips = [...host.querySelectorAll('.fr-chip-active')].map((c) => c.textContent);
    expect(activeChips.some((t) => t.includes('Federal award expiration'))).toBe(true);
    expect(activeChips.some((t) => t.includes('Waiver / demonstration horizon event'))).toBe(true);
    const runway = host.querySelector('.fr-runway');
    expect(runway).toBeTruthy();
    expect(runway.textContent).toMatch(/sorted by soonest published end date/i);
    expect(runway.textContent).toMatch(/days left/i);
    expect(runway.textContent).toMatch(/You have \d+ USAspending transaction observation/i);
    expect(runway.textContent).toMatch(/Schedule an agency or recipient continuity check/i);
    expect(runway.textContent).not.toMatch(/FRI-TXN-/);
    expect(runway.textContent).toMatch(/◆/);
    expect(runway.textContent).toMatch(/kentucky cabinet for health and family services/i);
    expect(runway.textContent).toMatch(/publisher label: health services kentucky cabinet for/i);
    expect(runway.textContent).toMatch(/award amount/i);
    expect(runway.querySelectorAll('.fr-runway-row').length).toBeGreaterThan(0);
    const dates = [...runway.querySelectorAll('time')].map((time) => time.dateTime);
    expect(dates).toEqual([...dates].sort());

    click(runway.querySelector('.fr-runway-row'));
    expect(host.querySelector('.fr-object-fields').textContent).toMatch(/time remaining/i);
    expect(host.querySelector('.fr-object-fields').textContent).toMatch(/continuation/i);
    expect(host.querySelector('.fr-object-fields').textContent).toMatch(/collected public evidence/i);
  });

  it('exposes a CSV export control', () => {
    const { host } = renderRoom('KY');
    expect(host.querySelector('.fr-export-btn')).toBeTruthy();
    expect(host.querySelector('.fr-export-btn').textContent).toMatch(/CSV/i);
  });

  it('renders an interactive node-link graph and opens a connection into an action playbook', () => {
    const { host } = renderRoom('KY');
    const graph = host.querySelector('.fr-relationship-graph');
    expect(graph).toBeTruthy();
    expect(graph.textContent).toMatch(/what to look for/i);
    expect(graph.querySelector('.fr-network-svg')).toBeTruthy();
    expect(graph.querySelectorAll('.fr-network-node').length).toBeGreaterThan(1);
    expect(graph.querySelectorAll('.fr-network-edge-hit').length).toBeGreaterThan(0);
    expect(graph.querySelector('.fr-network-node-role').textContent).toMatch(/organization/i);
    expect(graph.querySelector('.fr-network-node-metric').textContent).toMatch(/funding shown/i);
    expect(graph.querySelector('.fr-network-meaning').textContent).toMatch(/not necessarily companies/i);
    expect(graph.querySelectorAll('select').length).toBe(2);

    const svg = graph.querySelector('.fr-network-svg');
    expect(svg.getAttribute('data-scale')).toBe('1.00');
    act(() => svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 100, clientY: 100 })));
    expect(Number(svg.getAttribute('data-scale'))).toBeGreaterThan(1);

    expect(graph.textContent).toMatch(/2 organization relationships/i);
    expect(graph.textContent).toMatch(/10 sub-award actions/i);

    click([...graph.querySelectorAll('.fr-network-node')].find((node) => /seven counties services/i.test(node.textContent)));
    expect(graph.querySelector('.fr-network-node.is-selected')).toBeTruthy();
    expect(graph.querySelector('.fr-network-selection')).toBeTruthy();
    expect(graph.querySelector('.fr-network-selection').textContent).toMatch(/6 sub-award actions from 1 prime organization/i);
    expect(graph.querySelector('.fr-network-selection').textContent).toMatch(/financial context/i);
    const evidenceTable = graph.querySelector('.fr-network-evidence table');
    expect(evidenceTable).toBeTruthy();
    expect([...evidenceTable.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['Action date', 'Amount', 'Prime award', 'Sub-award number']);
    expect(evidenceTable.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(evidenceTable.textContent).toMatch(/\$3,973,426/);
    expect(evidenceTable.textContent).toMatch(/PON2 729 2400003982/);
    expect(graph.querySelector('.fr-network-selection').textContent).toMatch(/kentucky cabinet for health and family services/i);
    expect(evidenceTable.textContent).not.toMatch(/health services kentucky cabinet for/i);

    click(graph.querySelector('.fr-network-edge-hit'));
    const playbook = host.querySelector('.fr-playbook');
    expect(playbook).toBeTruthy();
    expect(playbook.textContent).toMatch(/turn this evidence into action/i);
    expect(playbook.textContent).toMatch(/success measure/i);
    expect(playbook.querySelectorAll('ol li').length).toBeGreaterThanOrEqual(3);

    click([...graph.querySelectorAll('.fr-network-view-toggle button')].find((button) => button.textContent.includes('Accessible')));
    expect(graph.querySelectorAll('.fr-graph-edge').length).toBeGreaterThan(0);
  });
});
