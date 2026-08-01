import { SOURCE_SYSTEMS } from '../data/fixtures.js';
import { FieldMappingView, ProviderStructureView } from './StructureGraphics.jsx';

function DisplayDataBody({ data, fallbackName }) {
  if (!data) {
    return (
      <p className="hint">
        No Display Data fixture for <span className="mono">{fallbackName}</span> yet (Phase 1).
      </p>
    );
  }
  return (
    <>
      <div className="filter-bar">
        <p className="filter-toggle">▾ Hide Filter</p>
        <div className="filter-fields">
          {data.filters.map((f) => (
            <label key={f.key}>
              {f.key}
              <input readOnly value={f.value} />
            </label>
          ))}
          {data.filters.length === 0 ? <span className="hint">No filters</span> : null}
          <button type="button" className="primary" disabled>
            Apply Filter
          </button>
        </div>
      </div>
      <p className="hits">
        Number of hits: <strong>{data.hitCount}</strong>
        <span className="hint inline"> · fixture preview (not live Postgres)</span>
      </p>
      <div className="table-scroll">
        <table className="grid dense">
          <thead>
            <tr>
              <th>#</th>
              {data.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MonitorBody({ data, fallbackName }) {
  if (!data) {
    return (
      <p className="hint">
        No DTP Monitor fixture for <span className="mono">{fallbackName}</span>.
      </p>
    );
  }
  return (
    <>
      <section className="def-block">
        <h4>DTP Definition</h4>
        <dl className="def-grid">
          <div>
            <dt>Technical name</dt>
            <dd className="mono">{data.technicalName}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {data.source.type} · <span className="mono">{data.source.name}</span>
            </dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>
              {data.target.type} · <span className="mono">{data.target.name}</span>
            </dd>
          </div>
          <div>
            <dt>Extraction</dt>
            <dd>{data.extractionMode}</dd>
          </div>
          <div>
            <dt>Selection</dt>
            <dd className="mono">{data.filter}</dd>
          </div>
        </dl>
      </section>
      <section className="def-block">
        <h4>Request Monitor</h4>
        <table className="grid dense">
          <thead>
            <tr>
              <th>Request</th>
              <th>Status</th>
              <th>Records</th>
              <th>Start</th>
              <th>End</th>
              <th>Duration</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {data.requests.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.id}</td>
                <td>
                  <span className={`dot ${r.status}`} /> {r.status}
                </td>
                <td>{r.records}</td>
                <td>{r.start}</td>
                <td>{r.end}</td>
                <td>{r.duration}</td>
                <td>{r.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="drawer-actions">
        <button type="button" className="primary" disabled>
          Execute
        </button>
        <button type="button" className="ghost" disabled>
          Simulate
        </button>
        <button type="button" className="ghost" disabled>
          Jump to Error Stack
        </button>
      </div>
    </>
  );
}

function LineageBody({ data, fallbackName }) {
  if (!data?.length) {
    return (
      <p className="hint">
        No lineage fixture for <span className="mono">{fallbackName}</span>.
      </p>
    );
  }
  return (
    <ol className="lineage">
      {data.map((step, i) => (
        <li key={i}>
          <span className="lineage-idx">{i + 1}</span>
          <span className="mono">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function WhereUsedBody({ data, fallbackName }) {
  if (!data?.length) {
    return (
      <p className="hint">
        No Where-Used fixture for <span className="mono">{fallbackName}</span>.
      </p>
    );
  }
  return (
    <table className="grid dense">
      <thead>
        <tr>
          <th>Object</th>
          <th>Role</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r) => (
          <tr key={`${r.object}-${r.role}`}>
            <td className="mono">{r.object}</td>
            <td>{r.role}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DefinitionBody({ data }) {
  const node = data?.node;
  const d = node?.detail || {};
  return (
    <section className="def-block">
      <h4>{data?.action} · definition (fixture read-only)</h4>
      <dl className="def-grid">
        <div>
          <dt>Technical name</dt>
          <dd className="mono">{node?.technicalName}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{node?.type}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{node?.status}</dd>
        </div>
        {Object.entries(d).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="hint">Edit / Activate write-back is Phase 2.</p>
    </section>
  );
}

export function ContextActionModal({ display, onClose, toast }) {
  if (!display) return null;
  const { kind, title, breadcrumb, data, fallbackName } = display;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ctx-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <p className="breadcrumb">{breadcrumb}</p>
            <h2 id="ctx-modal-title">{title}</h2>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="modal-body">
          {display.loading ? <p className="hint">Loading live warehouse data…</p> : null}
          {display.error ? <p className="hint error-text">{display.error}</p> : null}
          {kind === 'display-data' && !display.loading ? (
            <DisplayDataBody data={data} fallbackName={fallbackName} />
          ) : null}
          {kind === 'monitor' && !display.loading ? (
            <MonitorBody data={data} fallbackName={fallbackName} />
          ) : null}
          {kind === 'field-mapping' ? <FieldMappingView mapping={data} /> : null}
          {kind === 'provider-structure' ? <ProviderStructureView structure={data} /> : null}
          {kind === 'lineage' ? <LineageBody data={data} fallbackName={fallbackName} /> : null}
          {kind === 'where-used' ? <WhereUsedBody data={data} fallbackName={fallbackName} /> : null}
          {kind === 'definition' ? <DefinitionBody data={data} /> : null}
          {kind === 'source-system' ? (
            (() => {
              const sys = SOURCE_SYSTEMS.find((s) => s.id === data?.fromSysId);
              return sys ? (
                <dl className="def-grid">
                  <div>
                    <dt>Technical name</dt>
                    <dd className="mono">{sys.technicalName}</dd>
                  </div>
                  <div>
                    <dt>Publisher</dt>
                    <dd>{sys.publisher}</dd>
                  </div>
                  <div>
                    <dt>TOS</dt>
                    <dd>
                      <span className={`tos tos-${sys.tosGrade}`}>{sys.tosGrade}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Base URI</dt>
                    <dd className="mono">{sys.baseUri}</dd>
                  </div>
                </dl>
              ) : (
                <p className="hint">Source system fixture not found for {data?.fromSysId}</p>
              );
            })()
          ) : null}
          {kind === 'export' ? (
            <section className="def-block">
              <dl className="def-grid">
                <div>
                  <dt>Path</dt>
                  <dd className="mono">{data.path}</dd>
                </div>
                <div>
                  <dt>Schema</dt>
                  <dd className="mono">{data.schema}</dd>
                </div>
                <div>
                  <dt>LoadClass</dt>
                  <dd>{data.loadClass}</dd>
                </div>
                <div>
                  <dt>Generated</dt>
                  <dd>{data.generatedAt}</dd>
                </div>
              </dl>
              <h4>Sample measures</h4>
              <table className="grid dense">
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.sample).map(([k, v]) => (
                    <tr key={k}>
                      <td className="mono">{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
          {kind === 'open-ui' ? (
            <div className="open-ui">
              <p>Legislative DecisionPro UI (accurate path) is separate from this admin workbench.</p>
              <a href={data.url} target="_blank" rel="noreferrer">
                {data.url}
              </a>
              <p className="hint">Opens in a new tab when the 5040 app is running.</p>
            </div>
          ) : null}
          {kind === 'run' ? (
            <section className="def-block">
              <p>
                <strong>{data.action}</strong> on{' '}
                <span className="mono">{data.node?.technicalName}</span>
              </p>
              <p className="hint">Fixture only — Phase 2 hooks CLI / molecules.</p>
              <div className="drawer-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    toast?.(`${data.action} queued (fixture) · ${data.node?.technicalName}`)
                  }
                >
                  Confirm {data.action}
                </button>
              </div>
            </section>
          ) : null}
          {kind === 'chain-log' ? (
            <section className="def-block">
              <h4>{data.action}</h4>
              <ul className="log">
                {data.log.map((line, i) => (
                  <li key={i}>
                    <span className="mono">{line.t}</span>{' '}
                    <span className={`log-${line.level.toLowerCase()}`}>{line.level}</span> {line.msg}
                  </li>
                ))}
              </ul>
              {data.action === 'Run Gate' ? (
                <div className="drawer-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => toast?.('Run Gate (fixture) — Phase 2 → npm run bw:gate')}
                  >
                    Confirm Run Gate
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
          {kind === 'generic' ? (
            <p className="hint">
              {data.action} · fixture stub for <span className="mono">{fallbackName}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
