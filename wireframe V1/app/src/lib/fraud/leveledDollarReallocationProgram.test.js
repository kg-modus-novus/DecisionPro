import { describe, expect, it } from 'vitest';
import { LeveledDollarReallocation } from './leveledDollarReallocationProgram.js';

const services = [
  { hcpcs: 'H2027', codeLabel: 'Psychoeducation', tier: { key: 'high' }, statePaid: 143e6, nationalPaid: 182.6e6, enrollmentShare: 0.0177, aboveEnrollment: 139.8e6, abovePriorShare: 85.8e6 },
  { hcpcs: '97535', codeLabel: 'Self-care training', tier: { key: 'verify' }, statePaid: 253.4e6, nationalPaid: 379.3e6, enrollmentShare: 0.0177, aboveEnrollment: 246.7e6, abovePriorShare: 12.1e6 },
];
const needs = [
  { id: 'a', label: 'Waiver slots', gap: 310e6, unitCost: 75_000, unitLabel: 'slots' },
  { id: 'b', label: 'Rates', gap: 140e6, unitCost: 0, unitLabel: '' },
];

function run(o = {}) {
  const m = new LeveledDollarReallocation();
  m.State = 'KY';
  m.Services = services;
  m.LatestYearStatePaid = { H2027: [['KY', 143e6], ['NY', 14.4e6], ['AZ', 13.9e6], ['OH', 3e6]], 97535: [['KY', 253.4e6], ['TX', 40e6]] };
  m.EnrollmentShareByState = { KY: 0.0177, NY: 0.08, AZ: 0.025, OH: 0.035, TX: 0.06 };
  m.FederalMatchingRate = 0.7178;
  m.Needs = needs;
  m.Allocations = { a: 100e6, b: 50e6 };
  Object.assign(m, o);
  m.ModelLeveledDollarReallocation();
  return m;
}

describe('LeveledDollarReallocation', () => {
  it('levels to the enrollment line, applies the upheld share and splits by FMAP', () => {
    const m = run();
    expect(m.DollarsAboveLine).toBeCloseTo(386.5e6);
    expect(m.UpheldDollars).toBeCloseTo(386.5e6 * 0.6);
    expect(m.FederalShare).toBeCloseTo(386.5e6 * 0.6 * 0.7178);
    expect(m.FederalShare + m.StateShare).toBeCloseTo(m.UpheldDollars);
    expect(m.AvailableDollars).toBeCloseTo(m.UpheldDollars);
    expect(m.SourcesOfFreedDollars[0].hcpcs).toBe('97535');
  });

  it('makes only the state share available when the dollars return to the General Fund', () => {
    const m = run({ Destination: 'general-fund' });
    expect(m.AvailableDollars).toBeCloseTo(m.StateShare);
    expect(m.AllocationIsOverAvailable).toBe(true);
  });

  it('keeps only the HIGH tier or one service when the scope says so, and uses the prior-year line', () => {
    expect(run({ Scope: 'high' }).ServicesInScope.map((s) => s.hcpcs)).toEqual(['H2027']);
    expect(run({ Scope: 'service:97535' }).DollarsAboveLine).toBeCloseTo(246.7e6);
    expect(run({ Line: 'prior-year' }).DollarsAboveLine).toBeCloseTo(97.9e6);
  });

  it('builds the peer-state line from the median ratio among other billing states', () => {
    const m = run({ Line: 'peer-state', Scope: 'service:H2027' });
    const ratios = [[14.4e6, 0.08], [13.9e6, 0.025], [3e6, 0.035]].map(([p, e]) => (p / 182.6e6) / e).sort((a, b) => a - b);
    const line = 182.6e6 * 0.0177 * ratios[1];
    expect(m.PeerLineByCode.H2027.peerStates).toBe(3);
    expect(m.DollarsAboveLine).toBeCloseTo(143e6 - line);
  });

  it('holds each allocation to its gap and counts illustrative people reached', () => {
    const m = run({ Allocations: { a: 999e6, b: -5 } });
    expect(m.NeedOutcomes[0].allocated).toBe(310e6);
    expect(m.NeedOutcomes[1].allocated).toBe(0);
    expect(m.NeedOutcomes[0].peopleReached).toBeCloseTo(310e6 / 75_000);
    expect(m.NeedOutcomes[1].peopleReached).toBe(0);
  });

  it('fits over-allocated needs to what is available, in proportion', () => {
    const m = run({ Destination: 'general-fund' });
    const fitted = Object.values(m.AllocationsFittedToAvailable).reduce((a, v) => a + v, 0);
    expect(fitted).toBeLessThanOrEqual(m.AvailableDollars);
    expect(fitted).toBeGreaterThan(m.AvailableDollars - 0.2e6);
    expect(m.AllocationsFittedToAvailable.a / m.AllocationsFittedToAvailable.b).toBeCloseTo(2, 1);
    expect(run().AllocationsFittedToAvailable).toEqual({ a: 100e6, b: 50e6 });
  });

  it('refuses an upheld share out of range or a state without a matching rate', () => {
    expect(run({ UpheldSharePct: 120 }).Errors).toHaveLength(1);
    const noRate = run({ FederalMatchingRate: 0 });
    expect(noRate.Errors).toHaveLength(1);
    expect(noRate.UpheldDollars).toBe(0);
  });
});
