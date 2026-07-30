import { EVIDENCE_ROOMS } from '../data/fixtures.js';
import { getHomeSmartTiles } from '../data/homeSmartTiles.js';
import { getRoleProfile } from '../data/roleProfiles.js';
import { PageTitleWithBack } from './ContentBackBar.jsx';

function sparklinePoints(values = []) {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 34 - ((value - min) / range) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function directionSymbol(direction) {
  if (direction === 'up') return '↗';
  if (direction === 'down') return '↘';
  return '→';
}

export function RoleHome({
  roleId,
  onAction,
  onOpenRoom,
  onShowMe,
  onOpenSmartTile,
  highlightedPriorityId = null,
}) {
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
              Synthetic role-specific trends and exceptions that can be easy to miss.
              Select a tile to open the supporting evidence or a prepared comparison.
            </p>
          </div>
          <span>Updated from the displayed fixture cut</span>
        </div>
        <div className="role-home-measures" aria-label="Role-specific trends and exceptions">
          {smartTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className={`role-home-measure is-${tile.semantic || 'info'}`}
              onClick={() => onOpenSmartTile?.(tile)}
              data-smart-tile-id={tile.id}
            >
              <span className="role-home-measure-kind">{tile.kind}</span>
              <strong className="role-home-measure-title">{tile.title}</strong>
              <span className="role-home-measure-visual">
                <span className="role-home-measure-value">
                  {tile.value}
                  <span aria-hidden="true">{directionSymbol(tile.direction)}</span>
                </span>
                <svg
                  className="role-home-sparkline"
                  viewBox="0 0 100 40"
                  role="img"
                  aria-label={`${tile.direction || 'stable'} trend`}
                  preserveAspectRatio="none"
                >
                  <polyline points={sparklinePoints(tile.trend)} />
                  <line x1="0" y1="35" x2="100" y2="35" />
                </svg>
              </span>
              <small className="role-home-measure-comparison">{tile.comparison}</small>
              <span className="role-home-measure-why">
                <strong>Why it is here</strong>
                {tile.why}
              </span>
              <span className="role-home-measure-destination">
                {tile.destinationLabel}
                <span aria-hidden="true">→</span>
              </span>
            </button>
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
