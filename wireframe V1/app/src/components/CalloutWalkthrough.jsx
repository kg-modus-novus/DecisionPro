import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const GAP = 14;
const BUBBLE_MAX_W = 380;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function measurePlacement(targetEl, bubbleEl = null) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bubbleW = Math.min(BUBBLE_MAX_W, vw - 24);
  const measuredBubbleHeight = bubbleEl?.getBoundingClientRect().height || 360;
  const bubbleH = Math.min(measuredBubbleHeight, vh - 24);
  const maximumTop = Math.max(12, vh - bubbleH - 12);

  if (!targetEl) {
    return {
      mode: 'center',
      bubbleStyle: {
        left: `${(vw - bubbleW) / 2}px`,
        top: `${clamp(vh * 0.2, 12, maximumTop)}px`,
        width: `${bubbleW}px`,
      },
      arrowStyle: null,
      highlightStyle: null,
    };
  }

  targetEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  const rect = targetEl.getBoundingClientRect();
  const spaceAbove = rect.top;
  const spaceBelow = vh - rect.bottom;
  const fitsBelow = spaceBelow >= bubbleH + GAP;
  const fitsAbove = spaceAbove >= bubbleH + GAP;
  const placeBelow = fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove);
  const canPointToTarget = fitsBelow || fitsAbove;

  let top;
  let arrowSide;
  if (!canPointToTarget) {
    top = (vh - bubbleH) / 2;
    arrowSide = null;
  } else if (placeBelow) {
    top = rect.bottom + GAP;
    arrowSide = 'top';
  } else {
    top = rect.top - GAP - bubbleH;
    arrowSide = 'bottom';
  }

  const left = clamp(rect.left + rect.width / 2 - bubbleW / 2, 12, vw - bubbleW - 12);
  top = clamp(top, 12, maximumTop);

  const arrowLeft = clamp(rect.left + rect.width / 2 - left - 8, 16, bubbleW - 32);

  return {
    mode: 'anchor',
    bubbleStyle: {
      left: `${left}px`,
      top: `${top}px`,
      width: `${bubbleW}px`,
    },
    arrowStyle: arrowSide
      ? {
          [arrowSide]: '-8px',
          left: `${arrowLeft}px`,
        }
      : null,
    arrowSide,
    highlightStyle: {
      left: `${Math.max(4, rect.left - 4)}px`,
      top: `${Math.max(4, rect.top - 4)}px`,
      width: `${rect.width + 8}px`,
      height: `${rect.height + 8}px`,
    },
  };
}

/**
 * Multi-step callout bubble with arrow to page targets.
 * mode: 'tour' (role-entry Purpose/Data/Functionality) or 'show-me' (narrative).
 */
