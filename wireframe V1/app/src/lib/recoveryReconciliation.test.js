import { describe, expect, it } from 'vitest';
import { KY_RECOVERY_RECONCILIATION, recoveryReconciliationTotals } from '../data/alp/kyRecoveryReconciliation.js';

describe('Kentucky recovery reconciliation', () => {
  it('ships a governed six-plan public-source workpaper without claiming recovery', () => {
    const data = KY_RECOVERY_RECONCILIATION;
    const totals = recoveryReconciliationTotals(data.rows);

    expect(data.schema).toBe('decisionpro/ky-recovery-reconciliation/v1');
    expect(data.loadClass).toBe('REAL');
    expect(data.rows).toHaveLength(6);
    expect(totals.reportedCandidate).toBeCloseTo(5088460.77, 2);
    expect(totals.confirmedRecovered).toBe(0);
    expect(totals.awaitingEvidence).toBe(6);
    expect(data.rows.find((row) => row.id === 'united')).toMatchObject({
      reportedCandidate: 3196724.69,
      premiumRevenue: 800308816.10,
      evidenceStatus: 'Awaiting authorized recovery record',
      disposition: 'awaiting-evidence',
    });
    expect(data.rows.every((row) => !('person' in row) && !('memberId' in row) && !('providerName' in row))).toBe(true);
    expect(data.completionBoundary).toContain('Do not upload PHI');
    expect(data.planningEstimate).toMatchObject({
      estimateType: 'Planning sensitivity range; not a recovery forecast',
      lowRecoveryRate: 0.10,
      planningRecoveryRate: 0.25,
      highRecoveryRate: 0.50,
      reviewHoursPerPlanLow: 12,
      reviewHoursPerPlanHigh: 20,
    });
    expect(data.planningEstimate.justification).toContain('No public Kentucky recovery-rate series');
  });

  it('calculates only reviewer-confirmed recovered and outstanding totals', () => {
    const rows = KY_RECOVERY_RECONCILIATION.rows.map((row, index) => ({
      ...row,
      disposition: index === 0 ? 'recovered' : index === 1 ? 'outstanding' : row.disposition,
      recoveredAmount: index === 0 ? '100000.25' : '',
    }));
    expect(recoveryReconciliationTotals(rows)).toMatchObject({
      confirmedRecovered: 100000.25,
      confirmedOutstanding: 156710.83,
      awaitingEvidence: 4,
    });
  });
});
