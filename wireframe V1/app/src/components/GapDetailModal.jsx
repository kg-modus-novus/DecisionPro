import { enrichGap } from '../lib/enrichGap.js';

/**
 * Modal explaining an Explicit Gap: what it is, why it matters, access path, and incorporation.
 */
export function GapDetailModal({ gap, onClose, onBrowseSource }) {
  if (!gap) return null;
  const g = enrichGap(gap);
  const steps = Array.isArray(g.incorporateSteps) ? g.incorporateSteps : [];

  return (
    <div className="accurate-prov-backdrop" role="dialog" aria-modal="true" aria-label="Gap detail">
      <div className="accurate-prov-panel gap-detail-panel">
        <header>
          <h3>{g.title}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <p className="hint gap-detail-id">{g.gapId}</p>

        <aside className="gap-followon-callout" aria-label="Access path explained">
          <p className="sources-unblock-eyebrow">Access path (paid / DUA)</p>
          <p>
            <strong>Paid / DUA follow-on</strong> means this measure cannot be completed from free public-web
            downloads alone. Closing the gap needs a commercial or authorized path: data-use agreement (DUA),
            license, DMS/MCO feed, or a paid warehouse build — then a Director-authorized REAL load into
            DecisionPro.
          </p>
          <p className="hint">{g.paidFollowOn || g.need}</p>
        </aside>

        <dl className="accurate-prov-dl">
          <dt>What this data is</dt>
          <dd>{g.whatItIs || g.need || '—'}</dd>
          <dt>Why it matters here</dt>
          <dd>{g.whyUseful || '—'}</dd>
          <dt>Publisher / owner</dt>
          <dd>{g.publisher || '—'}</dd>
          <dt>Refresh cadence</dt>
          <dd>{g.cadence || '—'}</dd>
          <dt>Detail level</dt>
          <dd>{g.detailLevel || '—'}</dd>
          <dt>Access conditions</dt>
          <dd>{g.accessConditions || g.need || '—'}</dd>
          <dt>Who requests it</dt>
          <dd>{g.whoRequests || '—'}</dd>
          <dt>Steps to incorporate</dt>
          <dd>
            {steps.length ? (
              <ol className="gap-incorporate-steps">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : (
              '—'
            )}
          </dd>
          <dt>Dashboard impact once loaded</dt>
          <dd>{g.dashboardImpact || '—'}</dd>
          <dt>Evidence rooms</dt>
          <dd>{g.rooms?.length ? g.rooms.join(', ') : '—'}</dd>
        </dl>

        {g.relatedFromSysIds?.length && onBrowseSource ? (
          <p className="hint">
            Related catalogue sources:{' '}
            {g.relatedFromSysIds.map((id, i) => (
              <span key={id}>
                {i ? ', ' : ''}
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    onClose?.();
                    onBrowseSource(id);
                  }}
                >
                  {id}
                </button>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  );
}
