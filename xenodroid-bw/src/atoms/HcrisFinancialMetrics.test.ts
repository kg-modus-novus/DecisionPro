import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HcrisTotalMargin } from './HcrisFinancialMetrics.js';

// Warehouse atom tests use node:test (no vitest dependency in this package),
// matching FundingRunwayGovernanceAtoms.test.ts. Run: node --import tsx --test src/atoms/HcrisFinancialMetrics.test.ts

describe('HcrisTotalMargin', () => {
  it('uses the CMS G-3 total-revenue denominator instead of Total Income', () => {
    // Sample retained CMS HCRIS hospital row: the source Total Income equals
    // Net Income (-399,186), which caused the retired formula to return 100%.
    const margin = HcrisTotalMargin(-399_186, 7_049_190, 166_236);
    assert.ok(margin != null && Math.abs(margin - -0.0553) < 0.0001, `expected ≈ -0.0553, got ${margin}`);
  });

  it('does not impute a missing component or divide by zero', () => {
    assert.equal(HcrisTotalMargin(10, null, 2), null);
    assert.equal(HcrisTotalMargin(10, 5, -5), null);
  });
});
