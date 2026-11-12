import { describe, expect, it } from 'vitest';
import { EXPLANATION_KIND_BY_EVENT_KIND, POLICY_EVENT_STANDINGS, PotentialFraudSignalReview } from './potentialFraudSignalProgram.js';
import { POTENTIAL_FRAUD_RADAR } from '../../data/alp/potentialFraudRadar.js';
import { POLICY_EVENTS } from '../../data/alp/policyEvents.js';

/**
 * The law-and-policy layer's backtest: the tests the plan requires before the layer is trusted
 * (docs/planning/law-and-policy-layer-codexen-plan.md, section 4), run on the radar export and the
 * policy events export the app ships. A change to either export, or to the program's matching, has
 * to keep these true.
 */
function score(policyEvents) {
  const p = new PotentialFraudSignalReview();
  p.Radar = POTENTIAL_FRAUD_RADAR;
  if (policyEvents) p.PolicyEventsExport = policyEvents;
  p.ScorePotentialFraudCandidates();
  return p;
}

const without = score(null);
const review = score(POLICY_EVENTS);
const at = (id) => review.ServiceYears.find((s) => s.id === id);
const ids = (list) => list.map((m) => m.event.id);
const measures = (s) => [s.measurementArtifactMeasures, s.policyOpeningMeasures, s.intendedGrowthMeasures, s.restrictionMeasures];
const detectedCases = (POTENTIAL_FRAUD_RADAR.knownCases ?? []).filter((c) => c.expected === 'detected');
const caseYearsOf = (p) => detectedCases.flatMap((c) => p.ServiceYears.filter((s) => s.state === c.state_code && String(s.hcpcs) === String(c.hcpcs) && s.year === c.year));

