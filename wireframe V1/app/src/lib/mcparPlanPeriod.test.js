import { describe, expect, it } from 'vitest';
import { MCPAR_PLAN_PERIOD } from '../data/alp/mcparPlanPeriod.js';
import { KY_OPERATIONAL_SOURCES } from '../data/alp/kyOperationalSources.js';

const PERSON_LEVEL_QUESTION_IDS = ['submitterName', 'submitterEmailAddress', 'contactName', 'contactEmailAddress'];

describe('MCPAR plan-period accountability record (BW export)', () => {
  it('is REAL, reconciled, and state-isolated', () => {
    expect(MCPAR_PLAN_PERIOD.loadClass).toBe('REAL');
    expect(MCPAR_PLAN_PERIOD.reconciliation.status).toBe('PASS');
    expect(MCPAR_PLAN_PERIOD.reconciliation.checks.every((check) => check.ok)).toBe(true);
    expect(Object.keys(MCPAR_PLAN_PERIOD.byState).sort()).toEqual(['FL', 'KY']);
    for (const state of ['KY', 'FL']) {
      const slice = MCPAR_PLAN_PERIOD.byState[state];
      expect(slice.state).toBe(state);
      expect(slice.programs.length).toBeGreaterThan(0);
      expect(slice.rowCount).toBeGreaterThan(state === 'KY' ? 500 : 2000);
    }
  });

  it('never carries a submitter or contact field (person-level gate)', () => {
    const serialized = JSON.stringify(MCPAR_PLAN_PERIOD);
    for (const id of PERSON_LEVEL_QUESTION_IDS) expect(serialized.includes(id)).toBe(false);
    expect(serialized).not.toMatch(/@[a-z0-9.-]+\.(gov|com|org)/i);
  });

  it('reproduces the hydrated Kentucky statewide overpayment metric from the plan-level rows', () => {
    const metric = KY_OPERATIONAL_SOURCES.metrics.find((item) => item.metricId === 'ky-mcpar-reported-overpayments');
    const total = MCPAR_PLAN_PERIOD.byState.KY.programs.reduce((sum, program) => sum + program.totals.overpaymentsReported, 0);
    expect(Math.abs(total - metric.numericValue)).toBeLessThan(1);
  });

  it('marks non-comparable measures by dispersion and never ranks plans on them', () => {
    const program = MCPAR_PLAN_PERIOD.byState.KY.programs[0];
    const limit = MCPAR_PLAN_PERIOD.comparabilityRule.dispersionLimit;
    for (const entry of Object.values(program.comparability)) {
      if (entry.dispersion == null) { expect(entry.comparable).toBe(false); continue; }
      expect(entry.comparable).toBe(entry.dispersion <= limit);
    }
    expect(program.comparability.appealsPer1k.comparable).toBe(false);
  });

  it('aligns the positional sanction group only when every core list length matches, and keeps the clause text as reported', () => {
    for (const state of ['KY', 'FL']) {
      for (const program of MCPAR_PLAN_PERIOD.byState[state].programs) {
        const sanctions = program.sanctions;
        if (!sanctions.records.length) continue;
        expect(sanctions.aligned).toBe(true);
        for (const record of sanctions.records) {
          expect(record.planName).toBeTruthy();
          expect(record.interventionType).toBeTruthy();
          expect(record.remediationCompleted).toBeTruthy();
          expect(record).toHaveProperty('interventionReason');
        }
        expect(sanctions.byPlan.reduce((sum, row) => sum + row.records, 0)).toBe(sanctions.records.length);
      }
    }
    const ky = MCPAR_PLAN_PERIOD.byState.KY.programs[0].sanctions;
    expect(ky.records.length).toBe(33);
  });

  it('flags publisher-side inconsistencies instead of silently ranking them', () => {
    const program = MCPAR_PLAN_PERIOD.byState.KY.programs[0];
    const flagged = program.plans.flatMap((plan) => plan.dataQualityFlags.map((flag) => flag.id));
    expect(flagged).toContain('APPEALS-DENIED-EXCEED-RESOLVED');
    expect(flagged).toContain('TIMELY-APPEALS-ZERO');
    const withheld = MCPAR_PLAN_PERIOD.byState.FL.programs.flatMap((p) => p.plans).filter((plan) => plan.dataQualityFlags.some((flag) => flag.id === 'PREMIUM-BASIS-UNVERIFIED'));
    for (const plan of withheld) expect(plan.derived.overpaymentBasisPoints).toBeNull();
  });
});
