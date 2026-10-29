import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PaymentDeprivationAssessment, stageQuarterRow, stageStateRow } from './paymentDeprivationProgram.js';

const rural = JSON.parse(readFileSync(new URL('./sourced/rural.json', import.meta.url), 'utf8'));
const byId = (id) => rural.measures.find((m) => m.id === id);

function assess({ quarters, countyRho, states, stateRho, n }) {
  const a = new PaymentDeprivationAssessment();
  a.QuarterRows = quarters.map(stageQuarterRow);
  a.CountyRankCorrelationIsPublished = Number.isFinite(countyRho);
  a.CountyRankCorrelation = Number.isFinite(countyRho) ? countyRho : 0;
  a.StateRows = (states || []).map(stageStateRow);
  a.StateRankCorrelationIsPublished = Number.isFinite(stateRho);
  a.StateRankCorrelation = Number.isFinite(stateRho) ? stateRho : 0;
  a.StatesCompared = n || 0;
  a.AssessPaymentDeprivationRelation();
  return a;
}

describe('PaymentDeprivationAssessment', () => {
  it('reads the research file: no county relation, a volume-driven gap, and no state relation', () => {
    const q = byId('office-visit-paid-per-visit-by-deprivation-quartile');
    const s = byId('fee-ratio-vs-deprivation-states');
    const a = assess({ quarters: q.rows, countyRho: q.correlation.sdi.spearmanRho, states: s.rows, stateRho: s.correlation.spearmanRho, n: s.correlation.n });
    expect(a.CountyRelation).toBe('none');
    expect(a.QuarterGapPercent).toBeLessThan(0);
    expect(a.GapIsVolumeDriven).toBe(true);
    expect(a.StateRelation).toBe('none');
    expect(a.KentuckyStateRow.deprivationRank).toBeGreaterThan(0);
  });

  it.each([[0.1, 'none'], [-0.25, 'weak'], [0.55, 'clear']])('classifies a rank correlation of %s as %s', (rho, relation) => {
    const a = assess({ quarters: [{ key: 'q1', value: 40, countyMedian: 40 }, { key: 'q4', value: 30, countyMedian: 31 }], countyRho: rho });
    expect(a.CountyRelation).toBe(relation);
    expect(a.GapIsVolumeDriven).toBe(false);
  });

  it('says nothing when the quarters or correlation are missing', () => {
    const a = assess({ quarters: [{ key: 'q1', value: 40 }], countyRho: null });
    expect(a.CountyAssessmentIsPossible).toBe(false);
    expect(a.CountyRelation).toBe('');
    expect(a.StateAssessmentIsPossible).toBe(false);
  });
});
