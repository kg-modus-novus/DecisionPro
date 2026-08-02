import { DATA_SPECTRUM } from '../data/alp/dataSpectrum.js';
import {
  buildCubeFactRowTotals,
  formatResultantCubeLine,
} from '../lib/resultantCubeDisplay.js';
import { isDownloadableSourceUri } from '../lib/sourceLinks.js';
import { sourceUnblockGuidance } from '../lib/sourceUnblockGuidance.js';
import { GlossaryTerm, GlossaryText } from './GlossaryTerm.jsx';

const CUBE_FACT_TOTALS = buildCubeFactRowTotals(DATA_SPECTRUM.rows);

/**
 * Modal for a single authoritative source catalogue entry + Data Spectrum row.
 */
export function SourceDetailModal({ source, spectrum, onClose }) {
  if (!source) return null;
  const unblock = sourceUnblockGuidance(source);

  return (
    <div
      className="accurate-prov-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Source ${source.fromSysId}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="accurate-prov-panel sources-detail-panel">
        <header>
          <h3>{source.fromSysId}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        {unblock ? (
          <aside
            className={`sources-unblock is-${unblock.status.toLowerCase()}`}
            aria-label={unblock.title}
          >
            <p className="sources-unblock-eyebrow">{unblock.title}</p>
            <dl>
              <dt>Why {unblock.status === 'BLOCKED' ? 'blocked' : 'not loaded'}</dt>
              <dd>{unblock.why}</dd>
              <dt>What is needed</dt>
              <dd>{unblock.need}</dd>
            </dl>
          </aside>
        ) : null}

        <dl className="accurate-prov-dl">
          <dt>Publisher</dt>
          <dd>{source.publisher}</dd>
          <dt>TOS grade</dt>
          <dd>{source.tosGrade}</dd>
          <dt>Load status</dt>
          <dd>
            <span className={`sources-status is-${(source.loadStatus || '').toLowerCase()}`}>
              {source.loadStatus}
            </span>
          </dd>
          <dt>As of</dt>
          <dd>{source.asOfDate || '—'}</dd>
          <dt>Measures</dt>
          <dd>{source.measureIds?.length ? source.measureIds.join(', ') : '—'}</dd>
          <dt>Attribution</dt>
          <dd>{source.attributionNotes}</dd>
          {source.loadStatus === 'LOADED' && source.paidFollowOnTodo ? (
            <>
              <dt>Further access path</dt>
              <dd>
                {source.paidFollowOnTodo}
                <span className="hint sources-followon-hint">
                  {' '}
                  (Paid / DUA follow-on: work beyond the free public feed already loaded — license,
                  DUA, or richer DMS warehouse.)
                </span>
              </dd>
            </>
          ) : null}
          {isDownloadableSourceUri(source.href) ? (
            <>
              <dt>Source file</dt>
              <dd>
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  {source.href}
                </a>
              </dd>
              {source.pageHref &&
              source.pageHref.replace(/\/$/, '') !== source.href.replace(/\/$/, '') ? (
                <>
                  <dt>Containing page</dt>
                  <dd>
                    <a href={source.pageHref} target="_blank" rel="noopener noreferrer">
                      {source.pageHref}
                    </a>
                  </dd>
                </>
              ) : null}
            </>
          ) : (
            <>
              <dt>Containing page</dt>
              <dd>
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  {source.href}
                </a>
              </dd>
              {source.fileHref ? (
                <>
                  <dt>Source file</dt>
                  <dd>
                    <a href={source.fileHref} target="_blank" rel="noopener noreferrer">
                      {source.fileHref}
                    </a>
                  </dd>
                </>
              ) : null}
            </>
          )}
        </dl>

        {spectrum ? (
          <div className="data-spectrum-detail" aria-label="Data Spectrum for selected source">
            <h4>Data Spectrum</h4>
            <dl className="accurate-prov-dl">
              <dt>Available</dt>
              <dd>{spectrum.availableDepth || '—'}</dd>
              <dt>
                <GlossaryTerm id="source-scale">Source scale</GlossaryTerm>
              </dt>
              <dd>
                {(() => {
                  const scale = spectrum.loadedDepth?.sourceScale;
                  const lines = [];
                  for (const b of scale?.batches || []) {
                    if (!(Number(b.count) > 0)) continue;
                    const kind = String(b.kind || '').toLowerCase();
                    const n = Number(b.count) || 0;
                    const count = n.toLocaleString();
                    if (kind === 'csv') lines.push(`${count} ${n === 1 ? 'CSV' : 'CSVs'}`);
                    else if (kind === 'pdf') {
                      lines.push(b.label ? `${count} ${b.label}` : `${count} ${n === 1 ? 'PDF' : 'PDFs'}`);
                    } else if (kind === 'page') lines.push(`${count} ${n === 1 ? 'page' : 'pages'}`);
                    else if (kind === 'vintage') lines.push(`${count} ${n === 1 ? 'vintage' : 'vintages'}`);
                    else if (kind === 'period') lines.push(`${count} ${n === 1 ? 'period' : 'periods'}`);
                    else if (kind === 'year' || kind === 'years') {
                      lines.push(`${count} ${n === 1 ? 'year' : 'years'}`);
                    } else if (kind === 'directory' || kind === 'directories') {
                      lines.push(`${count} ${n === 1 ? 'directory' : 'directories'}`);
                    } else if (kind === 'state' || kind === 'states') {
                      lines.push(`${count} ${n === 1 ? 'state' : 'states'}`);
                    } else if (kind === 'bill' || kind === 'bills') {
                      lines.push(`${count} ${n === 1 ? 'bill' : 'bills'}`);
                    } else if (kind === 'dataset') {
                      lines.push(`${count} ${n === 1 ? 'dataset' : 'datasets'}`);
                    } else lines.push(`${count} ${b.label || b.kind}`);
                  }
                  if (scale?.recordCount != null) {
                    lines.push(
                      `${Number(scale.recordCount).toLocaleString()} ${
                        scale.recordUnit || spectrum.loadedDepth?.sourceRecordUnit || 'records'
                      }`,
                    );
                  } else if (scale?.label?.includes('(')) {
                    const hint = scale.label.match(/\(([^)]+)\)/)?.[1];
                    if (hint) lines.push(hint);
                  }
                  if (!lines.length) lines.push('—');
                  const empty = lines[0] === '—';
                  return (
                    <>
                      <div className={`source-scale-tile${empty ? ' is-empty' : ''}`}>
                        {lines.map((line) => (
                          <span key={line} className="source-scale-line">
                            {line}
                          </span>
                        ))}
                      </div>
                      <span className="hint">
                        <GlossaryText
                          text={
                            scale?.note ||
                            spectrum.loadedDepth?.sourceRecordNote ||
                            'Publisher SoT batching + record totals (not PSA land size)'
                          }
                        />
                      </span>
                    </>
                  );
                })()}
              </dd>
              <dt>
                Loaded (<GlossaryTerm id="psa">PSA</GlossaryTerm>)
              </dt>
              <dd>
                {Number(
                  spectrum.loadedDepth?.loadedRowCount ?? spectrum.loadedDepth?.rowCount ?? 0,
                ).toLocaleString()}{' '}
                records landed in <GlossaryTerm id="psa">PSA</GlossaryTerm>
                {spectrum.loadedDepth?.earliestAsOf
                  ? ` · ${spectrum.loadedDepth.earliestAsOf} → ${spectrum.loadedDepth.latestAsOf}`
                  : ''}
                {spectrum.loadedDepth?.periodIds?.length
                  ? ` · periods: ${spectrum.loadedDepth.periodIds.slice(0, 8).join(', ')}${
                      spectrum.loadedDepth.periodIds.length > 8 ? '…' : ''
                    }`
                  : ''}
              </dd>
              <dt>
                Resultant (<GlossaryTerm id="cube">cubes</GlossaryTerm>)
              </dt>
              <dd>
                <div className="source-scale-tile resultant-tile">
                  <span className="source-scale-line">
                    {Number(spectrum.loadedDepth?.resultantCubeCount ?? 0).toLocaleString()}{' '}
                    {(spectrum.loadedDepth?.resultantCubeCount ?? 0) === 1 ? (
                      <GlossaryTerm id="cube">cube</GlossaryTerm>
                    ) : (
                      <GlossaryTerm id="cube">cubes</GlossaryTerm>
                    )}
                  </span>
                  {(spectrum.loadedDepth?.resultantCubes || []).map((c) => {
                    const line = formatResultantCubeLine(c, CUBE_FACT_TOTALS);
                    return (
                      <span
                        key={line.key}
                        className="source-scale-line"
                        title={`${line.sourceRowCount.toLocaleString()} from this source · ${line.factRowCount.toLocaleString()} in cube fact table`}
                      >
                        {line.text}
                      </span>
                    );
                  })}
                  {!spectrum.loadedDepth?.resultantCubeCount ? (
                    <span className="source-scale-line">
                      No <GlossaryTerm id="cube">Evidence Room cubes</GlossaryTerm> fed yet
                    </span>
                  ) : null}
                </div>
                {spectrum.loadedDepth?.landingRowCount != null ? (
                  <span className="hint">
                    Executive <GlossaryTerm id="landing">landing</GlossaryTerm> binds:{' '}
                    {Number(spectrum.loadedDepth.landingRowCount).toLocaleString()} measure×
                    <GlossaryTerm id="as-of">as-of</GlossaryTerm> rows
                  </span>
                ) : null}
              </dd>
              <dt>Used</dt>
              <dd>
                {(spectrum.howUsed?.consumers || []).length
                  ? spectrum.howUsed.consumers.join(', ')
                  : '—'}
              </dd>
              <dt>Inconsistencies</dt>
              <dd>
                {spectrum.inconsistencies?.length
                  ? spectrum.inconsistencies.join(' · ')
                  : 'None recorded this gate'}
              </dd>
              <dt>Next action</dt>
              <dd>{spectrum.nextAction || '—'}</dd>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
