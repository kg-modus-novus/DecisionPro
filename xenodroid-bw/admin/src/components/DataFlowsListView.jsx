import { useEffect, useMemo, useState } from 'react';
import { t } from '../parlance.js';
import { DATA_FLOW_CATALOG } from '../data/fixtures.js';
import { ListFilters, SortableTh, useListControls } from './listControls.jsx';

export function DataFlowsListView({
  parlance,
  rows,
  inventoryNote,
  onOpenFlow,
  onDiagramFlows,
  toast,
}) {
  const catalog = rows?.length ? rows : DATA_FLOW_CATALOG;
  const catalogKey = catalog.map((r) => r.id).join('|');
  const facets = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'loadClass', label: 'Load', getValue: (r) => r.loadClass || '—' },
    ],
    [],
  );
  const controls = useListControls(catalog, {
    searchKeys: [
      'technicalName',
      'title',
      'description',
      'note',
      'sourceSystem',
      'targetCube',
      'targetReport',
      'dataRequestId',
      (r) => r.measures,
      'lastLoadStatus',
    ],
    facets,
    initialSort: { key: 'technicalName', dir: 'asc' },
  });

  const visibleIds = controls.rows.map((r) => r.id);
  const [selected, setSelected] = useState(() => new Set(catalog.map((r) => r.id)));

  useEffect(() => {
    setSelected(new Set(catalog.map((r) => r.id)));
  }, [catalogKey]);

  const selectedVisibleCount = visibleIds.filter((id) => selected.has(id)).length;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
    } else {
      selectAllVisible();
    }
  }

  function openDiagram() {
    const chosen = catalog.filter((r) => selected.has(r.id));
    if (!chosen.length) {
      toast?.('Select at least one data flow to diagram');
      return;
    }
    onDiagramFlows?.(chosen);
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{t(parlance, 'dataFlow')}s</h2>
        <p className="hint">
          Catalog of DecisionPro BW data flows. Active rows with a canvas open the graph; planned rows are
          measure-catalog stubs only. Select flows and open Diagram for a combined bottom-up view up to
          Evidence Rooms.
        </p>
        {inventoryNote ? <p className="inventory-note">{inventoryNote}</p> : null}
      </header>
      <ListFilters controls={controls} searchPlaceholder="Filter data flows…" />
      <div className="df-list-actions" role="toolbar" aria-label="Data flow selection">
        <label className="df-select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            ref={(el) => {
              if (el) {
                el.indeterminate =
                  selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
              }
            }}
            onChange={toggleSelectAllVisible}
          />
          <span>
            {selectedVisibleCount} of {visibleIds.length} visible selected
          </span>
        </label>
        <button type="button" className="ghost" onClick={selectAllVisible}>
          Select all
        </button>
        <button type="button" className="ghost" onClick={deselectAll}>
          Deselect all
        </button>
        <button type="button" className="primary" onClick={openDiagram}>
          Diagram
        </button>
      </div>
      <table className="grid">
        <thead>
          <tr>
            <th className="df-check-col" scope="col">
              <span className="sr-only">Select</span>
            </th>
            <SortableTh label="Technical name" sortKey="technicalName" controls={controls} />
            <SortableTh label="Title" sortKey="title" controls={controls} />
            <SortableTh label="Status" sortKey="status" controls={controls} />
            <SortableTh
              label="Load"
              sortKey="loadClass"
              controls={controls}
              getValue={(r) => r.loadClass || ''}
            />
            <SortableTh
              label="Measures"
              sortKey="measures"
              controls={controls}
              getValue={(r) => r.measures.join(', ')}
            />
            <SortableTh
              label="Target"
              sortKey="targetCube"
              controls={controls}
              getValue={(r) => r.targetCube || ''}
            />
            <SortableTh
              label="Last load"
              sortKey="lastLoadAt"
              controls={controls}
              getValue={(r) => r.lastLoadAt || ''}
            />
            <th />
          </tr>
        </thead>
        <tbody>
          {controls.rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="empty-row">
                No data flows match the current filters.
              </td>
            </tr>
          ) : (
            controls.rows.map((row) => (
              <tr key={row.id} className={row.status === 'planned' ? 'row-muted' : ''}>
                <td className="df-check-col">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    aria-label={`Select ${row.technicalName}`}
                  />
                </td>
                <td>
                  <strong className="mono">{row.technicalName}</strong>
                  {row.note ? <div className="cell-sub">{row.note}</div> : null}
                </td>
                <td>
                  {row.title}
                  <div className="cell-sub">{row.description}</div>
                </td>
                <td>
                  <span className={`pill status-${row.status === 'active' ? 'completed' : 'upcoming'}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.loadClass || '—'}</td>
                <td>{row.measures.join(', ')}</td>
                <td>
                  <span className="mono">{row.targetCube || '—'}</span>
                  {row.targetReport ? <div className="cell-sub">{row.targetReport}</div> : null}
                </td>
                <td>
                  {row.lastLoadStatus ? (
                    <>
                      <span
                        className={`pill status-${row.lastLoadStatus === 'SUCCEEDED' ? 'completed' : 'upcoming'}`}
                      >
                        {row.lastLoadStatus}
                      </span>
                      <div className="cell-sub">{row.lastLoadAt || ''}</div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {row.canvasId ? (
                    <button type="button" className="linkish" onClick={() => onOpenFlow(row.canvasId)}>
                      Open
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="linkish muted"
                      onClick={() =>
                        toast?.(
                          row.status === 'planned'
                            ? `${row.technicalName} · planned (no canvas yet)`
                            : `${row.technicalName} · loaded but canvas not modeled`,
                        )
                      }
                    >
                      Info
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
