import { useMemo, useState } from 'react';
import { PROGRAM_EVENTS, STATE_NAMES, PATTERN_LABELS } from '../../data/potentialFraudCatalog.js';
import { money, pct, count, TierBadge, BillingCode } from './fraudFormat.jsx';
import { StateTileMap, Swatch, Legend, shortMoney, FRAUD_COLORS } from './fraudVisuals.jsx';

/** Program blow-up: when did a program blow up in a way health needs cannot explain? */

/** Tile tint by the number of programs that blew up in the state in the latest year. */
function blowupTint(n) {
  if (n >= 5) return { background: '#D85A30', color: '#2a0d05' };
  if (n >= 3) return { background: '#F0997B', color: '#4A1B0C' };
  if (n >= 1) return { background: '#F5C4B3', color: '#4A1B0C' };
  return null;
}

const EARLIER_ONLY = Object.freeze({ background: 'transparent', color: '#c9d8ec', boxShadow: 'inset 0 0 0 1px #5a6f8c' });

export function ProgramBlowupPage({ radar, review, byId, focusState, setFocusState, focusId, setFocusId, openCase, addedEvents, setAddedEvents }) {
  const latest = review.LatestYear;
  const statesWithBlowups = useMemo(() => new Set(review.ServiceYears.filter((s) => s.isBlowup).map((s) => s.state)), [review]);
  const latestCount = (st) => review.StateYearSummaries[`${st}|${latest}`]?.blowups ?? 0;
  const programs = useMemo(() => {
    const own = review.ServiceYears.filter((s) => s.state === focusState && s.isBlowup);
    const inLatest = own.filter((s) => s.year === latest).sort((a, b) => b.score - a.score);
    if (inLatest.length) return inLatest;
    const newestPerCode = new Map();
    for (const s of [...own].sort((a, b) => (b.year - a.year) || (b.score - a.score))) if (!newestPerCode.has(s.hcpcs)) newestPerCode.set(s.hcpcs, s);
    return [...newestPerCode.values()];
  }, [review, focusState, latest]);
  const focused = focusId && byId.get(focusId)?.state === focusState ? byId.get(focusId) : null;
  const s = focused ?? programs[0] ?? null;
  const programsAreLatest = programs.length > 0 && programs[0].year === latest;
  const tileTitle = (st) => {
    const n = latestCount(st);
    if (n) return `${STATE_NAMES[st]}: ${n} blew up in ${latest}`;
    return `${STATE_NAMES[st]}: ${statesWithBlowups.has(st) ? `none in ${latest}, earlier blow-ups` : 'no blow-up in the screen years'}`;
  };

  return (
    <div className="pfd-page">
      <h1>{s ? <>Program blow-up · {STATE_NAMES[s.state]} · {s.codeLabel} (<BillingCode code={s.hcpcs} plain />), <span className="pfd-billing-code">{seriesSpan(review, s)}</span></> : 'Program blow-ups'}</h1>
      <div className="pfd-card pfd-picker">
        <div className="pfd-picker-map">
          <div className="pfd-picker-label">State · tint = programs that blew up in {latest}</div>
          <StateTileMap
            label={`States by programs that blew up in ${latest}`}
            selected={focusState}
            onSelect={(st) => { setFocusState(st); setFocusId(null); }}
            isEnabled={(st) => statesWithBlowups.has(st) || st === focusState}
            tileStyle={(st) => blowupTint(latestCount(st)) ?? (statesWithBlowups.has(st) ? EARLIER_ONLY : null)}
            tileTitle={tileTitle}
          />
          <Legend>
            <Swatch color="#F5C4B3" label="1–2" />
            <Swatch color="#F0997B" label="3–4" />
            <Swatch color="#D85A30" label="5+" />
            <Swatch kind="outline" color="#5a6f8c" label="earlier years only" />
          </Legend>
        </div>
        <div className="pfd-picker-list">
          <div className="pfd-picker-label">
            {STATE_NAMES[focusState]} · {programsAreLatest ? `programs that blew up in ${latest}` : programs.length ? `no blow-up in ${latest}; earlier blow-ups` : 'no blow-ups'}
          </div>
          {programs.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`pfd-program${s && p.hcpcs === s.hcpcs ? ' is-on' : ''}`}
              onClick={() => setFocusId(p.id)}
              data-program={p.id}
            >
              <span>{p.codeLabel} <span className="pfd-code">{p.hcpcs}</span>{programsAreLatest ? null : <span className="pfd-code">{p.year}</span>}</span>
              <span className="pfd-program-score"><TierBadge tier={p.tier} /> <b>{p.score}</b></span>
            </button>
          ))}
          {s && !programs.some((p) => p.hcpcs === s.hcpcs) ? (
            <button type="button" className="pfd-program is-on" onClick={() => setFocusId(s.id)}>
              <span>{s.codeLabel} <span className="pfd-code">{s.hcpcs}</span><span className="pfd-code">not a blow-up</span></span>
              <span className="pfd-program-score"><TierBadge tier={s.tier} /> <b>{s.score}</b></span>
            </button>
          ) : null}
          <p className="pfd-note">Click a program to open it. In the chart, click the bar of a flagged year to change the year.</p>
        </div>
      </div>
      {s ? <BlowupDetail radar={radar} review={review} s={s} openCase={openCase} setFocusId={setFocusId} addedEvents={addedEvents} setAddedEvents={setAddedEvents} /> : (
        <div className="pfd-card"><p>{STATE_NAMES[focusState]} has no service whose share surged or whose payments tripled in the screen years.</p></div>
      )}
    </div>
  );
}

