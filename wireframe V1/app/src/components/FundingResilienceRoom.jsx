import { useEffect, useMemo, useRef, useState } from 'react';
import { FUNDING_RESILIENCE_ROOM, FUNDING_RESILIENCE_TYPES, fundingResilienceCsvRows } from '../data/alp/fundingResilienceRoom.js';
import { downloadCsv } from '../lib/downloadCsv.js';
import { PageTitleWithBack } from './ContentBackBar.jsx';
import { GlossaryText } from './GlossaryTerm.jsx';
import { RelationshipNetworkGraph } from './RelationshipNetworkGraph.jsx';
import { FundingRunwayList } from './FundingRunwayList.jsx';
import { buildFundingRunway, formatDaysRemaining } from '../lib/fundingRunway.js';
import { InferredIndicator } from './InferredIndicator.jsx';

const ITEM_CAP = 200;

const HOW_TO_USE_ACTIONS = [
  {
    id: 'runway',
    title: 'Check funding runway',
    copy: 'See which federal awards or waivers are expiring soon, before a gap catches anyone off guard.',
    types: ['award-cliff', 'horizon-waiver'],
    sort: 'urgent',
    focusSearch: false,
  },
  {
    id: 'ownership',
    title: 'Spot shared ownership',
    copy: "Look up whether a facility or organization shares ownership with others you're already reviewing.",
    types: ['ownership-chain'],
    sort: 'default',
    focusSearch: true,
  },
  {
    id: 'stress',
    title: 'Watch for financial stress',
    copy: 'Nonprofit and facility signals flag organizations worth a closer look — a starting point, not a diagnosis.',
    types: ['nonprofit-liquidity', 'facility-distress'],
    sort: 'urgent',
    focusSearch: false,
  },
  {
    id: 'grants',
    title: 'Find open grant money',
    copy: 'Check whether a new federal funding opportunity matches something your program needs.',
    types: ['horizon-nofo'],
    sort: 'urgent',
    focusSearch: true,
  },
  {
    id: 'dependency',
    title: 'Validate funding dependency',
    copy: 'Find recipients supported by only one OFR-tracked program before a funding-policy change.',
    types: ['single-stream'],
    sort: 'urgent',
    focusSearch: false,
  },
  {
    id: 'identity',
    title: 'Resolve organization identity',
    copy: 'Review exact and inferred identifier links before joining evidence across sources.',
    types: ['identity-exact', 'identity-inferred'],
    sort: 'default',
    focusSearch: true,
  },
  {
    id: 'funding-flow',
    title: 'Trace sub-award funding',
    copy: 'Follow prime-to-sub-recipient edges and reconcile program scope before describing overlap.',
    types: ['subaward-edge'],
    sort: 'default',
    focusSearch: true,
  },
];

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
  entryItemTypes = null,
}) {
  const state = String(stateCode || 'KY').toUpperCase() === 'FL' ? 'FL' : 'KY';
  const slice = FUNDING_RESILIENCE_ROOM.byState[state];
  const [activeTypes, setActiveTypes] = useState(() => new Set());
  const [reviewCandidatesOnly, setReviewCandidatesOnly] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('default');
  const [graphMode, setGraphMode] = useState('subaward-edge');
  // 'cms-chain' is the CMS Care Compare chain grouping; it shares the
  // ownership-chain item type but comes from a different publisher field.
  const graphType = graphMode === 'cms-chain' ? 'ownership-chain' : graphMode;
  const [confirmedEdgesOnly, setConfirmedEdgesOnly] = useState(true);
  const [graphLimit, setGraphLimit] = useState(10);
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  const searchInputRef = useRef(null);
  const contentRef = useRef(null);

  // Show Me guided demo: an external walkthrough can drive the same visible
  // filter/drill-down transitions a real user would trigger, mirroring the
  // guidedFilters/guidedLeadItemId pattern used by AnalyticalListPage.
  useEffect(() => {
    if (guidedItemType) setActiveTypes(new Set([guidedItemType]));
  }, [guidedItemType]);
  // A deep-link from another page (e.g. an Operational Intelligence action)
  // arrives via App.jsx's roomEntryFilters — a normal, non-guided navigation
  // that pre-filters this room, distinct from the ephemeral Show Me overlay.
  useEffect(() => {
    if (entryItemTypes && entryItemTypes.length) setActiveTypes(new Set(entryItemTypes));
  }, [entryItemTypes]);
  useEffect(() => {
    if (!guidedLeadTitleContains || !slice) return;
    const needle = guidedLeadTitleContains.toLocaleLowerCase();
    const match = slice.items.find((item) => item.title.toLocaleLowerCase().includes(needle));
    if (match) setSelectedItemId(match.id);
  }, [guidedLeadTitleContains, slice]);

  const filteredItems = useMemo(() => {
    if (!slice) return [];
    const needle = searchQuery.trim().toLocaleLowerCase();
    const filtered = slice.items.filter((item) => {
      if (activeTypes.size > 0 && !activeTypes.has(item.type)) return false;
      if (reviewCandidatesOnly && !item.reviewCandidateOnly) return false;
      if (needle) {
        const haystack = `${item.title} ${item.detail} ${item.metricValue}`.toLocaleLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    if (sortMode === 'urgent') {
      // Stable sort: ranked items (soonest deadline / worst ratio) first in
      // ascending order, unranked items keep their original relative order
      // at the end rather than being scattered.
      return [...filtered].sort((a, b) => {
        const aRank = a.urgencyRank;
        const bRank = b.urgencyRank;
        if (aRank == null && bRank == null) return 0;
        if (aRank == null) return 1;
        if (bRank == null) return -1;
        return aRank - bRank;
      });
    }
    return filtered;
  }, [slice, activeTypes, reviewCandidatesOnly, searchQuery, sortMode]);

  const relationshipItems = useMemo(() => {
    if (!slice) return [];
    const needle = searchQuery.trim().toLocaleLowerCase();
    const graphItems = slice.items
      .filter((item) => item.type === graphType && item.sourceNode && item.targetNode)
      .filter((item) => (graphMode === 'cms-chain' ? item.chainSource === 'CMS_PROVIDER_DATA' : item.chainSource !== 'CMS_PROVIDER_DATA'))
      .flatMap((item) => (
        graphType === 'ownership-chain' && item.relationshipMembers?.length
          ? item.relationshipMembers.map((member) => ({
            ...item,
            graphId: `${item.id}-${member.ccn}`,
            targetNode: `${member.facilityName} (${member.facilityType.toUpperCase()} · CCN ${member.ccn})`,
            graphMetricValue: member.overallRating == null
              ? `${item.metricValue} facilities in portfolio`
              : `${member.overallRating} ${member.overallRating === 1 ? 'star' : 'stars'}`,
            graphDetail: `${member.role || 'Ownership association'} ${member.percentageOwnership ? `· ${member.percentageOwnership}%` : ''}`,
          }))
          : [{ ...item, graphId: item.id }]
      ));
    return graphItems
      .filter((item) => graphMode !== 'subaward-edge' || !confirmedEdgesOnly || !item.reviewCandidateOnly)
      .filter((item) => !needle || `${item.sourceNode} ${item.targetNode} ${item.graphDetail || item.detail}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => Number(b.relationshipValue || 0) - Number(a.relationshipValue || 0))
      .slice(0, graphLimit);
  }, [slice, graphMode, graphType, confirmedEdgesOnly, graphLimit, searchQuery]);

  if (!slice) {
    return (
      <div className="er-screen">
        <p className="hint">Funding & Resilience evidence is not available for this state.</p>
      </div>
    );
  }

  const maxTypeCount = Math.max(1, ...Object.values(slice.summary.countsByType));
  const selectedItem = selectedItemId ? filteredItems.find((i) => i.id === selectedItemId) : null;
  const selectedRunwayItem = selectedItem ? buildFundingRunway([selectedItem]).items[0] : null;

  function toggleType(typeId) {
    setActiveWorkflowId(null);
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  }

  function applyHowToUseAction(action) {
    setSelectedItemId(null);
    setActiveTypes(new Set(action.types));
    setSortMode(action.sort);
    setSearchQuery('');
    setActiveWorkflowId(action.id);
    requestAnimationFrame(() => {
      if (typeof contentRef.current?.scrollIntoView === 'function') {
        contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (action.focusSearch) searchInputRef.current?.focus();
    });
  }

  function clearFilters() {
    setActiveTypes(new Set());
    setReviewCandidatesOnly(false);
    setSearchQuery('');
    setSortMode('default');
    setActiveWorkflowId(null);
  }

  function exportCsv() {
    const rows = fundingResilienceCsvRows(state, filteredItems);
    downloadCsv(rows, { fileName: `decisionpro-funding-resilience-${state}-${new Date().toISOString().slice(0, 10)}.csv` });
  }

  function openRelationship(item) {
    setActiveTypes(new Set([item.type]));
    setReviewCandidatesOnly(false);
    setSelectedItemId(item.id);
    requestAnimationFrame(() => contentRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <main className="main evidence-view fr-room">
      <div data-walkthrough-target="alp-analytical-header">
        <PageTitleWithBack>
          <h2>Funding & Resilience</h2>
          <p className="hint">
            Organizational funding-continuity evidence for {state}, built from nine federal sources.
          </p>
          <p className="hint">Shows collected federal evidence, inferred review signals (◆), and explicit confirmation paths. Transparent reporting — not censored waiting states.</p>
        </PageTitleWithBack>
      </div>

      <section className="fr-how-to-use" aria-labelledby="fr-how-to-use-title">
        <h3 id="fr-how-to-use-title">How to use this information</h3>
        <p className="hint">Click one to jump straight to those rows, filtered and sorted.</p>
        <ul className="fr-how-to-use-actions">
          {HOW_TO_USE_ACTIONS.map((action) => (
            <li key={action.id}>
              <button type="button" className="fr-how-to-use-btn" onClick={() => applyHowToUseAction(action)}>
                <strong>{action.title}</strong>
                <span>{action.copy}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="hint">
          Every row below is a <GlossaryText text="review candidate" /> to verify, never itself a finding of
          waste, fraud, distress, breach, or improper conduct — confirm before you act on it.
        </p>
      </section>

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
          <label className="fr-search-label" htmlFor="fr-search-input">Look up a name (facility, organization, program)</label>
          <input
            id="fr-search-input"
            ref={searchInputRef}
            type="search"
            className="fr-search-input"
            placeholder="e.g. a facility or organization name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
          <label className="fr-toggle">
            <input
              type="checkbox"
              checked={sortMode === 'urgent'}
              onChange={(e) => setSortMode(e.target.checked ? 'urgent' : 'default')}
            />
            Most urgent first (soonest deadline or worst ratio) — rows without a date/ratio stay at the end
          </label>
          <div className="fr-filter-actions">
            <button type="button" className="fr-export-btn" onClick={exportCsv} data-walkthrough-target="fr-csv-export">
              Export filtered rows (CSV)
            </button>
            <button type="button" className="fr-clear-btn" onClick={clearFilters}>
              Clear all filters
            </button>
          </div>
        </div>
      </section>

      <section className="fr-relationship-graph" aria-labelledby="fr-relationship-title">
        <div className="fr-relationship-heading">
          <div>
            <h3 id="fr-relationship-title">Relationship graph</h3>
            <p className="hint">Explore shared nodes and funding or ownership connections, then open a connection for its evidence and action playbook.</p>
          </div>
          <div className="fr-relationship-controls" aria-label="Relationship graph controls">
            <label>
              Relationship
              <select value={graphMode} onChange={(e) => setGraphMode(e.target.value)}>
                <option value="subaward-edge">Prime → sub-recipient funding</option>
                <option value="ownership-chain">Owner → matched-facility portfolio</option>
                <option value="cms-chain">CMS-reported chain → facilities</option>
              </select>
            </label>
            <label>
              Show
              <select value={graphLimit} onChange={(e) => setGraphLimit(Number(e.target.value))}>
                <option value={10}>Top 10</option>
                <option value={25}>Top 25</option>
                <option value={50}>Top 50</option>
              </select>
            </label>
            {graphMode === 'subaward-edge' ? (
              <label className="fr-toggle">
                <input type="checkbox" checked={confirmedEdgesOnly} onChange={(e) => setConfirmedEdgesOnly(e.target.checked)} />
                Exact-derived identity only
              </label>
            ) : null}
          </div>
        </div>
        <p className="fr-graph-guidance">
          <strong>What to look for:</strong>{' '}
          {graphMode === 'subaward-edge'
            ? 'large funding flows, the same recipient under multiple programs, and unresolved identity labels. Amount alone is not evidence of duplication or improper steering.'
            : graphMode === 'cms-chain'
              ? 'the publisher\'s own chain grouping from CMS Care Compare (chain id), which reaches far more facilities than the exact-name ownership match. A chain label is shown only when the publisher\'s chain name is an organization; otherwise the chain is identified by its CMS id and the label is withheld.'
              : 'larger commonly owned portfolios and chains that also appear in financial or quality review queues. Named facility-member edges shown here come from exact normalized-name matches; unmatched or ambiguous identities remain out of scope.'}
        </p>
        <RelationshipNetworkGraph items={relationshipItems} mode={graphType} onOpenRelationship={openRelationship} />
        <p className="hint">Use the name search above to isolate an organization. Open a connection, follow its steps, then record the result in the accountable review system named by the operational recommendation.</p>
      </section>

      <section className="fr-content" data-walkthrough-target="alp-content" ref={contentRef}>
        {selectedItem ? (
          <div className="fr-object-page">
            <button type="button" className="fr-back-btn" onClick={() => setSelectedItemId(null)}>← Back to list</button>
            <h3>{selectedItem.title}</h3>
            <p className="hint">{typeLabel(selectedItem.type)} · {selectedItem.status}</p>
            <dl className="fr-object-fields">
              <dt>{selectedItem.metricLabel}</dt><dd>{selectedItem.metricValue}</dd>
              <dt>Date</dt><dd>{selectedItem.dateLabel}</dd>
              {selectedRunwayItem ? (
                <>
                  <dt>Time remaining</dt><dd>{formatDaysRemaining(selectedRunwayItem.daysRemaining)}</dd>
                  <dt>Collected public evidence</dt>
                  <dd className="fr-runway-action-text is-inferred">
                    {selectedRunwayItem.evidenceDisplay?.headline}
                    {selectedRunwayItem.evidenceDisplay?.lines?.map((line) => (
                      <span key={line} className="fr-evidence-line">{line}</span>
                    ))}
                    {selectedRunwayItem.evidenceDisplay?.sourceUri ? (
                      <a href={selectedRunwayItem.evidenceDisplay.sourceUri} target="_blank" rel="noreferrer">Open USAspending award ↗</a>
                    ) : null}
                    <InferredIndicator tooltip={selectedRunwayItem.evidenceDisplay?.confirmTooltip} label="Public evidence confirmation" />
                  </dd>
                  <dt>Continuation</dt>
                  <dd className={`fr-runway-action-text${selectedRunwayItem.continuationAction?.tone !== 'confirmed' ? ' is-inferred' : ''}`}>
                    {selectedRunwayItem.continuationAction?.text}
                    <InferredIndicator tooltip={selectedRunwayItem.continuationConfirmation?.tooltip} label={selectedRunwayItem.continuationStatusLabel} />
                  </dd>
                  <dt>Gap assessment</dt>
                  <dd className={`fr-runway-action-text${selectedRunwayItem.gapInference?.tone !== 'confirmed' ? ' is-inferred' : ''}`}>
                    {selectedRunwayItem.gapInference?.actionText}
                    <InferredIndicator tooltip={selectedRunwayItem.gapInference?.tooltip} label={selectedRunwayItem.gapStatusLabel} />
                  </dd>
                </>
              ) : null}
              {selectedItem.entityTypeLabel ? <><dt>Organization type</dt><dd>{selectedItem.entityTypeLabel}</dd></> : null}
              {selectedItem.awardId ? <><dt>Award</dt><dd>{selectedItem.awardId} · Assistance listing {selectedItem.assistanceListing}</dd></> : null}
              {selectedItem.rawSourceName && selectedItem.rawSourceName !== selectedItem.organizationName ? <><dt>Publisher label</dt><dd>{selectedItem.rawSourceName}</dd></> : null}
              {selectedItem.nameAuthority ? <><dt>Name authority</dt><dd>{selectedItem.nameSourceUri ? <a href={selectedItem.nameSourceUri} target="_blank" rel="noreferrer">{selectedItem.nameAuthority}</a> : selectedItem.nameAuthority}</dd></> : null}
              <dt>Detail</dt><dd>{selectedItem.detail}</dd>
              {selectedItem.dataQualityNote ? <><dt>Data-quality check</dt><dd>{selectedItem.dataQualityNote}</dd></> : null}
              {selectedItem.sourceDocumentUri ? (
                <>
                  <dt>Source document</dt>
                  <dd><a href={selectedItem.sourceDocumentUri} target="_blank" rel="noreferrer">{selectedItem.sourceDocumentUri}</a></dd>
                  <dt>Retrieved</dt><dd>{selectedItem.retrievedAt}</dd>
                </>
              ) : null}
            </dl>
            <p className="fr-guardrail"><GlossaryText text={selectedItem.guardrail} /></p>
            {selectedItem.playbook ? (
              <section className="fr-playbook" aria-labelledby="fr-playbook-title">
                <h4 id="fr-playbook-title">Turn this evidence into action</h4>
                <dl>
                  <dt>Goal</dt><dd>{selectedItem.playbook.goal}</dd>
                  <dt>What to look for</dt><dd>{selectedItem.playbook.lookFor}</dd>
                  <dt>Steps</dt>
                  <dd><ol>{selectedItem.playbook.steps.map((step) => <li key={step}>{step}</li>)}</ol></dd>
                  <dt>How to use the result</dt><dd>{selectedItem.playbook.useResult}</dd>
                  <dt>Success measure</dt><dd>{selectedItem.playbook.successMeasure}</dd>
                </dl>
              </section>
            ) : null}
            {selectedItem.reviewCandidateOnly ? (
              <p className="fr-review-flag">Review candidate only — not a confirmed identity, finding, or determination.</p>
            ) : null}
          </div>
        ) : activeWorkflowId === 'runway' ? (
          <FundingRunwayList items={filteredItems} onOpenItem={setSelectedItemId} />
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
