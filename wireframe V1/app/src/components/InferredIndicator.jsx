/**
 * Amber indicator for inferred or unconfirmed report values.
 * Tooltip carries extra confirmation detail on hover.
 */
export function InferredIndicator({ tooltip, label = 'Inferred / unconfirmed' }) {
  if (!tooltip) return null;
  return (
    <span
      className="fr-inferred-indicator"
      title={tooltip}
      aria-label={`${label}. ${tooltip}`}
      role="img"
    >
      ◆
    </span>
  );
}

export function RunwayStatusLine({ title, actionText, tone = 'inferred', tooltip }) {
  if (!actionText) return null;
  const showIndicator = tone !== 'confirmed';
  return (
    <span className="fr-runway-status-line">
      <b>{title}</b>
      <span className={`fr-runway-action-text${showIndicator ? ' is-inferred' : ''}`}>
        {actionText}
        {showIndicator && tooltip ? <InferredIndicator tooltip={tooltip} label={title} /> : null}
      </span>
    </span>
  );
}
