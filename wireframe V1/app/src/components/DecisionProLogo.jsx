/**
 * Crisp vector brand mark matching the DecisionPro Kentucky header logo.
 * Recreated as SVG so it stays sharp at any DPI (source PNG was ~496×107).
 */
export function DecisionProLogo({ className = '', onClick = null, product = null }) {
  const brand = product?.brand || 'DecisionPro Kentucky';
  const subtitle = product?.subtitle || 'Legislative Modeling & Decision Support System';
  const classes = `decisionpro-logo ${onClick ? 'is-clickable' : ''} ${className}`.trim();
  const content = (
    <>
      <svg
        className="decisionpro-logo-mark"
        viewBox="0 0 48 48"
        width="42"
        height="42"
        aria-hidden="true"
        focusable="false"
      >
        <g fill="#ffffff">
          {/* Finial */}
          <rect x="22.4" y="1.5" width="3.2" height="3.8" rx="0.55" />
          <rect x="20.2" y="5" width="7.6" height="2" rx="0.45" />
          {/* Dome */}
          <path d="M9.5 23.8C9.5 13.6 16.2 7.2 24 7.2s14.5 6.4 14.5 16.6H9.5z" />
          {/* Drum / cornice */}
          <rect x="8" y="22.5" width="32" height="3" rx="0.55" />
          <rect x="6" y="25.3" width="36" height="2.3" rx="0.4" />
          {/* Colonnade with punched column gaps (shows header navy through) */}
          <path
            fillRule="evenodd"
            d="M7 27.4h34v14.6H7z
               M11 28.8h2.35v11.6H11zm5.35 0h2.35v11.6h-2.35zm5.35 0H24.05v11.6H21.7zm5.35 0h2.35v11.6h-2.35zm5.35 0H34.75v11.6H32.4z"
          />
          {/* Plinth / steps */}
          <rect x="4.5" y="41.8" width="39" height="2.2" rx="0.45" />
          <rect x="3" y="44.2" width="42" height="2.3" rx="0.45" />
        </g>
      </svg>
      <div className="decisionpro-logo-text">
        <strong>{brand}</strong>
        <span>{subtitle}</span>
        <em className="decisionpro-logo-attribution">A product of XenoDroid Inc.</em>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        title="Open Role Selector"
        aria-label={`${brand} — open Role Selector`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={classes} aria-label={brand}>
      {content}
    </div>
  );
}
