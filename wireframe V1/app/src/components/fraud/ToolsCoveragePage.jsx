import { DETECTION_ANALYSES, ANALYSIS_STATUS_LABELS, DETECTION_SOURCES } from '../../data/potentialFraudCatalog.js';
import { count } from './fraudFormat.jsx';

/** Detection tools and data coverage: every analysis the assessment listed, its data, and whether it runs today. */

const STATUS_CLASS = { running: 'pfd-st-run', ready: 'pfd-st-ready', needs: 'pfd-st-need' };

export function ToolsCoveragePage({ radar, review }) {
  const by = (k) => DETECTION_ANALYSES.filter((a) => a.status === k).length;
  const coverage = Object.fromEntries(radar.coverage.map((c) => [c.dataRequestId, c]));
  const loaded = DETECTION_SOURCES.filter((s) => s.dataRequestId && coverage[s.dataRequestId]).length;
  const bt = radar.backtest;
  const run = radar.screenRun;
  const minutes = run.startedAt && run.completedAt ? Math.max(1, Math.round((new Date(run.completedAt) - new Date(run.startedAt)) / 60000)) : null;
  const ys = review.YearSummaries[review.LatestYear];
  const spend = coverage['DR-REAL-TMSIS-STATE-CODE-SPENDING'];
  const enroll = coverage['DR-REAL-PI-ENROLLMENT-ALL-STATES'];
  const time = (t) => String(t ?? '').slice(0, 16).replace('T', ' ');

  return (
    <div className="pfd-page">
      <h1>Detection tools &amp; data coverage · all public analyses, one scan</h1>
      <p className="pfd-sub">
        Every analysis the 2026-11-07 assessment listed, grouped by tier, with the data each one needs and whether it runs today. Running means
        this module computes it now; ready means its data is on hand and the analysis is not built yet; needs data means a load is missing.
      </p>
      <div className="pfd-kpis">
        <div className="pfd-kpi"><small>Analyses</small><b>{DETECTION_ANALYSES.length}</b><em>{by('running')} running · {by('ready')} ready · {by('needs')} need a data load</em></div>
        <div className="pfd-kpi"><small>Sources loaded</small><b>{loaded}</b><em>of {DETECTION_SOURCES.length} listed · non-public claims named as a gap</em></div>
        <div className="pfd-kpi"><small>Last full scan</small><b>{String(run.completedAt).slice(0, 10)}</b><em>{count(run.rowCount)} candidates{minutes ? ` · ${minutes} min` : ''}</em></div>
        <div className="pfd-kpi"><small>Known cases reproduced</small><b>{bt.filter((b) => b.ok).length} / {bt.length}</b><em>{bt.filter((b) => b.expected === 'detected').map((b) => `${b.state_code} ${b.hcpcs} ${b.year}`).join(' · ')}</em></div>
        <div className="pfd-kpi pfd-kpi-action">
          <small>Run full scan</small>
          <button type="button" className="pfd-btn" disabled title="The scan runs in the warehouse, not in the browser">▶ Run full scan</button>
          <em>runs in the warehouse: <code>npx tsx src/cli.ts tmsis-screen</code></em>
        </div>
      </div>
      <div className="pfd-row">
        <div className="pfd-card pfd-grow">
          <h3>Analyses by tier</h3>
          <div className="pfd-grid4">
            {DETECTION_ANALYSES.map((a, i) => (
              <div className="pfd-tool" key={i}>
                <span className={`pfd-st ${STATUS_CLASS[a.status]}`}>{ANALYSIS_STATUS_LABELS[a.status]}</span>
                <b>Tier {a.tier}</b>{a.name}
                <small>{a.needs}</small>
              </div>
            ))}
          </div>
          <p className="pfd-note">Tier A: state × service screens (the Empower screen, generalized). Tier B: provider screens on the same file. Tier C: joins to exclusion, enrollment, ownership and grant sources. Tier D: the &quot;can health explain it&quot; denominators.</p>
        </div>
        <div className="pfd-col-right">
          <div className="pfd-card">
            <h3>Data sources</h3>
            <table className="pfd-table pfd-compact">
              <tbody>
                {DETECTION_SOURCES.map((s) => {
                  const c = s.dataRequestId ? coverage[s.dataRequestId] : null;
                  return (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className="r pfd-muted">{c ? `as of ${c.asOf} · ${count(c.rowCount)} rows` : (s.note ?? 'not loaded')}</td>
                      <td><span className={`pfd-st ${c ? 'pfd-st-run' : 'pfd-st-need'}`}>{c ? 'Loaded' : 'Needs data'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pfd-card">
            <h3>Scan console · last run</h3>
            <div className="pfd-console" role="log">
              {spend ? <div>{time(spend.completedAt)} T-MSIS v{radar.asOf} loaded · {count(spend.rowCount)} rows · {spend.loadHistoryId}</div> : null}
              {enroll ? <div>{time(enroll.completedAt)} enrollment, all states, to {enroll.asOf} · {count(enroll.rowCount)} rows</div> : null}
              <div>{time(run.startedAt)} share-and-surge screen started</div>
              <div>{time(run.completedAt)} screen done · {count(run.rowCount)} candidates · {radar.screenLoadHistoryId}</div>
              <div>backtest {bt.filter((b) => b.ok).length}/{bt.length} · {bt.map((b) => `${b.state_code} ${b.hcpcs}${b.year ? ` ${b.year}` : ''} ${b.ok ? '✓' : '✗'}`).join(' · ')}</div>
              <div>radar export {String(radar.generatedAt).slice(0, 16).replace('T', ' ')} · {count(review.ServiceYears.length)} service-years · {review.LatestYear}: {count(ys.services)} flagged, {ys.high} suggested HIGH</div>
              <div>&gt; next: NPPES enumeration and taxonomy join (ready) · LEIE per-biller match (ready) · enrollment segments (needs load)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
