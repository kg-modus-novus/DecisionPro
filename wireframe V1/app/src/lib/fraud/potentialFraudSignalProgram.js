// CodeXen-Container: v1 kind=program container=PotentialFraudSignalReview
/**
 * PotentialFraudSignalReview: program container for the Potential Fraud Detection
 * module's ranking. It reads the share-and-surge candidates the warehouse owner
 * wrote (owned by ShareAndSurgeCandidateOwner, exported by the radar export) and
 * runs one Business Action, ScorePotentialFraudCandidates:
 *
 * - merge the owner's candidate rows into one service-year per state, code and
 *   year, carrying every pattern it met;
 * - answer which service-years are collapse-only and which are blow-ups (the
 *   share surged or paid tripled);
 * - find cross-state displacement: another state's share collapsed on the same
 *   code in the same or the prior year while this one ran far above enrollment;
 * - give each service-year signal points (SIGNAL_WEIGHTS, SIGNAL_THRESHOLDS), a
 *   0-100 signal score that orders review, and a suggested tier (TIER_RULE). A
 *   reviewer sets the tier; the suggestion is DecisionPro's starting rule and is
 *   labeled so;
 * - read the NPPES counts the spending owner loaded for each service-year (new
 *   billers recently enumerated; billers outside the code's expected taxonomies);
 * - list the case-file checklist: public-data signals fired, clear or an innocent
 *   explanation to rule out, and the signals that wait on a join or on non-public
 *   data, each with a short label, counted by kind and by source;
 * - measure enrollment and paid changes and answer whether enrollment can
 *   explain the rise (HEALTH_EXPLANATION_RULE);
 * - date the rise from the screen's own figures (first flagged year, the year
 *   most billers arrived, known cases, displacement);
 * - measure each flagged state-code's yearly paid against the national total
 *   and its enrollment line (national paid x enrollment share), for the blow-up chart;
 * - summarize each year nationally and by state.
 *
 * It writes nothing and holds no business state. Run cycle: stage Radar and
 * CodeLabels, and optionally SignalWeights and TierCutoffs (a reviewer's score rule
 * for the session; INITIAL is DecisionPro's starting rule, SIGNAL_WEIGHTS and
 * STARTING_TIER_CUTOFFS); ScorePotentialFraudCandidates; read ServiceYears, YearSummaries,
 * StateYearSummaries, YearlySeriesByStateCode, Years, LatestYear, ActiveTierRule,
 * SignalWeightsTotal, ScoreRuleIsStartingRule, ScoreRuleIsValid, ScoreRuleProblems and
 * Errors. A score
 * rule outside SIGNAL_WEIGHT_RANGE or TIER_CUTOFF_RANGE, or with VERIFY not below
 * HIGH, is rejected with the reasons and nothing is scored. Each run restores run state
 * to INITIAL first.
 */

/** Points per signal. The total is capped at 100. */
export const SIGNAL_WEIGHTS = Object.freeze({
  excessMultiple: 25,      // from SIGNAL_THRESHOLDS.excessMultipleFloor (0) to excessMultipleFull (all), log scale
  shareSurge: 20,          // share at least doubled on the prior year
  tripledAndGrowing: 15,   // paid tripled over two years with no down year
  persistentExcess: 5,     // far above enrollment three years running (alone, a convention is likely)
  newEntrants: 15,         // share of this year's billers billing the code for the first time
  concentration: 10,       // top-10 billers' share of dollars; none with few billers
  displacement: 15,        // another state's share collapsed on the code in the same or prior year
});

/** The share-and-surge screen's patterns (the owner's pattern values), in the order the radar lists them. */
export const SCREEN_PATTERNS = Object.freeze(['share-surge', 'tripled-and-growing', 'persistent-excess', 'share-collapse']);

/** Every threshold the signal points and the checklist read. */
export const SIGNAL_THRESHOLDS = Object.freeze({
  excessMultipleFloor: 5,             // the screen's own "far above enrollment" multiple
  excessMultipleFull: 50,
  newEntrantFirstYear: 2020,          // the file starts 2018, so a first-time biller is knowable from 2019 and comparable from 2020
  newBillerSeriesFirstYear: 2019,
  newEntrantShareFull: 0.4,
  newEntrantShareFired: 0.25,
  concentrationMinimumBillers: 10,    // at or below this, few billers may be the program's design
  concentrationFloor: 0.3,
  concentrationFull: 0.8,
  concentrationFired: 0.5,
  comparableStatesBilling: 15,        // fewer states billing: a state billing convention may explain the share
  recentlyEnumeratedShareFired: 0.4,  // new billers enumerated in the year or the one before (about the top tenth of state-code-years)
  offTaxonomyPaidShareFired: 0.25,    // paid to billers outside the code's expected taxonomies (about the top tenth)
});

/** Displacement needs a real shift: the other state lost 10 points of national share, this one gained 5. */
export const DISPLACEMENT_MIN_DROP = 0.10;
export const DISPLACEMENT_MIN_RISE = 0.05;

/**
 * Can enrollment explain the rise? Enrollment share is flat when the first and last
 * screen years differ by under 15%; enrollment is flat or down when it grew under 10%
 * in the year; the rise is unexplained by enrollment when paid more than doubled over
 * two years and grew more than five times as fast as enrollment (enrollment growth
 * counted as at least 1%).
 */
export const HEALTH_EXPLANATION_RULE = Object.freeze({
  flatShareTolerance: 0.15,
  enrollmentFlatOrDownCeiling: 0.1,
  paidGrowthFloor: 1,
  enrollmentGrowthMultiple: 5,
  enrollmentGrowthFloor: 0.01,
});

/** A reviewer may set each signal's points from 0 to 50 for the session. */
export const SIGNAL_WEIGHT_RANGE = Object.freeze({ min: 0, max: 50 });

/** DecisionPro's starting tier cut-offs: HIGH at a signal score of 70 or more, VERIFY at 40 or more. */
export const STARTING_TIER_CUTOFFS = Object.freeze({ high: 70, verify: 40 });

/** A reviewer may set each cut-off from 1 to 100 for the session, VERIFY below HIGH. */
export const TIER_CUTOFF_RANGE = Object.freeze({ min: 1, max: 100 });

