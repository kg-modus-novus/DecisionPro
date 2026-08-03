import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AUTHORITATIVE_SOURCES } from '../data/alp/authoritativeSources.js';
import { DATA_SPECTRUM } from '../data/alp/dataSpectrum.js';
import {
  SOURCE_TIMELINE_STATUS_HINT,
  SOURCE_TIMELINE_STATUS_LABEL,
  attachSlotPreview,
  buildSourceTimelines,
  parseSourceDescriptionSections,
} from '../lib/buildSourceTimeline.js';

function SourceDescriptionBlocks({ text }) {
  const sections = useMemo(() => parseSourceDescriptionSections(text), [text]);
  if (!sections.length) return '—';
  if (sections.length === 1 && !sections[0].heading) {
    return sections[0].body;
  }
  return (
    <div className="source-desc-sections">
      {sections.map((section, index) => (
        <div
          key={`${section.heading || 'body'}-${index}`}
          className="source-desc-section"
        >
          {section.heading ? (
            <h4 className="source-desc-heading">{section.heading}</h4>
          ) : null}
          <p className="source-desc-body">{section.body}</p>
        </div>
      ))}
    </div>
  );
}

function StatusLegendItem({ statusKey, label, hint }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const titleId = useId();

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }
    function place() {
      const btn = btnRef.current;
      const pop = popRef.current;
      if (!btn || !pop) return;
      const rect = btn.getBoundingClientRect();
      const popRect = pop.getBoundingClientRect();
      const margin = 8;
      let left = rect.left;
      let top = rect.bottom + 6;
      left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));
      if (top + popRect.height > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - popRect.height - 6);
      }
      setCoords({ top, left });
    }
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, hint]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onPointer(e) {
      if (
        btnRef.current?.contains(e.target) ||
        popRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <li className={`source-timeline-legend-item${open ? ' is-open' : ''}`}>
      <button
        ref={btnRef}
        type="button"
        className="source-timeline-legend-btn"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`source-timeline-swatch is-${statusKey}`} aria-hidden="true" />
        <strong>{label}</strong>
      </button>
      {open
        ? createPortal(
            <div
              ref={popRef}
              id={titleId}
              role="dialog"
              aria-label={`${label} status meaning`}
              className={`source-timeline-status-pop${coords ? ' is-placed' : ''}`}
              style={
                coords
                  ? { top: `${coords.top}px`, left: `${coords.left}px` }
                  : undefined
              }
            >
              <header>
                <h4>{label}</h4>
                <button
                  type="button"
                  className="source-timeline-status-pop-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  Close
                </button>
              </header>
              <p>{hint}</p>
            </div>,
            document.body,
          )
        : null}
    </li>
  );
}

