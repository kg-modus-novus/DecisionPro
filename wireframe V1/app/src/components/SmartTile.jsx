import { TileInfoButton } from './alp/TileInfoButton.jsx';
import { buildSmartTileExplain } from '../lib/smartTileExplain.js';
import { SmartTileVisual } from '../lib/smartTileVisuals.jsx';

/**
 * Shared smart-tile face: kind, title, visual, short context, CTA + I-button.
 * Three interactive zones when callbacks are provided:
 *  - (i) → interpretation popover (TileInfoButton)
 *  - body (title + visual) → onClick (typically Evidence Room drill-down)
 *  - footer CTA → onTrustClick when set (Why trust…), else onClick
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
  stackBars = false,
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
  trustLabel = 'Why trust this number?',
  explain: explainProp,
  onClick,
  onTrustClick,
  onOpenCatalogueSource,
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
      trustLabel: onTrustClick ? trustLabel : null,
    });

  const footerLabel = onTrustClick ? trustLabel : destinationLabel;

  function activateNavigate(e) {
    e?.stopPropagation?.();
    onClick?.(e);
  }

  function activateTrust(e) {
    e?.stopPropagation?.();
    if (onTrustClick) onTrustClick(e);
    else onClick?.(e);
  }

  function onBodyKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateNavigate(e);
    }
  }

  function onFooterKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateTrust(e);
    }
  }

  return (
    <article
      className={`role-home-measure accurate-smart-tile is-${semantic} st-face st-visual-${visual} ${className}`.trim()}
      data-smart-tile-id={dataSmartTileId}
      aria-label={ariaLabel || title}
    >
      <span className="st-tile-info">
        <TileInfoButton explain={explain} onOpenCatalogueSource={onOpenCatalogueSource} />
      </span>
      <div
        className="st-tile-main"
        role="button"
        tabIndex={0}
        aria-label={
          ariaLabel ||
          `${title}: ${value || ''}. ${destinationLabel || 'Open related evidence'}`
        }
        aria-description={why || undefined}
        onClick={activateNavigate}
        onKeyDown={onBodyKeyDown}
      >
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
            stackBars={stackBars}
            bullet={bullet}
            radial={radial}
            breakdown={breakdown}
            status={status}
            gap={gap}
            share={share}
            compareRows={compareRows}
          />
        </div>
      </div>
      <div className="st-tile-footer">
        {comparison ? <small className="role-home-measure-comparison">{comparison}</small> : null}
        <button
          type="button"
          className={`role-home-measure-destination${onTrustClick ? ' is-trust' : ''}`}
          onClick={activateTrust}
          onKeyDown={onFooterKeyDown}
          aria-label={footerLabel}
        >
          <span>{footerLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}