/** Each tier's test in words, for the cut-offs in force. */
const TIER_TESTS = Object.freeze({
  closed: () => 'share collapse only, and a known enforcement case',
  lookback: () => 'share collapse only: the money already left; look back at the years before',
  high: (c) => `signal score ${c.high} or more`,
  verify: (c) => `signal score ${c.verify} to ${c.high - 1}`,
  convention: (c) => `score under ${c.verify} and the only pattern is persistent excess: likely a billing convention or program design`,
  low: (c) => `score under ${c.verify}`,
});

/** The tiers whose floor is a tier cut-off, HIGH first; every other tier's floor is 0. */
export const TIER_CUTOFF_KEYS = Object.freeze(['high', 'verify']);

/** Suggested tier, in order of precedence, under the starting cut-offs. A reviewer sets the tier. */
export const TIER_RULE = Object.freeze([
  { key: 'closed', label: 'CLOSED · known case', shortLabel: 'CLOSED' },
  { key: 'lookback', label: 'LOOK-BACK · collapse', shortLabel: 'LOOK-BACK' },
  { key: 'high', label: 'HIGH', shortLabel: 'HIGH' },
  { key: 'verify', label: 'VERIFY', shortLabel: 'VERIFY' },
  { key: 'convention', label: 'CONVENTION?', shortLabel: 'CONVENTION?' },
  { key: 'low', label: 'LOW', shortLabel: 'LOW' },
].map((t) => Object.freeze({ ...t, minScore: TIER_CUTOFF_KEYS.includes(t.key) ? STARTING_TIER_CUTOFFS[t.key] : 0, test: TIER_TESTS[t.key](STARTING_TIER_CUTOFFS) })));

/** The suggested tiers whose dollars above the enrollment line are counted as worth review: the HIGH and VERIFY tiers of TIER_RULE. */
export const WORTH_REVIEW_TIER_KEYS = Object.freeze(['high', 'verify']);

/** The kinds of case-file check: fired, clear, explain (an innocent explanation to rule out), pending. */
export const CHECK_KINDS = Object.freeze(['fired', 'clear', 'explain', 'pending']);

/** Signals a case file lists that wait on a join or on non-public data. */
export const PENDING_CASE_SIGNALS = Object.freeze([
  { id: 'pending-shared-address', shortLabel: 'Shared address or officer', label: 'Shared practice address or authorized official across billers', detail: 'NPPES addresses and state business filings (filings not loaded)' },
  { id: 'pending-exclusion', shortLabel: 'Excluded billers', label: 'Billers on the HHS-OIG exclusion list or a state termination list', detail: 'LEIE is loaded as a state summary; a per-biller match needs the NPI-level rows' },
  { id: 'pending-enrollment-dates', shortLabel: 'Billing outside enrollment', label: 'Billing before enrollment start or after termination', detail: 'CMS T-MSIS enrollment segments (not loaded)' },
  { id: 'pending-units', shortLabel: 'Units per day', label: 'Units per beneficiary above what a day can hold', detail: 'Needs state claims with units (non-public, data use agreement)' },
  { id: 'pending-code-migration', shortLabel: 'Code migration', label: 'Code migration after a policy date', detail: 'Sibling-code series are in the file; the policy dates are not loaded' },
  { id: 'pending-plan-referrals', shortLabel: 'Plan referrals', label: 'Managed care plan referrals to the fraud control unit on this code', detail: 'MCPAR reports referrals by plan, not by code' },
]);

const NO_DISPLACEMENT = Object.freeze({ state: '', year: 0, share: 0, peakShare: 0, peakShareYear: 0, knownCaseId: '' });
/** The radar export's series columns that carry the NPPES counts. */
const NPPES_SERIES_COLUMNS = Object.freeze(['newBillingNpisEnumerationKnown', 'newBillingNpisRecentlyEnumerated', 'newBillingRecentlyEnumeratedPaid',
  'taxonomyKnownBillingNpis', 'taxonomyKnownPaid', 'offTaxonomyBillingNpis', 'offTaxonomyPaid']);
const NO_TIER = Object.freeze({ key: '', label: '', shortLabel: '' });
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const NO_SIGNAL_STRENGTH = Object.freeze(Object.fromEntries(Object.keys(SIGNAL_WEIGHTS).map((k) => [k, 0])));
const zeroPatternServices = () => Object.fromEntries(SCREEN_PATTERNS.map((p) => [p, 0]));
const asPct = (v) => `${(v * 100).toFixed(1)}%`;
const asMoney = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : `$${(v / 1e6).toFixed(1)}M`);

export class PotentialFraudSignalReview {
  constructor() {
    this.InitializeSignalReview();
  }

  InitializeSignalReview() {
    // Inputs staged by the caller.
    this.Radar = {};            // the radar export payload (POTENTIAL_FRAUD_RADAR)
    this.CodeLabels = {};       // plain labels by HCPCS code, merged over the export's
    this.SignalWeights = { ...SIGNAL_WEIGHTS };          // points per signal (the reviewer's, for the session)
    this.TierCutoffs = { ...STARTING_TIER_CUTOFFS };     // HIGH and VERIFY floors (the reviewer's, for the session)
    this.ResetSignalReview();
  }

  // Business Action
  ScorePotentialFraudCandidates() {
    this.ResetSignalReview();
    this.IsRadarLoaded();
    if (!this.RadarIsLoaded) {
      this.RejectMissingRadar();
      return;
    }
    this.IsScoreRuleValid();
    if (!this.ScoreRuleIsValid) {
      this.RejectInvalidScoreRule();
      return;
    }
    this.IsScoreRuleTheStartingRule();
    this.ApplyTierCutoffs();
    this.TotalSignalWeights();
    this.DecodeCandidateRows();
    this.MergeServiceYears();
    this.AreServiceYearsCollapseOnly();
    this.AreServiceYearsBlowups();
    this.IndexShareCollapses();
    this.AttachCrossStateDisplacement();
    this.AreNppesCountsInRadar();
    this.ReadNppesRule();
    this.ReadNppesCounts();
    this.MeasureSignalPoints();
    this.TotalSignalScores();
    this.SuggestReviewTiers();
    this.AssessCaseSignals();
    this.MeasureEnrollmentAndPaidChanges();
    this.CanEnrollmentExplainRises();
    this.IndexFirstBlowupYears();
    this.DateRiseEvents();
    this.MeasureYearlySeriesAgainstEnrollmentLine();
    this.RankServiceYears();
    this.SummarizeYears();
    this.IsMostAboveEnrollmentConvention();
    this.SummarizeStatesByYear();
    this.PublishSignalReview();
  }

