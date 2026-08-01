import { ObjectTypeIcon } from './ObjectTypeIcon.jsx';

export function NodeDetailsDrawer({ node, parlance, onClose, onAction }) {
  if (!node) return null;
  const d = node.detail || {};
  return (
    <aside className="drawer" aria-label="Node details">
      <header>
        <div>
          <p className="eyebrow">Node details</p>
          <h3>
            <ObjectTypeIcon type={node.type} className="inline" /> {node.technicalName}
          </h3>
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
        {node.type === 'transformation' ? (
          <button type="button" className="primary" onClick={() => onAction?.('Show Field Mapping', node)}>
            Show field mapping
          </button>
        ) : null}
        {node.type === 'detailDso' || node.type === 'cube' || node.type === 'report' ? (
          <button type="button" className="primary" onClick={() => onAction?.('Show Structure', node)}>
            Show structure
          </button>
        ) : null}
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
      <p className="hint">
        {node.type === 'dtp'
          ? 'Active means a load is RUNNING. SUCCEEDED shows as Completed.'
          : 'Live warehouse when API connected; structure/mapping from modeling catalog.'}
      </p>
    </aside>
  );
}
