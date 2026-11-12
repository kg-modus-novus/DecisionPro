import { describe, expect, it } from 'vitest';
import { ALERT_RULE, BRIEF_READINGS, COMPARABLE_PROFILE, GROUP_RULE, HIGH_SIGN_RANK, OversightReview, PROFILE_SIGNS } from './oversightProgram.js';
import { PotentialFraudSignalReview } from './potentialFraudSignalProgram.js';
import { POTENTIAL_FRAUD_RADAR } from '../../data/alp/potentialFraudRadar.js';
import { POLICY_EVENTS } from '../../data/alp/policyEvents.js';
import { OVERSIGHT_AGGREGATES } from '../../data/alp/oversightAggregates.js';

function scoredReview() {
  const p = new PotentialFraudSignalReview();
  p.Radar = POTENTIAL_FRAUD_RADAR;
  p.PolicyEventsExport = POLICY_EVENTS;
  p.ScorePotentialFraudCandidates();
  return p;
}
const review = scoredReview();

function oversight() {
  const o = new OversightReview();
  o.Oversight = OVERSIGHT_AGGREGATES;
  o.Radar = POTENTIAL_FRAUD_RADAR;
  o.Review = review;
  o.ReviewEarlyWarning();
  o.ReviewBillerGroups();
  o.RankBillerProfiles();
  o.SummarizeExplanationLedgers();
  o.NameStateBriefReadings();
  return o;
}
const o = oversight();

describe('OversightReview early warning (real figures)', () => {
  it('alerts Kentucky psychoeducation first in July 2023: May to July paid at least twice the year before and at least $1M', () => {
    const e = o.EarlyWarnings['KY|H2027'];
    expect(e.changeStartYear).toBe(2023);
    expect(e.firstAlertMonth).toBe('2023-07');
    expect(e.firstAlert.threeMonthPaid).toBeGreaterThanOrEqual(ALERT_RULE.multiple * e.firstAlert.yearEarlierThreeMonthPaid);
    expect(e.firstAlert.threeMonthPaid).toBeGreaterThan(8.3e6);
    expect(e.firstAlert.billers).toBe(51);
    expect(e.months.find((m) => m.ym === '2024-10').billers).toBe(126);
    expect(e.paidAfterAlertFrom).toBe('2023-08');
    expect(e.paidAfterAlertTo).toBe('2024-12');
    expect(e.paidAfterAlertIsKnown).toBe(true);
    expect(e.paidAfterAlert).toBeGreaterThan(180e6);
  });

  it('dates the first confirmed restriction on file after the alert, and the annual flag of the same rise', () => {
    const e = o.EarlyWarnings['KY|H2027'];
    expect(e.firstRestrictionIsOnFile).toBe(true);
    expect(e.firstRestriction.effectiveDate).toBe('2025-01-01');
    expect(e.monthsToFirstRestriction).toBe(18);
    expect(e.annualFlag.year).toBe(2023);
    expect(e.annualFlag.patterns).toContain('share-surge');
  });

  it('phases months around the alert and marks the last month on file', () => {
    const e = o.EarlyWarnings['KY|H2027'];
    expect(e.months.find((m) => m.ym === '2023-06').phase).toBe('before');
    expect(e.months.find((m) => m.ym === '2023-07').phase).toBe('alert');
    expect(e.months.find((m) => m.ym === '2024-11').phase).toBe('after');
    expect(e.months[e.months.length - 1].phase).toBe('last');
  });

  it('lists each detected known case once, with what was paid after its first blow-up flag', () => {
    const ids = o.KnownCaseOutcomes.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    const az = o.KnownCaseOutcomes.find((k) => k.id === 'AZ|H2027');
    expect(az.firstFlagYear).toBeLessThanOrEqual(2022);
    expect(az.paidAfter).toBeGreaterThan(0);
    const ky = o.KnownCaseOutcomes.find((k) => k.id === 'KY|H2027');
    expect(ky.firstFlagYear).toBe(2023);
    expect(ky.followed.map((f) => f.effectiveDate)).toContain('2025-01-01');
  });

  it('counts the latest year\'s first-time flags within its flags', () => {
    const f = o.FirstFlagsInLatestYear;
    expect(f.services).toBeGreaterThan(0);
    expect(f.services).toBeLessThan(f.flags);
  });

  it('does not alert on a withheld month, and needs both twice the year before and the floor', () => {
    const s = new OversightReview();
    const flat = Array(36).fill(400_000);
    const rising = [...flat.slice(0, 24), ...Array(12).fill(900_000)];
    rising[30] = null;
    s.Oversight = { ...OVERSIGHT_AGGREGATES, firstMonth: '2022-01', monthCount: 36, monthly: { 'ZZ|X1': { paid: rising, billers: rising.map((v) => (v === null ? null : 20)) }, 'ZZ|X2': { paid: flat, billers: flat.map(() => 20) } }, nationalMonthly: {} };
    s.Radar = POTENTIAL_FRAUD_RADAR;
    s.Review = review;
    s.ReviewEarlyWarning();
    const months = s.EarlyWarnings['ZZ|X1'].months;
    expect(months.find((m) => m.ym === '2024-03').isAlert).toBe(true); // 2.7M vs 1.2M
    expect(months.find((m) => m.ym === '2024-07').isAlert).toBe(false); // window holds the withheld month
    expect(s.EarlyWarnings['ZZ|X2'].alertMonths).toBe(0);
  });
});

