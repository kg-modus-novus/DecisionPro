import { STATE_NAMES } from '../../data/potentialFraudCatalog.js';
import { money } from './fraudFormat.jsx';
import { shortMoney } from './fraudVisuals.jsx';

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

/**
 * State and service selects. `options` are the focused state's choices ({ key, text }); `states`
 * the states that have any.
 */
export function OversightPicker({ states, focusState, onState, options, selected, onSelect, serviceLabel = 'Service', children }) {
  return (
    <div className="pfd-card pfo-picker" data-oversight-picker>
      <label className="pfd-inline">
        State
        <select value={focusState} onChange={(e) => onState(e.target.value)} data-oversight-state>
          {(states.includes(focusState) ? states : [focusState, ...states]).map((st) => <option key={st} value={st}>{stateName(st)}</option>)}
        </select>
      </label>
      {options ? (
        <label className="pfd-inline pfd-grow">
          {serviceLabel}
          <select value={selected} onChange={(e) => onSelect(e.target.value)} disabled={options.length === 0} data-oversight-service>
            {options.length === 0 ? <option value="">none in {stateName(focusState)}</option> : null}
            {options.map((o) => <option key={o.key} value={o.key}>{o.text}</option>)}
          </select>
        </label>
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
        if (v === null || v === undefined) return <rect key={i} x={i * step + 1} y={height - 1} width={step - 2} height="1" fill="#33496b" />;
        const h = Math.max(1, (v / max) * (height - 2));
        return <rect key={i} x={i * step + 1} y={height - h} width={step - 2} height={h} rx="1" fill={i === values.length - 1 ? '#ffffff' : color} />;
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
      <line x1="0" x2={width} y1={bottom} y2={bottom} stroke="#24395a" />
      {rows.map((r, i) => {
        const x = i * step + (step - bw) / 2;
        const h = r.value === null || r.value === undefined ? 0 : Math.max(1, (r.value / max) * (bottom - 14));
        return (
          <g key={r.year}>
            {r.value === null || r.value === undefined
              ? <text x={x + bw / 2} y={bottom - 3} textAnchor="middle" fontSize="8.5" fill="#6f88a8">w/h</text>
              : <rect x={x} y={bottom - h} width={bw} height={h} rx="1.5" fill={colorOf ? colorOf(r) : '#5db4ff'} />}
            {r.value !== null && r.value !== undefined ? <text x={x + bw / 2} y={bottom - h - 3} textAnchor="middle" fontSize="9" fill="#dbe6f5">{shortMoney(r.value)}</text> : null}
            <text x={x + bw / 2} y={height - 3} textAnchor="middle" fontSize="9" fill="#7f98b8">&apos;{String(r.year).slice(2)}</text>
          </g>
        );
      })}
    </svg>
  );
}
