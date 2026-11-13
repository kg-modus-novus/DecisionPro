import { STATE_NAMES } from '../../data/potentialFraudCatalog.js';
import { money } from './fraudFormat.jsx';
import { shortMoney, StateTileMap } from './fraudVisuals.jsx';

/**
 * Building blocks shared by the five oversight pages of Potential Fraud Detection (early
 * warning, follow the billers, provider patterns, explanation ledger, state oversight brief).
 * Presentation only: every figure comes from the OversightReview and signal review outputs.
 * A figure for fewer than the export's small-cell minimum of billers arrives as null and shows
 * as "fewer than N" (counts, N the program's SmallCellMinimum) or "withheld" (dollars).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2023-07" (or "2023-07-15") as "Jul 2023". */
export function monthLabel(ym) {
  if (!ym) return '';
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

/** "2023-07" as "Jul". */
export function monthShort(ym) {
  return MONTHS[Number(ym.slice(5, 7)) - 1];
}

export function stateName(state) {
  return STATE_NAMES[state] ?? state;
}

/** The small-cell words for a withheld count ("fewer than 11"); `minimum` is the program's SmallCellMinimum. */
export function fewerThan(minimum) {
  return `fewer than ${minimum}`;
}

/** A count, or the small-cell words when it is withheld. */
export function countOrWithheld(v, minimum) {
  return v === null || v === undefined ? fewerThan(minimum) : Math.round(v).toLocaleString('en-US');
}

/** Dollars, or "withheld" when the figure is withheld. */
export function moneyOrWithheld(v, digits = 1) {
  return v === null || v === undefined ? 'withheld' : money(v, digits);
}

/** A share as a whole percent, "under 1%" below one percent. */
export function wholePct(v) {
  if (v === null || v === undefined) return '—';
  if (v > 0 && v < 0.01) return 'under 1%';
  return `${Math.round(v * 100)}%`;
}

/** Signed percent change ("−90%", "+12%"). */
export function signedPct(v) {
  if (v === null || v === undefined) return '—';
  const n = Math.round(v * 100);
  return `${n < 0 ? '−' : '+'}${Math.abs(n)}%`;
}

export function Pill({ tone = 'gry', children, title }) {
  return <span className={`pfo-pill pfo-pill-${tone}`} title={title}>{children}</span>;
}

export function Tile({ n, small, label, detail, tone, data, path = false }) {
  return (
    <div className="pfo-tile" data-tile={data}>
      <div className={`pfo-tile-n${tone ? ` pfo-tone-${tone}` : ''}${path ? ' pfo-tile-path' : ''}`}>{n}{small ? <small> {small}</small> : null}</div>
      <div className="pfo-tile-l">{label}</div>
      {detail ? <div className="pfo-tile-d">{detail}</div> : null}
    </div>
  );
}

export function KeyValue({ k, children }) {
  return <div className="pfo-kv"><span>{k}</span><b>{children}</b></div>;
}

export function CardHead({ title, note }) {
  return <h3 className="pfo-h3"><span>{title}</span>{note ? <em>{note}</em> : null}</h3>;
}

/**
 * The views a page could show. Only the public view is built; the others are listed with what
 * they would need and cannot be picked.
 */
export function ViewToggle({ views }) {
  return (
    <div className="pfo-toggle" role="group" aria-label="Views">
      {views.map((v) => (
        <button key={v.label} type="button" className={v.on ? 'is-on' : ''} disabled={!v.on} aria-pressed={Boolean(v.on)} title={v.on ? undefined : `Not available: ${v.needs}`} data-view={v.label}>
          {v.label}{v.on ? null : <small> · not available</small>}
        </button>
      ))}
    </div>
  );
}

/** A dashed box for something the page would show once a party supplies it. */
export function NotAvailable({ children }) {
  return <div className="pfo-dashed" data-not-available>{children}</div>;
}

/**
 * The state-code an oversight page shows: the focused service when it is in the focused state and
 * the page has it, else the state's option with the highest signal score in its latest year.
 */
export function chooseStateCode({ keys, oversight, byId, focusState, focusId }) {
  const focused = focusId ? byId.get(focusId) : null;
  const inState = keys.filter((k) => k.startsWith(`${focusState}|`));
  if (focused && focused.state === focusState) {
    const k = `${focused.state}|${focused.hcpcs}`;
    if (inState.includes(k)) return k;
  }
  const scoreOf = (k) => {
    const years = oversight.ServiceYearsByStateCode.get(k) ?? [];
    return years[years.length - 1]?.score ?? -1;
  };
  return [...inState].sort((a, b) => scoreOf(b) - scoreOf(a) || a.localeCompare(b))[0] ?? '';
}

/** The latest service-year id of a state-code, for focusing and opening it elsewhere in the module. */
export function latestServiceYearId(oversight, k) {
  const years = oversight.ServiceYearsByStateCode.get(k) ?? [];
  return years[years.length - 1]?.id ?? null;
}

/** The heat ramp for a signal score (0-100): the cut points and their fill and text colors, coolest first. */
const SCORE_CUTS = [25, 40, 55, 70];
const SCORE_RAMP = [['#212636', '#bcd2ec'], ['#F5C4B3', '#4A1B0C'], ['#F0997B', '#4A1B0C'], ['#D85A30', '#FAECE7'], ['#993C1D', '#FAECE7']];
const scoreColors = (score) => SCORE_RAMP[SCORE_CUTS.filter((c) => score >= c).length];

/** The signal score of a state-code's latest service-year (-1 when the review has none). */
function latestScore(oversight, k) {
  const years = oversight.ServiceYearsByStateCode.get(k) ?? [];
  return years[years.length - 1]?.score ?? -1;
}

/** Each state's highest latest-year signal score, worked out once per state-code index (the pages share one). */
const STATE_SCORES = new WeakMap();
function stateScores(oversight) {
  const index = oversight.ServiceYearsByStateCode;
  if (!STATE_SCORES.has(index)) {
    const best = new Map();
    for (const k of index.keys()) {
      const st = k.slice(0, k.indexOf('|'));
      best.set(st, Math.max(best.get(st) ?? -1, latestScore(oversight, k)));
    }
    STATE_SCORES.set(index, best);
  }
  return STATE_SCORES.get(index);
}

/**
 * The page's selectors, as two small heat maps: a state tile map on the left (the states that have
 * any of the page's services, each tinted by the highest signal score among its flagged services'
 * latest years) and the focused state's services on the right (one tile per service, tinted by its
 * latest signal score). `options` are the focused state's choices ({ key: 'ST|code', text, mark? })
 * in the page's own order; `states` the states that have any. Presentation only: the scores are the
 * signal review's.
 */
export function OversightPicker({ oversight, states, focusState, onState, options, selected, onSelect, serviceLabel = 'Service', markLabel = '', children }) {
  const scores = stateScores(oversight);
  const stateScore = (st) => scores.get(st) ?? -1;
  const enabled = (st) => states.includes(st) || st === focusState;
  const tileStyle = (st) => {
    if (!enabled(st)) return null;
    const score = stateScore(st);
    if (score < 0) return null;
    const [background, color] = scoreColors(score);
    return { background, color };
  };
  const chosen = options?.find((x) => x.key === selected);
  return (
    <div className="pfd-card pfo-picker pfo-heatpicker" data-oversight-picker>
      <div className="pfo-heatpicker-states">
        <div className="pfd-picker-label">State · <span className="pfd-muted">tint: highest signal score</span></div>
        <StateTileMap
          size="mini"
          label="Pick a state"
          selected={focusState}
          onSelect={onState}
          isEnabled={enabled}
          tileStyle={tileStyle}
          tileTitle={(st) => (enabled(st) ? `${stateName(st)}${stateScore(st) >= 0 ? ` · highest signal score ${stateScore(st)}` : ''}` : `${stateName(st)}: none on this page`)}
        />
        <div className="pfo-heat-legend" aria-hidden="true">
          {SCORE_RAMP.map(([bg], i) => <span key={bg}><i style={{ background: bg }} />{i === 0 ? `<${SCORE_CUTS[0]}` : `${SCORE_CUTS[i - 1]}+`}</span>)}
        </div>
      </div>
      {options ? (
        <div className="pfo-heatpicker-services" data-oversight-services>
          <div className="pfd-picker-label">{serviceLabel} in {stateName(focusState)} · <span className="pfd-muted">tint: latest signal score{markLabel && options.some((x) => x.mark) ? ` · ${markLabel}` : ''}</span></div>
          {options.length === 0 ? <p className="pfd-note">None in {stateName(focusState)}.</p> : (
            <div className="pfo-heat-svcgrid" role="group" aria-label={`${serviceLabel} in ${stateName(focusState)}`}>
              {options.map((x) => {
                const score = latestScore(oversight, x.key);
                const [background, color] = scoreColors(Math.max(score, 0));
                const code = x.key.split('|')[1];
                return (
                  <button
                    type="button"
                    key={x.key}
                    className={`pfo-heat-svc${x.key === selected ? ' is-on' : ''}`}
                    style={{ background, color }}
                    title={`${x.text}${score >= 0 ? ` · signal score ${score}` : ''}`}
                    aria-label={x.text}
                    aria-pressed={x.key === selected}
                    onClick={() => onSelect(x.key)}
                    data-oversight-service={x.key}
                  >
                    <span>{code}{x.mark ? <em>{x.mark}</em> : null}</span>
                    {score >= 0 ? <small>{score}</small> : null}
                  </button>
                );
              })}
            </div>
          )}
          {chosen ? <p className="pfo-heat-chosen" data-oversight-chosen>{chosen.text}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Small yearly bars (a sparkline as columns); the last bar is drawn brighter. Null values draw no bar. */
export function MiniBars({ values, width = 84, height = 22, color = '#5db4ff', label }) {
  const known = values.filter((v) => v !== null && v !== undefined);
  const max = Math.max(...known, 0) || 1;
  const step = width / Math.max(1, values.length);
  return (
    <svg className="pfo-minibars" width={width} height={height} role="img" aria-label={label}>
      {values.map((v, i) => {
        if (v === null || v === undefined) return <rect key={i} x={i * step + 1} y={height - 1} width={step - 2} height="1" fill="#303442" />;
        const h = Math.max(1, (v / max) * (height - 2));
        return <rect key={i} x={i * step + 1} y={height - h} width={step - 2} height={h} rx="1" fill={i === values.length - 1 ? '#f4f0e3' : color} />;
      })}
    </svg>
  );
}

/** A "nice" axis step for a maximum over `ticks` ticks. */
export function niceStep(max, ticks = 4) {
  const raw = Math.max(max, 1) / ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = [1, 2, 2.5, 5, 10].find((x) => x * p >= raw) ?? 10;
  return m * p;
}

/** Yearly bars with a dollar label over each bar; used by the service tiles and the national chart. */
export function YearBars({ rows, width = 220, height = 110, colorOf, label }) {
  const max = Math.max(...rows.map((r) => r.value ?? 0), 0) || 1;
  const bottom = height - 16;
  const step = width / Math.max(1, rows.length);
  const bw = step * 0.78;
  return (
    <svg className="pfo-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <line x1="0" x2={width} y1={bottom} y2={bottom} stroke="#252936" />
      {rows.map((r, i) => {
        const x = i * step + (step - bw) / 2;
        const h = r.value === null || r.value === undefined ? 0 : Math.max(1, (r.value / max) * (bottom - 14));
        return (
          <g key={r.year}>
            {r.value === null || r.value === undefined
              ? <text x={x + bw / 2} y={bottom - 3} textAnchor="middle" fontSize="8.5" fill="#6e778d">w/h</text>
              : <rect x={x} y={bottom - h} width={bw} height={h} rx="1.5" fill={colorOf ? colorOf(r) : '#5db4ff'} />}
            {r.value !== null && r.value !== undefined ? <text x={x + bw / 2} y={bottom - h - 3} textAnchor="middle" fontSize="9" fill="#f1eddf">{shortMoney(r.value)}</text> : null}
            <text x={x + bw / 2} y={height - 3} textAnchor="middle" fontSize="9" fill="#aaa38d">&apos;{String(r.year).slice(2)}</text>
          </g>
        );
      })}
    </svg>
  );
}
