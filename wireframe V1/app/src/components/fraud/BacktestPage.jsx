import { BACKTEST_SERVICE_TITLES, KNOWN_CASE_ENFORCEMENT_YEARS, STATE_NAMES } from '../../data/potentialFraudCatalog.js';
import { TIER_COLORS, tierShortLabel } from './fraudVisuals.jsx';

/**
 * Backtests and known cases: one small chart per known fraud case (the state's
 * share of US payments for the code by year, with the case-years the radar
 * flagged), and the innocent billing conventions as bars of the most states
 * that billed the code against the ten-state filter. Every verdict, count and
 * threshold comes from the screen run through the radar export; this page only
 * groups and draws them.
 */

const W = 220;
const H = 112;
const L = 28;
const R = 10;
const T = 14;
const B = 20;
const MISSED = '#E24B4A';
const FLAGGED = '#4ea1f0';
const SET_ASIDE = '#639922';

/**
 * A known case-year's point: the export's verdict decides flagged or missed; a
 * flagged case-year shows its scored row's suggested tier and score when there is
 * one (CLOSED carries no score).
 */
export function caseYearPoint(b, s) {
  if (!b.detected) return { label: 'MISSED', tierKey: '', filled: false };
  if (!s) return { label: 'FLAGGED', tierKey: '', filled: true };
  return { label: `${tierShortLabel(s.tier)}${s.tier.key === 'closed' ? '' : ` ${s.score}`}`, tierKey: s.tier.key, filled: true };
}

/**
 * The export's backtest entries grouped for the page: one card per state and
 * code with an expected detection (most recent first case-year first), and
 * the expected non-detections (the conventions) in export order.
 */
export function groupKnownCases(backtest) {
  const cards = new Map();
  const conventions = [];
  for (const b of backtest) {
    if (b.expected !== 'detected') { conventions.push(b); continue; }
    const key = `${b.state_code}|${b.hcpcs}`;
    if (!cards.has(key)) cards.set(key, { key, state: b.state_code, hcpcs: b.hcpcs, cases: [] });
    cards.get(key).cases.push(b);
  }
  const ordered = [...cards.values()].map((c) => {
    const years = c.cases.map((b) => b.year);
    return { ...c, passed: c.cases.filter((b) => b.ok).length, firstYear: Math.min(...years), lastYear: Math.max(...years) };
  });
  ordered.sort((a, b) => (b.firstYear - a.firstYear) || (b.lastYear - a.lastYear));
  return { cards: ordered, conventions };
}

function caseTitle(state, hcpcs) {
  return `${STATE_NAMES[state] ?? state} · ${BACKTEST_SERVICE_TITLES[hcpcs] ?? hcpcs} ${hcpcs}`;
}

function PassChip({ passed, total, suffix = '' }) {
  return <span className={`pfd-bt-chip ${passed === total ? 'is-pass' : 'is-fail'}`}>{passed} / {total}{suffix}</span>;
}

