import { describe, expect, it } from 'vitest';
import { PotentialFraudSignalReview, PENDING_CASE_SIGNALS } from './potentialFraudSignalProgram.js';

const COLS = ['state', 'hcpcs', 'year', 'pattern', 'statePaid', 'nationalPaid', 'share', 'enrollmentShare', 'excessMultiple',
  'priorYearShare', 'priorYearPaid', 'twoYearsPriorPaid', 'peakShare', 'peakShareYear', 'statesBilling',
  'billingNpis', 'newBillingNpis', 'top10Share', 'reportingComplete', 'knownCaseId',
  'paidAboveEnrollmentLevel', 'paidAbovePriorShareLevel'];

function row(o) {
  const d = {
    state: 'KY', hcpcs: 'H2027', year: 2024, pattern: 'share-surge', statePaid: 143e6, nationalPaid: 182.6e6, share: 0.7832, enrollmentShare: 0.0177,
    excessMultiple: 44.3, priorYearShare: 0.313, priorYearPaid: 57.8e6, twoYearsPriorPaid: 17.4e6, peakShare: 0.7832, peakShareYear: 2024, statesBilling: 15,
    billingNpis: 172, newBillingNpis: 79, top10Share: 0.59, reportingComplete: false, knownCaseId: '', paidAboveEnrollmentLevel: 139.8e6, paidAbovePriorShareLevel: 85.8e6, ...o,
  };
  return COLS.map((c) => d[c]);
}

function radar(rows) {
  return {
    candidateColumns: COLS,
    candidates: rows,
    codeLabels: {},
    nationalPaidByYear: { 2024: 1e9 },
    series: { 'KY|H2027': [[2022, 17.4e6, 55, 24, 9e6], [2023, 57.8e6, 114, 64, 30e6], [2024, 143e6, 172, 79, 84e6]] },
    enrollmentShare: { 'KY|2022': 0.0182, 'KY|2023': 0.0181, 'KY|2024': 0.0177 },
    meanEnrollment: { KY: [[2022, 1573823, 12], [2023, 1590942, 12], [2024, 1437820, 12]] },
  };
}

function run(rows) {
  const p = new PotentialFraudSignalReview();
  p.Radar = radar(rows);
  p.ScorePotentialFraudCandidates();
  return p;
}

