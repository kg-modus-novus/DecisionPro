import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ROLE_CATEGORIES, getRoleProfile, listRoleProfiles } from '../data/roleProfiles.js';

const POP_MARGIN = 12;
const POP_GAP = 8;
const POP_WIDTH = 320;

function placeNearAnchor(anchorEl, popEl) {
  if (!anchorEl || !popEl) return { top: 0, left: 0 };
  const rect = anchorEl.getBoundingClientRect();
  const popRect = popEl.getBoundingClientRect();
  const width = popRect.width || Math.min(POP_WIDTH, window.innerWidth - POP_MARGIN * 2);
  const height = popRect.height || 240;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const topbar = document.querySelector('.topbar');
  const minTop = Math.max(
    POP_MARGIN,
    topbar ? topbar.getBoundingClientRect().bottom + POP_MARGIN : POP_MARGIN,
  );

  let top = rect.bottom + POP_GAP;
  const spaceBelow = vh - POP_MARGIN - top;
  const spaceAbove = rect.top - POP_GAP - minTop;
  if (height > spaceBelow && spaceAbove > spaceBelow) {
    top = rect.top - POP_GAP - height;
  }

  let left = rect.right - width;
  left = Math.max(POP_MARGIN, Math.min(left, vw - width - POP_MARGIN));
  top = Math.max(minTop, Math.min(top, vh - Math.min(height, vh - minTop - POP_MARGIN) - POP_MARGIN));

  return { top, left };
}

function RoleIcon({ name, color }) {
  const stroke = color || '#0f766e';
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
  };

  switch (name) {
    case 'hearing':
      return (
        <svg {...common}>
          <path d="M4 19V5h10l6 7-6 7H4z" />
          <path d="M8 9h5M8 12h4M8 15h3" />
        </svg>
      );
    case 'budget':
      return (
        <svg {...common}>
          <path d="M4 19h16M7 16V9M12 16V5M17 16v-4" />
        </svg>
      );
    case 'leadership':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      );
    case 'policy':
      return (
        <svg {...common}>
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5M9 12h8M9 16h6" />
        </svg>
      );
    case 'oversight':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5M9 11h4M11 9v4" />
        </svg>
      );
    case 'steward':
      return (
        <svg {...common}>
          <path d="M4 7h16v12H4z" />
          <path d="M8 7V5h8v2M8 12h8M8 15h5" />
        </svg>
      );
    case 'district':
    default:
      return (
        <svg {...common}>
          <path d="M3 10.5 12 4l9 6.5V20H3z" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
  }
}

