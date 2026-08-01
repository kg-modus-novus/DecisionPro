import { useMemo, useState, useCallback, useEffect } from 'react';
import { PARLANCE, t } from './parlance.js';
import {
  DATA_FLOWS,
  DATA_SOURCES,
  INFO_OBJECTS,
  INFO_PROVIDERS,
  LOAD_HISTORY,
  PROCESS_CHAIN,
  SOURCE_SYSTEMS,
  resolveContextDisplay,
} from './data/fixtures.js';
import { DataFlowCanvas } from './components/DataFlowCanvas.jsx';
import { NodeDetailsDrawer } from './components/NodeDetailsDrawer.jsx';
import { SourceSystemsView } from './components/SourceSystemsView.jsx';
import { ProcessChainView } from './components/ProcessChainView.jsx';
import { AdminMonitorView } from './components/AdminMonitorView.jsx';
import { DataFlowsListView } from './components/DataFlowsListView.jsx';
import { ContextActionModal } from './components/ContextActionModal.jsx';
import {
  DataSourcesView,
  InfoObjectsView,
  InfoProvidersView,
} from './components/ModelingCatalogViews.jsx';

const NAV = [
  {
    id: 'modeling',
    labelKey: 'modeling',
    items: [
      { id: 'data-flows', labelKey: 'dataFlow', label: 'Data Flows' },
      { id: 'info-providers', labelKey: 'infoProvider', label: 'InfoProviders' },
      { id: 'info-objects', labelKey: 'infoObject', label: 'InfoObjects' },
      { id: 'data-sources', labelKey: 'dataSource', label: 'DataSources' },
      { id: 'source-systems', labelKey: 'sourceSystem', label: 'Source Systems' },
      { id: 'process-chains', labelKey: 'processChain', label: 'Process Chains' },
    ],
  },
  {
    id: 'administration',
    labelKey: 'administration',
    items: [{ id: 'load-monitor', labelKey: 'loadMonitor', label: 'Load Monitor' }],
  },
];

