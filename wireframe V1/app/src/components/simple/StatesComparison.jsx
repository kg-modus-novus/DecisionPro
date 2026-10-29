// CodeXen: v1 not-applicable
// "Compare states" (plan item #20, Commissioner Lee): Kentucky's federal
// Medicaid quality (Core Set) results beside every other reporting state, from
// the CMS FFY 2025 Core Set file. Presentation only: ranks and medians come
// from the sourced research file; nothing here judges a state.
import { useMemo, useState } from 'react';
import { formatNumber } from '../../lib/simpleMode/measureModel.js';
import { useLazyArea } from '../../lib/simpleMode/lazyAreas.js';
import { DataAgeBadge, SourceCite } from './SimpleBlocks.jsx';

export const DEFAULT_PEERS = ['IN', 'TN', 'OH', 'WV', 'FL'];
const NEIGHBORS = ['IN', 'OH', 'WV', 'VA', 'TN', 'MO', 'IL'];

const KRS_LABEL = {
  '(a)': 'Follow-up after an emergency room visit',
  '(b)': 'Cancer screenings',
  '(c)': 'Child and adolescent well-care',
  '(d)': 'Postpartum care',
  '(e)': 'Diabetes care',
  '(f)': 'Blood pressure care',
};

function quarterText(m) {
  const [p25, p50, p75] = m.quartiles || [];
  const v = m.value;
  if (![v, p25, p50, p75].every(Number.isFinite)) return '';
  const higherBetter = m.betterDirection !== 'lower';
  const best = higherBetter ? v >= p75 : v <= p25;
  const aboveMid = higherBetter ? v >= p50 : v <= p50;
  const worst = higherBetter ? v < p25 : v > p75;
  if (best) return 'in the best-performing quarter of states';
  if (worst) return 'in the lowest-performing quarter of states';
  return aboveMid ? 'better than the median state' : 'below the median state';
}

