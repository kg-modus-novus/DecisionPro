import { useMemo } from 'react';
import { count, BillingCode } from './fraudFormat.jsx';
import { Legend, Swatch, shortMoney, EXPLANATION_KIND_LABELS, EXPLANATION_TAG_LABELS, POLICY_TIMING_LABELS } from './fraudVisuals.jsx';
import { changeStartSentence, explanationTagSentence, policyDate } from './PolicyLedger.jsx';
import {
  CardHead, KeyValue, NotAvailable, OversightPicker, Pill, chooseStateCode, fewerThan, latestServiceYearId, monthLabel, stateName,
} from './oversightShared.jsx';

/**
 * Explanation ledger: before a rise is called unexplained, look for what would explain it.
 * Paid per year for one flagged state and service with every dated public event on file that
 * covers it, the first monthly alert, the signal review's verdict and what was searched, and
 * across the radar how many of the latest year's flags are explained, unexplained so far, or
 * not yet searched. The matching and the verdict are the signal review's.
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SPLIT = Object.freeze([
  { key: 'not-yet-searched', label: 'not yet searched', color: '#41485a' },
  { key: 'explained', label: 'explained', color: '#5fd6a0' },
  { key: 'unexplained-so-far', label: 'unexplained so far', color: '#ff6b6b' },
]);
/** What an event would do to a rise, by the explanation kind the signal review gave it. */
const EFFECT = Object.freeze({
  restriction: { word: 'lowers', tone: 'grn', ring: '#5fd6a0' },
  'policy-opening': { word: 'raises', tone: 'red', ring: '#ff8f8f' },
  'intended-growth': { word: 'may explain', tone: 'amb', ring: '#f5c451' },
  'measurement-artifact': { word: 'explains', tone: 'blu', ring: '#8ecbff' },
  context: { word: 'context', tone: 'gry', ring: '#b9a7ff' },
});
const SPLIT_TONE = Object.freeze({ explained: 'grn', 'unexplained-so-far': 'red', 'not-yet-searched': 'gry' });
const TAG_TONE = Object.freeze({
  explained: 'grn', 'known-case': 'red', 'safeguard-relaxed': 'red', 'may-explain': 'amb', 'restriction-or-enforcement': 'gry',
  'none-found': 'red', 'partly-searched': 'amb', 'not-searched': 'gry',
});

/** "2023-07-15" at its stated precision as "Jul 2023" or "2023". */
function eventWhen(event) {
  const d = policyDate(event);
  return d.length === 4 ? d : monthLabel(d);
}

