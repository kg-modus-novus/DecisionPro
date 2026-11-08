/** Formatting and small UI helpers shared by the Potential Fraud Detection pages. */

export function money(v, digits = 1) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function pct(v, digits = 1) {
  return `${((Number(v) || 0) * 100).toFixed(digits)}%`;
}

export function multiple(v) {
  const n = Number(v) || 0;
  return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}×`;
}

export function count(v) {
  return Math.round(Number(v) || 0).toLocaleString('en-US');
}

/** Download text as a file from the browser (no server). */
export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const TIER_CLASS = {
  high: 'pfd-tier-high',
  verify: 'pfd-tier-verify',
  convention: 'pfd-tier-convention',
  low: 'pfd-tier-low',
  lookback: 'pfd-tier-convention',
  closed: 'pfd-tier-convention',
};

export function TierBadge({ tier, large = false }) {
  if (!tier) return null;
  return <span className={`pfd-tier ${TIER_CLASS[tier.key] ?? ''}${large ? ' pfd-tier-large' : ''}`}>{tier.label}</span>;
}
