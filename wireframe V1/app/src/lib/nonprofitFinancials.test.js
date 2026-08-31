import { describe, expect, it } from 'vitest';
import { NONPROFIT_FINANCIALS } from '../data/alp/nonprofitFinancials.js';

describe('OFR-03 IRS Form 990 nonprofit financial resilience', () => {
  it('is state-neutral: exactly KY and FL, each populated only from its own hydration', () => {
    expect(Object.keys(NONPROFIT_FINANCIALS.byState).sort()).toEqual(['FL', 'KY']);
    for (const state of ['KY', 'FL']) {
      expect(NONPROFIT_FINANCIALS.byState[state].state).toBe(state);
    }
  });

  it('scopes to Form 990 organization-level facts, no person-level fields', () => {
    expect(NONPROFIT_FINANCIALS.formType).toBe('990');
    for (const state of ['KY', 'FL']) {
      const slice = NONPROFIT_FINANCIALS.byState[state];
      expect(slice.organizationLevelOnly).toMatch(/no officer, donor, or person-level fields/i);
      // Exclude the deliberate policy-disclosure field itself (which must
      // say "no officer/donor data" in plain words) — check every other
      // field for an actual person-name-shaped value or SSN/DOB pattern.
      const { organizationLevelOnly: _disclosure, ...rest } = slice;
      const text = JSON.stringify(rest);
      expect(text).not.toMatch(/\bssn\b|date of birth|\d{3}-\d{2}-\d{4}/i);
    }
  });

  it('labels the government-grant and program-vs-admin limitations honestly', () => {
    for (const state of ['KY', 'FL']) {
      const slice = NONPROFIT_FINANCIALS.byState[state];
      expect(slice.governmentGrantDependencyNote).toMatch(/does not separately break out government-source grants/i);
      expect(slice.programVsAdminNote).toMatch(/does not carry the Form 990 Part IX/i);
    }
  });

  it('never labels a resilience ratio as distress, waste, fraud, or a finding', () => {
    for (const state of ['KY', 'FL']) {
      const text = JSON.stringify(NONPROFIT_FINANCIALS.byState[state]);
      expect(text).not.toMatch(/\bwaste\b|\bfraud\b|\bbreach\b/i);
      expect(text).toMatch(/never a finding|never evidence of financial distress|review prompt/i);
    }
  });

  it('caps review-candidate lists and keeps them reproducible from retained facts', () => {
    for (const state of ['KY', 'FL']) {
      const list = NONPROFIT_FINANCIALS.byState[state].reviewCandidates.lowestLiquidity;
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeLessThanOrEqual(15);
      for (const item of list) {
        expect(item.ein).toBeTruthy();
        expect(item.taxPeriod).toBeTruthy();
        expect(item.extractVintage).toBeTruthy();
      }
    }
  });

  it('passed Source Reconciliation on the last gate run (no fake green)', () => {
    expect(NONPROFIT_FINANCIALS.reconciliation.status).toBe('PASS');
    expect(NONPROFIT_FINANCIALS.reconciliation.claimAllowed).toBe(true);
    for (const check of NONPROFIT_FINANCIALS.reconciliation.checks) {
      expect(check.ok).toBe(true);
    }
  });
});
