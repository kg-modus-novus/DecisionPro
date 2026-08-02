import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { describeSeriesKind, ensureSentence } from '../lib/explainProse.js';
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

/** Build as-of explain content from a Data Spectrum row. */
export function buildAsOfExplain(row) {
  if (!row) return null;
  const cadence = row.provides?.cadence || 'not recorded';
  const seriesKind = row.provides?.seriesKind || 'unknown';
  const earliest = row.loadedDepth?.earliestAsOf || null;
  const latest = row.loadedDepth?.latestAsOf || earliest;
  const availableDepth = row.availableDepth || '';
  const gaps = [...(row.inconsistencies || [])].map(ensureSentence).filter(Boolean);
  const note = row.loadedDepth?.sourceScale?.note || row.loadedDepth?.sourceRecordNote || '';

  if (/absent|missing|gap|404|not published|not yet|partial|fuller archive/i.test(note)) {
    const gapFromNote = note.split(/(?<=\.)\s+/).find((s) =>
      /absent|missing|gap|404|not published|not yet|partial|fuller archive/i.test(s),
    );
    if (gapFromNote && !gaps.some((g) => g.includes(gapFromNote.slice(0, 40)))) {
      gaps.push(ensureSentence(gapFromNote));
    }
  }

  if (
    !gaps.length &&
    (seriesKind === 'event' || seriesKind === 'snapshot') &&
    earliest &&
    latest &&
    earliest === latest
  ) {
    gaps.push(
      `This source is published as a ${seriesKind}, so ${describeSeriesKind(seriesKind)}. That is why DecisionPro currently shows a single as-of date rather than a continuous date range.`,
    );
  }

  if (!gaps.length && (!earliest || row.disposition === 'CATALOGUED' || row.disposition === 'BLOCKED')) {
    gaps.push(
      row.disposition === 'BLOCKED'
        ? 'DecisionPro does not yet have a REAL as-of window for this source because the source is blocked on the public proof-of-concept path by license or data-use agreement limits.'
        : row.disposition === 'GAP'
          ? 'This row is an Explicit Gap, so there is no continuous public series to date and no as-of window to load.'
          : 'DecisionPro does not yet have REAL as-of dates for this source because it is catalogued but not bound into the executive landing data.',
    );
  }

  const rangeText = earliest
    ? earliest === latest
      ? `DecisionPro currently has a single as-of date loaded for this source: ${earliest}.`
      : `DecisionPro currently has as-of dates loaded from ${earliest} through ${latest}.`
    : 'DecisionPro does not yet have any as-of dates loaded for this source.';

  const publisherAvailable = availableDepth
    ? ensureSentence(availableDepth)
    : 'The inventory does not yet record how much historical depth this publisher makes available.';

  const grain = row.provides?.grain
    ? `Each published record is organized as ${row.provides.grain}.`
    : '';

  const cadenceText =
    `This source publishes on a ${cadence} cadence. ` +
    `Its series shape is ${seriesKind}, which means ${describeSeriesKind(seriesKind)}.`;

  return {
    title: `${row.fromSysId} — as-of range`,
    range: rangeText,
    publisherAvailable,
    cadence: cadenceText,
    gaps: gaps.length
      ? gaps
      : ['No source-side gaps are recorded for this inventory entry.'],
    grain,
  };
}

/**
 * Compact (i) control on As-of tiles: available range, cadence, and source gaps.
 */
export function AsOfRangeInfoButton({ row }) {
  const explain = buildAsOfExplain(row);
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
                Loaded <GlossaryText text="As-of" /> window
              </h5>
              <p>
                <GlossaryText text={explain.range} />
              </p>
            </section>
            <section>
              <h5>Available from the source</h5>
              <p>
                <GlossaryText text={explain.publisherAvailable} />
              </p>
              {explain.grain ? (
                <p>
                  <GlossaryText text={explain.grain} />
                </p>
              ) : null}
            </section>
            <section>
              <h5>Publishing frequency</h5>
              <p>
                <GlossaryText text={explain.cadence} />
              </p>
            </section>
            <section>
              <h5>Gaps in the source</h5>
              {explain.gaps.length === 1 ? (
                <p>
                  <GlossaryText text={explain.gaps[0]} />
                </p>
              ) : (
                <ul>
                  {explain.gaps.map((g) => (
                    <li key={g}>
                      <GlossaryText text={g} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="asof-info">
      <button
        ref={btnRef}
        type="button"
        className="tile-info-btn asof-info-btn"
        aria-label={`As-of details for ${row.fromSysId}`}
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