export function ExplanationLedgerPage({ radar, review, oversight: o, byId, focusState, setFocusState, focusId, setFocusId, openCase }) {
  const keys = useMemo(() => Object.keys(o.ExplanationLedgers), [o]);
  const states = useMemo(() => [...new Set(keys.map((k) => k.split('|')[0]))].sort((a, b) => stateName(a).localeCompare(stateName(b))), [keys]);
  const k = chooseStateCode({ keys, oversight: o, byId, focusState, focusId });
  const options = useMemo(() => keys.filter((x) => x.startsWith(`${focusState}|`)).map((x) => {
    const l = o.ExplanationLedgers[x];
    const s = byId.get(l.latestServiceYearId);
    return { key: x, text: `${s.codeLabel} (${s.hcpcs}) · ${EXPLANATION_TAG_LABELS[l.verdictTag] ?? l.verdictTag} · ${l.events.length} event${l.events.length === 1 ? '' : 's'}`, events: l.events.length, score: s.score };
  }).sort((a, b) => b.events - a.events || b.score - a.score), [keys, focusState, o, byId]);
  const l = k ? o.ExplanationLedgers[k] : null;
  const s = l ? byId.get(l.latestServiceYearId) : null;
  const e = k ? o.EarlyWarnings[k] : null;
  const rows = useMemo(() => {
    if (!l) return [];
    const list = l.events.map((m, i) => ({ kind: 'event', letter: LETTERS[i] ?? '·', date: m.event.effectiveDate, m }));
    if (e?.firstAlertMonth) list.push({ kind: 'alert', letter: '!', date: `${e.firstAlertMonth}-01` });
    return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [l, e]);

  return (
    <div className="pfd-page" data-oversight-page="ledger">
      <h1>{s ? <>Explanation ledger · {stateName(s.state)} · {s.codeLabel} (<BillingCode code={s.hcpcs} plain />)</> : 'Explanation ledger'}</h1>
      <p className="pfd-sub">
        Before a rise is called unexplained, look for what would explain it: a rate change, a new benefit, a waiver, a budget action, an enforcement elsewhere.
        Every candidate carries its ledger, so an explained rise is closed quickly and an <b>unexplained</b> one is what remains.
      </p>
      <OversightPicker
        oversight={o}
        states={states}
        focusState={focusState}
        onState={(st) => { setFocusState(st); setFocusId(null); }}
        options={options}
        selected={k}
        onSelect={(x) => setFocusId(latestServiceYearId(o, x))}
      />
      {l && s ? (
        <>
          <div className="pfd-card" data-ledger-chart>
            <CardHead title="Paid per year with dated events" note="payments real · events confirmed by a person from public documents" />
            <LedgerChart review={review} radar={radar} o={o} k={k} rows={rows} />
          </div>
          <div className="pfd-row pfo-gap">
            <div className="pfd-card pfd-grow" data-ledger-events>
              <CardHead title="Events on the ledger" note={`${l.events.length} on file`} />
              {rows.length ? (
                <div className="pfd-table-wrap">
                  <table className="pfd-table pfo-ledger-table">
                    <thead><tr><th /><th>When</th><th>Event</th><th>Source</th><th className="pfo-effect">Would it explain a rise?</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (r.kind === 'alert' ? (
                        <tr key="alert" data-ledger-row="alert">
                          <td><span className="pfo-letter" style={{ borderColor: '#f5c451', color: '#f5c451' }}>!</span></td>
                          <td className="pfd-nowrap">{monthLabel(e.firstAlertMonth)}</td>
                          <td>Monthly payments: three months at least twice the same months a year earlier (first alert by DecisionPro&apos;s monthly rule)</td>
                          <td className="pfd-note">HHS spending file</td>
                          <td><Pill tone="red">the rise itself</Pill></td>
                        </tr>
                      ) : (
                        <tr key={r.m.event.id} data-ledger-row={r.m.event.id}>
                          <td><span className="pfo-letter" style={{ borderColor: EFFECT[r.m.event.explanationKind]?.ring, color: EFFECT[r.m.event.explanationKind]?.ring }}>{r.letter}</span></td>
                          <td className="pfd-nowrap">{eventWhen(r.m.event)}</td>
                          <td className="pfo-event">{r.m.event.summary}</td>
                          <td className="pfd-note">{r.m.event.source?.url ? <a href={r.m.event.source.url} target="_blank" rel="noopener noreferrer">{r.m.event.source.publisher}</a> : r.m.event.source?.publisher}</td>
                          <td>
                            <Pill tone={EFFECT[r.m.event.explanationKind]?.tone ?? 'gry'}>{EFFECT[r.m.event.explanationKind]?.word ?? r.m.event.explanationKind}</Pill>
                            <span className="pfd-note pfo-block">{EXPLANATION_KIND_LABELS[r.m.event.explanationKind] ?? ''}{r.m.timing ? ` · ${POLICY_TIMING_LABELS[r.m.timing] ?? r.m.timing}` : ''}{r.m.countsTowardExplanation ? ' · counted' : ''}</span>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="pfd-note">No dated public event on file covers this service. That says how far the search went, not that nothing exists.</p>}
              <p className="pfd-note">
                A restriction or enforcement act lowers spending and does not explain a rise. A relaxed safeguard raises it and shows where to look; it does not explain the rise away.
                Only a confirmed billing-code or reporting change explains a rise.{' '}
                <button type="button" className="pfd-link" onClick={() => openCase(s.id)}>Open the case file</button>
              </p>
            </div>
            <div className="pfd-col-right">
              <div className="pfd-card" data-ledger-verdict>
                <CardHead title={`Where the search stands on the ${l.changeStartIsKnown ? `${l.changeStartYear} ` : ''}${s.collapseOnly ? 'fall' : 'rise'}`} note="from the law-and-policy search on file" />
                <div className="pfo-verdict" data-verdict={l.verdictSplit}>
                  <Pill tone={SPLIT_TONE[l.verdictSplit] ?? 'gry'}>{String(SPLIT.find((x) => x.key === l.verdictSplit)?.label ?? l.verdictSplit).toUpperCase()}</Pill>
                  <Pill tone={TAG_TONE[l.verdictTag] ?? 'gry'}>{EXPLANATION_TAG_LABELS[l.verdictTag] ?? l.verdictTag}</Pill>
                </div>
                <p className="pfo-lead">{explanationTagSentence(s)} {changeStartSentence(s)}</p>
                <KeyValue k="Law, policy, rate and enforcement events searched">
                  {l.searchCoverage
                    ? <Pill tone={l.searchCoverage.fullSearches ? 'grn' : 'amb'}>{l.searchCoverage.fullSearches ? `${l.searchCoverage.fullSearches} full` : `${l.searchCoverage.searches} partial`}, through {monthLabel(l.searchCoverage.searchedThrough)}</Pill>
                    : <Pill>not searched</Pill>}
                </KeyValue>
                <KeyValue k="Health need (prevalence, overdose deaths)"><Pill tone="amb">not yet loaded</Pill></KeyValue>
              </div>
              <div className="pfd-card" data-agency-response>
                <CardHead title="Agency response" note="not available yet" />
                <p className="pfo-lead">The Medicaid agency can attach its explanation and it shows beside the figure, wherever the figure appears.</p>
                <NotAvailable>No response attached yet. Responses need the agency&apos;s sign-in, which is not built.</NotAvailable>
              </div>
              <RadarSplit o={o} latest={review.LatestYear} />
            </div>
          </div>
        </>
      ) : (
        <div className="pfd-card"><p>{stateName(focusState)} has no flagged service.</p></div>
      )}
    </div>
  );
}

function RadarSplit({ o, latest }) {
  const total = Object.values(o.LedgerSplit).reduce((a, v) => a + v, 0) || 1;
  return (
    <div className="pfd-card" data-ledger-split>
      <CardHead title="Across the radar" note={`${latest} flags · real counts`} />
      <div className="pfo-split" role="img" aria-label={SPLIT.map((x) => `${x.label} ${o.LedgerSplit[x.key]}`).join(', ')}>
        {SPLIT.map((x) => <i key={x.key} style={{ width: `${(o.LedgerSplit[x.key] / total) * 100}%`, background: x.color }} />)}
      </div>
      <Legend>{SPLIT.map((x) => <Swatch key={x.key} color={x.color} label={`${x.label} ${count(o.LedgerSplit[x.key])}`} />)}</Legend>
      <p className="pfd-note">Unexplained so far means a search reached the state and nothing found explains the flag; most states are not searched yet.</p>
    </div>
  );
}

/** Yearly bars (blow-up years red) through the publication year, with the ledger's events placed by date. */
function LedgerChart({ review, radar, o, k, rows }) {
  const series = review.YearlySeriesByStateCode[k] ?? [];
  const years = o.ServiceYearsByStateCode.get(k) ?? [];
  const blowups = new Set(years.filter((x) => x.isBlowup).map((x) => x.year));
  const firstYear = series[0]?.year ?? review.Years[0];
  const lastDataYear = series[series.length - 1]?.year ?? review.LatestYear;
  const lastEventYear = Math.max(...rows.map((r) => Number(r.date.slice(0, 4))), 0);
  const lastYear = Math.max(lastDataYear, Number(String(radar.asOf).slice(0, 4)) || 0, lastEventYear);
  const allYears = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  const W = 980;
  const H = 240;
  const left = 50;
  const right = W - 12;
  const top = 26;
  const bottom = 160;
  const step = (right - left) / allYears.length;
  const bw = step * 0.62;
  // Years paid to fewer billers than the small-cell minimum show no dollars, and do not set the scale.
  const isWithheld = (r) => r.paidIsWithheld;
  const max = Math.max(...series.filter((r) => !isWithheld(r)).map((r) => r.statePaid), 1);
  const h = (v) => (v / max) * (bottom - top);
  const xOfDate = (d) => {
    const yy = Number(d.slice(0, 4));
    const mm = Number(d.slice(5, 7) || 7) - 1;
    return left + (yy - firstYear) * step + (mm / 12) * step;
  };
  const placed = [];
  const markers = rows.map((r) => {
    const x = Math.min(right - 8, Math.max(left + 8, xOfDate(r.date)));
    let level = 0;
    while (placed.some((p) => p.level === level && Math.abs(p.x - x) < 22)) level += 1;
    placed.push({ x, level });
    return { r, x, y: bottom + 22 + level * 24 };
  });
  return (
    <>
      <Legend>
        <Swatch color="#5db4ff" label="paid in the year" />
        <Swatch color="#ff6b6b" label="a year the screen flagged as a blow-up" />
        <Swatch kind="outline" color="#4e5564" label="not in public data yet" />
      </Legend>
      <svg className="pfo-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Paid per year with dated events">
        <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#303442" />
        {allYears.map((y, i) => {
          const row = series.find((r) => r.year === y);
          const x = left + i * step + (step - bw) / 2;
          return (
            <g key={y}>
              <line x1={left + i * step} x2={left + i * step} y1={top} y2={H - 18} stroke="#1a1d29" />
              {row && isWithheld(row) ? (
                <>
                  <rect x={x} y={bottom - 14} width={bw} height={14} fill="none" stroke="#6e778d" strokeDasharray="2 2" data-ledger-year={y} data-withheld="true" />
                  <text x={x + bw / 2} y={bottom - 19} textAnchor="middle" fontSize="10" fill="#aaa38d">{fewerThan(o.SmallCellMinimum)} billers</text>
                </>
              ) : row ? (
                <>
                  <rect x={x} y={bottom - Math.max(2, h(row.statePaid))} width={bw} height={Math.max(2, h(row.statePaid))} fill={blowups.has(y) ? '#ff6b6b' : '#5db4ff'} data-ledger-year={y} />
                  <text x={x + bw / 2} y={bottom - Math.max(2, h(row.statePaid)) - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#f3efe2">{shortMoney(row.statePaid)}</text>
                </>
              ) : y > lastDataYear ? (
                <>
                  <rect x={x} y={bottom - 50} width={bw} height={50} fill="url(#pfo-hatch)" stroke="#4e5564" strokeDasharray="3 2" />
                  <text x={x + bw / 2} y={bottom - 56} textAnchor="middle" fontSize="10" fill="#aaa38d">not in public data</text>
                </>
              ) : null}
              <text x={left + i * step + 6} y={H - 4} fontSize="12" fontWeight="600" fill="#d2cdbe">{y}</text>
            </g>
          );
        })}
        <defs>
          <pattern id="pfo-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#303442" strokeWidth="3" />
          </pattern>
        </defs>
        {markers.map(({ r, x, y }) => {
          const ring = r.kind === 'alert' ? '#f5c451' : (EFFECT[r.m.event.explanationKind]?.ring ?? '#b9a7ff');
          return (
            <g key={r.kind === 'alert' ? 'alert' : r.m.event.id}>
              <line x1={x} x2={x} y1={bottom} y2={y - 10} stroke={ring} strokeOpacity=".5" />
              <circle cx={x} cy={y} r="10" fill="#0e1118" stroke={ring} strokeWidth="1.6" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={ring}>{r.letter}</text>
              <title>{r.kind === 'alert' ? 'First monthly alert' : `${eventWhen(r.m.event)}: ${r.m.event.summary}`}</title>
            </g>
          );
        })}
      </svg>
    </>
  );
}
