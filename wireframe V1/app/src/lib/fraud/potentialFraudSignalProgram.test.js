import { describe, expect, it } from 'vitest';
import {
  PotentialFraudSignalReview, PENDING_CASE_SIGNALS, SCREEN_PATTERNS, SIGNAL_WEIGHTS, SIGNAL_WEIGHT_RANGE, STARTING_TIER_CUTOFFS, TIER_CUTOFF_KEYS, TIER_CUTOFF_RANGE, TIER_RULE,
} from './potentialFraudSignalProgram.js';

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

const SERIES_COLUMNS = ['year', 'statePaid', 'billingNpis', 'newBillingNpis', 'top10Paid',
  'newBillingNpisEnumerationKnown', 'newBillingNpisRecentlyEnumerated', 'newBillingRecentlyEnumeratedPaid',
  'taxonomyKnownBillingNpis', 'taxonomyKnownPaid', 'offTaxonomyBillingNpis', 'offTaxonomyPaid'];

function radar(rows) {
  return {
    candidateColumns: COLS,
    candidates: rows,
    codeLabels: {},
    nationalPaidByYear: { 2024: 1e9 },
    seriesColumns: SERIES_COLUMNS,
    series: { 'KY|H2027': [
      [2022, 17.4e6, 55, 24, 9e6, 24, 11, 1.3e6, 55, 17.4e6, 10, 0.7e6],
      [2023, 57.8e6, 114, 64, 30e6, 64, 28, 4.5e6, 113, 57.7e6, 21, 2.5e6],
      [2024, 143e6, 172, 79, 84e6, 79, 37, 12.7e6, 171, 142.9e6, 36, 8.6e6],
    ] },
    expectedTaxonomiesByCode: { H2027: 17 },
    nppesRule: { recentEnumerationWindowYears: 2, expectedTaxonomyPaidCoverage: 0.9, source: 'NPPES test copy' },
    enrollmentShare: { 'KY|2022': 0.0182, 'KY|2023': 0.0181, 'KY|2024': 0.0177 },
    meanEnrollment: { KY: [[2022, 1573823, 12], [2023, 1590942, 12], [2024, 1437820, 12]] },
  };
}

function run(rows, rule = {}) {
  const p = new PotentialFraudSignalReview();
  p.Radar = radar(rows);
  if (rule.weights) p.SignalWeights = rule.weights;
  if (rule.cutoffs) p.TierCutoffs = rule.cutoffs;
  p.ScorePotentialFraudCandidates();
  return p;
}

