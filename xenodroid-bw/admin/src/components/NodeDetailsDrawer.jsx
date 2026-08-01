export function NodeDetailsDrawer({ node, parlance, onClose, onAction }) {
  if (!node) return null;
  const d = node.detail || {};
  return (
    <aside className="drawer" aria-label="Node details">
      <header>
        <div>
          <p className="eyebrow">Node details</p>
          <h3>{node.technicalName}</h3>
        </div>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </header>
      <dl>
        <dt>Status</dt>
        <dd className={`pill status-${node.status}`}>{node.status}</dd>
        <dt>Layer</dt>
        <dd>{d.layer || node.type}</dd>
        <dt>Title</dt>
        <dd>{node.title}</dd>
        {Object.entries(d)
          .filter(([k]) => k !== 'layer')
          .map(([k, v]) => (
            <div key={k} className="drawer-pair">
              <dt>{k}</dt>
              <dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
            </div>
          ))}
      </dl>
      <div className="drawer-actions">
        <button type="button" onClick={() => onAction?.('Display Data', node)}>
          Display Data
        </button>
        <button type="button" className="ghost" onClick={() => onAction?.('Edit', node)}>
          Edit
        </button>
        {node.type === 'dtp' ? (
          <button type="button" className="ghost" onClick={() => onAction?.('Display Monitor', node)}>
            Monitor
          </button>
        ) : null}
        <button type="button" className="ghost" onClick={() => onAction?.('Show Lineage', node)}>
          Lineage
        </button>
      </div>
      <p className="hint">Phase 1 fixture — live Postgres/PSA hook is Phase 2.</p>
    </aside>
  );
}