  // PASSIVE: restore run state and outputs to INITIAL; staged inputs are kept.
  ResetSignalReview() {
    this.RadarIsLoaded = false;
    this.NppesCountsAreInRadar = false;
    this.RecentEnumerationWindowYears = 0;
    this.ExpectedTaxonomyPaidCoverage = 0;
    this.NppesSource = '';
    this.ScoreRuleIsValid = false;
    this.ScoreRuleProblems = [];
    this.ScoreRuleIsStartingRule = false;
    this.ActiveTierRule = [];
    this.SignalWeightsTotal = 0;
    this.CandidateRows = [];
    this.ServiceYearByKey = new Map();
    this.CollapsesByCodeYear = new Map();
    this.FirstBlowupYearByStateCode = {};
    this.ServiceYears = [];
    this.YearSummaries = {};
    this.StateYearSummaries = {};
    this.YearlySeriesByStateCode = {};
    this.Years = [];
    this.LatestYear = 0;
    this.DisplacementCount = 0;
    this.Errors = [];
  }

  // Question: is a radar export staged with candidate rows?
  IsRadarLoaded() {
    this.RadarIsLoaded = Boolean(this.Radar && Array.isArray(this.Radar.candidates) && Array.isArray(this.Radar.candidateColumns));
  }

  // PASSIVE: say why nothing was scored.
  RejectMissingRadar() {
    this.Errors.push('The national radar export is not loaded, so no candidate can be scored.');
  }

  // Question: is the staged score rule usable? Every SIGNAL_WEIGHTS signal, and no other, has a whole
  // number of points within SIGNAL_WEIGHT_RANGE; each cut-off is a whole number within TIER_CUTOFF_RANGE;
  // VERIFY is below HIGH. Writes ScoreRuleIsValid and the reasons in ScoreRuleProblems.
  IsScoreRuleValid() {
    const w = this.SignalWeights ?? {};
    const c = this.TierCutoffs ?? {};
    const inRange = (v, r) => Number.isInteger(v) && v >= r.min && v <= r.max;
    for (const k of Object.keys(SIGNAL_WEIGHTS)) {
      if (!inRange(w[k], SIGNAL_WEIGHT_RANGE)) this.ScoreRuleProblems.push(`${k} points must be a whole number from ${SIGNAL_WEIGHT_RANGE.min} to ${SIGNAL_WEIGHT_RANGE.max}`);
    }
    for (const k of Object.keys(w)) if (!(k in SIGNAL_WEIGHTS)) this.ScoreRuleProblems.push(`${k} is not a scored signal`);
    for (const k of TIER_CUTOFF_KEYS) {
      if (!inRange(c[k], TIER_CUTOFF_RANGE)) this.ScoreRuleProblems.push(`the ${k.toUpperCase()} cut-off must be a whole number from ${TIER_CUTOFF_RANGE.min} to ${TIER_CUTOFF_RANGE.max}`);
    }
    if (inRange(c.high, TIER_CUTOFF_RANGE) && inRange(c.verify, TIER_CUTOFF_RANGE) && c.verify >= c.high) this.ScoreRuleProblems.push('the VERIFY cut-off must be below the HIGH cut-off');
    this.ScoreRuleIsValid = this.ScoreRuleProblems.length === 0;
  }

  // PASSIVE: say why nothing was scored.
  RejectInvalidScoreRule() {
    this.Errors.push(`The score rule cannot be used: ${this.ScoreRuleProblems.join('; ')}.`);
  }

  // Question: is the staged score rule DecisionPro's starting rule? Writes ScoreRuleIsStartingRule.
  IsScoreRuleTheStartingRule() {
    this.ScoreRuleIsStartingRule = Object.keys(SIGNAL_WEIGHTS).every((k) => this.SignalWeights[k] === SIGNAL_WEIGHTS[k])
      && TIER_CUTOFF_KEYS.every((k) => this.TierCutoffs[k] === STARTING_TIER_CUTOFFS[k]);
  }

  // PASSIVE: TIER_RULE under the staged cut-offs: each tier's floor and its test in words.
  ApplyTierCutoffs() {
    this.ActiveTierRule = TIER_RULE.map((t) => Object.freeze({ ...t, minScore: TIER_CUTOFF_KEYS.includes(t.key) ? this.TierCutoffs[t.key] : 0, test: TIER_TESTS[t.key](this.TierCutoffs) }));
  }

  // PASSIVE: the staged points summed (a signal score is capped at 100 whatever the total).
  TotalSignalWeights() {
    this.SignalWeightsTotal = Object.keys(SIGNAL_WEIGHTS).reduce((a, k) => a + this.SignalWeights[k], 0);
  }

  // PASSIVE: the export's compact rows as named fields.
  DecodeCandidateRows() {
    this.CandidateRows = this.Radar.candidates.map((row) => Object.fromEntries(this.Radar.candidateColumns.map((c, i) => [c, row[i]])));
  }

