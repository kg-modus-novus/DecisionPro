import { useEffect, useMemo, useState } from 'react';
import { PotentialFraudSignalReview, SIGNAL_WEIGHTS, TIER_RULE } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { PATTERN_LABELS, SERVICE_LABELS, STATE_NAMES, STATE_TILES, DETECTION_ANALYSES } from '../../data/potentialFraudCatalog.js';
import { money, pct, multiple, count, downloadText, TierBadge } from './fraudFormat.jsx';
import { ProgramBlowupPage } from './ProgramBlowupPage.jsx';
import { CaseFilePage } from './CaseFilePage.jsx';
import { ReallocationPage } from './ReallocationPage.jsx';
import { ToolsCoveragePage } from './ToolsCoveragePage.jsx';

/** Whether the program's checklist fired a signal for this service-year (the chips show only what the program decided). */
const fired = (s, id) => s.checks.some((c) => c.id === id && c.kind === 'fired');

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
  above: { label: 'dollars above the enrollment line', fn: (a, b) => b.aboveEnrollment - a.aboveEnrollment },
  paid: { label: 'paid', fn: (a, b) => b.statePaid - a.statePaid },
  multiple: { label: 'multiple of enrollment share', fn: (a, b) => b.excessMultiple - a.excessMultiple },
};

const MIN_ABOVE = [0, 1e6, 10e6, 100e6];

function tileColor(v) {
  if (!v) return null;
  if (v > 3e9) return '#b23b3b';
  if (v > 1.2e9) return '#c9742d';
  if (v > 5e8) return '#b8962a';
  return '#2b5c8a';
}

