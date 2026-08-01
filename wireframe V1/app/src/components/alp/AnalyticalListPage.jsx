import { useEffect, useMemo, useState } from 'react';
import {
  asFilterIds,
  filtersExcludingDimension,
  getObject,
  listSlice,
  queryAggregates,
} from '../../lib/alpCube.js';
import { kpiTileExplain } from '../../lib/tileExplains.js';
import { VisualFilterBar } from './VisualFilterBar.jsx';
import { ContentChart } from './ContentChart.jsx';
import { DetailList } from './DetailList.jsx';
import { DataLineageGraph } from './DataLineageGraph.jsx';
import { ObjectPage } from './ObjectPage.jsx';
import { TileInfoButton } from './TileInfoButton.jsx';
import { PageTitleWithBack } from '../ContentBackBar.jsx';

const PAGE_SIZE = 50;

function formatMetric(value, metricKey) {
  if (value == null) return '—';
  if (metricKey === 'count') return Math.round(value).toLocaleString();
  if (String(metricKey).endsWith('Pct') || metricKey === 'rate' || metricKey === 'gapPts') {
    return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
  }
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function AnalyticalListPage({
  config,
  onOpenLaw,
  selectedObjectId = null,
  onOpenObject,
  onClearObject,
  guidedFilters = null,
  guidedViewMode = null,
  guidedObjectFacet = null,
  guidedLeadItemId = null,
}) {
  const roomId = config.roomId;
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState('hybrid');
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  useEffect(() => {
    if (guidedFilters != null) {
      setFilters(guidedFilters);
      setPage(0);
    }
  }, [guidedFilters]);

  useEffect(() => {
    if (guidedViewMode != null) setViewMode(guidedViewMode);
  }, [guidedViewMode]);

  function onFilter(next) {
    setFilters(next);
    setPage(0);
  }

  const filterSeries = useMemo(() => {
    const map = {};
    for (const filter of config.filters) {
      const mode = filter.valueKey === 'count' || config.metricKey === 'count' ? 'count' : 'metric';
      // Exclude this filter’s own key so click-to-filter highlights a segment
      // instead of removing the other points from the mini-chart.
      map[filter.key] = queryAggregates(
        roomId,
        filtersExcludingDimension(filters, filter.key),
        filter.key,
        mode,
      );
    }
    return map;
  }, [config.filters, config.metricKey, filters, roomId]);

  const chartSeries = useMemo(() => {
    const mode =
      config.contentAggregateMode ||
      (config.metricKey === 'count' ? 'count' : 'metric');
    return queryAggregates(roomId, filters, config.contentDimension, mode);
  }, [config.contentAggregateMode, config.contentDimension, config.metricKey, filters, roomId]);

  const slice = useMemo(() => {
    const primary = listSlice(roomId, filters, { page: 0, pageSize: PAGE_SIZE * (page + 1) });
    // REAL/Gap cubes are sparse — Show Me guided filters from the synthetic era may miss.
    if (primary.totalCount > 0) return primary;
    return {
      ...listSlice(roomId, {}, { page: 0, pageSize: PAGE_SIZE * (page + 1) }),
      filterFallback: true,
    };
  }, [filters, page, roomId]);

  const kpis = useMemo(() => {
    // Dollar / named metric KPI from filtered rows — not always the content-chart aggregate mode.
    const scoped = listSlice(roomId, filters, { page: 0, pageSize: 5000 });
    const metricKey = config.metricKey;
    let totalMetric = 0;
    if (metricKey === 'dollarImpactM') {
      totalMetric = scoped.rows.reduce((a, r) => {
        const v = r.dollarImpactM ?? (r.metricKey === 'dollarImpactM' ? r.metricValue : null);
        return a + (v != null && !Number.isNaN(Number(v)) ? Number(v) : 0);
      }, 0);
    } else if (config.contentAggregateMode === 'count' && metricKey !== 'count') {
      totalMetric = scoped.rows.reduce((a, r) => {
        const v = r[metricKey] ?? (r.metricKey === metricKey ? r.metricValue : null);
        return a + (v != null && !Number.isNaN(Number(v)) ? Number(v) : 0);
      }, 0);
    } else {
      totalMetric = chartSeries.reduce((a, b) => a + (b.value || 0), 0);
    }
    const top = [...chartSeries].sort((a, b) => b.value - a.value)[0];
    const activeFilterCount = Object.values(filters).reduce((n, v) => n + asFilterIds(v).length, 0);
    return {
      totalMetric,
      topId: top?.id,
      topValue: top?.value,
      rowCount: slice.totalCount,
      claimLines: slice.representedClaimLines,
      activeFilterCount,
    };
  }, [chartSeries, config.contentAggregateMode, config.metricKey, filters, roomId, slice.representedClaimLines, slice.totalCount]);

  if (selectedObjectId) {
    const full = getObject(roomId, selectedObjectId) || slice.rows.find((r) => r.id === selectedObjectId);
    if (full) {
      return (
        <ObjectPage
          row={full}
          config={config}
          filters={filters}
          onClose={onClearObject}
          onOpenRelated={(related) => onOpenObject?.(related)}
          onOpenLaw={onOpenLaw}
          guidedFacet={guidedObjectFacet}
        />
      );
    }
  }

  const shown = slice.rows.length;
  const scaleText = `Showing ${shown.toLocaleString()} of ${slice.totalCount.toLocaleString()} REAL/Gap rows · no synthetic claim-line expansion`;
  const adapted = Object.entries(filters).flatMap(([key, value]) =>
    asFilterIds(value).map((id) => [key, id]),
  );

  return (
    <div className="alp-page sap-alp">
      <header className="sap-alp-titlebar" data-walkthrough-target="alp-titlebar">
        <PageTitleWithBack
          actions={
            <div className="sap-alp-head-actions">
              <div className="er-chip sap-alp-chip">Aggregate · de-identified · warehouse cube</div>
              <div className="sap-alp-toolbar" aria-label="Page actions">
                <button type="button" className="sap-btn ghost" disabled title="Coming soon">
                  Go
                </button>
                <button type="button" className="sap-btn ghost" disabled title="Coming soon">
                  Share
                </button>
                <button type="button" className="sap-btn primary" onClick={() => onFilter({})}>
                  Adapt Filters
                </button>
              </div>
            </div>
          }
        >
          <div className="sap-alp-titleblock">
            <p className="sap-alp-eyebrow">Analytical List Page · Kentucky Medicaid</p>
            <h2>{config.title}</h2>
            <p className="hint">{config.subtitle}</p>
          </div>
        </PageTitleWithBack>
      </header>

      <div
        className={`sap-analytical-header ${headerCollapsed ? 'collapsed' : ''}`}
        data-walkthrough-target="alp-analytical-header"
      >
        {!headerCollapsed ? (
          <div className="sap-analytical-header-body">
            <div className="sap-filter-toolbar" aria-label="Adapted filters">
              <span className="sap-adapted-label">Standard</span>
              {adapted.length > 0 ? (
                <>
                  {adapted.map(([key, value]) => (
                    <button
                      key={`${key}:${value}`}
                      type="button"
                      className="sap-adapted-chip"
                      onClick={() => {
                        const remaining = asFilterIds(filters[key]).filter((id) => id !== value);
                        const next = { ...filters };
                        if (!remaining.length) delete next[key];
                        else if (remaining.length === 1) next[key] = remaining[0];
                        else next[key] = remaining;
                        onFilter(next);
                      }}
                      title="Remove filter"
                    >
                      {key}:{' '}
                      {key === 'period' && /^y\d{4}$/.test(String(value))
                        ? String(value).slice(1)
                        : String(value)}
                      <span aria-hidden="true"> ×</span>
                    </button>
                  ))}
                  <button type="button" className="alp-linkish" onClick={() => onFilter({})}>
                    Clear all
                  </button>
                </>
              ) : (
                <span className="sap-filter-empty">No adapted filters</span>
              )}
            </div>

            <section className="sap-kpi-strip" aria-label="Key figures">
              <article className="sap-kpi">
                <div className="sap-kpi-top">
                  <span className="sap-kpi-label">{config.metricLabel}</span>
                  <TileInfoButton explain={kpiTileExplain('metric', config)} />
                </div>
                <strong className="sap-kpi-value">{formatMetric(kpis.totalMetric, config.metricKey)}</strong>
                <span className="sap-kpi-hint">Sum of content chart series</span>
              </article>
              <article className="sap-kpi">
                <div className="sap-kpi-top">
                  <span className="sap-kpi-label">Aggregates in scope</span>
                  <TileInfoButton explain={kpiTileExplain('aggregates', config)} />
                </div>
                <strong className="sap-kpi-value">{kpis.rowCount.toLocaleString()}</strong>
                <span className="sap-kpi-hint">Filtered list cardinality</span>
              </article>
              <article className="sap-kpi">
                <div className="sap-kpi-top">
                  <span className="sap-kpi-label">
                    {slice.realHydration ? 'REAL / Gap rows' : 'Claim lines represented'}
                  </span>
                  <TileInfoButton
                    explain={kpiTileExplain(slice.realHydration ? 'realRows' : 'claims', config)}
                  />
                </div>
                <strong className="sap-kpi-value">
                  {slice.realHydration
                    ? kpis.rowCount.toLocaleString()
                    : `~${kpis.claimLines.toLocaleString()}`}
                </strong>
                <span className="sap-kpi-hint">
                  {slice.realHydration ? 'Public REAL + labeled Gaps' : 'Procedural scale cue'}
                </span>
              </article>
              <article className="sap-kpi">
                <div className="sap-kpi-top">
                  <span className="sap-kpi-label">Active visual filters</span>
                  <TileInfoButton explain={kpiTileExplain('filters', config)} />
                </div>
                <strong className="sap-kpi-value">{kpis.activeFilterCount}</strong>
                <span className="sap-kpi-hint">Click charts to refine</span>
              </article>
            </section>

            <VisualFilterBar
              config={config}
              filters={filters}
              seriesByFilter={filterSeries}
              onFilter={onFilter}
            />
          </div>
        ) : null}

        <button
          type="button"
          className="sap-header-collapse"
          onClick={() => setHeaderCollapsed((v) => !v)}
          aria-expanded={!headerCollapsed}
          title={headerCollapsed ? 'Expand analytical header' : 'Collapse analytical header'}
        >
          <span aria-hidden="true">{headerCollapsed ? '⌄' : '⌃'}</span>
          <span className="sr-only">
            {headerCollapsed ? 'Expand analytical header' : 'Collapse analytical header'}
          </span>
        </button>
      </div>

      <div
        className={`sap-alp-content sap-hybrid ${viewMode}`}
        data-walkthrough-target="alp-content"
      >
        {(viewMode === 'chart' || viewMode === 'hybrid') && (
          <ContentChart
            config={config}
            series={chartSeries}
            filters={filters}
            onFilter={onFilter}
            viewMode={viewMode}
            onViewMode={setViewMode}
          />
        )}
        {(viewMode === 'table' || viewMode === 'hybrid') && (
          <DetailList
            config={config}
            rows={slice.rows}
            scaleText={scaleText}
            onOpen={onOpenObject}
            canLoadMore={shown < slice.totalCount}
            onLoadMore={() => setPage((p) => p + 1)}
            compact={viewMode === 'hybrid'}
            viewMode={viewMode}
            onViewMode={setViewMode}
            leadItemId={guidedLeadItemId}
          />
        )}
      </div>

      <DataLineageGraph roomId={roomId} filters={filters} config={config} />
    </div>
  );
}
