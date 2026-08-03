import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GlossaryText } from '../GlossaryTerm.jsx';

function LinkedCopy({ value }) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return <GlossaryText text={value} />;
  return value;
}

const POP_MARGIN = 12;
const POP_GAP = 8;
const POP_WIDTH = 320;

/**
 * Place a fixed popover near an anchor, keeping it inside the viewport
 * and clear of the left nav and top bar.
 */
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
 * Compact (i) control that opens a tile explain popover.
 * Portaled + fixed so parent overflow / left-nav stacking cannot clip it.
 */
export function TileInfoButton({ explain, onOpenCatalogueSource }) {
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
            {explain.interpret ? (
              <section>
                <h5>How to interpret these numbers</h5>
                <p>
                  <LinkedCopy value={explain.interpret} />
                </p>
              </section>
            ) : explain.about ? (
              <section>
                <p>
                  <LinkedCopy value={explain.about} />
                </p>
              </section>
            ) : null}
            {explain.interpret && explain.about && explain.about !== explain.interpret ? (
              <section>
                <p>
                  <LinkedCopy value={explain.about} />
                </p>
              </section>
            ) : null}
            <section>
              <h5>Where this data comes from</h5>
              <p>
                <LinkedCopy value={explain.source} />
              </p>
              {(explain.primarySources || []).length ? (
                <ul className="tile-info-sources">
                  {explain.primarySources.map((src) => (
                    <li key={src.id || src.href}>
                      <a href={src.href} target="_blank" rel="noopener noreferrer">
                        {src.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {(explain.catalogueSources || []).length ? (
                <div className="tile-info-catalogue">
                  <h5>Source Timeline</h5>
                  <p className="hint">
                    Jump to Authoritative sources → Source Timeline for each DecisionPro catalogue
                    feed that contributes rows here
                    {explain.catalogueSources.length > 1 ? ' (more than one may apply)' : ''}.
                  </p>
                  <ul className="tile-info-sources tile-info-catalogue-list">
                    {explain.catalogueSources.map((src) => (
                      <li key={src.fromSysId}>
                        {typeof onOpenCatalogueSource === 'function' ? (
                          <button
                            type="button"
                            className="tile-info-catalogue-link"
                            onClick={() => {
                              setOpen(false);
                              onOpenCatalogueSource(src.fromSysId, { tab: 'timeline' });
                            }}
                          >
                            Open timeline · {src.label}
                          </button>
                        ) : (
                          <span className="tile-info-catalogue-id">{src.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
            {(explain.terms || []).length ? (
              <section>
                <h5>Terms</h5>
                <ul>
                  {explain.terms.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section>
              <h5>How to Use this Tile</h5>
              <p>
                <LinkedCopy value={explain.useTile} />
              </p>
            </section>
            {explain.useData ? (
              <section>
                <h5>How to Use this Data</h5>
                <p>
                  <LinkedCopy value={explain.useData} />
                </p>
              </section>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="tile-info">
      <button
        ref={btnRef}
        type="button"
        className="tile-info-btn"
        aria-label={`About ${explain.title}`}
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
