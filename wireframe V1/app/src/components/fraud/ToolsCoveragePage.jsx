import { useState } from 'react';
import {
  DETECTION_ANALYSES, ANALYSIS_STATUSES, ANALYSIS_STATUS_LABELS, ANALYSIS_STATUS_LEGEND, ANALYSIS_STATUS_DETAIL, ANALYSIS_TIERS, DETECTION_SOURCES, SOURCE_STANDING_PREFIX, SOURCE_STANDING_SUFFIX, standingOfSource,
} from '../../data/potentialFraudCatalog.js';
import { count } from './fraudFormat.jsx';

/**
 * Detection tools and data coverage: every analysis the assessment listed, as a
 * tier-by-status grid with a coverage bar, and the data sources as chips that
 * highlight the analyses they feed. Statuses and the analysis-to-source map are
 * catalog facts; whether a source is loaded comes from the radar export's coverage.
 */

const STATUS_CLASS = Object.freeze({ running: 'is-run', ready: 'is-ready', needs: 'is-needs' });

export function ToolsCoveragePage({ radar, review }) {
  const [source, setSource] = useState('');
  const [analysis, setAnalysis] = useState(-1);
  const coverage = Object.fromEntries(radar.coverage.map((c) => [c.dataRequestId, c]));
  const standing = (s) => standingOfSource(s, coverage);
  const sourceByKey = Object.fromEntries(DETECTION_SOURCES.map((s) => [s.key, s]));
  const statusCounts = Object.fromEntries(ANALYSIS_STATUSES.map((k) => [k, DETECTION_ANALYSES.filter((a) => a.status === k).length]));
  const total = DETECTION_ANALYSES.length;
  const feeds = (a, key) => a.sources.includes(key) || a.waitingOn.includes(key);
  // A source that feeds no analysis (it serves another page) dims nothing.
  const dimFor = source && DETECTION_ANALYSES.some((a) => feeds(a, source)) ? source : '';
  const bt = radar.backtest;
  const run = radar.screenRun;
  const minutes = run.startedAt && run.completedAt ? Math.max(1, Math.round((new Date(run.completedAt) - new Date(run.startedAt)) / 60000)) : null;
  const ys = review.YearSummaries[review.LatestYear];
  const spend = coverage['DR-REAL-TMSIS-STATE-CODE-SPENDING'];
  const enroll = coverage['DR-REAL-PI-ENROLLMENT-ALL-STATES'];
  const time = (t) => String(t ?? '').slice(0, 16).replace('T', ' ');

  function detailText() {
    if (analysis >= 0) {
      const a = DETECTION_ANALYSES[analysis];
      const uses = a.sources.map((k) => `${sourceByKey[k].short}${SOURCE_STANDING_SUFFIX[standing(sourceByKey[k]).standing]}`).join(', ');
      const waits = a.waitingOn.length ? ` · would also use ${a.waitingOn.map((k) => sourceByKey[k].short).join(', ')}` : '';
      return `Tier ${a.tier} · ${a.name} · ${ANALYSIS_STATUS_DETAIL[a.status]} · uses ${uses}${waits} · ${a.needs}`;
    }
    if (source) {
      const s = sourceByKey[source];
      const n = DETECTION_ANALYSES.filter((a) => feeds(a, source)).length;
      const { standing: st, load } = standing(s);
      const state = {
        loaded: () => `loaded, as of ${load.asOf} · ${count(load.rowCount)} rows`,
        partial: () => `partial, through the ${load.dataRequestId} load as of ${load.asOf} · ${s.note}`,
        bundled: () => `ships with this module (${s.bundled})`,
        missing: () => `not loaded${s.note ? ` · ${s.note}` : ''}`,
      }[st]();
      const feedsText = s.usedBy && n === 0 ? `used by ${s.usedBy}, not a detection analysis` : `feeds ${n} ${n === 1 ? 'analysis' : 'analyses'}`;
      return `${s.name} · ${state} · ${feedsText}.`;
    }
    return 'Click a tile for what it checks and what it needs, or a source to see what it feeds.';
  }

  return (
    <div className="pfd-page">
      <h1>Detection tools &amp; data coverage · all public analyses, one scan</h1>
      <p className="pfd-sub">
        Every analysis the 2026-11-07 assessment listed, by tier. Running means this module computes it now; ready means its data is on hand
        and the analysis is not built yet; needs data means a load is missing.
      </p>

      <div className="pfd-card">
        <div className="pfd-tc-head">
          <span><b data-running-count>{statusCounts.running} of {total}</b> analyses run today</span>
          <span className="pfd-muted">
            Last full scan {String(run.completedAt).slice(0, 10)} · {count(run.rowCount)} candidates{minutes ? ` · ${minutes} min` : ''} · known cases reproduced {bt.filter((b) => b.ok).length} / {bt.length}
            {' '}<button type="button" className="pfd-btn pfd-btn-ghost pfd-tc-run" disabled title="The scan runs in the warehouse: npx tsx src/cli.ts tmsis-screen">▶ Run scan</button>
          </span>
        </div>
        <div className="pfd-tc-bar" role="img" aria-label={ANALYSIS_STATUSES.map((k) => `${ANALYSIS_STATUS_LEGEND[k]} ${statusCounts[k]}`).join(', ')}>
          {ANALYSIS_STATUSES.map((k) => <i key={k} className={STATUS_CLASS[k]} style={{ width: `${(statusCounts[k] / total) * 100}%` }} />)}
        </div>
        <div className="pfd-tc-legend">
          {ANALYSIS_STATUSES.map((k) => <span key={k} data-status-count={k}><i className={STATUS_CLASS[k]} />{ANALYSIS_STATUS_LEGEND[k]} {statusCounts[k]}</span>)}
        </div>

        <div className="pfd-tc-cap">Data sources · click one to see what it feeds</div>
        <div className="pfd-tc-sources">
          {DETECTION_SOURCES.map((s) => (
            <button
              key={s.key} type="button" data-source={s.key} aria-pressed={source === s.key}
              className={`pfd-tc-src is-${standing(s).standing}${source === s.key ? ' is-on' : ''}`}
              onClick={() => { setSource(source === s.key ? '' : s.key); setAnalysis(-1); }}
            >
              {SOURCE_STANDING_PREFIX[standing(s).standing]}{s.short}
            </button>
          ))}
        </div>

        {ANALYSIS_TIERS.map((t) => (
          <div className="pfd-tc-tier" key={t.key} data-tier-row={t.key}>
            <div className="pfd-tc-tier-label">{t.label}</div>
            <div className="pfd-tc-tiles">
              {DETECTION_ANALYSES.map((a, i) => (a.tier === t.key ? (
                <button
                  key={a.name} type="button" data-analysis={i} data-analysis-status={a.status} aria-pressed={analysis === i}
                  className={`pfd-tc-tile ${STATUS_CLASS[a.status]}${dimFor && !feeds(a, dimFor) ? ' is-dim' : ''}${analysis === i ? ' is-on' : ''}`}
                  title={`${a.name} · ${ANALYSIS_STATUS_LABELS[a.status]}`}
                  onClick={() => setAnalysis(analysis === i ? -1 : i)}
                >
                  {a.short}
                </button>
              ) : null))}
            </div>
          </div>
        ))}
        <p className="pfd-tc-detail" data-tools-detail>{detailText()}</p>
        <p className="pfd-note">Tier A: state × service screens (the Empower screen, generalized). Tier B: provider screens on the same file. Tier C: joins to exclusion, enrollment, ownership and grant sources. Tier D: the &quot;can health explain it&quot; denominators. Non-public claims are named as a gap; they need a data use agreement.</p>
      </div>

      <div className="pfd-card">
        <h3>Scan console · last run</h3>
        <div className="pfd-console" role="log">
          {spend ? <div>{time(spend.completedAt)} T-MSIS v{radar.asOf} loaded · {count(spend.rowCount)} rows · {spend.loadHistoryId}</div> : null}
          {enroll ? <div>{time(enroll.completedAt)} enrollment, all states, to {enroll.asOf} · {count(enroll.rowCount)} rows</div> : null}
          <div>{time(run.startedAt)} share-and-surge screen started</div>
          <div>{time(run.completedAt)} screen done · {count(run.rowCount)} candidates · {radar.screenLoadHistoryId}</div>
          <div>backtest {bt.filter((b) => b.ok).length}/{bt.length} · {bt.map((b) => `${b.state_code} ${b.hcpcs}${b.year ? ` ${b.year}` : ''} ${b.ok ? '✓' : '✗'}`).join(' · ')}</div>
          <div>radar export {String(radar.generatedAt).slice(0, 16).replace('T', ' ')} · {count(review.ServiceYears.length)} service-years · {review.LatestYear}: {count(ys.services)} flagged, {ys.tiers.high.services} suggested HIGH</div>
          <div>&gt; next: NPPES enumeration and taxonomy join (ready) · LEIE per-biller match (ready) · enrollment segments (needs load)</div>
        </div>
      </div>
    </div>
  );
}
