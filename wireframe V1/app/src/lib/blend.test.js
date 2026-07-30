import { describe, expect, it } from 'vitest';
import {
  buildBrief,
  findingDisplayWeight,
  freshnessTrustFactor,
  normalizeWeights,
  radarProfile,
  rankOptionPacks,
  scoreOptionPack,
} from './blend.js';
import { FINDINGS, OPTION_PACKS } from '../data/fixtures.js';

describe('blend helpers', () => {
  it('normalizes weights to sum 1', () => {
    const n = normalizeWeights({ budget: 2, care: 2, access: 0, mco: 0, district: 0, bill: 0 });
    const sum = Object.values(n).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 8);
    expect(n.budget).toBeCloseTo(0.5, 8);
    expect(n.care).toBeCloseTo(0.5, 8);
  });

  it('shrinks lagged findings relative to near-current', () => {
    const near = FINDINGS.find((f) => f.id === 'f-pharmacy');
    const lagged = FINDINGS.find((f) => f.id === 'f-diabetes');
    expect(freshnessTrustFactor(near.freshness)).toBeGreaterThan(freshnessTrustFactor(lagged.freshness));
    expect(findingDisplayWeight(near)).toBeGreaterThan(findingDisplayWeight(lagged));
  });

  it('ranks packs using weights and blended findings', () => {
    const findings = FINDINGS.filter((f) => ['f-avoidable-ed', 'f-pharmacy', 'f-postpartum'].includes(f.id));
    const weights = { budget: 0.2, care: 0.3, access: 0.35, mco: 0.05, district: 0.05, bill: 0.05 };
    const ranked = rankOptionPacks(OPTION_PACKS, weights, findings);
    expect(ranked[0].id).toBe('pack-pc-pharmacy-rural');
    expect(ranked[0].score).toBeGreaterThan(scoreOptionPack(OPTION_PACKS[1], weights, findings) - 0.2);
  });

  it('builds a brief with trust warning for lagged inputs', () => {
    const findings = FINDINGS.filter((f) => f.id === 'f-diabetes' || f.id === 'f-pharmacy');
    const brief = buildBrief({
      focuses: ['budget', 'care'],
      findings,
      weights: { budget: 1, care: 1, access: 1, mco: 1, district: 1, bill: 1 },
      packs: OPTION_PACKS,
      spineStep: 'Results',
      trustReviewed: true,
    });
    expect(brief.packs.length).toBeGreaterThan(0);
    expect(brief.trustWarning.toLowerCase()).toContain('lagged');
  });

  it('clears incomplete-trust warning when reviewed and no lagged findings', () => {
    const findings = FINDINGS.filter((f) => f.id === 'f-pharmacy' || f.id === 'f-avoidable-ed');
    const brief = buildBrief({
      focuses: ['budget', 'access'],
      findings,
      weights: { budget: 1, care: 1, access: 1, mco: 1, district: 1, bill: 1 },
      packs: OPTION_PACKS,
      spineStep: 'Action',
      trustReviewed: true,
    });
    expect(brief.trustWarning.toLowerCase()).toContain('reviewed');
    expect(brief.trustWarning.toLowerCase()).not.toContain('not yet');
  });

  it('reshapes radar axes when slider weights change', () => {
    const findings = FINDINGS.filter((f) => ['f-pharmacy', 'f-postpartum', 'f-avoidable-ed'].includes(f.id));
    const balanced = radarProfile(findings, {
      budget: 50,
      care: 50,
      access: 50,
      mco: 50,
      district: 50,
      bill: 50,
    });
    const budgetHeavy = radarProfile(findings, {
      budget: 100,
      care: 10,
      access: 10,
      mco: 10,
      district: 10,
      bill: 10,
    });
    const accessHeavy = radarProfile(findings, {
      budget: 10,
      care: 10,
      access: 100,
      mco: 10,
      district: 10,
      bill: 10,
    });

    expect(budgetHeavy.budget).toBeGreaterThan(balanced.budget);
    expect(budgetHeavy.budget).toBeGreaterThan(budgetHeavy.access);
    expect(accessHeavy.access).toBeGreaterThan(balanced.access);
    expect(accessHeavy.access).toBeGreaterThan(accessHeavy.budget);
  });
});
