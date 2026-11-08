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
 * second line (for example dollars).
 */
export function StateTileMap({ selected, onSelect, tileStyle, isEnabled = () => true, tileTitle, tileText, label, size = 'small' }) {
  return (
    <div className={`pfd-tilemap pfd-tilemap-${size}`} role="group" aria-label={label}>
      {Object.entries(STATE_TILES).map(([state, [r, c]]) => {
        const enabled = isEnabled(state);
        const style = tileStyle(state);
        const extra = tileText ? tileText(state) : '';
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
            <span>{state}</span>
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
  national: '#8aa3c2',
  fairShare: '#5ad19a',
});
