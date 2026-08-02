import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { t } from '../parlance.js';
import { CONTEXT_ACTIONS } from '../data/fixtures.js';
import { LAYER_ORDER } from '../lib/combinedDataFlowGraph.js';
import { ObjectTypeIcon } from './ObjectTypeIcon.jsx';

const NODE_W = 236;
const NODE_H = 96;
const GAP = 36;
const LAYER_GAP_Y = 48;
const NODE_GAP_X = 28;

function layoutLinear(nodes, orientation) {
  if (orientation === 'ltr') {
    return nodes.map((n, i) => ({
      ...n,
      x: 48 + i * (NODE_W + GAP),
      y: 120,
    }));
  }
  return nodes.map((n, i) => ({
    ...n,
    x: 280,
    y: 48 + (nodes.length - 1 - i) * (NODE_H + GAP),
  }));
}

/** Layered layout: Evidence Rooms at apex, PSA at the source end. */
function layoutLayered(nodes, orientation) {
  const byLayer = new Map(LAYER_ORDER.map((l) => [l, []]));
  for (const n of nodes) {
    const layer = byLayer.has(n.type) ? n.type : 'cube';
    byLayer.get(layer).push(n);
  }
  for (const layer of LAYER_ORDER) {
    byLayer.get(layer).sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }

  if (orientation === 'ltr') {
    let x = 48;
    const laid = [];
    for (const layer of LAYER_ORDER) {
      const group = byLayer.get(layer) || [];
      if (!group.length) continue;
      group.forEach((n, i) => {
        laid.push({
          ...n,
          x,
          y: 48 + i * (NODE_H + NODE_GAP_X),
        });
      });
      x += NODE_W + GAP + 24;
    }
    return laid;
  }

  // bottom-up: Evidence Rooms at top (low y), PSA at bottom (high y)
  const topFirst = [...LAYER_ORDER].reverse().filter((l) => (byLayer.get(l) || []).length > 0);
  const maxCount = Math.max(1, ...topFirst.map((l) => byLayer.get(l).length));
  const canvasW = Math.max(900, maxCount * (NODE_W + NODE_GAP_X) + 80);
  const laid = [];
  topFirst.forEach((layer, layerIdx) => {
    const group = byLayer.get(layer) || [];
    const y = 40 + layerIdx * (NODE_H + LAYER_GAP_Y);
    const totalW = group.length * NODE_W + (group.length - 1) * NODE_GAP_X;
    const startX = Math.max(40, (canvasW - totalW) / 2);
    group.forEach((n, i) => {
      laid.push({
        ...n,
        x: startX + i * (NODE_W + NODE_GAP_X),
        y,
      });
    });
  });
  return laid;
}

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'active') return 'Active';
  if (status === 'error') return 'Error';
  return 'Upcoming';
}

function buildLinearEdges(laidOut, orientation) {
  const lines = [];
  for (let i = 0; i < laidOut.length - 1; i += 1) {
    const a = laidOut[i];
    const b = laidOut[i + 1];
    if (orientation === 'ltr') {
      lines.push({
        key: `${a.id}-${b.id}`,
        x1: a.x + NODE_W,
        y1: a.y + NODE_H / 2,
        x2: b.x,
        y2: b.y + NODE_H / 2,
      });
    } else {
      lines.push({
        key: `${a.id}-${b.id}`,
        x1: a.x + NODE_W / 2,
        y1: a.y,
        x2: b.x + NODE_W / 2,
        y2: b.y + NODE_H,
      });
    }
  }
  return lines;
}

function buildGraphEdges(laidOut, edges, orientation) {
  const byId = new Map(laidOut.map((n) => [n.id, n]));
  const lines = [];
  for (const e of edges || []) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    if (orientation === 'ltr') {
      lines.push({
        key: `${e.from}->${e.to}`,
        x1: a.x + NODE_W,
        y1: a.y + NODE_H / 2,
        x2: b.x,
        y2: b.y + NODE_H / 2,
      });
    } else {
      // bottom-up: edge from lower layer (source) up to higher layer (target)
      // a is source (from), b is target (to) — a usually has larger y
      const aAbove = a.y < b.y;
      lines.push({
        key: `${e.from}->${e.to}`,
        x1: a.x + NODE_W / 2,
        y1: aAbove ? a.y + NODE_H : a.y,
        x2: b.x + NODE_W / 2,
        y2: aAbove ? b.y : b.y + NODE_H,
      });
    }
  }
  return lines;
}

