import { describe, expect, it } from 'vitest';
import {
  PotentialFraudSignalReview, EXPLANATION_KIND_BY_EVENT_KIND, EXPLANATION_KINDS, EXPLANATION_STANDINGS, PENDING_CASE_SIGNALS, SCREEN_PATTERNS, SIGNAL_WEIGHTS, SIGNAL_WEIGHT_RANGE, STARTING_TIER_CUTOFFS, TIER_CUTOFF_KEYS, TIER_CUTOFF_RANGE, TIER_RULE,
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

// ---- Policy events (law-and-policy layer, item 4) ----------------------------------------------------------

const POLICY_SCOPE_H = { hcpcs: [], hcpcsPrefixes: ['H'], allServices: false, basis: 'stands-in-for-service-family', note: 'Codes beginning with H stand in.' };

/** A confirmed Kentucky policy opening: prior authorization suspended in 2020, ended by a 2025 reinstatement. */
function policyEvent(o = {}) {
  return {
    id: 'ky-suspended-2020', state: 'KY', kind: 'authorization-or-limit', direction: 'expands', summary: 'Prior authorization suspended.',
    effectiveDate: '2020-02-04', effectivePrecision: 'day', endDate: '2025-06-25', endPrecision: 'day', endedBy: 'ky-reinstated-2025',
    scope: POLICY_SCOPE_H,
    source: { publisher: 'A publisher', title: 'A document', url: 'https://example.org/doc', documentDate: '2020-03-17', documentPrecision: 'day', quote: 'suspended' },
    standing: 'confirmed', confirmedBy: 'A Person', confirmedOn: '2026-11-11', sourceFile: 'KY.json', ...o,
  };
}

/** A permanent event (no end), for the lookback tests. */
const permanent = (o = {}) => policyEvent({ id: 'ky-permanent', kind: 'coverage', endDate: '', endPrecision: '', endedBy: '', ...o });

const policySearch = (o = {}) => ({ state: 'KY', source: 'A source', url: 'https://example.org/s', topic: 'a topic', searchedThrough: '2026-04-24', completeness: 'partial', sourceFile: 'KY.json', ...o });

function policyExport(events = [policyEvent()], searches = [policySearch()], rule = { lookbackMonths: 24 }) {
  return { schema: 'decisionpro/policy-events-export/v1', loadClass: 'REAL', loadHistoryId: 'LH-TEST', latestSearchedThrough: '2026-04-24', rule, events, searches };
}

/** Score the rows with a policy events export staged; adjust lets a test change the radar first. */
function runWithPolicy(rows, exported, adjust = () => {}) {
  const p = new PotentialFraudSignalReview();
  p.Radar = radar(rows);
  adjust(p.Radar);
  if (exported !== undefined) p.PolicyEventsExport = exported;
  p.ScorePotentialFraudCandidates();
  return p;
}

/** Kentucky psychoeducation as the screen really flags it: a small surge in 2019, quiet years, the large surge in 2023 and 2024. */
const KY_HISTORY = () => [
  row({ year: 2019, pattern: 'share-surge', excessMultiple: 6, newBillingNpis: 5, top10Share: 0.2 }),
  row({ year: 2020, pattern: 'tripled-and-growing', excessMultiple: 6, newBillingNpis: 5, top10Share: 0.2 }),
  row({ year: 2021, pattern: 'persistent-excess', excessMultiple: 6, newBillingNpis: 5, top10Share: 0.2 }),
  row({ year: 2022, pattern: 'persistent-excess', excessMultiple: 6, newBillingNpis: 5, top10Share: 0.2 }),
  row({ year: 2023, pattern: 'share-surge' }), row({ year: 2023, pattern: 'tripled-and-growing' }),
  row({ year: 2024, pattern: 'share-surge' }), row({ year: 2024, pattern: 'tripled-and-growing' }),
];
/** A rise and, two years on, a collapse-only year. */
const RISE_THEN_COLLAPSE = (knownCaseId = '') => [row({ year: 2022, pattern: 'tripled-and-growing', knownCaseId }), row({ year: 2024, pattern: 'share-collapse', knownCaseId })];
/**
 * A service with no blow-up, flagged for persistent excess in 2022, with a yearly series from firstYear: paid is
 * far above the enrollment line (ten times it) in the years listed in farAbove, and twice it in the others.
 */
const persistentOnly = (firstYear, farAbove) => (r) => {
  const years = [];
  for (let y = firstYear; y <= 2022; y += 1) years.push(y);
  r.nationalByCode = { H2027: Object.fromEntries(years.map((y) => [y, 100e6])) };
  r.enrollmentShare = Object.fromEntries(years.map((y) => [`KY|${y}`, 0.02]));
  r.series = { 'KY|H2027': years.map((y) => [y, farAbove.includes(y) ? 20e6 : 4e6, 30, 3, 5e6, 3, 1, 1e5, 30, 4e6, 2, 1e5]) };
};
const PERSISTENT_2022 = () => [row({ year: 2022, pattern: 'persistent-excess' })];
const at = (p, year, code = 'H2027', state = 'KY') => p.ServiceYears.find((s) => s.state === state && String(s.hcpcs) === code && s.year === year);
const timings = (s) => s.policyEvents.map((m) => `${m.event.id}:${m.timing}:${m.countsTowardExplanation}`);
const measures = (s) => [s.measurementArtifactMeasures, s.policyOpeningMeasures, s.intendedGrowthMeasures, s.restrictionMeasures];

describe('PotentialFraudSignalReview policy events', () => {
  it('reads every service-year as not-searched, and moves nothing, when no policy events export is staged', () => {
    const without = run(KY_ROWS());
    const p = runWithPolicy(KY_ROWS());
    expect([p.PolicyEventsAreLoaded, p.PolicyEventsProblem, p.PolicyEventLookbackMonths, p.PolicySearchedThrough]).toEqual([false, '', 0, '']);
    expect(p.PolicyEvents).toEqual([]);
    expect(p.PolicySearchCoverageByState).toEqual({});
    const s = p.ServiceYears[0];
    expect([s.explanationStanding, s.policySearchReachesChangeStart, s.fullPolicySearchReachesChangeStart, s.explainedReason]).toEqual(['not-searched', false, false, '']);
    expect([s.coveringPolicyEvents, s.policyEvents, s.laterPolicyEvents, s.suggestedPolicyEvents]).toEqual([[], [], [], []]);
    expect([...measures(s), s.suggestedEvents]).toEqual([0, 0, 0, 0, 0]);
    expect([s.tier.key, s.score]).toEqual([without.ServiceYears[0].tier.key, without.ServiceYears[0].score]);
    expect(p.Errors).toEqual([]);
  });

  it('says why a staged export cannot be used, still scores, and decides nothing from it', () => {
    const artifact = policyEvent({ kind: 'code-change', effectiveDate: '2024-01-01', endDate: '', endedBy: '' });
    const cases = [
      [{ ...policyExport([artifact]), schema: 'something-else' }, /is not decisionpro\/policy-events-export\/v1/],
      [{ ...policyExport([artifact]), events: undefined }, /no list of events or of searches/],
      [{ ...policyExport([artifact]), searches: 'none' }, /no list of events or of searches/],
      [policyExport([artifact], [policySearch()], {}), /lookback months/],
      [policyExport([artifact], [policySearch()], { lookbackMonths: 0 }), /lookback months/],
      [policyExport([artifact], [policySearch()], { lookbackMonths: 24.5 }), /lookback months/],
      [policyExport([{ ...artifact, kind: 'a-new-kind' }]), /an event this program cannot read/],
      [policyExport([{ ...artifact, direction: 'sideways' }]), /an event this program cannot read/],
      [policyExport([{ ...artifact, standing: 'approved' }]), /an event this program cannot read/],
      [policyExport([{ ...artifact, effectiveDate: '2024-01' }]), /an event this program cannot read/],
      [policyExport([{ ...artifact, endDate: 'mid-2025' }]), /an event this program cannot read/],
      [policyExport([{ ...artifact, endedBy: 'another-event' }]), /an event this program cannot read/],
      [policyExport([{ ...artifact, scope: { hcpcs: ['H2027'] } }]), /an event this program cannot read/],
      [policyExport([{ ...artifact, scope: { ...POLICY_SCOPE_H, hcpcsPrefixes: [''] } }]), /an event this program cannot read/],
      [policyExport([{ ...artifact, scope: { ...POLICY_SCOPE_H, hcpcs: [97153] } }]), /an event this program cannot read/],
      [policyExport([{ ...artifact, id: '' }]), /an event this program cannot read/],
      [policyExport([artifact], [policySearch({ completeness: 'thorough' })]), /a search this program cannot read/],
      [policyExport([artifact], [policySearch({ searchedThrough: '2026-04' })]), /a search this program cannot read/],
    ];
    for (const [exported, problem] of cases) {
      const p = runWithPolicy(KY_ROWS(), exported);
      expect(p.PolicyEventsAreLoaded).toBe(false);
      expect(p.PolicyEventsProblem).toMatch(problem);
      expect(p.Errors).toEqual([]);
      const s = p.ServiceYears[0];
      expect([s.tier.key, s.explanationStanding, s.measurementArtifactMeasures, s.policyEvents.length]).toEqual(['high', 'not-searched', 0, 0]);
    }
  });

  it('reads the rule and the search coverage the export carries', () => {
    const p = runWithPolicy(KY_ROWS(), policyExport([policyEvent()], [
      policySearch({ searchedThrough: '2025-01-31' }), policySearch({ topic: 'another topic', searchedThrough: '2026-04-24' }),
      policySearch({ topic: 'a full one', searchedThrough: '2024-06-30', completeness: 'full' }),
      policySearch({ state: 'AZ', searchedThrough: '2024-12-31', completeness: 'full' }),
    ], { lookbackMonths: 12 }));
    expect([p.PolicyEventsAreLoaded, p.PolicyEventsProblem, p.PolicyEventLookbackMonths, p.PolicySearchedThrough]).toEqual([true, '', 12, '2026-04-24']);
    expect(p.PolicySearchCoverageByState).toEqual({
      KY: { state: 'KY', searches: 3, searchedThrough: '2026-04-24', fullSearches: 1, fullSearchedThrough: '2024-06-30' },
      AZ: { state: 'AZ', searches: 1, searchedThrough: '2024-12-31', fullSearches: 1, fullSearchedThrough: '2024-12-31' },
    });
    expect(p.PolicyEvents).toHaveLength(1);
    expect(p.PolicyEvents[0]).toMatchObject({ id: 'ky-suspended-2020', explanationKind: 'policy-opening', isTemporary: true, measureId: 'ended-by:ky-reinstated-2025' });
    expect([Object.isFrozen(p.PolicyEvents), Object.isFrozen(p.PolicyEvents[0]), Object.isFrozen(p.PolicySearchCoverageByState), Object.isFrozen(p.PolicySearchCoverageByState.KY)]).toEqual([true, true, true, true]);
  });

  it('starts a rise in the first year of the latest run of blow-up years, not the first year the screen ever flagged the service', () => {
    const p = runWithPolicy(KY_HISTORY());
    expect([2019, 2020, 2021, 2022, 2023, 2024].map((y) => [at(p, y).changeStartYear, at(p, y).changeStartIsKnown])).toEqual([[2019, true], [2019, true], [2019, true], [2019, true], [2023, true], [2023, true]]);
    // A blow-up later than the service-year is not its rise.
    const later = runWithPolicy([row({ year: 2022, pattern: 'persistent-excess' }), row({ year: 2023, pattern: 'share-surge' })], undefined, persistentOnly(2020, [2022]));
    expect([at(later, 2022).changeStartYear, at(later, 2023).changeStartYear]).toEqual([2022, 2023]);
    // The screen's own dated events agree: the first surge is an earlier surge once a later rise has its own start.
    const screenEvents = (s) => s.riseEvents.filter((e) => e.source === 'T-MSIS screen').map((e) => [e.date, e.event, e.fit]);
    expect(screenEvents(at(p, 2024))).toEqual([['2019', 'Screen first flags a surge', 'earlier surge'], ['2023', 'The rise this year belongs to starts', 'start of rise']]);
    expect(screenEvents(at(p, 2021))).toEqual([['2019', 'Screen first flags a surge', 'start of rise']]);
  });

  it('starts a rise with no blow-up where paid first ran far above the enrollment line, and says when that is before the figures begin', () => {
    const start = (firstYear, farAbove) => {
      const s = at(runWithPolicy(PERSISTENT_2022(), undefined, persistentOnly(firstYear, farAbove)), 2022);
      return [s.changeStartYear, s.changeStartIsKnown];
    };
    // Twice the line in 2019, far above from 2020: the rise starts in 2020.
    expect(start(2018, [2020, 2021, 2022])).toEqual([2020, true]);
    // Far above only in the flagged year itself.
    expect(start(2018, [2022])).toEqual([2022, true]);
    // An earlier, separate excess does not move the start of this run.
    expect(start(2018, [2018, 2020, 2021, 2022])).toEqual([2020, true]);
    // Far above in every year on file: the excess predates the figures, so its start is not known.
    expect(start(2018, [2018, 2019, 2020, 2021, 2022])).toEqual([2018, false]);
    expect(start(2020, [2020, 2021, 2022])).toEqual([2020, false]);
    // The first year on file is the flagged year: nothing before it to compare.
    expect(start(2022, [2022])).toEqual([2022, false]);
    // No series row for the year at all: the first flagged year, not known.
    const bare = at(runWithPolicy(PERSISTENT_2022(), undefined, (r) => { r.series = {}; }), 2022);
    expect([bare.changeStartYear, bare.changeStartIsKnown]).toEqual([2022, false]);
    // A year with paid and no measurable line before the run leaves the start not known.
    const noLine = at(runWithPolicy(PERSISTENT_2022(), undefined, (r) => { persistentOnly(2020, [2021, 2022])(r); delete r.enrollmentShare['KY|2020']; }), 2022);
    expect([noLine.changeStartYear, noLine.changeStartIsKnown]).toEqual([2021, false]);
    // A year with a row and nothing paid before the run: the service was not far above any line, so the start is known.
    const nothingPaid = at(runWithPolicy(PERSISTENT_2022(), undefined, (r) => { persistentOnly(2020, [2021, 2022])(r); delete r.enrollmentShare['KY|2020']; r.series['KY|H2027'][0][1] = 0; }), 2022);
    expect([nothingPaid.changeStartYear, nothingPaid.changeStartIsKnown]).toEqual([2021, true]);
    // A service whose own figures begin at the run, in a year after the file begins, began then: the start is known.
    const otherSeries = (firstYear) => (r) => { r.series['AZ|H2027'] = [[firstYear, 1e6, 5, 0, 5e5, 0, 0, 0, 5, 1e6, 0, 0]]; };
    const newService = at(runWithPolicy(PERSISTENT_2022(), undefined, (r) => { persistentOnly(2020, [2020, 2021, 2022])(r); otherSeries(2018)(r); }), 2022);
    expect([newService.changeStartYear, newService.changeStartIsKnown]).toEqual([2020, true]);
    // The same service when the file itself begins that year: the year before is not on file, so the start is not known.
    const fileBegins = at(runWithPolicy(PERSISTENT_2022(), undefined, (r) => { persistentOnly(2020, [2020, 2021, 2022])(r); otherSeries(2020)(r); }), 2022);
    expect([fileBegins.changeStartYear, fileBegins.changeStartIsKnown]).toEqual([2020, false]);
    // A year missing inside the service's own figures: nothing was paid in it, so the run after it has a known start.
    const gap = at(runWithPolicy(PERSISTENT_2022(), undefined, (r) => { persistentOnly(2018, [2018, 2019, 2021, 2022])(r); r.series['KY|H2027'] = r.series['KY|H2027'].filter((x) => x[0] !== 2020); }), 2022);
    expect([gap.changeStartYear, gap.changeStartIsKnown]).toEqual([2021, true]);
  });

  it('counts nothing but a restriction when the start of the excess is not known', () => {
    const stage = (event) => at(runWithPolicy(PERSISTENT_2022(), policyExport([event]), persistentOnly(2018, [2018, 2019, 2020, 2021, 2022])), 2022);
    const opening = stage(policyEvent());
    expect(timings(opening)).toEqual(['ky-suspended-2020:start-unknown:false']);
    expect([measures(opening), opening.policyOpeningMayExplainRise, opening.explanationStanding]).toEqual([[0, 0, 0, 0], false, 'partly-searched']);
    const artifact = stage(permanent({ kind: 'reporting-change', effectiveDate: '2021-01-01' }));
    expect([timings(artifact), artifact.tier.key, artifact.explanationStanding]).toEqual([['ky-permanent:start-unknown:false'], run(PERSISTENT_2022()).ServiceYears[0].tier.key, 'partly-searched']);
    const restriction = stage(permanent({ kind: 'enforcement', direction: 'restricts', effectiveDate: '2021-05-01' }));
    expect([timings(restriction), measures(restriction), restriction.explanationStanding]).toEqual([['ky-permanent:start-unknown:true'], [0, 0, 0, 1], 'restriction']);
    // The same events match as when the start is known, against the earliest year of the run (2018): a permanent
    // change older than the lookback is not matched, a restriction included, and a temporary measure that ended earlier is not.
    const tooOld = stage(permanent({ kind: 'enforcement', direction: 'restricts', effectiveDate: '2009-07-01' }));
    expect([timings(tooOld), measures(tooOld), tooOld.explanationStanding]).toEqual([[], [0, 0, 0, 0], 'partly-searched']);
    expect(tooOld.coveringPolicyEvents.map((m) => m.timing)).toEqual(['']);
    expect(timings(stage(permanent({ kind: 'enforcement', direction: 'restricts', effectiveDate: '2016-01-01' })))).toEqual(['ky-permanent:start-unknown:true']);
    expect(timings(stage(permanent({ kind: 'enforcement', direction: 'restricts', effectiveDate: '2015-12-31' })))).toEqual([]);
    expect(timings(stage(policyEvent({ effectiveDate: '2012-01-01', endDate: '2017-12-31' })))).toEqual([]);
    // A search has to reach the service-year itself when the start is not known.
    const search = (searchedThrough, completeness) => at(runWithPolicy(PERSISTENT_2022(), policyExport([], [policySearch({ searchedThrough, completeness })]), persistentOnly(2018, [2018, 2019, 2020, 2021, 2022])), 2022).explanationStanding;
    expect([search('2018-12-31', 'full'), search('2022-12-30', 'full'), search('2022-12-31', 'full'), search('2022-12-31', 'partial')]).toEqual(['not-searched', 'not-searched', 'none-found', 'partly-searched']);
    // An event after the service-year is still later.
    expect(stage(permanent({ effectiveDate: '2023-01-01' })).laterPolicyEvents.map((m) => m.timing)).toEqual(['later']);
  });

  it('starts a collapse-only service-year at its fall: the first of the collapse years in a row', () => {
    const p = runWithPolicy([
      row({ year: 2020, pattern: 'tripled-and-growing' }), row({ year: 2021, pattern: 'persistent-excess' }), row({ year: 2021, pattern: 'share-collapse' }),
      row({ year: 2022, pattern: 'share-collapse' }), row({ year: 2023, pattern: 'share-collapse' }),
    ]);
    // 2021 met the collapse pattern beside another, so it still shows the rise; 2022 and 2023 show the fall that began in 2021.
    expect([2020, 2021, 2022, 2023].map((y) => [at(p, y).collapseOnly, at(p, y).changeStartYear, at(p, y).changeStartIsKnown])).toEqual([[false, 2020, true], [false, 2020, true], [true, 2021, true], [true, 2021, true]]);
    const fell = runWithPolicy(RISE_THEN_COLLAPSE());
    expect([at(fell, 2022).changeStartYear, at(fell, 2024).changeStartYear]).toEqual([2022, 2024]);
    expect(at(fell, 2024).riseEvents.filter((e) => e.source === 'T-MSIS screen').map((e) => [e.date, e.fit])).toEqual([['2022', 'earlier surge']]);
    // Collapse years with a year between them are two falls: the later one starts where its own run does.
    const twice = runWithPolicy([row({ year: 2020, pattern: 'share-collapse' }), row({ year: 2021, pattern: 'share-collapse' }), row({ year: 2023, pattern: 'share-collapse' }), row({ year: 2024, pattern: 'share-collapse' })]);
    expect([2020, 2021, 2023, 2024].map((y) => at(twice, y).changeStartYear)).toEqual([2020, 2020, 2023, 2023]);
    // A surge that comes after the service-year is a later surge, never the start of that year's rise.
    const surgeLater = runWithPolicy([row({ year: 2021, pattern: 'share-collapse' }), row({ year: 2022, pattern: 'persistent-excess' }), row({ year: 2023, pattern: 'share-surge' })]);
    const screenFits = (s) => s.riseEvents.filter((e) => e.source === 'T-MSIS screen').map((e) => [e.date, e.fit]);
    expect([screenFits(at(surgeLater, 2021)), screenFits(at(surgeLater, 2022)), screenFits(at(surgeLater, 2023))]).toEqual([[['2023', 'later surge']], [['2023', 'later surge']], [['2023', 'start of rise']]]);
  });

  it('carries the Kentucky suspension as a policy opening in force when the 2023 rise starts, counts the continuing measure once, and leaves the tier HIGH', () => {
    const kept = policyEvent({ id: 'ky-kept-suspended-2023', effectiveDate: '2023-04-25' });
    const without = runWithPolicy(KY_HISTORY());
    const p = runWithPolicy(KY_HISTORY(), policyExport([kept, policyEvent()]));
    for (const year of [2023, 2024]) {
      const s = at(p, year);
      expect(timings(s)).toEqual(['ky-suspended-2020:in-force:true', 'ky-kept-suspended-2023:same-year:true']);
      expect(measures(s)).toEqual([0, 1, 0, 0]);
      expect([s.policyOpeningMayExplainRise, s.measurementArtifactExplainsChange, s.explanationStanding, s.explainedReason]).toEqual([true, false, 'opening', '']);
      expect([s.tier.key, s.score]).toEqual(['high', at(without, year).score]);
    }
    // The 2019 rise began before the suspension: the event is carried from 2020 on and explains nothing there.
    expect(timings(at(p, 2019))).toEqual([]);
    expect(at(p, 2019).laterPolicyEvents.map((m) => m.event.id)).toEqual(['ky-suspended-2020', 'ky-kept-suspended-2023']);
    expect(timings(at(p, 2021))).toEqual(['ky-suspended-2020:after-start:false']);
    expect([at(p, 2021).policyOpeningMeasures, at(p, 2021).explanationStanding]).toEqual([0, 'partly-searched']);
    // Two measures that different events end are two openings.
    const two = runWithPolicy(KY_HISTORY(), policyExport([policyEvent(), policyEvent({ id: 'ky-other-2022', effectiveDate: '2022-06-01', endedBy: 'ky-other-ended' })]));
    expect(at(two, 2024).policyOpeningMeasures).toBe(2);
  });

  it('times an event against the year the rise starts and the lookback the rule carries', () => {
    // The rise starts in 2023 and the service-year is 2024.
    const timing = (event, rule = { lookbackMonths: 24 }) => {
      const s = at(runWithPolicy(KY_HISTORY(), policyExport([event], [policySearch()], rule)), 2024);
      return s.policyEvents[0]?.timing ?? (s.laterPolicyEvents.length ? 'later' : 'not matched');
    };
    expect(timing(permanent({ effectiveDate: '2020-12-31' }))).toBe('not matched');
    expect(timing(permanent({ effectiveDate: '2021-01-01' }))).toBe('before');
    expect(timing(permanent({ effectiveDate: '2022-12-31' }))).toBe('before');
    expect(timing(permanent({ effectiveDate: '2023-01-01' }))).toBe('same-year');
    expect(timing(permanent({ effectiveDate: '2023-12-31' }))).toBe('same-year');
    expect(timing(permanent({ effectiveDate: '2024-01-01' }))).toBe('after-start');
    expect(timing(permanent({ effectiveDate: '2024-12-31' }))).toBe('after-start');
    expect(timing(permanent({ effectiveDate: '2025-01-01' }))).toBe('later');
    // The lookback is the rule's, not a constant of this program.
    expect(timing(permanent({ effectiveDate: '2021-12-31' }), { lookbackMonths: 12 })).toBe('not matched');
    expect(timing(permanent({ effectiveDate: '2022-01-01' }), { lookbackMonths: 12 })).toBe('before');
    expect(timing(permanent({ effectiveDate: '2021-07-01' }), { lookbackMonths: 18 })).toBe('before');
    expect(timing(permanent({ effectiveDate: '2021-06-30' }), { lookbackMonths: 18 })).toBe('not matched');
    expect(timing(permanent({ effectiveDate: '2022-12-01' }), { lookbackMonths: 1 })).toBe('before');
    expect(timing(permanent({ effectiveDate: '2022-11-30' }), { lookbackMonths: 1 })).toBe('not matched');
    // A temporary measure counts while it is in force when the rise starts, however long ago it began.
    expect(timing(policyEvent({ effectiveDate: '2012-01-01', endDate: '2023-01-01' }))).toBe('in-force');
    expect(timing(policyEvent({ effectiveDate: '2022-12-31', endDate: '2023-06-30' }))).toBe('in-force');
    expect(timing(policyEvent({ effectiveDate: '2022-06-01', endDate: '2022-12-31' }))).toBe('not matched');
    expect(timing(policyEvent({ effectiveDate: '2023-01-01', endDate: '2023-03-01' }))).toBe('same-year');
    expect(timing(policyEvent({ effectiveDate: '2023-02-01', endDate: '2023-03-01' }))).toBe('same-year');
    expect(timing(policyEvent({ effectiveDate: '2024-02-01', endDate: '2024-03-01' }))).toBe('after-start');
    // An event that kept no timing is still listed as covering the service.
    const tooOld = at(runWithPolicy(KY_HISTORY(), policyExport([permanent({ effectiveDate: '2020-12-31' })])), 2024);
    expect(tooOld.coveringPolicyEvents.map((m) => [m.event.id, m.timing, m.countsTowardExplanation])).toEqual([['ky-permanent', '', false]]);
  });

  it('matches an event only to its own state, or the nation, and only to a code its scope covers', () => {
    const matches = (event, code = 'H2027', state = 'KY') => {
      const p = runWithPolicy([row({ state, hcpcs: code, year: 2023, pattern: 'share-surge' })], policyExport([event]));
      return p.ServiceYears[0].policyEvents.length === 1;
    };
    const scope = (o) => policyEvent({ scope: { hcpcs: [], hcpcsPrefixes: [], allServices: false, basis: 'named-in-document', note: '', ...o } });
    expect(matches(scope({ hcpcs: ['H2027', 'H0038'] }))).toBe(true);
    expect(matches(scope({ hcpcs: ['H0038'] }))).toBe(false);
    expect(matches(scope({ hcpcsPrefixes: ['H20'] }))).toBe(true);
    expect(matches(scope({ hcpcsPrefixes: ['T'] }))).toBe(false);
    expect(matches(scope({ allServices: true }))).toBe(true);
    expect(matches(scope({ allServices: true }), 'T1019')).toBe(true);
    // The radar carries some codes as numbers.
    expect(matches(scope({ hcpcsPrefixes: ['9'] }), 97153)).toBe(true);
    expect(matches(scope({ hcpcs: ['97153'] }), 97153)).toBe(true);
    expect(matches(policyEvent(), 'H2027', 'AZ')).toBe(false);
    expect(matches(policyEvent({ state: 'US' }), 'H2027', 'AZ')).toBe(true);
  });

  it('names each event kind and direction one kind of explanation, and has an answer for every kind the owner allows', () => {
    const kinds = ['coverage', 'rate', 'authorization-or-limit', 'eligibility', 'code-change', 'reporting-change', 'funding', 'enforcement', 'governance', 'external-flag'];
    expect(Object.keys(EXPLANATION_KIND_BY_EVENT_KIND).sort()).toEqual([...kinds].sort());
    for (const kind of kinds) {
      expect(Object.keys(EXPLANATION_KIND_BY_EVENT_KIND[kind])).toEqual(['expands', 'restricts', 'unstated']);
      for (const explanation of Object.values(EXPLANATION_KIND_BY_EVENT_KIND[kind])) expect(EXPLANATION_KINDS).toContain(explanation);
    }
    const kindOf = (kind, direction) => EXPLANATION_KIND_BY_EVENT_KIND[kind][direction];
    expect([kindOf('code-change', 'unstated'), kindOf('reporting-change', 'restricts')]).toEqual(['measurement-artifact', 'measurement-artifact']);
    expect([kindOf('authorization-or-limit', 'expands'), kindOf('authorization-or-limit', 'restricts'), kindOf('authorization-or-limit', 'unstated')]).toEqual(['policy-opening', 'restriction', 'context']);
    for (const kind of ['coverage', 'rate', 'eligibility', 'funding']) expect([kindOf(kind, 'expands'), kindOf(kind, 'restricts'), kindOf(kind, 'unstated')]).toEqual(['intended-growth', 'restriction', 'context']);
    expect(['expands', 'restricts', 'unstated'].map((d) => kindOf('enforcement', d))).toEqual(['restriction', 'restriction', 'restriction']);
    expect([kindOf('governance', 'expands'), kindOf('external-flag', 'restricts')]).toEqual(['context', 'context']);
  });

  it('counts an opening, intended growth or an artifact only when it could explain the rise, a restriction whenever it is on file by the service-year, and context never', () => {
    const counts = (event, rows = KY_HISTORY(), year = 2024) => {
      const s = at(runWithPolicy(rows, policyExport([event])), year);
      return [...measures(s), s.explanationStanding];
    };
    // Before the rise or in its first year: each kind counts.
    expect(counts(permanent({ kind: 'code-change', effectiveDate: '2023-01-01' }))).toEqual([1, 0, 0, 0, 'artifact']);
    expect(counts(permanent({ kind: 'authorization-or-limit', effectiveDate: '2022-07-01' }))).toEqual([0, 1, 0, 0, 'opening']);
    expect(counts(permanent({ kind: 'rate', effectiveDate: '2022-07-01' }))).toEqual([0, 0, 1, 0, 'intended-growth']);
    expect(counts(permanent({ kind: 'enforcement', direction: 'restricts', effectiveDate: '2022-07-01' }))).toEqual([0, 0, 0, 1, 'restriction']);
    // After the rise began: only a restriction still counts.
    expect(counts(permanent({ kind: 'code-change', effectiveDate: '2024-01-01' }))).toEqual([0, 0, 0, 0, 'partly-searched']);
    expect(counts(permanent({ kind: 'authorization-or-limit', effectiveDate: '2024-01-01' }))).toEqual([0, 0, 0, 0, 'partly-searched']);
    expect(counts(permanent({ kind: 'rate', effectiveDate: '2024-01-01' }))).toEqual([0, 0, 0, 0, 'partly-searched']);
    expect(counts(permanent({ kind: 'coverage', direction: 'restricts', effectiveDate: '2024-01-01' }))).toEqual([0, 0, 0, 1, 'restriction']);
    // After the service-year: nothing counts, a restriction included.
    expect(counts(permanent({ kind: 'enforcement', direction: 'restricts', effectiveDate: '2025-09-08' }))).toEqual([0, 0, 0, 0, 'partly-searched']);
    // Context is carried and never counted.
    expect(counts(permanent({ kind: 'external-flag', direction: 'unstated', effectiveDate: '2023-06-01' }))).toEqual([0, 0, 0, 0, 'partly-searched']);
    expect(counts(permanent({ kind: 'rate', direction: 'unstated', effectiveDate: '2023-06-01' }))).toEqual([0, 0, 0, 0, 'partly-searched']);
    const context = at(runWithPolicy(KY_HISTORY(), policyExport([permanent({ kind: 'governance', effectiveDate: '2023-06-01' })])), 2024);
    expect(timings(context)).toEqual(['ky-permanent:same-year:false']);
  });

  it('explains a fall, on a collapse-only service-year, by an artifact or a restriction and never by an opening or intended growth', () => {
    // The fall starts in 2024; each event is dated inside the two years before it.
    const counts = (event, year = 2024) => {
      const s = at(runWithPolicy(RISE_THEN_COLLAPSE(), policyExport([event])), year);
      return [...measures(s), s.explanationStanding, s.tier.key];
    };
    expect(counts(permanent({ kind: 'authorization-or-limit', effectiveDate: '2023-07-01' }))).toEqual([0, 0, 0, 0, 'partly-searched', 'lookback']);
    expect(counts(permanent({ kind: 'rate', effectiveDate: '2023-07-01' }))).toEqual([0, 0, 0, 0, 'partly-searched', 'lookback']);
    expect(timings(at(runWithPolicy(RISE_THEN_COLLAPSE(), policyExport([permanent({ kind: 'rate', effectiveDate: '2023-07-01' })])), 2024))).toEqual(['ky-permanent:before:false']);
    expect(counts(permanent({ kind: 'enforcement', direction: 'restricts', effectiveDate: '2023-05-16' }))).toEqual([0, 0, 0, 1, 'restriction', 'lookback']);
    // A billing code replaced in the year of the collapse, or in the two years before it, explains the collapse.
    expect(counts(permanent({ kind: 'code-change', effectiveDate: '2024-01-01' }))).toEqual([1, 0, 0, 0, 'artifact', 'explained']);
    expect(counts(permanent({ kind: 'code-change', effectiveDate: '2022-01-01' }))).toEqual([1, 0, 0, 0, 'artifact', 'explained']);
    // One at the start of the rise before it, older than the lookback from the fall, does not.
    expect(counts(permanent({ kind: 'code-change', effectiveDate: '2021-12-31' }))).toEqual([0, 0, 0, 0, 'partly-searched', 'lookback']);
    // The rise year of the same state-code reads the same events against its own start, 2022.
    expect(counts(permanent({ kind: 'authorization-or-limit', effectiveDate: '2021-07-01' }), 2022)).toEqual([0, 1, 0, 0, 'opening', at(runWithPolicy(RISE_THEN_COLLAPSE()), 2022).tier.key]);
    expect(counts(permanent({ kind: 'code-change', effectiveDate: '2024-01-01' }), 2022).slice(0, 5)).toEqual([0, 0, 0, 0, 'partly-searched']);
  });

  it('names the standing by precedence: artifact, opening, intended growth, restriction, then what the search on file allows', () => {
    const artifact = permanent({ id: 'a', kind: 'reporting-change', effectiveDate: '2023-01-01' });
    const opening = permanent({ id: 'o', kind: 'authorization-or-limit', effectiveDate: '2022-07-01' });
    const growth = permanent({ id: 'g', kind: 'rate', effectiveDate: '2022-07-01' });
    const restriction = permanent({ id: 'r', kind: 'enforcement', direction: 'restricts', effectiveDate: '2022-07-01' });
    // The rise starts in 2023.
    const standing = (events, searches = [policySearch()]) => at(runWithPolicy(KY_HISTORY(), policyExport(events, searches)), 2024).explanationStanding;
    expect(standing([restriction, growth, opening, artifact])).toBe('artifact');
    expect(standing([restriction, growth, opening])).toBe('opening');
    expect(standing([restriction, growth])).toBe('intended-growth');
    expect(standing([restriction])).toBe('restriction');
    // No event counted: only a full search may say none-found; a partial one never does; no search is not-searched.
    expect(standing([], [policySearch({ completeness: 'full' })])).toBe('none-found');
    expect(standing([], [policySearch(), policySearch({ topic: 'another', completeness: 'full' })])).toBe('none-found');
    expect(standing([], [policySearch()])).toBe('partly-searched');
    expect(standing([], [policySearch({ state: 'AZ', completeness: 'full' })])).toBe('not-searched');
    expect(standing([], [])).toBe('not-searched');
    // A search has to reach the end of the year the rise starts to say anything about it.
    expect(standing([], [policySearch({ searchedThrough: '2023-12-31', completeness: 'full' })])).toBe('none-found');
    expect(standing([], [policySearch({ searchedThrough: '2023-12-30', completeness: 'full' })])).toBe('not-searched');
    expect(standing([], [policySearch({ searchedThrough: '2023-12-31' })])).toBe('partly-searched');
    expect(standing([], [policySearch({ searchedThrough: '2017-10-06' })])).toBe('not-searched');
    // A full search that stops short does not lend its completeness to a partial one that reaches.
    expect(standing([], [policySearch({ searchedThrough: '2022-06-30', completeness: 'full' }), policySearch({ topic: 'another' })])).toBe('partly-searched');
    // An event still names the standing where no search reaches, and a national event does in a state nobody searched.
    expect(standing([opening], [policySearch({ searchedThrough: '2017-10-06' })])).toBe('opening');
    expect(standing([{ ...opening, state: 'US' }], [])).toBe('opening');
    for (const value of ['artifact', 'opening', 'intended-growth', 'restriction', 'none-found', 'partly-searched', 'not-searched']) expect(EXPLANATION_STANDINGS).toContain(value);
  });

  it('rates a service-year EXPLAINED, with its reason, only for a confirmed measurement artifact, and takes its dollars out of worth review', () => {
    const codeChange = permanent({ id: 'code', kind: 'code-change', effectiveDate: '2023-01-01' });
    const reportingChange = permanent({ id: 'reporting', kind: 'reporting-change', effectiveDate: '2022-10-01' });
    const without = runWithPolicy(KY_ROWS(), policyExport([]));
    const p = runWithPolicy(KY_ROWS(), policyExport([codeChange]));
    const s = p.ServiceYears[0];
    expect(without.ServiceYears[0].tier.key).toBe('high');
    expect(s.tier).toEqual({ key: 'explained', label: 'EXPLAINED', shortLabel: 'EXPLAINED' });
    expect([s.explanationStanding, s.explainedReason, s.measurementArtifactExplainsChange]).toEqual(['artifact', 'billing code changed', true]);
    // The score and the signal points are the screen's own and do not move.
    expect([s.score, s.points]).toEqual([without.ServiceYears[0].score, without.ServiceYears[0].points]);
    const year = p.YearSummaries[2024];
    expect([year.tiers.explained.services, year.tiers.explained.aboveEnrollment, year.tiers.high.services]).toEqual([1, 139.8e6, 0]);
    expect([year.worthReviewServices, year.worthReviewAboveEnrollment]).toEqual([0, 0]);
    expect([without.YearSummaries[2024].worthReviewServices, without.YearSummaries[2024].worthReviewAboveEnrollment]).toEqual([1, 139.8e6]);
    expect([p.StateYearSummaries['KY|2024'].tiers.explained.services, p.StateYearSummaries['KY|2024'].worthReviewServices]).toEqual([1, 0]);
    // The reason names each kind of artifact that counts, and no kind that does not.
    expect(runWithPolicy(KY_ROWS(), policyExport([reportingChange])).ServiceYears[0].explainedReason).toBe('reporting changed');
    expect(runWithPolicy(KY_ROWS(), policyExport([reportingChange, codeChange])).ServiceYears[0].explainedReason).toBe('billing code changed; reporting changed');
    const afterStart = permanent({ id: 'code-late', kind: 'code-change', effectiveDate: '2024-06-01' });
    const mixed = runWithPolicy(KY_HISTORY(), policyExport([reportingChange, afterStart]));
    expect([at(mixed, 2024).tier.key, at(mixed, 2024).explainedReason]).toEqual(['explained', 'reporting changed']);
    // The tier rule lists EXPLAINED with its test, and no cut-off moves it.
    expect(p.ActiveTierRule.find((t) => t.key === 'explained')).toMatchObject({ label: 'EXPLAINED', minScore: 0, test: 'a confirmed billing-code or reporting change explains the rise or the fall, and no known case names the service-year' });
    expect(TIER_RULE.map((t) => t.key)).toEqual(['closed', 'explained', 'lookback', 'high', 'verify', 'convention', 'low']);
  });

  it('lets nothing but a confirmed artifact move a tier: not an opening, intended growth, a restriction or context', () => {
    const without = runWithPolicy(KY_HISTORY());
    for (const event of [
      policyEvent(),
      permanent({ kind: 'rate', effectiveDate: '2022-07-01' }),
      permanent({ kind: 'enforcement', direction: 'restricts', effectiveDate: '2022-07-01' }),
      permanent({ kind: 'governance', effectiveDate: '2022-07-01' }),
      permanent({ kind: 'code-change', effectiveDate: '2025-01-01' }),
    ]) {
      const p = runWithPolicy(KY_HISTORY(), policyExport([event]));
      expect(p.ServiceYears.map((s) => [s.id, s.tier.key, s.score, s.explainedReason])).toEqual(without.ServiceYears.map((s) => [s.id, s.tier.key, s.score, '']));
      expect(p.YearSummaries).toEqual(without.YearSummaries);
    }
  });

  it('never rates a service-year a known case names EXPLAINED, whichever of its rows carries the case', () => {
    const artifact = permanent({ kind: 'code-change', effectiveDate: '2024-01-01' });
    // The owner's known case id rides on the row whose pattern the case names; the merge keeps the first row's.
    const rows = (idOnSurge) => [row({ pattern: 'persistent-excess' }), row({ pattern: 'share-surge', knownCaseId: idOnSurge })];
    const knownCase = { id: 'ky-h2027-2024', state_code: 'KY', hcpcs: 'H2027', year: 2024, expected: 'detected', note: 'A known case.' };
    const listed = runWithPolicy(rows('ky-h2027-2024'), policyExport([artifact]), (r) => { r.knownCases = [knownCase]; });
    const s = listed.ServiceYears[0];
    expect([s.knownCaseId, s.knownCaseNamesServiceYear, s.measurementArtifactExplainsChange, s.explanationStanding]).toEqual(['', true, true, 'artifact']);
    expect([s.tier.key, s.explainedReason]).toEqual([runWithPolicy(rows('ky-h2027-2024')).ServiceYears[0].tier.key, '']);
    expect(s.tier.key).not.toBe('explained');
    // The id on the merged row is enough by itself.
    const carried = runWithPolicy([row({ pattern: 'share-surge', knownCaseId: 'ky-h2027-2024' })], policyExport([artifact]));
    expect([carried.ServiceYears[0].knownCaseNamesServiceYear, carried.ServiceYears[0].measurementArtifactExplainsChange, carried.ServiceYears[0].tier.key]).toEqual([true, true, 'verify']);
    // A case the list expects not to be detected, another year's case and another state's case exempt nothing.
    for (const other of [{ ...knownCase, expected: 'not-detected' }, { ...knownCase, year: 2023 }, { ...knownCase, state_code: 'AZ' }, { ...knownCase, hcpcs: 'H0036' }]) {
      const p = runWithPolicy(rows(''), policyExport([artifact]), (r) => { r.knownCases = [other]; });
      expect([p.ServiceYears[0].knownCaseNamesServiceYear, p.ServiceYears[0].tier.key]).toEqual([false, 'explained']);
    }
    // A collapse the list names is CLOSED even when its row carries no id.
    const listedCollapse = runWithPolicy(RISE_THEN_COLLAPSE(), policyExport([artifact]), (r) => { r.knownCases = [{ ...knownCase, year: 2024 }]; });
    expect([at(listedCollapse, 2024).knownCaseId, at(listedCollapse, 2024).tier.key, at(listedCollapse, 2022).tier.key]).toEqual(['', 'closed', runWithPolicy(RISE_THEN_COLLAPSE()).ServiceYears.find((x) => x.year === 2022).tier.key]);
    // A known collapse stays CLOSED; an unknown one that an artifact explains reads EXPLAINED, not LOOK-BACK.
    const known = runWithPolicy(RISE_THEN_COLLAPSE('a-known-case'), policyExport([artifact]));
    expect([at(known, 2024).tier.key, at(known, 2024).measurementArtifactExplainsChange, at(known, 2024).explainedReason]).toEqual(['closed', true, '']);
    const unknown = runWithPolicy(RISE_THEN_COLLAPSE(), policyExport([artifact]));
    expect([at(unknown, 2024).tier.key, at(unknown, 2024).explainedReason]).toEqual(['explained', 'billing code changed']);
    expect(at(runWithPolicy(RISE_THEN_COLLAPSE()), 2024).tier.key).toBe('lookback');
  });

  it('carries an unconfirmed suggestion beside the service-year and lets it change no rating, count, standing or summary', () => {
    const suggestion = permanent({ id: 'suggested-code-change', kind: 'code-change', effectiveDate: '2023-01-01', standing: 'suggested', confirmedBy: '', confirmedOn: '' });
    const later = permanent({ id: 'suggested-later', kind: 'enforcement', direction: 'restricts', effectiveDate: '2025-06-01', standing: 'suggested', confirmedBy: '', confirmedOn: '' });
    const without = runWithPolicy(KY_HISTORY(), policyExport([]));
    const p = runWithPolicy(KY_HISTORY(), policyExport([suggestion, later]));
    const strip = (s) => ({ ...s, coveringPolicyEvents: [], suggestedPolicyEvents: [], suggestedEvents: 0 });
    expect(p.ServiceYears.map(strip)).toEqual(without.ServiceYears.map(strip));
    expect(p.YearSummaries).toEqual(without.YearSummaries);
    expect(p.StateYearSummaries).toEqual(without.StateYearSummaries);
    const s = at(p, 2024);
    expect([s.tier.key, s.explanationStanding, s.measurementArtifactMeasures, s.measurementArtifactExplainsChange, s.explainedReason]).toEqual(['high', 'partly-searched', 0, false, '']);
    // A suggestion is timed like any event and is never marked as counting.
    expect(s.suggestedPolicyEvents.map((m) => [m.event.id, m.event.standing, m.timing, m.countsTowardExplanation])).toEqual([
      ['suggested-code-change', 'suggested', 'same-year', false], ['suggested-later', 'suggested', 'later', false],
    ]);
    expect([s.suggestedEvents, s.policyEvents.length, s.laterPolicyEvents.length]).toEqual([2, 0, 0]);
    // The same event, confirmed, does change the rating: the standing is what holds it back.
    const confirmed = runWithPolicy(KY_HISTORY(), policyExport([{ ...suggestion, standing: 'confirmed', confirmedBy: 'A Person', confirmedOn: '2026-11-11' }]));
    expect(at(confirmed, 2024).tier.key).toBe('explained');
  });

  it('keeps events after the service-year apart, in date order, and counts none of them', () => {
    const p = runWithPolicy(KY_ROWS(), policyExport([
      permanent({ id: 'later-b', kind: 'coverage', direction: 'restricts', effectiveDate: '2026-07-15' }),
      permanent({ id: 'later-a', kind: 'enforcement', direction: 'restricts', effectiveDate: '2025-09-08' }),
      permanent({ id: 'now', kind: 'rate', effectiveDate: '2024-03-01' }),
    ]));
    const s = p.ServiceYears[0];
    expect(s.laterPolicyEvents.map((m) => [m.event.id, m.timing, m.countsTowardExplanation])).toEqual([['later-a', 'later', false], ['later-b', 'later', false]]);
    expect(timings(s)).toEqual(['now:same-year:true']);
    expect([s.restrictionMeasures, s.intendedGrowthMeasures]).toEqual([0, 1]);
    for (const list of [s.coveringPolicyEvents, s.policyEvents, s.laterPolicyEvents, s.suggestedPolicyEvents]) expect(Object.isFrozen(list)).toBe(true);
    expect(s.coveringPolicyEvents.every((m) => Object.isFrozen(m))).toBe(true);
    expect(s.coveringPolicyEvents).toHaveLength(3);
  });

  it('restores the policy run state on every run of one instance', () => {
    const p = new PotentialFraudSignalReview();
    p.Radar = radar(KY_ROWS());
    p.PolicyEventsExport = policyExport([permanent({ kind: 'code-change', effectiveDate: '2023-01-01' })]);
    p.ScorePotentialFraudCandidates();
    expect([p.ServiceYears[0].tier.key, p.PolicyEvents.length, p.PolicyEventLookbackMonths]).toEqual(['explained', 1, 24]);
    p.PolicyEventsExport = { schema: 'something-else' };
    p.ScorePotentialFraudCandidates();
    expect([p.ServiceYears[0].tier.key, p.PolicyEventsAreLoaded, p.PolicyEvents.length, p.PolicyEventLookbackMonths, p.PolicySearchedThrough]).toEqual(['high', false, 0, 0, '']);
    expect(p.PolicyEventsProblem).not.toBe('');
    p.PolicyEventsExport = {};
    p.ScorePotentialFraudCandidates();
    expect([p.ServiceYears[0].tier.key, p.ServiceYears[0].explanationStanding, p.PolicyEventsProblem, p.PolicySearchCoverageByState]).toEqual(['high', 'not-searched', '', {}]);
    // The year indexes belong to the run: another radar on the same instance starts from nothing.
    p.Radar = radar(RISE_THEN_COLLAPSE());
    p.ScorePotentialFraudCandidates();
    expect([p.BlowupYearsByStateCode, p.CollapseYearsByStateCode, p.FirstFlaggedYearByStateCode, p.FirstYearOnFile]).toEqual([{ 'KY|H2027': [2022] }, { 'KY|H2027': [2024] }, { 'KY|H2027': 2022 }, 2022]);
    p.Radar = radar(KY_ROWS());
    p.ScorePotentialFraudCandidates();
    expect([p.BlowupYearsByStateCode, p.CollapseYearsByStateCode, p.FirstFlaggedYearByStateCode]).toEqual([{ 'KY|H2027': [2024] }, {}, { 'KY|H2027': 2024 }]);
    // A staged export is read, never changed.
    const staged = policyExport([policyEvent()]);
    const before = JSON.stringify(staged);
    p.PolicyEventsExport = staged;
    p.ScorePotentialFraudCandidates();
    p.ScorePotentialFraudCandidates();
    expect(JSON.stringify(staged)).toBe(before);
    expect(Object.isFrozen(staged.events[0])).toBe(false);
  });
});
