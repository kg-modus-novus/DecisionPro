import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { t } from '../parlance.js';
import { CONTEXT_ACTIONS } from '../data/fixtures.js';

const NODE_W = 220;
const NODE_H = 88;
const GAP = 36;

function layoutNodes(nodes, orientation) {
  if (orientation === 'ltr') {
    return nodes.map((n, i) => ({
      ...n,
      x: 48 + i * (NODE_W + GAP),
      y: 120,
    }));
  }
  // bottom-up: first node at bottom
  const totalH = nodes.length * (NODE_H + GAP);
  return nodes.map((n, i) => ({
    ...n,
    x: 280,
    y: 48 + (nodes.length - 1 - i) * (NODE_H + GAP),
    _stackTop: totalH,
  }));
}

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'active') return 'Active';
  if (status === 'error') return 'Error';
  return 'Upcoming';
}

export function DataFlowCanvas({
  flow,
  parlance,
  orientation,
  onOrientationChange,
  onSelectNode,
  selectedNodeId,
  onAction,
}) {
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [menu, setMenu] = useState(null);

  const laidOut = useMemo(() => layoutNodes(flow.nodes, orientation), [flow, orientation]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setScale((s) => Math.min(1.8, Math.max(0.45, s - e.deltaY * 0.001)));
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
    setScale(1);
    setPan({ x: 40, y: 20 });
  }

  function edges() {
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
        // a is lower in stack index order from source; visually a is below b when bottom-up
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
          <h2>{t(parlance, 'dataFlow')} — defined process</h2>
          <p className="df-sub">
            {flow.title} · {flow.subtitle}
          </p>
        </div>
        <div className="df-toolbar">
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
          <svg className="df-edges" width="1600" height="1200">
            {edges().map((e) => (
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
              className={`df-node status-${node.status} ${selectedNodeId === node.id ? 'selected' : ''}`}
              style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
              onClick={(e) => {
                e.stopPropagation();
                setMenu(null);
                onSelectNode(node);
              }}
              onContextMenu={(e) => openMenu(e, node)}
            >
              {node.status === 'active' ? <span className="active-pill">ACTIVE</span> : null}
              <span className="df-node-kind">{t(parlance, node.titleKey)}</span>
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