/** Every reporting state as a column, best first, read left to right (the at-a-glance view). */
export function StateColumns({ rows, unit, median, peers, label }) {
  const W = 1000;
  const H = 230;
  const top = 18;
  const base = 190;
  const max = Math.max(...rows.map((r) => r.value), Number.isFinite(median) ? median : 0) || 1;
  const step = W / Math.max(rows.length, 1);
  const y = (v) => base - ((v / max) * (base - top));
  return (
    <figure className="sm-state-columns" data-state-columns>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: every reporting state, highest first`}>
        {rows.map((r, i) => {
          const isKy = r.key === 'KY';
          const isPeer = peers.includes(r.key);
          return (
            <g key={r.key} data-state={r.key} className={`${isKy ? 'is-ky' : ''}${isPeer ? ' is-peer' : ''}`}>
              <rect x={i * step + step * 0.15} y={y(r.value)} width={step * 0.7} height={base - y(r.value)} rx="1.5">
                <title>{`${r.rank}. ${r.label}: ${formatNumber(r.value, unit)}`}</title>
              </rect>
              <text x={i * step + step / 2} y={base + 12} textAnchor="middle" className="sm-col-label">{r.key}</text>
              {isKy ? <text x={i * step + step / 2} y={y(r.value) - 5} textAnchor="middle" className="sm-col-value">{formatNumber(r.value, unit)}</text> : null}
            </g>
          );
        })}
        {Number.isFinite(median) ? (
          <g className="sm-col-median">
            <line x1="0" x2={W} y1={y(median)} y2={y(median)} />
            <text x={W - 4} y={y(median) - 4} textAnchor="end">median {formatNumber(median, unit)}</text>
          </g>
        ) : null}
      </svg>
      <figcaption className="sm-note">Each column is a state, ranked from best on the left. Kentucky is green; highlighted states are blue. The full ranked list is below.</figcaption>
    </figure>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function StatesComparisonPage() {
  const measures = useLazyArea('coresetStates');
  const list = useMemo(() => (measures ? [...measures.values()].filter((m) => m.dimension === 'state' && m.id !== 'coreset-states-reporting') : []), [measures]);
  const [id, setId] = useState('');
  const [peers, setPeers] = useState(DEFAULT_PEERS);
  if (!measures) return <p className="sm-note" role="status">Loading the state comparison…</p>;
  const m = measures.get(id) || list.find((x) => x.krs) || list[0];
  if (!m) return null;
  const summary = measures.get('coreset-states-reporting');
  const groups = [
    { label: 'Required by KRS 7A.287', items: list.filter((x) => x.krs).sort((a, b) => a.krs.localeCompare(b.krs)) },
    { label: 'Child Core Set', items: list.filter((x) => !x.krs && x.coreSet === 'Child') },
    { label: 'Adult Core Set', items: list.filter((x) => !x.krs && x.coreSet !== 'Child') },
  ];
  const ranked = [...m.rows].filter((r) => Number.isFinite(r.value)).sort((a, b) => (a.rank || 999) - (b.rank || 999));
  const notReported = m.rows.filter((r) => !Number.isFinite(r.value)).map((r) => r.label);
  const max = Math.max(...ranked.map((r) => r.value), m.unit === 'percent' ? 100 : 0);
  const ky = m.kentucky || {};
  const togglePeer = (code) => setPeers((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  return (
    <>
      <section className="sm-section" aria-labelledby="sm-states-pick">
        <div className="sm-section-head">
          <h2 id="sm-states-pick">Choose a quality measure</h2>
          {summary ? <p className="sm-note">Kentucky reported {summary.rows.find((r) => r.key === 'KY')?.value ?? summary.value} of the 36 mandatory measures for FFY 2025 (median state: {summary.comparison?.value}). Results come from each state’s own report to CMS.</p> : null}
        </div>
        <label className="sm-mco-sort">
          <span>Measure</span>
          <select value={m.id} onChange={(e) => setId(e.target.value)}>
            {groups.filter((g) => g.items.length).map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((x) => <option key={x.id} value={x.id}>{x.krs ? `${x.krs} ` : ''}{x.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </section>

      <section className="sm-section sm-states" aria-labelledby="sm-states-title" data-states-measure={m.id}>
        <div className="sm-section-head">
          <h2 id="sm-states-title">{m.krs ? <span className="sm-statute-tag">KRS 7A.287 {m.krs} · {KRS_LABEL[m.krs]}</span> : null}{m.label}</h2>
          <p className="sm-note">{m.periodLabel || m.period} <DataAgeBadge measure={m} short /></p>
        </div>
        <StateColumns rows={ranked} unit={m.unit} median={m.comparison?.value} peers={peers} label={m.label} />
        <div className="sm-states-head">
          <div className="sm-states-ky">
            <span className="sm-tile-area">Kentucky</span>
            <strong>{Number.isFinite(m.value) ? formatNumber(m.value, m.unit) : 'Not reported'}</strong>
            {ky.rank ? <span>{ordinal(ky.rank)} of {ky.of} states reporting · {quarterText(m)}</span> : null}
          </div>
          <dl className="sm-contract">
            {m.comparison ? <div><dt>{m.comparison.label}</dt><dd>{formatNumber(m.comparison.value, m.unit)}</dd></div> : null}
            {m.quartiles ? <div><dt>Middle half of states</dt><dd>{formatNumber(m.quartiles[0], m.unit)}–{formatNumber(m.quartiles[2], m.unit)}</dd></div> : null}
            <div><dt>Better is</dt><dd>{m.betterDirection === 'lower' ? 'lower' : 'higher'}</dd></div>
            {m.series?.length ? <div><dt>Kentucky trend</dt><dd>{m.series.map((p) => `${p.period.replace('FFY ', '')}: ${formatNumber(p.value, m.unit)}`).join(' · ')}</dd></div> : null}
            {m.medianSeries?.length ? <div><dt>Median trend</dt><dd>{m.medianSeries.map((p) => `${p.period.replace('FFY ', '')}: ${formatNumber(p.value, m.unit)}`).join(' · ')}</dd></div> : null}
          </dl>
        </div>
        {m.methodBreak || m.cmsTrend ? (
          <p className="sm-proxy">
            {m.cmsTrend?.determination ? `CMS trend guidance: ${m.cmsTrend.determination}. ` : ''}
            {m.cmsTrend?.reason || ''}
            {m.methodBreak ? ` Years before and after ${m.methodBreak} are not read as improving or worsening.` : ''}
          </p>
        ) : null}
        {m.comparability ? <p className="sm-proxy">{m.comparability}</p> : null}

        <div className="sm-peer-pick" role="group" aria-label="Highlight states">
          <span>Highlight:</span>
          {NEIGHBORS.concat(DEFAULT_PEERS.filter((c) => !NEIGHBORS.includes(c))).map((code) => (
            <button key={code} type="button" className={`sm-chip${peers.includes(code) ? ' is-active' : ''}`} aria-pressed={peers.includes(code)} onClick={() => togglePeer(code)}>{code}</button>
          ))}
        </div>
        <ol className="sm-state-bars" aria-label={`States ranked by ${m.label}`}>
          {ranked.map((r) => (
            <li key={r.key} className={`${r.key === 'KY' ? 'is-ky' : ''}${peers.includes(r.key) ? ' is-peer' : ''}`} data-state={r.key}>
              <span className="sm-state-rank">{r.rank}</span>
              <span className="sm-state-name">{r.label}</span>
              <span className="sm-state-bar"><i style={{ width: `${max ? (r.value / max) * 100 : 0}%` }} /></span>
              <span className="sm-state-value">{formatNumber(r.value, m.unit)}{r.method && r.method !== 'administrative' ? <small> {r.method}</small> : null}</span>
            </li>
          ))}
        </ol>
        {notReported.length ? <p className="sm-note">Did not report or not publishable: {notReported.join(', ')}.</p> : null}
        {m.rateDefinition ? <p className="sm-note">CMS definition: {m.rateDefinition}</p> : null}
        <SourceCite source={m.source} period={m.periodLabel || m.period} asOf={m.asOf} />
      </section>
    </>
  );
}