export function CalloutWalkthrough({
  open,
  steps = [],
  onClose,
  onSkipAll,
  onComplete,
  onStepChange,
  onShowExample,
  onTryExample,
  onReturnToGuide,
  mode = 'tour',
  initialIndex = 0,
}) {
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState(() => measurePlacement(null));
  const dialogRef = useRef(null);
  const wasOpenRef = useRef(false);

  const step = steps[index] || null;
  const total = steps.length;
  const isLast = index >= total - 1;
  const isShowMe = mode === 'show-me' || step?.mode === 'show-me';
  const isChoice = Boolean(step?.choice);
  const showExampleLaunch = !isShowMe && typeof onShowExample === 'function' && Boolean(step?.example);

  useEffect(() => {
    // Only seed index / route when the tour opens — not on every steps identity
    // change while the user is already mid-tour.
    if (open && !wasOpenRef.current) {
      const start = Math.min(Math.max(0, initialIndex || 0), Math.max(0, steps.length - 1));
      setIndex(start);
      onStepChange?.(steps[start], start);
    }
    wasOpenRef.current = open;
    // The parent keeps the tour/journey steps stable while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, steps, initialIndex]);

  useLayoutEffect(() => {
    if (!open || !step) return undefined;

    function recompute() {
      const el = step.target
        ? document.querySelector(`[data-walkthrough-target="${step.target}"]`)
        : null;
      setPlacement(measurePlacement(el, dialogRef.current));
    }

    recompute();
    const t = window.setTimeout(recompute, 320);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(recompute)
      : null;
    if (resizeObserver && dialogRef.current) resizeObserver.observe(dialogRef.current);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
      resizeObserver?.disconnect();
    };
  }, [open, step, index]);

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();
    function onKey(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        onClose?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !step || !total) return null;

  function goNext() {
    if (isLast) {
      onComplete?.();
      return;
    }
    const nextIndex = index + 1;
    onStepChange?.(steps[nextIndex], nextIndex);
    setIndex(nextIndex);
  }

  function goBack() {
    const nextIndex = Math.max(0, index - 1);
    onStepChange?.(steps[nextIndex], nextIndex);
    setIndex(nextIndex);
  }

  const narrative = step.narrative || step.purpose;
  const exampleText = String(step.example || '').replace(/\s+/g, ' ').trim();
  const narrativeText = String(narrative || '').replace(/\s+/g, ' ').trim();
  const hasDistinctExample =
    Boolean(exampleText)
    && exampleText.toLocaleLowerCase() !== narrativeText.toLocaleLowerCase();
  const showExampleBlock = hasDistinctExample || showExampleLaunch;

  return (
    <div
      className={`walkthrough-layer ${isShowMe ? 'is-show-me' : ''} ${
        placement.highlightStyle ? 'has-highlight' : 'is-centered'
      }`}
      aria-hidden={false}
    >
      <div className="walkthrough-scrim" onClick={() => onClose?.()} />
      {placement.highlightStyle ? (
        <div className="walkthrough-highlight" style={placement.highlightStyle} aria-hidden="true" />
      ) : null}
      <div
        ref={dialogRef}
        className={`walkthrough-bubble ${placement.mode === 'center' ? 'is-center' : ''}`}
        style={placement.bubbleStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkthrough-title"
        aria-describedby="walkthrough-desc"
        tabIndex={-1}
      >
        {placement.arrowStyle ? (
          <span
            className={`walkthrough-arrow walkthrough-arrow-${placement.arrowSide || 'top'}`}
            style={placement.arrowStyle}
            aria-hidden="true"
          />
        ) : null}
        <div className="walkthrough-content">
          <p className="walkthrough-progress">
            {isShowMe ? 'Show Me' : 'Guide'} · Step {index + 1} of {total}
          </p>
          <h2 id="walkthrough-title">{step.title}</h2>
          <div id="walkthrough-desc" className="walkthrough-body">
            {isShowMe ? (
              <p className="walkthrough-narrative">{narrative}</p>
            ) : (
              <>
                <p>
                  <strong>Purpose.</strong> {step.purpose}
                </p>
                <p>
                  <strong>Data.</strong> {step.data}
                </p>
                <p>
                  <strong>Functionality.</strong> {step.functionality}
                </p>
              </>
            )}
          </div>
          {showExampleBlock ? (
            <div className="walkthrough-example">
              {hasDistinctExample ? (
                <>
                  <strong>Example.</strong>
                  <span>{exampleText}</span>
                </>
              ) : null}
              {showExampleLaunch ? (
                <button
                  type="button"
                  className="walkthrough-example-show-me"
                  onClick={() => onShowExample?.(step, index)}
                  aria-label="Show me how to do this example"
                >
                  Show Me
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="walkthrough-footer">
          {isShowMe ? (
            <button type="button" className="walkthrough-btn ghost" onClick={() => onClose?.()}>
              Exit Show Me
            </button>
          ) : (
            <button type="button" className="walkthrough-btn ghost" onClick={() => onSkipAll?.()}>
              Skip All
            </button>
          )}
          <div className="walkthrough-footer-right">
            {isChoice ? (
              <>
                <button
                  type="button"
                  className="walkthrough-btn ghost"
                  onClick={() => onReturnToGuide?.(step)}
                >
                  Return to guide
                </button>
                <button
                  type="button"
                  className="walkthrough-btn primary"
                  onClick={() => onTryExample?.(step)}
                >
                  Let me try it
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="walkthrough-btn ghost"
                  onClick={goBack}
                  disabled={index === 0}
                >
                  Back
                </button>
                <button type="button" className="walkthrough-btn primary" onClick={goNext}>
                  {isLast ? 'Finish' : 'Next'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
