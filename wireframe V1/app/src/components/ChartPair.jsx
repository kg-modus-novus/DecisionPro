import { useState } from 'react';
import { ChartMaximizeModal } from './ChartMaximizeModal.jsx';
import { QuadrantMap } from './QuadrantMap.jsx';
import { RadarChart } from './RadarChart.jsx';

/**
 * Side-by-side quadrant + radar. Enlarge opens a 95% viewport modal with
 * Trade-off Map / Radar Chart / Split Display modes and live weight sliders.
 */
export function ChartPair({
  findings = [],
  radar = {},
  packs = [],
  variant = 'blender',
  className = 'viz-row',
  weights,
  normalizedWeights,
  onSetWeight,
  onResetWeights,
}) {
  const [modalMode, setModalMode] = useState(null);
  const compact = variant === 'brief';

  return (
    <>
      <div className={className}>
        <QuadrantMap
          findings={findings}
          variant={variant}
          compact={compact}
          onEnlarge={() => setModalMode('quadrant')}
        />
        <RadarChart
          profile={radar}
          overlays={packs}
          variant={variant}
          compact={compact}
          onEnlarge={() => setModalMode('radar')}
        />
      </div>
      {modalMode ? (
        <ChartMaximizeModal
          mode={modalMode}
          onModeChange={setModalMode}
          onClose={() => setModalMode(null)}
          findings={findings}
          radar={radar}
          packs={packs}
          variant={variant}
          weights={weights}
          normalizedWeights={normalizedWeights}
          onSetWeight={onSetWeight}
          onResetWeights={onResetWeights}
        />
      ) : null}
    </>
  );
}