describe('OversightReview biller groups (real figures)', () => {
  it('follows the Arizona psychoeducation billers of 2022 across years and services', () => {
    const g = o.BillerGroups['AZ|H2027|2022'];
    expect(g.members).toBe(239);
    expect(g.paidPath.map((p) => p.year)).toEqual([2021, 2022, 2024]);
    expect(g.billingPath.map((p) => p.billing)).toEqual([239, 206, 107]);
    expect(g.services[0].isGroupCode).toBe(true);
    expect(g.services[0].hcpcs).toBe('H2027');
    expect(g.services.length).toBeGreaterThan(4);
    expect(g.services[0].billingChangeFromPeak).toBeLessThan(-0.5);
  });

  it('shows a played-out group (the same code in another state when the state has none) and the latest year as a watch list', () => {
    const az = o.GroupsByStateCode['AZ|H2027'];
    expect(az.shown).toBe('AZ|H2027|2022');
    expect(az.shownIsOtherState).toBe(false);
    const ky = o.GroupsByStateCode['KY|H2027'];
    expect(ky.shown).toBe('KY|H2027|2020'); // its own played-out group comes before another state's
    expect(ky.shownIsOtherState).toBe(false);
    expect(ky.watch).toBe('KY|H2027|2024');
    const borrowed = Object.entries(o.GroupsByStateCode).filter(([, v]) => v.shownIsOtherState);
    expect(borrowed.length).toBeGreaterThan(0);
    for (const [k, v] of borrowed) {
      const g = o.BillerGroups[v.shown];
      expect(g.hcpcs).toBe(k.split('|')[1]);
      expect(g.state).not.toBe(k.split('|')[0]);
      expect(g.latestYear - g.year).toBeGreaterThanOrEqual(GROUP_RULE.playedOutYears);
    }
    const watch = o.BillerGroups[ky.watch];
    expect(watch.isWatchList).toBe(true);
    expect(watch.comparisonYear).toBe(2022);
    expect(watch.billingPath.map((p) => p.year)).toEqual([2022, 2023, 2024]);
    expect(watch.billingPath[2].billing).toBe(171);
    expect(watch.services.find((s) => !s.isGroupCode).paidMultipleSinceComparison).toBeGreaterThan(0);
  });

  it('splits the code\'s national paid into the group\'s state, the leading other state and the rest', () => {
    const n = o.NationalCodeYears['AZ|H2027'];
    expect(n.other).toBe('KY');
    for (const y of n.years) expect(y.statePaid + y.otherPaid + y.restPaid).toBeGreaterThanOrEqual(y.national - 1);
  });
});

