import { describe, expect, it } from 'vitest';

describe('OFR-01 award type (published assistance type)', () => {
  it('stores the USAspending award type on every award and restates it as the award class basis', async () => {
    const { FEDERAL_AWARD_GRAIN } = await import('../data/alp/federalAwardGrain.js');
    for (const state of ['KY', 'FL']) {
      const awards = FEDERAL_AWARD_GRAIN.byState[state].awards;
      expect(awards.every((award) => typeof award.awardType === 'string' && award.awardType.length > 0)).toBe(true);
      for (const award of awards) {
        expect(award.awardClass.publishedType).toBe(award.awardType);
        if (award.awardClass.id === 'title-xix-state-grant') expect(award.assistanceListing).toBe('93.778');
        if (/FORMULA|BLOCK/i.test(award.awardType) && award.awardClass.id !== 'title-xix-state-grant') expect(award.awardClass.id).toBe('formula-or-block-award');
        if (/PROJECT|COOPERATIVE/i.test(award.awardType) && award.awardClass.id !== 'title-xix-state-grant') expect(award.awardClass.id).toBe('project-or-cooperative-award');
      }
    }
  });
});
import { FEDERAL_AWARD_GRAIN } from '../data/alp/federalAwardGrain.js';

describe('OFR-01 federal award/recipient grain (USAspending)', () => {
  it('is state-neutral: exactly KY and FL, each populated only from its own hydration', () => {
    expect(Object.keys(FEDERAL_AWARD_GRAIN.byState).sort()).toEqual(['FL', 'KY']);
    for (const state of ['KY', 'FL']) {
      const slice = FEDERAL_AWARD_GRAIN.byState[state];
      expect(slice.state).toBe(state);
      expect(Array.isArray(slice.awards)).toBe(true);
    }
  });

  it('never leaks Kentucky award rows onto the Florida slice or vice versa', () => {
    const ky = FEDERAL_AWARD_GRAIN.byState.KY;
    const fl = FEDERAL_AWARD_GRAIN.byState.FL;
    const kyAwardIds = new Set(ky.awards.map((a) => a.awardId));
    const flAwardIds = new Set(fl.awards.map((a) => a.awardId));
    for (const id of kyAwardIds) expect(flAwardIds.has(id)).toBe(false);
  });

  it('tracks the minimum plan-required assistance listings plus Medicaid-adjacent capacity listings', () => {
    const codes = FEDERAL_AWARD_GRAIN.assistanceListings.map((l) => l.code);
    for (const required of ['93.775', '93.777', '93.778', '93.791']) {
      expect(codes).toContain(required);
    }
  });

  it('passed Source Reconciliation on the last gate run (no fake green)', () => {
    expect(FEDERAL_AWARD_GRAIN.reconciliation.status).toBe('PASS');
    expect(FEDERAL_AWARD_GRAIN.reconciliation.claimAllowed).toBe(true);
    expect(FEDERAL_AWARD_GRAIN.reconciliation.checks.length).toBeGreaterThan(0);
    for (const check of FEDERAL_AWARD_GRAIN.reconciliation.checks) {
      expect(check.ok).toBe(true);
    }
  });

  it('exposes a funding-cliff calendar and single-stream-dependency slice per state, never labeled as a finding', () => {
    for (const state of ['KY', 'FL']) {
      const slice = FEDERAL_AWARD_GRAIN.byState[state];
      expect(slice.fundingCliffCalendar.buckets.map((b) => b.bucketId)).toEqual(['0-6mo', '6-12mo', '12-24mo']);
      expect(slice.fundingCliffCalendar.note).toMatch(/not a predicted funding lapse/i);
      expect(slice.singleStreamDependency.note).toMatch(/review candidates only/i);
      expect(JSON.stringify(slice)).not.toMatch(/\bwaste\b|\bfraud\b|\bbreach\b/i);
    }
  });
});
