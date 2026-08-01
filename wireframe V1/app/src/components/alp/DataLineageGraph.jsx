import { useEffect, useMemo, useState } from 'react';
import {
  ATTENTION,
  FRESHNESS,
  PERIODS,
  POPULATIONS,
  REGIONS,
  labelOf,
} from '../../data/alp/dimensions.js';
import { buildRoomLineage } from '../../lib/roomLineage.js';

/** Lineage popup columns — surface warehouse fields, not ALP list presentation keys. */
const LINEAGE_RECORD_COLUMNS = [
  { key: 'title', label: 'Title' },
  { key: 'rowKind', label: 'Kind' },
  {
    key: 'displayValue',
    label: 'Value',
    format: (_v, row) => {
      if (row.displayValue != null && row.displayValue !== '') return String(row.displayValue);
      if (row.metricValue != null && row.metricValue !== '') {
        return Number(row.metricValue).toLocaleString();
      }
      return '—';
    },
  },
  {
    key: 'metricKey',
    label: 'Metric',
    format: (v) => (v == null || v === '' ? '—' : String(v)),
  },
  {
    key: 'period',
    label: 'Period',
    format: (v) => (v == null || v === '' ? '—' : labelOf(PERIODS, v) || String(v)),
  },
  { key: 'asOfDate', label: 'As of' },
  {
    key: 'fromSysId',
    label: 'FromSysID / Gap',
    format: (_v, row) => row.fromSysId || row.gapId || '—',
  },
  {
    key: 'attention',
    label: 'Attention',
    format: (v) => (v == null || v === '' ? '—' : labelOf(ATTENTION, v) || String(v)),
  },
  {
    key: 'population',
    label: 'Population',
    format: (v) => (v == null || v === '' ? '—' : labelOf(POPULATIONS, v) || String(v)),
  },
  {
    key: 'region',
    label: 'Region',
    format: (v) => (v == null || v === '' ? '—' : labelOf(REGIONS, v) || String(v)),
  },
  {
    key: 'freshness',
    label: 'Freshness',
    format: (v) => (v == null || v === '' ? '—' : labelOf(FRESHNESS, v) || String(v)),
  },
];

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'active') return 'In scope';
  if (status === 'gap') return 'Gap';
  return 'No rows';
}

function cellText(col, row) {
  const raw = row[col.key];
  if (col.format) return col.format(raw, row);
  if (raw == null || raw === '') return '—';
  return String(raw);
}

function columnsHaveValues(columns, rows) {
  return columns.filter((col) =>
    rows.some((row) => {
      const text = cellText(col, row);
      return text != null && text !== '' && text !== '—';
    }),
  );
}

function NodeCard({ node, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`alp-lineage-node status-${node.status}${selected ? ' selected' : ''}`}
      onClick={() => onSelect(node)}
      aria-pressed={selected}
      aria-haspopup="dialog"
      title={`${node.title}: ${node.technicalName} — click to view records`}
    >
      <span className="alp-lineage-node-type">{node.title}</span>
      <strong className="alp-lineage-node-name">{node.technicalName}</strong>
      <span className="alp-lineage-node-count">
        {Number(node.recordCount || 0).toLocaleString()} records
      </span>
      <span className="alp-lineage-node-meta">{node.meta}</span>
      <span className={`alp-lineage-status status-${node.status}`}>{statusLabel(node.status)}</span>
    </button>
  );
}

function Connector() {
  return (
    <div className="alp-lineage-connector" aria-hidden="true">
      <span className="alp-lineage-arrow">↑</span>
    </div>
  );
}

