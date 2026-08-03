import { useMemo, useState } from 'react';
import { SOURCE_RECONCILIATION } from '../data/alp/sourceReconciliation.js';
import { downloadSourceReconciliationWorkbook } from '../lib/exportSourceReconciliationWorkbook.js';
import {
  RECON_STEPS,
  buildExecutiveParagraphs,
  triggerLabel,
} from '../lib/sourceReconciliationNarrative.js';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

function ProcessFlowDiagram() {
  return (
    <svg
      className="source-recon-flow-svg"
      viewBox="0 0 920 340"
      role="img"
      aria-labelledby="source-recon-flow-title source-recon-flow-desc"
    >
      <title id="source-recon-flow-title">When Source Reconciliation runs</title>
      <desc id="source-recon-flow-desc">
        A REAL refresh or the Accuracy Gate both enter Source Reconciliation. A pass allows an
        accuracy claim. A fail routes below the claim box to repair, reload, and recheck, then
        returns under the diagram to reconciliation.
      </desc>
      <defs>
        <linearGradient id="reconHubGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(110, 200, 255, 0.35)" />
          <stop offset="100%" stopColor="rgba(110, 200, 255, 0.08)" />
        </linearGradient>
        <linearGradient id="reconPassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(143, 214, 168, 0.28)" />
          <stop offset="100%" stopColor="rgba(143, 214, 168, 0.06)" />
        </linearGradient>
        <linearGradient id="reconFailGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(240, 160, 144, 0.28)" />
          <stop offset="100%" stopColor="rgba(240, 160, 144, 0.06)" />
        </linearGradient>
        <marker id="reconArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgba(180, 205, 225, 0.85)" />
        </marker>
      </defs>

      {/* Connectors drawn first; routed in clear lanes so they never cross node boxes */}
      <path
        d="M210 70 H255 V145 H300"
        className="source-recon-flow-path"
        markerEnd="url(#reconArrow)"
      />
      <path
        d="M210 230 H255 V145 H300"
        className="source-recon-flow-path"
        markerEnd="url(#reconArrow)"
      />
      <path
        d="M520 110 H610"
        className="source-recon-flow-path is-pass"
        markerEnd="url(#reconArrow)"
      />
      <path
        d="M410 190 V255 H610"
        className="source-recon-flow-path is-fail"
        markerEnd="url(#reconArrow)"
      />
      <path
        d="M850 255 H895 V310 H410 V190"
        className="source-recon-flow-path is-loop"
        markerEnd="url(#reconArrow)"
      />

      {/* Entry: refresh */}
      <g className="source-recon-svg-node">
        <rect x="40" y="36" width="170" height="68" rx="10" className="is-entry" />
        <text x="125" y="64" textAnchor="middle" className="source-recon-svg-label">
          REAL refresh
        </text>
        <text x="125" y="84" textAnchor="middle" className="source-recon-svg-sub">
          or curated upload
        </text>
      </g>

      {/* Entry: gate */}
      <g className="source-recon-svg-node">
        <rect x="40" y="196" width="170" height="68" rx="10" className="is-entry" />
        <text x="125" y="224" textAnchor="middle" className="source-recon-svg-label">
          Accuracy Gate
        </text>
        <text x="125" y="244" textAnchor="middle" className="source-recon-svg-sub">
          full cutover sequence
        </text>
      </g>

      {/* Hub */}
      <g className="source-recon-svg-node">
        <rect x="300" y="100" width="220" height="90" rx="12" className="is-hub" />
        <text x="410" y="137" textAnchor="middle" className="source-recon-svg-label is-emphasis">
          Source Reconciliation
        </text>
        <text x="410" y="159" textAnchor="middle" className="source-recon-svg-sub">
          independent number check
        </text>
      </g>

      {/* Pass — upper right lane */}
      <g className="source-recon-svg-node">
        <rect x="610" y="65" width="240" height="90" rx="12" className="is-pass" />
        <text x="730" y="102" textAnchor="middle" className="source-recon-svg-label">
          Accuracy claim allowed
        </text>
        <text x="730" y="124" textAnchor="middle" className="source-recon-svg-sub">
          citeable pass for covered measures
        </text>
      </g>

      {/* Fail / repair — lower right lane, clear of pass box */}
      <g className="source-recon-svg-node">
        <rect x="610" y="220" width="240" height="70" rx="10" className="is-fail" />
        <text x="730" y="250" textAnchor="middle" className="source-recon-svg-label">
          Repair, reload, recheck
        </text>
        <text x="730" y="270" textAnchor="middle" className="source-recon-svg-sub">
          then return to reconciliation
        </text>
      </g>

      <text x="248" y="58" textAnchor="middle" className="source-recon-svg-edge">
        always
      </text>
      <text x="248" y="218" textAnchor="middle" className="source-recon-svg-edge">
        always
      </text>
      <text x="560" y="98" textAnchor="middle" className="source-recon-svg-edge is-pass">
        pass
      </text>
      <text x="500" y="248" textAnchor="middle" className="source-recon-svg-edge is-fail">
        fail
      </text>
      <text x="650" y="328" textAnchor="middle" className="source-recon-svg-edge is-fail">
        recheck
      </text>
    </svg>
  );
}