const KY_ROWS = () => [row({ pattern: 'share-surge' }), row({ pattern: 'tripled-and-growing' })];

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

  it('gives every check a short label and counts the checks of each kind', () => {
    const p = run([row({ pattern: 'share-surge' }), row({ pattern: 'tripled-and-growing' }), row({ pattern: 'persistent-excess' })]);
    const ky = p.ServiceYears[0];
    expect(ky.checks.every((c) => typeof c.shortLabel === 'string' && c.shortLabel.length > 0)).toBe(true);
    expect(new Set(ky.checks.map((c) => c.shortLabel)).size).toBe(ky.checks.length);
    // KY fixture: excess, surge, tripled, persistent, new billers, recently enumerated (37 of 79) and concentration
    // fired; collapse, off-taxonomy (6%), displacement and states-billing clear; reporting incomplete to rule out;
    // six join checks pending.
    expect(ky.checkCounts).toEqual({ fired: 7, clear: 4, explain: 1, pending: 6 });
    expect(ky.publicCheckCount).toBe(12);
    expect(ky.dataCheckCount).toBe(6);
  });

  it('counts a too-early new-biller check as public, not as waiting on data', () => {
    const p = run([row({ year: 2019, pattern: 'share-surge' })]);
    const s = p.ServiceYears[0];
    expect(s.checks.find((c) => c.id === 'new-billers').kind).toBe('pending');
    expect(s.checks.find((c) => c.id === 'recently-enumerated').kind).toBe('pending');
    // The fixture series has no 2019 row, so the taxonomy check is pending too, and says so.
    expect(s.checks.find((c) => c.id === 'off-taxonomy')).toMatchObject({ kind: 'pending', detail: 'the export has no 2019 row for this service' });
    expect(s.checkCounts.pending).toBe(PENDING_CASE_SIGNALS.length + 3);
    expect(s.publicCheckCount).toBe(12);
    expect(s.dataCheckCount).toBe(PENDING_CASE_SIGNALS.length);
  });

  it('reads the NPPES counts from the series row and fires each check at its threshold', () => {
    const p = run([row({ pattern: 'share-surge' })]);
    const s = p.ServiceYears[0];
    expect(p.NppesCountsAreInRadar).toBe(true);
    expect(s.nppes).toMatchObject({ newBillersEnumerationKnown: 79, newBillersRecentlyEnumerated: 37, offTaxonomyBillers: 36, expectedTaxonomies: 17, countsAreKnown: true });
    expect(s.nppes.recentlyEnumeratedShare).toBeCloseTo(37 / 79);
    expect(s.nppes.offTaxonomyPaidShare).toBeCloseTo(8.6 / 142.9);
    const enumerated = s.checks.find((c) => c.id === 'recently-enumerated');
    expect(enumerated.kind).toBe('fired');
    expect(enumerated.detail).toMatch(/^37 of 79 new billers were enumerated in 2023 or 2024 \(46\.8%, \$12\.7M paid\) · NPPES test copy$/);
    const taxonomy = s.checks.find((c) => c.id === 'off-taxonomy');
    expect(taxonomy.kind).toBe('clear');
    expect(taxonomy.detail).toMatch(/36 of 171 billers, 6\.0% of paid \(\$8\.6M\), outside the 17 taxonomies that bill 90% of the code nationally/);
  });

  it('fires each NPPES check at its line and not just below it, and leaves the score and tier alone', () => {
    const at = (enumerated, offPaid) => {
      const r = radar([row({ pattern: 'share-surge' })]);
      r.series['KY|H2027'][2] = [2024, 143e6, 172, 79, 84e6, 100, enumerated, 1e6, 171, 100e6, 36, offPaid];
      const p = new PotentialFraudSignalReview();
      p.Radar = r;
      p.ScorePotentialFraudCandidates();
      const s = p.ServiceYears[0];
      return { s, kinds: [s.checks.find((c) => c.id === 'recently-enumerated').kind, s.checks.find((c) => c.id === 'off-taxonomy').kind] };
    };
    expect(at(40, 25e6).kinds).toEqual(['fired', 'fired']);
    expect(at(39, 24.99e6).kinds).toEqual(['clear', 'clear']);
    const without = (() => { const r = radar([row({ pattern: 'share-surge' })]); delete r.nppesRule; const p = new PotentialFraudSignalReview(); p.Radar = r; p.ScorePotentialFraudCandidates(); return p.ServiceYears[0]; })();
    for (const { s } of [at(40, 25e6), at(39, 24.99e6)]) {
      expect(s.score).toBe(without.score);
      expect(s.tier.key).toBe(without.tier.key);
    }
  });

  it('says when the off-taxonomy paid is net of adjustments, and words a one-year window', () => {
    const r = radar([row({ pattern: 'share-surge' })]);
    r.series['KY|H2027'][2] = [2024, 143e6, 172, 79, 84e6, 79, 37, 12.7e6, 171, 100e6, 36, -2e6];
    r.nppesRule = { ...r.nppesRule, recentEnumerationWindowYears: 1 };
    const p = new PotentialFraudSignalReview();
    p.Radar = r;
    p.ScorePotentialFraudCandidates();
    const s = p.ServiceYears[0];
    expect(s.checks.find((c) => c.id === 'off-taxonomy').detail).toMatch(/, net of adjustments\), outside/);
    const e = s.checks.find((c) => c.id === 'recently-enumerated');
    expect(e.label).toBe('New billers enumerated in the year');
    expect(e.detail).toMatch(/were enumerated in 2024 \(/);
  });

  it('reports a zero base as pending with the reason, never clear', () => {
    const r = radar([row({ pattern: 'share-surge' })]);
    r.series['KY|H2027'][2] = [2024, 143e6, 172, 79, 84e6, 0, 0, 0, 171, 0, 0, 0];
    const p = new PotentialFraudSignalReview();
    p.Radar = r;
    p.ScorePotentialFraudCandidates();
    const s = p.ServiceYears[0];
    expect(s.checks.find((c) => c.id === 'recently-enumerated')).toMatchObject({ kind: 'pending', detail: 'no new biller in 2024 has an NPPES enumeration date · NPPES test copy' });
    expect(s.checks.find((c) => c.id === 'off-taxonomy')).toMatchObject({ kind: 'pending', detail: 'no paid in 2024 from billers with an NPPES taxonomy · NPPES test copy' });
  });

  it('words the window from the rule the export carries', () => {
    const r = radar([row({ pattern: 'share-surge' })]);
    r.nppesRule = { ...r.nppesRule, recentEnumerationWindowYears: 3 };
    const p = new PotentialFraudSignalReview();
    p.Radar = r;
    p.ScorePotentialFraudCandidates();
    const c = p.ServiceYears[0].checks.find((x) => x.id === 'recently-enumerated');
    expect(p.RecentEnumerationWindowYears).toBe(3);
    expect(c.label).toBe('New billers enumerated in the year or the 2 years before');
    expect(c.detail).toMatch(/were enumerated in 2022 to 2024/);
  });

  it('leaves both NPPES checks pending on a radar without the counts, and counts them as public', () => {
    const p = new PotentialFraudSignalReview();
    const r = radar([row({ pattern: 'share-surge' })]);
    delete r.nppesRule;
    p.Radar = r;
    p.ScorePotentialFraudCandidates();
    const s = p.ServiceYears[0];
    expect(p.NppesCountsAreInRadar).toBe(false);
    expect(s.nppes.countsAreKnown).toBe(false);
    expect(s.checks.find((c) => c.id === 'off-taxonomy')).toMatchObject({ kind: 'pending', detail: 'the NPPES counts are not in this export' });
    expect(s.dataCheckCount).toBe(PENDING_CASE_SIGNALS.length);
    expect(s.publicCheckCount).toBe(12);
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
      row({ state: 'MT', hcpcs: 'S5126', pattern: 'persistent-excess', excessMultiple: 6, newBillingNpis: 0, top10Share: 0.2, paidAboveEnrollmentLevel: 40e6, reportingComplete: true }),
      row({ state: 'MT', hcpcs: 'T1019', pattern: 'share-collapse', paidAboveEnrollmentLevel: 5e6 }),
    ]);
    const y = p.YearSummaries[2024];
    expect(y.tiers.high).toEqual({ services: 1, aboveEnrollment: 139.8e6 });
    expect(y.tiers.convention).toEqual({ services: 1, aboveEnrollment: 40e6 });
    expect(y.tiers.lookback).toEqual({ services: 1, aboveEnrollment: 5e6 });
    expect(y.worthReviewServices).toBe(1);
    expect(y.worthReviewAboveEnrollment).toBe(139.8e6);
    expect(y.mostAboveEnrollmentIsConvention).toBe(false);
    expect(y.incompleteReportingServices).toBe(2);
    expect(y.patternServices).toEqual({ 'share-surge': 1, 'tripled-and-growing': 1, 'persistent-excess': 1, 'share-collapse': 1 });
    expect(Object.values(y.tiers).reduce((a, t) => a + t.aboveEnrollment, 0)).toBe(y.aboveEnrollment);
    const mt = p.StateYearSummaries['MT|2024'];
    expect(mt.tiers.convention).toEqual({ services: 1, aboveEnrollment: 40e6 });
    expect(mt.tiers.lookback.services).toBe(1);
    expect(mt.tiers.high.services + mt.tiers.verify.services).toBe(0);
    expect(mt.worthReviewAboveEnrollment).toBe(0);
    expect(mt.patternServices).toEqual({ 'share-surge': 0, 'tripled-and-growing': 0, 'persistent-excess': 1, 'share-collapse': 1 });
    expect(p.StateYearSummaries['KY|2024']).toMatchObject({ worthReviewServices: 1, worthReviewAboveEnrollment: 139.8e6 });
  });

  it('answers that most of a year above the line is convention when the CONVENTION? tier holds more than half', () => {
    const p = run([
      row({ state: 'MT', hcpcs: 'S5126', pattern: 'persistent-excess', excessMultiple: 6, newBillingNpis: 0, top10Share: 0.2, paidAboveEnrollmentLevel: 40e6 }),
      row({ pattern: 'share-surge', paidAboveEnrollmentLevel: 30e6 }),
    ]);
    expect(p.YearSummaries[2024].mostAboveEnrollmentIsConvention).toBe(true);
  });

  it('writes each signal strength as its points over its weight under the starting rule, all zero for a collapse-only row', () => {
    const p = run([
      row({ pattern: 'share-surge' }), row({ pattern: 'tripled-and-growing' }),
      row({ state: 'AZ', pattern: 'share-collapse', share: 0.076, peakShare: 0.70, peakShareYear: 2022 }),
    ]);
    const ky = p.ServiceYears.find((s) => s.state === 'KY');
    const az = p.ServiceYears.find((s) => s.state === 'AZ');
    expect(Object.keys(ky.signalStrength)).toEqual(Object.keys(SIGNAL_WEIGHTS));
    for (const k of Object.keys(SIGNAL_WEIGHTS)) expect(ky.signalStrength[k]).toBeCloseTo(ky.points[k] / SIGNAL_WEIGHTS[k]);
    expect(ky.signalStrength.shareSurge).toBe(1);
    expect(ky.signalStrength.persistentExcess).toBe(0);
    expect(Object.values(az.signalStrength).every((v) => v === 0)).toBe(true);
    expect(Object.keys(az.signalStrength)).toEqual(Object.keys(SIGNAL_WEIGHTS));
  });

  it('counts every screen pattern from zero, so a year with no surge still lists it', () => {
    const p = run([row({ state: 'MT', hcpcs: 'S5126', pattern: 'persistent-excess', excessMultiple: 6, newBillingNpis: 0, top10Share: 0.2 })]);
    expect(Object.keys(p.YearSummaries[2024].patternServices)).toEqual([...SCREEN_PATTERNS]);
    expect(p.YearSummaries[2024].patternServices['share-surge']).toBe(0);
  });

  it('counts only the screen patterns, so an unknown pattern adds no key', () => {
    const p = run([row({ pattern: 'share-surge' }), row({ pattern: 'not-a-screen-pattern' })]);
    expect(p.YearSummaries[2024].patternServices).toEqual({ 'share-surge': 1, 'tripled-and-growing': 0, 'persistent-excess': 0, 'share-collapse': 0 });
    expect(p.StateYearSummaries['KY|2024'].patternServices['share-surge']).toBe(1);
    expect(Object.keys(p.StateYearSummaries['KY|2024'].patternServices)).toEqual([...SCREEN_PATTERNS]);
  });
});

