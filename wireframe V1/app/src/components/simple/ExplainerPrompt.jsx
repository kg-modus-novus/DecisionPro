// CodeXen: v1 not-applicable
// The first-visit explainer prompt (Director request 2026-10-28): the first time
// a viewer opens a tab or sub-tab with a new function, a dialog offers a short
// explainer video, with "Not now" and "Don't show again". A "How this works"
// button keeps the video one click away afterwards. Presentation only.
import { useEffect, useRef, useState } from 'react';
import { dismissExplainerForGood, explainerFor, markExplainerOffered, shouldOfferExplainer } from '../../lib/simpleMode/explainers.js';

export function ExplainerPrompt({ view, anchor }) {
  const explainer = explainerFor(view, anchor);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    setPlaying(null);
    if (explainer && shouldOfferExplainer(explainer.id)) {
      markExplainerOffered(explainer.id);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [explainer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!explainer) return null;
  const close = () => { setOpen(false); setPlaying(null); };
  const neverAgain = () => { dismissExplainerForGood(explainer.id); close(); };
  const watch = (v) => { dismissExplainerForGood(explainer.id); setPlaying(v); setOpen(true); };

  return (
    <>
      <button type="button" className="sm-explainer-launch" data-explainer-launch={explainer.id} onClick={() => { setPlaying(explainer.videos.length === 1 ? explainer.videos[0] : null); setOpen(true); }}>
        <span aria-hidden="true">▶</span> How this works
      </button>
      {open ? (
        <div className="sm-explainer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="sm-explainer" role="dialog" aria-modal="true" aria-labelledby="sm-explainer-title" tabIndex={-1} ref={dialogRef} data-explainer={explainer.id}>
            <p className="sm-eyebrow">New in DecisionPro</p>
            <h2 id="sm-explainer-title">{explainer.title}</h2>
            {playing ? (
              <video className="sm-explainer-video" src={playing.src} controls autoPlay playsInline preload="metadata" aria-label={`Explainer video: ${playing.label}`}>
                <track kind="captions" />
              </video>
            ) : (
              <>
                <p>Would you like to watch a short video that shows how this works?</p>
                <div className="sm-explainer-choices">
                  {explainer.videos.map((v) => (
                    <button key={v.id} type="button" className="sm-chip is-primary" data-explainer-watch={v.id} onClick={() => watch(v)}>
                      <span aria-hidden="true">▶</span> {explainer.videos.length > 1 ? v.label : 'Watch the explainer'}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="sm-explainer-actions">
              {explainer.videos.length > 1 && playing ? <button type="button" className="sm-link" onClick={() => setPlaying(null)}>Other videos</button> : null}
              <button type="button" className="sm-link" data-explainer-later onClick={close}>{playing ? 'Close' : 'Not now'}</button>
              {!playing ? <button type="button" className="sm-link" data-explainer-never onClick={neverAgain}>Don’t show again</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
