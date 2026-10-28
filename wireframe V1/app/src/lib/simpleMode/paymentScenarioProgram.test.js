import { describe, expect, it } from 'vitest';
import { PaymentRedistributionScenario } from './paymentScenarioProgram.js';

function run(share) {
  const s = new PaymentRedistributionScenario();
  s.CountyPayments = [
    { fips: 'a', paid: 100, metro: true },
    { fips: 'b', paid: 100, metro: false },
  ];
  s.CountyIndex = [{ fips: 'a', index: 20 }, { fips: 'b', index: 80 }];
  s.RedirectSharePct = share;
  s.ModelPaymentRedistribution();
  return s;
}

describe('PaymentRedistributionScenario', () => {
  it('redirects the chosen share and returns it by payment times deprivation, keeping the pool whole', () => {
    const s = run(10);
    expect(s.RedirectedTotal).toBe(20);
    const [a, b] = s.CountyOutcomes;
    expect(a.after).toBeCloseTo(90 + 20 * 0.2);
    expect(b.after).toBeCloseTo(90 + 20 * 0.8);
    expect(a.after + b.after).toBeCloseTo(200);
    expect(s.NonmetroShareBefore).toBe(50);
    expect(s.NonmetroShareAfter).toBeCloseTo(53);
    expect(s.NonmetroPaymentChangePct).toBeCloseTo(6);
    expect(s.MetroPaymentChangePct).toBeCloseTo(-6);
  });

  it('changes nothing at zero and refuses a share out of range', () => {
    expect(run(0).CountyOutcomes.every((o) => o.change === 0)).toBe(true);
    const bad = run(40);
    expect(bad.RedirectShareIsValid).toBe(false);
    expect(bad.CountyOutcomes).toEqual([]);
    expect(bad.Errors.length).toBe(1);
  });

  it('starts every recompute from INITIAL values', () => {
    const s = run(10);
    s.RedirectSharePct = 0;
    s.ModelPaymentRedistribution();
    expect(s.RedirectedTotal).toBe(0);
    expect(s.Errors).toEqual([]);
  });
});