  // PASSIVE: one service-year per state, code and year, carrying every pattern the owner found.
  MergeServiceYears() {
    const labels = { ...(this.Radar.codeLabels ?? {}), ...this.CodeLabels };
    for (const r of this.CandidateRows) {
      const key = `${r.state}|${r.hcpcs}|${r.year}`;
      if (this.ServiceYearByKey.has(key)) {
        this.ServiceYearByKey.get(key).patterns.push(r.pattern);
        continue;
      }
      this.ServiceYearByKey.set(key, {
        id: key,
        state: r.state,
        hcpcs: r.hcpcs,
        codeLabel: labels[r.hcpcs] ?? `HCPCS ${r.hcpcs}`,
        year: r.year,
        patterns: [r.pattern],
        collapseOnly: false,
        isBlowup: false,
        statePaid: r.statePaid,
        nationalPaid: r.nationalPaid,
        share: r.share,
        enrollmentShare: r.enrollmentShare,
        enrollmentLine: r.nationalPaid * r.enrollmentShare,
        excessMultiple: r.excessMultiple,
        priorYearShare: r.priorYearShare,
        priorYearPaid: r.priorYearPaid,
        twoYearsPriorPaid: r.twoYearsPriorPaid,
        peakShare: r.peakShare,
        peakShareYear: r.peakShareYear,
        statesBilling: r.statesBilling,
        billingNpis: r.billingNpis,
        newBillingNpis: r.newBillingNpis,
        newEntrantShare: r.billingNpis > 0 ? r.newBillingNpis / r.billingNpis : 0,
        top10Share: r.top10Share,
        reportingComplete: r.reportingComplete,
        knownCaseId: r.knownCaseId,
        aboveEnrollment: r.paidAboveEnrollmentLevel,
        abovePriorShare: r.paidAbovePriorShareLevel,
        displacementIsFound: false,
        displacement: NO_DISPLACEMENT,
        points: {},
        signalStrength: NO_SIGNAL_STRENGTH,
        score: 0,
        tier: NO_TIER,
        checks: [],
        checkCounts: { fired: 0, clear: 0, explain: 0, pending: 0 },
        publicCheckCount: 0,
        dataCheckCount: 0,
        health: {
          enrollmentChange1: 0, enrollmentChange1IsKnown: false,
          enrollmentChange2: 0, enrollmentChange2IsKnown: false,
          paidChange2: 0, paidChange2IsKnown: false,
          firstEnrollmentShare: 0, lastEnrollmentShare: 0, enrollmentSharesAreKnown: false,
          enrollmentShareIsFlat: false, enrollmentIsFlatOrDown: false, riseIsUnexplainedByEnrollment: false,
        },
        nppes: {
          newBillersEnumerationKnown: 0, newBillersRecentlyEnumerated: 0, recentlyEnumeratedPaid: 0, recentlyEnumeratedShare: 0,
          taxonomyKnownBillers: 0, taxonomyKnownPaid: 0, offTaxonomyBillers: 0, offTaxonomyPaid: 0, offTaxonomyPaidShare: 0,
          expectedTaxonomies: 0, countsAreKnown: false,
        },
        riseEvents: [],
      });
    }
    for (const s of this.ServiceYearByKey.values()) s.patterns.sort();
  }

  // Question: does each service-year meet only the collapse pattern? Writes collapseOnly on each.
  AreServiceYearsCollapseOnly() {
    for (const s of this.ServiceYearByKey.values()) s.collapseOnly = s.patterns.length === 1 && s.patterns[0] === 'share-collapse';
  }

  // Question: is each service-year a blow-up (the share surged, or paid tripled and kept growing)? Writes isBlowup.
  AreServiceYearsBlowups() {
    for (const s of this.ServiceYearByKey.values()) s.isBlowup = s.patterns.includes('share-surge') || s.patterns.includes('tripled-and-growing');
  }

  // PASSIVE: share collapses by code and year, for the displacement test.
  IndexShareCollapses() {
    for (const s of this.ServiceYearByKey.values()) {
      if (!s.patterns.includes('share-collapse')) continue;
      const k = `${s.hcpcs}|${s.year}`;
      if (!this.CollapsesByCodeYear.has(k)) this.CollapsesByCodeYear.set(k, []);
      this.CollapsesByCodeYear.get(k).push(s);
    }
  }

  // PASSIVE: another state's collapse on the same code in the same or the prior year, largest drop first.
  // Counted only when the other state lost at least DISPLACEMENT_MIN_DROP of national share from its
  // peak and this state's share rose at least DISPLACEMENT_MIN_RISE over its prior year.
  AttachCrossStateDisplacement() {
    for (const s of this.ServiceYearByKey.values()) {
      if (s.collapseOnly) continue;
      if (s.share - s.priorYearShare < DISPLACEMENT_MIN_RISE) continue;
      const others = [...(this.CollapsesByCodeYear.get(`${s.hcpcs}|${s.year}`) ?? []), ...(this.CollapsesByCodeYear.get(`${s.hcpcs}|${s.year - 1}`) ?? [])]
        .filter((c) => c.state !== s.state && c.peakShare - c.share >= DISPLACEMENT_MIN_DROP)
        .sort((a, b) => (b.peakShare - b.share) - (a.peakShare - a.share));
      if (others.length === 0) continue;
      s.displacementIsFound = true;
      s.displacement = { state: others[0].state, year: others[0].year, share: others[0].share, peakShare: others[0].peakShare, peakShareYear: others[0].peakShareYear, knownCaseId: others[0].knownCaseId };
      this.DisplacementCount += 1;
    }
  }

  // Question: does the radar export carry the spending owner's NPPES counts (the series columns, each code's
  // expected taxonomies, and the rule its load was made under: a whole-year window of at least 1, a coverage
  // above 0 and at most 1, and the NPPES copy it names)? Writes NppesCountsAreInRadar.
  AreNppesCountsInRadar() {
    const columns = this.Radar.seriesColumns ?? [];
    const rule = this.Radar.nppesRule ?? {};
    this.NppesCountsAreInRadar = NPPES_SERIES_COLUMNS.every((c) => columns.includes(c))
      && Boolean(this.Radar.expectedTaxonomiesByCode)
      && Number.isInteger(rule.recentEnumerationWindowYears) && rule.recentEnumerationWindowYears >= 1
      && rule.expectedTaxonomyPaidCoverage > 0 && rule.expectedTaxonomyPaidCoverage <= 1
      && typeof rule.source === 'string' && rule.source !== '';
  }

  // PASSIVE: the NPPES rule the radar's load was made under, as run state (RecentEnumerationWindowYears,
  // ExpectedTaxonomyPaidCoverage, NppesSource); left INITIAL when the radar carries no counts.
  ReadNppesRule() {
    if (!this.NppesCountsAreInRadar) return;
    this.RecentEnumerationWindowYears = this.Radar.nppesRule.recentEnumerationWindowYears;
    this.ExpectedTaxonomyPaidCoverage = this.Radar.nppesRule.expectedTaxonomyPaidCoverage;
    this.NppesSource = this.Radar.nppesRule.source;
  }

