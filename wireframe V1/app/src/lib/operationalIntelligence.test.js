import { describe, expect, it } from 'vitest';
import {
  OPERATIONAL_INTELLIGENCE,
  PRODUCT_STATES,
  getOperationalIntelligence,
  normalizeProductState,
} from '../data/operationalIntelligence.js';
import {
  KY_OPERATIONAL_GOALS,
  rankRecommendationsForReview,
} from '../data/operationalGoals.js';

describe('operational intelligence product states', () => {
  it('keeps Kentucky as the default and exposes Florida as a shared-product hydration', () => {
    expect(normalizeProductState(null)).toBe('KY');
    expect(normalizeProductState('fl')).toBe('FL');
    expect(PRODUCT_STATES.FL.brand).toBe('DecisionPro Florida');
    expect(getOperationalIntelligence('FL').product.code).toBe('FL');
  });

  it('requires every operational play to carry an accountable action and guardrail', () => {
    for (const model of Object.values(OPERATIONAL_INTELLIGENCE)) {
      const sourceIds = new Set(model.sources.map((source) => source.id));
      for (const play of model.plays) {
        expect(play.nextAction.length).toBeGreaterThan(40);
        expect(play.owner.length).toBeGreaterThan(8);
        expect(play.validation.length).toBeGreaterThan(20);
        expect(play.guardrail.length).toBeGreaterThan(20);
        expect(play.evidence.length).toBeGreaterThan(1);
        expect(play.evidence.every((id) => sourceIds.has(id))).toBe(true);
      }
    }
  });

  it('preserves supported access, attribution, and limitation metadata for every source', () => {
    for (const model of Object.values(OPERATIONAL_INTELLIGENCE)) {
      for (const source of model.sources) {
        expect(source.publisher).toBeTruthy();
        expect(source.access).toBeTruthy();
        expect(source.cadence).toBeTruthy();
        expect(source.use).toBeTruthy();
        expect(source.caveat).toBeTruthy();
        expect(source.href).toMatch(/^https:\/\//);
      }
    }
  });

  it('records the two material corrections to the draft Florida ingestion spec', () => {
    const florida = OPERATIONAL_INTELLIGENCE.FL.sources;
    const eligibility = florida.find((source) => source.id === 'FL_ELIGIBILITY_REPORTS');
    const fees = florida.find((source) => source.id === 'FL_FEE_SCHEDULES');
    expect(eligibility.caveat).toMatch(/county-level eligibility reports are published/i);
    expect(fees.caveat).toMatch(/fee schedules are published/i);
  });

  it('binds the Kentucky page to the generated REAL operational warehouse export', () => {
    const kentucky = OPERATIONAL_INTELLIGENCE.KY;
    expect(kentucky.hydratedSources.loadClass).toBe('REAL');
    expect(kentucky.hydratedSources.sourceCount).toBe(8);
    expect(kentucky.hydratedSources.metricCount).toBeGreaterThanOrEqual(20);
    expect(kentucky.hydratedSources.metrics.find((metric) => metric.metricId === 'ky-mcpar-reported-overpayments')?.provenance.limitation).toMatch(/not proof/i);
    expect(kentucky.hydratedSources.metrics.find((metric) => metric.metricId === 'ky-usaspending-latest-complete-fy')?.provenance.periodStatus).toBe('COMPLETE');
    expect(kentucky.hydratedSources.sourceStatuses.find((source) => source.fromSysId === 'HHS_OIG_LEIE')?.notes).toMatch(/person names.*not normalized or exported/i);
    expect(kentucky.sources.find((source) => source.id === 'KY_TRANSPARENCY')?.status).toBe('source-verified');
  });

  it('models six goal categories as explainable evidence-to-action cases', () => {
    expect(KY_OPERATIONAL_GOALS.map((goal) => goal.label)).toEqual([
      'Optimize Spending',
      'Improve Coverage & Access',
      'Identify Quality Gaps',
      'Contract Accountability',
      'Protect Program Integrity',
      'Trend & Budget Planning',
    ]);
    for (const goal of KY_OPERATIONAL_GOALS) {
      expect(goal.cases.length).toBeGreaterThan(0);
      for (const decisionCase of goal.cases) {
        expect(decisionCase.inputs.length).toBeGreaterThan(1);
        expect(decisionCase.transformations.length).toBeGreaterThan(1);
        expect(decisionCase.actions.length).toBeGreaterThan(1);
        expect(decisionCase.inputs.every((item) => item.kind === 'input')).toBe(true);
        expect(decisionCase.transformations.every((item) => item.kind === 'transformation')).toBe(true);
        expect(decisionCase.actions.every((item) => item.kind === 'action')).toBe(true);
        expect(decisionCase.actions.every((item) => (
          item.guardrail
          && item.owner
          && item.authority
          && item.summary
          && item.expectedImpact
          && item.timeHorizon
          && item.how?.length >= 3
          && item.estimatedCost
          && item.estimatedSavings
        ))).toBe(true);
      }
    }
  });

  it('sorts potential actions by recommended review priority independently of implementation status', () => {
    const actions = KY_OPERATIONAL_GOALS[0].cases[0].actions;
    const ranked = rankRecommendationsForReview([...actions].reverse());
    expect(ranked.map((item) => item.reviewPriority)).toEqual([1, 2]);
    expect(ranked[0].implementationPriority).toBe('Ready to investigate');
  });
});
