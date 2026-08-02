import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const nav = document.querySelector('.left-nav');
  const topbar = document.querySelector('.topbar');
  const navRight = nav ? nav.getBoundingClientRect().right : 0;
  const minLeft = Math.max(POP_MARGIN, navRight + POP_MARGIN);
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
  left = Math.max(minLeft, Math.min(left, vw - width - POP_MARGIN));
  top = Math.max(minTop, Math.min(top, vh - Math.min(height, vh - minTop - POP_MARGIN) - POP_MARGIN));

  return { top, left };
}

/**
 * * control on Source-scale tiles — expands abbreviated labels to full names.
 */
export function SourceScaleAbbrevButton({ expansions, sourceId }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const titleId = useId();
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const items = (expansions || []).filter((e) => e.short && e.full && e.short !== e.full);

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
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
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

  if (!items.length) return null;

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            className={`tile-info-pop${coords ? ' is-placed' : ''}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            style={coords ? { top: coords.top, left: coords.left } : undefined}
          >
            <header>
              <h4 id={titleId}>
                {sourceId ? `${sourceId} — full names` : 'Source scale — full names'}
              </h4>
              <button type="button" className="tile-info-close" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>
            <section>
              <ul className="source-scale-abbrev-list">
                {items.map((e) => (
                  <li key={e.full}>
                    <span>
                      <strong>{e.short}</strong> means {e.full}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="asof-info source-scale-abbrev-info">
      <button
        ref={btnRef}
        type="button"
        className="tile-info-btn asof-info-btn source-scale-abbrev-btn"
        aria-label={sourceId ? `Full Source scale names for ${sourceId}` : 'Full Source scale names'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Show full names for abbreviations"
        onClick={(e) => {
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