describe('PotentialFraudSignalReview score rule', () => {
  it('starts from the starting rule: SIGNAL_WEIGHTS, the 70 and 40 cut-offs, and TIER_RULE in force', () => {
    const fresh = new PotentialFraudSignalReview();
    expect(fresh.SignalWeights).toEqual(SIGNAL_WEIGHTS);
    expect(fresh.TierCutoffs).toEqual(STARTING_TIER_CUTOFFS);
    expect(fresh.ActiveTierRule).toEqual([]);
    expect(fresh.ScoreRuleIsStartingRule).toBe(false);
    const p = run(KY_ROWS());
    expect(p.ScoreRuleIsValid).toBe(true);
    expect(p.ScoreRuleIsStartingRule).toBe(true);
    expect(p.ActiveTierRule).toEqual(TIER_RULE);
    expect(p.SignalWeightsTotal).toBe(Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0));
    expect(TIER_RULE.find((x) => x.key === 'verify').test).toBe('signal score 40 to 69');
  });

  it('moves points, scores and tiers with the staged weights and cut-offs, and keeps each strength', () => {
    const base = run(KY_ROWS()).ServiceYears[0];
    const weights = { ...SIGNAL_WEIGHTS, shareSurge: 0, tripledAndGrowing: 0 };
    const p = run(KY_ROWS(), { weights, cutoffs: { high: 90, verify: 30 } });
    const ky = p.ServiceYears[0];
    expect(p.ScoreRuleIsStartingRule).toBe(false);
    expect(ky.signalStrength).toEqual(base.signalStrength);
    expect(ky.points.shareSurge).toBe(0);
    expect(ky.score).toBe(base.score - SIGNAL_WEIGHTS.shareSurge - SIGNAL_WEIGHTS.tripledAndGrowing);
    expect(base.tier.key).toBe('high');
    expect(ky.tier.key).toBe('verify');
    expect(p.ActiveTierRule.find((x) => x.key === 'high')).toMatchObject({ minScore: 90, test: 'signal score 90 or more' });
    expect(p.ActiveTierRule.find((x) => x.key === 'low').test).toBe('score under 30');
    expect(p.YearSummaries[2024].tiers.verify.services).toBe(1);
    expect(p.SignalWeightsTotal).toBe(Object.values(weights).reduce((a, b) => a + b, 0));
  });

  it('caps the signal score at 100 however many points the weights allow', () => {
    const weights = Object.fromEntries(Object.keys(SIGNAL_WEIGHTS).map((k) => [k, SIGNAL_WEIGHT_RANGE.max]));
    const p = run(KY_ROWS(), { weights });
    expect(p.ServiceYears[0].score).toBe(100);
    expect(p.SignalWeightsTotal).toBe(SIGNAL_WEIGHT_RANGE.max * Object.keys(SIGNAL_WEIGHTS).length);
  });

  it('accepts the edges of each range', () => {
    const weights = { ...SIGNAL_WEIGHTS, excessMultiple: SIGNAL_WEIGHT_RANGE.min, shareSurge: SIGNAL_WEIGHT_RANGE.max };
    const p = run(KY_ROWS(), { weights, cutoffs: { high: TIER_CUTOFF_RANGE.max, verify: TIER_CUTOFF_RANGE.min } });
    expect(p.ScoreRuleIsValid).toBe(true);
    expect(p.Errors).toEqual([]);
  });

  it('rejects a score rule out of range, unknown, incomplete or with VERIFY not below HIGH, and scores nothing', () => {
    const cases = [
      [{ cutoffs: { high: 50, verify: 50 } }, /VERIFY cut-off must be below the HIGH cut-off/],
      [{ cutoffs: { high: 101, verify: 40 } }, /HIGH cut-off must be a whole number from 1 to 100/],
      [{ cutoffs: { high: 70, verify: 0 } }, /VERIFY cut-off must be a whole number from 1 to 100/],
      [{ weights: { ...SIGNAL_WEIGHTS, shareSurge: 51 } }, /shareSurge points must be a whole number from 0 to 50/],
      [{ weights: { ...SIGNAL_WEIGHTS, newEntrants: 2.5 } }, /newEntrants points must be a whole number/],
      [{ weights: { ...SIGNAL_WEIGHTS, displacement: undefined } }, /displacement points must be a whole number/],
      [{ weights: { ...SIGNAL_WEIGHTS, units: 5 } }, /units is not a scored signal/],
    ];
    for (const [rule, message] of cases) {
      const p = run(KY_ROWS(), rule);
      expect(p.ScoreRuleIsValid, String(message)).toBe(false);
      expect(p.Errors.join(' ')).toMatch(message);
      expect(p.ServiceYears).toEqual([]);
      expect(p.ActiveTierRule).toEqual([]);
    }
  });

  it('restores run state on every run of one instance: an adjusted rule, a refused rule, then the starting rule as equal copies', () => {
    const p = new PotentialFraudSignalReview();
    p.Radar = radar(KY_ROWS());
    p.SignalWeights = { ...SIGNAL_WEIGHTS, shareSurge: 0 };
    p.TierCutoffs = { high: 60, verify: 30 };
    p.ScorePotentialFraudCandidates();
    expect(p.ScoreRuleIsValid).toBe(true);
    expect(p.ScoreRuleIsStartingRule).toBe(false);
    expect(p.ActiveTierRule.find((x) => x.key === 'high').minScore).toBe(60);
    p.TierCutoffs = { high: 40, verify: 40 };
    p.ScorePotentialFraudCandidates();
    expect(p.ScoreRuleIsValid).toBe(false);
    expect(p.ScoreRuleProblems).toEqual(['the VERIFY cut-off must be below the HIGH cut-off']);
    expect(p.ActiveTierRule).toEqual([]);
    expect(p.SignalWeightsTotal).toBe(0);
    expect(p.ServiceYears).toEqual([]);
    p.SignalWeights = { ...SIGNAL_WEIGHTS };
    p.TierCutoffs = { ...STARTING_TIER_CUTOFFS };
    p.ScorePotentialFraudCandidates();
    expect(p.ScoreRuleIsValid).toBe(true);
    expect(p.ScoreRuleProblems).toEqual([]);
    expect(p.Errors).toEqual([]);
    expect(p.ScoreRuleIsStartingRule).toBe(true);
    expect(p.ActiveTierRule).toEqual(TIER_RULE);
    expect(p.SignalWeightsTotal).toBe(Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0));
    expect(TIER_CUTOFF_KEYS).toEqual(['high', 'verify']);
  });
});
