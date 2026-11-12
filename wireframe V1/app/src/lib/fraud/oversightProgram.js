// CodeXen-Container: v1 kind=program container=OversightReview
/**
 * OversightReview: program container for the five oversight pages of Potential
 * Fraud Detection (plan: docs/planning/oversight-pages-codexen-plan.md). It reads
 * the biller oversight aggregate the warehouse owner loaded (owned by
 * BillerOversightAggregateOwner, exported with the small-cell rule applied by the
 * oversight export), the radar export, and the scored signal review
 * (PotentialFraudSignalReview), and runs five Business Actions:
 *
 * - ReviewEarlyWarning: per flagged state-code with a monthly series, the
 *   three-month payments against the same months a year earlier, the months that
 *   alert (ALERT_RULE), the first alert from the January before the year the
 *   change starts, what was paid after it, the months from it to the first
 *   confirmed restriction on file, and the annual screen's flag of the same rise;
 *   the known cases' first flags against what was paid afterwards; and the latest
 *   year's services flagged for the first time, by pattern.
 * - ReviewBillerGroups: per biller group (the billers of a surging or tripling
 *   service in a year), its members billing and paid per year, the services it
 *   bills with each one's peak and latest year; for each flagged state-code the
 *   played-out group to show (GROUP_RULE: its own, else the same code's in another
 *   state) and its watch-list group (its own latest year); and
 *   each group code's national paid per year split by state.
 * - RankBillerProfiles: per latest-year biller profile, the three signs of a
 *   newcomer-driven service (PROFILE_SIGNS), their medians over comparable state
 *   services (COMPARABLE_PROFILE) and over the code's other states, and the rank
 *   among comparable services; the cohorts, other patterns and practice areas of
 *   each flagged service.
 * - SummarizeExplanationLedgers: per flagged state-code, the confirmed and
 *   suggested policy events on file for it in date order, the verdict (the signal
 *   review's tag on its latest service-year), and what was searched; and across
 *   the latest year, how many services carry an innocent explanation, none, or
 *   no search yet.
 * - NameStateBriefReadings: per state, the latest year's services paid above the
 *   enrollment line, most dollars above it first, each named with one reading
 *   (BRIEF_READINGS), the brief's totals and its three questions.
 *
 * Figures for fewer than the export's small-cell minimum of billers arrive as null
 * and stay null; a sum over a null is not known. The program writes nothing and
 * holds no business state. Run cycle: stage Oversight, Radar and Review (and
 * CodeLabels, StateNames); run the Business Actions; read the outputs below. Each Business
 * Action restores its outputs to INITIAL first.
 */

/** The schema of the oversight export this program reads (ExportOversightAggregatesForUi). */
export const OVERSIGHT_EXPORT_SCHEMA = 'decisionpro/oversight-aggregates/v1';

/**
 * The monthly rule (applied recommendation 3, 2026-11-12): a month alerts when its three months' payments (the
 * month and the two before) are at least `multiple` times the same three months a year earlier and at least
 * `minimumPaid`. It is a rule DecisionPro proposes, not part of the annual screen.
 */
export const ALERT_RULE = Object.freeze({ windowMonths: 3, multiple: 2, minimumPaid: 1_000_000 });

/** Comparable state services for the provider-pattern ranks (applied recommendation 5): at least 30 billers and $5M paid. */
export const COMPARABLE_PROFILE = Object.freeze({ minBillers: 30, minPaid: 5_000_000 });

/** A sign is high when it is above this share of comparable state services. */
export const HIGH_SIGN_RANK = 0.9;

/** The three signs of a newcomer-driven service, from the export's profile sign columns. */
export const PROFILE_SIGNS = Object.freeze([
  Object.freeze({ id: 'newcomer-billers', label: 'Billers that first billed the code in the last two years', numerator: 'newcomerBillers', denominator: 'billers' }),
  Object.freeze({ id: 'newcomer-paid', label: 'Share of the dollars paid to those newcomers', numerator: 'newcomerPaid', denominator: 'paid' }),
  Object.freeze({ id: 'dependent-newcomer-paid', label: 'Share of the dollars paid to newcomers that depend on this one code', numerator: 'dependentNewcomerPaid', denominator: 'paid' }),
]);

/**
 * The state brief's readings (applied recommendation 6), in order of precedence: FALLING (paid fell by
 * `fallingDrop` or more on the prior year), ASK WHY (the service blew up in any year on file), NEW · SMALL (first
 * flagged this year and paid under `newSmallPaid`), LONG-RUNNING (far above the enrollment line `longRunningYears`
 * years or more), RISING (paid grew by `risingGrowth` or more on the prior year), else STEADY.
 */
export const BRIEF_RULE = Object.freeze({ fallingDrop: 0.2, newSmallPaid: 5_000_000, longRunningYears: 3, risingGrowth: 0.2, largeBlowupPaid: 10_000_000 });
export const BRIEF_READINGS = Object.freeze([
  Object.freeze({ key: 'falling', label: 'FALLING' }),
  Object.freeze({ key: 'ask-why', label: 'ASK WHY' }),
  Object.freeze({ key: 'new-small', label: 'NEW · SMALL' }),
  Object.freeze({ key: 'long-running', label: 'LONG-RUNNING' }),
  Object.freeze({ key: 'rising', label: 'RISING' }),
  Object.freeze({ key: 'steady', label: 'STEADY' }),
]);

/** How the ledger groups the signal review's tags across the radar: an innocent explanation on file, no search yet, or neither. */
export const LEDGER_SPLIT_KEYS = Object.freeze(['explained', 'not-yet-searched', 'unexplained-so-far']);

/** A group has played out when at least `playedOutYears` later years are on file; the follow-the-billers page shows one beside the watch list. */
export const GROUP_RULE = Object.freeze({ playedOutYears: 2 });