describe('law-and-policy backtest on the shipped exports', () => {
  it('reads the shipped policy events export, and knows every kind, direction and standing its load allows', () => {
    expect([review.PolicyEventsAreLoaded, review.PolicyEventsProblem, review.Errors]).toEqual([true, '', []]);
    expect(review.PolicyEventLookbackMonths).toBe(24);
    expect(review.PolicyEvents).toHaveLength(POLICY_EVENTS.events.length);
    expect(review.ServiceYears).toHaveLength(without.ServiceYears.length);
    expect(Object.keys(EXPLANATION_KIND_BY_EVENT_KIND).sort()).toEqual([...POLICY_EVENTS.rule.kinds].sort());
    for (const byDirection of Object.values(EXPLANATION_KIND_BY_EVENT_KIND)) expect(Object.keys(byDirection).sort()).toEqual([...POLICY_EVENTS.rule.directions].sort());
    expect([...POLICY_EVENT_STANDINGS].sort()).toEqual([...POLICY_EVENTS.rule.standings].sort());
  });

  it('carries the prior-authorization suspension on Kentucky psychoeducation as a policy opening, and leaves it HIGH', () => {
    // The screen first flagged the service in 2019; the rise these two years belong to starts in 2023.
    expect(review.ServiceYears.filter((s) => s.state === 'KY' && String(s.hcpcs) === 'H2027').map((s) => s.year).sort()).toEqual([2019, 2020, 2021, 2022, 2023, 2024]);
    for (const id of ['KY|H2027|2023', 'KY|H2027|2024']) {
      const s = at(id);
      expect([s.changeStartYear, s.changeStartIsKnown, s.tier.key, s.explanationStanding, s.policyOpeningMayExplainRise], id).toEqual([2023, true, 'high', 'opening', true]);
      // The 2020 suspension and the 2023 "still suspended" record are one continuing measure.
      expect(s.policyEvents.map((m) => [m.event.id, m.event.explanationKind, m.timing, m.countsTowardExplanation]), id).toEqual([
        ['ky-prior-authorization-suspended-2020-02', 'policy-opening', 'in-force', true],
        ['ky-behavioral-health-prior-authorization-kept-suspended-2023-04', 'policy-opening', 'same-year', true],
      ]);
      expect(measures(s), id).toEqual([0, 1, 0, 0]);
      // The 2025 limits, their rescission, the reinstatement and the 2026 end of coverage come after the data.
      expect(ids(s.laterPolicyEvents), id).toEqual([
        'ky-psychoeducation-peer-support-limits-2025-01', 'ky-psychoeducation-peer-support-limits-rescinded-2025-04',
        'ky-behavioral-health-prior-authorization-reinstated-2025-06', 'ky-psychoeducation-coverage-ended-2026-07',
      ]);
    }
    // The years of the 2019 rise are not explained by a suspension that began after it.
    for (const id of ['KY|H2027|2020', 'KY|H2027|2021', 'KY|H2027|2022']) expect([at(id).changeStartYear, at(id).policyOpeningMeasures, at(id).explanationStanding], id).toEqual([2019, 0, 'partly-searched']);
  });

  it('carries the 2023 enforcement on the Arizona collapse', () => {
    const collapse = at('AZ|H2027|2024');
    expect([collapse.collapseOnly, collapse.changeStartYear, collapse.tier.key, collapse.knownCaseNamesServiceYear, collapse.explanationStanding, collapse.restrictionMeasures]).toEqual([true, 2024, 'closed', true, 'restriction', 1]);
    expect(collapse.policyEvents.map((m) => [m.event.id, m.event.explanationKind, m.timing, m.countsTowardExplanation])).toEqual([
      ['az-payment-suspensions-announced-2023-05', 'restriction', 'before', true],
    ]);
    // The year of the enforcement carries it too; the years before carry it only as a later event.
    expect(at('AZ|H2027|2023').policyEvents.map((m) => [m.event.id, m.timing, m.countsTowardExplanation])).toEqual([['az-payment-suspensions-announced-2023-05', 'after-start', true]]);
    const before = at('AZ|H2027|2022');
    expect([before.policyEvents.length, ids(before.laterPolicyEvents), before.restrictionMeasures]).toEqual([0, ['az-payment-suspensions-announced-2023-05'], 0]);
  });

  it('downgrades no known case-year, and moves no tier at all on the events on file', () => {
    const tierWithout = new Map(without.ServiceYears.map((s) => [s.id, s.tier.key]));
    expect(detectedCases.length).toBeGreaterThanOrEqual(5);
    const caseYears = caseYearsOf(review);
    expect(caseYears.length).toBeGreaterThanOrEqual(5);
    for (const s of caseYears) {
      expect(s.knownCaseNamesServiceYear, s.id).toBe(true);
      expect(s.tier.key, s.id).toBe(tierWithout.get(s.id));
      expect(s.tier.key, s.id).not.toBe('explained');
    }
    // No measurement artifact is on file yet (billing-code and reporting changes arrive with later items), so nothing is EXPLAINED.
    expect(review.PolicyEvents.filter((e) => e.explanationKind === 'measurement-artifact')).toEqual([]);
    expect(review.ServiceYears.filter((s) => tierWithout.get(s.id) !== s.tier.key).map((s) => s.id)).toEqual([]);
    expect(review.ServiceYears.filter((s) => s.explainedReason !== '')).toEqual([]);
    expect(review.YearSummaries).toEqual(without.YearSummaries);
    expect(review.StateYearSummaries).toEqual(without.StateYearSummaries);
  });

  it('would rate no known case-year EXPLAINED even if a confirmed billing-code change covered every one of them', () => {
    // A billing-code change is staged for each known case-year, dated to the first day of the year its change starts,
    // and one more across the nation. Only the known-case rule can then keep those years from EXPLAINED.
    const artifact = (id, state, scope, year) => ({
      id, state, kind: 'code-change', direction: 'unstated', summary: 'A staged billing-code change.',
      effectiveDate: `${year}-01-01`, effectivePrecision: 'day', endDate: '', endPrecision: '', endedBy: '', scope,
      source: { publisher: 'Test', title: 'Test', url: 'https://example.org/test', documentDate: `${year}-01-01`, documentPrecision: 'day', quote: 'test' },
      standing: 'confirmed', confirmedBy: 'Test', confirmedOn: '2026-11-11', sourceFile: 'TEST.json',
    });
    const staged = {
      ...POLICY_EVENTS,
      events: [
        ...POLICY_EVENTS.events,
        ...caseYearsOf(review).map((s) => artifact(`test-${s.state.toLowerCase()}-${s.year}`, s.state, { hcpcs: [String(s.hcpcs)], hcpcsPrefixes: [], allServices: false, basis: 'named-in-document', note: '' }, s.changeStartYear)),
        artifact('test-national-2021', 'US', { hcpcs: [], hcpcsPrefixes: [], allServices: true, basis: 'named-in-document', note: '' }, 2021),
      ],
    };
    const withArtifacts = score(staged);
    expect([withArtifacts.PolicyEventsAreLoaded, withArtifacts.PolicyEventsProblem]).toEqual([true, '']);
    const tierWithout = new Map(without.ServiceYears.map((s) => [s.id, s.tier.key]));
    const caseYears = caseYearsOf(withArtifacts);
    expect(caseYears.map((s) => s.id).sort()).toEqual(caseYearsOf(review).map((s) => s.id).sort());
    for (const s of caseYears) {
      expect([s.measurementArtifactExplainsChange, s.explanationStanding], s.id).toEqual([true, 'artifact']);
      expect([s.tier.key, s.explainedReason], s.id).toEqual([tierWithout.get(s.id), '']);
    }
    // The staged changes do bite everywhere else: other service-years are rated EXPLAINED, collapses among them.
    const explained = withArtifacts.ServiceYears.filter((s) => s.tier.key === 'explained');
    expect(explained.length).toBeGreaterThan(100);
    expect(explained.every((s) => !s.knownCaseNamesServiceYear && s.explainedReason === 'billing code changed')).toBe(true);
    expect(explained.some((s) => s.collapseOnly)).toBe(true);
    // And they leave "worth review": no EXPLAINED dollars are in it.
    for (const y of Object.values(withArtifacts.YearSummaries)) expect(y.worthReviewAboveEnrollment).toBe(y.tiers.high.aboveEnrollment + y.tiers.verify.aboveEnrollment);
  });

  it('reads a state nobody searched as not-searched, and never says none-found of a partial search', () => {
    const searched = new Set(Object.keys(review.PolicySearchCoverageByState));
    expect([...searched].sort()).toEqual(['AZ', 'DC', 'KY', 'WV']);
    expect(POLICY_EVENTS.searches.every((search) => search.completeness === 'partial')).toBe(true);
    expect(review.ServiceYears.filter((s) => s.explanationStanding === 'none-found' || s.fullPolicySearchReachesChangeStart)).toEqual([]);
    const unsearched = review.ServiceYears.filter((s) => !searched.has(s.state));
    expect(unsearched.length).toBeGreaterThan(0);
    expect(new Set(unsearched.map((s) => s.explanationStanding))).toEqual(new Set(['not-searched']));
    expect(new Set(unsearched.map((s) => s.policySearchReachesChangeStart))).toEqual(new Set([false]));
    // Kentucky, Arizona and the District were searched through the years their changes start.
    const reached = review.ServiceYears.filter((s) => ['KY', 'AZ', 'DC'].includes(s.state));
    expect(reached.every((s) => s.policySearchReachesChangeStart)).toBe(true);
    expect(reached.filter((s) => s.explanationStanding === 'not-searched')).toEqual([]);
    // A Kentucky service no event covers reads partly-searched.
    const uncovered = reached.filter((s) => s.state === 'KY' && !String(s.hcpcs).startsWith('H'));
    expect(uncovered.length).toBeGreaterThan(0);
    expect(new Set(uncovered.map((s) => s.explanationStanding))).toEqual(new Set(['partly-searched']));
    // West Virginia's one search stops in 2017, before any change on file starts, so it says nothing about them.
    const westVirginia = review.ServiceYears.filter((s) => s.state === 'WV');
    expect(review.PolicySearchCoverageByState.WV.searchedThrough < '2018-12-31').toBe(true);
    expect(westVirginia.every((s) => !s.policySearchReachesChangeStart)).toBe(true);
    expect(new Set(westVirginia.map((s) => s.explanationStanding))).toEqual(new Set(['intended-growth', 'not-searched']));
  });

  it('counts no opening on a service whose excess is already there when the figures begin', () => {
    // Kentucky's 2020 suspension covers every behavioral health code, but it cannot explain an excess that predates the file.
    const longStanding = review.ServiceYears.filter((s) => s.state === 'KY' && String(s.hcpcs).startsWith('H') && !s.collapseOnly && !s.changeStartIsKnown);
    expect(longStanding.length).toBeGreaterThan(0);
    for (const s of longStanding) {
      expect(s.policyEvents.every((m) => m.timing === 'start-unknown' && !m.countsTowardExplanation), s.id).toBe(true);
      expect([s.policyOpeningMeasures, s.explanationStanding], s.id).toEqual([0, 'partly-searched']);
    }
    // Every opening that is counted sits on a service-year whose rise has a known start.
    expect(review.ServiceYears.filter((s) => s.explanationStanding === 'opening').every((s) => s.changeStartIsKnown && !s.collapseOnly)).toBe(true);
  });

  it('carries the District arraignment only as a later event: it comes after every flagged year and explains none', () => {
    const district = review.ServiceYears.filter((s) => s.state === 'DC' && String(s.hcpcs) === 'H0036');
    expect(district.map((s) => s.year).sort()).toEqual([2020, 2021, 2022, 2023, 2024]);
    for (const s of district) {
      expect([s.policyEvents.length, ids(s.laterPolicyEvents), s.restrictionMeasures, s.explanationStanding], s.id).toEqual([0, ['dc-community-support-worker-arraigned-2025-09'], 0, 'partly-searched']);
    }
  });

  it('reads West Virginia coverage added in 2018 as intended growth on the rises that began within two years, and on no collapse', () => {
    const growth = review.ServiceYears.filter((s) => s.state === 'WV' && s.explanationStanding === 'intended-growth');
    expect(growth.length).toBeGreaterThan(0);
    for (const s of growth) {
      expect([s.collapseOnly, s.changeStartIsKnown], s.id).toEqual([false, true]);
      expect([2019, 2020], s.id).toContain(s.changeStartYear);
      expect(s.policyEvents.map((m) => [m.event.id, m.timing, m.countsTowardExplanation]), s.id).toEqual([['wv-substance-use-residential-and-peer-coverage-2018-07', 'before', true]]);
    }
    // A West Virginia behavioral health change that began later than two years after it is not explained by it.
    const late = review.ServiceYears.filter((s) => s.state === 'WV' && String(s.hcpcs).startsWith('H') && s.changeStartIsKnown && s.changeStartYear > 2020);
    expect(late.length).toBeGreaterThan(0);
    for (const s of late) expect([s.policyEvents.length, s.explanationStanding], s.id).toEqual([0, 'not-searched']);
  });

  it('counts only confirmed events, and every event on file is confirmed', () => {
    expect(review.PolicyEvents.every((e) => e.standing === 'confirmed')).toBe(true);
    expect(review.ServiceYears.every((s) => s.suggestedEvents === 0 && s.suggestedPolicyEvents.length === 0)).toBe(true);
  });

  it('holds the counts the plan records for the shipped data', () => {
    const standings = {};
    for (const s of review.ServiceYears) standings[s.explanationStanding] = (standings[s.explanationStanding] ?? 0) + 1;
    expect(review.ServiceYears).toHaveLength(5906);
    expect(standings).toEqual({ opening: 15, 'intended-growth': 9, restriction: 17, 'partly-searched': 426, 'not-searched': 5439 });
  });
});
