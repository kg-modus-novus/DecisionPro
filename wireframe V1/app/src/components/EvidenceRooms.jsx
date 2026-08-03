import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';
import { SEED_CUBES } from '../data/alp/seedCubes.js';
import { AnalyticalListPage } from './alp/AnalyticalListPage.jsx';
import { PageTitleWithBack } from './ContentBackBar.jsx';

export function EvidenceRoomScreen({
  roomId,
  onOpenLaw,
  selectedObjectId = null,
  onOpenObject,
  onClearObject,
  guidedFilters = null,
  guidedViewMode = null,
  guidedObjectFacet = null,
  guidedLeadItemId = null,
  onOpenCatalogueSource,
  tileInfoFocus = null,
}) {
  const config = ROOM_CONFIGS[roomId];
  if (!config) {
    return (
      <div className="er-screen">
        <p className="hint">Select an evidence room from the left navigation.</p>
      </div>
    );
  }
  return (
    <AnalyticalListPage
      key={roomId}
      config={config}
      onOpenLaw={onOpenLaw}
      selectedObjectId={selectedObjectId}
      onOpenObject={onOpenObject}
      onClearObject={onClearObject}
      guidedFilters={guidedFilters}
      guidedViewMode={guidedViewMode}
      guidedObjectFacet={guidedObjectFacet}
      guidedLeadItemId={guidedLeadItemId}
      onOpenCatalogueSource={onOpenCatalogueSource}
      tileInfoFocus={tileInfoFocus}
    />
  );
}

export function EvidenceRoomsIndex({ rooms, onOpen, roleLabel = null, roleEmphasis = null }) {
  return (
    <div className="er-index">
      <PageTitleWithBack>
        <div data-walkthrough-target="evidence-index-header">
          <h2>Evidence rooms</h2>
          <p className="hint">
            Open a room for filters, charts, and drill-down lists that expand from Kentucky Medicaid
            warehouse aggregates into measure-level detail.
          </p>
          {roleLabel ? (
            <p className="hint role-perspective-hint">
              Perspective: <strong>{roleLabel}</strong>
              {roleEmphasis ? ` — ${roleEmphasis}` : ''}. Room order is prioritized for this view;
              all rooms remain available.
            </p>
          ) : null}
        </div>
      </PageTitleWithBack>
      <div className="er-index-grid" data-walkthrough-target="evidence-index-grid">
        {rooms.map((room) => {
          const seed = SEED_CUBES[room.id];
          return (
            <button
              key={room.id}
              type="button"
              className="er-index-card"
              data-walkthrough-target={`evidence-index-card-${room.id}`}
              onClick={() => onOpen(room.id)}
            >
              <strong>{room.title}</strong>
              <span className="hint">{room.blurb}</span>
              <span className="hint">
                ~{(seed?.listBaseCount || 0).toLocaleString()} aggregate rows
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
