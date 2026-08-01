import { useState } from 'react';
import { EVIDENCE_ROOMS } from '../data/fixtures.js';
import { getHomeSmartTiles } from '../data/homeSmartTiles.js';
import { getRoleProfile } from '../data/roleProfiles.js';
import { PageTitleWithBack } from './ContentBackBar.jsx';
import {
  AccurateLandingPanel,
  AccurateProvenanceModal,
} from './AccurateLandingPanel.jsx';
import { SmartTile } from './SmartTile.jsx';

export function RoleHome({
  roleId,
  onAction,
  onOpenRoom,
  onShowMe,
  onOpenSmartTile,
  onBrowseSources,
  highlightedPriorityId = null,
}) {
  const [provenanceMeasure, setProvenanceMeasure] = useState(null);
  const profile = getRoleProfile(roleId);
  if (!profile) {
    return (
      <main className="main">
        <p className="hint">Select a role to continue.</p>
      </main>
    );
  }

  const roomMeta = (id) => EVIDENCE_ROOMS.find((r) => r.id === id);
  const smartTiles = getHomeSmartTiles(roleId);

  return (
    <main
      className="main role-home"
      data-walkthrough-target="role-home-page"
      style={{ '--role-accent': profile.accent || '#0b5f8a' }}
    >
      <PageTitleWithBack>
        <div data-walkthrough-target="role-home-header">
          <p className="sap-alp-eyebrow">{profile.eyebrow}</p>
          <h2>{profile.label} home</h2>
          <p className="hint">{profile.purpose}</p>
        </div>
      </PageTitleWithBack>

      <AccurateLandingPanel
        roleId={roleId}
        onOpenProvenance={setProvenanceMeasure}
        onBrowseSources={onBrowseSources}
      />
      <AccurateProvenanceModal
        measure={provenanceMeasure}
        onClose={() => setProvenanceMeasure(null)}
        onBrowseSources={onBrowseSources}
      />

      <section className="role-home-priorities" data-walkthrough-target="role-home-priorities" aria-label="Priorities">
        <h3>Priorities for this perspective</h3>
        <div className="role-home-priority-grid">
          {profile.homePriorities.map((item) => {
            const targetId = `role-home-priority-${item.id}`;
            const highlighted = highlightedPriorityId === item.id;
            return (
              <article
                key={item.id}
                className={highlighted ? 'is-show-me-origin' : ''}
                data-walkthrough-target={targetId}
              >
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
                {item.outcome ? <p className="role-home-priority-outcome">{item.outcome}</p> : null}
                <button
                  type="button"
                  className="role-home-show-me"
                  onClick={() => onShowMe?.(item)}
                  aria-label={`Show me how: ${item.title}`}
                >
                  Show Me
                </button>
              </article>
            );
          })}
        </div>

        <div className="role-home-insight-heading">
          <div>
            <h3>Signals worth your attention</h3>
            <p>
              Role-specific attention cues from public REAL measures and labeled Gaps — presentation varies by
              perspective. Select a tile to open supporting evidence.
            </p>
          </div>
          <span>Updated from the displayed REAL / Gap cut</span>
        </div>
        <div className="role-home-measures" aria-label="Role-specific trends and exceptions">
          {smartTiles.map((tile) => (
            <SmartTile
              key={tile.id}
              kind={tile.kind}
              title={tile.title}
              semantic={tile.semantic}
              visual={tile.visual || 'metric'}
              value={tile.value}
              unit={tile.unit}
              scale={tile.scale}
              direction={tile.direction}
              series={tile.series}
              seriesLabels={tile.seriesLabels}
              bars={tile.bars}
              bullet={tile.bullet}
              radial={tile.radial}
              breakdown={tile.breakdown}
              status={tile.status}
              gap={tile.gap}
              share={tile.share}
              compareRows={tile.compareRows}
              comparison={tile.comparison}
              why={tile.why}
              destinationLabel={tile.destinationLabel}
              dataSmartTileId={tile.id}
              onClick={() => onOpenSmartTile?.(tile)}
            />
          ))}
        </div>
      </section>

      <section
        className="role-home-rooms"
        aria-label="Recommended evidence rooms"
        data-walkthrough-target="role-home-rooms"
      >
        <h3>Recommended Evidence Rooms</h3>
        <div className="role-home-room-row">
          {profile.recommendedRooms.map((id) => {
            const room = roomMeta(id);
            return (
              <button
                key={id}
                type="button"
                className="role-home-room"
                data-walkthrough-target={`role-home-room-${id}`}
                onClick={() => onOpenRoom?.(id)}
              >
                <strong>{room?.title || id}</strong>
                <span>{room?.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="role-home-actions" data-walkthrough-target="role-home-actions" aria-label="Primary actions">
        <h3>Primary actions</h3>
        <div className="role-home-action-row">
          {profile.primaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="role-home-action"
              data-walkthrough-target={`role-home-action-${action.id}`}
              onClick={() => onAction?.(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <ul className="role-home-limits">
          {profile.limitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