function seriesSpan(review, s) {
  const series = review.YearlySeriesByStateCode[`${s.state}|${s.hcpcs}`] ?? [];
  return series.length ? `${series[0].year}–${series[series.length - 1].year}` : s.year;
}

function timesText(v) {
  return v >= 10 ? v.toFixed(0) : v.toFixed(1);
}

function BlowupDetail({ radar, review, s, openCase, setFocusId, addedEvents, setAddedEvents }) {
  const [showPeers, setShowPeers] = useState(false);
  const [draft, setDraft] = useState({ date: '', event: '', source: '' });
  const series = review.YearlySeriesByStateCode[`${s.state}|${s.hcpcs}`] ?? [];
  const at = series.find((r) => r.year === s.year);
  const twoBack = series.find((r) => r.year === s.year - 2);
  const h = s.health;
  const leaders = (radar.leadingStates[`${s.hcpcs}|${s.year}`] ?? []).filter(([st]) => st !== s.state);
  const key = `${s.state}|${s.hcpcs}`;
  const events = buildEvents(s, key, addedEvents);
  const other = s.displacementIsFound ? (review.YearlySeriesByStateCode[`${s.displacement.state}|${s.hcpcs}`] ?? []) : [];
  const peerRows = radar.latestYear === s.year ? (radar.latestYearStatePaid[s.hcpcs] ?? []) : (radar.leadingStates[`${s.hcpcs}|${s.year}`] ?? []);
  const name = STATE_NAMES[s.state];

  return (
    <>
      <p className="pfd-sub">
        When did the program blow up in a way that a change in health needs cannot explain? {name}&apos;s payments for this service
        {twoBack ? ` went from ${money(twoBack.statePaid)} in ${twoBack.year} to ${money(s.statePaid)} in ${s.year}` : ` reached ${money(s.statePaid)} in ${s.year}`}
        {' '}while its share of national enrollment was {pct(s.enrollmentShare)}. {name} received {pct(s.share, 0)} of every Medicaid dollar paid for this service in the United States that year.
      </p>
      <div className="pfd-row">
        <div className="pfd-card pfd-grow">
          <h3>Paid per year · {name} vs the whole country</h3>
          <Legend>
            <Swatch color={FRAUD_COLORS.state} label={`${name} paid`} />
            <Swatch color={FRAUD_COLORS.flag} label={`${name} paid, blow-up year`} />
            <Swatch kind="outline" color={FRAUD_COLORS.national} label="United States paid" />
            <Swatch kind="dash" color={FRAUD_COLORS.fairShare} label={`${name}'s fair share (enrollment line)`} />
          </Legend>
          <BlowupChart series={series} selectedYear={s.year} stateName={name} onPickYear={(id) => setFocusId(id)} />
          <p className="pfd-note pfd-caption">
            {at && at.enrollmentLineIsKnown
              ? <>{s.year}: {name} was paid <b>{money(at.statePaid)}</b>. At its {pct(at.enrollmentShare, 2)} enrollment share its fair share was about {money(at.enrollmentLine)} ({pct(at.enrollmentShare, 2)} of {money(at.nationalPaid)}), so it was paid <b>{timesText(at.timesEnrollmentLine)} times</b> that line.</>
              : <>{s.year}: {name} was paid {money(s.statePaid)}; its fair share for the year cannot be measured (enrollment share or national total not loaded), so no line is drawn.</>}
            {!s.reportingComplete ? ` The ${s.year} figure is preliminary (publisher months short).` : ''}
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
                <tr><td>Top-10 providers&apos; share</td><td className="r"><b>{pct(at ? at.top10Share : s.top10Share, 0)}</b></td></tr>
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
                {' '}{name}&apos;s rose from {pct(s.priorYearShare, 0)} to {pct(s.share, 0)} over the same period.
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

function buildEvents(s, key, addedEvents) {
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

/**
 * One dollar axis: the United States total as an outline, the state's paid as a bar inside it (red in
 * blow-up years), the state's fair share as a dashed line, and two rows on top: share of US paid and
 * times the fair share. The bars of years the screen flagged open that year.
 */
function BlowupChart({ series, selectedYear, stateName, onPickYear }) {
  const W = 600; const H = 290; const L = 76; const B = 30; const T = 50; const R = 6;
  const n = Math.max(series.length, 1);
  const step = (W - L - R) / n;
  const outer = Math.min(step * 0.74, 70);
  const inner = Math.max(6, outer - 16);
  const maxP = Math.max(1, ...series.map((r) => Math.max(r.nationalPaid, r.statePaid, r.enrollmentLine))) * 1.06;
  const x = (i) => L + step * i + step / 2;
  const y = (v) => H - B - (v / maxP) * (H - B - T);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxP);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pfd-chart" role="img" aria-label={`${stateName} paid per year against the United States total and its fair share`}>
      {ticks.map((t, i) => <g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="pfd-grid" /><text x={L - 8} y={y(t) + 4} textAnchor="end" className="pfd-axis">{shortMoney(t)}</text></g>)}
      <text x={L - 8} y={T - 32} textAnchor="end" className="pfd-axis">share of US</text>
      <text x={L - 8} y={T - 14} textAnchor="end" className="pfd-axis">× fair share</text>
      {series.map((r, i) => {
        const on = r.year === selectedYear;
        const pick = () => onPickYear(r.serviceYearId);
        return (
          <g
            key={r.year}
            className={r.isFlagged ? 'pfd-bar-pick' : undefined}
            onClick={r.isFlagged ? pick : undefined}
            tabIndex={r.isFlagged ? 0 : undefined}
            role={r.isFlagged ? 'button' : undefined}
            aria-label={r.isFlagged ? `Open ${r.year}` : undefined}
            onKeyDown={r.isFlagged ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } } : undefined}
            data-year={r.year}
          >
            <title>{`${r.year}: ${stateName} ${shortMoney(r.statePaid)} of ${shortMoney(r.nationalPaid)} in the US${r.isFlagged ? '' : ' · not flagged this year'}`}</title>
            <rect x={x(i) - outer / 2} y={y(r.nationalPaid)} width={outer} height={Math.max(0, y(0) - y(r.nationalPaid))} className="pfd-bar-us" />
            <rect x={x(i) - inner / 2} y={y(r.statePaid)} width={inner} height={Math.max(1, y(0) - y(r.statePaid))} className={`${r.isBlowup ? 'pfd-bar-flag' : 'pfd-bar-state'}${on ? ' pfd-bar-on' : ''}`} />
            {r.enrollmentLineIsKnown ? <line x1={x(i) - outer / 2} x2={x(i) + outer / 2} y1={y(r.enrollmentLine)} y2={y(r.enrollmentLine)} className="pfd-fair-line" /> : null}
            <text x={x(i)} y={Math.max(T + 12, y(r.statePaid) - 6)} textAnchor="middle" className="pfd-bar-label">{shortMoney(r.statePaid)}</text>
            <text x={x(i)} y={T - 32} textAnchor="middle" className="pfd-axis-strong">{(r.share * 100).toFixed(1)}%</text>
            <text x={x(i)} y={T - 14} textAnchor="middle" className={r.isFarAboveEnrollmentLine ? 'pfd-times-high' : 'pfd-axis-strong'}>{r.enrollmentLineIsKnown ? `${timesText(r.timesEnrollmentLine)}×` : '—'}</text>
            <text x={x(i)} y={H - B + 18} textAnchor="middle" className={on ? 'pfd-axis-on' : 'pfd-axis-strong'}>{r.year}</text>
          </g>
        );
      })}
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
