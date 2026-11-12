/** Formatting and small UI helpers shared by the Potential Fraud Detection pages. */
import { getGlossaryTermForBillingCode } from '../../data/glossary.js';
import { useOptionalGlossary } from '../../lib/GlossaryContext.jsx';

/**
 * A billing code with a "?" beside it. Hovering the "?" shows the code's description and clicking
 * it opens the glossary at that entry: the code's own, else its code family's, else what a billing
 * code is. The "?" is drawn by the stylesheet, so the text of the heading it sits in is unchanged.
 * Outside the glossary it shows the code alone. `plain` keeps the surrounding text style.
 */
export function BillingCode({ code, plain = false }) {
  const glossary = useOptionalGlossary();
  const entry = getGlossaryTermForBillingCode(code);
  return (
    <span className="pfd-billing-code">
      <span className={plain ? undefined : 'pfd-code'}>{code}</span>
      {entry && glossary ? (
        <button
          type="button"
          className="pfd-code-help"
          data-code-help={code}
          aria-label={`What is ${code}? Opens ${entry.term} in the glossary.`}
          title={`${entry.term}: ${entry.definition}`}
          onClick={(e) => { e.stopPropagation(); glossary.openGlossary(entry.id); }}
        />
      ) : null}
    </span>
  );
}

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
  explained: 'pfd-tier-convention',
  closed: 'pfd-tier-convention',
};

export function TierBadge({ tier, large = false }) {
  if (!tier) return null;
  return <span className={`pfd-tier ${TIER_CLASS[tier.key] ?? ''}${large ? ' pfd-tier-large' : ''}`}>{tier.label}</span>;
}
