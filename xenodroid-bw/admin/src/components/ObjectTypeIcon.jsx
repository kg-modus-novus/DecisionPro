/** SVG icons for LSA object types on the data-flow canvas. */
export function ObjectTypeIcon({ type, className = '' }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `obj-icon ${className}`,
    'aria-hidden': true,
  };

  if (type === 'psa') {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v8c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      </svg>
    );
  }
  if (type === 'transformation') {
    return (
      <svg {...common}>
        <path d="M4 7h10" />
        <path d="M14 7l3-3 3 3-3 3-3-3z" />
        <path d="M20 17H10" />
        <path d="M10 17l-3 3-3-3 3-3 3 3z" />
      </svg>
    );
  }
  if (type === 'detailDso') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 10h16M4 15h16M9 4v16" />
      </svg>
    );
  }
  if (type === 'dtp') {
    return (
      <svg {...common}>
        <circle cx="7" cy="12" r="3" />
        <circle cx="17" cy="12" r="3" />
        <path d="M10 12h4" />
        <path d="M14 12l-1.5-1.5M14 12l-1.5 1.5" />
      </svg>
    );
  }
  if (type === 'cube') {
    return (
      <svg {...common}>
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
        <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
      </svg>
    );
  }
  if (type === 'evidenceRoom') {
    return (
      <svg {...common}>
        <path d="M4 20V8l8-4 8 4v12" />
        <path d="M9 20v-6h6v6" />
        <path d="M9 11h.01M15 11h.01" />
      </svg>
    );
  }
  // report / infoProvider
  return (
    <svg {...common}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}
