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

  it('exports the full negative-margin watchlist with a display cap, CCN join keys, and county flags', () => {
    for (const state of ['KY', 'FL']) {
      const slice = FACILITY_FINANCIAL_DISTRESS.byState[state];
      const watchlist = slice.negativeMarginWatchlist;
      // The UI caps what it shows by default; the export is no longer
      // truncated (2026-09-02) so cross-source joins by CCN can run.
      expect(watchlist.displayCap).toBe(15);
      expect(watchlist.facilities.length).toBe(watchlist.totalCount);
      expect(watchlist.facilities.length).toBeGreaterThan(15);
      for (const item of watchlist.facilities) {
        expect(item.ccn).toBeTruthy();
        expect(item.totalMargin).toBeLessThan(0);
        expect(item).toHaveProperty('providerContext');
      }
      expect(watchlist.providerContextCount).toBe(watchlist.facilities.filter((item) => item.providerContext).length);
      expect(Array.isArray(slice.countyRollups.counties)).toBe(true);
      for (const county of slice.countyRollups.counties) {
        expect(county.allFacilitiesNegativeMargin).toBe(county.facilityCount > 0 && county.lowMarginFacilityCount === county.facilityCount);
        expect(county.singleFacilityCounty).toBe(county.facilityCount === 1);
      }
      const compound = slice.compoundReviewCandidates;
      expect(typeof compound.computable).toBe('boolean');
      if (!compound.computable) expect(compound.gap.gapId).toBe(`GAP-PROVIDER-CONTEXT-${state}`);
      for (const item of compound.facilities) {
        expect(item.overallRating).toBeLessThanOrEqual(2);
        expect(item.medicaidDayShare).toBeGreaterThan(0.6);
        expect(item.totalMargin).toBeLessThan(0);
      }
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
