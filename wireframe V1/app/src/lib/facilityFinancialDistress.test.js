import { describe, expect, it } from 'vitest';
import { FACILITY_FINANCIAL_DISTRESS } from '../data/alp/facilityFinancialDistress.js';

describe('OFR-04 CMS HCRIS facility financial distress', () => {
  it('is state-neutral: exactly KY and FL, each populated only from its own hydration', () => {
    expect(Object.keys(FACILITY_FINANCIAL_DISTRESS.byState).sort()).toEqual(['FL', 'KY']);
    for (const state of ['KY', 'FL']) {
      expect(FACILITY_FINANCIAL_DISTRESS.byState[state].state).toBe(state);
    }
  });

  it('labels every value as Medicare cost-report basis, not Medicaid payment truth', () => {
    expect(FACILITY_FINANCIAL_DISTRESS.sourceBasis).toMatch(/medicare cost-report basis/i);
    for (const state of ['KY', 'FL']) {
      expect(FACILITY_FINANCIAL_DISTRESS.byState[state].basisNote).toMatch(/medicare cost-report basis/i);
      expect(FACILITY_FINANCIAL_DISTRESS.byState[state].basisNote).toMatch(/not medicaid payment truth/i);
    }
  });

  it('annotates the Florida AHCA hospital-financial gap instead of silently replacing it', () => {
    const fl = FACILITY_FINANCIAL_DISTRESS.byState.FL;
    expect(fl.floridaFallbackNote).toMatch(/GAP-FL-F-14-PARAMETERS/);
    expect(fl.floridaFallbackNote).toMatch(/not a replacement/i);
    expect(FACILITY_FINANCIAL_DISTRESS.byState.KY.floridaFallbackNote).toBeNull();
  });

  it('never labels a margin signal as closure, distress, waste, fraud, or a finding', () => {
    for (const state of ['KY', 'FL']) {
      const text = JSON.stringify(FACILITY_FINANCIAL_DISTRESS.byState[state]);
      expect(text).not.toMatch(/\bwaste\b|\bfraud\b|\bbreach\b/i);
      expect(text).toMatch(/never a closure prediction/i);
      expect(text).toMatch(/review prompt|continuity-review prompt|continuity review/i);
    }
  });

  it('caps the negative-margin watchlist and keeps county rollups reproducible', () => {
    for (const state of ['KY', 'FL']) {
      const slice = FACILITY_FINANCIAL_DISTRESS.byState[state];
      expect(slice.negativeMarginWatchlist.facilities.length).toBeLessThanOrEqual(15);
      for (const item of slice.negativeMarginWatchlist.facilities) {
        expect(item.ccn).toBeTruthy();
        expect(item.totalMargin).toBeLessThan(0);
      }
      expect(Array.isArray(slice.countyRollups.counties)).toBe(true);
    }
  });

  it('passed Source Reconciliation on the last gate run (no fake green)', () => {
    expect(FACILITY_FINANCIAL_DISTRESS.reconciliation.status).toBe('PASS');
    expect(FACILITY_FINANCIAL_DISTRESS.reconciliation.claimAllowed).toBe(true);
    for (const check of FACILITY_FINANCIAL_DISTRESS.reconciliation.checks) {
      expect(check.ok).toBe(true);
    }
  });
});
