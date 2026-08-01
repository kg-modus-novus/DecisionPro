import { TileInfoButton } from './alp/TileInfoButton.jsx';
import { buildSmartTileExplain } from '../lib/smartTileExplain.js';
import { SmartTileVisual } from '../lib/smartTileVisuals.jsx';

/**
 * Shared smart-tile face: kind, title, visual, short context, CTA + I-button.
 * Outer article (not a button) so the info control is not nested interactively.
 */
export function SmartTile({
  kind,
  title,
  semantic = 'info',
  visual = 'metric',
  value,
  unit,
  scale,
  direction,
  series,
  seriesLabels,
  bars,
  bullet,
  radial,
  breakdown,
  status,
  gap,
  share,
  compareRows,
  comparison,
  why,
  measure,
  destinationLabel = 'Open',
  explain: explainProp,
  onClick,
  className = '',
  dataSmartTileId,
  ariaLabel,
}) {
  const explain =
    explainProp ||
    buildSmartTileExplain({
      kind,
      title,
      visual,
      value,
      unit,
      scale,
      direction,
      series,
      seriesLabels,
      bars,
      bullet,
      radial,
      breakdown,
      status,
      gap,
      share,
      compareRows,
      comparison,
      why,
      measure,
      destinationLabel,
    });

  function activate(e) {
    if (e?.target?.closest?.('.st-tile-info, .tile-info-pop')) return;
    onClick?.(e);
  }

  return (
    <article
      className={`role-home-measure accurate-smart-tile is-${semantic} st-face st-visual-${visual} ${className}`.trim()}
      data-smart-tile-id={dataSmartTileId}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel || `${title}: ${value || ''}. ${destinationLabel}`}
      aria-description={why || undefined}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(e);
        }
      }}
    >
      <span className="st-tile-info">
        <TileInfoButton explain={explain} />
      </span>
      {kind ? <span className="role-home-measure-kind">{kind}</span> : null}
      <strong className="role-home-measure-title">{title}</strong>
      <div className="st-tile-body">
        <SmartTileVisual
          visual={visual}
          value={value}
          unit={unit}
          scale={scale}
          direction={direction}
          series={series}
          seriesLabels={seriesLabels}
          bars={bars}
          bullet={bullet}
          radial={radial}
          breakdown={breakdown}
          status={status}
          gap={gap}
          share={share}
          compareRows={compareRows}
        />
      </div>
      <div className="st-tile-footer">
        {comparison ? <small className="role-home-measure-comparison">{comparison}</small> : null}
        <span className="role-home-measure-destination">
          <span>{destinationLabel}</span>
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </article>
  );
}