function LineageRecordsModal({ node, roomColumns, filterSummary, onClose }) {
  useEffect(() => {
    if (!node) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [node, onClose]);

  if (!node) return null;
  const rows = Array.isArray(node.rows) ? node.rows : [];
  const lineageKeys = new Set(LINEAGE_RECORD_COLUMNS.map((c) => c.key));
  const extraRoomCols = columnsHaveValues(
    (roomColumns || []).filter((c) => !lineageKeys.has(c.key) && c.key !== 'title'),
    rows,
  );
  const cols = [...LINEAGE_RECORD_COLUMNS, ...extraRoomCols];

  return (
    <div
      className="alp-lineage-records-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="alp-lineage-records-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Records for ${node.technicalName}`}
      >
        <header className="alp-lineage-records-head">
          <div>
            <p className="sap-alp-eyebrow">{node.detail?.layer || node.title}</p>
            <h3>{node.technicalName}</h3>
            <p className="hint">
              {rows.length.toLocaleString()} record{rows.length === 1 ? '' : 's'}
              {filterSummary ? ` · ${filterSummary}` : ''}
            </p>
          </div>
          <button type="button" className="sap-btn ghost" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <div className="alp-lineage-records-scroll">
          <table className="alp-lineage-records-table">
            <thead>
              <tr>
                {cols.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id || `${node.id}-${idx}`} className={idx % 2 ? 'alt' : ''}>
                  {cols.map((col) => (
                    <td key={col.key}>{cellText(col, row)}</td>
                  ))}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={cols.length} className="hint">
                    No records for this node under the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function DataLineageGraph({ roomId, filters = {}, config }) {
  const [selectedId, setSelectedId] = useState(null);
  const [recordsNode, setRecordsNode] = useState(null);
  const [exporting, setExporting] = useState(false);
  const lineage = useMemo(() => buildRoomLineage(roomId, filters), [roomId, filters]);
  const selected =
    lineage.nodes.find((n) => n.id === selectedId) || lineage.layers.aggregate || null;

  function selectNode(node) {
    setSelectedId(node.id);
    setRecordsNode(node);
  }

  async function exportExcel() {
    if (exporting) return;
    setExporting(true);
    try {
      const { downloadLineageWorkbook } = await import('../../lib/exportLineageWorkbook.js');
      await downloadLineageWorkbook({ lineage, config, filters });
    } catch (err) {
      console.error('Lineage Excel export failed', err);
      window.alert('Excel export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section
      className="alp-lineage"
      data-walkthrough-target="alp-lineage"
      aria-label="Data Lineage and Provenance"
    >
      <header className="alp-lineage-head">
        <div>
          <p className="sap-alp-eyebrow">Data Lineage &amp; Provenance</p>
          <h3>{lineage.subtitle}</h3>
          <p className="hint">
            Bottom-up flow for {config?.title || roomId}. Record counts follow the current visual
            filters. Click a box to inspect its records.
          </p>
        </div>
        <div className="alp-lineage-head-actions">
          <button
            type="button"
            className="sap-btn primary"
            onClick={exportExcel}
            disabled={exporting}
            title="Download a workbook with one sheet per lineage tile plus a Report sheet"
          >
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
          <div className="alp-lineage-legend" aria-label="Status legend">
            <span className="leg completed">Completed</span>
            <span className="leg active">In scope</span>
            <span className="leg gap">Gap</span>
            <span className="leg upcoming">No rows</span>
          </div>
        </div>
      </header>

      <p className="alp-lineage-filters">
        <span className="sap-adapted-label">Filter scope</span> {lineage.filterSummary}
      </p>

      <div className="alp-lineage-body">
        <div className="alp-lineage-stack">
          <div className="alp-lineage-layer" data-layer="query">
            <NodeCard
              node={lineage.layers.query}
              selected={selected?.id === 'query'}
              onSelect={selectNode}
            />
          </div>
          <Connector />
          <div className="alp-lineage-layer" data-layer="aggregate">
            <NodeCard
              node={lineage.layers.aggregate}
              selected={selected?.id === 'aggregate'}
              onSelect={selectNode}
            />
          </div>
          <Connector />
          <div className="alp-lineage-layer" data-layer="dso">
            <NodeCard
              node={lineage.layers.dso}
              selected={selected?.id === 'dso'}
              onSelect={selectNode}
            />
          </div>
          <Connector />
          <div className="alp-lineage-layer" data-layer="transformation">
            <NodeCard
              node={lineage.layers.transformation}
              selected={selected?.id === 'trfn'}
              onSelect={selectNode}
            />
          </div>
          <Connector />
          <div className="alp-lineage-layer sources" data-layer="psa">
            {lineage.layers.psa.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                selected={selected?.id === node.id}
                onSelect={selectNode}
              />
            ))}
          </div>
          <p className="alp-lineage-floor hint">Data sources (PSA) · flow upward to query</p>
        </div>

        <aside className="alp-lineage-detail" aria-live="polite">
          <p className="sap-alp-eyebrow">Node detail</p>
          {selected ? (
            <dl>
              <dt>Layer</dt>
              <dd>{selected.detail?.layer || selected.title}</dd>
              <dt>Technical name</dt>
              <dd>{selected.technicalName}</dd>
              <dt>Record count</dt>
              <dd>{Number(selected.recordCount || 0).toLocaleString()}</dd>
              {selected.fromSysId ? (
                <>
                  <dt>FromSysID</dt>
                  <dd>{selected.fromSysId}</dd>
                </>
              ) : null}
              <dt>Status</dt>
              <dd>{statusLabel(selected.status)}</dd>
              <dt>Note</dt>
              <dd>{selected.detail?.note || selected.meta}</dd>
            </dl>
          ) : (
            <p className="hint">Select a node to inspect provenance under the active filters.</p>
          )}
          <p className="alp-lineage-totals hint">
            Scope totals · {lineage.realCount.toLocaleString()} REAL ·{' '}
            {lineage.gapCount.toLocaleString()} Gap · {lineage.totalCount.toLocaleString()} aggregate
            rows
          </p>
          {selected ? (
            <button
              type="button"
              className="sap-btn primary alp-lineage-open-records"
              onClick={() => setRecordsNode(selected)}
            >
              View records
            </button>
          ) : null}
        </aside>
      </div>

      <LineageRecordsModal
        node={recordsNode}
        roomColumns={config?.columns}
        filterSummary={lineage.filterSummary}
        onClose={() => setRecordsNode(null)}
      />
    </section>
  );
}
