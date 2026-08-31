import { useEffect, useMemo, useState } from 'react';
import { FUNDING_RESILIENCE_ROOM, FUNDING_RESILIENCE_TYPES, fundingResilienceCsvRows } from '../data/alp/fundingResilienceRoom.js';
import { downloadCsv } from '../lib/downloadCsv.js';
import { PageTitleWithBack } from './ContentBackBar.jsx';
import { GlossaryText } from './GlossaryTerm.jsx';

const ITEM_CAP = 200;

function typeLabel(typeId) {
  return FUNDING_RESILIENCE_TYPES.find((t) => t.id === typeId)?.label || typeId;
}

function BarRow({ label, count, max }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div className="fr-bar-row">
      <span className="fr-bar-label">{label}</span>
      <div className="fr-bar-track">
        <div className="fr-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="fr-bar-count">{count}</span>
    </div>
  );
}

export function FundingResilienceRoom({
  stateCode,
  onOpenCatalogueSource,
  guidedItemType = null,
  guidedLeadTitleContains = null,
}) {
  const state = String(stateCode || 'KY').toUpperCase() === 'FL' ? 'FL' : 'KY';
  const slice = FUNDING_RESILIENCE_ROOM.byState[state];
  const [activeTypes, setActiveTypes] = useState(() => new Set());
  const [reviewCandidatesOnly, setReviewCandidatesOnly] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Show Me guided demo: an external walkthrough can drive the same visible
  // filter/drill-down transitions a real user would trigger, mirroring the
  // guidedFilters/guidedLeadItemId pattern used by AnalyticalListPage.
  useEffect(() => {
    if (guidedItemType) setActiveTypes(new Set([guidedItemType]));
  }, [guidedItemType]);
  useEffect(() => {
    if (!guidedLeadTitleContains || !slice) return;
    const needle = guidedLeadTitleContains.toLocaleLowerCase();
    const match = slice.items.find((item) => item.title.toLocaleLowerCase().includes(needle));
    if (match) setSelectedItemId(match.id);
  }, [guidedLeadTitleContains, slice]);

  const filteredItems = useMemo(() => {
    if (!slice) return [];
    return slice.items.filter((item) => {
      if (activeTypes.size > 0 && !activeTypes.has(item.type)) return false;
      if (reviewCandidatesOnly && !item.reviewCandidateOnly) return false;
      return true;
    });
  }, [slice, activeTypes, reviewCandidatesOnly]);

  if (!slice) {
    return (
      <div className="er-screen">
        <p className="hint">Funding & Resilience evidence is not available for this state.</p>
      </div>
    );
  }

  const maxTypeCount = Math.max(1, ...Object.values(slice.summary.countsByType));
  const selectedItem = selectedItemId ? filteredItems.find((i) => i.id === selectedItemId) : null;

  function toggleType(typeId) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  }

  function exportCsv() {
    const rows = fundingResilienceCsvRows(state).filter((row) => {
      if (activeTypes.size > 0) {
        const typeId = FUNDING_RESILIENCE_TYPES.find((t) => t.label === row.type)?.id;
        if (typeId && !activeTypes.has(typeId)) return false;
      }
      if (reviewCandidatesOnly && row.reviewCandidateOnly !== 'yes') return false;
      return true;
    });
    downloadCsv(rows, { fileName: `decisionpro-funding-resilience-${state}-${new Date().toISOString().slice(0, 10)}.csv` });
  }

  return (
    <main className="main evidence-view fr-room">
      <div data-walkthrough-target="alp-analytical-header">
        <PageTitleWithBack>
          <h2>Funding & Resilience</h2>
          <p className="hint">
            State-neutral organizational funding-continuity and resilience evidence — federal award
            expirations, identity crosswalk, nonprofit and facility financial-resilience signals,
            common ownership, sub-award funding flow, and waiver/grant horizon events for {state}.
            Every row below is a <GlossaryText text="review candidate" /> for human validation, never
            itself a finding of waste, fraud, distress, breach, or improper conduct.
          </p>
        </PageTitleWithBack>
      </div>

      <section className="fr-summary" data-walkthrough-target="alp-visual-filters">
        <div className="fr-kpi-strip">
          <div className="fr-kpi"><strong>{slice.summary.totalItems}</strong><span>evidence rows ({state})</span></div>
          <div className="fr-kpi"><strong>{slice.summary.reviewCandidateCount}</strong><span>flagged review-candidate-only rows</span></div>
          <div className="fr-kpi"><strong>{FUNDING_RESILIENCE_TYPES.length}</strong><span>signal types across OFR-01..07</span></div>
        </div>
        <div className="fr-chart">
          {FUNDING_RESILIENCE_TYPES.map((t) => (
            <BarRow key={t.id} label={t.label} count={slice.summary.countsByType[t.id] || 0} max={maxTypeCount} />
          ))}
        </div>
        <div className="fr-filters">
          <span className="hint">Filter by signal type:</span>
          <div className="fr-filter-chips">
            {FUNDING_RESILIENCE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`fr-chip${activeTypes.has(t.id) ? ' fr-chip-active' : ''}`}
                onClick={() => toggleType(t.id)}
              >
                {t.label} ({slice.summary.countsByType[t.id] || 0})
              </button>
            ))}
          </div>
          <label className="fr-toggle">
            <input
              type="checkbox"
              checked={reviewCandidatesOnly}
              onChange={(e) => setReviewCandidatesOnly(e.target.checked)}
            />
            Review-candidate-only rows (inferred crosswalk / unresolved sub-award identity)
          </label>
          <button type="button" className="fr-export-btn" onClick={exportCsv} data-walkthrough-target="fr-csv-export">
            Export filtered rows (CSV)
          </button>
        </div>
      </section>

      <section className="fr-content" data-walkthrough-target="alp-content">
        {selectedItem ? (
          <div className="fr-object-page">
            <button type="button" className="fr-back-btn" onClick={() => setSelectedItemId(null)}>← Back to list</button>
            <h3>{selectedItem.title}</h3>
            <p className="hint">{typeLabel(selectedItem.type)} · {selectedItem.status}</p>
            <dl className="fr-object-fields">
              <dt>{selectedItem.metricLabel}</dt><dd>{selectedItem.metricValue}</dd>
              <dt>Date</dt><dd>{selectedItem.dateLabel}</dd>
              <dt>Detail</dt><dd>{selectedItem.detail}</dd>
              {selectedItem.sourceDocumentUri ? (
                <>
                  <dt>Source document</dt>
                  <dd><a href={selectedItem.sourceDocumentUri} target="_blank" rel="noreferrer">{selectedItem.sourceDocumentUri}</a></dd>
                  <dt>Retrieved</dt><dd>{selectedItem.retrievedAt}</dd>
                </>
              ) : null}
            </dl>
            <p className="fr-guardrail"><GlossaryText text={selectedItem.guardrail} /></p>
            {selectedItem.reviewCandidateOnly ? (
              <p className="fr-review-flag">Review candidate only — not a confirmed identity, finding, or determination.</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="fr-list-header">
              <h3>Evidence rows ({filteredItems.length})</h3>
              {filteredItems.length > ITEM_CAP ? (
                <span className="hint">Showing the first {ITEM_CAP} of {filteredItems.length} rows.</span>
              ) : null}
            </div>
            <ul className="fr-item-list">
              {filteredItems.slice(0, ITEM_CAP).map((item) => (
                <li key={item.id}>
                  <button type="button" className="fr-item-row" onClick={() => setSelectedItemId(item.id)}>
                    <span className="fr-item-type">{typeLabel(item.type)}</span>
                    <span className="fr-item-title">{item.title}</span>
                    <span className="fr-item-metric">{item.metricLabel}: {item.metricValue}</span>
                    {item.reviewCandidateOnly ? <span className="fr-item-flag">review candidate</span> : null}
                  </button>
                </li>
              ))}
              {filteredItems.length === 0 ? <li className="hint">No rows match the current filters.</li> : null}
            </ul>
          </>
        )}
      </section>

      <section className="fr-lineage" data-walkthrough-target="alp-lineage">
        <h3>Source lineage and provenance</h3>
        <p className="hint">Every signal type traces to one of these nine governed federal sources.</p>
        <div className="fr-lineage-grid">
          {slice.lineage.map((src) => (
            <article key={src.fromSysId} className="fr-lineage-card">
              <strong>{src.publisher}</strong>
              <span className={`fr-load-status fr-load-status-${src.loadStatus.toLowerCase()}`}>{src.loadStatus}</span>
              <p className="hint">{src.attributionNotes}</p>
              <p className="hint">As of {src.asOfDate} · TOS: {src.tosGrade}</p>
              {src.href ? (
                <button
                  type="button"
                  className="fr-source-link"
                  onClick={() => (onOpenCatalogueSource ? onOpenCatalogueSource(src.fromSysId) : window.open(src.href, '_blank', 'noreferrer'))}
                >
                  Open source-of-record ↗
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