export function DataFlowCanvas({
  flow,
  parlance,
  orientation,
  onOrientationChange,
  onSelectNode,
  selectedNodeId,
  onAction,
  onBack,
}) {
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [menu, setMenu] = useState(null);

  const isGraph = Array.isArray(flow?.edges);

  const laidOut = useMemo(() => {
    if (!flow?.nodes?.length) return [];
    if (isGraph) return layoutLayered(flow.nodes, orientation);
    return layoutLinear(flow.nodes, orientation);
  }, [flow, orientation, isGraph]);

  const edgeLines = useMemo(() => {
    if (isGraph) return buildGraphEdges(laidOut, flow.edges, orientation);
    return buildLinearEdges(laidOut, orientation);
  }, [laidOut, flow, orientation, isGraph]);

  const worldSize = useMemo(() => {
    if (!laidOut.length) return { w: 1600, h: 1200 };
    const maxX = Math.max(...laidOut.map((n) => n.x + NODE_W)) + 80;
    const maxY = Math.max(...laidOut.map((n) => n.y + NODE_H)) + 80;
    return { w: Math.max(1600, maxX), h: Math.max(1200, maxY) };
  }, [laidOut]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setScale((s) => Math.min(1.8, Math.max(0.35, s - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  function onPointerDown(e) {
    if (e.target.closest('.df-node') || e.target.closest('.df-menu')) return;
    setDragging(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }

  function onPointerMove(e) {
    if (!dragging) return;
    setPan({
      x: dragOrigin.current.panX + (e.clientX - dragOrigin.current.x),
      y: dragOrigin.current.panY + (e.clientY - dragOrigin.current.y),
    });
  }

  function onPointerUp() {
    setDragging(false);
  }

  function resetFit() {
    setScale(isGraph ? 0.75 : 1);
    setPan({ x: 40, y: 20 });
  }

  function openMenu(e, node) {
    e.preventDefault();
    e.stopPropagation();
    const rect = viewportRef.current.getBoundingClientRect();
    setMenu({
      node,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      actions: CONTEXT_ACTIONS[node.type] || ['Display', 'Edit'],
    });
  }

  return (
    <div className="df-shell">
      <header className="df-header">
        <div>
          <h2>
            {t(parlance, 'dataFlow')} — {isGraph ? 'combined diagram' : 'defined process'}
          </h2>
          <p className="df-sub">
            {flow.title} · {flow.subtitle}
          </p>
        </div>
        <div className="df-toolbar">
          {onBack ? (
            <button type="button" className="ghost" onClick={onBack}>
              ← All data flows
            </button>
          ) : null}
          <div className="seg" role="group" aria-label="Orientation">
            <button
              type="button"
              className={orientation === 'bottom-up' ? 'active' : ''}
              onClick={() => onOrientationChange('bottom-up')}
            >
              Bottom-up
            </button>
            <button
              type="button"
              className={orientation === 'ltr' ? 'active' : ''}
              onClick={() => onOrientationChange('ltr')}
            >
              Left-to-right
            </button>
          </div>
          <button type="button" className="ghost" onClick={resetFit}>
            Fit
          </button>
        </div>
      </header>

      <div className="df-legend">
        <span>
          <i className="lg completed" /> Completed
        </span>
        <span>
          <i className="lg active" /> Current
        </span>
        <span>
          <i className="lg upcoming" /> Upcoming
        </span>
        <span>
          <i className="lg error" /> Error
        </span>
        {isGraph ? (
          <span className="df-legend-note">Rooms (top) · Cubes · DTP / DSO / TRFN / PSA (bottom)</span>
        ) : null}
      </div>

      <div
        className={`df-viewport ${dragging ? 'dragging' : ''}`}
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={resetFit}
        onClick={() => setMenu(null)}
      >
        <div
          className="df-world"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        >
          <svg className="df-edges" width={worldSize.w} height={worldSize.h}>
            {edgeLines.map((e) => (
              <line
                key={e.key}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                className="df-edge"
                markerEnd="url(#arrow)"
              />
            ))}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#6ec8ff" />
              </marker>
            </defs>
          </svg>
          {laidOut.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`df-node status-${node.status} type-${node.type} ${
                selectedNodeId === node.id ? 'selected' : ''
              }`}
              style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
              onClick={(e) => {
                e.stopPropagation();
                setMenu(null);
                onSelectNode(node);
              }}
              onContextMenu={(e) => openMenu(e, node)}
            >
              {node.status === 'active' ? <span className="active-pill">ACTIVE</span> : null}
              <span className="df-node-top">
                <ObjectTypeIcon type={node.type} />
                <span className="df-node-kind">{t(parlance, node.titleKey)}</span>
              </span>
              <strong>{node.title}</strong>
              <span className="df-node-meta">{node.meta}</span>
              <span className="df-node-status">{statusLabel(node.status)}</span>
            </button>
          ))}
        </div>

        {menu ? (
          <div
            className="df-menu"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <p className="df-menu-title">{menu.node.technicalName}</p>
            <ul>
              {menu.actions.map((action) => (
                <li key={action}>
                  <button
                    type="button"
                    onClick={() => {
                      onAction?.(action, menu.node);
                      setMenu(null);
                    }}
                  >
                    {action}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <p className="df-hint">
        Drag canvas to pan · scroll to zoom · click node for details · right-click for actions ·
        double-click to reset fit
      </p>
    </div>
  );
}
