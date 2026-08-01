import { useMemo } from 'react';
import { t } from '../parlance.js';
import { DATA_FLOW_CATALOG } from '../data/fixtures.js';
import { ListFilters, SortableTh, useListControls } from './listControls.jsx';

export function DataFlowsListView({ parlance, onOpenFlow, toast }) {
  const facets = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'loadClass', label: 'Load', getValue: (r) => r.loadClass || '—' },
    ],
    [],
  );
  const controls = useListControls(DATA_FLOW_CATALOG, {
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

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{t(parlance, 'dataFlow')}s</h2>
        <p className="hint">
          Catalog of DecisionPro BW data flows. Active rows with a canvas open the graph; planned rows are
          measure-catalog stubs only.
        </p>
      </header>
      <ListFilters controls={controls} searchPlaceholder="Filter data flows…" />
      <table className="grid">
        <thead>
          <tr>
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
              <td colSpan={8} className="empty-row">
                No data flows match the current filters.
              </td>
            </tr>
          ) : (
            controls.rows.map((row) => (
              <tr key={row.id} className={row.status === 'planned' ? 'row-muted' : ''}>
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