  // PASSIVE: each service-year's NPPES counts from its series row (the owner's figures): new billers with a
  // known enumeration date and those recently enumerated (in the year or the one before) with their paid, and
  // billers with a known taxonomy and those outside the code's expected taxonomies with their paid; each
  // share of its base. Counts not in the radar stay 0 with countsAreKnown false.
  ReadNppesCounts() {
    if (!this.NppesCountsAreInRadar) return;
    const at = Object.fromEntries(this.Radar.seriesColumns.map((c, i) => [c, i]));
    for (const s of this.ServiceYearByKey.values()) {
      const r = (this.Radar.series?.[`${s.state}|${s.hcpcs}`] ?? []).find((x) => x[at.year] === s.year);
      if (!r) continue;
      const n = s.nppes;
      n.newBillersEnumerationKnown = r[at.newBillingNpisEnumerationKnown];
      n.newBillersRecentlyEnumerated = r[at.newBillingNpisRecentlyEnumerated];
      n.recentlyEnumeratedPaid = r[at.newBillingRecentlyEnumeratedPaid];
      n.recentlyEnumeratedShare = n.newBillersEnumerationKnown > 0 ? n.newBillersRecentlyEnumerated / n.newBillersEnumerationKnown : 0;
      n.taxonomyKnownBillers = r[at.taxonomyKnownBillingNpis];
      n.taxonomyKnownPaid = r[at.taxonomyKnownPaid];
      n.offTaxonomyBillers = r[at.offTaxonomyBillingNpis];
      n.offTaxonomyPaid = r[at.offTaxonomyPaid];
      n.offTaxonomyPaidShare = n.taxonomyKnownPaid > 0 ? n.offTaxonomyPaid / n.taxonomyKnownPaid : 0;
      n.expectedTaxonomies = this.Radar.expectedTaxonomiesByCode[s.hcpcs] ?? 0;
      n.countsAreKnown = true;
    }
  }

  // PASSIVE: each signal's strength from the owner's figures (0 to 1, how much of its full measure the
  // service-year meets, whatever its points), and its points (the staged SignalWeights x the strength).
  // A collapse-only service-year earns no points.
  MeasureSignalPoints() {
    const t = SIGNAL_THRESHOLDS;
    for (const s of this.ServiceYearByKey.values()) {
      if (s.collapseOnly) {
        s.points = {};
        s.signalStrength = NO_SIGNAL_STRENGTH;
        continue;
      }
      s.signalStrength = {
        excessMultiple: s.excessMultiple > t.excessMultipleFloor
          ? clamp01(Math.log(s.excessMultiple / t.excessMultipleFloor) / Math.log(t.excessMultipleFull / t.excessMultipleFloor))
          : 0,
        shareSurge: s.patterns.includes('share-surge') ? 1 : 0,
        tripledAndGrowing: s.patterns.includes('tripled-and-growing') ? 1 : 0,
        persistentExcess: s.patterns.includes('persistent-excess') ? 1 : 0,
        newEntrants: s.year >= t.newEntrantFirstYear ? clamp01(s.newEntrantShare / t.newEntrantShareFull) : 0,
        concentration: s.billingNpis > t.concentrationMinimumBillers
          ? clamp01((s.top10Share - t.concentrationFloor) / (t.concentrationFull - t.concentrationFloor))
          : 0,
        displacement: s.displacementIsFound ? 1 : 0,
      };
      s.points = Object.fromEntries(Object.keys(SIGNAL_WEIGHTS).map((k) => [k, this.SignalWeights[k] * s.signalStrength[k]]));
    }
  }

  // PASSIVE: the signal score, 0 to 100.
  TotalSignalScores() {
    for (const s of this.ServiceYearByKey.values()) s.score = Math.round(Math.min(100, Object.values(s.points).reduce((a, b) => a + b, 0)));
  }

  // PASSIVE: the suggested tier by the active tier rule (TIER_RULE under the staged cut-offs), in its order of precedence.
  SuggestReviewTiers() {
    const tiers = Object.fromEntries(this.ActiveTierRule.map((t) => [t.key, t]));
    for (const s of this.ServiceYearByKey.values()) {
      let key = 'low';
      if (s.collapseOnly) key = s.knownCaseId ? 'closed' : 'lookback';
      else if (s.score >= tiers.high.minScore) key = 'high';
      else if (s.score >= tiers.verify.minScore) key = 'verify';
      else if (s.patterns.length === 1 && s.patterns[0] === 'persistent-excess') key = 'convention';
      s.tier = { key, label: tiers[key].label, shortLabel: tiers[key].shortLabel };
    }
  }

