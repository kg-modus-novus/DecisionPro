import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  UI_ZOOM_OPTIONS,
  UI_ZOOM_STEP,
  normalizeUiZoom,
  readStoredUiZoom,
  stepUiZoom,
  storeUiZoom,
} from '../lib/uiZoom.js';

function applyDocumentZoom(percent) {
  document.documentElement.style.fontSize = `${percent}%`;
  document.documentElement.style.setProperty('--decisionpro-ui-zoom', String(percent / 100));
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

export function UiZoomControl() {
  const listId = useId();
  const [zoom, setZoom] = useState(() => readStoredUiZoom());
  const [draft, setDraft] = useState(() => String(readStoredUiZoom()));
  const [menuOpen, setMenuOpen] = useState(false);
  const comboRef = useRef(null);
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    applyDocumentZoom(zoom);
    storeUiZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeOnPointer(event) {
      if (!comboRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        inputRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOnPointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  function commit(value, fallback = zoom) {
    const trimmed = String(value ?? '').replace('%', '').trim();
    if (!trimmed) {
      setDraft(String(fallback));
      return;
    }
    const next = normalizeUiZoom(trimmed, fallback);
    setZoom(next);
    setDraft(String(next));
  }

  function nudge(direction) {
    const next = stepUiZoom(zoom, direction);
    setZoom(next);
    setDraft(String(next));
  }

  return (
    <div className="ui-zoom-control" role="group" aria-label="Interface zoom">
      <span className="ui-zoom-label">Zoom</span>
      <button
        type="button"
        className="ui-zoom-step"
        aria-label="Decrease zoom"
        onClick={() => nudge(-1)}
        disabled={zoom <= UI_ZOOM_MIN}
      >
        −
      </button>
      <input
        className="ui-zoom-slider"
        type="range"
        min={UI_ZOOM_MIN}
        max={UI_ZOOM_MAX}
        step={UI_ZOOM_STEP}
        value={zoom}
        aria-label="Zoom slider"
        aria-valuetext={`${zoom}%`}
        onChange={(event) => commit(event.target.value)}
      />
      <div ref={comboRef} className="ui-zoom-combobox">
        <span className="sr-only">Zoom percentage</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          role="combobox"
          aria-label="Zoom percentage"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-expanded={menuOpen}
          value={draft}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const nextDraft = event.target.value.replace(/[^0-9%]/g, '');
            setDraft(nextDraft);
            const numeric = Number(nextDraft.replace('%', ''));
            if (Number.isFinite(numeric) && numeric >= UI_ZOOM_MIN && numeric <= UI_ZOOM_MAX) {
              setZoom(Math.round(numeric));
            }
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && event.altKey) {
              setMenuOpen(true);
              event.preventDefault();
              return;
            }
            if (event.key === 'Enter') {
              commit(draft);
              setMenuOpen(false);
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setDraft(String(zoom));
              setMenuOpen(false);
              event.currentTarget.blur();
            }
          }}
        />
        <span aria-hidden="true">%</span>
        <button
          type="button"
          className="ui-zoom-menu-button"
          aria-label="Choose zoom percentage"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">▾</span>
        </button>
        {menuOpen ? (
          <div id={listId} className="ui-zoom-menu" role="listbox" aria-label="Zoom percentage options">
            {UI_ZOOM_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={value === zoom}
                onClick={() => {
                  commit(value);
                  setMenuOpen(false);
                  inputRef.current?.focus();
                }}
              >
                {value}%
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="ui-zoom-step"
        aria-label="Increase zoom"
        onClick={() => nudge(1)}
        disabled={zoom >= UI_ZOOM_MAX}
      >
        +
      </button>
    </div>
  );
}