/** The cohorts of a profile, in the export's measure names: when the billers first billed the code in the state, and whether they depend on it. */
const COHORTS = Object.freeze([
  Object.freeze({ id: 'established', depends: 'established-depends', other: 'established-other' }),
  Object.freeze({ id: 'year-before', depends: 'year-before-depends', other: 'year-before-other' }),
  Object.freeze({ id: 'year', depends: 'year-depends', other: 'year-other' }),
]);
/** The newcomer cohorts: billers that first billed the code in the state in the profile year or the year before. */
const NEWCOMER_COHORTS = Object.freeze(COHORTS.filter((c) => c.id !== 'established'));
const NO_EVENT = Object.freeze({ id: '', effectiveDate: '', summary: '', kind: '', direction: '' });
const ymOf = (year, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const median = (values) => {
  if (values.length === 0) return 0;
  const v = [...values].sort((x, y) => x - y);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
const sumKnown = (values) => (values.some((v) => v === null) ? null : values.reduce((a, v) => a + v, 0));

export class OversightReview {
  constructor() {
    this.InitializeOversightReview();
  }

  InitializeOversightReview() {
    // Inputs staged by the caller.
    this.Oversight = {};   // the oversight export payload (OVERSIGHT_AGGREGATES)
    this.Radar = {};       // the radar export payload (POTENTIAL_FRAUD_RADAR)
    this.Review = null;    // a PotentialFraudSignalReview that has scored the same radar
    this.CodeLabels = {};  // plain labels by HCPCS code, merged over the exports'
    this.StateNames = {};  // state names by state code, for the brief's questions
    // Run state.
    this.OversightIsLoaded = false;
    this.OversightProblem = '';
    this.ReviewIsLoaded = false;
    this.Labels = {};
    this.MonthAxis = [];
    this.ServiceYearsByStateCode = new Map();
    this.LatestYear = 0;
    this.SmallCellMinimum = 0;
    this.StageParameters = {};
    this.ResetEarlyWarning();
    this.ResetBillerGroups();
    this.ResetBillerProfiles();
    this.ResetExplanationLedgers();
    this.ResetStateBriefs();
  }

  // Business Action
  ReviewEarlyWarning() {
    this.ResetEarlyWarning();
    this.PrepareOversightInputs();
    if (!this.OversightIsLoaded || !this.ReviewIsLoaded) return;
    this.MeasureMonthlySeries();
    this.AreMonthsAlerts();
    this.DateFirstAlerts();
    this.MeasurePaidAfterAlerts();
    this.DateFirstRestrictionsAfterAlerts();
    this.ReadAnnualFlags();
    this.PhaseMonths();
    this.ListKnownCaseOutcomes();
    this.CountFirstFlagsInLatestYear();
  }

  // Business Action
  ReviewBillerGroups() {
    this.ResetBillerGroups();
    this.PrepareOversightInputs();
    if (!this.OversightIsLoaded || !this.ReviewIsLoaded) return;
    this.DecodeBillerGroups();
    this.MeasureGroupPaths();
    this.MeasureGroupServices();
    this.WhichGroupsFollowEachStateCode();
    this.MeasureNationalCodeYears();
  }

  // Business Action
  RankBillerProfiles() {
    this.ResetBillerProfiles();
    this.PrepareOversightInputs();
    if (!this.OversightIsLoaded) return;
    this.DecodeProfileSigns();
    this.AreProfilesComparable();
    this.MeasureSignMedians();
    this.DecodeFlaggedProfiles();
    this.RankFlaggedProfileSigns();
    this.AreFlaggedProfileSignsHigh();
  }

  // Business Action
  SummarizeExplanationLedgers() {
    this.ResetExplanationLedgers();
    this.PrepareOversightInputs();
    if (!this.ReviewIsLoaded) return;
    this.ListLedgerEvents();
    this.WhichLedgerGroupIsEachServiceYearIn();
    this.ReadLedgerVerdicts();
    this.CountLedgerSplit();
  }

  // Business Action
  NameStateBriefReadings() {
    this.ResetStateBriefs();
    this.PrepareOversightInputs();
    if (!this.ReviewIsLoaded || !this.OversightIsLoaded) return;
    this.ListServicesAboveEnrollmentLine();
    this.MeasureBriefRows();
    this.WhichReadingFitsEachBriefRow();
    this.SummarizeStateBriefs();
    this.WriteBriefQuestions();
  }

  // ---- Shared preparation -------------------------------------------------

  // PASSIVE: the shared run state every Business Action reads, prepared once per staged input set: whether the
  // exports and the review can be read, the merged labels, the month axis, and the review's service-years by
  // state-code (earliest year first).
  PrepareOversightInputs() {
    this.IsOversightLoaded();
    this.ReadExportRules();
    this.IsReviewLoaded();
    this.MergeCodeLabels();
    this.BuildMonthAxis();
    this.IndexServiceYearsByStateCode();
  }

  // Question: is an oversight export staged that this program can read (its schema, its series, groups and profiles,
  // and a first month)? Writes OversightIsLoaded and, when one is staged but unreadable, the reason in OversightProblem.
  IsOversightLoaded() {
    const o = this.Oversight ?? {};
    this.OversightIsLoaded = o.schema === OVERSIGHT_EXPORT_SCHEMA && Boolean(o.monthly && o.groups && o.profileSigns && o.profiles && o.stageParameters)
      && Number.isInteger(o.smallCellMinimum) && o.smallCellMinimum > 0 && /^\d{4}-\d{2}$/.test(o.firstMonth ?? '');
    this.OversightProblem = this.OversightIsLoaded || Object.keys(o).length === 0 ? '' : `the oversight export is not ${OVERSIGHT_EXPORT_SCHEMA} with series, groups and profiles`;
  }

  // PASSIVE: the rules the export was made under, read from it and nowhere else: the small-cell minimum (no figure a
  // page shows describes fewer billers) and the stage's definitions behind the profile measures.
  ReadExportRules() {
    this.SmallCellMinimum = this.OversightIsLoaded ? this.Oversight.smallCellMinimum : 0;
    this.StageParameters = this.OversightIsLoaded ? { ...this.Oversight.stageParameters } : {};
  }

  // Question: is a scored signal review staged with the radar it scored? Writes ReviewIsLoaded.
  IsReviewLoaded() {
    this.ReviewIsLoaded = Boolean(this.Review && Array.isArray(this.Review.ServiceYears) && this.Review.ServiceYears.length > 0 && this.Radar && this.Radar.series);
    this.LatestYear = this.ReviewIsLoaded ? this.Review.LatestYear : 0;
  }

  // PASSIVE: the radar's and the oversight export's labels, the caller's over them.
  MergeCodeLabels() {
    this.Labels = { ...(this.Oversight?.codeLabels ?? {}), ...(this.Radar?.codeLabels ?? {}), ...this.CodeLabels };
  }

  // PASSIVE: the months of the export's series, first to last.
  BuildMonthAxis() {
    this.MonthAxis = [];
    if (!this.OversightIsLoaded) return;
    const first = this.Oversight.firstMonth;
    this.MonthAxis = Array.from({ length: this.Oversight.monthCount }, (_, i) => {
      const m = Number(first.slice(5, 7)) - 1 + i;
      return ymOf(Number(first.slice(0, 4)) + Math.floor(m / 12), m % 12);
    });
  }

  // PASSIVE: the review's service-years by state-code, earliest year first.
  IndexServiceYearsByStateCode() {
    this.ServiceYearsByStateCode = new Map();
    if (!this.ReviewIsLoaded) return;
    for (const s of this.Review.ServiceYears) {
      const k = `${s.state}|${s.hcpcs}`;
      if (!this.ServiceYearsByStateCode.has(k)) this.ServiceYearsByStateCode.set(k, []);
      this.ServiceYearsByStateCode.get(k).push(s);
    }
    for (const list of this.ServiceYearsByStateCode.values()) list.sort((a, b) => a.year - b.year);
  }

  // ---- Early warning ------------------------------------------------------

  // PASSIVE: early-warning outputs to INITIAL.
  ResetEarlyWarning() {
    this.EarlyWarnings = {};
    this.KnownCaseOutcomes = [];
    this.FirstFlagsInLatestYear = { services: 0, flags: 0, byPattern: {} };
  }

  // PASSIVE: each monthly series on the month axis: paid and billers (null when withheld), the national paid
  // for the code, the state's share of it, the three-month payments and the same three months a year earlier.
  MeasureMonthlySeries() {
    const w = ALERT_RULE.windowMonths;
    for (const [k, series] of Object.entries(this.Oversight.monthly)) {
      const [state, hcpcs] = k.split('|');
      const national = this.Oversight.nationalMonthly?.[hcpcs] ?? [];
      const months = this.MonthAxis.map((ym, i) => {
        const paid = series.paid[i];
        const nationalPaid = national[i] ?? 0;
        const window = i >= w - 1 ? series.paid.slice(i - w + 1, i + 1) : [null];
        return {
          ym, paid, billers: series.billers[i], nationalPaid,
          share: paid !== null && nationalPaid > 0 ? paid / nationalPaid : null,
          threeMonthPaid: sumKnown(window),
          yearEarlierThreeMonthPaid: null,
          isAlert: false,
          phase: 'before',
        };
      });
      for (let i = 12; i < months.length; i += 1) months[i].yearEarlierThreeMonthPaid = months[i - 12].threeMonthPaid;
      this.EarlyWarnings[k] = {
        id: k, state, hcpcs, codeLabel: this.Labels[hcpcs] ?? `HCPCS ${hcpcs}`, months,
        alertMonths: 0, changeStartYear: 0, firstAlertMonth: '', firstAlert: null,
        paidAfterAlert: 0, paidAfterAlertIsKnown: false, paidAfterAlertFrom: '', paidAfterAlertTo: '',
        firstRestriction: NO_EVENT, monthsToFirstRestriction: 0, firstRestrictionIsOnFile: false,
        annualFlag: null, latestServiceYearId: '',
      };
    }
  }

  // Question: does each month alert by ALERT_RULE? Writes isAlert on each month and counts them.
  AreMonthsAlerts() {
    for (const e of Object.values(this.EarlyWarnings)) {
      for (const m of e.months) {
        m.isAlert = m.threeMonthPaid !== null && m.yearEarlierThreeMonthPaid !== null
          && m.threeMonthPaid >= ALERT_RULE.minimumPaid && m.threeMonthPaid >= ALERT_RULE.multiple * m.yearEarlierThreeMonthPaid;
        if (m.isAlert) e.alertMonths += 1;
      }
    }
  }

  // PASSIVE: the first alert month of the change each state-code's latest service-year shows, counted from the
  // January before the year that change starts (the signal review's change start); '' when none alerts.
  DateFirstAlerts() {
    for (const e of Object.values(this.EarlyWarnings)) {
      const years = this.ServiceYearsByStateCode.get(e.id) ?? [];
      const latest = years[years.length - 1];
      if (!latest) continue;
      e.latestServiceYearId = latest.id;
      e.changeStartYear = latest.changeStartYear;
      const from = `${latest.changeStartYear - 1}-01`;
      const at = e.months.findIndex((m) => m.isAlert && m.ym >= from);
      if (at < 0) continue;
      const m = e.months[at];
      e.firstAlertMonth = m.ym;
      e.firstAlert = {
        ym: m.ym, threeMonthPaid: m.threeMonthPaid, yearEarlierThreeMonthPaid: m.yearEarlierThreeMonthPaid, billers: m.billers,
        shareBefore: at > 0 ? e.months[at - 1].share : null, share: m.share,
      };
    }
  }

  // PASSIVE: what was paid from the month after the first alert to the last month on file (not known when a
  // month in between is withheld).
  MeasurePaidAfterAlerts() {
    for (const e of Object.values(this.EarlyWarnings)) {
      if (!e.firstAlertMonth) continue;
      const after = e.months.filter((m) => m.ym > e.firstAlertMonth);
      if (after.length === 0) continue;
      const total = sumKnown(after.map((m) => m.paid));
      e.paidAfterAlertIsKnown = total !== null;
      e.paidAfterAlert = total ?? 0;
      e.paidAfterAlertFrom = after[0].ym;
      e.paidAfterAlertTo = after[after.length - 1].ym;
    }
  }

  // PASSIVE: the first confirmed restriction on file for the state-code that took effect in or after the first
  // alert month, and the months from the alert to it.
  DateFirstRestrictionsAfterAlerts() {
    for (const e of Object.values(this.EarlyWarnings)) {
      if (!e.firstAlertMonth || !e.latestServiceYearId) continue;
      const s = this.Review.ServiceYears.find((x) => x.id === e.latestServiceYearId);
      const restriction = (s?.coveringPolicyEvents ?? [])
        .map((m) => m.event)
        .filter((ev) => ev.standing === 'confirmed' && ev.explanationKind === 'restriction' && ev.effectiveDate.slice(0, 7) >= e.firstAlertMonth)
        .sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : 0))[0];
      if (!restriction) continue;
      e.firstRestriction = { id: restriction.id, effectiveDate: restriction.effectiveDate, summary: restriction.summary, kind: restriction.kind, direction: restriction.direction };
      e.firstRestrictionIsOnFile = true;
      e.monthsToFirstRestriction = monthsBetween(e.firstAlertMonth, restriction.effectiveDate.slice(0, 7));
    }
  }

  // PASSIVE: the annual screen's flag of the same change: the service-year of the year it starts, when the screen
  // flagged it (paid and share on the prior year).
  ReadAnnualFlags() {
    for (const e of Object.values(this.EarlyWarnings)) {
      const s = (this.ServiceYearsByStateCode.get(e.id) ?? []).find((x) => x.year === e.changeStartYear);
      if (!s) continue;
      e.annualFlag = { year: s.year, patterns: s.patterns, priorYearPaid: s.priorYearPaid, statePaid: s.statePaid, priorYearShare: s.priorYearShare, share: s.share, id: s.id };
    }
  }

  // PASSIVE: each month's place against the first alert (before, alert, after); the last month on file is 'last'
  // (the newest month is often short in the public file).
  PhaseMonths() {
    for (const e of Object.values(this.EarlyWarnings)) {
      for (const m of e.months) {
        if (!e.firstAlertMonth) m.phase = 'before';
        else m.phase = m.ym < e.firstAlertMonth ? 'before' : m.ym === e.firstAlertMonth ? 'alert' : 'after';
      }
      if (e.months.length) e.months[e.months.length - 1].phase = 'last';
    }
  }

  // PASSIVE: each known case's state-code (radar known cases the screen detected, the first listed for a
  // state-code): the year the rise the case names starts (the signal review's change start on the service-year the
  // case names) and the patterns the screen flagged then, paid that year, paid in the years after on file, and the
  // confirmed restrictions on file after that year.
  ListKnownCaseOutcomes() {
    const seen = new Set();
    for (const c of (this.Radar.knownCases ?? []).filter((x) => x.expected === 'detected')) {
      const k = `${c.state_code}|${c.hcpcs}`;
      if (seen.has(k)) continue;
      const years = this.ServiceYearsByStateCode.get(k) ?? [];
      const named = years.find((s) => s.year === c.year);
      if (!named) continue;
      seen.add(k);
      const flag = years.find((s) => s.year === named.changeStartYear) ?? named;
      const series = this.Radar.series?.[k] ?? [];
      const after = series.filter((r) => r[0] > flag.year);
      const latest = years[years.length - 1];
      const followed = (latest.coveringPolicyEvents ?? []).map((m) => m.event)
        .filter((ev) => ev.standing === 'confirmed' && ev.explanationKind === 'restriction' && ev.effectiveDate > `${flag.year}`)
        .sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : 0))
        .map((ev) => ({ id: ev.id, effectiveDate: ev.effectiveDate, kind: ev.kind, summary: ev.summary }));
      this.KnownCaseOutcomes.push({
        id: k, state: c.state_code, hcpcs: c.hcpcs, codeLabel: this.Labels[c.hcpcs] ?? `HCPCS ${c.hcpcs}`,
        firstFlagYear: flag.year, patterns: flag.patterns, paidThatYear: series.find((r) => r[0] === flag.year)?.[1] ?? flag.statePaid,
        paidAfter: after.reduce((a, r) => a + r[1], 0), afterFrom: after[0]?.[0] ?? 0, afterTo: after[after.length - 1]?.[0] ?? 0,
        followed,
      });
    }
    this.KnownCaseOutcomes.sort((a, b) => a.firstFlagYear - b.firstFlagYear || a.id.localeCompare(b.id));
  }

  // PASSIVE: the latest year's flags, and the services among them the screen flagged for the first time, by pattern.
  CountFirstFlagsInLatestYear() {
    const latest = this.Review.ServiceYears.filter((s) => s.year === this.LatestYear);
    const firsts = latest.filter((s) => (this.ServiceYearsByStateCode.get(`${s.state}|${s.hcpcs}`) ?? [])[0]?.year === this.LatestYear);
    const byPattern = {};
    for (const s of firsts) for (const p of s.patterns) byPattern[p] = (byPattern[p] ?? 0) + 1;
    this.FirstFlagsInLatestYear = { services: firsts.length, flags: latest.length, byPattern };
  }

  // ---- Follow the billers -------------------------------------------------

  // PASSIVE: biller-group outputs to INITIAL.
  ResetBillerGroups() {
    this.BillerGroups = {};
    this.GroupsByStateCode = {};
    this.NationalCodeYears = {};
  }

  // PASSIVE: the export's groups as named fields.
  DecodeBillerGroups() {
    for (const [k, g] of Object.entries(this.Oversight.groups)) {
      const [state, hcpcs, year] = k.split('|');
      this.BillerGroups[k] = {
        id: k, state, hcpcs, year: Number(year), codeLabel: this.Labels[hcpcs] ?? `HCPCS ${hcpcs}`, members: g.members,
        years: g.years.map(([y, membersBilling, membersPaid, membersCodePaid]) => ({ year: y, membersBilling, membersPaid, membersCodePaid })),
        rawServices: g.services,
        services: [], peakPaidYear: 0, paidPath: [], billingPath: [], latestYear: 0, isWatchList: false, comparisonYear: 0,
      };
    }
  }

  // PASSIVE: each group's paths. A group of the latest year is a watch list and looks back: paid for all services
  // and members billing two years before, one year before and in its own year, its services compared with two years
  // before. Any other group has played out: paid the year before its own, in its own year and in the latest year;
  // members billing in its own year, the year after and the latest year; its services compared with its own year.
  // Also the year it was paid most.
  MeasureGroupPaths() {
    for (const g of Object.values(this.BillerGroups)) {
      const at = (y) => g.years.find((r) => r.year === y);
      g.latestYear = Math.max(...g.years.map((r) => r.year));
      g.isWatchList = g.year === g.latestYear;
      g.comparisonYear = g.isWatchList ? g.year - 2 : g.year;
      const known = g.years.filter((r) => r.membersPaid !== null);
      g.peakPaidYear = known.length ? known.reduce((a, r) => (r.membersPaid > a.membersPaid ? r : a)).year : g.year;
      const paidYears = g.isWatchList ? [g.year - 2, g.year - 1, g.year] : [g.year - 1, g.year, g.latestYear];
      const billingYears = g.isWatchList ? [g.year - 2, g.year - 1, g.year] : [g.year, g.year + 1, g.latestYear];
      g.paidPath = paidYears.filter((y, i, a) => at(y) && a.indexOf(y) === i).map((y) => ({ year: y, paid: at(y).membersPaid }));
      g.billingPath = billingYears.filter((y, i, a) => at(y) && a.indexOf(y) === i).map((y) => ({ year: y, billing: at(y).membersBilling }));
    }
  }

  // PASSIVE: each service a group bills: members billing and paid per year, its peak year by members billing, the
  // latest year's billing against that peak, paid in the latest year against the group's comparison year and against
  // its peak paid. The group's own code first, then by peak paid.
  MeasureGroupServices() {
    for (const g of Object.values(this.BillerGroups)) {
      g.services = Object.entries(g.rawServices).map(([hcpcs, rows]) => {
        const byYear = rows.map(([year, billing, paid]) => ({ year, billing, paid }));
        const known = byYear.filter((r) => r.billing !== null);
        const peak = known.length ? known.reduce((a, r) => (r.billing > a.billing ? r : a)) : null;
        const latest = byYear.find((r) => r.year === g.latestYear) ?? null;
        const anchor = byYear.find((r) => r.year === g.comparisonYear) ?? null;
        const paidKnown = byYear.filter((r) => r.paid !== null);
        const peakPaid = paidKnown.length ? Math.max(...paidKnown.map((r) => r.paid)) : 0;
        return {
          hcpcs, codeLabel: this.Labels[hcpcs] ?? `HCPCS ${hcpcs}`, isGroupCode: hcpcs === g.hcpcs, byYear,
          peakYear: peak?.year ?? 0, peakBilling: peak?.billing ?? null, latestBilling: latest?.billing ?? null,
          billingChangeFromPeak: peak && latest && latest.billing !== null && peak.billing > 0 ? latest.billing / peak.billing - 1 : null,
          anchorPaid: anchor?.paid ?? null, latestPaid: latest?.paid ?? null,
          paidMultipleSinceComparison: anchor && latest && anchor.paid > 0 && latest.paid !== null ? latest.paid / anchor.paid : null,
          peakPaid,
          paidChangeFromPeak: latest && latest.paid !== null && peakPaid > 0 ? latest.paid / peakPaid - 1 : null,
        };
      }).sort((a, b) => (b.isGroupCode - a.isGroupCode) || (b.peakPaid - a.peakPaid) || a.hcpcs.localeCompare(b.hcpcs));
    }
  }

  // PASSIVE: for each flagged state-code, the played-out group to show (GROUP_RULE; of its own played-out groups, the
  // one whose year it was paid the most for the code; with none, the same code's played-out group in another state
  // whose members were paid the most for the code in its year) and its watch-list group (its own group of the
  // latest year); a state-code with neither has no entry. A question: which groups follow each state-code?
  WhichGroupsFollowEachStateCode() {
    const byStateCode = {};
    const byCode = {};
    for (const g of Object.values(this.BillerGroups)) {
      (byStateCode[`${g.state}|${g.hcpcs}`] ??= []).push(g);
      if (g.latestYear - g.year >= GROUP_RULE.playedOutYears) (byCode[g.hcpcs] ??= []).push(g);
    }
    const codePaid = (g) => g.years.find((r) => r.year === g.year)?.membersCodePaid ?? 0;
    for (const k of this.ServiceYearsByStateCode.keys()) {
      const [state, hcpcs] = k.split('|');
      const own = byStateCode[k] ?? [];
      const series = this.Radar.series?.[k] ?? [];
      const paidIn = (y) => series.find((r) => r[0] === y)?.[1] ?? 0;
      const earlier = own.filter((g) => g.latestYear - g.year >= GROUP_RULE.playedOutYears);
      const elsewhere = (byCode[hcpcs] ?? []).filter((g) => g.state !== state);
      const shown = earlier.length ? earlier.reduce((a, g) => (paidIn(g.year) > paidIn(a.year) ? g : a))
        : elsewhere.length ? elsewhere.reduce((a, g) => (codePaid(g) > codePaid(a) ? g : a)) : null;
      const watch = own.find((g) => g.isWatchList) ?? null;
      if (!shown && !watch) continue;
      this.GroupsByStateCode[k] = { shown: shown?.id ?? '', shownIsOtherState: Boolean(shown && shown.state !== state), watch: watch?.id ?? '', ownYears: own.map((g) => g.year).sort((a, b) => a - b) };
    }
  }

  // PASSIVE: for each group's state-code, the code's national paid per year split into the group's state, the
  // leading other state of the latest year (or of the group's year when none leads then), and all other.
  MeasureNationalCodeYears() {
    for (const group of Object.values(this.BillerGroups)) {
      const k = `${group.state}|${group.hcpcs}`;
      if (this.NationalCodeYears[k]) continue;
      const { state, hcpcs } = group;
      const national = this.Radar.nationalByCode?.[hcpcs] ?? {};
      const leading = (y) => (this.Radar.leadingStates?.[`${hcpcs}|${y}`] ?? []).find(([st]) => st !== state);
      const other = (leading(this.LatestYear) ?? leading(group.year) ?? [''])[0];
      const paidOf = (st, y) => {
        const row = (this.Radar.series?.[`${st}|${hcpcs}`] ?? []).find((r) => r[0] === y);
        if (row) return row[1];
        return (this.Radar.leadingStates?.[`${hcpcs}|${y}`] ?? []).find(([s]) => s === st)?.[1] ?? 0;
      };
      this.NationalCodeYears[k] = {
        state, other, hcpcs,
        years: Object.keys(national).map(Number).sort((a, b) => a - b).map((y) => {
          const total = national[y] ?? 0;
          const statePaid = paidOf(state, y);
          const otherPaid = other ? paidOf(other, y) : 0;
          return { year: y, national: total, statePaid, otherPaid, restPaid: Math.max(0, total - statePaid - otherPaid) };
        }),
      };
    }
  }

  // ---- Provider patterns --------------------------------------------------

  // PASSIVE: profile outputs to INITIAL.
  ResetBillerProfiles() {
    this.ProfileSigns = {};
    this.ComparableProfileCount = 0;
    this.TypicalSigns = {};
    this.ProfileSignsByCode = {};
    this.BillerProfiles = {};
    this.ProfileYear = 0;
  }

  // PASSIVE: every profile's three signs (PROFILE_SIGNS) from its billers and cohorts: the newcomers are the
  // NEWCOMER_COHORTS, the dependent newcomers their billers that depend on the code.
  DecodeProfileSigns() {
    const cols = this.Oversight.profileSignColumns;
    this.ProfileYear = this.Oversight.profileYear;
    for (const [k, row] of Object.entries(this.Oversight.profileSigns)) {
      const f = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
      const figures = {
        billers: f['billers:count'],
        paid: f['billers:paid'],
        newcomerBillers: NEWCOMER_COHORTS.reduce((sum, c) => sum + f[`${c.depends}:count`] + f[`${c.other}:count`], 0),
        newcomerPaid: NEWCOMER_COHORTS.reduce((sum, c) => sum + f[`${c.depends}:paid`] + f[`${c.other}:paid`], 0),
        dependentNewcomerPaid: NEWCOMER_COHORTS.reduce((sum, c) => sum + f[`${c.depends}:paid`], 0),
      };
      const [state, hcpcs] = k.split('|');
      this.ProfileSigns[k] = {
        id: k, state, hcpcs, billers: figures.billers, paid: figures.paid, isComparable: false,
        signs: Object.fromEntries(PROFILE_SIGNS.map((s) => [s.id, figures[s.denominator] > 0 ? figures[s.numerator] / figures[s.denominator] : 0])),
      };
    }
  }

  // Question: is each profile a comparable state service (COMPARABLE_PROFILE)? Writes isComparable.
  AreProfilesComparable() {
    for (const p of Object.values(this.ProfileSigns)) {
      p.isComparable = p.billers >= COMPARABLE_PROFILE.minBillers && p.paid >= COMPARABLE_PROFILE.minPaid;
      if (p.isComparable) this.ComparableProfileCount += 1;
    }
  }

  // PASSIVE: each sign's median over the comparable state services (TypicalSigns), and the profiles by code, for the
  // median over a code's other states.
  MeasureSignMedians() {
    const comparable = Object.values(this.ProfileSigns).filter((p) => p.isComparable);
    this.TypicalSigns = Object.fromEntries(PROFILE_SIGNS.map((s) => [s.id, median(comparable.map((p) => p.signs[s.id]))]));
    for (const p of Object.values(this.ProfileSigns)) (this.ProfileSignsByCode[p.hcpcs] ??= []).push(p);
  }

  // PASSIVE: the full profile of each flagged service: its measures as named counts and paid (null when withheld),
  // the cohorts, the other patterns, and its practice areas.
  DecodeFlaggedProfiles() {
    const names = this.Oversight.profileMeasures;
    for (const [k, row] of Object.entries(this.Oversight.profiles)) {
      const m = Object.fromEntries(names.map((n, i) => [n, { count: row[i][0], paid: row[i][1] }]));
      const [state, hcpcs] = k.split('|');
      const billers = m.billers.count;
      const paid = m.billers.paid;
      this.BillerProfiles[k] = {
        id: k, state, hcpcs, codeLabel: this.Labels[hcpcs] ?? `HCPCS ${hcpcs}`, year: this.ProfileYear, billers, paid,
        cohorts: COHORTS.map((c) => ({ id: c.id, depends: m[c.depends], other: m[c.other] })),
        noPaymentBefore: m['no-payment-before-year-before'],
        recentlyEnumerated: m['recently-enumerated'],
        million: m.million, millionFast: m['million-fast'], millionMedianMonths: m['million-median-months'].count,
        sharedAddress: m['shared-address'], sharedAddresses: m['shared-addresses'].count,
        top10Paid: m.top10.paid, top10Share: paid > 0 && m.top10.paid !== null ? m.top10.paid / paid : null,
        organizations: m.organization.count, individuals: m.individual.count,
        areas: (this.Oversight.areas?.[k] ?? []).map(([zip3, city, areaBillers, areaPaid]) => ({ zip3, city, billers: areaBillers, paid: areaPaid })),
        signs: [],
      };
    }
  }

  // PASSIVE: each flagged profile's three signs with the newcomer figures behind them, the typical value (median of
  // comparable services), the median of the code's other states, and the share of comparable services with a lower
  // value.
  RankFlaggedProfileSigns() {
    const comparable = Object.values(this.ProfileSigns).filter((p) => p.isComparable);
    for (const p of Object.values(this.BillerProfiles)) {
      const own = this.ProfileSigns[p.id];
      const others = (this.ProfileSignsByCode[p.hcpcs] ?? []).filter((x) => x.state !== p.state);
      p.otherStates = others.length;
      p.signs = PROFILE_SIGNS.map((s) => {
        const value = own?.signs[s.id] ?? 0;
        return {
          id: s.id, label: s.label, value,
          typical: this.TypicalSigns[s.id],
          otherStatesMedian: others.length ? median(others.map((x) => x.signs[s.id])) : null,
          rankAmongComparable: comparable.length ? comparable.filter((x) => x.signs[s.id] < value).length / comparable.length : 0,
        };
      });
      const newcomerCohorts = p.cohorts.filter((c) => NEWCOMER_COHORTS.some((n) => n.id === c.id));
      p.newcomerBillers = sumKnown(newcomerCohorts.flatMap((c) => [c.depends.count, c.other.count]));
      p.newcomerPaid = sumKnown(newcomerCohorts.flatMap((c) => [c.depends.paid, c.other.paid]));
      p.dependentNewcomerPaid = sumKnown(newcomerCohorts.map((c) => c.depends.paid));
    }
  }

  // Question: is each flagged profile's sign high (above HIGH_SIGN_RANK of comparable state services)? Writes each
  // sign's signIsHigh and the profile's HighSignCount.
  AreFlaggedProfileSignsHigh() {
    for (const p of Object.values(this.BillerProfiles)) {
      for (const s of p.signs) s.signIsHigh = s.rankAmongComparable > HIGH_SIGN_RANK;
      p.HighSignCount = p.signs.filter((s) => s.signIsHigh).length;
    }
  }

  // ---- Explanation ledger -------------------------------------------------

  // PASSIVE: ledger outputs to INITIAL.
  ResetExplanationLedgers() {
    this.ExplanationLedgers = {};
    this.LedgerSplit = Object.fromEntries(LEDGER_SPLIT_KEYS.map((k) => [k, 0]));
    this.LedgerGroupByServiceYearId = new Map();
  }

  // PASSIVE: per flagged state-code, every policy event on file whose scope covers it (confirmed and suggested), in
  // date order, each with its timing against the latest service-year's change start where the review gave one.
  ListLedgerEvents() {
    for (const [k, years] of this.ServiceYearsByStateCode) {
      const latest = years[years.length - 1];
      const timing = new Map([...latest.policyEvents, ...latest.laterPolicyEvents, ...latest.suggestedPolicyEvents].map((m) => [m.event.id, m.timing]));
      const counts = new Map(latest.policyEvents.map((m) => [m.event.id, m.countsTowardExplanation]));
      const events = (latest.coveringPolicyEvents ?? []).map((m) => m.event)
        .sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : a.id.localeCompare(b.id)))
        .map((ev) => ({ event: ev, timing: timing.get(ev.id) ?? '', countsTowardExplanation: counts.get(ev.id) ?? false }));
      this.ExplanationLedgers[k] = { id: k, latestServiceYearId: latest.id, events, verdictTag: '', verdictSplit: '', changeStartYear: latest.changeStartYear, changeStartIsKnown: latest.changeStartIsKnown, searchCoverage: null };
    }
  }

  // Question: which LEDGER_SPLIT_KEYS group is each service-year in: an innocent explanation on file (explained), no
  // search yet (not yet searched), or neither (unexplained so far)? Writes LedgerGroupByServiceYearId.
  WhichLedgerGroupIsEachServiceYearIn() {
    for (const s of this.Review.ServiceYears) {
      this.LedgerGroupByServiceYearId.set(s.id, s.innocentExplanationIsOnFile ? 'explained' : s.explanationTag === 'not-searched' ? 'not-yet-searched' : 'unexplained-so-far');
    }
  }

  // PASSIVE: each ledger's verdict, the review's tag on the latest service-year and its group, and the searches on
  // file for the state.
  ReadLedgerVerdicts() {
    for (const l of Object.values(this.ExplanationLedgers)) {
      const s = this.Review.ServiceYears.find((x) => x.id === l.latestServiceYearId);
      l.verdictTag = s.explanationTag;
      l.verdictSplit = this.LedgerGroupByServiceYearId.get(s.id);
      l.searchCoverage = this.Review.PolicySearchCoverageByState?.[s.state] ?? null;
    }
  }

  // PASSIVE: the latest year's service-years counted by their ledger group.
  CountLedgerSplit() {
    for (const s of this.Review.ServiceYears.filter((x) => x.year === this.LatestYear)) this.LedgerSplit[this.LedgerGroupByServiceYearId.get(s.id)] += 1;
  }

  // ---- State oversight brief ---------------------------------------------

  // PASSIVE: brief outputs to INITIAL.
  ResetStateBriefs() {
    this.StateBriefs = {};
  }

  // PASSIVE: per state, the latest year's service-years paid above the enrollment line, most dollars above it first.
  ListServicesAboveEnrollmentLine() {
    for (const s of this.Review.ServiceYears) {
      if (s.year !== this.LatestYear || !(s.aboveEnrollment > 0)) continue;
      (this.StateBriefs[s.state] ??= { state: s.state, year: this.LatestYear, rows: [], services: 0, aboveEnrollment: 0, largeBlowups: 0, enrollmentShare: 0, questions: [] }).rows.push({ s });
    }
    for (const b of Object.values(this.StateBriefs)) b.rows.sort((x, y) => y.s.aboveEnrollment - x.s.aboveEnrollment);
  }

  // PASSIVE: each brief row's figures: paid the year before and the change on it, the years paid ran far above the
  // line and the first of them, the first year flagged, the blow-up years, and whether its billers are fewer than
  // the small-cell minimum (its billers and dollars are then withheld).
  MeasureBriefRows() {
    for (const b of Object.values(this.StateBriefs)) {
      for (const row of b.rows) {
        const s = row.s;
        const k = `${s.state}|${s.hcpcs}`;
        const series = this.Review.YearlySeriesByStateCode[k] ?? [];
        const prior = series.find((r) => r.year === s.year - 1);
        const farAbove = series.filter((r) => r.isFarAboveEnrollmentLine && r.year <= s.year);
        const years = this.ServiceYearsByStateCode.get(k) ?? [];
        Object.assign(row, {
          id: s.id, hcpcs: s.hcpcs, codeLabel: this.Labels[s.hcpcs] ?? s.codeLabel, statePaid: s.statePaid, share: s.share, excessMultiple: s.excessMultiple,
          aboveEnrollment: s.aboveEnrollment, billers: s.billingNpis, billersAreWithheld: s.billingNpis > 0 && s.billingNpis < this.SmallCellMinimum,
          priorYearPaid: prior?.statePaid ?? 0, priorYearIsOnFile: Boolean(prior),
          changeOnPriorYear: prior && prior.statePaid > 0 ? s.statePaid / prior.statePaid - 1 : null,
          farAboveYears: farAbove.length, farAboveSince: farAbove[0]?.year ?? 0,
          firstFlaggedYear: years[0]?.year ?? s.year,
          blowupYears: years.filter((x) => x.isBlowup).map((x) => x.year),
          firstBlowup: years.find((x) => x.isBlowup) ?? null,
          seriesPaid: series.map((r) => ({ year: r.year, paid: r.statePaid })),
          reading: '', readingLabel: '',
        });
      }
    }
  }

  // Question: which reading fits each brief row, by BRIEF_READINGS' order of precedence? Writes row.reading and its
  // label.
  WhichReadingFitsEachBriefRow() {
    const r = BRIEF_RULE;
    const labels = Object.fromEntries(BRIEF_READINGS.map((x) => [x.key, x.label]));
    for (const b of Object.values(this.StateBriefs)) {
      for (const row of b.rows) {
        let key = 'steady';
        if (row.changeOnPriorYear !== null && row.changeOnPriorYear <= -r.fallingDrop) key = 'falling';
        else if (row.blowupYears.length > 0) key = 'ask-why';
        else if (row.firstFlaggedYear === b.year && row.statePaid < r.newSmallPaid) key = 'new-small';
        else if (row.farAboveYears >= r.longRunningYears) key = 'long-running';
        else if (row.changeOnPriorYear !== null && row.changeOnPriorYear >= r.risingGrowth) key = 'rising';
        row.reading = key;
        row.readingLabel = labels[key];
      }
    }
  }

  // PASSIVE: each brief's totals: services above the line, dollars above it, the year's blow-ups paid at least
  // BRIEF_RULE.largeBlowupPaid, and the state's enrollment share that year.
  SummarizeStateBriefs() {
    for (const b of Object.values(this.StateBriefs)) {
      b.services = b.rows.length;
      b.aboveEnrollment = b.rows.reduce((a, row) => a + row.aboveEnrollment, 0);
      b.largeBlowups = b.rows.filter((row) => row.s.isBlowup && row.statePaid >= BRIEF_RULE.largeBlowupPaid).length;
      b.enrollmentShare = this.Radar.enrollmentShare?.[`${b.state}|${b.year}`] ?? 0;
      b.readingCounts = Object.fromEntries(BRIEF_READINGS.map((x) => [x.key, b.rows.filter((row) => row.reading === x.key).length]));
    }
  }

  // PASSIVE: the brief's three questions, filled from its own rows: the service paid furthest above the state's
  // enrollment share; the largest blow-up on file and what changed in its year; and the months the public file
  // does not yet reach.
  WriteBriefQuestions() {
    const asOfYear = Number(String(this.Radar.asOf ?? '').slice(0, 4)) || this.LatestYear + 1;
    for (const b of Object.values(this.StateBriefs)) {
      const top = [...b.rows].filter((row) => !row.billersAreWithheld).sort((x, y) => y.excessMultiple - x.excessMultiple)[0];
      if (top) b.questions.push({ kind: 'enrollment', id: top.id, text: `${top.codeLabel} (${top.hcpcs}) is paid at ${top.excessMultiple >= 10 ? top.excessMultiple.toFixed(0) : top.excessMultiple.toFixed(1)} times ${this.StateNames[b.state] ?? b.state}'s share of enrollment. How much of that does the state's own count of people served explain?` });
      const jump = b.rows.filter((row) => row.firstBlowup && !row.billersAreWithheld)
        .map((row) => ({ row, ratio: row.firstBlowup.priorYearPaid > 0 ? row.firstBlowup.statePaid / row.firstBlowup.priorYearPaid : 0 }))
        .sort((x, y) => y.ratio - x.ratio)[0];
      if (jump && jump.ratio > 0) {
        const f = jump.row.firstBlowup;
        const size = jump.ratio >= 3 ? 'more than tripled' : jump.ratio >= 2 ? 'more than doubled' : 'raised';
        b.questions.push({ kind: 'blowup', id: f.id, text: `What changed in ${f.year} that ${size} payments for ${jump.row.codeLabel} (${jump.row.hcpcs}), and is it still the intended design?` });
      }
      const missing = Array.from({ length: Math.max(0, asOfYear - b.year) }, (_, i) => b.year + 1 + i);
      if (missing.length) b.questions.push({ kind: 'data', id: '', text: `Can the Medicaid agency supply monthly claims so the brief shows ${missing.join(' and ')}?` });
    }
  }
}
