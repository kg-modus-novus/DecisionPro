import { useEffect, useMemo, useState } from 'react';
import { AUTHORITATIVE_SOURCES } from '../data/alp/authoritativeSources.js';
import { DATA_SPECTRUM } from '../data/alp/dataSpectrum.js';
import { GAP_OBJECTS } from '../data/alp/gapObjects.js';
import { DATA_SPECTRUM_COLUMN_EXPLAIN } from '../lib/dataSpectrumColumnExplain.js';
import {
  buildCubeFactRowTotals,
  formatResultantCubeLine,
} from '../lib/resultantCubeDisplay.js';
import { buildSourceScaleDisplayLines } from '../lib/sourceScaleDisplay.js';
import { AsOfRangeInfoButton } from './AsOfRangeInfoButton.jsx';
import { GapDetailModal } from './GapDetailModal.jsx';
import { GlossaryTerm, GlossaryText } from './GlossaryTerm.jsx';
import { PsaLoadInfoButton } from './PsaLoadInfoButton.jsx';
import { ResultantCubeInfoButton } from './ResultantCubeInfoButton.jsx';
import { SourceDetailModal } from './SourceDetailModal.jsx';
import { SourceReconciliationPanel } from './SourceReconciliationPanel.jsx';
import { SourceScaleAbbrevButton } from './SourceScaleAbbrevButton.jsx';
import { SourceTimelinePanel } from './SourceTimelinePanel.jsx';
import { TileInfoButton } from './alp/TileInfoButton.jsx';

const CUBE_FACT_TOTALS = buildCubeFactRowTotals(DATA_SPECTRUM.rows);

function spectrumRowFor(fromSysId) {
  return (DATA_SPECTRUM.rows || []).find((r) => r.fromSysId === fromSysId) || null;
}

function SourceScaleTile({ counts, sourceId }) {
  const displayLines = counts.sourceDisplayLines || [];
  if (!displayLines.length) {
    return (
      <div className="source-scale-tile is-empty" title={counts.sourceNote || undefined}>
        <span className="source-scale-line">—</span>
      </div>
    );
  }
  const expansions = displayLines.filter((l) => l.abbreviated);
  return (
    <div
      className={`source-scale-tile${expansions.length ? ' has-abbrev' : ''}`}
      title={counts.sourceNote || undefined}
    >
      {displayLines.map((line) => (
        <span key={line.full} className="source-scale-line" title={line.abbreviated ? line.full : undefined}>
          {line.short}
        </span>
      ))}
      <SourceScaleAbbrevButton expansions={expansions} sourceId={sourceId} />
    </div>
  );
}

function ResultantCubeTile({ row }) {
  const d = row?.loadedDepth || {};
  const cubes = d.resultantCubes || [];
  const cubeCount = d.resultantCubeCount ?? cubes.length;
  const totalRows = d.resultantRowCount ?? cubes.reduce((n, c) => n + (Number(c.rowCount) || 0), 0);
  if (!cubeCount) {
    return (
      <div
        className="source-scale-tile resultant-tile is-empty"
        title="No Evidence Room cubes currently fed by this source"
      >
        <span className="source-scale-line">
          0 <GlossaryTerm id="cube">cubes</GlossaryTerm>
        </span>
        <ResultantCubeInfoButton row={row} factTotals={CUBE_FACT_TOTALS} />
      </div>
    );
  }
  return (
    <div
      className="source-scale-tile resultant-tile"
      title={`Evidence Room: ${cubeCount} cube${cubeCount === 1 ? '' : 's'}; this source ${totalRows} REAL rows (first number). Second number is full cube fact-table size.`}
    >
      <span className="source-scale-line">
        {cubeCount.toLocaleString()}{' '}
        {cubeCount === 1 ? (
          <GlossaryTerm id="cube">cube</GlossaryTerm>
        ) : (
          <GlossaryTerm id="cube">cubes</GlossaryTerm>
        )}
      </span>
      {cubes.map((c) => {
        const line = formatResultantCubeLine(c, CUBE_FACT_TOTALS);
        return (
          <span
            key={line.key}
            className="source-scale-line"
            title={`${line.label}: ${line.sourceRowCount.toLocaleString()} rows from this source · ${line.factRowCount.toLocaleString()} rows in cube fact table`}
          >
            {line.text}
          </span>
        );
      })}
      <ResultantCubeInfoButton row={row} factTotals={CUBE_FACT_TOTALS} />
    </div>
  );
}

