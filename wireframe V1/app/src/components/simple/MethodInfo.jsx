// CodeXen: v1 not-applicable
// "How it's measured" (plan item #14, after Secretary Sachdev's "methods
// matter"): a measure's definition, inclusions and exclusions, comparability,
// and the non-public data that would improve it, in a pop-up. It also lets a
// viewer set a figure someone else published beside DecisionPro's, method
// against method, kept in this browser only and labeled unverified.
import { useState } from 'react';
import { formatNumber, measureValue } from '../../lib/simpleMode/measureModel.js';
import { checkTargetInput } from '../../lib/simpleMode/draftTargets.js';
import { InfoPopover } from './SimpleBlocks.jsx';

const OTHER_FIGURES_KEY = 'decisionpro.simple.otherFigures';

function readOtherFigures() {
  try {
    const saved = JSON.parse(localStorage.getItem(OTHER_FIGURES_KEY) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function writeOtherFigures(figures) {
  try {
    localStorage.setItem(OTHER_FIGURES_KEY, JSON.stringify(figures));
  } catch {
    // Unavailable storage: the comparison lasts for this page view only.
  }
  return figures;
}

/** Plain-language "better with non-public data" line from a measure's enrichment field. */
export function enrichmentText(e) {
  if (!e?.dataset) return '';
  return `${e.dataset}${e.holder ? ` from ${e.holder}` : ''}${e.access ? ` (${e.access})` : ''}${e.wouldGive ? ` would give ${e.wouldGive.replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase())}` : ''}.`;
}

export function hasMethodInfo(measure) {
  return Boolean(measure?.methodology || measure?.rateDefinition || measure?.comparability || measure?.enrichment?.dataset);
}

function OtherFigure({ measure }) {
  const [figures, setFigures] = useState(readOtherFigures);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ value: '', publisher: '', method: '' });
  const [message, setMessage] = useState('');
  const other = figures[measure.id];
  const ours = measureValue(measure);
  const save = (e) => {
    e.preventDefault();
    const checked = checkTargetInput(form.value, measure.unit);
    if (!checked.ok) { setMessage(checked.reason); return; }
    if (!form.publisher.trim()) { setMessage('Say who published the figure.'); return; }
    setFigures(writeOtherFigures({ ...figures, [measure.id]: { value: checked.value, publisher: form.publisher.trim().slice(0, 120), method: form.method.trim().slice(0, 500) } }));
    setOpen(false);
    setMessage('');
  };
  const remove = () => {
    const next = { ...figures };
    delete next[measure.id];
    setFigures(writeOtherFigures(next));
  };
  return (
    <span className="sm-other-figure">
      {other ? (
        <span className="sm-reconcile" data-reconcile={measure.id}>
          <strong>Side by side</strong>
          <span>DecisionPro: {formatNumber(ours, measure.unit)}{measure.methodology ? ` (${measure.methodology.split(/(?<=\.)\s/)[0]})` : ''}</span>
          <span>{other.publisher}: {formatNumber(other.value, measure.unit)}{other.method ? ` (${other.method})` : ' (method not given)'}</span>
          {Number.isFinite(ours) ? <span>Difference: {formatNumber(Math.abs(other.value - ours), measure.unit === 'percent' ? 'points' : measure.unit)}{measure.unit === 'percent' ? ' points' : ''}. Compare who is counted, the period and what is excluded before reading the gap.</span> : null}
          <small>Figure entered in this browser; DecisionPro has not verified it.</small>
          <button type="button" className="sm-link" onClick={remove}>Remove</button>
        </span>
      ) : open ? (
        <form className="sm-target-form" onSubmit={save}>
          <input aria-label="Their figure" inputMode="decimal" placeholder="Their figure" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <input aria-label="Published by" placeholder="Published by" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
          <input aria-label="Their method" placeholder="Their method (who, period, exclusions)" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
          <span className="sm-target-actions">
            <button type="submit" className="sm-chip">Compare</button>
            <button type="button" className="sm-link" onClick={() => setOpen(false)}>Cancel</button>
          </span>
          {message ? <span className="sm-target-message" role="alert">{message}</span> : null}
        </form>
      ) : (
        <button type="button" className="sm-link" onClick={() => setOpen(true)}>Compare with a figure someone else published</button>
      )}
    </span>
  );
}

export function MethodInfo({ measure }) {
  if (!measure) return null;
  const enrich = enrichmentText(measure.enrichment);
  return (
    <InfoPopover buttonClass="sm-method-btn" buttonLabel={`How ${measure.label} is measured`} buttonContent="How measured" title="How it’s measured" tone="info">
      {measure.rateDefinition ? <span className="sm-pop-para"><strong>Definition.</strong> {measure.rateDefinition}</span> : null}
      {measure.methodology ? <span className="sm-pop-para">{measure.methodology}</span> : null}
      {measure.comparability ? <span className="sm-pop-para"><strong>Comparing it.</strong> {measure.comparability}</span> : null}
      {enrich ? <span className="sm-pop-para sm-enrich"><strong>Better with non-public data.</strong> {enrich}</span> : null}
      {!hasMethodInfo(measure) ? <span className="sm-pop-para">The publisher’s definition applies; open the source for its method.</span> : null}
      <OtherFigure measure={measure} />
    </InfoPopover>
  );
}
