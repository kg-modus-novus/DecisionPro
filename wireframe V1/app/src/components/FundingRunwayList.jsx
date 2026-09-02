import { useMemo } from 'react';
import { buildFundingRunway, formatDaysRemaining, formatRunwayDate } from '../lib/fundingRunway.js';
import { InferredIndicator, RunwayStatusLine } from './InferredIndicator.jsx';

export function FundingRunwayList({ items, onOpenItem }) {
  const runway = useMemo(() => buildFundingRunway(items), [items]);

  return (
    <section className="fr-runway" aria-labelledby="fr-runway-title">
      <div className="fr-runway-heading">
        <div>
          <p className="fr-runway-kicker">Deadline-first continuity review</p>
          <h3 id="fr-runway-title">Funding runway ({runway.items.length} published deadlines)</h3>
        </div>
        <p>Sorted by soonest published end date. ◆ = inferred or unconfirmed — hover for how to confirm.</p>
      </div>

      <div className="fr-runway-summary" aria-label="Funding runway summary">
        <div><span>Next deadline</span><strong>{formatDaysRemaining(runway.summary.nextDeadlineDays)}</strong></div>
        <div><span>Due within 30 days</span><strong>{runway.summary.dueWithin30}</strong></div>
        <div><span>Due within 90 days</span><strong>{runway.summary.dueWithin90}</strong></div>
        <div><span>Public evidence loaded</span><strong>{runway.summary.publicEvidenceLoaded}</strong></div>
        <div><span>Inferred review signals</span><strong>{runway.summary.inferredGapSignals}</strong></div>
      </div>

      <p className="fr-runway-caveat">
        <strong>Interpretation:</strong> Amber text tells you what you have and what to do next. ◆ adds confirmation steps on hover. Inferred signals are review prompts — not confirmed gaps or lapse predictions.
      </p>

      <ol className="fr-runway-list">
        {runway.items.map((item, index) => (
          <li key={item.id}>
            <button type="button" className="fr-runway-row" onClick={() => onOpenItem(item.id)}>
              <span className="fr-runway-rank" aria-label={`Priority ${index + 1}`}>{index + 1}</span>
              <span className="fr-runway-deadline">
                <span className={`fr-runway-days fr-runway-days-${item.priority}`}>{formatDaysRemaining(item.daysRemaining)}</span>
                <time dateTime={item.date}>{formatRunwayDate(item.date)}</time>
                <small>{item.deadlineType}</small>
              </span>
              <span className="fr-runway-entity">
                <strong>{item.organizationName || item.title}</strong>
                <small>{item.entityTypeLabel || 'Organization type not yet verified'}</small>
                <small>{item.metricLabel}: {item.metricValue} · Assistance listing {item.assistanceListing || 'not reported'}</small>
                <small>Award {item.awardId || 'ID not reported'}{item.recipientUei ? ` · UEI ${item.recipientUei}` : ''}</small>
                {item.rawSourceName && item.organizationName && item.rawSourceName !== item.organizationName ? (
                  <small>Publisher label: {item.rawSourceName}</small>
                ) : null}
                <small className="fr-runway-evidence-loaded">
                  {item.evidenceDisplay?.headline}
                  <InferredIndicator tooltip={item.evidenceDisplay?.confirmTooltip} label="Collected public evidence" />
                </small>
              </span>
              <span className="fr-runway-assessment">
                <RunwayStatusLine
                  title={`Continuation · ${item.continuationStatusLabel}`}
                  actionText={item.continuationAction?.text}
                  tone={item.continuationAction?.tone}
                  tooltip={item.continuationConfirmation?.tooltip}
                />
                <RunwayStatusLine
                  title={`Gap · ${item.gapStatusLabel}`}
                  actionText={item.gapInference?.actionText}
                  tone={item.gapInference?.tone}
                  tooltip={item.gapInference?.tooltip}
                />
              </span>
              <span className="fr-runway-open" aria-hidden="true">Open →</span>
            </button>
          </li>
        ))}
        {runway.items.length === 0 ? <li className="hint">No published funding or authority deadlines match the current filters.</li> : null}
      </ol>

      {runway.informationalCount > 0 ? (
        <p className="fr-runway-footnote">{runway.informationalCount} informational waiver document {runway.informationalCount === 1 ? 'update is' : 'updates are'} excluded from this deadline ordering because a posted-document date is not an expiration.</p>
      ) : null}
    </section>
  );
}
