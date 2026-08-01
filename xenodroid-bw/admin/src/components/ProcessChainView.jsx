import { t } from '../parlance.js';
import { CONTEXT_ACTIONS } from '../data/fixtures.js';
import { useState } from 'react';

export function ProcessChainView({ parlance, chain, orientation, onOrientationChange, toast, onAction }) {
  const [menu, setMenu] = useState(null);
  const steps = orientation === 'ltr' ? chain.steps : [...chain.steps].reverse();

  return (
    <div className="panel">
      <header className="panel-head row">
        <div>
          <h2>
            {t(parlance, 'processChain')} · {chain.title}
          </h2>
          <p className="hint">{chain.id} · maps to npm run bw:gate</p>
        </div>
        <div className="seg">
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
      </header>

      <div
        className={`chain ${orientation}`}
        onClick={() => setMenu(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {steps.map((s, i) => (
          <div key={s.id} className="chain-item">
            <button
              type="button"
              className={`df-node status-${s.status} chain-node`}
              onClick={(e) => {
                e.stopPropagation();
                toast?.(`${s.title} · ${s.meta}`);
              }}
            >
              {s.status === 'active' ? <span className="active-pill">ACTIVE</span> : null}
              <strong>{s.title}</strong>
              <span className="df-node-meta">{s.meta}</span>
              <span className="df-node-status">{s.status}</span>
            </button>
            {i < steps.length - 1 ? <div className="chain-arrow" aria-hidden="true" /> : null}
          </div>
        ))}
      </div>

      {menu ? (
        <div className="df-menu fixed" style={{ left: menu.x, top: menu.y }}>
          <p className="df-menu-title">{chain.id}</p>
          <ul>
            {CONTEXT_ACTIONS.chain.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => {
                    onAction?.(a, { technicalName: chain.id, type: 'chain', title: chain.title });
                    setMenu(null);
                  }}
                >
                  {a}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="df-hint">Right-click canvas for chain actions · click a step for toast detail</p>
    </div>
  );
}
