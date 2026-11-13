// CodeXen: v1 not-applicable
// The landing pop-up for every page (Director request 2026-11-13): the first
// time a viewer lands on a page in a session, a dialog offers the page's
// explainer video and its walkthrough, with Skip and Don't show again. A
// "How this works" button keeps both one click away. Presentation only; the
// record of what was dismissed is a viewer convenience in browser storage.
import { useEffect, useRef, useState } from 'react';
import {
  dismissExplainerForGood,
  markExplainerOffered,
  shouldOfferExplainer,
  turnOffPageGuides,
} from '../lib/simpleMode/explainers.js';

/**
 * guide: { id, title, videos: [{ id, label, src }] }
 * onWalkthrough: starts the page's walkthrough, or null when the page has none.
 */
export function PageGuidePrompt({ guide, onWalkthrough = null, launcher = true, suppressed = false }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [allPages, setAllPages] = useState(false);
  const dialogRef = useRef(null);
  const hasVideo = Boolean(guide?.videos?.length);
  const hasWalkthrough = typeof onWalkthrough === 'function';
  const offers = guide && (hasVideo || hasWalkthrough);

  useEffect(() => {
    setPlaying(null);
    setAllPages(false);
    if (offers && !suppressed && shouldOfferExplainer(guide.id)) {
      markExplainerOffered(guide.id);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [guide?.id, suppressed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!offers) return null;
  const close = () => { setOpen(false); setPlaying(null); };
  const neverAgain = () => {
    dismissExplainerForGood(guide.id);
    if (allPages) turnOffPageGuides();
    close();
  };
  const watch = (v) => { dismissExplainerForGood(guide.id); setPlaying(v); setOpen(true); };
  const walk = () => { dismissExplainerForGood(guide.id); close(); onWalkthrough(); };

  return (
    <>
      {launcher ? (
        <button
          type="button"
          className="sm-explainer-launch"
          data-explainer-launch={guide.id}
          onClick={() => { setPlaying(hasVideo && guide.videos.length === 1 && !hasWalkthrough ? guide.videos[0] : null); setOpen(true); }}
        >
          <span aria-hidden="true">▶</span> How this works
        </button>
      ) : null}
      {open ? (
        <div className="sm-explainer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="sm-explainer" role="dialog" aria-modal="true" aria-labelledby="sm-explainer-title" tabIndex={-1} ref={dialogRef} data-explainer={guide.id}>
            <p className="sm-eyebrow">About this page</p>
            <h2 id="sm-explainer-title">{guide.title}</h2>
            {playing ? (
              <video className="sm-explainer-video" src={playing.src} controls autoPlay playsInline preload="metadata" aria-label={`Explainer video: ${playing.label}`}>
                <track kind="captions" />
              </video>
            ) : (
              <>
                <p>
                  {hasVideo && hasWalkthrough
                    ? 'Watch a short video about this page, or take a step-by-step walkthrough of it.'
                    : hasVideo
                      ? 'Would you like to watch a short video that shows how this page works?'
                      : 'Would you like a step-by-step walkthrough of this page?'}
                </p>
                <div className="sm-explainer-choices">
                  {(guide.videos || []).map((v) => (
                    <button key={v.id} type="button" className="sm-chip is-primary" data-explainer-watch={v.id} onClick={() => watch(v)}>
                      <span aria-hidden="true">▶</span> {guide.videos.length > 1 ? v.label : 'Watch the explainer'}
                    </button>
                  ))}
                  {hasWalkthrough ? (
                    <button type="button" className="sm-chip" data-explainer-walkthrough onClick={walk}>
                      Take the walkthrough
                    </button>
                  ) : null}
                </div>
              </>
            )}
            <div className="sm-explainer-actions">
              {playing && (guide.videos.length > 1 || hasWalkthrough) ? <button type="button" className="sm-link" onClick={() => setPlaying(null)}>Back</button> : null}
              {playing && hasWalkthrough ? <button type="button" className="sm-link" data-explainer-walkthrough onClick={walk}>Take the walkthrough</button> : null}
              {!playing ? (
                <label className="sm-explainer-all">
                  <input type="checkbox" checked={allPages} onChange={(e) => setAllPages(e.target.checked)} data-explainer-all-pages />
                  {' '}on every page
                </label>
              ) : null}
              <button type="button" className="sm-link" data-explainer-later onClick={close}>{playing ? 'Close' : 'Skip'}</button>
              {!playing ? <button type="button" className="sm-link" data-explainer-never onClick={neverAgain}>Don’t show again</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