  // PASSIVE: the case-file checklist, each check with a short label; how many checks are of each CHECK_KINDS
  // kind; and how many are public-data checks (judged from the screen's figures, even when too early to
  // tell) and how many wait on a join or non-public data (PENDING_CASE_SIGNALS). The two NPPES checks are public
  // checks: pending, with the reason, when too early to tell, when the radar carries no NPPES counts or no row for
  // the year, or when the count they are drawn from is zero; never clear for want of data.
  AssessCaseSignals() {
    const t = SIGNAL_THRESHOLDS;
    const source = this.NppesSource;
    const window = this.RecentEnumerationWindowYears;
    const coverage = this.ExpectedTaxonomyPaidCoverage;
    const notInRadar = 'the NPPES counts are not in this export';
    for (const s of this.ServiceYearByKey.values()) {
      const n = s.nppes;
      const firstEnumerationYear = s.year - window + 1;
      const enumerationYears = window === 1 ? `${s.year}` : window === 2 ? `${firstEnumerationYear} or ${s.year}` : `${firstEnumerationYear} to ${s.year}`;
      // Paid is net of the publisher's adjustments, so the off-taxonomy share can fall outside 0 to 100%.
      const offTaxonomyIsNetted = n.offTaxonomyPaid < 0 || n.offTaxonomyPaid > n.taxonomyKnownPaid;
      const noRow = `the export has no ${s.year} row for this service`;
      s.checks = [
        { id: 'excess', shortLabel: 'Share far above enrollment', kind: s.excessMultiple >= t.excessMultipleFloor ? 'fired' : 'clear', label: 'Share of national payments far above enrollment share', detail: `${asPct(s.share)} vs ${asPct(s.enrollmentShare)} · ${s.excessMultiple.toFixed(1)}×` },
        { id: 'surge', shortLabel: 'Share surge', kind: s.patterns.includes('share-surge') ? 'fired' : 'clear', label: 'Share at least doubled on the prior year', detail: `${asPct(s.priorYearShare)} → ${asPct(s.share)}` },
        { id: 'tripled', shortLabel: 'Tripled and growing', kind: s.patterns.includes('tripled-and-growing') ? 'fired' : 'clear', label: 'Paid tripled over two years with no down year', detail: `${asMoney(s.twoYearsPriorPaid)} → ${asMoney(s.priorYearPaid)} → ${asMoney(s.statePaid)}` },
        { id: 'persistent', shortLabel: 'Persistent excess', kind: s.patterns.includes('persistent-excess') ? 'fired' : 'clear', label: 'Far above enrollment share three years running', detail: s.patterns.includes('persistent-excess') ? `${s.year - 2} to ${s.year}` : 'not three years running' },
        { id: 'collapse', shortLabel: 'Share collapse', kind: s.patterns.includes('share-collapse') ? 'fired' : 'clear', label: 'Share collapsed from an earlier peak', detail: s.patterns.includes('share-collapse') ? `${asPct(s.peakShare)} in ${s.peakShareYear} → ${asPct(s.share)}` : 'no collapse' },
        { id: 'new-billers', shortLabel: 'Many new billers', kind: s.year < t.newEntrantFirstYear ? 'pending' : (s.newEntrantShare >= t.newEntrantShareFired ? 'fired' : 'clear'), label: 'Many billers new to the code this year', detail: s.year < t.newEntrantFirstYear ? 'file starts 2018; too early to tell' : `${s.newBillingNpis} of ${s.billingNpis} billed it for the first time in ${s.year}` },
        {
          id: 'recently-enumerated', shortLabel: 'New billers enumerated',
          label: !this.NppesCountsAreInRadar ? 'New billers recently enumerated'
            : window === 1 ? 'New billers enumerated in the year' : `New billers enumerated in the year or the ${window === 2 ? 'year' : `${window - 1} years`} before`,
          kind: s.year < t.newEntrantFirstYear || !n.countsAreKnown || n.newBillersEnumerationKnown === 0 ? 'pending'
            : (n.recentlyEnumeratedShare >= t.recentlyEnumeratedShareFired ? 'fired' : 'clear'),
          detail: s.year < t.newEntrantFirstYear ? 'file starts 2018; too early to tell'
            : !this.NppesCountsAreInRadar ? notInRadar
              : !n.countsAreKnown ? noRow
                : n.newBillersEnumerationKnown === 0 ? `no new biller in ${s.year} has an NPPES enumeration date · ${source}`
                  : `${n.newBillersRecentlyEnumerated} of ${n.newBillersEnumerationKnown} new billers were enumerated in ${enumerationYears} (${asPct(n.recentlyEnumeratedShare)}, ${asMoney(n.recentlyEnumeratedPaid)} paid) · ${source}`,
        },
        {
          id: 'off-taxonomy', shortLabel: 'Taxonomy mismatch', label: 'Paid to billers outside the taxonomies the code expects nationally',
          kind: !n.countsAreKnown || n.taxonomyKnownPaid <= 0 ? 'pending' : (n.offTaxonomyPaidShare >= t.offTaxonomyPaidShareFired ? 'fired' : 'clear'),
          detail: !this.NppesCountsAreInRadar ? notInRadar
            : !n.countsAreKnown ? noRow
              : n.taxonomyKnownPaid <= 0 ? `no paid in ${s.year} from billers with an NPPES taxonomy · ${source}`
                : `${n.offTaxonomyBillers} of ${n.taxonomyKnownBillers} billers, ${asPct(n.offTaxonomyPaidShare)} of paid (${asMoney(n.offTaxonomyPaid)}${offTaxonomyIsNetted ? ', net of adjustments' : ''}), outside the ${n.expectedTaxonomies} taxonomies that bill ${Math.round(coverage * 100)}% of the code nationally · ${source}`,
        },
        { id: 'concentration', shortLabel: 'Top-10 concentration', kind: s.billingNpis <= t.concentrationMinimumBillers ? 'explain' : (s.top10Share >= t.concentrationFired ? 'fired' : 'clear'), label: 'Dollars concentrated in the ten largest billers', detail: s.billingNpis <= t.concentrationMinimumBillers ? `only ${s.billingNpis} billers: few providers may be the program's design` : `top 10 take ${asPct(s.top10Share)}` },
        { id: 'displacement', shortLabel: 'Displacement', kind: s.displacementIsFound ? 'fired' : 'clear', label: 'Rise as another state\'s share collapsed on the code', detail: s.displacementIsFound ? `${s.displacement.state} ${asPct(s.displacement.peakShare)} (${s.displacement.peakShareYear}) → ${asPct(s.displacement.share)} (${s.displacement.year})` : 'no collapse elsewhere in the year or the year before' },
        { id: 'states-billing', shortLabel: 'Billed widely', kind: s.statesBilling < t.comparableStatesBilling ? 'explain' : 'clear', label: 'Code billed widely enough to compare states', detail: `${s.statesBilling} states bill it${s.statesBilling < t.comparableStatesBilling ? ': a state billing convention may explain it' : ''}` },
        { id: 'reporting', shortLabel: 'Reporting complete', kind: s.reportingComplete ? 'clear' : 'explain', label: 'The state\'s reporting is complete for the year', detail: s.reportingComplete ? 'twelve full publisher months' : 'publisher months short (2024 is preliminary)' },
        ...PENDING_CASE_SIGNALS.map((p) => ({ id: p.id, shortLabel: p.shortLabel, kind: 'pending', label: p.label, detail: p.detail })),
      ];
      for (const k of CHECK_KINDS) s.checkCounts[k] = s.checks.filter((c) => c.kind === k).length;
      s.dataCheckCount = PENDING_CASE_SIGNALS.length;
      s.publicCheckCount = s.checks.length - s.dataCheckCount;
    }
  }