/** Source scale = publisher SoT; Loaded = PSA; Resultant = Evidence Room cubes. */
function spectrumRowCounts(row) {
  const d = row?.loadedDepth || {};
  const loaded = d.loadedRowCount ?? d.rowCount ?? 0;
  const scale = d.sourceScale || null;
  const batchSum = (scale?.batches || []).reduce((n, b) => n + (Number(b.count) || 0), 0);
  const source =
    scale?.recordCount != null
      ? scale.recordCount
      : d.sourceRecordCount != null
        ? d.sourceRecordCount
        : d.sourceRowCount != null
          ? d.sourceRowCount
          : batchSum > 0
            ? batchSum
            : null;
  const sourceUnit = scale?.recordUnit || d.sourceRecordUnit || 'records';
  const sourceDisplayLines = buildSourceScaleDisplayLines(scale, sourceUnit);
  const sourceLines = sourceDisplayLines.map((l) => l.short);
  const sourceFullLines = sourceDisplayLines.map((l) => l.full);
  const sourceLabel =
    sourceFullLines.length > 0
      ? sourceFullLines.join(' · ')
      : source != null
        ? `${Number(source).toLocaleString()} ${sourceUnit}`
        : '—';
  const cubes = d.resultantCubes || [];
  return {
    source,
    sourceLabel,
    sourceLines: sourceLines.length ? sourceLines : sourceLabel === '—' ? [] : [sourceLabel],
    sourceDisplayLines:
      sourceDisplayLines.length
        ? sourceDisplayLines
        : sourceLabel === '—'
          ? []
          : [{ short: sourceLabel, full: sourceLabel, abbreviated: false }],
    sourceUnit,
    sourceNote: scale?.note || d.sourceRecordNote || '',
    sourceBatches: scale?.batches || [],
    loaded,
    resultant: d.resultantRowCount ?? cubes.reduce((n, c) => n + (Number(c.rowCount) || 0), 0),
    resultantCubeCount: d.resultantCubeCount ?? cubes.length,
    resultantCubes: cubes,
    landingRowCount: d.landingRowCount ?? 0,
  };
}

function formatCount(value) {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString();
}

