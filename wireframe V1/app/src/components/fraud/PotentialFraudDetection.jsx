import { useEffect, useMemo, useState } from 'react';
import { PotentialFraudSignalReview, SIGNAL_WEIGHTS, TIER_RULE, SCREEN_PATTERNS } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { PATTERN_LABELS, SERVICE_LABELS, STATE_NAMES, DETECTION_ANALYSES } from '../../data/potentialFraudCatalog.js';
import { money, pct, multiple, count, downloadText, TierBadge, TIER_CLASS } from './fraudFormat.jsx';
import { Sparkline, ShareBar, SIGNAL_SHORT_LABELS, signalShade, TIER_COLORS, TIER_DISPLAY_ORDER, tierShortLabel } from './fraudVisuals.jsx';
import { ProgramBlowupPage } from './ProgramBlowupPage.jsx';
import { CaseFilePage } from './CaseFilePage.jsx';
import { ReallocationPage } from './ReallocationPage.jsx';
import { ToolsCoveragePage } from './ToolsCoveragePage.jsx';
import { RadarMoneyBar, RadarStateMap } from './RadarOverview.jsx';

const TIERS = Object.fromEntries(TIER_RULE.map((t) => [t.key, t]));

/**
 * Potential Fraud Detection: a dedicated module that ranks potential Medicaid
 * fraud candidates across every state and service from public data (HHS T-MSIS
 * provider spending, CMS enrollment, NPPES attribution), opens a case file per
 * candidate, shows when a program blew up, models where flagged dollars could go,
 * and lists every analysis with the data it needs.
 *
 * The radar export (about 2 MB) loads on demand when the module opens.
 */

export const FRAUD_PAGES = [
  { id: 'radar', label: 'National radar' },
  { id: 'blowups', label: 'Program blow-ups' },
  { id: 'cases', label: 'Case files' },
  { id: 'realloc', label: 'Reallocation what-if' },
  { id: 'tools', label: 'Tools & data coverage' },
  { id: 'backtest', label: 'Backtests & known cases' },
];

export function PotentialFraudDetection({ stateCode = 'KY' }) {
  const [radar, setRadar] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState('radar');
  const [focusId, setFocusId] = useState(null);
  const [focusState, setFocusState] = useState(stateCode && STATE_NAMES[stateCode] ? stateCode : 'KY');
  // Reviewer entries for this browser session only (not saved anywhere).
  const [reviews, setReviews] = useState({});
  const [addedEvents, setAddedEvents] = useState({});

  useEffect(() => {
    let live = true;
    import('../../data/alp/potentialFraudRadar.js')
      .then((m) => { if (live) setRadar(m.POTENTIAL_FRAUD_RADAR); })
      .catch((e) => { if (live) setLoadError(String(e?.message ?? e)); });
    return () => { live = false; };
  }, []);

  const review = useMemo(() => {
    if (!radar) return null;
    const p = new PotentialFraudSignalReview();
    p.Radar = radar;
    p.CodeLabels = SERVICE_LABELS;
    p.ScorePotentialFraudCandidates();
    return p;
  }, [radar]);

  const byId = useMemo(() => new Map((review?.ServiceYears ?? []).map((s) => [s.id, s])), [review]);

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
  const shared = { radar, review, byId, focusState, setFocusState, focusId, setFocusId, openCase, openBlowup, openState, reviews, setReviews, addedEvents, setAddedEvents, setPage };

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
            {badges[p.id] ? <b>{badges[p.id]}</b> : null}
          </button>
        ))}
        <h4 className="pfd-side-gap">DATA AS OF</h4>
        <p className="pfd-side-note">
          T-MSIS v{radar.asOf}<br />
          Enrollment to {(radar.coverage.find((c) => c.dataRequestId === 'DR-REAL-PI-ENROLLMENT-ALL-STATES')?.asOf ?? '').slice(0, 7)}<br />
          Screen run {String(radar.screenRun.completedAt).slice(0, 10)}<br />
          LEIE {(radar.exclusionSummary[0]?.asOf ?? 'not loaded')}
        </p>
        <p className="pfd-side-note pfd-side-small">Public data only. No person-level data and no provider is named. A candidate is potential fraud to review, not a finding.</p>
      </aside>
      <div className="pfd-main">
        {page === 'radar' && <RadarPage {...shared} />}
        {page === 'blowups' && <ProgramBlowupPage {...shared} />}
        {page === 'cases' && <CaseFilePage {...shared} />}
        {page === 'realloc' && <ReallocationPage {...shared} />}
        {page === 'tools' && <ToolsCoveragePage {...shared} />}
        {page === 'backtest' && <BacktestPage {...shared} />}
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

