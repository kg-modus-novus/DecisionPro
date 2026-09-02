import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRelationshipGraph, wrapGraphLabel, zoomViewportAtPoint } from '../lib/relationshipGraphLayout.js';

const MIN_SCALE = 0.65;
const MAX_SCALE = 2.4;

function activateWithKeyboard(event, callback) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
}

export function RelationshipNetworkGraph({ items, mode, onOpenRelationship }) {
  const graph = useMemo(() => buildRelationshipGraph(items), [items]);
  const [view, setView] = useState('network');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef(null);
  const svgRef = useRef(null);
  const label = mode === 'subaward-edge'
    ? 'Prime to sub-recipient funding network'
    : 'Owner to matched facility portfolio network';

  const connectedEdgeIds = useMemo(() => new Set(
    selectedNodeId
      ? graph.edges.filter((edge) => edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId).map((edge) => edge.id)
      : graph.edges.map((edge) => edge.id),
  ), [graph.edges, selectedNodeId]);
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set(graph.nodes.map((node) => node.id));
    const ids = new Set([selectedNodeId]);
    graph.edges.forEach((edge) => {
      if (connectedEdgeIds.has(edge.id)) {
        ids.add(edge.sourceId);
        ids.add(edge.targetId);
      }
    });
    return ids;
  }, [graph.edges, graph.nodes, connectedEdgeIds, selectedNodeId]);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
  const selectedConnectionCount = selectedNodeId
    ? graph.edges.filter((edge) => edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId).length
    : 0;

  useEffect(() => {
    setSelectedNodeId(null);
    setViewport({ x: 0, y: 0, scale: 1 });
  }, [mode]);

  function setScale(nextScale) {
    setViewport((current) => ({ ...current, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale)) }));
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const handleWheel = (event) => {
      event.preventDefault();
      const bounds = svg.getBoundingClientRect();
      const pointX = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * graph.width;
      const pointY = ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * graph.height;
      setViewport((current) => zoomViewportAtPoint(current, pointX, pointY, event.deltaY, MIN_SCALE, MAX_SCALE));
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [graph.height, graph.width]);

  function resetView() {
    setViewport({ x: 0, y: 0, scale: 1 });
    setSelectedNodeId(null);
  }

  function beginPan(event) {
    if (event.button !== 0 || event.target.closest?.('[data-graph-interactive]')) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: viewport.x, originY: viewport.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function pan(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratioX = graph.width / Math.max(bounds.width, 1);
    const ratioY = graph.height / Math.max(bounds.height, 1);
    setViewport((current) => ({
      ...current,
      x: drag.originX + ((event.clientX - drag.x) * ratioX),
      y: drag.originY + ((event.clientY - drag.y) * ratioY),
    }));
  }

  function endPan(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  if (items.length === 0) return <p className="hint">No relationship edges match the current name search and graph controls.</p>;

  return (
    <div className="fr-network-shell">
      <div className="fr-network-toolbar">
        <div className="fr-network-view-toggle" role="group" aria-label="Relationship graph view">
          <button type="button" className={view === 'network' ? 'is-active' : ''} aria-pressed={view === 'network'} onClick={() => setView('network')}>Graphical network</button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>Accessible list</button>
        </div>
        <span className="fr-network-summary">{graph.nodes.length} nodes · {graph.edges.length} relationships</span>
        {view === 'network' ? (
          <div className="fr-network-zoom" role="group" aria-label="Network zoom controls">
            <button type="button" aria-label="Zoom out relationship graph" onClick={() => setScale(viewport.scale - 0.2)}>−</button>
            <output aria-live="polite">{Math.round(viewport.scale * 100)}%</output>
            <button type="button" aria-label="Zoom in relationship graph" onClick={() => setScale(viewport.scale + 0.2)}>+</button>
            <button type="button" onClick={resetView}>Fit</button>
          </div>
        ) : null}
      </div>

      {view === 'network' ? (
        <>
          <div className="fr-network-legend" aria-hidden="true">
            <span><i className="fr-network-legend-source" />{mode === 'subaward-edge' ? 'Prime organization' : 'Owner'}</span>
            <span><i className="fr-network-legend-target" />{mode === 'subaward-edge' ? 'Sub-recipient' : 'Facility'}</span>
            <span><i className="fr-network-legend-edge" />Relationship</span>
          </div>
          <p className="fr-network-meaning">
            Nodes are organizational entities named by the source data—not necessarily companies. Funding nodes show the sum across currently displayed connections; ownership nodes show portfolio or facility context and do not imply a funding amount.
          </p>
          <div className="fr-network-canvas">
            <svg
              ref={svgRef}
              className="fr-network-svg"
              viewBox={`0 0 ${graph.width} ${graph.height}`}
              role="img"
              aria-label={`${label}. ${graph.nodes.length} nodes and ${graph.edges.length} relationships. Select a node to focus its neighborhood or a connection to open evidence.`}
              data-scale={viewport.scale.toFixed(2)}
              onPointerDown={beginPan}
              onPointerMove={pan}
              onPointerUp={endPan}
              onPointerCancel={endPan}
            >
              <defs>
                <pattern id="fr-network-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" /></pattern>
                <marker id="fr-network-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
              </defs>
              <rect className="fr-network-grid" width="100%" height="100%" />
              <g className="fr-network-stage" transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
                {graph.edges.map((edge) => {
                  const connected = connectedEdgeIds.has(edge.id);
                  const accessibleLabel = `${edge.item.sourceNode} connects to ${edge.item.targetNode}: ${edge.item.graphMetricValue || edge.item.metricValue}. Open evidence and action playbook.`;
                  return (
                    <g key={edge.id} className={`fr-network-edge ${connected ? 'is-connected' : 'is-dimmed'}`}>
                      <path className="fr-network-edge-line" d={edge.path} style={{ strokeWidth: edge.width }} markerEnd="url(#fr-network-arrow)" />
                      <path
                        className="fr-network-edge-hit"
                        d={edge.path}
                        role="button"
                        tabIndex="0"
                        data-graph-interactive="true"
                        aria-label={accessibleLabel}
                        onClick={() => onOpenRelationship(edge.item)}
                        onKeyDown={(event) => activateWithKeyboard(event, () => onOpenRelationship(edge.item))}
                      />
                    </g>
                  );
                })}
                {graph.nodes.map((node) => {
                  const lines = wrapGraphLabel(node.label);
                  const connected = connectedNodeIds.has(node.id);
                  const selected = selectedNodeId === node.id;
                  const count = graph.edges.filter((edge) => edge.sourceId === node.id || edge.targetId === node.id).length;
                  return (
                    <g
                      key={node.id}
                      className={`fr-network-node fr-network-node-${node.kind}${selected ? ' is-selected' : ''}${connected ? '' : ' is-dimmed'}`}
                      transform={`translate(${node.x} ${node.y})`}
                      role="button"
                      tabIndex="0"
                      data-graph-interactive="true"
                      aria-label={`${node.roleLabel}: ${node.label}. ${node.metricLabel}. ${count} ${count === 1 ? 'relationship' : 'relationships'}. Select for details and connected nodes.`}
                      onClick={() => setSelectedNodeId((current) => current === node.id ? null : node.id)}
                      onKeyDown={(event) => activateWithKeyboard(event, () => setSelectedNodeId((current) => current === node.id ? null : node.id))}
                    >
                      <rect width={node.width} height={node.height} rx="10" />
                      <circle cx="17" cy="14" r="5" />
                      <text className="fr-network-node-role" x="29" y="18">{node.roleLabel}</text>
                      <text className="fr-network-node-name" x="14" y={lines.length === 1 ? 43 : 36}>
                        {lines.map((line, index) => <tspan key={line} x="14" dy={index === 0 ? 0 : 14}>{line}</tspan>)}
                      </text>
                      <text className="fr-network-node-metric" x="14" y="67">{node.metricLabel}</text>
                      <title>{node.label}</title>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
          {selectedNode ? (
            <div className="fr-network-selection" aria-live="polite">
              <div className="fr-network-selection-heading">
                <div><span className="fr-network-selection-kicker">Focused {selectedNode.roleLabel}</span><strong>{selectedNode.label}</strong></div>
                <button type="button" onClick={() => setSelectedNodeId(null)}>Clear focus</button>
              </div>
              <dl>
                <div><dt>Entity type</dt><dd>{selectedNode.roleLabel}</dd></div>
                <div><dt>Connections</dt><dd>{selectedConnectionCount} displayed {selectedConnectionCount === 1 ? 'relationship' : 'relationships'}</dd></div>
                <div><dt>Financial context</dt><dd>{selectedNode.financialLabel}</dd></div>
                {selectedNode.contextRows.length === 0 && selectedNode.contextLabel ? <div><dt>Evidence context</dt><dd>{selectedNode.contextLabel}</dd></div> : null}
              </dl>
              {selectedNode.contextRows.length > 0 ? (
                <div className="fr-network-evidence">
                  <table>
                    <caption>Evidence context for displayed relationships</caption>
                    <thead>
                      <tr>
                        <th scope="col">Assistance listing</th>
                        <th scope="col">Recipient EIN</th>
                        <th scope="col">Prime organization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedNode.contextRows.map((row, index) => (
                        <tr key={`${row.assistanceListing}-${row.recipientEin || 'not-reported'}-${index}`}>
                          <td>{row.assistanceListing || 'Not reported'}</td>
                          <td>{row.recipientEin || 'Not reported'}</td>
                          <td>{row.primeOrganization}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>Reviewed display names are shown; original publisher labels remain preserved in the source records.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="fr-network-help">Drag the canvas to pan. Use the mouse wheel over the canvas to zoom at the pointer. Select a node for details and its neighborhood; select a connection to open its evidence and action playbook.</p>
          )}
        </>
      ) : (
        <div className="fr-graph" role="list" aria-label={label}>
          {items.map((item) => (
            <button key={item.graphId || item.id} type="button" role="listitem" className="fr-graph-edge" onClick={() => onOpenRelationship(item)}>
              <span className="fr-graph-node-label fr-graph-source">{item.sourceNode}</span>
              <span className="fr-graph-link" aria-label="connects to"><span aria-hidden="true">→</span><small>{item.graphMetricValue || item.metricValue}</small></span>
              <span className="fr-graph-node-label fr-graph-target">{item.targetNode}</span>
              {item.reviewCandidateOnly ? <span className="fr-item-flag">identity unresolved</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
