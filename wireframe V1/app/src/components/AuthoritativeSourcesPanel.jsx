import { useEffect, useMemo, useState } from 'react';
import { AUTHORITATIVE_SOURCES } from '../data/alp/authoritativeSources.js';
import { DATA_SPECTRUM } from '../data/alp/dataSpectrum.js';
import { GAP_OBJECTS } from '../data/alp/gapObjects.js';
import { isDownloadableSourceUri } from '../lib/sourceLinks.js';
import { sourceUnblockGuidance } from '../lib/sourceUnblockGuidance.js';
import { GapDetailModal } from './GapDetailModal.jsx';

function spectrumRowFor(fromSysId) {
  return (DATA_SPECTRUM.rows || []).find((r) => r.fromSysId === fromSysId) || null;
}

function downloadSpectrum(format) {
  const stamp = (DATA_SPECTRUM.generatedAt || new Date().toISOString()).slice(0, 10);
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(DATA_SPECTRUM, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decisionpro-data-spectrum-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const summary = DATA_SPECTRUM.summary || {};
  const lines = [
    '# DecisionPro Data Spectrum',
    '',
    `Generated: ${DATA_SPECTRUM.generatedAt || '—'}`,
    '',
    `Loaded ${summary.sourcesLoaded ?? '—'} · Catalogued ${summary.sourcesCatalogued ?? '—'} · Blocked ${summary.sourcesBlocked ?? '—'} · Gaps ${summary.explicitGaps ?? '—'}`,
    `REAL as-of: ${summary.earliestRealAsOf || '—'} → ${summary.latestRealAsOf || '—'}`,
    '',
  ];
  for (const row of DATA_SPECTRUM.rows || []) {
    lines.push(`## ${row.fromSysId} (${row.disposition})`);
    lines.push(`Available: ${row.availableDepth || '—'}`);
    const loaded = row.loadedDepth || {};
    lines.push(
      `Loaded: ${loaded.rowCount || 0} rows` +
        (loaded.earliestAsOf ? ` (${loaded.earliestAsOf} → ${loaded.latestAsOf})` : ''),
    );
    lines.push(`Used: ${(row.howUsed?.consumers || []).join(', ') || '—'}`);
    if (row.inconsistencies?.length) {
      lines.push(`Inconsistencies: ${row.inconsistencies.join('; ')}`);
    }
    lines.push(`Next: ${row.nextAction || '—'}`);
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `decisionpro-data-spectrum-${stamp}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * First-class Authoritative sources browser + Data Spectrum trust narrative.
 */
export function AuthoritativeSourcesPanel({ initialFromSysId = null, onOpenGap }) {
  const sources = AUTHORITATIVE_SOURCES.sources || [];
  const gaps = GAP_OBJECTS.gaps || [];
  const spectrumRows = DATA_SPECTRUM.rows || [];
  const summary = DATA_SPECTRUM.summary || {};
  const [selectedId, setSelectedId] = useState(initialFromSysId || sources[0]?.fromSysId || null);
  const [filter, setFilter] = useState('all');
  const [spectrumSort, setSpectrumSort] = useState('status');
  const [gapDetail, setGapDetail] = useState(null);

  useEffect(() => {
    if (initialFromSysId) setSelectedId(initialFromSysId);
  }, [initialFromSysId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return sources;
    if (filter === 'LOADED') return sources.filter((s) => s.loadStatus === 'LOADED');
    if (filter === 'BLOCKED') return sources.filter((s) => s.loadStatus === 'BLOCKED');
    return sources.filter((s) => s.loadStatus === 'CATALOGUED');
  }, [sources, filter]);

  const selected = sources.find((s) => s.fromSysId === selectedId) || filtered[0] || null;
  const unblock = sourceUnblockGuidance(selected);
  const spectrumSelected = spectrumRowFor(selected?.fromSysId);

  const sortedSpectrum = useMemo(() => {
    const rows = [...spectrumRows];
    const rank = { LOADED: 0, CATALOGUED: 1, BLOCKED: 2, GAP: 3 };
    if (spectrumSort === 'depth') {
      rows.sort((a, b) => (b.loadedDepth?.rowCount || 0) - (a.loadedDepth?.rowCount || 0));
    } else if (spectrumSort === 'id') {
      rows.sort((a, b) => String(a.fromSysId).localeCompare(String(b.fromSysId)));
    } else {
      rows.sort(
        (a, b) =>
          (rank[a.disposition] ?? 9) - (rank[b.disposition] ?? 9) ||
          String(a.fromSysId).localeCompare(String(b.fromSysId)),
      );
    }
    return rows;
  }, [spectrumRows, spectrumSort]);

  return (
    <section className="authoritative-sources" data-walkthrough-target="authoritative-sources">
      <header className="accurate-landing-header">
        <div>
          <p className="accurate-eyebrow">Trust surface</p>
          <h2>Authoritative sources</h2>
          <p className="hint">
            {AUTHORITATIVE_SOURCES.note ||
              'Public government sources for DecisionPro Kentucky. Grades are POC working judgments.'}
          </p>
          {AUTHORITATIVE_SOURCES.generatedAt ? (
            <p className="hint accurate-generated">Exported {AUTHORITATIVE_SOURCES.generatedAt}</p>
          ) : null}
        </div>
        <label className="sources-filter">
          <span className="sr-only">Filter by load status</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All sources</option>
            <option value="LOADED">Loaded</option>
            <option value="CATALOGUED">Catalogued</option>
            <option value="BLOCKED">Blocked / restricted</option>
          </select>
        </label>
      </header>

      <section className="data-spectrum-strip" aria-label="Data Spectrum summary">
        <div className="data-spectrum-strip-head">
          <div>
            <p className="accurate-eyebrow">Data Spectrum</p>
            <h3>Available vs loaded vs used</h3>
            <p className="hint">
              Gate-exported inventory of public SoT depth, what this warehouse loaded, and where the
              dashboard consumes it. Explicit Gaps stay unlabeled as history.
            </p>
          </div>
          <div className="data-spectrum-actions">
            <button type="button" className="linkish" onClick={() => downloadSpectrum('json')}>
              Download JSON
            </button>
            <button type="button" className="linkish" onClick={() => downloadSpectrum('md')}>
              Download Markdown
            </button>
          </div>
        </div>
        <ul className="data-spectrum-chips">
          <li>
            <strong>{summary.sourcesLoaded ?? '—'}</strong>
            <span>Loaded</span>
          </li>
          <li>
            <strong>{summary.sourcesCatalogued ?? '—'}</strong>
            <span>Catalogued</span>
          </li>
          <li>
            <strong>{summary.sourcesBlocked ?? '—'}</strong>
            <span>Blocked</span>
          </li>
          <li>
            <strong>{summary.explicitGaps ?? '—'}</strong>
            <span>Gaps</span>
          </li>
          <li className="data-spectrum-chip-wide">
            <strong>
              {summary.earliestRealAsOf || '—'} → {summary.latestRealAsOf || '—'}
            </strong>
            <span>REAL as-of window</span>
          </li>
          <li className="data-spectrum-chip-wide">
            <strong>{summary.gateTimestamp ? String(summary.gateTimestamp).slice(0, 19) : '—'}</strong>
            <span>Gate timestamp</span>
          </li>
        </ul>

        <div className="data-spectrum-table-wrap">
          <label className="sources-filter data-spectrum-sort">
            <span className="sr-only">Sort spectrum</span>
            <select value={spectrumSort} onChange={(e) => setSpectrumSort(e.target.value)}>
              <option value="status">Sort by status</option>
              <option value="depth">Sort by loaded depth</option>
              <option value="id">Sort by ID</option>
            </select>
          </label>
          <table className="data-spectrum-table">
            <thead>
              <tr>
                <th scope="col">Source / Gap</th>
                <th scope="col">Status</th>
                <th scope="col">Loaded rows</th>
                <th scope="col">As-of</th>
                <th scope="col">Series</th>
              </tr>
            </thead>
            <tbody>
              {sortedSpectrum.map((row) => (
                <tr
                  key={row.fromSysId}
                  className={row.fromSysId === selectedId ? 'is-selected' : ''}
                >
                  <td>
                    <button
                      type="button"
                      className="data-spectrum-row-btn"
                      onClick={() => {
                        if (row.kind === 'gap') {
                          const g = gaps.find((x) => x.gapId === row.fromSysId);
                          if (g) {
                            setGapDetail(g);
                            onOpenGap?.(g);
                          }
                          return;
                        }
                        setSelectedId(row.fromSysId);
                      }}
                    >
                      {row.fromSysId}
                    </button>
                  </td>
                  <td>
                    <span className={`sources-status is-${String(row.disposition || '').toLowerCase()}`}>
                      {row.disposition}
                    </span>
                  </td>
                  <td>{row.loadedDepth?.rowCount ?? 0}</td>
                  <td>
                    {row.loadedDepth?.earliestAsOf
                      ? `${row.loadedDepth.earliestAsOf} → ${row.loadedDepth.latestAsOf}`
                      : '—'}
                  </td>
                  <td>{row.provides?.seriesKind || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="sources-layout">
        <ul className="sources-list" aria-label="Authoritative source catalogue">
          {filtered.map((s) => (
            <li key={s.fromSysId}>
              <button
                type="button"
                className={s.fromSysId === selected?.fromSysId ? 'active' : ''}
                onClick={() => setSelectedId(s.fromSysId)}
              >
                <strong>{s.fromSysId}</strong>
                <span className={`sources-status is-${(s.loadStatus || '').toLowerCase()}`}>
                  {s.loadStatus}
                </span>
                <span className="hint">{s.publisher}</span>
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <article className="sources-detail" aria-label={`Source ${selected.fromSysId}`}>
            <h3>{selected.fromSysId}</h3>
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
              <dd>{selected.publisher}</dd>
              <dt>TOS grade</dt>
              <dd>{selected.tosGrade}</dd>
              <dt>Load status</dt>
              <dd>
                <span className={`sources-status is-${(selected.loadStatus || '').toLowerCase()}`}>
                  {selected.loadStatus}
                </span>
              </dd>
              <dt>As of</dt>
              <dd>{selected.asOfDate || '—'}</dd>
              <dt>Measures</dt>
              <dd>{selected.measureIds?.length ? selected.measureIds.join(', ') : '—'}</dd>
              <dt>Attribution</dt>
              <dd>{selected.attributionNotes}</dd>
              {selected.loadStatus === 'LOADED' && selected.paidFollowOnTodo ? (
                <>
                  <dt>Further access path</dt>
                  <dd>
                    {selected.paidFollowOnTodo}
                    <span className="hint sources-followon-hint">
                      {' '}
                      (Paid / DUA follow-on: work beyond the free public feed already loaded — license, DUA, or
                      richer DMS warehouse.)
                    </span>
                  </dd>
                </>
              ) : null}
              {isDownloadableSourceUri(selected.href) ? (
                <>
                  <dt>Source file</dt>
                  <dd>
                    <a href={selected.href} target="_blank" rel="noopener noreferrer">
                      {selected.href}
                    </a>
                  </dd>
                  {selected.pageHref &&
                  selected.pageHref.replace(/\/$/, '') !== selected.href.replace(/\/$/, '') ? (
                    <>
                      <dt>Containing page</dt>
                      <dd>
                        <a href={selected.pageHref} target="_blank" rel="noopener noreferrer">
                          {selected.pageHref}
                        </a>
                      </dd>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <dt>Containing page</dt>
                  <dd>
                    <a href={selected.href} target="_blank" rel="noopener noreferrer">
                      {selected.href}
                    </a>
                  </dd>
                  {selected.fileHref ? (
                    <>
                      <dt>Source file</dt>
                      <dd>
                        <a href={selected.fileHref} target="_blank" rel="noopener noreferrer">
                          {selected.fileHref}
                        </a>
                      </dd>
                    </>
                  ) : null}
                </>
              )}
            </dl>

            {spectrumSelected ? (
              <div className="data-spectrum-detail" aria-label="Data Spectrum for selected source">
                <h4>Data Spectrum</h4>
                <dl className="accurate-prov-dl">
                  <dt>Available</dt>
                  <dd>{spectrumSelected.availableDepth || '—'}</dd>
                  <dt>Loaded</dt>
                  <dd>
                    {spectrumSelected.loadedDepth?.rowCount || 0} cube rows
                    {spectrumSelected.loadedDepth?.earliestAsOf
                      ? ` · ${spectrumSelected.loadedDepth.earliestAsOf} → ${spectrumSelected.loadedDepth.latestAsOf}`
                      : ''}
                    {spectrumSelected.loadedDepth?.periodIds?.length
                      ? ` · periods: ${spectrumSelected.loadedDepth.periodIds.slice(0, 8).join(', ')}${
                          spectrumSelected.loadedDepth.periodIds.length > 8 ? '…' : ''
                        }`
                      : ''}
                  </dd>
                  <dt>Used</dt>
                  <dd>
                    {(spectrumSelected.howUsed?.consumers || []).length
                      ? spectrumSelected.howUsed.consumers.join(', ')
                      : '—'}
                  </dd>
                  <dt>Inconsistencies</dt>
                  <dd>
                    {spectrumSelected.inconsistencies?.length
                      ? spectrumSelected.inconsistencies.join(' · ')
                      : 'None recorded this gate'}
                  </dd>
                  <dt>Next action</dt>
                  <dd>{spectrumSelected.nextAction || '—'}</dd>
                </dl>
              </div>
            ) : null}
          </article>
        ) : null}
      </div>

      <section className="sources-gaps" aria-label="Explicit paid gaps">
        <h3>Explicit gaps (cannot fill from public web alone)</h3>
        <p className="hint sources-gaps-glossary">
          Each tile is a known hole in the accurate path. <strong>Access path (paid / DUA)</strong> is the
          commercial or authorized next step — not a price list. Click a tile for publishers, cadence, who
          requests access, incorporation steps, and dashboard impact.
        </p>
        <ul className="accurate-smart-grid">
          {gaps.map((g) => (
            <li key={g.gapId}>
              <button
                type="button"
                className="accurate-smart-tile role-home-measure is-info"
                onClick={() => {
                  setGapDetail(g);
                  onOpenGap?.(g);
                }}
              >
                <span className="role-home-measure-kind">Gap · {g.gapId}</span>
                <strong className="role-home-measure-title">{g.title}</strong>
                <p className="role-home-measure-comparison">{g.need}</p>
                <div className="role-home-measure-why">
                  <strong>Access path (paid / DUA)</strong>
                  <span>{g.paidFollowOn}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <GapDetailModal
        gap={gapDetail}
        onClose={() => setGapDetail(null)}
        onBrowseSource={(fromSysId) => setSelectedId(fromSysId)}
      />
    </section>
  );
}