describe('OversightReview provider patterns (real figures)', () => {
  it('ranks Kentucky psychoeducation\'s newcomer signs against comparable state services', () => {
    expect(o.ComparableProfileCount).toBeGreaterThan(2500);
    const p = o.BillerProfiles['KY|H2027'];
    expect(p.billers).toBe(171);
    const sign = Object.fromEntries(p.signs.map((s) => [s.id, s]));
    expect(sign['newcomer-billers'].value).toBeCloseTo(126 / 171, 3);
    expect(sign['newcomer-paid'].value).toBeCloseTo(0.449, 2);
    expect(sign['dependent-newcomer-paid'].value).toBeCloseTo(0.36, 2);
    for (const s of p.signs) {
      expect(s.rankAmongComparable).toBeGreaterThan(0.9);
      expect(s.typical).toBeLessThan(s.value);
    }
    expect(PROFILE_SIGNS).toHaveLength(3);
    expect(COMPARABLE_PROFILE.minBillers).toBe(30);
  });

  it('carries cohorts, other patterns and areas, with withheld counts as null', () => {
    const p = o.BillerProfiles['KY|H2027'];
    expect(p.cohorts.map((c) => c.id)).toEqual(['established', 'year-before', 'year']);
    expect(p.cohorts[0].depends.count).toBe(17);
    expect(p.newcomerBillers).toBe(126);
    expect(p.millionFast.count).toBeNull();
    expect(p.sharedAddress.count).toBe(15);
    expect(p.sharedAddresses).toBe(7);
    expect(p.top10Share).toBeGreaterThan(0.5);
    expect(p.areas[p.areas.length - 1].city).toBe('all other areas');
    for (const a of p.areas) expect(a.billers === null || a.billers >= 11).toBe(true);
  });
});