  // PASSIVE: enrollment change over one and two years, paid change over two years, and the
  // first and last enrollment shares across the service's screen years, each with whether it is known.
  MeasureEnrollmentAndPaidChanges() {
    for (const s of this.ServiceYearByKey.values()) {
      const enrollment = this.Radar.meanEnrollment?.[s.state] ?? [];
      const at = enrollment.find((e) => e[0] === s.year);
      const prior = enrollment.find((e) => e[0] === s.year - 1);
      const twoPrior = enrollment.find((e) => e[0] === s.year - 2);
      const series = this.Radar.series?.[`${s.state}|${s.hcpcs}`] ?? [];
      const paidTwoPrior = series.find((r) => r[0] === s.year - 2)?.[1] ?? 0;
      const shares = series.map((r) => this.Radar.enrollmentShare?.[`${s.state}|${r[0]}`]).filter((v) => Number.isFinite(v) && v > 0);
      const h = s.health;
      h.enrollmentChange1IsKnown = Boolean(at && prior && prior[1] > 0);
      h.enrollmentChange1 = h.enrollmentChange1IsKnown ? at[1] / prior[1] - 1 : 0;
      h.enrollmentChange2IsKnown = Boolean(at && twoPrior && twoPrior[1] > 0);
      h.enrollmentChange2 = h.enrollmentChange2IsKnown ? at[1] / twoPrior[1] - 1 : 0;
      h.paidChange2IsKnown = paidTwoPrior > 0;
      h.paidChange2 = h.paidChange2IsKnown ? s.statePaid / paidTwoPrior - 1 : 0;
      h.enrollmentSharesAreKnown = shares.length > 0;
      h.firstEnrollmentShare = h.enrollmentSharesAreKnown ? shares[0] : 0;
      h.lastEnrollmentShare = h.enrollmentSharesAreKnown ? shares[shares.length - 1] : 0;
    }
  }

  // Question: can enrollment explain each rise? Writes enrollmentShareIsFlat, enrollmentIsFlatOrDown
  // and riseIsUnexplainedByEnrollment by HEALTH_EXPLANATION_RULE; an unknown figure answers false.
  CanEnrollmentExplainRises() {
    const rule = HEALTH_EXPLANATION_RULE;
    for (const s of this.ServiceYearByKey.values()) {
      const h = s.health;
      h.enrollmentShareIsFlat = h.enrollmentSharesAreKnown && Math.abs(h.lastEnrollmentShare / h.firstEnrollmentShare - 1) < rule.flatShareTolerance;
      h.enrollmentIsFlatOrDown = h.enrollmentChange1IsKnown && h.enrollmentChange1 < rule.enrollmentFlatOrDownCeiling;
      h.riseIsUnexplainedByEnrollment = h.paidChange2IsKnown && h.enrollmentChange2IsKnown
        && h.paidChange2 > rule.paidGrowthFloor
        && h.paidChange2 > rule.enrollmentGrowthMultiple * Math.max(h.enrollmentChange2, rule.enrollmentGrowthFloor);
    }
  }

  // PASSIVE: the first year each state-code was a blow-up.
  IndexFirstBlowupYears() {
    for (const s of this.ServiceYearByKey.values()) {
      if (!s.isBlowup) continue;
      const k = `${s.state}|${s.hcpcs}`;
      if (!(k in this.FirstBlowupYearByStateCode) || s.year < this.FirstBlowupYearByStateCode[k]) this.FirstBlowupYearByStateCode[k] = s.year;
    }
  }

  // PASSIVE: dated events from the screen's own figures to test the rise against, with their fit
  // (start of rise; matches when the most billers arrived by the service-year, after when later;
  // known case; displacement). Policy events and reviewer-added events are added by the page.
  DateRiseEvents() {
    for (const s of this.ServiceYearByKey.values()) {
      const k = `${s.state}|${s.hcpcs}`;
      if (k in this.FirstBlowupYearByStateCode) {
        const first = this.ServiceYearByKey.get(`${k}|${this.FirstBlowupYearByStateCode[k]}`);
        s.riseEvents.push({ date: String(first.year), event: 'Screen first flags the rise', patterns: first.patterns, source: 'T-MSIS screen', fit: 'start of rise' });
      }
      const peakNew = (this.Radar.series?.[k] ?? [])
        .filter((r) => r[0] >= SIGNAL_THRESHOLDS.newBillerSeriesFirstYear && r[3] > 0)
        .sort((a, b) => b[3] - a[3])[0];
      if (peakNew) s.riseEvents.push({ date: String(peakNew[0]), event: `${peakNew[3]} providers bill the code for the first time, the most in any year`, source: 'T-MSIS', fit: peakNew[0] <= s.year ? 'matches' : 'after' });
      for (const c of (this.Radar.knownCases ?? []).filter((c) => c.state_code === s.state && c.hcpcs === s.hcpcs && c.expected === 'detected')) {
        s.riseEvents.push({ date: String(c.year), event: c.note, source: 'Known case list', fit: 'known case' });
      }
      if (s.displacementIsFound) s.riseEvents.push({ date: String(s.displacement.year), event: `${s.displacement.state}'s share collapses on the same code`, source: 'T-MSIS screen', fit: 'displacement' });
    }
  }

