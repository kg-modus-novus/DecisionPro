import { useMemo, useState } from 'react';
import { t } from '../parlance.js';
import { ListFilters, SortableTh, useListControls } from './listControls.jsx';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

function LoadAlertsPanel({ alerts }) {
  const [openId, setOpenId] = useState(null);
  const list = alerts || [];
  const errors = list.filter((a) => a.severity === 'error').length;
  const warnings = list.filter((a) => a.severity === 'warning').length;

  if (!list.length) {
    return (
      <section className="load-alerts load-alerts-empty" aria-label="URI resolution alerts">
        <header className="load-alerts-head">
          <h3>URI resolution alerts</h3>
          <span className="pill status-completed">None open</span>
        </header>
        <p className="hint">
          Unresolved 404s and fallback resolutions from Core Set / archive probes appear here after
          gate export (`ExportUriResolutionLog`).
        </p>
      </section>
    );
  }

  return (
    <section className="load-alerts" aria-label="URI resolution alerts">
      <header className="load-alerts-head">
        <div>
          <h3>URI resolution alerts</h3>
          <p className="hint">
            Persistent load-path messaging — not toast. Errors need an authoritative URL; warnings
            mean a candidate 404’d before a fallback succeeded.
          </p>
        </div>
        <div className="load-alerts-counts">
          {errors ? <span className="pill status-error">{errors} error</span> : null}
          {warnings ? <span className="pill status-upcoming">{warnings} warning</span> : null}
          <span className="pill status-active">{list.length} total</span>
        </div>
      </header>
      <ul className="load-alerts-list">
        {list.map((a) => {
          const open = openId === a.id;
          return (
            <li key={a.id} className={`load-alert severity-${a.severity}`}>
              <button
                type="button"
                className="load-alert-summary"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : a.id)}
              >
                <span className={`pill status-${a.severity === 'error' ? 'error' : 'upcoming'}`}>
                  {a.severity}
                </span>
                <strong>{a.title}</strong>
                <span className="muted">{a.fromSysId}</span>
                <span className="muted">{formatWhen(a.observedAt)}</span>
                <span className="load-alert-chevron" aria-hidden>
                  {open ? '▾' : '▸'}
                </span>
              </button>
              {open ? (
                <div className="load-alert-detail">
                  <p>{a.explanation}</p>
                  <dl className="load-alert-dl">
                    <dt>Kind</dt>
                    <dd>{a.kind}</dd>
                    <dt>FromSysID</dt>
                    <dd>{a.fromSysId}</dd>
                    {a.dataRequestId ? (
                      <>
                        <dt>Data request</dt>
                        <dd>{a.dataRequestId}</dd>
                      </>
                    ) : null}
                    {a.periodId ? (
                      <>
                        <dt>Period</dt>
                        <dd>{a.periodId}</dd>
                      </>
                    ) : null}
                    {a.loadHistoryId ? (
                      <>
                        <dt>LoadHistory</dt>
                        <dd>{a.loadHistoryId}</dd>
                      </>
                    ) : null}
                    {a.failedUrls?.length ? (
                      <>
                        <dt>Failed URIs</dt>
                        <dd>
                          <ul className="load-alert-urls">
                            {a.failedUrls.map((u) => (
                              <li key={u}>
                                <code>{u}</code>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    ) : null}
                    {a.resolvedUrl ? (
                      <>
                        <dt>Resolved URI</dt>
                        <dd>
                          <a href={a.resolvedUrl} target="_blank" rel="noreferrer">
                            {a.resolvedUrl}
                          </a>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  <div className="load-alert-log">
                    <h4>Probe log</h4>
                    <pre>{(a.logs || []).join('\n')}</pre>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AdminMonitorView({ parlance, history, alerts, toast }) {
  const facets = useMemo(
    () => [
      { key: 'loadClass', label: 'Class' },
      { key: 'status', label: 'Status' },
    ],
    [],
  );
  const controls = useListControls(history, {
    searchKeys: ['id', 'dataRequestId', 'loadClass', 'status', 'asOfDate', 'completedAt', 'sourceUri', 'notes'],
    facets,
    initialSort: { key: 'completedAt', dir: 'desc' },
  });

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{t(parlance, 'loadMonitor')}</h2>
        <p className="hint">
          LoadHistory from bw_ctl.load_history (live) or fixtures. URI 404 / fallback alerts refresh on
          gate export.
        </p>
      </header>

      <LoadAlertsPanel alerts={alerts} />

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
                    className={`pill status-${h.status === 'SUCCEEDED' ? 'completed' : h.status === 'PURGED' ? 'upcoming' : h.status === 'FAILED' ? 'error' : 'active'}`}
                  >
                    {h.status}
                  </span>
                </td>
                <td>{h.rowCount}</td>
                <td>{h.asOfDate || '—'}</td>
                <td title={h.sourceUri || h.notes || ''}>{h.completedAt}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
