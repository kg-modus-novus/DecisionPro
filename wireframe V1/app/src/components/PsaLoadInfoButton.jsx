import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildPsaLoadExplain } from '../lib/psaLoadExplain.js';
import { buildPsaPreview } from '../lib/psaPreview.js';
import { GlossaryText } from './GlossaryTerm.jsx';

const POP_MARGIN = 12;
const POP_GAP = 8;
const POP_WIDTH = 720;
const POP_WIDTH_MAX = 1100;

function placeNearAnchor(anchorEl, popEl, { maximized } = {}) {
  if (!anchorEl || !popEl) return { top: 0, left: 0, width: POP_WIDTH };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const nav = document.querySelector('.left-nav');
  const topbar = document.querySelector('.topbar');
  const navRight = nav ? nav.getBoundingClientRect().right : 0;
  const minLeft = Math.max(POP_MARGIN, navRight + POP_MARGIN);
  const maxRight = vw - POP_MARGIN;
  const availW = Math.max(280, maxRight - minLeft);
  const minTop = Math.max(
    POP_MARGIN,
    topbar ? topbar.getBoundingClientRect().bottom + POP_MARGIN : POP_MARGIN,
  );

  if (maximized) {
    const width = Math.min(POP_WIDTH_MAX, availW);
    const popRect = popEl.getBoundingClientRect();
    const height = Math.min(
      popRect.height || vh * 0.82,
      vh - minTop - POP_MARGIN,
    );
    const availH = Math.max(0, vh - minTop - POP_MARGIN);
    return {
      top: minTop + Math.max(0, Math.round((availH - height) / 2)),
      left: minLeft + Math.max(0, Math.round((availW - width) / 2)),
      width,
    };
  }

  const rect = anchorEl.getBoundingClientRect();
  const popRect = popEl.getBoundingClientRect();
  const width = Math.min(popRect.width || POP_WIDTH, availW);
  const height = popRect.height || 320;

  let top = rect.bottom + POP_GAP;
  const spaceBelow = vh - POP_MARGIN - top;
  const spaceAbove = rect.top - POP_GAP - minTop;
  if (height > spaceBelow && spaceAbove > spaceBelow) {
    top = rect.top - POP_GAP - height;
  }

  let left = rect.right - width;
  left = Math.max(minLeft, Math.min(left, maxRight - width));
  top = Math.max(minTop, Math.min(top, vh - Math.min(height, vh - minTop - POP_MARGIN) - POP_MARGIN));

  return { top, left, width };
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
  const titleId = useId();
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }
    function reposition() {
      setCoords(placeNearAnchor(btnRef.current, panelRef.current, { maximized }));
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
  }, [open, maximized, preview?.shownRowCount]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        if (maximized) setMaximized(false);
        else setOpen(false);
      }
    }
    function onDoc(e) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
        setMaximized(false);
      }
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, maximized]);

  if (!explain) return null;

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            className={`tile-info-pop psa-load-pop${coords ? ' is-placed' : ''}${
              maximized ? ' is-maximized' : ''
            }`}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            style={
              coords
                ? { top: coords.top, left: coords.left, width: coords.width, maxWidth: coords.width }
                : undefined
            }
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
            if (v) setMaximized(false);
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
