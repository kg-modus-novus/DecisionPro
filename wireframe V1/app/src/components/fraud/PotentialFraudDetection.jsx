import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { PotentialFraudSignalReview, SCREEN_PATTERNS, SMALL_CELL_MINIMUM } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { PATTERN_LABELS, SERVICE_LABELS, STATE_NAMES, DETECTION_ANALYSES } from '../../data/potentialFraudCatalog.js';
import { POLICY_EVENTS } from '../../data/alp/policyEvents.js';
import { money, pct, multiple, count, downloadText, TIER_CLASS } from './fraudFormat.jsx';
import { Sparkline, ShareBar, SIGNAL_SHORT_LABELS, signalShade, TIER_COLORS, TIER_DISPLAY_ORDER, tierShortLabel } from './fraudVisuals.jsx';
import { ProgramBlowupPage } from './ProgramBlowupPage.jsx';
import { CaseFilePage } from './CaseFilePage.jsx';
import { ReallocationPage } from './ReallocationPage.jsx';
import { ToolsCoveragePage } from './ToolsCoveragePage.jsx';
import { BacktestPage } from './BacktestPage.jsx';
import { RadarMoneyBar, RadarStateMap } from './RadarOverview.jsx';
import { ScoreRulePanel, STARTING_SCORE_RULE } from './ScoreRulePanel.jsx';
import { ExplanationTag, explanationTagText } from './PolicyLedger.jsx';
import { OversightReview } from '../../lib/fraud/oversightProgram.js';
import { EarlyWarningPage } from './EarlyWarningPage.jsx';
import { FollowBillersPage } from './FollowBillersPage.jsx';
import { ProviderPatternsPage } from './ProviderPatternsPage.jsx';
import { ExplanationLedgerPage } from './ExplanationLedgerPage.jsx';
import { StateBriefPage } from './StateBriefPage.jsx';
import { readFraudLink, replaceAddress, writeFraudLink } from '../../lib/workspaceLinks.js';
import { workspaceGuideFor } from '../../lib/simpleMode/explainers.js';
import { buildDomWalkthrough } from '../../lib/domWalkthrough.js';
import { PageGuidePrompt } from '../PageGuidePrompt.jsx';
import { CalloutWalkthrough } from '../CalloutWalkthrough.jsx';

/**
 * Potential Fraud Detection: a dedicated module that ranks potential Medicaid
 * fraud candidates across every state and service from public data (HHS T-MSIS
 * provider spending, CMS enrollment, NPPES attribution), opens a case file per
 * candidate, shows when a program blew up, models where flagged dollars could go,
 * and lists every analysis with the data it needs.
 *
 * The radar export (about 2 MB) loads on demand when the module opens; the
 * oversight export (monthly series, biller groups and profiles, about 3 MB) loads
 * beside it and feeds the five oversight pages.
 */

export const FRAUD_PAGES = [
  { id: 'radar', label: 'National radar' },
  { id: 'blowups', label: 'Program blow-ups' },
  { id: 'cases', label: 'Case files' },
  { id: 'realloc', label: 'Reallocation what-if' },
  { id: 'tools', label: 'Tools & data coverage' },
  { id: 'backtest', label: 'Backtests & known cases' },
  { id: 'early', label: 'Early warning', isNew: true },
  { id: 'follow', label: 'Follow the billers', isNew: true },
  { id: 'patterns', label: 'Provider patterns', isNew: true },
  { id: 'ledger', label: 'Explanation ledger', isNew: true },
  { id: 'brief', label: 'State oversight brief', isNew: true },
];
const OVERSIGHT_PAGE_IDS = new Set(FRAUD_PAGES.filter((p) => p.isNew).map((p) => p.id));

