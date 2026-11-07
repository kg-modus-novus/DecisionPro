import { useMemo, useState } from 'react';
import { PROGRAM_EVENTS, STATE_NAMES, PATTERN_LABELS } from '../../data/potentialFraudCatalog.js';
import { money, pct, count, readSeries, TierBadge } from './fraudFormat.jsx';

/** Program blow-up: when did a program blow up in a way health needs cannot explain? */

export function ProgramBlowupPage({ radar, review, byId, focusState, setFocusState, focusId, setFocusId, openCase, addedEvents, setAddedEvents }) {
  const blowups = useMemo(() => review.ServiceYears.filter((s) => s.state === focusState && s.isBlowup)
    .sort((a, b) => (b.year - a.year) || (b.score - a.score)), [review, focusState]);
  const focused = focusId && byId.get(focusId)?.state === focusState ? byId.get(focusId) : null;
  const s = focused ?? blowups[0] ?? null;

  return (
    <div className="pfd-page">
      <div className="pfd-head-row">
        <h1>{s ? `Program blow-up · ${STATE_NAMES[s.state]} · ${s.codeLabel} (${s.hcpcs}), ${seriesSpan(radar, s)}` : 'Program blow-ups'}</h1>
        <label className="pfd-inline">State <select value={focusState} onChange={(e) => { setFocusState(e.target.value); setFocusId(null); }}>{Object.entries(STATE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="pfd-inline">Program <select value={s?.id ?? ''} onChange={(e) => setFocusId(e.target.value)}>
          {blowups.map((b) => <option key={b.id} value={b.id}>{b.year} · {b.codeLabel} ({b.hcpcs}) · score {b.score}</option>)}
          {focused && !focused.isBlowup ? <option value={focused.id}>{focused.year} · {focused.codeLabel} ({focused.hcpcs})</option> : null}
        </select></label>
      </div>
      {s ? <BlowupDetail radar={radar} review={review} s={s} openCase={openCase} addedEvents={addedEvents} setAddedEvents={setAddedEvents} /> : (
        <div className="pfd-card"><p>{STATE_NAMES[focusState]} has no service whose share surged or whose payments tripled in the screen years.</p></div>
      )}
    </div>
  );
}

function seriesSpan(radar, s) {
  const series = readSeries(radar, s.state, s.hcpcs);
  return series.length ? `${series[0].year}–${series[series.length - 1].year}` : s.year;
}

function BlowupDetail({ radar, review, s, openCase, addedEvents, setAddedEvents }) {
  const [showPeers, setShowPeers] = useState(false);
  const [draft, setDraft] = useState({ date: '', event: '', source: '' });
  const series = readSeries(radar, s.state, s.hcpcs);
  const at = series.find((r) => r.year === s.year);
  const twoBack = series.find((r) => r.year === s.year - 2);
  const h = s.health;
  const leaders = (radar.leadingStates[`${s.hcpcs}|${s.year}`] ?? []).filter(([st]) => st !== s.state);
  const atLine = s.enrollmentLine;
  const key = `${s.state}|${s.hcpcs}`;
  const events = buildEvents(radar, review, s, series, key, addedEvents);
  const other = s.displacementIsFound ? readSeries(radar, s.displacement.state, s.hcpcs) : [];
  const peerRows = radar.latestYear === s.year ? (radar.latestYearStatePaid[s.hcpcs] ?? []) : (radar.leadingStates[`${s.hcpcs}|${s.year}`] ?? []);

  return (
    <>
      <p className="pfd-sub">
        When did the program blow up in a way that a change in health needs cannot explain? {STATE_NAMES[s.state]}&apos;s payments for this service
        {twoBack ? ` went from ${money(twoBack.statePaid)} in ${twoBack.year} to ${money(s.statePaid)} in ${s.year}` : ` reached ${money(s.statePaid)} in ${s.year}`}
        {' '}while its share of national enrollment was {pct(s.enrollmentShare)}. {STATE_NAMES[s.state]} received {pct(s.share, 0)} of every Medicaid dollar paid for this service in the United States that year.
      </p>
      <div className="pfd-row">
        <div className="pfd-card pfd-grow">
          <h3>Paid per year · {STATE_NAMES[s.state]} vs the whole country</h3>
          <BlowupChart series={series} highlightYears={new Set(review.ServiceYears.filter((x) => x.state === s.state && x.hcpcs === s.hcpcs && x.isBlowup).map((x) => x.year))} state={s.state} />
          <p className="pfd-note">
            At its enrollment share {STATE_NAMES[s.state]} would have been paid about {money(atLine)} in {s.year} ({pct(s.enrollmentShare, 2)} of {money(s.nationalPaid)}).
            It was paid {money(s.statePaid)}: {s.excessMultiple.toFixed(0)} times that line.{!s.reportingComplete ? ` The ${s.year} figure is preliminary (publisher months short).` : ''}
          </p>
        </div>
        <div className="pfd-col-right">
          <div className="pfd-card">
            <h3>Can health explain it?</h3>
            <table className="pfd-table pfd-compact">
              <tbody>
                <tr><td>Enrollment share of US</td><td className="r">{h.enrollmentSharesAreKnown ? `${pct(h.firstEnrollmentShare, 2)} → ${pct(h.lastEnrollmentShare, 2)}` : '—'}</td><td><Verdict known={h.enrollmentSharesAreKnown} ok={h.enrollmentShareIsFlat} yes="flat" no="moved" /></td></tr>
                <tr><td>Medicaid and CHIP enrollment {s.year - 1}→{s.year}</td><td className="r">{signedPct(h.enrollmentChange1, h.enrollmentChange1IsKnown)}</td><td><Verdict known={h.enrollmentChange1IsKnown} ok={h.enrollmentIsFlatOrDown} yes={h.enrollmentChange1 < 0 ? 'down' : 'flat'} no="up" /></td></tr>
                <tr><td>Enrollment over two years</td><td className="r">{signedPct(h.enrollmentChange2, h.enrollmentChange2IsKnown)}</td><td /></tr>
                <tr><td>Serious mental illness and substance use prevalence (NSDUH)</td><td className="r">not loaded</td><td><span className="pfd-tier pfd-tier-convention">pending</span></td></tr>
                <tr><td>Overdose deaths (CDC VSRR)</td><td className="r">not loaded</td><td><span className="pfd-tier pfd-tier-convention">pending</span></td></tr>
                <tr><td>Paid for this service over two years</td><td className="r">{signedPct(h.paidChange2, h.paidChange2IsKnown, 0)}</td><td>{h.riseIsUnexplainedByEnrollment ? <span className="pfd-tier pfd-tier-high">unexplained by enrollment</span> : null}</td></tr>
              </tbody>
            </table>
            <p className="pfd-note">Enrollment is CMS monthly Medicaid and CHIP enrollment, mean of the year. Prevalence and overdose denominators are not loaded yet; until they are, only enrollment can rule a rise in or out.</p>
          </div>
          <div className="pfd-card">
            <h3>Who is billing it</h3>
            <table className="pfd-table pfd-compact">
              <tbody>
                <tr><td>Billing providers {s.year}</td><td className="r"><b>{count(s.billingNpis)}</b></td></tr>
                <tr><td>Billing it for the first time in {s.year}</td><td className="r"><b>{count(s.newBillingNpis)}</b> ({pct(s.newEntrantShare, 0)})</td></tr>
                <tr><td>Top-10 providers&apos; share</td><td className="r"><b>{at && at.statePaid ? pct(at.top10Paid / at.statePaid, 0) : pct(s.top10Share, 0)}</b></td></tr>
                <tr><td>States billing the code</td><td className="r">{s.statesBilling}</td></tr>
                <tr><td>Next largest state</td><td className="r">{leaders[0] ? `${STATE_NAMES[leaders[0][0]] ?? leaders[0][0]} ${money(leaders[0][1])}` : '—'}</td></tr>
              </tbody>
            </table>
            <p className="pfd-note">Counts of billing NPIs from the public file; no provider is named here.</p>
          </div>
        </div>
      </div>
      <div className="pfd-row">
        <div className="pfd-card pfd-col-right-w">
          <h3>Cross-state displacement · same code</h3>
          {s.displacementIsFound ? (
            <>
              <MiniBars series={other} markYear={s.displacement.year} />
              <p className="pfd-note">
                {STATE_NAMES[s.displacement.state]}&apos;s share fell from {pct(s.displacement.peakShare, 0)} ({s.displacement.peakShareYear}) to {pct(s.displacement.share, 0)} ({s.displacement.year}).
                {' '}{STATE_NAMES[s.state]}&apos;s rose from {pct(s.priorYearShare, 0)} to {pct(s.share, 0)} over the same period.
              </p>
            </>
          ) : <p className="pfd-note">No other state lost ten or more points of national share on this code in {s.year} or the year before.</p>}
        </div>
        <div className="pfd-card pfd-grow">
          <h3>Dated events to test against the rise</h3>
          <table className="pfd-table">
            <thead><tr><th>Date</th><th>Event</th><th>Source</th><th>Fit</th></tr></thead>
            <tbody>{events.map((e, i) => <tr key={i}><td>{e.date}</td><td>{e.event}</td><td>{e.source}</td><td><span className={`pfd-tier ${e.fitClass ?? 'pfd-tier-convention'}`}>{e.fit}</span></td></tr>)}</tbody>
          </table>
          <form className="pfd-add-event" onSubmit={(e) => {
            e.preventDefault();
            if (!draft.date || !draft.event) return;
            setAddedEvents({ ...addedEvents, [key]: [...(addedEvents[key] ?? []), { ...draft, fit: 'added by you' }] });
            setDraft({ date: '', event: '', source: '' });
          }}>
            <input aria-label="Event date" placeholder="Date (e.g. 2023-07)" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            <input aria-label="Event" placeholder="Event" value={draft.event} onChange={(e) => setDraft({ ...draft, event: e.target.value })} />
            <input aria-label="Source" placeholder="Source" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
            <button type="submit" className="pfd-btn pfd-btn-ghost">Add an event</button>
          </form>
          <p className="pfd-note">Events you add stay in this browser session only.</p>
          <div className="pfd-actions-row">
            <button type="button" className="pfd-btn" onClick={() => openCase(s.id)}>Open case file {s.state} · {s.hcpcs} · {s.year} →</button>
            <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => setShowPeers(!showPeers)}>{showPeers ? 'Hide peer states' : 'Compare peer states'}</button>
            <TierBadge tier={s.tier} /> <span className="pfd-note">score {s.score} · {s.patterns.map((p) => PATTERN_LABELS[p]).join(', ')}</span>
          </div>
          {showPeers ? (
            <table className="pfd-table pfd-compact">
              <thead><tr><th>State</th><th className="r">Paid {s.year}</th><th className="r">Share of US</th><th className="r">Enrollment share</th><th className="r">Multiple</th></tr></thead>
              <tbody>
                {[...peerRows].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([st, paid]) => {
                  const es = radar.enrollmentShare[`${st}|${s.year}`];
                  const sh = s.nationalPaid ? paid / s.nationalPaid : 0;
                  return <tr key={st} className={st === s.state ? 'pfd-row-on' : ''}><td>{STATE_NAMES[st] ?? st}</td><td className="r">{money(paid)}</td><td className="r">{pct(sh)}</td><td className="r">{es ? pct(es, 2) : '—'}</td><td className="r">{es ? `${(sh / es).toFixed(1)}×` : '—'}</td></tr>;
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </>
  );
}

function signedPct(v, known, digits = 1) {
  if (!known) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;
}

function Verdict({ known, ok, yes, no }) {
  if (!known) return null;
  return <span className={`pfd-tier ${ok ? 'pfd-tier-low' : 'pfd-tier-verify'}`}>{ok ? yes : no}</span>;
}

const FIT_CLASS = { 'start of rise': 'pfd-tier-verify', matches: 'pfd-tier-high', after: 'pfd-tier-verify', 'known case': 'pfd-tier-verify', displacement: 'pfd-tier-high' };

function buildEvents(radar, review, s, series, key, addedEvents) {
  // The screen's own dated events and their fit come from the program; the page adds policy and reviewer events.
  const events = s.riseEvents.map((e) => ({
    ...e,
    event: e.patterns ? `${e.event} (${e.patterns.map((p) => PATTERN_LABELS[p]).join(', ')})` : e.fit === 'displacement' ? e.event.replace(/^[A-Z]{2}'s/, `${STATE_NAMES[s.displacement.state]}'s`) : e.event,
    fitClass: FIT_CLASS[e.fit] ?? 'pfd-tier-verify',
  }));
  for (const e of PROGRAM_EVENTS[key] ?? []) events.push({ ...e, fitClass: e.fit === 'unknown' ? 'pfd-tier-convention' : 'pfd-tier-verify' });
  for (const e of addedEvents[key] ?? []) events.push({ ...e, fitClass: 'pfd-tier-convention' });
  return events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function BlowupChart({ series, highlightYears, state }) {
  const W = 760; const H = 300; const L = 64; const B = 40; const T = 44;
  const n = Math.max(series.length, 1);
  const step = (W - L - 20) / n;
  const maxP = Math.max(1, ...series.map((r) => r.nationalPaid), ...series.map((r) => r.statePaid)) * 1.08;
  const x = (i) => L + step * i + step / 2;
  const y = (v) => H - B - (v / maxP) * (H - B - T);
  const sy = (p) => H - B - p * (H - B - T);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxP);
  const enrollPts = series.filter((r) => r.enrollmentShare != null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pfd-chart" role="img" aria-label={`${state} paid per year against the national total`}>
      {ticks.map((t, i) => <g key={i}><line x1={L} x2={W - 10} y1={y(t)} y2={y(t)} className="pfd-grid" /><text x={L - 6} y={y(t) + 4} textAnchor="end" className="pfd-axis">{shortMoney(t)}</text></g>)}
      {series.map((r, i) => (
        <g key={r.year}>
          <rect x={x(i) - step * 0.3} y={y(r.nationalPaid)} width={step * 0.6} height={Math.max(0, y(0) - y(r.nationalPaid))} className="pfd-bar-national" />
          <rect x={x(i) - step * 0.3} y={y(r.statePaid)} width={step * 0.6} height={Math.max(0, y(0) - y(r.statePaid))} className={highlightYears.has(r.year) ? 'pfd-bar-flag' : 'pfd-bar-state'} />
          <text x={x(i)} y={H - B + 16} textAnchor="middle" className="pfd-axis-strong">{r.year}</text>
          <text x={x(i)} y={Math.max(T + 22, y(r.statePaid) - 5)} textAnchor="middle" className="pfd-bar-label">{shortMoney(r.statePaid)}</text>
          <text x={x(i)} y={T - 6} textAnchor="middle" className="pfd-share-label">{(r.share * 100).toFixed(1)}%</text>
        </g>
      ))}
      <polyline fill="none" className="pfd-share-line" points={series.map((r, i) => `${x(i)},${sy(r.share)}`).join(' ')} />
      {series.map((r, i) => <circle key={r.year} cx={x(i)} cy={sy(r.share)} r="4" className="pfd-share-dot" />)}
      {enrollPts.length > 1 ? <polyline fill="none" className="pfd-enroll-line" points={series.map((r, i) => (r.enrollmentShare != null ? `${x(i)},${sy(r.enrollmentShare)}` : null)).filter(Boolean).join(' ')} /> : null}
      <text x={L} y={14} className="pfd-axis">■ {state} paid (red = blow-up years) · ■ national paid · — {state} share of national paid (top row) · - - {state} enrollment share</text>
    </svg>
  );
}

function MiniBars({ series, markYear }) {
  const W = 380; const H = 170; const L = 44; const B = 30; const T = 16;
  const n = Math.max(series.length, 1);
  const step = (W - L - 10) / n;
  const max = Math.max(1, ...series.map((r) => r.statePaid)) * 1.1;
  const x = (i) => L + step * i + step / 2;
  const y = (v) => H - B - (v / max) * (H - B - T);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pfd-chart" role="img" aria-label="Paid per year in the state whose share collapsed">
      {series.map((r, i) => (
        <g key={r.year}>
          <rect x={x(i) - step * 0.3} y={y(r.statePaid)} width={step * 0.6} height={Math.max(0, y(0) - y(r.statePaid))} className={r.year === markYear ? 'pfd-bar-flag' : 'pfd-bar-state'} />
          <text x={x(i)} y={H - B + 14} textAnchor="middle" className="pfd-axis-strong">{r.year}</text>
          <text x={x(i)} y={y(r.statePaid) - 4} textAnchor="middle" className="pfd-bar-label">{shortMoney(r.statePaid)}</text>
        </g>
      ))}
    </svg>
  );
}

function shortMoney(v) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
