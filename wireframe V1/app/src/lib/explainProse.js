/** Ensure legislator-facing explain copy reads as a complete sentence. */
export function ensureSentence(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const capped = /^[a-z]/.test(t) ? t[0].toUpperCase() + t.slice(1) : t;
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

export function describeSeriesKind(seriesKind) {
  switch (String(seriesKind || '').toLowerCase()) {
    case 'continuous':
      return 'the publisher updates values across a regular timeline of periods';
    case 'annual':
      return 'the publisher typically releases one update per year';
    case 'periodic':
      return 'the publisher releases data in batches when a new file or table is published';
    case 'snapshot':
      return 'the publisher posts discrete snapshots rather than a continuous period series';
    case 'event':
      return 'the publisher posts when a specific event or page update occurs';
    case 'none':
    case 'blocked':
      return 'no usable public series is available on this path';
    default:
      return 'the publishing pattern is recorded in the source inventory';
  }
}
