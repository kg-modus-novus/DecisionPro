/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationalActionWorkbench } from '../components/OperationalActionWorkbench.jsx';
import { OperationalIntelligence } from '../components/OperationalIntelligence.jsx';
import { GlossaryModal } from '../components/GlossaryModal.jsx';
import { getOperationalIntelligence } from '../data/operationalIntelligence.js';
import { GlossaryProvider } from './GlossaryContext.jsx';
import { NavHistoryContext } from './navHistory.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function click(element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

describe('Operational Action Workbench', () => {
  it('opens the Funding & Resilience room, pre-filtered, from the waiver-milestone action (KY)', () => {
    const model = getOperationalIntelligence('KY');
    const onOpenRoom = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<GlossaryProvider><OperationalActionWorkbench goals={model.goals} sources={model.sources} onOpenRoom={onOpenRoom} /><GlossaryModal /></GlossaryProvider>));

    const contractGoal = [...host.querySelectorAll('.ops-goal-tile')]
      .find((button) => button.textContent.includes('Contract Accountability'));
    expect(contractGoal).toBeTruthy();
    click(contractGoal);

    const milestoneOpportunity = [...host.querySelectorAll('.ops-opportunity-tile')]
      .find((tile) => tile.textContent.includes('Route recently posted deliverables'));
    expect(milestoneOpportunity).toBeTruthy();
    click(milestoneOpportunity);

    const roomLinkBtn = host.querySelector('.ops-goal-use-room-link');
    expect(roomLinkBtn).toBeTruthy();
    expect(roomLinkBtn.textContent).toContain('Funding & Resilience');
    click(roomLinkBtn);
    expect(onOpenRoom).toHaveBeenCalledWith('funding-resilience', { filters: { types: ['horizon-waiver'] } });
  });


  it('renders Florida observed review scopes without presenting them as modeled savings', () => {
    const model = getOperationalIntelligence('FL');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<GlossaryProvider><OperationalActionWorkbench goals={model.goals} sources={model.sources} /><GlossaryModal /></GlossaryProvider>));

    const optimize = [...host.querySelectorAll('.ops-goal-tile')]
      .find((button) => button.textContent.includes('Optimize Spending'));
    click(optimize);
    const text = host.querySelector('.ops-opportunity-panel')?.textContent || '';
    expect(text).toContain('$17.38M');
    expect(text).toContain('35 files');
    expect(text).toContain('Observed financial review universe');
    expect(text).toContain('Current automatable share');
    expect(text).toContain('no amount is counted as savings');
    expect(text).not.toContain('$50–$200');

    act(() => root.unmount());
  });

  it('keeps the goal index quiet, opens a dedicated detail page, and explains evidence', () => {
    const model = getOperationalIntelligence('KY');
    const modeledActions = model.goals.flatMap((goal) => goal.cases.flatMap((decisionCase) => decisionCase.actions));
    expect(modeledActions).toHaveLength(28);
    modeledActions.forEach((actionItem) => {
      expect(actionItem.opportunity.absoluteValue).toMatch(/\d/);
      expect(actionItem.opportunity.improvementValue).toMatch(/\d/);
      expect(actionItem.opportunity.absoluteLabel.length).toBeGreaterThan(10);
      expect(actionItem.opportunity.improvementLabel.length).toBeGreaterThan(10);
      expect(actionItem.opportunity.calculationBasis.length).toBeGreaterThan(25);
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => root.render(<GlossaryProvider><OperationalActionWorkbench goals={model.goals} sources={model.sources} /><GlossaryModal /></GlossaryProvider>));

    expect(host.querySelectorAll('.ops-goal-tile')).toHaveLength(6);
    expect(host.textContent).toContain('If you want to');
    expect(host.textContent).toContain('Click here to find recoverable, avoidable');
    expect(host.querySelector('.ops-selected-goal')).toBeNull();
    expect(host.querySelectorAll('[data-ops-item-kind]')).toHaveLength(0);

    const coverage = [...host.querySelectorAll('.ops-goal-tile')]
      .find((button) => button.textContent.includes('Improve Coverage & Access'));
    click(coverage);
    expect(host.querySelectorAll('.ops-goal-tile')).toHaveLength(0);
    expect(host.querySelector('.ops-selected-goal h3')?.textContent).toBe('Improve Coverage & Access');
    expect(host.querySelectorAll('[data-ops-item-kind]')).toHaveLength(0);
    expect(host.querySelector('.ops-goal-use-guide')).toBeNull();
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('What you can get from this page');
    expect(host.querySelectorAll('.ops-opportunity-tile')).toHaveLength(4);
    expect(host.querySelectorAll('.ops-opportunity-benefit-value')).toHaveLength(8);
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('12 counties');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('15.2%');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('3 county-service gaps');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('25.0%');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).not.toContain('Value after validation');
    const modeledBenefitTerm = [...host.querySelectorAll('.glossary-term-link')]
      .find((button) => button.textContent === 'Modeled absolute benefit');
    expect(modeledBenefitTerm).toBeTruthy();
    click(modeledBenefitTerm);
    expect(document.querySelector('.glossary-modal')?.textContent).toContain('A transparent estimate or target');
    expect(host.querySelector('.ops-opportunity-panel')).toBeTruthy();
    click(document.querySelector('.glossary-modal .explain-close'));
    const coverageOpportunity = host.querySelectorAll('.ops-opportunity-tile')[1];
    click(coverageOpportunity);
    expect(host.querySelector('.ops-opportunity-panel')).toBeNull();
    expect(host.querySelector('.ops-opportunity-detail h3')?.textContent).toBe('Implement the least-cost option for each validated service gap');
    expect(host.querySelectorAll('[data-ops-item-kind="input"]').length).toBeGreaterThan(1);
    expect(host.querySelectorAll('[data-ops-item-kind="transformation"]').length).toBeGreaterThan(1);
    expect(host.querySelectorAll('[data-ops-item-kind="action"]')).toHaveLength(1);
    expect(host.querySelector('.ops-decision-case')?.classList.contains('is-opportunity-focused')).toBe(true);
    expect(host.textContent).toContain('Focused opportunity decision case');
    expect(host.querySelector('.ops-goal-use-guide')?.textContent).toContain('What to do on this screen');
    expect(host.querySelector('.ops-goal-use-guide')?.textContent).toContain('Read left to right on this screen');
    expect(host.querySelector('.ops-goal-use-guide')?.textContent).toContain('this opportunity detail is not a filter screen');
    expect(host.querySelector('.ops-goal-use-guide')?.textContent).toContain('Open the recommended action under Potential actions on this screen');

    const inputCard = host.querySelector('[data-ops-item-kind="input"]');
    click(inputCard);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Where it comes from');
    expect(dialog.textContent).toContain('How it affects people, services, spending or oversight');

    click(dialog.querySelector('[aria-label="Close explanation"]'));
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    const actionCard = host.querySelector('[data-ops-item-kind="action"]');
    expect(actionCard.textContent).toContain('Who');
    expect(actionCard.textContent).toContain('Do what');
    expect(actionCard.textContent).toContain('How');
    expect(actionCard.textContent).toContain('Benefit');
    expect(actionCard.textContent).toContain('Estimated cost');
    expect(actionCard.textContent).toContain('Estimated savings');
    click(actionCard);
    const actionDialog = document.querySelector('[role="dialog"]');
    expect(actionDialog.textContent).toContain('Who needs to do it');
    expect(actionDialog.textContent).toContain('How they do it');
    expect(actionDialog.textContent).toContain('How long it should take');
    expect(actionDialog.textContent).toContain('Estimated cost and savings');
    click(actionDialog.querySelector('[aria-label="Close explanation"]'));

    click(host.querySelector('.ops-opportunity-detail-back'));
    expect(host.querySelectorAll('.ops-opportunity-tile')).toHaveLength(4);
    expect(host.querySelectorAll('[data-ops-item-kind]')).toHaveLength(0);
    click(host.querySelector('.ops-goal-detail-back'));
    expect(host.querySelectorAll('.ops-goal-tile')).toHaveLength(6);
    expect(host.querySelector('.ops-selected-goal')).toBeNull();

    act(() => root.unmount());
  });

  it('opens the prepared six-plan recovery workpaper and calculates reviewer confirmations', () => {
    const model = getOperationalIntelligence('KY');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<GlossaryProvider><OperationalActionWorkbench goals={model.goals} sources={model.sources} /><GlossaryModal /></GlossaryProvider>));

    const optimize = [...host.querySelectorAll('.ops-goal-tile')]
      .find((button) => button.textContent.includes('Optimize Spending'));
    click(optimize);
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('$0.51M–$2.54M');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('10%–50%');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('Modeled absolute benefit');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('Modeled improvement');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('Calculation:');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('$5.09M in reported overpayment candidates');
    expect(host.querySelector('.ops-opportunity-panel')?.textContent).toContain('Planning range—not confirmed savings');
    const recoveryOpportunity = host.querySelector('[data-opportunity-id="validate-recovery-ledger"]');
    click(recoveryOpportunity);
    expect(host.querySelector('.ops-opportunity-panel')).toBeNull();
    expect(host.querySelector('.ops-opportunity-detail h3')?.textContent).toBe('Potential recovery opportunity');
    expect(host.querySelectorAll('[data-ops-item-kind="action"]')).toHaveLength(1);
    const deliverable = [...host.querySelectorAll('[data-ops-item-kind="action"]')]
      .find((button) => button.textContent.includes('6-plan reconciliation prepared'));
    expect(deliverable.textContent).toContain('Open prepared reconciliation');
    click(deliverable);

    expect(host.querySelector('#recovery-workspace-title')?.textContent).toContain('ready for review');
    expect(host.querySelectorAll('[data-recovery-plan]')).toHaveLength(6);
    expect(host.textContent).toContain('$5,088,460.77');
    expect(host.textContent).toContain('United Healthcare Community Plan');
    expect(host.querySelectorAll('.recovery-status')).toHaveLength(6);
    expect(host.textContent).toContain('DecisionPro populated the public-source evidence');
    expect(host.textContent).toContain('do not use PHI or person-level records');
    expect(host.textContent).toContain('$508,846.08–$2,544,230.39');
    expect(host.textContent).toContain('Planning case: $1,272,115.19');
    expect(host.textContent).toContain('72–120 staff hours');
    expect(host.textContent).toContain('$4,320.00–$9,600.00');
    expect(host.textContent).toContain('3–6 weeks');
    expect(host.textContent).toContain('25% planning scenario: $95,236.16');
    expect(host.querySelectorAll('.recovery-help > button').length).toBeGreaterThan(20);
    expect(host.querySelector('[role="region"][aria-label="Horizontal table scroll"]')).toBeTruthy();
    expect(host.querySelector('.recovery-use-guide')?.textContent).toContain('verify the fixed Review period');
    expect(host.querySelector('.recovery-use-guide')?.textContent).toContain('a data operator must run the governed MCPAR ingestion outside this dashboard');
    expect(host.querySelector('.recovery-use-guide')?.textContent).toContain('use Plan scope');
    expect(host.querySelector('.recovery-use-guide')?.textContent).toContain('click Download recovery-status template on this screen');
    expect(host.querySelector('#recovery-period')?.value).toBe('CY 2024');
    expect(host.querySelector('#recovery-period')?.disabled).toBe(true);
    expect(host.querySelector('#recovery-period-help')?.textContent).toContain('← Decision case');
    expect(host.querySelector('#recovery-period-help')?.textContent).toContain('Data Sources');
    expect(host.querySelector('#recovery-scope')?.value).toBe('all');

    act(() => {
      const scope = host.querySelector('#recovery-scope');
      scope.value = 'aetna';
      scope.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelectorAll('[data-recovery-plan]')).toHaveLength(1);
    expect(host.textContent).toContain('Current view: CY 2024 · Aetna Better Health');
    expect(host.textContent).toContain('$380,944.63');
    expect(host.textContent).toContain('$38,094.46–$190,472.32');
    expect(host.textContent).toContain('12–20 staff hours');
    expect(host.textContent).toContain('$720.00–$1,600.00');
    act(() => {
      const scope = host.querySelector('#recovery-scope');
      scope.value = 'all';
      scope.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelectorAll('[data-recovery-plan]')).toHaveLength(6);

    click(host.querySelector('[aria-label="Explain Reported candidate"]'));
    const help = document.body.querySelector('[role="dialog"][aria-label="Reported candidate explanation"]');
    expect(help.textContent).toContain('candidate pool—not confirmed debt, waste, recovery, or savings');
    click(help.querySelector('[aria-label="Close Reported candidate explanation"]'));
    expect(document.body.querySelector('[role="dialog"][aria-label="Reported candidate explanation"]')).toBeNull();

    const aetna = host.querySelector('[data-recovery-plan="aetna"]');
    act(() => {
      const select = aetna.querySelector('select');
      select.value = 'recovered';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => {
      const amount = aetna.querySelector('input[type="number"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(amount, '100000.25');
      amount.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.textContent).toContain('$100,000.25');

    click(host.querySelector('.recovery-workspace-head .ops-goal-detail-back'));
    expect(host.querySelector('[data-ops-case-id="overpayment-reconciliation"]')).toBeTruthy();
    act(() => root.unmount());
  });

  it('makes the page-header Back button unwind exactly one operational screen before returning home', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const goBack = vi.fn();
    act(() => root.render(
      <GlossaryProvider>
        <NavHistoryContext.Provider value={{ canGoBack: true, goBack, revealsNav: false }}>
          <OperationalIntelligence stateCode="KY" />
        </NavHistoryContext.Provider>
        <GlossaryModal />
      </GlossaryProvider>,
    ));

    const pageBack = host.querySelector('.page-title-back-col .content-back-btn');
    const optimize = [...host.querySelectorAll('.ops-goal-tile')]
      .find((button) => button.textContent.includes('Optimize Spending'));
    click(optimize);
    expect(host.querySelector('.ops-selected-goal h3')?.textContent).toBe('Optimize Spending');
    click(pageBack);
    expect(host.querySelectorAll('.ops-goal-tile')).toHaveLength(6);
    expect(goBack).not.toHaveBeenCalled();

    const evidenceTab = [...host.querySelectorAll('[role="tab"]')]
      .find((button) => button.textContent === 'Evidence & Data');
    const dataSourcesTab = [...host.querySelectorAll('[role="tab"]')]
      .find((button) => button.textContent === 'Data Sources');
    click(evidenceTab);
    expect(host.querySelector('#ops-page-evidence')).toBeTruthy();
    click(dataSourcesTab);
    expect(host.querySelector('#ops-page-sources')).toBeTruthy();
    click(pageBack);
    expect(host.querySelector('#ops-page-evidence')).toBeTruthy();
    expect(goBack).not.toHaveBeenCalled();
    click(pageBack);
    expect(host.querySelectorAll('.ops-goal-tile')).toHaveLength(6);
    expect(goBack).not.toHaveBeenCalled();

    click([...host.querySelectorAll('.ops-goal-tile')]
      .find((button) => button.textContent.includes('Optimize Spending')));
    click(host.querySelector('[data-opportunity-id="validate-recovery-ledger"]'));
    click([...host.querySelectorAll('[data-ops-item-kind="action"]')]
      .find((button) => button.textContent.includes('6-plan reconciliation prepared')));
    expect(host.querySelector('#recovery-workspace-title')).toBeTruthy();
    click(pageBack);
    expect(host.querySelector('.ops-opportunity-detail h3')?.textContent).toBe('Potential recovery opportunity');
    expect(goBack).not.toHaveBeenCalled();
    click(pageBack);
    expect(host.querySelector('.ops-selected-goal h3')?.textContent).toBe('Optimize Spending');
    expect(host.querySelectorAll('.ops-opportunity-tile')).toHaveLength(2);
    expect(goBack).not.toHaveBeenCalled();
    click(pageBack);
    expect(host.querySelectorAll('.ops-goal-tile')).toHaveLength(6);
    expect(goBack).not.toHaveBeenCalled();
    click(pageBack);
    expect(goBack).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });
});