function SlotDataTable({ preview, maximized }) {
  if (!preview?.rows?.length) {
    return <p className="hint">No tabular preview is attached for this slot.</p>;
  }
  return (
    <section className="source-timeline-preview-section">
      <p className="psa-preview-caption hint">{preview.note}</p>
      <div
        className={`source-timeline-preview-scroll psa-preview-scroll${maximized ? ' is-maximized' : ''}`}
        tabIndex={0}
      >
        <table className="psa-preview-table">
          <thead>
            <tr>
              {preview.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Showing {preview.shownRowCount?.toLocaleString?.() ?? preview.rows.length}
        {preview.truncated ? ` of ${preview.totalRowCount.toLocaleString()} (truncated)` : ''} rows.
      </p>
    </section>
  );
}

function SourceTimelineSlotModal({ entry, onClose }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!entry) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        if (maximized) setMaximized(false);
        else onClose?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entry, maximized, onClose]);

  if (!entry) return null;
  const { timeline, slot } = entry;
  const loaded = slot.status === 'loaded';
  const description = slot.description || timeline.description || '—';
  const whyUnavailable = !loaded ? slot.reason : null;
  const statusHint = SOURCE_TIMELINE_STATUS_HINT[slot.status];

  return (
    <div
      className="accurate-prov-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${timeline.fromSysId} · ${slot.periodLabel}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`accurate-prov-panel sources-detail-panel source-timeline-modal${
          maximized ? ' is-maximized' : ''
        }`}
      >
        <header>
          <div>
            <p className="accurate-eyebrow">{timeline.fromSysId}</p>
            <h3>
              {slot.periodLabel}
              <span className={`source-timeline-status is-${slot.status}`}>
                {SOURCE_TIMELINE_STATUS_LABEL[slot.status] || slot.status}
              </span>
            </h3>
          </div>
          <div className="source-timeline-modal-actions">
            {loaded ? (
              <button
                type="button"
                className="ghost"
                aria-pressed={maximized}
                aria-label={maximized ? 'Restore panel size' : 'Maximize panel'}
                onClick={() => setMaximized((v) => !v)}
              >
                {maximized ? 'Restore' : 'Maximize'}
              </button>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
        </header>

        <dl className="accurate-prov-dl">
          <dt>Publisher</dt>
          <dd>{timeline.publisher || '—'}</dd>
          <dt>Cadence</dt>
          <dd>{timeline.cadenceLabel}</dd>
          <dt>Grain</dt>
          <dd>{timeline.grain || '—'}</dd>
          <dt>Description</dt>
          <dd className="source-timeline-description">
            <SourceDescriptionBlocks text={description} />
          </dd>
          {slot.periodNote ? (
            <>
              <dt>This period</dt>
              <dd>{slot.periodNote}</dd>
            </>
          ) : null}
          {whyUnavailable ? (
            <>
              <dt>Why this slot is empty</dt>
              <dd>
                {whyUnavailable}
                {statusHint ? (
                  <p className="hint source-timeline-status-hint">
                    Status meaning: {statusHint}
                  </p>
                ) : null}
              </dd>
            </>
          ) : null}
          <dt>Site URL</dt>
          <dd>
            {slot.siteUri ? (
              <a href={slot.siteUri} target="_blank" rel="noopener noreferrer">
                {slot.siteUri}
              </a>
            ) : (
              '—'
            )}
          </dd>
          <dt>Data URL</dt>
          <dd>
            {slot.dataUri ? (
              <a href={slot.dataUri} target="_blank" rel="noopener noreferrer">
                {slot.dataUri}
              </a>
            ) : loaded ? (
              'Bound at source site / multi-file release (see site URL).'
            ) : (
              '—'
            )}
          </dd>
          {slot.measureIds?.length ? (
            <>
              <dt>Measures</dt>
              <dd>{slot.measureIds.join(', ')}</dd>
            </>
          ) : null}
        </dl>

        {loaded ? <SlotDataTable preview={slot.preview} maximized={maximized} /> : null}
      </div>
    </div>
  );
}

function TimelineTrack({ timeline, onOpenSlot }) {
  const years = useMemo(() => {
    const set = new Set(timeline.slots.map((s) => s.year));
    return [...set].sort((a, b) => a - b);
  }, [timeline.slots]);

  return (
    <article className="source-timeline-row" aria-label={`${timeline.fromSysId} timeline`}>
      <header className="source-timeline-row-head">
        <div className="source-timeline-row-identity">
          <strong>{timeline.fromSysId}</strong>
          <span className="hint">{timeline.publisher}</span>
        </div>
        <div className="source-timeline-row-meta">
          <span className="source-timeline-cadence">{timeline.cadenceLabel}</span>
          <span className="source-timeline-slot-count">
            {timeline.loadedCount}/{timeline.slotCount} slots loaded
          </span>
        </div>
      </header>
      <div className="source-timeline-track-scroll">
        <div
          className={`source-timeline-track is-${timeline.cadence}`}
          role="list"
          aria-label={`${timeline.slotCount} period slots`}
        >
          {timeline.cadence === 'monthly'
            ? years.map((y) => (
                <div key={y} className="source-timeline-year-group" role="presentation">
                  <span className="source-timeline-year-tick">{y}</span>
                  <div className="source-timeline-year-slots">
                    {timeline.slots
                      .filter((s) => s.year === y)
                      .map((slot) => (
                        <button
                          key={slot.slotId}
                          type="button"
                          role="listitem"
                          className={`source-timeline-slot is-${slot.status}`}
                          title={`${slot.periodLabel}: ${SOURCE_TIMELINE_STATUS_LABEL[slot.status] || slot.status}${
                            slot.reason ? ` — ${slot.reason}` : ''
                          }`}
                          aria-label={`${slot.periodLabel}, ${SOURCE_TIMELINE_STATUS_LABEL[slot.status] || slot.status}`}
                          onClick={() => onOpenSlot(timeline, slot)}
                        >
                          <span className="source-timeline-slot-label">{slot.month}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ))
            : timeline.slots.map((slot) => (
                <button
                  key={slot.slotId}
                  type="button"
                  role="listitem"
                  className={`source-timeline-slot is-${slot.status} is-annual`}
                  title={`${slot.periodLabel}: ${SOURCE_TIMELINE_STATUS_LABEL[slot.status] || slot.status}${
                    slot.reason ? ` — ${slot.reason}` : ''
                  }`}
                  aria-label={`${slot.periodLabel}, ${SOURCE_TIMELINE_STATUS_LABEL[slot.status] || slot.status}`}
                  onClick={() => onOpenSlot(timeline, slot)}
                >
                  <span className="source-timeline-slot-label">{slot.year}</span>
                  <span className="source-timeline-slot-state">
                    {SOURCE_TIMELINE_STATUS_LABEL[slot.status] || slot.status}
                  </span>
                </button>
              ))}
        </div>
      </div>
    </article>
  );
}

/**
 * Authoritative Sources → Source Timeline tab.
 * One 10-year track per source; slot density follows cadence.
 */
export function SourceTimelinePanel() {
  const [selected, setSelected] = useState(null);

  const payload = useMemo(
    () =>
      buildSourceTimelines({
        spectrumRows: DATA_SPECTRUM.rows || [],
        sources: AUTHORITATIVE_SOURCES.sources || [],
        asOf: new Date(),
      }),
    [],
  );

  function openSlot(timeline, slot) {
    const enriched =
      slot.status === 'loaded' ? attachSlotPreview(slot, timeline.spectrum) : slot;
    setSelected({ timeline, slot: enriched });
  }

  return (
    <section className="source-timeline" aria-label="Source Timeline">
      <header className="source-recon-header">
        <div className="source-recon-intro">
          <p className="accurate-eyebrow">Coverage map</p>
          <h3>Source Timeline</h3>
          <p className="source-recon-lede">
            Each authoritative source shows a trailing 10-year window ending at today. Slot count
            matches publish cadence (yearly → 10 slots; monthly → 120). Filled slots are REAL binds.
            Empty slots explain whether the publisher is missing the period or DecisionPro simply did
            not bind it.
          </p>
        </div>
      </header>

      <section className="source-recon-summary" aria-label="Timeline summary">
        <div className="source-recon-summary-head">
          <div>
            <p className="accurate-eyebrow">Overview</p>
            <h4>Window inventory</h4>
          </div>
        </div>
        <ul className="data-spectrum-chips source-recon-chips" aria-label="Timeline counts">
          <li>
            <strong>{payload.summary.sources}</strong>
            <span>sources</span>
          </li>
          <li>
            <strong>{payload.summary.slots.toLocaleString()}</strong>
            <span>expected slots</span>
          </li>
          <li>
            <strong>{payload.summary.loadedSlots.toLocaleString()}</strong>
            <span>loaded</span>
          </li>
          <li>
            <strong>{payload.summary.emptySlots.toLocaleString()}</strong>
            <span>empty / explained</span>
          </li>
          <li className="data-spectrum-chip-wide">
            <strong>
              {payload.windowEnd.year - 9} → {payload.windowEnd.year}
              {payload.timelines.some((t) => t.cadence === 'monthly')
                ? ` · monthly through ${payload.windowEnd.year}-${String(payload.windowEnd.month).padStart(2, '0')}`
                : ''}
            </strong>
            <span>coverage window</span>
          </li>
        </ul>
        <ul className="source-timeline-legend" aria-label="Slot legend">
          {Object.entries(SOURCE_TIMELINE_STATUS_LABEL).map(([key, label]) => (
            <StatusLegendItem
              key={key}
              statusKey={key}
              label={label}
              hint={SOURCE_TIMELINE_STATUS_HINT[key]}
            />
          ))}
        </ul>
      </section>

      <div className="source-timeline-list">
        {payload.timelines.map((tl) => (
          <TimelineTrack key={tl.fromSysId} timeline={tl} onOpenSlot={openSlot} />
        ))}
      </div>

      <SourceTimelineSlotModal entry={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