export default function App() {
  const [parlance, setParlance] = useState('sap');
  const [openGroups, setOpenGroups] = useState({ modeling: true, administration: true });
  const [view, setView] = useState('data-flows');
  const [flowStage, setFlowStage] = useState('list'); // list | canvas
  const [flowId, setFlowId] = useState('enrollment');
  const [orientation, setOrientation] = useState('bottom-up');
  const [selectedNode, setSelectedNode] = useState(null);
  const [find, setFind] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionDisplay, setActionDisplay] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
  }, []);

  const openAction = useCallback((action, node) => {
    setActionDisplay(resolveContextDisplay(action, node || { technicalName: 'PC_POC_ACCURACY_GATE', type: 'chain' }));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const flow = DATA_FLOWS[flowId];

  const filteredNav = useMemo(() => {
    const q = find.trim().toLowerCase();
    return NAV.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (favoritesOnly && item.id !== 'data-flows') return false;
        if (!q) return true;
        const label = t(parlance, item.labelKey).toLowerCase();
        return label.includes(q) || item.id.includes(q);
      }),
    })).filter((g) => g.items.length > 0);
  }, [find, favoritesOnly, parlance]);

  function goToNav(itemId) {
    setView(itemId);
    setSelectedNode(null);
    setActionDisplay(null);
    if (itemId === 'data-flows') setFlowStage('list');
  }

  function openFlowCanvas(canvasId) {
    setView('data-flows');
    setFlowId(canvasId);
    setFlowStage('canvas');
    setSelectedNode(null);
    setActionDisplay(null);
  }

  return (
    <div className="wb">
      <header className="wb-top">
        <div className="wb-brand">
          <span className="wb-mark">XBW</span>
          <div>
            <strong>XenoDroid BW Admin</strong>
            <p>DecisionPro Kentucky · Phase 1 fixtures</p>
          </div>
        </div>
        <div className="wb-top-actions">
          <label className="parlance">
            Parlance
            <select value={parlance} onChange={(e) => setParlance(e.target.value)}>
              {Object.values(PARLANCE).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <span className="wb-port">:5043</span>
        </div>
      </header>

      <div className="wb-body">
        <aside className="wb-nav" aria-label="Workbench">
          <div className="wb-find">
            <input
              type="search"
              placeholder="Find…"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              aria-label="Find in tree"
            />
            <label className="fav">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={(e) => setFavoritesOnly(e.target.checked)}
              />
              Favorites
            </label>
          </div>

          {filteredNav.map((group) => (
            <div key={group.id} className="nav-group">
              <button
                type="button"
                className="nav-group-head"
                onClick={() =>
                  setOpenGroups((o) => ({ ...o, [group.id]: !o[group.id] }))
                }
                aria-expanded={!!openGroups[group.id]}
              >
                <span>{openGroups[group.id] ? '▾' : '▸'}</span>
                {t(parlance, group.labelKey)}
              </button>
              {openGroups[group.id]
                ? group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-item ${view === item.id ? 'active' : ''}`}
                      onClick={() => goToNav(item.id)}
                    >
                      {t(parlance, item.labelKey)}
                    </button>
                  ))
                : null}
            </div>
          ))}

          <p className="nav-deferred">Transport · Documents · BI Content — deferred</p>
        </aside>

        <main className="wb-main">
          {view === 'data-flows' && flowStage === 'list' ? (
            <DataFlowsListView
              parlance={parlance}
              onOpenFlow={(id) => {
                setFlowId(id);
                setFlowStage('canvas');
                setSelectedNode(null);
              }}
              toast={showToast}
            />
          ) : null}

          {view === 'data-flows' && flowStage === 'canvas' && flow ? (
            <>
              <div className="flow-tabs">
                <button type="button" className="ghost back" onClick={() => setFlowStage('list')}>
                  ← All data flows
                </button>
                {Object.values(DATA_FLOWS).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={flowId === f.id ? 'active' : ''}
                    onClick={() => {
                      setFlowId(f.id);
                      setSelectedNode(null);
                    }}
                  >
                    {f.title}
                  </button>
                ))}
              </div>
              <div className={`flow-layout ${selectedNode ? 'with-drawer' : ''}`}>
                <DataFlowCanvas
                  flow={flow}
                  parlance={parlance}
                  orientation={orientation}
                  onOrientationChange={setOrientation}
                  onSelectNode={setSelectedNode}
                  selectedNodeId={selectedNode?.id}
                  onAction={openAction}
                />
                <NodeDetailsDrawer
                  node={selectedNode}
                  parlance={parlance}
                  onClose={() => setSelectedNode(null)}
                  onAction={openAction}
                />
              </div>
            </>
          ) : null}

          {view === 'info-providers' ? (
            <InfoProvidersView
              parlance={parlance}
              rows={INFO_PROVIDERS}
              onAction={openAction}
              onOpenFlow={openFlowCanvas}
            />
          ) : null}

          {view === 'info-objects' ? (
            <InfoObjectsView parlance={parlance} rows={INFO_OBJECTS} onAction={openAction} />
          ) : null}

          {view === 'data-sources' ? (
            <DataSourcesView
              parlance={parlance}
              rows={DATA_SOURCES}
              onAction={openAction}
              onOpenFlow={openFlowCanvas}
            />
          ) : null}

          {view === 'source-systems' ? (
            <SourceSystemsView
              parlance={parlance}
              rows={SOURCE_SYSTEMS}
              onAction={(action, row) =>
                openAction(action, {
                  technicalName: row.technicalName,
                  type: 'psa',
                  detail: { fromSysId: row.id, layer: 'Source System' },
                })
              }
            />
          ) : null}

          {view === 'process-chains' ? (
            <ProcessChainView
              parlance={parlance}
              chain={PROCESS_CHAIN}
              orientation={orientation}
              onOrientationChange={setOrientation}
              toast={showToast}
              onAction={openAction}
            />
          ) : null}

          {view === 'load-monitor' ? (
            <AdminMonitorView parlance={parlance} history={LOAD_HISTORY} toast={showToast} />
          ) : null}
        </main>
      </div>

      <ContextActionModal
        display={actionDisplay}
        onClose={() => setActionDisplay(null)}
        toast={showToast}
      />

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