describe('OversightReview explanation ledger and state brief (real figures)', () => {
  it('lists the events on file for Kentucky psychoeducation in date order with the review\'s verdict', () => {
    const l = o.ExplanationLedgers['KY|H2027'];
    const dates = l.events.map((e) => e.event.effectiveDate);
    expect(dates).toEqual([...dates].sort());
    expect(l.events.length).toBeGreaterThanOrEqual(5);
    expect(l.verdictTag).toBe(review.ServiceYears.find((s) => s.id === l.latestServiceYearId).explanationTag);
    const total = Object.values(o.LedgerSplit).reduce((a, v) => a + v, 0);
    expect(total).toBe(review.ServiceYears.filter((s) => s.year === review.LatestYear).length);
  });

  it('names one reading per West Virginia service above the line, most dollars above it first', () => {
    const b = o.StateBriefs.WV;
    expect(b.services).toBe(b.rows.length);
    expect(b.rows.map((r) => r.aboveEnrollment)).toEqual([...b.rows.map((r) => r.aboveEnrollment)].sort((x, y) => y - x));
    const keys = BRIEF_READINGS.map((r) => r.key);
    for (const r of b.rows) expect(keys).toContain(r.reading);
    const attendant = b.rows.find((r) => r.hcpcs === 'S5125');
    if (attendant) expect(attendant.reading).toBe('falling');
    expect(b.questions.length).toBeGreaterThanOrEqual(2);
    expect(b.questions[b.questions.length - 1].text).toMatch(/2025 and 2026/);
    for (const r of b.rows.filter((x) => x.billersAreWithheld)) expect(r.billers).toBeLessThan(11);
  });

  it('names the state in the brief\'s questions when state names are staged', () => {
    const s = new OversightReview();
    s.Oversight = OVERSIGHT_AGGREGATES;
    s.Radar = POTENTIAL_FRAUD_RADAR;
    s.Review = review;
    s.StateNames = { WV: 'West Virginia' };
    s.NameStateBriefReadings();
    expect(s.StateBriefs.WV.questions[0].text).toMatch(/West Virginia's share of enrollment/);
    expect(o.StateBriefs.WV.questions[0].text).toMatch(/WV's share of enrollment/);
  });

  it('places each ledger\'s verdict in the same split the radar counts', () => {
    for (const l of Object.values(o.ExplanationLedgers)) expect(['explained', 'not-yet-searched', 'unexplained-so-far']).toContain(l.verdictSplit);
    const latestLedgers = Object.values(o.ExplanationLedgers).filter((l) => l.latestServiceYearId.endsWith(`|${review.LatestYear}`));
    const counted = Object.fromEntries(Object.keys(o.LedgerSplit).map((k) => [k, latestLedgers.filter((l) => l.verdictSplit === k).length]));
    expect(counted).toEqual(o.LedgerSplit);
  });
});

describe('OversightReview group services against their peak (real figures)', () => {
  it('measures paid in the latest year against the peak paid year', () => {
    const own = o.BillerGroups['AZ|H2027|2022'].services[0];
    expect(own.paidChangeFromPeak).toBeLessThan(-0.75);
    expect(own.paidChangeFromPeak).toBeCloseTo(own.latestPaid / own.peakPaid - 1, 6);
  });
});

describe('OversightReview reads its rules from the export', () => {
  it('takes the small-cell minimum and the stage definitions from the export, and reads none without them', () => {
    expect(o.SmallCellMinimum).toBe(OVERSIGHT_AGGREGATES.smallCellMinimum);
    expect(o.StageParameters.recentNppesYears).toBe(2);
    const bare = new OversightReview();
    bare.Oversight = { ...OVERSIGHT_AGGREGATES, smallCellMinimum: undefined };
    bare.Radar = POTENTIAL_FRAUD_RADAR;
    bare.Review = review;
    bare.NameStateBriefReadings();
    expect(bare.OversightIsLoaded).toBe(false);
    expect(Object.keys(bare.StateBriefs)).toHaveLength(0);
  });

  it('sums the newcomer signs from the cohorts: Kentucky psychoeducation 126 of 171 billers', () => {
    const p = o.ProfileSigns['KY|H2027'];
    expect(p.billers).toBe(171);
    expect(p.signs['newcomer-billers']).toBeCloseTo(126 / 171, 6);
  });

  it('counts the signs above HIGH_SIGN_RANK of comparable services', () => {
    const p = o.BillerProfiles['KY|H2027'];
    expect(p.HighSignCount).toBe(p.signs.filter((s) => s.rankAmongComparable > HIGH_SIGN_RANK).length);
    expect(p.HighSignCount).toBe(3);
  });
});

describe('OversightReview small cells on the pages', () => {
  it('withholds a sign value whose newcomer figure covers a withheld cohort, and shows Kentucky psychoeducation', () => {
    const profiles = Object.values(o.BillerProfiles);
    const withheld = profiles.filter((p) => p.newcomerBillers === null);
    expect(withheld.length).toBeGreaterThan(0);
    for (const p of profiles) {
      const byId = Object.fromEntries(p.signs.map((s) => [s.id, s]));
      expect(byId['newcomer-billers'].signValueIsWithheld).toBe(p.newcomerBillers === null);
      expect(byId['newcomer-paid'].signValueIsWithheld).toBe(p.newcomerPaid === null);
      expect(byId['dependent-newcomer-paid'].signValueIsWithheld).toBe(p.dependentNewcomerPaid === null);
    }
    expect(o.BillerProfiles['KY|H2027'].signs.every((s) => !s.signValueIsWithheld)).toBe(true);
  });

  it('reads a month with dollars and no billers as withheld', () => {
    for (const e of Object.values(o.EarlyWarnings)) {
      for (const m of e.months) expect(m.billers === 0 && m.paid > 0).toBe(false);
    }
  });

  it('withholds the annual flag\'s dollars and the known cases\' dollars for years with fewer billers than the minimum', () => {
    const min = o.SmallCellMinimum;
    for (const e of Object.values(o.EarlyWarnings)) {
      if (!e.annualFlag) continue;
      const s = review.ServiceYears.find((x) => x.id === e.annualFlag.id);
      expect(e.annualFlag.statePaidIsWithheld).toBe(s.statePaid > 0 && !(s.billingNpis >= min));
      expect(typeof e.annualFlag.priorYearPaidIsWithheld).toBe('boolean');
    }
    for (const c of o.KnownCaseOutcomes) {
      expect(typeof c.paidThatYearIsWithheld).toBe('boolean');
      expect(typeof c.paidAfterIsKnown).toBe('boolean');
    }
    const ky = o.EarlyWarnings['KY|H2027'];
    expect(ky.annualFlag.statePaidIsWithheld).toBe(false);
  });

  it('answers once per state-code-year which dollars are withheld, and the brief reads the same answer', () => {
    const min = o.SmallCellMinimum;
    const [k, rows] = Object.entries(POTENTIAL_FRAUD_RADAR.series)[0];
    for (const [year, paid, billers] of rows) expect(o.YearPaidIsWithheld.get(`${k}|${year}`)).toBe(paid > 0 && !(billers >= min));
    for (const b of Object.values(o.StateBriefs)) {
      for (const row of b.rows) expect(row.billersAreWithheld).toBe(o.YearPaidIsWithheld.get(`${row.s.state}|${row.hcpcs}|${b.year}`));
    }
  });
});
