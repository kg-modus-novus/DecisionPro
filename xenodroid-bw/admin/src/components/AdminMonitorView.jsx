import { useMemo } from 'react';
import { t } from '../parlance.js';
import { ListFilters, SortableTh, useListControls } from './listControls.jsx';

export function AdminMonitorView({ parlance, history, toast }) {
  const facets = useMemo(
    () => [
      { key: 'loadClass', label: 'Class' },
      { key: 'status', label: 'Status' },
    ],
    [],
  );
  const controls = useListControls(history, {
    searchKeys: ['id', 'dataRequestId', 'loadClass', 'status', 'asOfDate', 'completedAt'],
    facets,
    initialSort: { key: 'completedAt', dir: 'desc' },
  });

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{t(parlance, 'loadMonitor')}</h2>
        <p className="hint">LoadHistory fixtures — live bw_ctl.load_history in Phase 2.</p>
      </header>
      <div className="admin-actions">
        <button type="button" onClick={() => toast?.('Run Gate (fixture) — Phase 2 → npm run bw:gate')}>
          Run accuracy gate
        </button>
        <button type="button" className="ghost" onClick={() => toast?.('Purge TEST (fixture)')}>
          Purge TEST
        </button>
      </div>
      <ListFilters controls={controls} searchPlaceholder="Filter load history…" />
      <table className="grid">
        <thead>
          <tr>
            <SortableTh label="LoadHistory" sortKey="id" controls={controls} />
            <SortableTh label="Data Request" sortKey="dataRequestId" controls={controls} />
            <SortableTh label="Class" sortKey="loadClass" controls={controls} />
            <SortableTh label="Status" sortKey="status" controls={controls} />
            <SortableTh label="Rows" sortKey="rowCount" controls={controls} />
            <SortableTh
              label="AsOf"
              sortKey="asOfDate"
              controls={controls}
              getValue={(r) => r.asOfDate || ''}
            />
            <SortableTh label="Completed" sortKey="completedAt" controls={controls} />
          </tr>
        </thead>
        <tbody>
          {controls.rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="empty-row">
                No load history rows match the current filters.
              </td>
            </tr>
          ) : (
            controls.rows.map((h) => (
              <tr key={h.id}>
                <td>{h.id}</td>
                <td>{h.dataRequestId}</td>
                <td>{h.loadClass}</td>
                <td>
                  <span
                    className={`pill status-${h.status === 'SUCCEEDED' ? 'completed' : h.status === 'PURGED' ? 'upcoming' : 'active'}`}
                  >
                    {h.status}
                  </span>
                </td>
                <td>{h.rowCount}</td>
                <td>{h.asOfDate || '—'}</td>
                <td>{h.completedAt}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
