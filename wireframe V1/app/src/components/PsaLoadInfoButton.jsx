import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildPsaLoadExplain } from '../lib/psaLoadExplain.js';
import { buildPsaPreview } from '../lib/psaPreview.js';
import { GlossaryText } from './GlossaryTerm.jsx';

const POP_MARGIN = 12;
const POP_GAP = 8;
const POP_WIDTH = 720;
const POP_WIDTH_MAX = 1100;
const POP_MIN_W = 360;
const POP_MIN_H = 240;

function viewportBounds() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const nav = document.querySelector('.left-nav');
  const topbar = document.querySelector('.topbar');
  const navRight = nav ? nav.getBoundingClientRect().right : 0;
  const minLeft = Math.max(POP_MARGIN, navRight + POP_MARGIN);
  const maxRight = vw - POP_MARGIN;
  const minTop = Math.max(
    POP_MARGIN,
    topbar ? topbar.getBoundingClientRect().bottom + POP_MARGIN : POP_MARGIN,
  );
  const maxBottom = vh - POP_MARGIN;
  return {
    vw,
    vh,
    minLeft,
    maxRight,
    minTop,
    maxBottom,
    availW: Math.max(POP_MIN_W, maxRight - minLeft),
    availH: Math.max(POP_MIN_H, maxBottom - minTop),
  };
}

function placeNearAnchor(anchorEl, popEl, { maximized, size } = {}) {
  if (!anchorEl || !popEl) {
    return { top: 0, left: 0, width: POP_WIDTH, height: null };
  }
  const { vw, vh, minLeft, maxRight, minTop, maxBottom, availW, availH } = viewportBounds();

  if (maximized) {
    const width = Math.min(POP_WIDTH_MAX, availW);
    const popRect = popEl.getBoundingClientRect();
    const height = Math.min(popRect.height || vh * 0.82, availH);
    return {
      top: minTop + Math.max(0, Math.round((availH - height) / 2)),
      left: minLeft + Math.max(0, Math.round((availW - width) / 2)),
      width,
      height: null,
    };
  }

  const rect = anchorEl.getBoundingClientRect();
  const popRect = popEl.getBoundingClientRect();
  const width = Math.min(size?.width || popRect.width || POP_WIDTH, availW);
  const height = size?.height != null ? Math.min(size.height, availH) : null;
  const measuredH = height ?? (popRect.height || 320);

  let top = rect.bottom + POP_GAP;
  const spaceBelow = maxBottom - top;
  const spaceAbove = rect.top - POP_GAP - minTop;
  if (measuredH > spaceBelow && spaceAbove > spaceBelow) {
    top = rect.top - POP_GAP - measuredH;
  }

  let left = rect.right - width;
  left = Math.max(minLeft, Math.min(left, maxRight - width));
  top = Math.max(minTop, Math.min(top, maxBottom - Math.min(measuredH, availH)));

  return { top, left, width, height };
}

/**
 * Compact (i) on Loaded (PSA) cells: explain copy + scrollable PSA row preview.
 */
