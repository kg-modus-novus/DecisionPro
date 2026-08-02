import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildPsaLoadExplain } from '../lib/psaLoadExplain.js';
import { GlossaryText } from './GlossaryTerm.jsx';

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
 * Compact (i) on Loaded (PSA) cells: full load vs why PSA holds less than publisher scale.
 */
export function PsaLoadInfoButton({ row }) {
  const explain = buildPsaLoadExplain(row);
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

  if (!explain) return null;

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
              <h4 id={titleId}>{explain.title}</h4>
              <button type="button" className="tile-info-close" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>
            <section>
              <h5>
                What the <GlossaryText text="PSA" /> count means
              </h5>
              <p>
                <strong>
                  <GlossaryText text={explain.verdict} />
                </strong>
              </p>
            </section>
            <section>
              <h5>
                How this compares with <GlossaryText text="Source scale" />
              </h5>
              <p>
                <GlossaryText text={explain.comparison} />
              </p>
            </section>
            {explain.reason ? (
              <section>
                <h5>Why the PSA count is smaller</h5>
                <p>
                  <GlossaryText text={explain.reason} />
                </p>
              </section>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="asof-info psa-load-info">
      <button
        ref={btnRef}
        type="button"
        className="tile-info-btn asof-info-btn"
        aria-label={`PSA load details for ${row.fromSysId}`}
        aria-expanded={open}
        aria-haspopup="dialog"
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
