import { STATE_NAMES, STATE_TILES } from '../../data/potentialFraudCatalog.js';

/**
 * Visual building blocks shared by the Potential Fraud Detection pages: the
 * one-click state tile map, legend swatches and small inline bars. Presentation
 * only; every figure they show comes from the program containers' outputs.
 */

/**
 * A tile map of the states. `tileStyle(state)` returns { background, color } or
 * null for an untinted tile; `isEnabled(state)` decides whether a tile can be
 * picked; `tileTitle(state)` is its hover text; `tileText(state)` is an optional
 * second line (for example dollars); `tileMark(state)` is an optional mark after the code (for example ●).
 */
export function StateTileMap({ selected, onSelect, tileStyle, isEnabled = () => true, tileTitle, tileText, tileMark, label, size = 'small' }) {
  return (
    <div className={`pfd-tilemap pfd-tilemap-${size}`} role="group" aria-label={label}>
      {Object.entries(STATE_TILES).map(([state, [r, c]]) => {
        const enabled = isEnabled(state);
        const style = tileStyle(state);
        const extra = tileText ? tileText(state) : '';
        const mark = tileMark ? tileMark(state) : '';
        return (
          <button
            type="button"
            key={state}
            className={`pfd-tm-tile${state === selected ? ' is-on' : ''}${style ? '' : ' is-blank'}`}
            style={{ gridRow: r + 1, gridColumn: c + 1, ...(style ?? {}) }}
            disabled={!enabled}
            title={tileTitle ? tileTitle(state) : STATE_NAMES[state]}
            aria-pressed={state === selected}
            aria-label={tileTitle ? tileTitle(state) : STATE_NAMES[state]}
            onClick={() => onSelect(state)}
            data-state={state}
          >
            <span>{state}{mark ? <em className="pfd-tm-mark">{mark}</em> : null}</span>
            {extra ? <small>{extra}</small> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A legend entry with a real swatch: fill, outline or dashed line. */
export function Swatch({ kind = 'fill', color, label }) {
  const style = kind === 'fill' ? { background: color }
    : kind === 'outline' ? { background: 'transparent', border: `1px solid ${color}` }
      : { height: 0, borderTop: `2px dashed ${color}`, borderRadius: 0 };
  return <span className="pfd-legend-item"><i className="pfd-swatch" style={style} />{label}</span>;
}

export function Legend({ children }) {
  return <div className="pfd-legend">{children}</div>;
}

/** Compact dollar text for chart labels. */
export function shortMoney(v) {
  const n = Number(v) || 0;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

/** Chart colors shared by the pages (the CSS classes carry the same values). */
export const FRAUD_COLORS = Object.freeze({
  state: '#7cc7ff',
  flag: '#ff6b6b',
  national: '#b4ad98',
  fairShare: '#5ad19a',
});

/** Suggested-tier colors and the order the money bar, legends and panels list them in. */
export const TIER_COLORS = Object.freeze({
  high: '#E24B4A',
  verify: '#EF9F27',
  convention: '#8d887b',
  lookback: '#7F77DD',
  explained: '#5b6a8d',
  low: '#b4b1a9',
  closed: '#1D9E75',
});

export const TIER_DISPLAY_ORDER = Object.freeze(['high', 'verify', 'convention', 'lookback', 'explained', 'low', 'closed']);

/** The words for each explanation tag (Director decisions of 2026-11-11; "known case" is the module's own term). */
export const EXPLANATION_TAG_LABELS = Object.freeze({
  explained: 'EXPLAINED',
  'known-case': 'known case',
  'safeguard-relaxed': 'safeguard relaxed',
  'may-explain': 'may explain',
  'restriction-or-enforcement': 'restriction or enforcement',
  'none-found': 'none found',
  'partly-searched': 'partly searched',
  'not-searched': 'not searched',
});

/** The chip style for each explanation tag. */
export const EXPLANATION_TAG_CLASS = Object.freeze({
  explained: 'pfd-sig-explained',
  'known-case': 'pfd-sig-known',
  'safeguard-relaxed': 'pfd-sig-relaxed',
  'may-explain': 'pfd-sig-may',
  'restriction-or-enforcement': 'pfd-sig-restriction',
  'none-found': 'pfd-sig-muted',
  'partly-searched': 'pfd-sig-muted',
  'not-searched': 'pfd-sig-muted',
});

/** The words for each kind of explanation an event can be. */
export const EXPLANATION_KIND_LABELS = Object.freeze({
  'measurement-artifact': 'measurement change',
  'policy-opening': 'safeguard relaxed',
  'intended-growth': 'intended growth',
  restriction: 'restriction or enforcement',
  context: 'context',
});

/** The words for when an event takes effect, against the year the change starts. */
export const POLICY_TIMING_LABELS = Object.freeze({
  'in-force': 'in force when it began',
  before: 'before it began',
  'same-year': 'same year',
  'after-start': 'after it began',
  'start-unknown': 'start not known',
  later: 'after this year',
});

/** The tier's short label, as TIER_RULE gives it ("LOOK-BACK" for "LOOK-BACK · collapse"). */
export function tierShortLabel(tier) {
  return tier?.shortLabel ?? '';
}

/** Short names for the seven scored signals, in SIGNAL_WEIGHTS order, for the row fingerprint. */
export const SIGNAL_SHORT_LABELS = Object.freeze({
  excessMultiple: 'above enrollment',
  shareSurge: 'share surge',
  tripledAndGrowing: 'tripled',
  persistentExcess: 'persistent',
  newEntrants: 'new billers',
  concentration: 'top-10 concentration',
  displacement: 'displacement',
});

/** Fingerprint cell shade for a signal strength (0 to 1): none, some, most, all. */
export function signalShade(strength) {
  if (strength <= 0) return 'var(--pfd-cell-empty, #1e232f)';
  if (strength < 0.4) return '#F5C4B3';
  if (strength < 0.8) return '#F0997B';
  return '#D85A30';
}

/** A small line of yearly values with a red dot on the marked year. */
export function Sparkline({ points, markYear, label, width = 68, height = 22 }) {
  if (points.length < 2) return <span className="pfd-spark-none" aria-label={label}>—</span>;
  const max = Math.max(...points.map((p) => p.value)) || 1;
  const step = (width - 8) / (points.length - 1);
  const xy = points.map((p, i) => [4 + i * step, height - 2 - (p.value / max) * (height - 6)]);
  const at = points.findIndex((p) => p.year === markYear);
  return (
    <svg className="pfd-spark" width={width} height={height} role="img" aria-label={label}>
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={FRAUD_COLORS.state} strokeWidth="1.5" />
      {at >= 0 ? <circle cx={xy[at][0]} cy={xy[at][1]} r="2.5" fill={FRAUD_COLORS.flag} /> : null}
    </svg>
  );
}

/** A share bar (red) with the enrollment share as a green tick; `full` is the share that fills the bar. */
export function ShareBar({ share, enrollmentShare, full, width = 80 }) {
  const x = (v) => Math.min(width, (v / full) * width);
  return (
    <svg className="pfd-sharebar" width={width + 4} height="14" aria-hidden="true">
      <rect x="0" y="5" width={width} height="4" rx="2" className="pfd-sharebar-track" />
      <rect x="0" y="5" width={Math.max(1, x(share))} height="4" rx="2" fill={FRAUD_COLORS.flag} />
      <line x1={Math.max(1, x(enrollmentShare))} x2={Math.max(1, x(enrollmentShare))} y1="1" y2="13" stroke={FRAUD_COLORS.fairShare} strokeWidth="2" />
    </svg>
  );
}