export function PsaLoadInfoButton({ row }) {
  const explain = buildPsaLoadExplain(row);
  const preview = buildPsaPreview(row);
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [coords, setCoords] = useState(null);
  const [size, setSize] = useState(null);
  const [resizing, setResizing] = useState(false);
  const titleId = useId();
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const sizeRef = useRef(null);
  sizeRef.current = size;

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }
    if (resizing) return undefined;

    function reposition() {
      setCoords(placeNearAnchor(btnRef.current, panelRef.current, { maximized, size: sizeRef.current }));
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
  }, [open, maximized, preview?.shownRowCount, resizing]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        if (maximized) setMaximized(false);
        else setOpen(false);
      }
    }
    function onDoc(e) {
      if (resizing) return;
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
        setMaximized(false);
        setSize(null);
      }
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, maximized, resizing]);

  function startResize(e) {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    const panel = panelRef.current;
    if (!panel) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = panel.getBoundingClientRect();
    const startW = startRect.width;
    const startH = startRect.height;
    const startTop = startRect.top;
    const startLeft = startRect.left;
    setResizing(true);

    function onMove(ev) {
      const { minLeft, maxRight, maxBottom } = viewportBounds();
      const nextW = Math.max(POP_MIN_W, Math.min(maxRight - startLeft, startW + (ev.clientX - startX)));
      const nextH = Math.max(POP_MIN_H, Math.min(maxBottom - startTop, startH + (ev.clientY - startY)));
      setSize({ width: nextW, height: nextH });
      setCoords({
        top: startTop,
        left: Math.max(minLeft, startLeft),
        width: nextW,
        height: nextH,
      });
    }

    function onUp() {
      setResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  if (!explain) return null;

  const panelStyle = coords
    ? {
        top: coords.top,
        left: coords.left,
        width: coords.width,
        maxWidth: coords.width,
        ...(coords.height != null && !maximized
          ? { height: coords.height, maxHeight: coords.height }
          : null),
      }
    : undefined;

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            className={`tile-info-pop psa-load-pop${coords ? ' is-placed' : ''}${
              maximized ? ' is-maximized' : ''
            }${resizing ? ' is-resizing' : ''}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            style={panelStyle}
          >
            <header className="psa-load-pop-header">
              <h4 id={titleId}>{explain.title}</h4>
              <div className="tile-info-header-actions">
                <button
                  type="button"
                  className="tile-info-close"
                  onClick={() => setMaximized((v) => !v)}
                  aria-pressed={maximized}
                  aria-label={maximized ? 'Restore panel size' : 'Maximize panel'}
                >
                  {maximized ? 'Restore' : 'Maximize'}
                </button>
                <button
                  type="button"
                  className="tile-info-close"
                  onClick={() => {
                    setOpen(false);
                    setMaximized(false);
                    setSize(null);
                  }}
                >
                  Close
                </button>
              </div>
            </header>
            <div className="psa-load-pop-body">
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
              {explain.bindCriteria?.length ? (
                <section>
                  <h5>
                    Filter criteria applied before / for the <GlossaryText text="PSA" /> bind
                  </h5>
                  <ul className="psa-bind-criteria-list">
                    {explain.bindCriteria.map((c) => (
                      <li key={c}>
                        <GlossaryText text={c} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {explain.bindWhy ? (
                <section>
                  <h5>Why those criteria were chosen</h5>
                  <p>
                    <GlossaryText text={explain.bindWhy} />
                  </p>
                </section>
              ) : explain.reason ? (
                <section>
                  <h5>Why the PSA count is smaller</h5>
                  <p>
                    <GlossaryText text={explain.reason} />
                  </p>
                </section>
              ) : null}
              {preview ? (
                <section className="psa-preview-section">
                  <h5>
                    <GlossaryText text="PSA" /> rows
                  </h5>
                  <p className="psa-preview-caption">
                    Showing {preview.shownRowCount.toLocaleString()} of{' '}
                    {preview.totalRowCount.toLocaleString()} landed record
                    {preview.totalRowCount === 1 ? '' : 's'}
                    {preview.truncated ? ' (preview capped)' : ''}. {preview.note}
                  </p>
                  <div className="psa-preview-scroll" tabIndex={0}>
                    <table className="psa-preview-table">
                      <thead>
                        <tr>
                          {preview.columns.map((col) => (
                            <th key={col} scope="col">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((cells, idx) => (
                          <tr key={`psa-row-${idx}`}>
                            {cells.map((value, cIdx) => (
                              <td key={`${idx}-${cIdx}`}>{value}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>
            {!maximized ? (
              <button
                type="button"
                className="psa-load-resize"
                aria-label="Resize PSA panel"
                title="Drag to resize"
                onPointerDown={startResize}
              />
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
          setOpen((v) => {
            if (v) {
              setMaximized(false);
              setSize(null);
            }
            return !v;
          });
        }}
      >
        i
      </button>
      {popover}
    </span>
  );
}
