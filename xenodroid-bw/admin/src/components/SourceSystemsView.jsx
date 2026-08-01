import { useMemo } from 'react';
import { t } from '../parlance.js';
import { ListFilters, SortableTh, useListControls } from './listControls.jsx';

export function SourceSystemsView({ parlance, rows, onAction }) {
  const facets = useMemo(
    () => [
      { key: 'tosGrade', label: 'TOS' },
      { key: 'status', label: 'Status' },
    ],
    [],
  );
  const controls = useListControls(rows, {
    searchKeys: ['technicalName', 'publisher', 'baseUri', 'tosGrade', 'status'],
    facets,
    initialSort: { key: 'technicalName', dir: 'asc' },
  });

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{t(parlance, 'sourceSystem')}s</h2>
        <p className="hint">TOS grades gate accurate-path ingest (SAFE / ATTRIBUTABLE).</p>
      </header>
      <ListFilters controls={controls} searchPlaceholder="Filter Source Systems…" />
      <table className="grid">
        <thead>
          <tr>
            <SortableTh label="Technical name" sortKey="technicalName" controls={controls} />
            <SortableTh label="Publisher" sortKey="publisher" controls={controls} />
            <SortableTh label="TOS" sortKey="tosGrade" controls={controls} />
            <SortableTh label="Status" sortKey="status" controls={controls} />
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {controls.rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty-row">
                No Source Systems match the current filters.
              </td>
            </tr>
          ) : (
            controls.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.technicalName}</strong>
                  <div className="cell-sub">{r.baseUri}</div>
                </td>
                <td>{r.publisher}</td>
                <td>
                  <span className={`tos tos-${r.tosGrade}`}>{r.tosGrade}</span>
                </td>
                <td>{r.status}</td>
                <td>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => onAction?.('Open Source System', r)}
                  >
                    Display
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
