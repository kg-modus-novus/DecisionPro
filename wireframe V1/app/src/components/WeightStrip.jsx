import { FOCUS_TABS } from '../data/fixtures.js';

/**
 * Focus-tab weight sliders (blender Results and chart maximize modal).
 */
export function WeightStrip({ weights, normalizedWeights, onSetWeight, onReset, compact, dense }) {
  return (
    <div
      className={`weights ${compact ? 'weights-compact' : ''} ${dense ? 'weights-dense' : ''}`.trim()}
      data-walkthrough-target="blender-weights"
    >
      <h4>{compact ? 'Weights (live)' : 'Adjust your weights'}</h4>
      {!compact && (
        <p className="hint">Visible emphasis — suggestions recalculate as you rebalance.</p>
      )}
      {compact && !dense ? (
        <p className="hint">Sliders update the radar and pack ranking in real time.</p>
      ) : null}
      {FOCUS_TABS.map((tab) => (
        <label key={tab.id} className="weight-row">
          <span>{tab.label}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={weights[tab.id]}
            onChange={(e) => onSetWeight(tab.id, Number(e.target.value))}
          />
          <strong>{Math.round((normalizedWeights[tab.id] || 0) * 100)}%</strong>
        </label>
      ))}
      {typeof onReset === 'function' ? (
        <button type="button" onClick={onReset}>
          Reset to balanced
        </button>
      ) : null}
    </div>
  );
}
