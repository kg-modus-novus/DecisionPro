export function DetailList({
  config,
  rows,
  scaleText,
  onOpen,
  canLoadMore,
  onLoadMore,
  compact = false,
  viewMode,
  onViewMode,
  leadItemId = null,
}) {
  const leadId = leadItemId || rows[0]?.id || null;
  return (
    <section
      className={`alp-detail-list sap-list ${compact ? 'compact' : ''}`}
      aria-label="Detail list"
      data-walkthrough-target="alp-detail-list"
    >
      <header className="alp-section-head sap-section-head">
        <div>
          <h3>Items ({rows.length.toLocaleString()})</h3>
          <p className="hint">{scaleText || 'Row title links open the object page'}</p>
        </div>
        <div className="sap-list-actions">
          {onViewMode && viewMode !== 'hybrid' ? (
            <div className="alp-view-toggle" role="group" aria-label="Content view">
              {['chart', 'hybrid', 'table'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={viewMode === mode ? 'on' : ''}
                  onClick={() => onViewMode(mode)}
                >
                  {mode === 'chart' ? 'Chart' : mode === 'hybrid' ? 'Hybrid' : 'Table'}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">Aggregate warehouse rows · filtered list</p>
          )}
        </div>
      </header>
      <div className="alp-table-wrap sap-table-wrap">
        <table className="alp-table sap-table">
          <thead>
            <tr>
              {config.columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`${idx % 2 ? 'alt' : ''}${row.id === leadId ? ' is-lead-item' : ''}`}
                data-walkthrough-target={row.id === leadId ? 'alp-lead-item' : undefined}
              >
                {config.columns.map((col) => {
                  const raw = row[col.key];
                  const text = col.format ? col.format(raw, row) : raw;
                  return (
                    <td key={col.key}>
                      {col.link ? (
                        <button
                          type="button"
                          className="alp-obj-link"
                          onClick={() => onOpen(row)}
                          data-walkthrough-target={
                            row.id === leadId && col.link ? 'alp-lead-item-link' : undefined
                          }
                        >
                          {text}
                        </button>
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
                <td>
                  <button
                    type="button"
                    className="alp-chevron sap-nav"
                    onClick={() => onOpen(row)}
                    aria-label={`Open ${row.title}`}
                  >
                    ›
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={config.columns.length + 1} className="hint">
                  No rows for current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canLoadMore ? (
        <div className="alp-load-more">
          <button type="button" className="sap-btn primary" onClick={onLoadMore}>
            Load more aggregates
          </button>
        </div>
      ) : null}
    </section>
  );
}