  // PASSIVE: each flagged state-code's yearly series against its enrollment line: paid, the national
  // total, the share of it, the top-10 billers' share, the enrollment line (national paid x the state's
  // enrollment share), paid as a multiple of the line, and whether the screen flagged the year, as a
  // blow-up, and whether paid ran far above the line (SIGNAL_THRESHOLDS.excessMultipleFloor). A flagged
  // year takes its line and multiple from the service-year (the owner's figures), so one figure has one
  // source. A line that cannot be measured (enrollment share unknown or no national total) stays 0 with
  // enrollmentLineIsKnown false.
  MeasureYearlySeriesAgainstEnrollmentLine() {
    const national = this.Radar.nationalByCode ?? {};
    for (const s of this.ServiceYearByKey.values()) {
      const k = `${s.state}|${s.hcpcs}`;
      if (k in this.YearlySeriesByStateCode) continue;
      this.YearlySeriesByStateCode[k] = (this.Radar.series?.[k] ?? []).map(([year, statePaid, billingNpis, newBillingNpis, top10Paid]) => {
        const flagged = this.ServiceYearByKey.get(`${k}|${year}`);
        const nationalPaid = national[s.hcpcs]?.[year] ?? 0;
        const exportedShare = this.Radar.enrollmentShare?.[`${s.state}|${year}`] ?? 0;
        const enrollmentShareIsKnown = Number.isFinite(exportedShare) && exportedShare > 0;
        const enrollmentLineIsKnown = flagged !== undefined ? flagged.enrollmentLine > 0 : enrollmentShareIsKnown && nationalPaid > 0;
        const enrollmentLine = flagged !== undefined ? flagged.enrollmentLine : (enrollmentLineIsKnown ? nationalPaid * exportedShare : 0);
        const timesEnrollmentLine = flagged !== undefined ? flagged.excessMultiple : (enrollmentLineIsKnown ? statePaid / enrollmentLine : 0);
        return {
          year,
          statePaid,
          billingNpis,
          newBillingNpis,
          top10Paid,
          top10Share: statePaid > 0 ? top10Paid / statePaid : 0,
          nationalPaid,
          share: nationalPaid > 0 ? statePaid / nationalPaid : 0,
          enrollmentShare: enrollmentShareIsKnown ? exportedShare : 0,
          enrollmentShareIsKnown,
          enrollmentLine,
          enrollmentLineIsKnown,
          timesEnrollmentLine,
          isFarAboveEnrollmentLine: enrollmentLineIsKnown && timesEnrollmentLine >= SIGNAL_THRESHOLDS.excessMultipleFloor,
          isFlagged: flagged !== undefined,
          isBlowup: flagged !== undefined && flagged.isBlowup,
          serviceYearId: flagged !== undefined ? flagged.id : '',
        };
      });
    }
  }

  // PASSIVE: highest score first, then the most dollars above the enrollment line.
  RankServiceYears() {
    this.ServiceYears = [...this.ServiceYearByKey.values()].sort((a, b) => (b.score - a.score) || (b.aboveEnrollment - a.aboveEnrollment));
    this.Years = [...new Set(this.ServiceYears.map((s) => s.year))].sort((a, b) => a - b);
    this.LatestYear = this.Years.length ? this.Years[this.Years.length - 1] : 0;
  }

  // PASSIVE: national figures per year, with each suggested tier's services and dollars above the
  // enrollment line, the services meeting each SCREEN_PATTERNS pattern, the services whose reporting is
  // incomplete for the year, and the worth-review total (the WORTH_REVIEW_TIER_KEYS tiers).
  SummarizeYears() {
    for (const year of this.Years) {
      const rows = this.ServiceYears.filter((s) => s.year === year);
      const tiers = Object.fromEntries(TIER_RULE.map((t) => [t.key, { services: 0, aboveEnrollment: 0 }]));
      const patternServices = zeroPatternServices();
      for (const s of rows) {
        tiers[s.tier.key].services += 1;
        tiers[s.tier.key].aboveEnrollment += s.aboveEnrollment;
        for (const p of SCREEN_PATTERNS) if (s.patterns.includes(p)) patternServices[p] += 1;
      }
      this.YearSummaries[year] = {
        year,
        services: rows.length,
        states: new Set(rows.map((s) => s.state)).size,
        statePaid: rows.reduce((a, s) => a + s.statePaid, 0),
        aboveEnrollment: rows.reduce((a, s) => a + s.aboveEnrollment, 0),
        abovePriorShare: rows.reduce((a, s) => a + s.abovePriorShare, 0),
        blowups: rows.filter((s) => s.isBlowup).length,
        incompleteReportingServices: rows.filter((s) => !s.reportingComplete).length,
        tiers,
        patternServices,
        worthReviewServices: WORTH_REVIEW_TIER_KEYS.reduce((a, k) => a + tiers[k].services, 0),
        worthReviewAboveEnrollment: WORTH_REVIEW_TIER_KEYS.reduce((a, k) => a + tiers[k].aboveEnrollment, 0),
        mostAboveEnrollmentIsConvention: false,
        nationalPaidInFile: this.Radar.nationalPaidByYear?.[year] ?? 0,
      };
    }
  }

  // Question: are most of each year's dollars above the enrollment line in the CONVENTION? tier?
  // Writes mostAboveEnrollmentIsConvention on each year summary.
  IsMostAboveEnrollmentConvention() {
    for (const y of Object.values(this.YearSummaries)) y.mostAboveEnrollmentIsConvention = y.tiers.convention.aboveEnrollment > y.aboveEnrollment / 2;
  }

  // PASSIVE: figures per state and year, with each suggested tier's services and dollars above the line, the services
  // meeting each SCREEN_PATTERNS pattern, the worth-review services
  // and dollars above the enrollment line, and the leading service-year (the rows are already ranked).
  SummarizeStatesByYear() {
    for (const s of this.ServiceYears) {
      const k = `${s.state}|${s.year}`;
      if (!(k in this.StateYearSummaries)) {
        this.StateYearSummaries[k] = {
          state: s.state,
          year: s.year,
          services: 0,
          statePaid: 0,
          aboveEnrollment: 0,
          abovePriorShare: 0,
          blowups: 0,
          tiers: Object.fromEntries(TIER_RULE.map((t) => [t.key, { services: 0, aboveEnrollment: 0 }])),
          patternServices: zeroPatternServices(),
          worthReviewServices: 0,
          worthReviewAboveEnrollment: 0,
          leadingId: s.id,
        };
      }
      const summary = this.StateYearSummaries[k];
      summary.services += 1;
      summary.statePaid += s.statePaid;
      summary.aboveEnrollment += s.aboveEnrollment;
      summary.abovePriorShare += s.abovePriorShare;
      summary.tiers[s.tier.key].services += 1;
      summary.tiers[s.tier.key].aboveEnrollment += s.aboveEnrollment;
      for (const p of SCREEN_PATTERNS) if (s.patterns.includes(p)) summary.patternServices[p] += 1;
      if (s.isBlowup) summary.blowups += 1;
      if (WORTH_REVIEW_TIER_KEYS.includes(s.tier.key)) {
        summary.worthReviewServices += 1;
        summary.worthReviewAboveEnrollment += s.aboveEnrollment;
      }
    }
  }

  // PASSIVE: freeze the published rows.
  PublishSignalReview() {
    this.ServiceYears = this.ServiceYears.map((s) => Object.freeze(s));
  }
}
