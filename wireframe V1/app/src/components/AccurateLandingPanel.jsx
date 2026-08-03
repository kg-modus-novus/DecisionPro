import { ACCURATE_LANDING } from '../data/alp/accurateLanding.js';
import { getRoleLandingTiles } from '../data/roleTileProfiles.js';
import { resolveSourceLinks } from '../lib/sourceLinks.js';
import { SmartTile } from './SmartTile.jsx';

/**
 * Accurate public-data smart tiles — REAL XenoDroid BW cube export.
 * Presentation and selection vary by role.
 *
 * Zones: (i) interpretation · body → Evidence Room · footer → Why trust provenance.
 */
export function AccurateLandingPanel({
  roleId,
  onOpenProvenance,
  onBrowseSources,
  onOpenDestination,
}) {
  const allMeasures = ACCURATE_LANDING.measures || [];
  const ready = allMeasures.length > 0;
  const tiles = roleId
    ? getRoleLandingTiles(roleId)
    : allMeasures.map((m) => ({
        measureId: m.measureId,
        kind: `Accurate · REAL · ${m.measureId}`,
        title: m.name,
        semantic: 'positive',
        visual: 'metric',
        value: m.displayValue,
        unit: m.unit,
        comparison: `As of ${m.asOfDate} · ${m.fromSysId}`,
        why: m.definition,
        destinationLabel: 'Open related Evidence Room',
        trustLabel: 'Why trust this number?',
        measure: m,
      }));

  return (
    <section className="accurate-landing" data-walkthrough-target="accurate-landing">
      <header className="accurate-landing-header">
        <div>
          <p className="accurate-eyebrow">Accurate publicly available data</p>
          {onBrowseSources ? (
            <p className="hint">
              <button type="button" className="linkish" onClick={() => onBrowseSources()}>
                Browse authoritative sources
              </button>
            </p>
          ) : null}
          {!ready ? (
            <p className="hint">
              No REAL load export yet. Run `npm run bw:gate` in the repo, then refresh.
            </p>
          ) : null}
        </div>
      </header>
      {!ready ? (
        <p className="hint">
          Evidence Rooms show Gap objects until REAL loads export. No synthetic magnitudes on the demo path.
        </p>
      ) : (
        <ul className="accurate-smart-grid">
          {tiles.map((tile) => (
            <li key={tile.measureId}>
              <SmartTile
                kind={tile.kind}
                title={tile.title}
                semantic={tile.semantic}
                visual={tile.visual}
                value={tile.value}
                unit={tile.unit}
                scale={tile.scale}
                direction={tile.direction}
                series={tile.series}
                seriesLabels={tile.seriesLabels}
                bars={tile.bars}
                stackBars={tile.stackBars}
                bullet={tile.bullet}
                radial={tile.radial}
                breakdown={tile.breakdown}
                status={tile.status}
                gap={tile.gap}
                share={tile.share}
                compareRows={tile.compareRows}
                comparison={tile.comparison}
                why={tile.why}
                measure={tile.measure}
                destinationLabel={tile.destinationLabel}
                trustLabel={tile.trustLabel || 'Why trust this number?'}
                dataSmartTileId={`landing-${tile.measureId}`}
                onClick={() => {
                  if (tile.openSources) {
                    onBrowseSources?.(null);
                    return;
                  }
                  if (tile.destination) {
                    onOpenDestination?.(tile);
                    return;
                  }
                  if (tile.measure) onOpenProvenance?.(tile.measure);
                }}
                onTrustClick={
                  tile.measure ? () => onOpenProvenance?.(tile.measure) : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AccurateProvenanceModal({ measure, onClose, onBrowseSources }) {
  if (!measure) return null;
  const p = measure.provenance || {};
  const links = resolveSourceLinks(measure);
  return (
    <div className="accurate-prov-backdrop" role="dialog" aria-modal="true" aria-label="Provenance">
      <div className="accurate-prov-panel">
        <header>
          <h3>Why trust this number?</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <dl className="accurate-prov-dl">
          <dt>Measure</dt>
          <dd>
            {measure.measureId} — {measure.name}
          </dd>
          <dt>Definition</dt>
          <dd>{measure.definition}</dd>
          <dt>Value</dt>
          <dd>
            {measure.displayValue} {measure.unit}
          </dd>
          <dt>FromSysID</dt>
          <dd>{measure.fromSysId}</dd>
          <dt>AsOfDate</dt>
          <dd>{measure.asOfDate}</dd>
          <dt>LoadHistory</dt>
          <dd>{measure.loadHistoryId}</dd>
          <dt>Flow</dt>
          <dd>{(p.measureFlow || []).join(' → ') || 'PSA → Cleanse → DetailDSO → Cube'}</dd>
          {links.showFileAndPage ? (
            <>
              <dt>Source file</dt>
              <dd>
                <a href={links.sourceUri} target="_blank" rel="noreferrer">
                  {links.sourceUri}
                </a>
              </dd>
              <dt>Containing page</dt>
              <dd>
                <a href={links.sourcePageUri} target="_blank" rel="noreferrer">
                  {links.sourcePageUri}
                </a>
              </dd>
            </>
          ) : (
            <>
              <dt>Source</dt>
              <dd>
                {links.sourceUri ? (
                  <a href={links.sourceUri} target="_blank" rel="noreferrer">
                    {links.sourceUri}
                  </a>
                ) : (
                  'n/a'
                )}
              </dd>
              {links.sourcePageUri &&
              links.sourcePageUri.replace(/\/$/, '') !== (links.sourceUri || '').replace(/\/$/, '') ? (
                <>
                  <dt>Containing page</dt>
                  <dd>
                    <a href={links.sourcePageUri} target="_blank" rel="noreferrer">
                      {links.sourcePageUri}
                    </a>
                  </dd>
                </>
              ) : null}
            </>
          )}
          <dt>PSA object</dt>
          <dd>{p.psaObjectKey || 'n/a'}</dd>
          <dt>Load class</dt>
          <dd>{p.loadClass || ACCURATE_LANDING.loadClass}</dd>
        </dl>
        {onBrowseSources ? (
          <p className="hint">
            <button
              type="button"
              className="linkish"
              onClick={() => {
                onClose?.();
                onBrowseSources(measure.fromSysId);
              }}
            >
              Open in Authoritative sources
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