/** Runs the five oversight Business Actions over the scored review and the oversight export. */
function reviewOversight(radar, review, oversightExport) {
  const o = new OversightReview();
  o.Oversight = oversightExport;
  o.Radar = radar;
  o.Review = review;
  o.CodeLabels = SERVICE_LABELS;
  o.StateNames = STATE_NAMES;
  o.ReviewEarlyWarning();
  o.ReviewBillerGroups();
  o.RankBillerProfiles();
  o.SummarizeExplanationLedgers();
  o.NameStateBriefReadings();
  return o;
}

/**
 * `entrySearch` is the address a direct link opened the workspace with (see lib/workspaceLinks.js): the module
 * starts on the page, state and service-year it names. The module keeps the address in step with what is on
 * screen, so any page can be copied and shared.
 */
export function PotentialFraudDetection({ stateCode = 'KY', entrySearch = '' }) {
  const [entry] = useState(() => readFraudLink(entrySearch, FRAUD_PAGES.map((p) => p.id)));
  const [radar, setRadar] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(entry.page ?? 'radar');
  const [guideSteps, setGuideSteps] = useState(null);
  const [focusId, setFocusId] = useState(entry.focusId);
  const [focusState, setFocusState] = useState(() => {
    if (entry.state && STATE_NAMES[entry.state]) return entry.state;
    return stateCode && STATE_NAMES[stateCode] ? stateCode : 'KY';
  });
  useEffect(() => {
    replaceAddress(writeFraudLink(new URL(window.location.href), { page, state: focusState, focusId }));
  }, [page, focusState, focusId]);
  // Reviewer entries for this browser session only (not saved anywhere).
  const [reviews, setReviews] = useState({});
  const [addedEvents, setAddedEvents] = useState({});
  // The reviewer's score rule for this browser session (weights and tier cut-offs; not saved anywhere).
  const [scoreRule, setScoreRule] = useState(STARTING_SCORE_RULE);
  const stagedRule = useDeferredValue(scoreRule);
  const [lastAppliedReview, setLastAppliedReview] = useState(null);

  useEffect(() => {
    let live = true;
    import('../../data/alp/potentialFraudRadar.js')
      .then((m) => { if (live) setRadar(m.POTENTIAL_FRAUD_RADAR); })
      .catch((e) => { if (live) setLoadError(String(e?.message ?? e)); });
    return () => { live = false; };
  }, []);
  const [oversightExport, setOversightExport] = useState(null);
  const [oversightError, setOversightError] = useState('');
  useEffect(() => {
    let live = true;
    import('../../data/alp/oversightAggregates.js')
      .then((m) => { if (live) setOversightExport(m.OVERSIGHT_AGGREGATES); })
      .catch((e) => { if (live) setOversightError(String(e?.message ?? e)); });
    return () => { live = false; };
  }, []);

  const startingReview = useMemo(() => (radar ? scoreRadar(radar, STARTING_SCORE_RULE) : null), [radar]);
  const trialReview = useMemo(() => (radar && stagedRule !== STARTING_SCORE_RULE ? scoreRadar(radar, stagedRule) : startingReview), [radar, stagedRule, startingReview]);
  // The program rejects a rule it cannot use; the module keeps the last review it scored.
  useEffect(() => { if (trialReview?.ScoreRuleIsValid) setLastAppliedReview(trialReview); }, [trialReview]);
  const review = trialReview && !trialReview.ScoreRuleIsValid && lastAppliedReview ? lastAppliedReview : trialReview;
  const scoreRuleProblems = trialReview && trialReview.RadarIsLoaded && !trialReview.ScoreRuleIsValid ? trialReview.ScoreRuleProblems : [];

  const byId = useMemo(() => new Map((review?.ServiceYears ?? []).map((s) => [s.id, s])), [review]);
  // The oversight pages read the review the module shows, so a session score rule reaches them too.
  const oversight = useMemo(() => (radar && review && !review.Errors.length && oversightExport ? reviewOversight(radar, review, oversightExport) : null), [radar, review, oversightExport]);

  function openCase(id) {
    const s = byId.get(id);
    if (s) setFocusState(s.state);
    setFocusId(id);
    setPage('cases');
    window.scrollTo?.(0, 0);
  }
  function openBlowup(id) {
    const s = byId.get(id);
    if (s) setFocusState(s.state);
    setFocusId(id);
    setPage('blowups');
  }
  function openState(state, nextPage) {
    setFocusState(state);
    setFocusId(null);
    setPage(nextPage);
  }

  if (loadError) return <section className="pfd"><p className="pfd-error">The national radar export did not load: {loadError}</p></section>;
  if (!review) return <section className="pfd"><p className="pfd-loading">Loading the national radar (every state, every service, 2019–2024)…</p></section>;
  if (review.Errors.length) return <section className="pfd"><p className="pfd-error">{review.Errors.join(' ')}</p></section>;

  const latest = review.LatestYear;
  const latestRows = review.ServiceYears.filter((s) => s.year === latest);
  const badges = {
    radar: count(latestRows.length),
    blowups: count(latestRows.filter((s) => s.isBlowup).length),
    cases: count(latestRows.filter((s) => s.state === focusState).length),
    tools: String(DETECTION_ANALYSES.length),
    backtest: `${radar.backtest.filter((b) => b.ok).length}/${radar.backtest.length}`,
  };
  const shared = { radar, review, startingReview, byId, focusState, setFocusState, focusId, setFocusId, openCase, openBlowup, openState, reviews, setReviews, addedEvents, setAddedEvents, setPage, scoreRule, setScoreRule, scoreRuleProblems, oversight };
  const oversightProblem = oversightError ? `The oversight export did not load: ${oversightError}` : oversight?.OversightProblem ? `The oversight export cannot be read: ${oversight.OversightProblem}.` : '';

  return (
    <section className="pfd" data-walkthrough-target="potential-fraud-detection">
      <aside className="pfd-side" aria-label="Potential Fraud Detection pages">
        <h4>POTENTIAL FRAUD DETECTION</h4>
        {FRAUD_PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pfd-side-item${page === p.id ? ' is-on' : ''}`}
            onClick={() => setPage(p.id)}
            data-fraud-page={p.id}
          >
            <span>{p.id === 'cases' ? `Case files · ${STATE_NAMES[focusState] ?? focusState}` : p.label}</span>
            {p.isNew ? <b className="pfd-side-new">NEW</b> : badges[p.id] ? <b>{badges[p.id]}</b> : null}
          </button>
        ))}
        <h4 className="pfd-side-gap">DATA AS OF</h4>
        <p className="pfd-side-note">
          T-MSIS v{radar.asOf}<br />
          Enrollment to {(radar.coverage.find((c) => c.dataRequestId === 'DR-REAL-PI-ENROLLMENT-ALL-STATES')?.asOf ?? '').slice(0, 7)}<br />
          Screen run {String(radar.screenRun.completedAt).slice(0, 10)}<br />
          LEIE {(radar.exclusionSummary[0]?.asOf ?? 'not loaded')}
        </p>
        {review.ScoreRuleIsStartingRule ? null : <p className="pfd-side-note pfd-side-adjusted" data-score-rule-adjusted>Score rule adjusted for this session: tiers on every page follow it.</p>}
        <p className="pfd-side-note pfd-side-small">Public data only. No person-level data and no provider is named. A candidate is potential fraud to review, not a finding.</p>
      </aside>
      <div className="pfd-main">
        <div className="pfd-guide-row">
          <PageGuidePrompt
            guide={workspaceGuideFor(`fraud:${page}`, `Potential Fraud Detection: ${FRAUD_PAGES.find((p) => p.id === page)?.label ?? page}`)}
            onWalkthrough={() => {
              const built = buildDomWalkthrough(document.querySelector('.pfd-main'), '.pfd-main h1, .pfd-card', { prefix: `fraud-${page}-step`, textSelector: ':scope > p, .pfd-sub, .pfo-lead' });
              if (built.length) setGuideSteps(built);
            }}
          />
        </div>
        <CalloutWalkthrough open={Boolean(guideSteps)} steps={guideSteps || []} onClose={() => setGuideSteps(null)} onSkipAll={() => setGuideSteps(null)} onComplete={() => setGuideSteps(null)} />
        {page === 'radar' && <RadarPage {...shared} />}
        {page === 'blowups' && <ProgramBlowupPage {...shared} />}
        {page === 'cases' && <CaseFilePage {...shared} />}
        {page === 'realloc' && <ReallocationPage {...shared} />}
        {page === 'tools' && <ToolsCoveragePage {...shared} />}
        {page === 'backtest' && <BacktestPage {...shared} />}
        {OVERSIGHT_PAGE_IDS.has(page) && oversightProblem ? <p className="pfd-error" data-oversight-problem>{oversightProblem}</p> : null}
        {OVERSIGHT_PAGE_IDS.has(page) && !oversightProblem && !oversight?.OversightIsLoaded ? <p className="pfd-loading">Loading the oversight export (monthly payments, biller groups and profiles)…</p> : null}
        {oversight?.OversightIsLoaded && !oversightProblem ? (
          <>
            {page === 'early' && <EarlyWarningPage {...shared} />}
            {page === 'follow' && <FollowBillersPage {...shared} />}
            {page === 'patterns' && <ProviderPatternsPage {...shared} />}
            {page === 'ledger' && <ExplanationLedgerPage {...shared} />}
            {page === 'brief' && <StateBriefPage {...shared} />}
          </>
        ) : null}
      </div>
    </section>
  );
}

const SORTS = {
  score: { label: 'signal score', fn: (a, b) => (b.score - a.score) || (b.aboveEnrollment - a.aboveEnrollment) },
  paid: { label: 'paid', fn: (a, b) => b.statePaid - a.statePaid },
  share: { label: 'share of US', fn: (a, b) => b.share - a.share },
  multiple: { label: 'multiple of enrollment share', fn: (a, b) => b.excessMultiple - a.excessMultiple },
};

/** Above-line slider stops (dollars above the enrollment line). */
const MIN_ABOVE = [0, 1e6, 5e6, 10e6, 25e6, 50e6, 100e6];
/** The share of US paid that fills a row's share bar. */
const SHARE_BAR_FULL = 0.8;
const SIGNAL_KEYS = Object.keys(SIGNAL_SHORT_LABELS);
const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Scores the radar under a score rule (the program checks the rule). */
function scoreRadar(radar, rule) {
  const p = new PotentialFraudSignalReview();
  p.Radar = radar;
  p.CodeLabels = SERVICE_LABELS;
  // The dated public policy events the warehouse loaded; the program matches them to each rise.
  p.PolicyEventsExport = POLICY_EVENTS;
  p.SignalWeights = { ...rule.weights };
  p.TierCutoffs = { ...rule.cutoffs };
  p.ScorePotentialFraudCandidates();
  return p;
}

function RadarPage({ radar, review, startingReview, focusState, setFocusState, openCase, openState, scoreRule, setScoreRule, scoreRuleProblems }) {
  const [year, setYear] = useState(review.LatestYear);
  const [stateFilter, setStateFilter] = useState('');
  const [patterns, setPatterns] = useState([]);
  const [tier, setTier] = useState('');
  const [completeOnly, setCompleteOnly] = useState(false);
  const [unexplainedOnly, setUnexplainedOnly] = useState(false);
  const [minAboveStop, setMinAboveStop] = useState(0);
  const [sort, setSort] = useState('score');
  const [shown, setShown] = useState(25);
  const [showMethod, setShowMethod] = useState(false);
  const minAbove = MIN_ABOVE[minAboveStop];
  const activeTiers = Object.fromEntries(review.ActiveTierRule.map((t) => [t.key, t]));

  const yearRows = useMemo(() => review.ServiceYears.filter((s) => s.year === year), [review, year]);
  // The rows every other filter leaves; "Unexplained only" then hides those the program says have an innocent explanation on file.
  const otherwiseMatching = useMemo(() => yearRows
    .filter((s) => !stateFilter || s.state === stateFilter)
    .filter((s) => patterns.every((p) => s.patterns.includes(p)))
    .filter((s) => !tier || s.tier.key === tier)
    .filter((s) => !completeOnly || s.reportingComplete)
    .filter((s) => s.aboveEnrollment >= minAbove), [yearRows, stateFilter, patterns, tier, completeOnly, minAbove]);
  const withExplanationOnFile = useMemo(() => otherwiseMatching.filter((s) => s.innocentExplanationIsOnFile).length, [otherwiseMatching]);
  const rows = useMemo(() => otherwiseMatching
    .filter((s) => !unexplainedOnly || !s.innocentExplanationIsOnFile)
    .sort(SORTS[sort].fn), [otherwiseMatching, unexplainedOnly, sort]);
  const searchCoverage = Object.values(review.PolicySearchCoverageByState);
  const lookbackYears = review.PolicyEventLookbackMonths / 12;

  const ys = review.YearSummaries[year];
  const panelState = stateFilter || focusState;
  // Pill counts: the selected state's summary when the list is filtered to a state, else the year's.
  const counts = stateFilter ? review.StateYearSummaries[`${stateFilter}|${year}`] : ys;
  const tierCount = (k) => (counts ? counts.tiers[k].services : 0);
  const patternCount = (p) => (counts ? counts.patternServices[p] : 0);
  const restart = () => setShown(25);

  function exportCsv() {
    // A figure describing fewer billers than the minimum is left out of the export as on the page ("withheld", "<11").
    const fewer = `<${SMALL_CELL_MINIMUM}`;
    const head = ['rank', 'state', 'hcpcs', 'service', 'year', 'patterns', 'paid', 'share_of_us', 'enrollment_share', 'multiple', 'above_enrollment_line', 'above_prior_year_line', 'billers', 'new_billers', 'states_billing', 'reporting_complete', 'score', 'suggested_tier', 'law_and_policy', 'policy_events_listed'];
    const lines = rows.map((s, i) => {
      const w = s.statePaidIsWithheld;
      return [i + 1, s.state, s.hcpcs, `"${s.codeLabel.replace(/"/g, "'")}"`, s.year, s.patterns.join('+'),
        ...(w ? ['withheld', 'withheld', s.enrollmentShare, 'withheld', 'withheld', 'withheld'] : [s.statePaid, s.share, s.enrollmentShare, s.excessMultiple, s.aboveEnrollment, s.abovePriorShare]),
        s.billersAreWithheld ? fewer : s.billingNpis,
        s.newBillersAreWithheld ? fewer : s.newBillingNpis, s.statesBilling, s.reportingComplete, s.score, s.tier.label, `"${explanationTagText(s)}"`, s.policyEvents.length + s.suggestedPolicyEvents.length + s.laterPolicyEvents.length].join(',');
    });
    downloadText(`potential-fraud-radar-${year}${stateFilter ? `-${stateFilter}` : ''}.csv`, [head.join(','), ...lines].join('\n'), 'text/csv');
  }

  const sortHead = (k, label, className = '') => (
    <th className={className} aria-sort={sort === k ? 'descending' : 'none'}>
      <button type="button" className={`pfd-th-sort${sort === k ? ' is-on' : ''}`} onClick={() => { setSort(k); restart(); }} data-sort={k} title={`Sort by ${SORTS[k].label}`}>
        {label}{sort === k ? ' ▾' : ''}
      </button>
    </th>
  );

  return (
    <div className="pfd-page">
      <h1>Potential fraud radar · every state, every service, {review.Years[0]}–{review.LatestYear}</h1>
      <p className="pfd-sub">
        Where does a state&apos;s share of national Medicaid spending on a service run far ahead of its share of national enrollment, and when did a
        program blow up in a way health needs cannot explain? Public data only (HHS T-MSIS provider spending, CMS enrollment, NPPES).
        Ranked by signal score; every row opens a case file.
      </p>
      <RadarMoneyBar ys={ys} year={year} />
      <ScoreRulePanel review={review} startingReview={startingReview} year={year} scoreRule={scoreRule} setScoreRule={setScoreRule} problems={scoreRuleProblems} />
      <RadarStateMap
        radar={radar}
        review={review}
        year={year}
        selected={panelState}
        isFiltered={Boolean(stateFilter)}
        onSelect={(st) => {
          if (st === stateFilter) setStateFilter('');
          else { setStateFilter(st); setFocusState(st); }
          restart();
        }}
        onClear={() => { setStateFilter(''); restart(); }}
        openCase={openCase}
        openState={openState}
      />
      <div className="pfd-card pfd-radar-list">
        <div className="pfd-filterrows" role="group" aria-label="Radar filters">
          <div className="pfd-pillrow">
            <span className="pfd-pill-label">Year</span>
            {review.Years.map((y) => (
              <button key={y} type="button" className={`pfd-pill${year === y ? ' is-on' : ''}`} aria-pressed={year === y} data-year={y} onClick={() => { setYear(y); restart(); }}>{y}</button>
            ))}
          </div>
          <div className="pfd-pillrow">
            <span className="pfd-pill-label">Tier</span>
            {TIER_DISPLAY_ORDER.map((k) => (
              <button key={k} type="button" className={`pfd-pill${tier === k ? ' is-on' : ''}`} aria-pressed={tier === k} data-tier={k} title={activeTiers[k].test} onClick={() => { setTier(tier === k ? '' : k); restart(); }}>
                <i className="pfd-pill-sw" style={{ background: TIER_COLORS[k] }} />{tierShortLabel(activeTiers[k])}<b>{count(tierCount(k))}</b>
              </button>
            ))}
          </div>
          <div className="pfd-pillrow">
            <span className="pfd-pill-label">Pattern</span>
            {SCREEN_PATTERNS.map((p) => {
              const on = patterns.includes(p);
              return (
                <button key={p} type="button" className={`pfd-pill${on ? ' is-on' : ''}`} aria-pressed={on} data-pattern={p} onClick={() => { setPatterns(on ? patterns.filter((x) => x !== p) : [...patterns, p]); restart(); }}>
                  {capitalize(PATTERN_LABELS[p])}<b>{count(patternCount(p))}</b>
                </button>
              );
            })}
            <span className="pfd-note">a row must meet every pattern picked</span>
          </div>
          <div className="pfd-pillrow">
            <span className="pfd-pill-label">Above line</span>
            <input type="range" className="pfd-range" min="0" max={MIN_ABOVE.length - 1} step="1" value={minAboveStop} aria-label="Minimum dollars above the enrollment line" data-above-slider onChange={(e) => { setMinAboveStop(Number(e.target.value)); restart(); }} />
            <span className="pfd-range-v">{minAbove ? `≥ ${money(minAbove, 0)}` : 'any'}</span>
            <label className="pfd-checkbox"><input type="checkbox" checked={completeOnly} onChange={(e) => { setCompleteOnly(e.target.checked); restart(); }} /> Complete reporting only</label>
            <label className="pfd-checkbox" title="Hides rows rated EXPLAINED and rows tagged &quot;may explain&quot;. A relaxed safeguard is not an innocent explanation, so those rows stay."><input type="checkbox" data-unexplained-only checked={unexplainedOnly} onChange={(e) => { setUnexplainedOnly(e.target.checked); restart(); }} /> Unexplained only <b data-innocent-count>({count(withExplanationOnFile)} with an explanation on file)</b></label>
            <button type="button" className="pfd-btn pfd-btn-ghost pfd-push" onClick={exportCsv}>Export ranked list ↓</button>
          </div>
        </div>
        <p className="pfd-note pfd-tight">
          Screen filters always on: code billed in 10+ states · state paid at least $1M in the year. <b data-row-count>{count(rows.length)}</b> rows match
          {stateFilter ? ` in ${STATE_NAMES[stateFilter]} (click it on the map again to clear)` : ''}.
          {' '}{count(ys.incompleteReportingServices)} of {year}&apos;s {count(ys.services)} rows have preliminary reporting (publisher months short).
          Signals, left to right: {SIGNAL_KEYS.map((k) => SIGNAL_SHORT_LABELS[k]).join(' · ')}; darker earns more of its weight. Click a column heading to sort.
          {' '}The tag under the signals says what law and policy on file says about the row: laws, agency letters, waivers and enforcement were searched for {count(searchCoverage.length)} states so far
          {searchCoverage.length && searchCoverage.every((c) => c.fullSearches === 0) ? ', each in part' : ''}.
        </p>
        {review.PolicyEventsProblem ? <p className="pfd-error" data-policy-problem>The policy events could not be read, so every row reads &quot;not searched&quot;: {review.PolicyEventsProblem}.</p> : null}
        <div className="pfd-table-wrap">
          <table className="pfd-table pfd-table-rows">
            <colgroup>
              <col style={{ width: 34 }} /><col style={{ width: 38 }} /><col /><col style={{ width: 92 }} /><col style={{ width: 84 }} />
              <col style={{ width: 118 }} /><col style={{ width: 52 }} /><col style={{ width: 186 }} /><col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr>
                <th>#</th><th>St</th><th>Service</th><th>Paid by year</th>
                {sortHead('paid', `Paid ${year}`, 'r')}
                {sortHead('share', 'Share vs enrolled')}
                {sortHead('multiple', '×', 'r')}
                <th>Signals</th>
                {sortHead('score', 'Score · tier')}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((s, i) => (
                <tr key={s.id} className="pfd-click" onClick={() => openCase(s.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openCase(s.id); }}>
                  <td>{i + 1}</td>
                  <td><b>{s.state}</b></td>
                  <td title={`${s.codeLabel} (${s.hcpcs}) · billed in ${s.statesBilling} states · ${s.reportingComplete ? 'complete reporting' : 'preliminary reporting (publisher months short)'}`}>{s.codeLabel} <span className="pfd-code">{s.hcpcs}</span></td>
                  <td>
                    <Sparkline
                      points={review.YearlySeriesByStateCode[`${s.state}|${s.hcpcs}`].filter((r) => !r.paidIsWithheld).map((r) => ({ year: r.year, value: r.statePaid }))}
                      markYear={s.year}
                      label={`${s.state} ${s.hcpcs} paid by year, ${s.year} marked`}
                    />
                  </td>
                  <td className="r" title={s.statePaidIsWithheld ? `paid to fewer than ${SMALL_CELL_MINIMUM} billers` : undefined}>{s.statePaidIsWithheld ? 'withheld' : money(s.statePaid)}</td>
                  {s.statePaidIsWithheld
                    ? <td title={`${pct(s.enrollmentShare)} of US enrollment; the paid share is withheld`}><span className="pfd-sharebar-v">withheld</span></td>
                    : <td title={`${pct(s.share)} of US paid · ${pct(s.enrollmentShare)} of US enrollment (green tick)`}>
                      <ShareBar share={s.share} enrollmentShare={s.enrollmentShare} full={SHARE_BAR_FULL} width={56} /> <span className="pfd-sharebar-v">{pct(s.share)}</span>
                    </td>}
                  <td className="r"><b>{s.statePaidIsWithheld ? '—' : multiple(s.excessMultiple)}</b></td>
                  <td>
                    <span className="pfd-fp" role="img" aria-label={`Signal strengths: ${SIGNAL_KEYS.map((k) => `${SIGNAL_SHORT_LABELS[k]} ${s.signalStrengthIsShown[k] ? pct(s.signalStrength[k], 0) : 'withheld'}`).join(', ')}`}>
                      {SIGNAL_KEYS.map((k) => <i key={k} style={{ background: s.signalStrengthIsShown[k] ? signalShade(s.signalStrength[k]) : 'var(--pfd-cell-withheld, #262933)' }} title={`${SIGNAL_SHORT_LABELS[k]}: ${s.signalStrengthIsShown[k] ? `${pct(s.signalStrength[k], 0)} of its ${review.SignalWeights[k]} points` : `strength withheld (it would give back a figure for fewer than ${SMALL_CELL_MINIMUM} billers)`}`} />)}
                    </span>
                    {s.knownCaseId ? <span className="pfd-sig pfd-sig-known">known case</span> : null}
                    <span className="pfd-sig-line"><ExplanationTag s={s} /></span>
                  </td>
                  <td>
                    <span className="pfd-scorebar" aria-hidden="true"><i style={{ width: `${s.score}%`, background: TIER_COLORS[s.tier.key] }} /></span>
                    <b>{s.score}</b> <span className={`pfd-tier ${TIER_CLASS[s.tier.key] ?? ''}`} title={s.tier.label}>{tierShortLabel(s.tier)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > shown ? <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => setShown(shown + 50)}>Show 50 more of {count(rows.length - shown)}</button> : null}
        <p className="pfd-note">
          The signal score orders review; it is not a probability of fraud. The suggested tier is DecisionPro&apos;s starting rule; a reviewer sets the tier after the explanation review.{' '}
          <button type="button" className="pfd-link" onClick={() => setShowMethod(!showMethod)}>{showMethod ? 'Hide' : 'How the score and tier work'}</button>
        </p>
        {showMethod ? (
          <div className="pfd-method">
            <table className="pfd-table pfd-compact">
              <thead><tr><th>Signal</th><th className="r">Points</th></tr></thead>
              <tbody>
                <tr><td>Share far above enrollment share (5× earns 0, 50× or more earns all, log scale)</td><td className="r">{review.SignalWeights.excessMultiple}</td></tr>
                <tr><td>Share at least doubled on the prior year</td><td className="r">{review.SignalWeights.shareSurge}</td></tr>
                <tr><td>Paid tripled over two years, no down year</td><td className="r">{review.SignalWeights.tripledAndGrowing}</td></tr>
                <tr><td>Far above enrollment share three years running</td><td className="r">{review.SignalWeights.persistentExcess}</td></tr>
                <tr><td>Billers new to the code this year (40% or more earns all)</td><td className="r">{review.SignalWeights.newEntrants}</td></tr>
                <tr><td>Top-10 billers&apos; share of dollars (30% earns 0, 80% all; none with 10 or fewer billers)</td><td className="r">{review.SignalWeights.concentration}</td></tr>
                <tr><td>Another state lost 10+ points of share on the code while this one gained 5+</td><td className="r">{review.SignalWeights.displacement}</td></tr>
              </tbody>
            </table>
            <ul className="pfd-list">{review.ActiveTierRule.map((t) => <li key={t.key}><b>{t.label}</b>: {t.test}</li>)}</ul>
            <p className="pfd-note">
              Law and policy: each row is matched to the dated public events on file for its state. An event can explain a rise when it took effect in the
              {' '}{lookbackYears === 1 ? 'year' : `${lookbackYears} years`} before the rise began, in the year it began, or was a temporary measure still in force then; on a collapse the test is against the start of the fall.
              A restriction or enforcement act counts whenever it took effect by the row&apos;s year: it may explain a fall, and it does not explain a rise.
              Only a confirmed billing-code or reporting change changes a rating, to EXPLAINED. A relaxed safeguard and a policy meant to add spending are tagged and leave the rating alone.
              &quot;Partly searched&quot; and &quot;not searched&quot; say how far the search went, not that nothing exists.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
