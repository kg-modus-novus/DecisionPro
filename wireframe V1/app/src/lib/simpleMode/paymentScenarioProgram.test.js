import { describe, expect, it } from 'vitest';
import { PaymentRedistributionScenario } from './paymentScenarioProgram.js';

function run(share, { payments, index, gap } = {}) {
  const s = new PaymentRedistributionScenario();
  s.CountyPayments = payments || [
    { fips: 'a', paid: 100, metro: true },
    { fips: 'b', paid: 100, metro: false },
  ];
  s.CountyIndex = index || [{ fips: 'a', index: 20 }, { fips: 'b', index: 80 }];
  s.RedirectSharePct = share;
  if (Number.isFinite(gap)) {
    s.RuralUrbanPaymentGapIsPublished = true;
    s.RuralUrbanPaymentGapPct = gap;
  }
  s.ModelPaymentRedistribution();
  return s;
}

describe('PaymentRedistributionScenario', () => {
  it('redirects the chosen share and returns it by payment times deprivation, keeping the pool whole', () => {
    const s = run(10);
    expect(s.RedirectedTotal).toBe(20);
    const [a, b] = s.CountyOutcomes;
    expect(a.paidAfter).toBeCloseTo(90 + 20 * 0.2);
    expect(b.paidAfter).toBeCloseTo(90 + 20 * 0.8);
    expect(a.paidAfter + b.paidAfter).toBeCloseTo(200);
    expect(s.NonmetroShareBefore).toBe(50);
    expect(s.NonmetroShareAfter).toBeCloseTo(53);
    expect(s.NonmetroPaymentChangePct).toBeCloseTo(6);
    expect(s.MetroPaymentChangePct).toBeCloseTo(-6);
  });

  it('moves the published rural-vs-metro per-visit gap with the two totals', () => {
    const s = run(10, { gap: -5 });
    expect(s.RuralUrbanPaymentGapAfterPct).toBeCloseTo((0.95 * 1.06 / 0.94 - 1) * 100);
    expect(run(10).RuralUrbanPaymentGapAfterPct).toBe(0);
  });

  it('changes nothing at zero and refuses a share out of range', () => {
    expect(run(0).CountyOutcomes.every((o) => o.change === 0)).toBe(true);
    const bad = run(40);
    expect(bad.RedirectShareIsValid).toBe(false);
    expect(bad.CountyOutcomes).toEqual([]);
    expect(bad.Errors.length).toBe(1);
  });

  it('redirects nothing when no county has a deprivation weight, and says so', () => {
    const s = run(10, { index: [] });
    expect(s.DeprivationWeightIsPresent).toBe(false);
    expect(s.RedirectedTotal).toBe(0);
    expect(s.CountiesWithoutIndex).toBe(2);
    expect(s.Errors).toHaveLength(1);
  });

  it('counts counties left out for want of a published payment', () => {
    const s = run(10, { payments: [{ fips: 'a', paid: 100, metro: true }, { fips: 'b', paid: Number.NaN, metro: false }, { fips: 'c', paid: -5, metro: false }] });
    expect(s.CountiesWithoutPayment).toBe(2);
    expect(s.CountyOutcomes).toHaveLength(1);
  });

  it('starts every recompute from INITIAL values', () => {
    const s = run(10, { gap: -5 });
    s.RedirectSharePct = 0;
    s.ModelPaymentRedistribution();
    expect(s.RedirectedTotal).toBe(0);
    expect(s.Errors).toEqual([]);
    expect(s.RuralUrbanPaymentGapAfterPct).toBeCloseTo(-5);
  });
});