function CaseChart({ card, series, byId, openCase }) {
  const years = series.map((y) => y.year);
  const top = Math.max(80, ...series.map((y) => Math.ceil((y.share * 100) / 40) * 40));
  const x = (i) => L + i * ((W - L - R) / Math.max(1, years.length - 1));
  const y = (v) => H - B - (v / top) * (H - T - B);
  const enforcement = KNOWN_CASE_ENFORCEMENT_YEARS[card.key];
  const grid = [0, top / 2, top];
  const ticks = years.length > 2 ? [0, Math.floor((years.length - 1) / 2), years.length - 1] : years.map((_, i) => i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${caseTitle(card.state, card.hcpcs)}: share of US payments by year`}>
      {grid.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="pfd-bt-grid" />
          <text x={L - 4} y={y(v) + 3.5} textAnchor="end" className="pfd-bt-axis">{v}%</text>
        </g>
      ))}
      {enforcement && years.includes(enforcement) ? (
        <line x1={x(years.indexOf(enforcement))} x2={x(years.indexOf(enforcement))} y1={T} y2={H - B} className="pfd-bt-enforce" data-enforcement={enforcement} />
      ) : null}
      <polyline points={series.map((s, i) => `${x(i)},${y(s.share * 100)}`).join(' ')} className="pfd-bt-line" />
      {card.cases.map((b) => {
        const i = years.indexOf(b.year);
        if (i < 0) return null;
        const s = byId.get(`${b.state_code}|${b.hcpcs}|${b.year}`);
        const cy = y(series[i].share * 100);
        const point = caseYearPoint(b, s);
        const label = point.label;
        const flagged = point.filled;
        const color = point.tierKey ? TIER_COLORS[point.tierKey] : (flagged ? FLAGGED : MISSED);
        const anchor = i >= years.length - 2 ? 'end' : 'middle';
        return (
          <g
            key={b.id}
            className={s ? 'pfd-bt-dot pfd-click' : 'pfd-bt-dot'}
            data-case={b.id}
            role={s ? 'button' : undefined}
            tabIndex={s ? 0 : undefined}
            onClick={() => s && openCase(s.id)}
            onKeyDown={(e) => { if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCase(s.id); } }}
          >
            <title>{`${b.year}: ${label}. ${b.note}`}</title>
            <circle cx={x(i)} cy={cy} r="4.5" fill={flagged ? color : 'none'} stroke={color} strokeWidth={flagged ? 0 : 1.5} />
            <text x={x(i)} y={cy - 8} textAnchor={anchor} className="pfd-bt-label">{label}</text>
          </g>
        );
      })}
      {ticks.map((i) => <text key={i} x={x(i)} y={H - 5} textAnchor="middle" className="pfd-bt-axis">{years[i]}</text>)}
    </svg>
  );
}

export function BacktestPage({ radar, review, byId, openCase }) {
  const { cards, conventions } = groupKnownCases(radar.backtest);
  const passed = radar.backtest.filter((b) => b.ok).length;
  const total = radar.backtest.length;
  const caseYears = cards.reduce((n, c) => n + c.cases.length, 0);
  const caught = cards.reduce((n, c) => n + c.passed, 0);
  const setAside = conventions.filter((b) => b.ok).length;
  const jurisdictions = Object.keys(STATE_NAMES).length;
  const filter = radar.minimumStatesBilling;
  const ran = String(radar.screenRun.completedAt).slice(0, 10);
  return (
    <div className="pfd-page">
      <h1>Backtests &amp; known cases</h1>
      <p className="pfd-sub">
        Before the radar is trusted on new candidates, it must find the cases already known to be fraud and must not flag the billing conventions
        known to be innocent. These are the cases the Empower Oversight screen was checked against; each is re-tested on every scan.
      </p>
      <div className="pfd-bt-head">
        <span data-backtest-headline>
          <b>{passed} of {total} pass.</b>{' '}
          The radar {caught === caseYears ? 'catches' : `catches ${caught} of`} the {caseYears} known fraud case-years and {setAside === conventions.length ? 'leaves' : `leaves ${setAside} of`} the {conventions.length} innocent conventions alone.
        </span>
        <span className="pfd-muted">Rerun on every scan · {ran}</span>
      </div>
      <div className="pfd-bt-cases">
        {cards.map((c) => {
          const series = review.YearlySeriesByStateCode[c.key] ?? [];
          return (
            <div key={c.key} className="pfd-card pfd-bt-case" data-backtest-card={c.key}>
              <div className="pfd-bt-case-top">
                <span>{caseTitle(c.state, c.hcpcs)}</span>
                <PassChip passed={c.passed} total={c.cases.length} />
              </div>
              {series.length ? <CaseChart card={c} series={series} byId={byId} openCase={openCase} /> : <p className="pfd-note">No yearly series for this state and code in the export.</p>}
            </div>
          );
        })}
      </div>
      <div className="pfd-bt-legend">
        <span><i className="pfd-bt-key-dot" /> flagged by the radar (tier and score; click to open the case)</span>
        <span><i className="pfd-bt-key-dash" /> enforcement</span>
        <span>Line = the state&apos;s share of all US payments for the code</span>
      </div>
      <div className="pfd-card pfd-bt-conv" data-backtest-conventions>
        <div className="pfd-bt-case-top">
          <span>Innocent conventions: must not be flagged</span>
          <PassChip passed={setAside} total={conventions.length} suffix=" set aside" />
        </div>
        {conventions.map((b) => (
          <div key={b.id} className="pfd-bt-conv-row" data-convention={b.id} title={b.note}>
            <span className="pfd-bt-conv-name">{caseTitle(b.state_code, b.hcpcs)}</span>
            <span className="pfd-bt-conv-bar">
              <i style={{ width: `${(Math.min(b.mostStatesBilling, jurisdictions) / jurisdictions) * 100}%`, background: b.ok ? SET_ASIDE : MISSED }} />
              <i className="pfd-bt-conv-mark" style={{ left: `${(filter / jurisdictions) * 100}%` }} />
            </span>
            <span className="pfd-bt-conv-count">billed in {b.mostStatesBilling} states{b.ok ? '' : ' · FLAGGED'}</span>
          </div>
        ))}
        <p className="pfd-note">
          The mark is the {filter}-state filter: a code billed in fewer states cannot be compared fairly across states, so the screen sets it aside.
          A state bills a code when it was paid at least ${radar.stateBillingThreshold.toLocaleString('en-US')} on it in a year; the bar shows the most states in any year, out of {jurisdictions}.
        </p>
      </div>
      <p className="pfd-note">A known case is flagged when its state, service and year is a screen candidate. Screen run {ran} on T-MSIS v{radar.asOf}.</p>
    </div>
  );
}
