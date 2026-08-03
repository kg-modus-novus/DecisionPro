import { labelOf } from '../../data/alp/dimensions.js';
import { asFilterIds, toggleDimensionFilter } from '../../lib/alpCube.js';

export function ContentChart({ config, series = [], filters, onFilter, viewMode = 'hybrid', onViewMode }) {
  const dim = config.contentDimension;
  const options = config.contentDimensionOptions || [];
  const peak = Math.max(1, ...series.map((s) => s.value));
  const selectedIds = new Set(asFilterIds(filters[dim]));
  const hasSelection = selectedIds.size > 0;
  const chartTitle = config.contentChartLabel || config.metricLabel;

  return (
    <section
      className="alp-content-chart sap-content"
      aria-label="Filtered content chart"
      data-walkthrough-target="alp-content-chart"
    >
      <header className="alp-section-head sap-section-head">
        <div>
          <h3>{chartTitle}</h3>
          <p className="hint">Responds to visual filters · click columns to add or remove</p>
        </div>
        {onViewMode ? (
          <div className="alp-view-toggle" role="group" aria-label="Content view">
            {['chart', 'hybrid', 'table'].map((mode) => (
              <button
                key={mode}
                type="button"
                className={viewMode === mode ? 'on' : ''}
                onClick={() => onViewMode(mode)}
              >
                {mode === 'chart' ? 'Chart' : mode === 'hybrid' ? 'Hybrid' : 'Table'}
              </button>
            ))}
          </div>
        ) : null}
      </header>
      <div className="alp-column-chart sap-column-chart">
        <div className="sap-chart-y" aria-hidden="true">
          <span>{Math.round(peak).toLocaleString()}</span>
          <span>{Math.round(peak / 2).toLocaleString()}</span>
          <span>0</span>
        </div>
        <div className={`sap-chart-plot ${hasSelection ? 'has-selection' : ''}`}>
          {series.map((item) => {
            const isOn = selectedIds.has(item.id);
            const label = labelOf(options, item.id);
            const tip = `${label}: ${Math.round(item.value).toLocaleString()}`;
            return (
              <button
                key={item.id}
                type="button"
                className={`alp-col ${isOn ? 'on' : ''} ${hasSelection && !isOn ? 'dim' : ''}`}
                onClick={() => onFilter(toggleDimensionFilter(filters, dim, item.id))}
                title={tip}
                data-filter-tip={tip}
                aria-label={tip}
                aria-pressed={isOn}
              >
                <span className="alp-col-val">{Math.round(item.value).toLocaleString()}</span>
                <span className="sap-col-track">
                  <span className="alp-col-bar" style={{ height: `${(item.value / peak) * 100}%` }} />
                </span>
                <span className="alp-col-lbl">{label}</span>
              </button>
            );
          })}
          {!series.length && (
            <p className="hint">
              {config.contentEmptyHint || 'No data for current filters.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
