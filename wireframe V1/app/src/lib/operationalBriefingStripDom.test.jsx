/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationalIntelligence } from '../components/OperationalIntelligence.jsx';
import { GlossaryModal } from '../components/GlossaryModal.jsx';
import { GlossaryProvider } from './GlossaryContext.jsx';
import { getOperationalBriefings } from '../data/operationalBriefings.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function click(element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function mount(stateCode, onOpenRoom = vi.fn()) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(
    <GlossaryProvider>
      <OperationalIntelligence stateCode={stateCode} onOpenRoom={onOpenRoom} />
      <GlossaryModal />
    </GlossaryProvider>,
  ));
  return { host, onOpenRoom };
}

describe('Operational briefing strip', () => {
  it.each(['KY', 'FL'])('renders above the goal tiles on the %s Goals page with governed headlines', (stateCode) => {
    const { host } = mount(stateCode);
    const strip = host.querySelector('.ops-briefing-strip');
    const grid = host.querySelector('.ops-goal-grid');
    expect(strip).toBeTruthy();
    expect(grid).toBeTruthy();
    expect(strip.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const expected = getOperationalBriefings(stateCode);
    let cards = [...host.querySelectorAll('.ops-briefing-card')];
    expect(cards.length).toBe(Math.min(3, expected.length));
    expect(cards[0].querySelector('.ops-briefing-headline').textContent).toBe(expected[0].headline);
    const showAll = host.querySelector('.ops-briefing-show-all');
    expect(showAll).toBeTruthy();
    click(showAll);
    cards = [...host.querySelectorAll('.ops-briefing-card')];
    expect(cards.length).toBe(expected.length);
    for (const card of cards) {
      expect(card.querySelector('.ops-briefing-kind')).toBeTruthy();
      expect(card.textContent).toContain('Validation question');
      expect(card.textContent).toContain('Accountable owner');
      expect(card.querySelector('.ops-briefing-open-goal')).toBeTruthy();
    }
  });

  it('opens the plan-period record from the Kentucky concentration card and navigates to Contract Accountability', () => {
    const { host } = mount('KY');
    click(host.querySelector('.ops-briefing-show-all'));
    const card = host.querySelector('[data-briefing-id="KY-mcpar-overpayment-concentration"]');
    expect(card).toBeTruthy();

    click(card.querySelector('.ops-briefing-toggle'));
    const table = card.querySelector('.par-table');
    expect(table).toBeTruthy();
    const headings = [...table.querySelectorAll('th')].map((th) => th.textContent);
    expect(headings).toContain('Plan');
    expect(headings).toContain('Overpayments reported $');
    expect(table.textContent).toContain('United Healthcare Community Plan');
    expect(card.querySelectorAll('.par-table td.is-noncomparable').length).toBeGreaterThan(0);

    click(card.querySelector('.ops-briefing-open-goal'));
    expect(host.querySelector('.ops-briefing-strip')).toBeNull();
    expect(host.querySelector('.ops-selected-goal h3').textContent).toContain('Contract Accountability');
  });

  it('deep-links a funding briefing into the pre-filtered Funding & Resilience room', () => {
    const { host, onOpenRoom } = mount('FL');
    click(host.querySelector('.ops-briefing-show-all'));
    const card = host.querySelector('[data-briefing-id="FL-runway-composition"]');
    expect(card).toBeTruthy();
    click(card.querySelector('.ops-briefing-open-room'));
    expect(onOpenRoom).toHaveBeenCalledWith('funding-resilience', { filters: { types: ['award-cliff'] } });
  });

  it('renders the sanction record with the clause text and open remediation status', () => {
    const { host } = mount('KY');
    click(host.querySelector('.ops-briefing-show-all'));
    const card = host.querySelector('[data-briefing-id="KY-mcpar-sanctions"]');
    expect(card).toBeTruthy();
    click(card.querySelector('.ops-briefing-toggle'));
    const table = card.querySelector('.par-table');
    expect([...table.querySelectorAll('th')].map((th) => th.textContent)).toContain('Clause or reason as reported');
    expect(table.textContent).toContain('Network adequacy was not being met');
    expect(table.querySelectorAll('td.is-open').length).toBeGreaterThan(0);
  });

  it('shows the accountability record inside the Contract Accountability encounter case', () => {
    const { host } = mount('KY');
    const tile = [...host.querySelectorAll('.ops-goal-tile')].find((item) => item.textContent.includes('Contract Accountability'));
    click(tile);
    const opportunity = [...host.querySelectorAll('.ops-opportunity-tile')].find((item) => item.textContent.includes('Correct and revalidate late encounter-data files'));
    expect(opportunity).toBeTruthy();
    click(opportunity);
    const record = host.querySelector('.ops-decision-case .par-record');
    expect(record).toBeTruthy();
    expect(record.getAttribute('data-par-state')).toBe('KY');
    expect(record.textContent).toContain('State-reported sanction, corrective-action, and compliance-letter records');
  });
});
