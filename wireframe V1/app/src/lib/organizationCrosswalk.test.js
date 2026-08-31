import { describe, expect, it } from 'vitest';
import { ORGANIZATION_CROSSWALK } from '../data/alp/organizationCrosswalk.js';

describe('OFR-02 organization identity crosswalk spine', () => {
  it('is state-neutral: exactly KY and FL, each populated only from its own hydration', () => {
    expect(Object.keys(ORGANIZATION_CROSSWALK.byState).sort()).toEqual(['FL', 'KY']);
    for (const state of ['KY', 'FL']) {
      expect(ORGANIZATION_CROSSWALK.byState[state].state).toBe(state);
    }
  });

  it('keeps exact and inferred assertions in structurally separate collections', () => {
    for (const state of ['KY', 'FL']) {
      const slice = ORGANIZATION_CROSSWALK.byState[state];
      expect(Array.isArray(slice.exactAssertions)).toBe(true);
      expect(Array.isArray(slice.inferredAssertions)).toBe(true);
      for (const row of slice.exactAssertions) {
        expect(['exact-published', 'exact-derived']).toContain(row.method);
      }
      for (const row of slice.inferredAssertions) {
        expect(row.method).toBe('inferred');
        expect(row.reviewCandidateOnly).toBe(true);
      }
    }
  });

  it('never presents an inferred match as confirmed identity in exportable text', () => {
    for (const state of ['KY', 'FL']) {
      const slice = ORGANIZATION_CROSSWALK.byState[state];
      expect(slice.coverageNote).toMatch(/ever presented as confirmed identity/i);
      for (const row of slice.inferredAssertions) {
        expect(row.evidence).not.toMatch(/confirmed identity|verified match/i);
      }
    }
  });

  it('never labels an assertion as waste, fraud, breach, or a finding', () => {
    for (const state of ['KY', 'FL']) {
      const text = JSON.stringify(ORGANIZATION_CROSSWALK.byState[state]);
      expect(text).not.toMatch(/\bwaste\b|\bfraud\b|\bbreach\b/i);
    }
  });

  it('keeps the SAM-vs-USAspending disagreement queue open (never auto-resolved)', () => {
    for (const state of ['KY', 'FL']) {
      for (const item of ORGANIZATION_CROSSWALK.byState[state].disagreementQueue) {
        expect(item.status).toBe('open');
      }
    }
  });

  it('passed Source Reconciliation on the last gate run (no fake green)', () => {
    expect(ORGANIZATION_CROSSWALK.reconciliation.status).toBe('PASS');
    expect(ORGANIZATION_CROSSWALK.reconciliation.claimAllowed).toBe(true);
    for (const check of ORGANIZATION_CROSSWALK.reconciliation.checks) {
      expect(check.ok).toBe(true);
    }
  });

  it('records the SAM.gov EIN-exposure grounding correction', () => {
    expect(ORGANIZATION_CROSSWALK.groundingCorrection).toMatch(/nor USAspending exposes EIN/i);
  });
});
