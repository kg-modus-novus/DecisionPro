import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { QUADRANT_EXPLAIN, RADAR_EXPLAIN } from '../lib/chartExplains.js';
import { QuadrantPlot } from './QuadrantMap.jsx';
import { RadarPlot } from './RadarChart.jsx';
import { WeightStrip } from './WeightStrip.jsx';

function ExplainBlock({ label, lines }) {
  return (
    <section className="chart-modal-block">
      <h5>{label}</h5>
      <ul>
        {(lines || []).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function ExplainPanel({ explain }) {
  return (
    <div className="chart-modal-explain">
      <ExplainBlock label="What it displays" lines={explain.what} />
      <ExplainBlock label="How to understand it" lines={explain.how} />
      <ExplainBlock label="What you can do with this" lines={explain.use} />
      <ExplainBlock label="What adjusting sliders does" lines={explain.sliders} />
      <ExplainBlock label="Suggested next steps" lines={explain.next} />
    </div>
  );
}

/**
 * 95% viewport modal for Trade-off map / Radar / Split Display.
 * Radar (+ weights) always fit in the viewport; explain copy scrolls separately.
 */
export function ChartMaximizeModal({
  mode,
  onModeChange,
  onClose,
  findings = [],
  radar = {},
  packs = [],
  variant = 'blender',
  weights,
  normalizedWeights,
  onSetWeight,
  onResetWeights,
}) {
  const titleId = useId();
  const canEditWeights = typeof onSetWeight === 'function' && weights && normalizedWeights;
  const showRadar = mode === 'radar' || mode === 'split';
  const showQuadrant = mode === 'quadrant' || mode === 'split';
  const heading =
    mode === 'split'
      ? 'Split display — Trade-off map & blend profile'
      : mode === 'radar'
        ? variant === 'brief'
          ? RADAR_EXPLAIN.title
          : RADAR_EXPLAIN.shortTitle
        : variant === 'brief'
          ? QUADRANT_EXPLAIN.title
          : QUADRANT_EXPLAIN.shortTitle;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="chart-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`chart-modal chart-modal-${mode}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="chart-modal-toolbar">
          <h2 id={titleId}>{heading}</h2>
          <div className="chart-modal-actions">
            <button
              type="button"
              className={mode === 'quadrant' ? 'is-active' : ''}
              onClick={() => onModeChange('quadrant')}
            >
              Trade-off Map
            </button>
            <button
              type="button"
              className={mode === 'radar' ? 'is-active' : ''}
              onClick={() => onModeChange('radar')}
            >
              Radar Chart
            </button>
            <button
              type="button"
              className={mode === 'split' ? 'is-active' : ''}
              onClick={() => onModeChange('split')}
            >
              Split Display
            </button>
            <button type="button" className="chart-modal-close" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="chart-modal-body">
          <div className={`chart-modal-workspace ${mode === 'split' ? 'is-split' : ''}`}>
            {showQuadrant ? (
              <section className="chart-modal-pane" aria-label="Trade-off map">
                {mode === 'split' ? (
                  <h3>{variant === 'brief' ? QUADRANT_EXPLAIN.title : QUADRANT_EXPLAIN.shortTitle}</h3>
                ) : null}
                <div className="chart-modal-plot-wrap">
                  <QuadrantPlot findings={findings} variant={variant} showUnits size={480} />
                </div>
                {mode === 'split' ? (
                  <div className="chart-modal-explain-scroll">
                    <ExplainPanel explain={QUADRANT_EXPLAIN} />
                  </div>
                ) : null}
              </section>
            ) : null}

            {showRadar ? (
              <section className="chart-modal-pane chart-modal-pane-radar" aria-label="Blend profile radar">
                {mode === 'split' ? (
                  <h3>{variant === 'brief' ? RADAR_EXPLAIN.title : RADAR_EXPLAIN.shortTitle}</h3>
                ) : null}
                <div className="chart-modal-plot-wrap">
                  <RadarPlot profile={radar} overlays={packs} variant={variant} showUnits size={480} />
                </div>
                {canEditWeights ? (
                  <div className="chart-modal-weights">
                    <WeightStrip
                      weights={weights}
                      normalizedWeights={normalizedWeights}
                      onSetWeight={onSetWeight}
                      onReset={onResetWeights}
                      compact
                      dense
                    />
                  </div>
                ) : null}
                {mode === 'split' ? (
                  <div className="chart-modal-explain-scroll">
                    <ExplainPanel explain={RADAR_EXPLAIN} />
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          {mode !== 'split' ? (
            <div className="chart-modal-explain-scroll is-footer">
              <ExplainPanel explain={mode === 'radar' ? RADAR_EXPLAIN : QUADRANT_EXPLAIN} />
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
