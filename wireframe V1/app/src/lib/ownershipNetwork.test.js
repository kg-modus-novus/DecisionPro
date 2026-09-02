import { describe, expect, it } from 'vitest';
import { OWNERSHIP_NETWORK } from '../data/alp/ownershipNetwork.js';

describe('OFR-05 CMS ownership & control network', () => {
  it('is state-neutral: exactly KY and FL, each populated only from its own hydration', () => {
    expect(Object.keys(OWNERSHIP_NETWORK.byState).sort()).toEqual(['FL', 'KY']);
    for (const state of ['KY', 'FL']) {
      expect(OWNERSHIP_NETWORK.byState[state].state).toBe(state);
    }
  });

  it('never contains an individual owner name or personal address', () => {
    for (const state of ['KY', 'FL']) {
      const slice = OWNERSHIP_NETWORK.byState[state];
      expect(slice.organizationLevelOnly).toMatch(/no individual owner name or personal address/i);
      const { organizationLevelOnly: _disclosure, ...rest } = slice;
      const text = JSON.stringify(rest);
      // Structural guard: chain entries only ever carry an organization
      // name field, never first/last name fields.
      expect(text).not.toMatch(/"firstName"|"lastName"|"middleName"|date of birth|\bssn\b/i);
    }
  });

  it('never labels common ownership as a finding of misconduct', () => {
    for (const state of ['KY', 'FL']) {
      const text = JSON.stringify(OWNERSHIP_NETWORK.byState[state]);
      expect(text).not.toMatch(/\bwaste\b|\bfraud\b|\bbreach\b/i);
      expect(text).toMatch(/never itself a finding|never evidence of impropriety|review candidate/i);
    }
  });

  it('exports CMS-reported chains keyed on chain id and withholds any label that is not an organization name', () => {
    for (const state of ['KY', 'FL']) {
      const cms = OWNERSHIP_NETWORK.byState[state].cmsChains;
      expect(cms.source).toBe('CMS_PROVIDER_DATA');
      expect(cms.chains.length).toBe(cms.chainCount);
      expect(cms.chains.length).toBeGreaterThan(0);
      for (const chain of cms.chains) {
        expect(chain.chainId).toBeTruthy();
        expect(chain.facilityCount).toBeGreaterThan(1);
        expect(['organization', 'withheld_not_organization']).toContain(chain.labelStatus);
        if (chain.labelStatus === 'withheld_not_organization') {
          expect(chain.label).toBeNull();
          expect(chain.displayLabel).toMatch(/^CMS chain \S+ \(label withheld/);
        } else {
          expect(chain.displayLabel).toBe(chain.label);
        }
        for (const facility of chain.facilities) expect(facility.ccn).toBeTruthy();
      }
      expect(cms.withheldLabelCount).toBe(cms.chains.filter((chain) => !chain.label).length);
    }
  });

  it('caps the ownership-chain list and keeps it reproducible', () => {
    for (const state of ['KY', 'FL']) {
      const chains = OWNERSHIP_NETWORK.byState[state].ownershipChains.chains;
      expect(Array.isArray(chains)).toBe(true);
      expect(chains.length).toBeLessThanOrEqual(20);
      for (const chain of chains) {
        expect(chain.ownerOrganizationName).toBeTruthy();
        expect(chain.facilityCount).toBeGreaterThan(1);
      }
    }
  });

  it('passed Source Reconciliation on the last gate run (no fake green)', () => {
    expect(OWNERSHIP_NETWORK.reconciliation.status).toBe('PASS');
    expect(OWNERSHIP_NETWORK.reconciliation.claimAllowed).toBe(true);
    for (const check of OWNERSHIP_NETWORK.reconciliation.checks) {
      expect(check.ok).toBe(true);
    }
  });
});
