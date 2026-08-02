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
import { fetchDisplayData, fetchDtpMonitor, fetchHealth, fetchWorkbench } from './api/client.js';
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
import { buildCombinedDataFlowGraph } from './lib/combinedDataFlowGraph.js';

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

const FIXTURE_WORKBENCH = {
  mode: 'fixture',
  sourceSystems: SOURCE_SYSTEMS,
  dataSources: DATA_SOURCES,
  infoProviders: INFO_PROVIDERS,
  infoObjects: INFO_OBJECTS,
  dataFlowCatalog: null,
  dataFlows: DATA_FLOWS,
  loadMonitor: LOAD_HISTORY,
  processChain: PROCESS_CHAIN,
  stats: null,
  accurateHighlights: null,
};

export default function App() {
  const [parlance, setParlance] = useState('sap');
  const [openGroups, setOpenGroups] = useState({ modeling: true, administration: true });
  const [view, setView] = useState('data-flows');
  const [flowStage, setFlowStage] = useState('list');
  const [flowId, setFlowId] = useState('enrollment');
  const [combinedFlow, setCombinedFlow] = useState(null);
  const [orientation, setOrientation] = useState('bottom-up');
  const [selectedNode, setSelectedNode] = useState(null);
  const [find, setFind] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionDisplay, setActionDisplay] = useState(null);
  const [workbench, setWorkbench] = useState(FIXTURE_WORKBENCH);
  const [dataMode, setDataMode] = useState('loading');
  const [loadError, setLoadError] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
  }, []);

  const refreshWorkbench = useCallback(async () => {
    setLoadError(null);
    try {
      await fetchHealth();
      const snap = await fetchWorkbench();
      setWorkbench(snap);
      setDataMode('live');
    } catch (e) {
      setWorkbench(FIXTURE_WORKBENCH);
      setDataMode('fixture');
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshWorkbench();
  }, [refreshWorkbench]);

  const openAction = useCallback(
    async (action, node) => {
      const target = node || { technicalName: 'PC_POC_ACCURACY_GATE', type: 'chain' };
      const base = resolveContextDisplay(action, target);

      if (action === 'Show Field Mapping') {
        const mapping = workbench.transformationMappings?.[target.technicalName] || null;
        setActionDisplay({
          ...base,
          kind: 'field-mapping',
          title: 'Field Mapping',
          data: mapping,
          fallbackName: target.technicalName,
        });
        return;
      }

      if (action === 'Show Structure' || action === 'Open InfoProvider') {
        const structure = workbench.providerStructures?.[target.technicalName] || null;
        setActionDisplay({
          ...base,
          kind: 'provider-structure',
          title: 'Provider Structure',
          data: structure,
          fallbackName: target.technicalName,
        });
        return;
      }

      if (dataMode === 'live' && (action === 'Display Data' || action === 'Display')) {
        setActionDisplay({
          ...base,
          title: 'Display Data',
          data: null,
          loading: true,
        });
        try {
          const res = await fetchDisplayData(target.technicalName);
          setActionDisplay({
            ...base,
            kind: 'display-data',
            title: 'Display Data',
            breadcrumb: `Data Flow > ${target.technicalName} > Display Data (live)`,
            data: res.data,
            loading: false,
          });
        } catch (e) {
          setActionDisplay({
            ...base,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      if (dataMode === 'live' && action === 'Display Monitor') {
        setActionDisplay({
          ...base,
          kind: 'monitor',
          title: 'DTP Monitor',
          data: null,
          loading: true,
        });
        try {
          const res = await fetchDtpMonitor(target.technicalName);
          setActionDisplay({
            ...base,
            kind: 'monitor',
            title: 'DTP Monitor',
            breadcrumb: `Data Flow > ${target.technicalName} > Display Monitor (live)`,
            data: res.data,
            loading: false,
          });
        } catch (e) {
          setActionDisplay({
            ...base,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      setActionDisplay(base);
    },
    [dataMode, workbench],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const dataFlows = workbench.dataFlows || DATA_FLOWS;
  const flow = dataFlows[flowId];
  const flowTabs = Object.values(dataFlows);

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
    if (itemId === 'data-flows') {
      setFlowStage('list');
      setCombinedFlow(null);
    }
  }

  function openFlowCanvas(canvasId) {
    if (!dataFlows[canvasId]) {
      showToast(`${canvasId} · no canvas in workbench`);
      return;
    }
    setView('data-flows');
    setFlowId(canvasId);
    setFlowStage('canvas');
    setCombinedFlow(null);
    setSelectedNode(null);
    setActionDisplay(null);
  }

  function openCombinedDiagram(selectedRows) {
    const graph = buildCombinedDataFlowGraph(selectedRows, dataFlows);
    setCombinedFlow(graph);
    setFlowStage('combined');
    setOrientation('bottom-up');
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
            <p>
              DecisionPro Kentucky ·{' '}
              {dataMode === 'live'
                ? 'live warehouse'
                : dataMode === 'loading'
                  ? 'connecting…'
                  : 'fixture fallback'}
            </p>
          </div>
        </div>
        <div className="wb-top-actions">
          <span className={`mode-pill mode-${dataMode}`} title={loadError || ''}>
            {dataMode === 'live' ? 'LIVE' : dataMode === 'loading' ? '…' : 'FIXTURE'}
          </span>
          <button type="button" className="ghost" onClick={() => void refreshWorkbench()}>
            Refresh
          </button>
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

      {workbench.accurateHighlights || workbench.inventoryNote ? (
        <div className="wb-highlights">
          {workbench.accurateHighlights
            ? Object.entries(workbench.accurateHighlights).map(([id, v]) => (
                <span key={id}>
                  <strong>{id}</strong> {v.displayValue}
                  <em> as of {v.asOfDate}</em>
                </span>
              ))
            : null}
          {workbench.inventory ? (
            <span className="muted">
              POC: {workbench.inventory.detailDsos} DSOs · {workbench.inventory.cubes} cube ·{' '}
              {workbench.inventory.queries} query · {workbench.inventory.realDataFlows} REAL flows
            </span>
          ) : null}
          {workbench.stats ? (
            <span className="muted">
              src {workbench.stats.sourceSystems} · enr {workbench.stats.enrollmentRowsLatest} · mco{' '}
              {workbench.stats.mcoRowsLatest} · measures {workbench.stats.cubeMeasures}
            </span>
          ) : null}
        </div>
      ) : null}

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
              rows={workbench.dataFlowCatalog}
              inventoryNote={workbench.inventoryNote}
              onOpenFlow={(id) => openFlowCanvas(id)}
              onDiagramFlows={openCombinedDiagram}
              toast={showToast}
            />
          ) : null}

          {view === 'data-flows' && flowStage === 'combined' && combinedFlow ? (
            <div className={`flow-layout ${selectedNode ? 'with-drawer' : ''}`}>
              <DataFlowCanvas
                flow={combinedFlow}
                parlance={parlance}
                orientation={orientation}
                onOrientationChange={setOrientation}
                onSelectNode={setSelectedNode}
                selectedNodeId={selectedNode?.id}
                onAction={openAction}
                onBack={() => {
                  setFlowStage('list');
                  setCombinedFlow(null);
                  setSelectedNode(null);
                }}
              />
              <NodeDetailsDrawer
                node={selectedNode}
                parlance={parlance}
                onClose={() => setSelectedNode(null)}
                onAction={openAction}
              />
            </div>
          ) : null}

          {view === 'data-flows' && flowStage === 'canvas' && flow ? (
            <>
              <div className="flow-tabs">
                <button
                  type="button"
                  className="ghost back"
                  onClick={() => {
                    setFlowStage('list');
                    setCombinedFlow(null);
                  }}
                >
                  ← All data flows
                </button>
                {flowTabs.map((f) => (
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
              rows={workbench.infoProviders || INFO_PROVIDERS}
              inventoryNote={workbench.inventoryNote}
              onAction={openAction}
              onOpenFlow={openFlowCanvas}
            />
          ) : null}

          {view === 'info-objects' ? (
            <InfoObjectsView
              parlance={parlance}
              rows={workbench.infoObjects || INFO_OBJECTS}
              onAction={openAction}
            />
          ) : null}

          {view === 'data-sources' ? (
            <DataSourcesView
              parlance={parlance}
              rows={workbench.dataSources || DATA_SOURCES}
              onAction={openAction}
              onOpenFlow={openFlowCanvas}
            />
          ) : null}

          {view === 'source-systems' ? (
            <SourceSystemsView
              parlance={parlance}
              rows={workbench.sourceSystems || SOURCE_SYSTEMS}
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
              chain={workbench.processChain || PROCESS_CHAIN}
              orientation={orientation}
              onOrientationChange={setOrientation}
              toast={showToast}
              onAction={openAction}
            />
          ) : null}

          {view === 'load-monitor' ? (
            <AdminMonitorView
              parlance={parlance}
              history={workbench.loadMonitor || LOAD_HISTORY}
              toast={showToast}
            />
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