describe('PotentialFraudSignalReview', () => {
  it('merges a service-year that met several patterns into one row carrying all of them', () => {
    const p = run([row({ pattern: 'share-surge' }), row({ pattern: 'tripled-and-growing' }), row({ pattern: 'persistent-excess' })]);
    expect(p.ServiceYears).toHaveLength(1);
    expect(p.ServiceYears[0].patterns).toEqual(['persistent-excess', 'share-surge', 'tripled-and-growing']);
  });

  it('finds displacement only when another state lost 10 points while this one gained 5', () => {
    const p = run([
      row({ pattern: 'share-surge' }),
      row({ state: 'AZ', pattern: 'share-collapse', share: 0.076, peakShare: 0.70, peakShareYear: 2022, knownCaseId: 'az-h2027-2024' }),
      row({ state: 'UT', pattern: 'share-collapse', share: 0.05, peakShare: 0.12, peakShareYear: 2022 }),
    ]);
    const ky = p.ServiceYears.find((s) => s.state === 'KY');
    expect(ky.displacement.state).toBe('AZ');
    expect(p.DisplacementCount).toBe(1);
    const small = run([row({ pattern: 'share-surge' }), row({ state: 'UT', pattern: 'share-collapse', share: 0.05, peakShare: 0.12 })]);
    expect(small.ServiceYears.find((s) => s.state === 'KY').displacementIsFound).toBe(false);
  });

  it('scores the Kentucky psychoeducation pattern HIGH and a known collapse CLOSED with no score', () => {
    const p = run([
      row({ pattern: 'share-surge' }), row({ pattern: 'tripled-and-growing' }), row({ pattern: 'persistent-excess' }),
      row({ state: 'AZ', pattern: 'share-collapse', share: 0.076, peakShare: 0.70, peakShareYear: 2022, knownCaseId: 'az-h2027-2024' }),
    ]);
    const ky = p.ServiceYears.find((s) => s.state === 'KY');
    const az = p.ServiceYears.find((s) => s.state === 'AZ');
    expect(ky.score).toBeGreaterThanOrEqual(90);
    expect(ky.tier.key).toBe('high');
    expect(az.score).toBe(0);
    expect(az.tier.key).toBe('closed');
    expect(p.ServiceYears[0].state).toBe('KY');
  });

  it('suggests CONVENTION? for a persistent-only service with few billers and no new entrants', () => {
    const p = run([row({ state: 'MT', hcpcs: 'S5126', pattern: 'persistent-excess', excessMultiple: 12, billingNpis: 8, newBillingNpis: 0, top10Share: 1, priorYearShare: 0.5, share: 0.5 })]);
    const mt = p.ServiceYears[0];
    expect(mt.points.concentration).toBe(0);
    expect(mt.score).toBeLessThan(40);
    expect(mt.tier.key).toBe('convention');
    expect(mt.checks.find((c) => c.label.startsWith('Dollars concentrated')).kind).toBe('explain');
  });

  it('lists every pending signal and marks fired ones from the owner figures', () => {
    const p = run([row({ pattern: 'share-surge' })]);
    const s = p.ServiceYears[0];
    expect(s.checks.filter((c) => c.kind === 'pending')).toHaveLength(PENDING_CASE_SIGNALS.length);
    expect(s.checks.find((c) => c.label.startsWith('Share at least doubled')).kind).toBe('fired');
    expect(s.checks.find((c) => c.label.startsWith('Paid tripled')).kind).toBe('clear');
  });

  it('says enrollment does not explain a rise that outran it', () => {
    const p = run([row({ pattern: 'share-surge' })]);
    const h = p.ServiceYears[0].health;
    expect(h.enrollmentShareIsFlat).toBe(true);
    expect(h.enrollmentChange1IsKnown).toBe(true);
    expect(h.enrollmentChange1).toBeLessThan(0);
    expect(h.paidChange2).toBeCloseTo(143 / 17.4 - 1);
    expect(h.riseIsUnexplainedByEnrollment).toBe(true);
  });

  it('summarizes each year over distinct service-years and refuses to run without a radar', () => {
    const p = run([row({ pattern: 'share-surge' }), row({ pattern: 'tripled-and-growing' }), row({ state: 'AZ', pattern: 'share-collapse', share: 0.076, peakShare: 0.7, statePaid: 13.9e6, paidAboveEnrollmentLevel: 9e6 })]);
    expect(p.YearSummaries[2024].services).toBe(2);
    expect(p.YearSummaries[2024].aboveEnrollment).toBeCloseTo(139.8e6 + 9e6);
    expect(p.StateYearSummaries['KY|2024'].leadingId).toBe('KY|H2027|2024');
    const empty = new PotentialFraudSignalReview();
    empty.ScorePotentialFraudCandidates();
    expect(empty.Errors).toHaveLength(1);
    expect(empty.ServiceYears).toHaveLength(0);
  });

  it('answers blow-ups and dates the rise from the screen figures', () => {
    const p = run([row({ pattern: 'share-surge', year: 2023, share: 0.313, priorYearShare: 0.12 }), row({ pattern: 'tripled-and-growing' }), row({ state: 'MT', hcpcs: 'S5126', pattern: 'persistent-excess' })]);
    const ky = p.ServiceYears.find((s) => s.id === 'KY|H2027|2024');
    expect(ky.isBlowup).toBe(true);
    expect(p.ServiceYears.find((s) => s.state === 'MT').isBlowup).toBe(false);
    expect(ky.riseEvents[0]).toMatchObject({ date: '2023', fit: 'start of rise' });
    expect(ky.riseEvents.find((e) => e.source === 'T-MSIS')).toMatchObject({ date: '2024', fit: 'matches' });
    expect(p.YearSummaries[2024].blowups).toBe(1);
  });

  it('leaves health answers false, not missing, when a figure is unknown', () => {
    const p = new PotentialFraudSignalReview();
    p.Radar = { ...radar([row({ state: 'TX', pattern: 'share-surge' })]), meanEnrollment: {}, series: {} };
    p.ScorePotentialFraudCandidates();
    const h = p.ServiceYears[0].health;
    expect(h.enrollmentChange2IsKnown).toBe(false);
    expect(h.riseIsUnexplainedByEnrollment).toBe(false);
    expect(h.enrollmentChange2).toBe(0);
  });

  it('measures each flagged program yearly series against its enrollment line, flagged years from the owner figures', () => {
    const p = new PotentialFraudSignalReview();
    p.Radar = { ...radar([row({ pattern: 'share-surge', year: 2023, share: 0.313, priorYearShare: 0.12 }), row({ pattern: 'tripled-and-growing' })]), nationalByCode: { H2027: { 2022: 175e6, 2023: 184.7e6, 2024: 182.6e6 } } };
    p.ScorePotentialFraudCandidates();
    const series = p.YearlySeriesByStateCode['KY|H2027'];
    expect(series.map((r) => r.year)).toEqual([2022, 2023, 2024]);
    const y2024 = series[2];
    expect(y2024.enrollmentLine).toBeCloseTo(182.6e6 * 0.0177);
    expect(y2024.timesEnrollmentLine).toBe(44.3);
    expect(y2024.top10Share).toBeCloseTo(84e6 / 143e6);
    expect(y2024).toMatchObject({ isFlagged: true, isBlowup: true, serviceYearId: 'KY|H2027|2024', enrollmentLineIsKnown: true, isFarAboveEnrollmentLine: true });
    const y2022 = series[0];
    expect(y2022).toMatchObject({ isFlagged: false, isBlowup: false, serviceYearId: '', enrollmentLineIsKnown: true });
    expect(y2022.timesEnrollmentLine).toBeCloseTo(17.4e6 / (175e6 * 0.0182));
    expect(y2022.isFarAboveEnrollmentLine).toBe(y2022.timesEnrollmentLine >= 5);
  });

  it('leaves an unmeasurable enrollment line at 0, marked unknown, never far above it', () => {
    const p = new PotentialFraudSignalReview();
    p.Radar = { ...radar([row({ pattern: 'share-surge' })]), enrollmentShare: { 'KY|2023': 0.0181 }, nationalByCode: { H2027: { 2022: 175e6, 2024: 182.6e6 } } };
    p.ScorePotentialFraudCandidates();
    const series = p.YearlySeriesByStateCode['KY|H2027'];
    const y2022 = series.find((r) => r.year === 2022);
    expect(y2022).toMatchObject({ enrollmentShareIsKnown: false, enrollmentLineIsKnown: false, enrollmentLine: 0, timesEnrollmentLine: 0, enrollmentShare: 0, isFarAboveEnrollmentLine: false });
    const y2023 = series.find((r) => r.year === 2023);
    expect(y2023).toMatchObject({ enrollmentShareIsKnown: true, nationalPaid: 0, enrollmentLineIsKnown: false, enrollmentLine: 0, isFarAboveEnrollmentLine: false });
  });

  it('totals each tier and the worth-review tiers by year and by state', () => {
    const p = run([
      row({ pattern: 'share-surge' }),
      row({ pattern: 'tripled-and-growing' }),
      row({ state: 'MT', hcpcs: 'S5126', pattern: 'persistent-excess', excessMultiple: 6, newBillingNpis: 0, top10Share: 0.2, paidAboveEnrollmentLevel: 40e6 }),
      row({ state: 'MT', hcpcs: 'T1019', pattern: 'share-collapse', paidAboveEnrollmentLevel: 5e6 }),
    ]);
    const y = p.YearSummaries[2024];
    expect(y.tiers.high).toEqual({ services: 1, aboveEnrollment: 139.8e6 });
    expect(y.tiers.convention).toEqual({ services: 1, aboveEnrollment: 40e6 });
    expect(y.tiers.lookback).toEqual({ services: 1, aboveEnrollment: 5e6 });
    expect(y.worthReviewServices).toBe(1);
    expect(y.worthReviewAboveEnrollment).toBe(139.8e6);
    expect(y.mostAboveEnrollmentIsConvention).toBe(false);
    expect(Object.values(y.tiers).reduce((a, t) => a + t.aboveEnrollment, 0)).toBe(y.aboveEnrollment);
    const mt = p.StateYearSummaries['MT|2024'];
    expect(mt.tiers.convention).toEqual({ services: 1, aboveEnrollment: 40e6 });
    expect(mt.tiers.lookback.services).toBe(1);
    expect(mt.tiers.high.services + mt.tiers.verify.services).toBe(0);
    expect(mt.worthReviewAboveEnrollment).toBe(0);
    expect(p.StateYearSummaries['KY|2024']).toMatchObject({ worthReviewServices: 1, worthReviewAboveEnrollment: 139.8e6 });
  });

  it('answers that most of a year above the line is convention when the CONVENTION? tier holds more than half', () => {
    const p = run([
      row({ state: 'MT', hcpcs: 'S5126', pattern: 'persistent-excess', excessMultiple: 6, newBillingNpis: 0, top10Share: 0.2, paidAboveEnrollmentLevel: 40e6 }),
      row({ pattern: 'share-surge', paidAboveEnrollmentLevel: 30e6 }),
    ]);
    expect(p.YearSummaries[2024].mostAboveEnrollmentIsConvention).toBe(true);
  });
});