function RadarPage({ radar, review, focusState, setFocusState, openCase, openState }) {
  const [year, setYear] = useState(review.LatestYear);
  const [stateFilter, setStateFilter] = useState('');
  const [pattern, setPattern] = useState('');
  const [tier, setTier] = useState('');
  const [completeOnly, setCompleteOnly] = useState(false);
  const [minAbove, setMinAbove] = useState(0);
  const [sort, setSort] = useState('score');
  const [shown, setShown] = useState(25);
  const [showMethod, setShowMethod] = useState(false);

  const yearRows = useMemo(() => review.ServiceYears.filter((s) => s.year === year), [review, year]);
  const rows = useMemo(() => yearRows
    .filter((s) => !stateFilter || s.state === stateFilter)
    .filter((s) => !pattern || s.patterns.includes(pattern))
    .filter((s) => !tier || s.tier.key === tier)
    .filter((s) => !completeOnly || s.reportingComplete)
    .filter((s) => s.aboveEnrollment >= minAbove)
    .sort(SORTS[sort].fn), [yearRows, stateFilter, pattern, tier, completeOnly, minAbove, sort]);

  const ys = review.YearSummaries[year];
  const allYears = review.ServiceYears.length;
  const bt = radar.backtest;
  const panelState = stateFilter || focusState;
  const st = review.StateYearSummaries[`${panelState}|${year}`];
  const leading = st ? review.ServiceYears.find((s) => s.id === st.leadingId) : null;

  function exportCsv() {
    const head = ['rank', 'state', 'hcpcs', 'service', 'year', 'patterns', 'paid', 'share_of_us', 'enrollment_share', 'multiple', 'above_enrollment_line', 'above_prior_year_line', 'billers', 'new_billers', 'top10_share', 'states_billing', 'reporting_complete', 'score', 'suggested_tier'];
    const lines = rows.map((s, i) => [i + 1, s.state, s.hcpcs, `"${s.codeLabel.replace(/"/g, "'")}"`, s.year, s.patterns.join('+'), s.statePaid, s.share, s.enrollmentShare, s.excessMultiple, s.aboveEnrollment, s.abovePriorShare, s.billingNpis, s.newBillingNpis, s.top10Share, s.statesBilling, s.reportingComplete, s.score, s.tier.label].join(','));
    downloadText(`potential-fraud-radar-${year}${stateFilter ? `-${stateFilter}` : ''}.csv`, [head.join(','), ...lines].join('\n'), 'text/csv');
  }

  return (
    <div className="pfd-page">
      <h1>Potential fraud radar · every state, every service, {review.Years[0]}–{review.LatestYear}</h1>
      <p className="pfd-sub">
        Where does a state&apos;s share of national Medicaid spending on a service run far ahead of its share of national enrollment, and when did a
        program blow up in a way health needs cannot explain? Public data only (HHS T-MSIS provider spending, CMS enrollment, NPPES).
        Ranked by signal score; every row opens a case file.
      </p>
      <div className="pfd-kpis">
        <div className="pfd-kpi"><small>Flagged state-service-years, {year}</small><b>{count(ys.services)}</b><em>across {ys.states} states · {count(allYears)} over {review.Years[0]}–{review.LatestYear}</em></div>
        <div className="pfd-kpi"><small>Paid on flagged services, {year}</small><b>{money(ys.statePaid)}</b><em>of {money(ys.nationalPaidInFile)} Medicaid paid in the file that year</em></div>
        <div className="pfd-kpi"><small>Above the enrollment-share line</small><b>{money(ys.aboveEnrollment)}</b><em>what-if, if every flag were upheld</em></div>
        <div className="pfd-kpi"><small>Above the prior-year line</small><b>{money(ys.abovePriorShare)}</b><em>new growth in one year</em></div>
        <div className="pfd-kpi"><small>Backtest</small><b>{bt.filter((b) => b.ok).length} / {bt.length}</b><em>known cases found · conventions not flagged</em></div>
      </div>
      <div className="pfd-row pfd-radar-row">
        <div className="pfd-card pfd-grow">
          <div className="pfd-filters" role="group" aria-label="Radar filters">
            <label>Year <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setShown(25); }}>{review.Years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
            <label>State <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); if (e.target.value) setFocusState(e.target.value); setShown(25); }}><option value="">All states</option>{Object.entries(STATE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Pattern <select value={pattern} onChange={(e) => setPattern(e.target.value)}><option value="">Any</option>{Object.entries(PATTERN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Tier <select value={tier} onChange={(e) => setTier(e.target.value)}><option value="">Any</option>{TIER_RULE.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
            <label>Above line <select value={minAbove} onChange={(e) => setMinAbove(Number(e.target.value))}>{MIN_ABOVE.map((m) => <option key={m} value={m}>{m ? `≥ ${money(m, 0)}` : 'any'}</option>)}</select></label>
            <label className="pfd-check"><input type="checkbox" checked={completeOnly} onChange={(e) => setCompleteOnly(e.target.checked)} /> Complete reporting only</label>
            <label>Sort <select value={sort} onChange={(e) => setSort(e.target.value)}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            <button type="button" className="pfd-btn pfd-btn-ghost pfd-push" onClick={exportCsv}>Export ranked list ↓</button>
          </div>
          <p className="pfd-note pfd-tight">Screen filters always on: code billed in 10+ states · state paid at least $1M in the year. {count(rows.length)} rows match.</p>
          <div className="pfd-table-wrap">
            <table className="pfd-table">
              <thead><tr><th>#</th><th>State</th><th>Service</th><th className="r">Paid {year}</th><th className="r">Share of US</th><th className="r">Multiple</th><th>Signals</th><th className="r">Score · suggested tier</th></tr></thead>
              <tbody>
                {rows.slice(0, shown).map((s, i) => (
                  <tr key={s.id} className="pfd-click" onClick={() => openCase(s.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openCase(s.id); }}>
                    <td>{i + 1}</td>
                    <td><b>{s.state}</b></td>
                    <td>{s.codeLabel} <span className="pfd-code">{s.hcpcs}</span><small className="pfd-sub">billed in {s.statesBilling} states</small></td>
                    <td className="r">{money(s.statePaid)}</td>
                    <td className="r">{pct(s.share)}<small className="pfd-sub">enrolled {pct(s.enrollmentShare)}</small></td>
                    <td className="r"><b>{multiple(s.excessMultiple)}</b></td>
                    <td className="pfd-sigs">
                      {s.patterns.map((p) => <span key={p} className="pfd-sig">{PATTERN_LABELS[p]}</span>)}
                      {fired(s, 'new-billers') ? <span className="pfd-sig">new billers {s.newBillingNpis}/{s.billingNpis}</span> : null}
                      {fired(s, 'concentration') ? <span className="pfd-sig">top-10 {pct(s.top10Share, 0)}</span> : null}
                      {s.displacementIsFound ? <span className="pfd-sig">{s.displacement.state} displacement</span> : null}
                      {s.knownCaseId ? <span className="pfd-sig pfd-sig-known">known case</span> : null}
                      {!s.reportingComplete ? <span className="pfd-sig pfd-sig-muted">preliminary</span> : null}
                    </td>
                    <td className="r pfd-nowrap"><b>{s.score}</b> <TierBadge tier={s.tier} /></td>
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
        <div className="pfd-col-right pfd-radar-side">
          <div className="pfd-card">
            <h3>Dollars above the enrollment line, {year} · by state</h3>
            <div className="pfd-tiles" role="group" aria-label="States by dollars above the enrollment line">
              {Object.entries(STATE_TILES).map(([state, [r, c]]) => {
                const t = review.StateYearSummaries[`${state}|${year}`];
                const bg = tileColor(t?.aboveEnrollment);
                return (
                  <button
                    type="button"
                    key={state}
                    className={`pfd-tile${state === panelState ? ' is-on' : ''}`}
                    style={{ gridRow: r + 1, gridColumn: c + 1, background: bg ?? undefined, color: bg ? '#fff' : undefined }}
                    title={`${STATE_NAMES[state]}: ${t ? `${money(t.aboveEnrollment)} above the line on ${t.services} services` : 'none flagged'}`}
                    onClick={() => { setStateFilter(state); setFocusState(state); setShown(25); }}
                  >{state}</button>
                );
              })}
            </div>
            <p className="pfd-note">Red over $3B · orange over $1.2B · gold over $500M · blue flagged. Select a state to filter the list.</p>
          </div>
          {st ? (
            <div className="pfd-card">
              <h3>{STATE_NAMES[panelState]} · {year}</h3>
              <table className="pfd-table pfd-compact">
                <tbody>
                  <tr><td>Flagged services</td><td className="r"><b>{st.services}</b></td></tr>
                  <tr><td>Paid on them</td><td className="r"><b>{money(st.statePaid)}</b></td></tr>
                  <tr><td>Above the enrollment line</td><td className="r"><b>{money(st.aboveEnrollment)}</b></td></tr>
                  <tr><td>Above the prior-year line</td><td className="r">{money(st.abovePriorShare)}</td></tr>
                  <tr><td>Leading signal</td><td className="r">{leading ? `${leading.codeLabel}, ${pct(leading.share, 0)} of US` : '—'}</td></tr>
                  <tr><td>Suggested HIGH tier</td><td className="r">{st.high}</td></tr>
                </tbody>
              </table>
              <div className="pfd-actions-row">
                <button type="button" className="pfd-btn" onClick={() => openState(panelState, 'cases')}>Open {STATE_NAMES[panelState]} case files →</button>
                <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => openState(panelState, 'realloc')}>Reallocation what-if</button>
              </div>
            </div>
          ) : <div className="pfd-card"><p className="pfd-note">{STATE_NAMES[panelState]} has no flagged service in {year}.</p></div>}
        </div>
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