/**
 * Source Reconciliation trust tab — process, flow, last-run executive summary, verify links.
 */
export function SourceReconciliationPanel({ onBrowseSource }) {
  const payload = SOURCE_RECONCILIATION;
  const process = payload.process || {};
  const lastRun = payload.lastRun || {};
  const summary = lastRun.summary || {};
  const results = lastRun.results || [];
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (filter === 'fail') return results.filter((r) => !r.ok);
    if (filter === 'pass') return results.filter((r) => r.ok);
    return results;
  }, [results, filter]);

  const overall = lastRun.overallStatus || '—';
  const claimAllowed = Boolean(summary.claimAllowed);
  const paragraphs = useMemo(
    () => buildExecutiveParagraphs({ lastRun, summary, results, overall, claimAllowed }),
    [lastRun, summary, results, overall, claimAllowed],
  );

  async function onDownloadExcel() {
    setBusy(true);
    try {
      await downloadSourceReconciliationWorkbook(payload);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="source-recon" aria-label="Source Reconciliation">
      <header className="source-recon-header">
        <div className="source-recon-intro">
          <p className="accurate-eyebrow">Trust & verification</p>
          <h3>{process.name || 'Source Reconciliation'}</h3>
          <p className="source-recon-lede">
            This page explains how DecisionPro Kentucky independently verifies dashboard numbers
            against their owning public sources—and shows the results of the latest run so you can
            follow the evidence yourself.
          </p>
        </div>
        <div className="source-recon-actions">
          <button type="button" className="linkish" onClick={onDownloadExcel} disabled={busy}>
            {busy ? 'Preparing Excel…' : 'Download Excel workbook'}
          </button>
        </div>
      </header>

      <section className="source-recon-summary" aria-label="Executive summary">
        <div className="source-recon-summary-head">
          <div>
            <p className="accurate-eyebrow">Overview</p>
            <h4>Executive summary</h4>
          </div>
          <div className="source-recon-status-badges">
            <span className={`sources-status is-${String(overall).toLowerCase()}`}>
              Latest run: {overall}
            </span>
            <span className={`sources-status ${claimAllowed ? 'is-loaded' : 'is-blocked'}`}>
              {claimAllowed ? 'Accuracy claims allowed' : 'Accuracy claims blocked'}
            </span>
          </div>
        </div>

        <div className="source-recon-prose source-desc-sections">
          <div className="source-desc-section">
            <h4 className="source-desc-heading">What it is</h4>
            <p className="source-desc-body">{paragraphs.what}</p>
          </div>
          <div className="source-desc-section">
            <h4 className="source-desc-heading">Why we implemented it</h4>
            <p className="source-desc-body">{paragraphs.why}</p>
          </div>
          <div className="source-desc-section">
            <h4 className="source-desc-heading">When it runs</h4>
            <p className="source-desc-body">{paragraphs.whenItRuns}</p>
          </div>
          <div className="source-desc-section">
            <h4 className="source-desc-heading">Latest results</h4>
            <p className="source-desc-body">{paragraphs.resultsPara}</p>
          </div>
        </div>

        <ul className="data-spectrum-chips source-recon-chips" aria-label="Aggregated check counts">
          <li>
            <strong>{summary.checksTotal ?? results.length}</strong>
            <span>Checks run</span>
          </li>
          <li>
            <strong>{summary.checksPassed ?? '—'}</strong>
            <span>Passed</span>
          </li>
          <li>
            <strong>{summary.checksFailed ?? '—'}</strong>
            <span>Failed</span>
          </li>
          <li className="data-spectrum-chip-wide">
            <strong>{formatWhen(lastRun.ranAt)}</strong>
            <span>Last run · {triggerLabel(lastRun.trigger)}</span>
          </li>
        </ul>

        {(summary.executiveBullets || []).length ? (
          <>
            <h5 className="source-recon-subhead">Headline numbers from this run</h5>
            <p className="hint source-recon-subhint">
              These figures are among the measures compared to their owning published sources. Use
              the links to open the source catalogue entry or the publisher’s page and file.
            </p>
            <ul className="source-recon-headlines" aria-label="Headline reconciled numbers">
              {summary.executiveBullets.map((b) => (
                <li key={b.measureId}>
                  <div className="source-recon-headline-card">
                    <span className="role-home-measure-kind">{b.measureId}</span>
                    <strong>{b.name || b.measureId}</strong>
                    <p className="source-recon-headline-value">{b.displayValue}</p>
                    <p className="hint">
                      Published expectation {b.expected} ·{' '}
                      <span className={`sources-status is-${String(b.result || '').toLowerCase()}`}>
                        {b.result}
                      </span>
                    </p>
                    <div className="source-recon-verify">
                      {b.fromSysId ? (
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => onBrowseSource?.(b.fromSysId)}
                        >
                          Open {b.fromSysId}
                        </button>
                      ) : null}
                      {b.sourcePageUri ? (
                        <a href={b.sourcePageUri} target="_blank" rel="noopener noreferrer">
                          Source page
                        </a>
                      ) : null}
                      {b.sourceUri ? (
                        <a href={b.sourceUri} target="_blank" rel="noopener noreferrer">
                          Source file
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="hint">
            No headline measures are present in this export yet. After the next REAL load, run Source
            Reconciliation to populate them.
          </p>
        )}
      </section>

      <section className="source-recon-flow" aria-label="Process flow">
        <div className="source-recon-flow-intro">
          <p className="accurate-eyebrow">How the process works</p>
          <h4>Process flow</h4>
          <p className="source-recon-lede">
            Two kinds of events can start reconciliation: an ordinary REAL refresh or upload, and
            the full Accuracy Gate cutover. Both paths meet at the same independent check. Only a
            pass may authorize an accuracy claim; a fail returns work to repair before the check
            runs again.
          </p>
        </div>

        <div className="source-recon-flow-canvas">
          <ProcessFlowDiagram />
        </div>

        <h5 className="source-recon-subhead">What happens inside each reconciliation run</h5>
        <p className="hint source-recon-subhint">
          Operators and automated checks follow these steps in order. The advisory concordance step
          adds context; it does not replace matching the owning source.
        </p>

        <ol className="source-recon-timeline">
          {RECON_STEPS.map((step, idx) => (
            <li key={step.id} className={step.advisory ? 'is-advisory' : ''}>
              <div className="source-recon-timeline-marker" aria-hidden="true">
                <span>{idx + 1}</span>
              </div>
              <div className="source-recon-timeline-body">
                <strong>
                  {step.title}
                  {step.advisory ? ' — advisory' : ''}
                </strong>
                <p>{step.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="source-recon-results" aria-label="Reconciliation check results">
        <div className="source-recon-results-head">
          <div>
            <h4>Detailed check results</h4>
            <p className="hint">
              Every automated comparison from the latest run appears below. Open a source identifier
              to jump to the Source List, or follow the page and file links to verify the published
              value yourself.
            </p>
          </div>
          <label className="sources-filter">
            <span className="sr-only">Filter results</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All checks</option>
              <option value="pass">Passed</option>
              <option value="fail">Failed</option>
            </select>
          </label>
        </div>
        <div className="data-spectrum-table-wrap">
          <table className="data-spectrum-table source-recon-table">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Result</th>
                <th scope="col">Expected</th>
                <th scope="col">Actual</th>
                <th scope="col">Verify</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.measureId}-${r.asOfDate || ''}-${r.detail || ''}`}>
                  <td>
                    <strong>{r.measureId}</strong>
                    <div className="hint">{r.name}</div>
                    <div className="hint">{r.detail}</div>
                  </td>
                  <td>
                    <span
                      className={`sources-status is-${String(r.result || (r.ok ? 'pass' : 'fail')).toLowerCase()}`}
                    >
                      {r.result || (r.ok ? 'PASS' : 'FAIL')}
                    </span>
                  </td>
                  <td>{r.expected}</td>
                  <td>{r.actual}</td>
                  <td className="source-recon-verify-cell">
                    {r.fromSysId ? (
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => onBrowseSource?.(r.fromSysId)}
                      >
                        {r.fromSysId}
                      </button>
                    ) : (
                      <span className="hint">—</span>
                    )}
                    {r.sourcePageUri ? (
                      <a href={r.sourcePageUri} target="_blank" rel="noopener noreferrer">
                        Page
                      </a>
                    ) : null}
                    {r.sourceUri ? (
                      <a href={r.sourceUri} target="_blank" rel="noopener noreferrer">
                        File
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
