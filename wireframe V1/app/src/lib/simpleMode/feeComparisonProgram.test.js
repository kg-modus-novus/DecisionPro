import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUNDLES, FeeComparison, stageClaimRow, stageRateRow, stageSpreadRow } from './feeComparisonProgram.js';

const fees = JSON.parse(readFileSync(new URL('./sourced/fees.json', import.meta.url), 'utf8'));
const rows = fees.measures.filter((m) => /medicaid-fee-pct-medicare$/.test(m.id)).flatMap((m) => m.rows);

function compare(code, setting, source = rows) {
  const c = new FeeComparison();
  c.RateRows = source.map(stageRateRow);
  c.SelectedCode = code;
  c.SelectedSetting = setting;
  c.CompareRatesOnNormalizedBasis();
  return c;
}

describe('FeeComparison (plan item #24)', () => {
  it.each(['99213', '90837', 'H0004', '97153', '77067'])('compares %s only like for like across every state in the research file', (code) => {
    for (const setting of ['non-facility', 'facility', 'n/a']) {
      const c = compare(code, setting);
      const units = new Set(c.ComparedRows.map((r) => r.unit));
      expect(units.size).toBeLessThanOrEqual(1);
      for (const r of c.ComparedRows) {
        expect(r.hcpcs).toBe(code);
        expect(r.setting).toBe(setting);
        expect(r.comparable).toBe(true);
        expect(r.primary).toBe(true);
        if (r.percentOfMedicareIsPublished && r.medicareAmount) expect(Math.abs((r.value / r.medicareAmount) * 100 - r.pctOfMedicare)).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('puts Kentucky’s 99213 office rate in the comparison', () => {
    const c = compare('99213', 'non-facility');
    expect(c.ComparedRows.some((r) => r.state === 'KY')).toBe(true);
    expect(c.ReferenceUnit).toBe('visit');
  });

  it('excludes charges, other units, codes defined differently and disagreeing percentages, with reasons', () => {
    const base = { hcpcs: 'X1', setting: 'non-facility', unit: 'visit', primary: true };
    const c = compare('X1', 'non-facility', [
      { ...base, state: 'KY', value: 50, medicareAmount: 100, pctOfMedicare: 50 },
      { ...base, state: 'IN', value: 60, medicareAmount: 100, pctOfMedicare: 60, posted: 'chargemaster price' },
      { ...base, state: 'OH', value: 15, medicareAmount: 100, pctOfMedicare: 15, unit: '15 min' },
      { ...base, state: 'VA', value: 70, medicareAmount: 100, pctOfMedicare: 70, comparable: false, comparableReason: 'opioid treatment counseling in VA' },
      { ...base, state: 'WV', value: 80, medicareAmount: 100, pctOfMedicare: 40 },
      { ...base, state: 'MO', value: 90, medicareAmount: 100, pctOfMedicare: 90, primary: false },
    ]);
    expect(c.ComparedRows.map((r) => r.state)).toEqual(['KY']);
    expect(c.ExcludedRows.map((x) => x.state).sort()).toEqual(['IN', 'OH', 'VA', 'WV']);
    expect(c.ExcludedRows.find((x) => x.state === 'VA').reason).toMatch(/opioid/);
  });

  it('excludes a charge only in the chosen setting, and does not mistake "discharge" for a charge', () => {
    const base = { hcpcs: 'X2', unit: 'visit', primary: true, medicareAmount: 100 };
    const c = compare('X2', 'non-facility', [
      { ...base, state: 'KY', setting: 'non-facility', value: 50, pctOfMedicare: 50, posted: '$50, includes discharge planning' },
      { ...base, state: 'IN', setting: 'facility', value: 60, pctOfMedicare: 60, posted: 'billed charges' },
    ]);
    expect(c.ComparedRows.map((r) => r.state)).toEqual(['KY']);
    expect(c.ExcludedRowCount).toBe(0);
  });

  it('keeps a rate with no published percent of Medicare, listed after those with one', () => {
    const base = { hcpcs: 'X3', setting: 'n/a', unit: '15 min', primary: true };
    const c = compare('X3', 'n/a', [{ ...base, state: 'MO', value: 16, pctOfMedicare: null }, { ...base, state: 'KY', value: 12, medicareAmount: 20, pctOfMedicare: 60 }]);
    expect(c.ComparedRows.map((r) => [r.state, r.percentOfMedicareIsPublished])).toEqual([['KY', true], ['MO', false]]);
  });

  it('asks for a code and setting before comparing', () => {
    const c = compare('', 'non-facility');
    expect(c.SelectionIsComplete).toBe(false);
    expect(c.ComparedRows).toEqual([]);
    expect(c.Errors).toHaveLength(1);
  });
});

describe('FeeComparison: dollars and bundles (#24, Secretary Sachdev)', () => {
  it('converts a rate posted only as a percent of Medicare to dollars and keeps the posting', () => {
    const base = { hcpcs: 'X4', setting: 'non-facility', unit: 'visit', primary: true, medicareAmount: 80 };
    const c = compare('X4', 'non-facility', [{ ...base, state: 'KY', value: null, pctOfMedicare: 75, posted: '75% of Medicare' }]);
    expect(c.ConvertedRowCount).toBe(1);
    expect(c.ComparedRows[0]).toMatchObject({ value: 60, convertedFromPercent: true, posted: '75% of Medicare' });
  });

  it('labels every compared rate with the one bundle its setting pays for', () => {
    for (const setting of ['non-facility', 'facility', 'n/a']) {
      const c = compare('99213', setting);
      expect(c.ComparedBundle).toBe(BUNDLES[setting]);
      for (const r of c.ComparedRows) expect(r.bundle).toBe(BUNDLES[setting]);
    }
  });
});

describe('FeeComparison: rate spreads between states', () => {
  const spreadOf = (id) => {
    const c = new FeeComparison();
    c.SpreadRows = fees.measures.find((m) => m.id === id).rows.map(stageSpreadRow);
    c.MeasureRateSpreadOnNormalizedBasis();
    return c;
  };

  it.each(['spread-psychotherapy-90837', 'spread-sud-h0004', 'spread-aba-97153'])('%s compares one unit, comparable posted rates only, and agrees with the research file', (id) => {
    const c = spreadOf(id);
    const published = fees.measures.find((m) => m.id === id).spread;
    expect(c.SpreadIsMeasurable).toBe(true);
    expect(new Set(c.SpreadCandidateRows.map((r) => r.unit)).size).toBe(1);
    for (const r of c.SpreadCandidateRows) expect(r.comparable && r.value > 0).toBe(true);
    expect(c.HighestToLowestRatio).toBeCloseTo(published.highestToLowest, 1);
    expect(c.KentuckySpreadRate).toBe(published.kyRate);
  });

  it('says why a spread cannot be measured when fewer than two neighbors post a comparable rate', () => {
    const c = spreadOf('spread-fqhc-visit');
    expect(c.SpreadIsMeasurable).toBe(false);
    expect(c.SpreadErrors).toHaveLength(1);
    expect(c.SpreadExcludedRows.length).toBeGreaterThan(0);
  });

  it('excludes another setting but keeps unsplit rates', () => {
    const base = { hcpcs: 'X5', unit: 'visit', comparable: true };
    const c = new FeeComparison();
    c.SpreadRows = [
      { ...base, key: 'KY', value: 50, setting: 'non-facility' },
      { ...base, key: 'IN', value: 60, setting: 'n/a' },
      { ...base, key: 'OH', value: 70, setting: 'non-facility' },
      { ...base, key: 'WV', value: 30, setting: 'facility' },
    ].map(stageSpreadRow);
    c.MeasureRateSpreadOnNormalizedBasis();
    expect(c.NeighborSpreadRows.map((r) => r.state)).toEqual(['OH', 'IN']);
    expect(c.SpreadExcludedRows.map((x) => x.state)).toEqual(['WV']);
  });
});

describe('FeeComparison: T-MSIS claim payments across states', () => {
  const tmsis = JSON.parse(readFileSync(new URL('./sourced/tmsis.json', import.meta.url), 'utf8'));

  it('ranks only states with claims and usable data, and finds Kentucky among them', () => {
    const m = tmsis.measures.find((x) => x.id === 'tmsis-99213-paid-per-line');
    const c = new FeeComparison();
    c.ClaimRows = m.rows.map(stageClaimRow);
    c.CompareClaimPaymentsAcrossStates();
    expect(c.ClaimComparedRowCount + c.ClaimExcludedRows.length).toBe(m.rows.length);
    for (const r of c.ClaimComparedRows) expect(r.dataUnusable).toBe(false);
    expect(c.KentuckyClaimRank).toBeGreaterThan(0);
    expect(c.ClaimComparedRows.map((r) => r.rank)).toEqual(c.ClaimComparedRows.map((_, i) => i + 1));
  });

  it('excludes a state CMS rates unusable and one with no claims', () => {
    const c = new FeeComparison();
    c.ClaimRows = [
      { key: 'KY', value: 40, claimLines: 100 },
      { key: 'AA', value: 90, claimLines: 100, dqFlag: 'unusable' },
      { key: 'BB', value: null, claimLines: 0 },
      { key: 'CC', value: 50, claimLines: 10 },
    ].map(stageClaimRow);
    c.CompareClaimPaymentsAcrossStates();
    expect(c.ClaimComparedRows.map((r) => r.key)).toEqual(['CC', 'KY']);
    expect(c.ClaimMedian).toBe(45);
    expect(c.KentuckyClaimRank).toBe(2);
  });
});