function RadarPage({ radar, review, focusState, setFocusState, openCase, openState }) {
  const [year, setYear] = useState(review.LatestYear);
  const [stateFilter, setStateFilter] = useState('');
  const [patterns, setPatterns] = useState([]);
  const [tier, setTier] = useState('');
  const [completeOnly, setCompleteOnly] = useState(false);
  const [minAboveStop, setMinAboveStop] = useState(0);
  const [sort, setSort] = useState('score');
  const [shown, setShown] = useState(25);
  const [showMethod, setShowMethod] = useState(false);
  const minAbove = MIN_ABOVE[minAboveStop];

  const yearRows = useMemo(() => review.ServiceYears.filter((s) => s.year === year), [review, year]);
  const rows = useMemo(() => yearRows
    .filter((s) => !stateFilter || s.state === stateFilter)
    .filter((s) => patterns.every((p) => s.patterns.includes(p)))
    .filter((s) => !tier || s.tier.key === tier)
    .filter((s) => !completeOnly || s.reportingComplete)
    .filter((s) => s.aboveEnrollment >= minAbove)
    .sort(SORTS[sort].fn), [yearRows, stateFilter, patterns, tier, completeOnly, minAbove, sort]);

  const ys = review.YearSummaries[year];
  const panelState = stateFilter || focusState;
  // Pill counts: the selected state's summary when the list is filtered to a state, else the year's.
  const counts = stateFilter ? review.StateYearSummaries[`${stateFilter}|${year}`] : ys;
  const tierCount = (k) => (counts ? counts.tiers[k].services : 0);
  const patternCount = (p) => (counts ? counts.patternServices[p] : 0);
  const restart = () => setShown(25);

  function exportCsv() {
    const head = ['rank', 'state', 'hcpcs', 'service', 'year', 'patterns', 'paid', 'share_of_us', 'enrollment_share', 'multiple', 'above_enrollment_line', 'above_prior_year_line', 'billers', 'new_billers', 'top10_share', 'states_billing', 'reporting_complete', 'score', 'suggested_tier'];
    const lines = rows.map((s, i) => [i + 1, s.state, s.hcpcs, `"${s.codeLabel.replace(/"/g, "'")}"`, s.year, s.patterns.join('+'), s.statePaid, s.share, s.enrollmentShare, s.excessMultiple, s.aboveEnrollment, s.abovePriorShare, s.billingNpis, s.newBillingNpis, s.top10Share, s.statesBilling, s.reportingComplete, s.score, s.tier.label].join(','));
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
              <button key={k} type="button" className={`pfd-pill${tier === k ? ' is-on' : ''}`} aria-pressed={tier === k} data-tier={k} title={TIERS[k].test} onClick={() => { setTier(tier === k ? '' : k); restart(); }}>
                <i className="pfd-pill-sw" style={{ background: TIER_COLORS[k] }} />{tierShortLabel(TIERS[k])}<b>{count(tierCount(k))}</b>
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
            <button type="button" className="pfd-btn pfd-btn-ghost pfd-push" onClick={exportCsv}>Export ranked list ↓</button>
          </div>
        </div>
        <p className="pfd-note pfd-tight">
          Screen filters always on: code billed in 10+ states · state paid at least $1M in the year. <b data-row-count>{count(rows.length)}</b> rows match
          {stateFilter ? ` in ${STATE_NAMES[stateFilter]} (click it on the map again to clear)` : ''}.
          {' '}{count(ys.incompleteReportingServices)} of {year}&apos;s {count(ys.services)} rows have preliminary reporting (publisher months short).
          Signals, left to right: {SIGNAL_KEYS.map((k) => SIGNAL_SHORT_LABELS[k]).join(' · ')}; darker earns more of its weight. Click a column heading to sort.
        </p>
        <div className="pfd-table-wrap">
          <table className="pfd-table pfd-table-rows">
            <colgroup>
              <col style={{ width: 34 }} /><col style={{ width: 38 }} /><col /><col style={{ width: 80 }} /><col style={{ width: 78 }} />
              <col style={{ width: 132 }} /><col style={{ width: 52 }} /><col style={{ width: 170 }} /><col style={{ width: 170 }} />
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
                      points={review.YearlySeriesByStateCode[`${s.state}|${s.hcpcs}`].map((r) => ({ year: r.year, value: r.statePaid }))}
                      markYear={s.year}
                      label={`${s.state} ${s.hcpcs} paid by year, ${s.year} marked`}
                    />
                  </td>
                  <td className="r">{money(s.statePaid)}</td>
                  <td title={`${pct(s.share)} of US paid · ${pct(s.enrollmentShare)} of US enrollment (green tick)`}>
                    <ShareBar share={s.share} enrollmentShare={s.enrollmentShare} full={SHARE_BAR_FULL} /> <span className="pfd-sharebar-v">{pct(s.share)}</span>
                  </td>
                  <td className="r"><b>{multiple(s.excessMultiple)}</b></td>
                  <td>
                    <span className="pfd-fp" role="img" aria-label={`Signal strengths: ${SIGNAL_KEYS.map((k) => `${SIGNAL_SHORT_LABELS[k]} ${pct(s.signalStrength[k], 0)}`).join(', ')}`}>
                      {SIGNAL_KEYS.map((k) => <i key={k} style={{ background: signalShade(s.signalStrength[k]) }} title={`${SIGNAL_SHORT_LABELS[k]}: ${pct(s.signalStrength[k], 0)} of its ${SIGNAL_WEIGHTS[k]} points`} />)}
                    </span>
                    {s.knownCaseId ? <span className="pfd-sig pfd-sig-known">known case</span> : null}
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
                <tr><td>Share far above enrollment share (5× earns 0, 50× or more earns all, log scale)</td><td className="r">{SIGNAL_WEIGHTS.excessMultiple}</td></tr>
                <tr><td>Share at least doubled on the prior year</td><td className="r">{SIGNAL_WEIGHTS.shareSurge}</td></tr>
                <tr><td>Paid tripled over two years, no down year</td><td className="r">{SIGNAL_WEIGHTS.tripledAndGrowing}</td></tr>
                <tr><td>Far above enrollment share three years running</td><td className="r">{SIGNAL_WEIGHTS.persistentExcess}</td></tr>
                <tr><td>Billers new to the code this year (40% or more earns all)</td><td className="r">{SIGNAL_WEIGHTS.newEntrants}</td></tr>
                <tr><td>Top-10 billers&apos; share of dollars (30% earns 0, 80% all; none with 10 or fewer billers)</td><td className="r">{SIGNAL_WEIGHTS.concentration}</td></tr>
                <tr><td>Another state lost 10+ points of share on the code while this one gained 5+</td><td className="r">{SIGNAL_WEIGHTS.displacement}</td></tr>
              </tbody>
            </table>
            <ul className="pfd-list">{TIER_RULE.map((t) => <li key={t.key}><b>{t.label}</b>: {t.test}</li>)}</ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BacktestPage({ radar, byId, openCase }) {
  return (
    <div className="pfd-page">
      <h1>Backtests &amp; known cases</h1>
      <p className="pfd-sub">
        Before the radar is trusted on new candidates, it must find the cases already known to be fraud and must not flag the billing conventions
        known to be innocent. These are the cases the Empower Oversight screen was checked against; each is re-tested on every scan.
      </p>
      <div className="pfd-card">
        <table className="pfd-table">
          <thead><tr><th>Case</th><th>State · service · year</th><th>Expected</th><th>Result</th><th className="r">Score</th><th>Suggested tier</th><th>Note</th></tr></thead>
          <tbody>
            {radar.backtest.map((b) => {
              const s = b.year ? byId.get(`${b.state_code}|${b.hcpcs}|${b.year}`) : null;
              return (
                <tr key={b.id} className={s ? 'pfd-click' : ''} onClick={() => s && openCase(s.id)}>
                  <td>{b.id}</td>
                  <td><b>{b.state_code}</b> · {SERVICE_LABELS[b.hcpcs] ?? b.hcpcs} <span className="pfd-code">{b.hcpcs}</span> · {b.year || 'any year'}</td>
                  <td>{b.expected === 'detected' ? 'flagged' : 'not flagged'}</td>
                  <td><span className={`pfd-tier ${b.ok ? 'pfd-tier-low' : 'pfd-tier-high'}`}>{b.ok ? 'PASS' : 'FAIL'}</span> {b.detected ? 'flagged' : 'not flagged'}</td>
                  <td className="r">{s ? s.score : '—'}</td>
                  <td>{s ? <TierBadge tier={s.tier} /> : '—'}</td>
                  <td className="pfd-note-cell">{b.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="pfd-note">A known case is flagged when its state, service and year is a screen candidate. The two conventions are codes billed in fewer than ten states, which the ten-state filter sets aside. Screen run {String(radar.screenRun.completedAt).slice(0, 10)} on T-MSIS v{radar.asOf}.</p>
      </div>
    </div>
  );
}