function RoleInfoButton({ role }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const titleId = useId();
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }

    function reposition() {
      setCoords(placeNearAnchor(btnRef.current, panelRef.current));
    }

    reposition();
    const raf = requestAnimationFrame(reposition);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onDoc(e) {
      if (
        panelRef.current
        && !panelRef.current.contains(e.target)
        && btnRef.current
        && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            className={`tile-info-pop role-info-pop${coords ? ' is-placed' : ''}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            style={coords ? { top: coords.top, left: coords.left } : undefined}
          >
            <header>
              <h4 id={titleId}>{role.label}</h4>
              <button type="button" className="tile-info-close" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>
            <section>
              <p>{role.purpose}</p>
            </section>
            <section>
              <h5>Data Emphasis</h5>
              <ul>
                {role.dataEmphasis.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h5>Functionality</h5>
              <ul>
                {role.functionality.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="tile-info role-tile-info">
      <button
        ref={btnRef}
        type="button"
        className="tile-info-btn"
        aria-label={`About ${role.label}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      {popover}
    </span>
  );
}

function RoleTile({ role, onSelectRole }) {
  return (
    <div className="role-tile">
      <button
        type="button"
        className="role-tile-select"
        onClick={() => onSelectRole?.(role.id)}
      >
        <span
          className="role-tile-icon"
          style={{
            color: role.accent,
            background: `${role.accent}14`,
            borderColor: `${role.accent}33`,
          }}
        >
          <RoleIcon name={role.icon} color={role.accent} />
        </span>
        <span className="role-tile-copy">
          <strong>{role.label}</strong>
          <span>{role.purpose}</span>
        </span>
        <span className="role-tile-arrow" aria-hidden="true">
          →
        </span>
      </button>
      <RoleInfoButton role={role} />
    </div>
  );
}

export function RoleSelector({ onSelectRole }) {
  const rolesById = Object.fromEntries(listRoleProfiles().map((role) => [role.id, role]));

  return (
    <main className="main role-selector" data-walkthrough-target="role-selector-page">
      <header className="role-selector-hero" data-walkthrough-target="role-selector-intro">
        <div className="role-selector-brand">
          <span className="role-selector-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="28" height="28" focusable="false">
              <g fill="#ffffff">
                <rect x="22.4" y="1.5" width="3.2" height="3.8" rx="0.55" />
                <rect x="20.2" y="5" width="7.6" height="2" rx="0.45" />
                <path d="M9.5 23.8C9.5 13.6 16.2 7.2 24 7.2s14.5 6.4 14.5 16.6H9.5z" />
                <rect x="8" y="22.5" width="32" height="3" rx="0.55" />
                <rect x="6" y="25.3" width="36" height="2.3" rx="0.4" />
                <path
                  fillRule="evenodd"
                  d="M7 27.4h34v14.6H7z
                     M11 28.8h2.35v11.6H11zm5.35 0h2.35v11.6h-2.35zm5.35 0H24.05v11.6H21.7zm5.35 0h2.35v11.6h-2.35zm5.35 0H34.75v11.6H32.4z"
                />
                <rect x="4.5" y="41.8" width="39" height="2.2" rx="0.45" />
                <rect x="3" y="44.2" width="42" height="2.3" rx="0.45" />
              </g>
            </svg>
          </span>
          <div>
            <strong>DecisionPro Kentucky</strong>
            <span>Legislative Modeling &amp; Decision Support System</span>
            <small>A product of XenoDroid Inc.</small>
          </div>
        </div>
        <p className="role-selector-kicker">
          Controlled clickable demonstration · Public REAL + labeled gaps · Demo Role Selector
        </p>
        <h1>Choose A Role</h1>
        <p className="hint">
          This Role Selector is for the demo so you can see every role the system supports. In
          production, a userid would open the screen that matches that user&apos;s role. Here, push
          a role tile to simulate logging into that role.
        </p>
      </header>

      <section className="role-selector-info-grid" aria-label="Role selector information">
        <article className="role-selector-info-tile">
          <span className="role-selector-info-icon" aria-hidden="true">i</span>
          <div>
            <h2>Differences By Role</h2>
            <ul>
              <li>All seven roles use the same navigation options.</li>
              <li>Evidence Rooms appear in a different priority order.</li>
              <li>Initial focuses, weights, and starting Evidence Room differ.</li>
              <li>
                Pack and Brief buttons remain disabled until enough findings are blended.
              </li>
            </ul>
          </div>
        </article>

        <article className="role-selector-info-tile is-production">
          <span className="role-selector-info-icon" aria-hidden="true">i</span>
          <div>
            <h2>In Production</h2>
            <p>
              Users would log in using their user ID and see the data, actions, exports, and
              administrative functions they are authorized for. The production system will
              enforce role-based authorization.
            </p>
          </div>
        </article>
      </section>

      <div className="role-selector-columns" data-walkthrough-target="role-selector-cards">
        {ROLE_CATEGORIES.map((category) => (
          <section key={category.id} className="role-selector-column" aria-label={category.label}>
            <h2>{category.label}</h2>
            <div className="role-tile-stack">
              {category.roleIds.map((id) => {
                const role = rolesById[id] || getRoleProfile(id);
                if (!role) return null;
                return <RoleTile key={id} role={role} onSelectRole={onSelectRole} />;
              })}
            </div>
          </section>
        ))}
      </div>

      <ul className="role-selector-footer" data-walkthrough-target="role-selector-disclaimer">
        <li>Aggregate / de-identified only</li>
        <li>Options to examine — not prescriptions</li>
        <li>Provenance &amp; limitations on every view</li>
        <li>Demo Role Selector — production uses userid</li>
        <li>A product of XenoDroid Inc.</li>
      </ul>
    </main>
  );
}