function downloadSpectrum(format) {
  const stamp = (DATA_SPECTRUM.generatedAt || new Date().toISOString()).slice(0, 10);
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(DATA_SPECTRUM, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decisionpro-data-spectrum-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const summary = DATA_SPECTRUM.summary || {};
  const lines = [
    '# DecisionPro Data Spectrum',
    '',
    `Generated: ${DATA_SPECTRUM.generatedAt || '—'}`,
    '',
    `Loaded ${summary.sourcesLoaded ?? '—'} · Catalogued ${summary.sourcesCatalogued ?? '—'} · Blocked ${summary.sourcesBlocked ?? '—'} · Gaps ${summary.explicitGaps ?? '—'}`,
    `REAL as-of: ${summary.earliestRealAsOf || '—'} → ${summary.latestRealAsOf || '—'}`,
    '',
  ];
  for (const row of DATA_SPECTRUM.rows || []) {
    lines.push(`## ${row.fromSysId} (${row.disposition})`);
    lines.push(`Available: ${row.availableDepth || '—'}`);
    const loaded = row.loadedDepth || {};
    const counts = spectrumRowCounts(row);
    lines.push(
      `Source scale: ${counts.sourceLabel}${counts.sourceNote ? ` — ${counts.sourceNote}` : ''}`,
    );
    lines.push(
      `Loaded (PSA): ${formatCount(counts.loaded)}` +
        (loaded.earliestAsOf ? ` (${loaded.earliestAsOf} → ${loaded.latestAsOf})` : ''),
    );
    lines.push(
      `Resultant (cubes): ${counts.resultantCubeCount || 0} cubes · ${formatCount(counts.resultant)} rows` +
        (counts.resultantCubes?.length
          ? ` (${counts.resultantCubes
              .map((c) => formatResultantCubeLine(c, CUBE_FACT_TOTALS).text)
              .join('; ')})`
          : ''),
    );
    lines.push(`Used: ${(row.howUsed?.consumers || []).join(', ') || '—'}`);
    if (row.inconsistencies?.length) {
      lines.push(`Inconsistencies: ${row.inconsistencies.join('; ')}`);
    }
    lines.push(`Next: ${row.nextAction || '—'}`);
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `decisionpro-data-spectrum-${stamp}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * First-class Authoritative sources browser + Data Spectrum trust narrative.
 */
export function AuthoritativeSourcesPanel({ initialFromSysId = null, onOpenGap }) {
  const sources = AUTHORITATIVE_SOURCES.sources || [];
  const gaps = GAP_OBJECTS.gaps || [];
  const spectrumRows = DATA_SPECTRUM.rows || [];
  const summary = DATA_SPECTRUM.summary || {};
  const [tab, setTab] = useState('sources');
  const [selectedId, setSelectedId] = useState(null);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [spectrumSort, setSpectrumSort] = useState({ key: 'status', dir: 'asc' });
  const [gapDetail, setGapDetail] = useState(null);

  function toggleSpectrumSort(key) {
    const numeric =
      key === 'sourceRecords' || key === 'loadedRows' || key === 'resultantRows';
    setSpectrumSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: numeric ? 'desc' : 'asc' },
    );
  }

  useEffect(() => {
    if (initialFromSysId) {
      setSelectedId(initialFromSysId);
      setSourceModalOpen(true);
      setTab('sources');
    }
  }, [initialFromSysId]);

  function openSourceDetail(fromSysId) {
    if (!fromSysId) return;
    setSelectedId(fromSysId);
    setSourceModalOpen(true);
    setTab('sources');
  }

  function browseSource(fromSysId) {
    openSourceDetail(fromSysId);
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return sources;
    if (filter === 'LOADED') return sources.filter((s) => s.loadStatus === 'LOADED');
    if (filter === 'BLOCKED') return sources.filter((s) => s.loadStatus === 'BLOCKED');
    return sources.filter((s) => s.loadStatus === 'CATALOGUED');
  }, [sources, filter]);

  const selected = sources.find((s) => s.fromSysId === selectedId) || null;
  const spectrumSelected = spectrumRowFor(selected?.fromSysId);

  const sortedSpectrum = useMemo(() => {
    const rows = [...spectrumRows];
    const rank = { LOADED: 0, CATALOGUED: 1, BLOCKED: 2, GAP: 3 };
    const dir = spectrumSort.dir === 'desc' ? -1 : 1;
    const cmpStr = (a, b) => String(a || '').localeCompare(String(b || ''));
    rows.sort((a, b) => {
      let delta = 0;
      const ca = spectrumRowCounts(a);
      const cb = spectrumRowCounts(b);
      switch (spectrumSort.key) {
        case 'sourceRecords':
          delta = (ca.source ?? -1) - (cb.source ?? -1);
          break;
        case 'loadedRows':
          delta = ca.loaded - cb.loaded;
          break;
        case 'resultantRows':
          delta = ca.resultant - cb.resultant;
          break;
        case 'status':
          delta = (rank[a.disposition] ?? 9) - (rank[b.disposition] ?? 9);
          break;
        case 'asOf':
          delta = cmpStr(
            a.loadedDepth?.latestAsOf || a.loadedDepth?.earliestAsOf,
            b.loadedDepth?.latestAsOf || b.loadedDepth?.earliestAsOf,
          );
          break;
        case 'series':
          delta = cmpStr(a.provides?.seriesKind, b.provides?.seriesKind);
          break;
        case 'id':
        default:
          delta = cmpStr(a.fromSysId, b.fromSysId);
          break;
      }
      if (delta === 0) delta = cmpStr(a.fromSysId, b.fromSysId);
      return delta * dir;
    });
    return rows;
  }, [spectrumRows, spectrumSort]);

  const sourceListExecutive = useMemo(() => {
    const loaded = summary.sourcesLoaded ?? sources.filter((s) => s.loadStatus === 'LOADED').length;
    const catalogued =
      summary.sourcesCatalogued ?? sources.filter((s) => s.loadStatus === 'CATALOGUED').length;
    const blocked =
      summary.sourcesBlocked ?? sources.filter((s) => s.loadStatus === 'BLOCKED').length;
    const gapCount = summary.explicitGaps ?? gaps.length;
    const totalSources = sources.length;
    const asOfStart = summary.earliestRealAsOf || '—';
    const asOfEnd = summary.latestRealAsOf || '—';
    const landingRows = summary.landingRowCount;
    const exportedAt = AUTHORITATIVE_SOURCES.generatedAt
      ? new Date(AUTHORITATIVE_SOURCES.generatedAt).toLocaleString(undefined, {
          dateStyle: 'long',
          timeStyle: 'short',
        })
      : null;

    return {
      what:
        'The Source List is DecisionPro Kentucky’s catalogue of authoritative public sources for legislative Medicaid analytics. Each entry identifies the publisher, terms-of-use grade, attribution notes, load status, and links to the government page or file that owns the data.',
      why:
        'Staff should never have to guess where a figure came from, whether DecisionPro is allowed to use it on the public path, or what still requires a paid or DUA follow-on. This list makes provenance and access limits visible before anyone treats a number as settled fact.',
      how:
        'Browse the catalogue and Data Spectrum below to see what is available from each source of truth, what this warehouse has loaded as REAL data, where the dashboard consumes it, and which Explicit Gaps cannot be filled from the public web alone. Open Source Timeline for a 10-year slot map per source, or Source Reconciliation for the independent check that loaded values still match their owning publications.',
      results: exportedAt
        ? `This catalogue currently lists ${totalSources} sources: ${loaded} loaded into the accurate path, ${catalogued} catalogued but not yet loaded, and ${blocked} blocked or restricted. There are ${gapCount} Explicit Gaps that name authorized feeds still needed. REAL facts on this path span as-of dates from ${asOfStart} through ${asOfEnd}${
            landingRows != null ? `, with ${landingRows} landing cube rows in the latest inventory` : ''
          }. Catalogue export time: ${exportedAt}.`
        : `This catalogue currently lists ${totalSources} sources: ${loaded} loaded, ${catalogued} catalogued, and ${blocked} blocked or restricted, with ${gapCount} Explicit Gaps.`,
      loaded,
      catalogued,
      blocked,
      gapCount,
      asOfStart,
      asOfEnd,
    };
  }, [summary, sources, gaps.length]);

  return (
    <section className="authoritative-sources" data-walkthrough-target="authoritative-sources">
      <header className="accurate-landing-header">
        <div>
          <p className="accurate-eyebrow">Trust surface</p>
          <h2>Authoritative sources</h2>
          <p className="hint">
            {AUTHORITATIVE_SOURCES.note ||
              'Public government sources for DecisionPro Kentucky. Grades are POC working judgments.'}
          </p>
          {AUTHORITATIVE_SOURCES.generatedAt ? (
            <p className="hint accurate-generated">Exported {AUTHORITATIVE_SOURCES.generatedAt}</p>
          ) : null}
        </div>
        {tab === 'sources' ? (
          <label className="sources-filter">
            <span className="sr-only">Filter by load status</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All sources</option>
              <option value="LOADED">Loaded</option>
              <option value="CATALOGUED">Catalogued</option>
              <option value="BLOCKED">Blocked / restricted</option>
            </select>
          </label>
        ) : null}
      </header>

      <div className="sources-tab-row tab-row" role="tablist" aria-label="Authoritative sources views">
        <button
          type="button"
          role="tab"
          id="auth-tab-sources"
          aria-selected={tab === 'sources'}
          aria-controls="auth-panel-sources"
          className={`focus-tab ${tab === 'sources' ? 'on' : ''}`}
          onClick={() => setTab('sources')}
        >
          Source List
        </button>
        <button
          type="button"
          role="tab"
          id="auth-tab-recon"
          aria-selected={tab === 'reconciliation'}
          aria-controls="auth-panel-recon"
          className={`focus-tab ${tab === 'reconciliation' ? 'on' : ''}`}
          onClick={() => setTab('reconciliation')}
        >
          Source Reconciliation
        </button>
        <button
          type="button"
          role="tab"
          id="auth-tab-timeline"
          aria-selected={tab === 'timeline'}
          aria-controls="auth-panel-timeline"
          className={`focus-tab ${tab === 'timeline' ? 'on' : ''}`}
          onClick={() => setTab('timeline')}
        >
          Source Timeline
        </button>
      </div>

      {tab === 'reconciliation' ? (
        <div
          id="auth-panel-recon"
          role="tabpanel"
          aria-labelledby="auth-tab-recon"
          className="sources-tab-panel"
        >
          <SourceReconciliationPanel onBrowseSource={browseSource} />
        </div>
      ) : null}

      {tab === 'timeline' ? (
        <div
          id="auth-panel-timeline"
          role="tabpanel"
          aria-labelledby="auth-tab-timeline"
          className="sources-tab-panel"
        >
          <SourceTimelinePanel />
        </div>
      ) : null}

      {tab === 'sources' ? (
      <div
        id="auth-panel-sources"
        role="tabpanel"
        aria-labelledby="auth-tab-sources"
        className="sources-tab-panel"
      >
      <section className="source-recon-summary sources-list-executive" aria-label="Source List executive summary">
        <div className="source-recon-summary-head">
          <div>
            <p className="accurate-eyebrow">Overview</p>
            <h4>Executive summary</h4>
          </div>
        </div>
        <div className="source-recon-prose source-desc-sections">
          <div className="source-desc-section">
            <h4 className="source-desc-heading">What it is</h4>
            <p className="source-desc-body">{sourceListExecutive.what}</p>
          </div>
          <div className="source-desc-section">
            <h4 className="source-desc-heading">Why we publish it</h4>
            <p className="source-desc-body">{sourceListExecutive.why}</p>
          </div>
          <div className="source-desc-section">
            <h4 className="source-desc-heading">How to use this tab</h4>
            <p className="source-desc-body">{sourceListExecutive.how}</p>
          </div>
          <div className="source-desc-section">
            <h4 className="source-desc-heading">Current inventory</h4>
            <p className="source-desc-body">{sourceListExecutive.results}</p>
          </div>
        </div>
        <ul className="data-spectrum-chips source-recon-chips" aria-label="Source inventory counts">
          <li title="Authoritative sources with REAL data already bound into the warehouse">
            <strong>{sourceListExecutive.loaded}</strong>
            <span>sources loaded</span>
          </li>
          <li title="Known publisher sources not yet bound into the accurate path">
            <strong>{sourceListExecutive.catalogued}</strong>
            <span>sources catalogued</span>
          </li>
          <li title="Sources blocked by license, DUA, or out-of-POC restriction">
            <strong>{sourceListExecutive.blocked}</strong>
            <span>sources blocked</span>
          </li>
          <li title="Explicit Gap objects — labeled holes that need authorized feeds">
            <strong>{sourceListExecutive.gapCount}</strong>
            <span>explicit gaps</span>
          </li>
          <li className="data-spectrum-chip-wide">
            <strong>
              {sourceListExecutive.asOfStart} → {sourceListExecutive.asOfEnd}
            </strong>
            <span>REAL as-of window</span>
          </li>
        </ul>
      </section>

      <section className="data-spectrum-strip" aria-label="Data Spectrum summary">
        <div className="data-spectrum-strip-head">
          <div>
            <p className="accurate-eyebrow">Data Spectrum</p>
            <h3>Available vs loaded vs used</h3>
            <p className="hint">
              <GlossaryText text="Accuracy Gate–exported inventory of public Source of Truth depth. Use each column heading i for definitions, or open Glossary for BW terms. Source scale is publisher batching/totals; Loaded is PSA land; Resultant is Evidence Room cubes this source feeds (cube count + this-source rows · full fact-table size). Explicit Gaps stay labeled — never unlabeled history." />
            </p>
          </div>
          <div className="data-spectrum-actions">
            <button type="button" className="linkish" onClick={() => downloadSpectrum('json')}>
              Download JSON
            </button>
            <button type="button" className="linkish" onClick={() => downloadSpectrum('md')}>
              Download Markdown
            </button>
          </div>
        </div>
        <ul className="data-spectrum-chips" aria-label="Data Spectrum source counts">
          <li title="Authoritative sources with REAL data already bound into the warehouse">
            <strong>{summary.sourcesLoaded ?? '—'}</strong>
            <span>sources loaded</span>
          </li>
          <li title="Known publisher sources not yet bound into the accurate path">
            <strong>{summary.sourcesCatalogued ?? '—'}</strong>
            <span>sources catalogued</span>
          </li>
          <li title="Sources blocked by license, DUA, or out-of-POC restriction">
            <strong>{summary.sourcesBlocked ?? '—'}</strong>
            <span>sources blocked</span>
          </li>
          <li title="Explicit Gap objects — labeled holes that need authorized feeds, not unlabeled missing history">
            <strong>{summary.explicitGaps ?? '—'}</strong>
            <span>explicit gaps</span>
          </li>
          <li className="data-spectrum-chip-wide">
            <strong>
              {summary.earliestRealAsOf || '—'} → {summary.latestRealAsOf || '—'}
            </strong>
            <span>REAL as-of window</span>
          </li>
          <li className="data-spectrum-chip-wide">
            <strong>{summary.gateTimestamp ? String(summary.gateTimestamp).slice(0, 19) : '—'}</strong>
            <span>Gate timestamp</span>
          </li>
        </ul>

        <div className="data-spectrum-table-wrap">
          <table className="data-spectrum-table">
            <thead>
              <tr>
                {[
                  {
                    key: 'id',
                    label: (
                      <>
                        Source / <GlossaryTerm id="explicit-gap">Gap</GlossaryTerm>
                      </>
                    ),
                  },
                  { key: 'status', label: 'Status' },
                  {
                    key: 'sourceRecords',
                    label: <GlossaryTerm id="source-scale">Source scale</GlossaryTerm>,
                  },
                  {
                    key: 'loadedRows',
                    label: (
                      <>
                        Loaded (<GlossaryTerm id="psa">PSA</GlossaryTerm>)
                      </>
                    ),
                  },
                  {
                    key: 'resultantRows',
                    label: (
                      <>
                        Resultant (<GlossaryTerm id="cube">cubes</GlossaryTerm>)
                      </>
                    ),
                  },
                  { key: 'asOf', label: <GlossaryTerm id="as-of">As-of</GlossaryTerm> },
                  { key: 'series', label: 'Series' },
                ].map((col) => {
                  const active = spectrumSort.key === col.key;
                  const ariaSort = active
                    ? spectrumSort.dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none';
                  const colExplain = DATA_SPECTRUM_COLUMN_EXPLAIN[col.key];
                  return (
                    <th key={col.key} scope="col" aria-sort={ariaSort}>
                      <div className="data-spectrum-th">
                        <button
                          type="button"
                          className={`data-spectrum-sort-btn${active ? ' is-active' : ''}`}
                          onClick={() => toggleSpectrumSort(col.key)}
                        >
                          <span>{col.label}</span>
                          <span className="data-spectrum-sort-ind" aria-hidden="true">
                            {active ? (spectrumSort.dir === 'asc' ? '▲' : '▼') : '◇'}
                          </span>
                        </button>
                        {colExplain ? (
                          <span
                            className="data-spectrum-th-info"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <TileInfoButton explain={colExplain} />
                          </span>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedSpectrum.map((row) => (
                <tr
                  key={row.fromSysId}
                  className={row.fromSysId === selectedId ? 'is-selected' : ''}
                >
                  <td>
                    <button
                      type="button"
                      className="data-spectrum-row-btn"
                      onClick={() => {
                        if (row.kind === 'gap') {
                          const g = gaps.find((x) => x.gapId === row.fromSysId);
                          if (g) {
                            setGapDetail(g);
                            onOpenGap?.(g);
                          }
                          return;
                        }
                        openSourceDetail(row.fromSysId);
                      }}
                    >
                      {row.fromSysId}
                    </button>
                  </td>
                  <td>
                    <span className={`sources-status is-${String(row.disposition || '').toLowerCase()}`}>
                      {row.disposition}
                    </span>
                  </td>
                  <td className="data-spectrum-scale-cell">
                    <SourceScaleTile counts={spectrumRowCounts(row)} sourceId={row.fromSysId} />
                  </td>
                  <td className="data-spectrum-psa-cell" title="Records landed into PSA">
                    <div className="source-scale-tile psa-tile">
                      <span className="source-scale-line">
                        {formatCount(spectrumRowCounts(row).loaded)}
                      </span>
                      <PsaLoadInfoButton row={row} />
                    </div>
                  </td>
                  <td className="data-spectrum-resultant-cell">
                    <ResultantCubeTile row={row} />
                  </td>
                  <td className="data-spectrum-asof-cell">
                    {row.loadedDepth?.earliestAsOf ? (
                      <div className="source-scale-tile asof-tile">
                        <span className="source-scale-line asof-tile-start">
                          {row.loadedDepth.earliestAsOf}
                        </span>
                        <span className="source-scale-line">
                          {row.loadedDepth.latestAsOf || row.loadedDepth.earliestAsOf}
                        </span>
                        <AsOfRangeInfoButton row={row} />
                      </div>
                    ) : (
                      <div className="source-scale-tile asof-tile is-empty">
                        <span className="source-scale-line">—</span>
                        <AsOfRangeInfoButton row={row} />
                      </div>
                    )}
                  </td>
                  <td>{row.provides?.seriesKind || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sources-catalogue" aria-label="Authoritative source catalogue">
        <h3>Source catalogue</h3>
        <p className="hint">
          Click a source name to open its publisher details, links, and Data Spectrum inventory in a
          dialog.
        </p>
        <ul className="sources-list sources-list-grid" aria-label="Authoritative source catalogue">
          {filtered.map((s) => {
            const spectrum = spectrumRowFor(s.fromSysId);
            const description =
              s.attributionNotes ||
              spectrum?.availableDepth ||
              'Public authoritative source listed for DecisionPro Kentucky.';
            return (
              <li key={s.fromSysId}>
                <button
                  type="button"
                  className={s.fromSysId === selectedId && sourceModalOpen ? 'active' : ''}
                  onClick={() => openSourceDetail(s.fromSysId)}
                >
                  <strong>{s.fromSysId}</strong>
                  <span className={`sources-status is-${(s.loadStatus || '').toLowerCase()}`}>
                    {s.loadStatus}
                  </span>
                  <span className="sources-tile-description">{description}</span>
                  <span className="hint">{s.publisher}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sources-gaps" aria-label="Explicit paid gaps">
        <h3>Explicit gaps (cannot fill from public web alone)</h3>
        <p className="hint sources-gaps-glossary">
          <GlossaryText text="Each tile is an Explicit Gap — a known hole in the accurate path. Access path (paid / DUA) is the commercial or authorized next step — not a price list. Click a tile for publishers, cadence, who requests access, incorporation steps, and dashboard impact." />
        </p>
        <ul className="accurate-smart-grid">
          {gaps.map((g) => (
            <li key={g.gapId}>
              <button
                type="button"
                className="accurate-smart-tile role-home-measure is-info"
                onClick={() => {
                  setGapDetail(g);
                  onOpenGap?.(g);
                }}
              >
                <span className="role-home-measure-kind">Gap · {g.gapId}</span>
                <strong className="role-home-measure-title">{g.title}</strong>
                <p className="role-home-measure-comparison">{g.need}</p>
                <div className="role-home-measure-why">
                  <strong>Access path (paid / DUA)</strong>
                  <span>{g.paidFollowOn}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <SourceDetailModal
        source={sourceModalOpen ? selected : null}
        spectrum={sourceModalOpen ? spectrumSelected : null}
        onClose={() => setSourceModalOpen(false)}
      />
      <GapDetailModal
        gap={gapDetail}
        onClose={() => setGapDetail(null)}
        onBrowseSource={browseSource}
      />
      </div>
      ) : null}
    </section>
  );
}
