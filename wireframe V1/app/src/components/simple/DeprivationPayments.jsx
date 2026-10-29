// CodeXen: v1 not-applicable
// Deprivation and what Medicaid pays (subcommittee follow-up, 2026-10-29): Kentucky
// counties' paid per office visit against the Social Deprivation Index or the CDC
// SVI, and states' Medicaid-to-Medicare fee index against state deprivation. All
// figures and correlations are computed in the research file (sourced `rural`);
// this page only displays them.
import { useState } from 'react';
import { formatNumber } from '../../lib/simpleMode/measureModel.js';
import { useLazyArea } from '../../lib/simpleMode/lazyAreas.js';
import { DataAgeBadge, SourceCite } from './SimpleBlocks.jsx';
import { MethodInfo } from './MethodInfo.jsx';

const usd = (v) => formatNumber(v, 'usd');
const r2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');

function Scatter({ points, xLabel, yLabel, yFormat, label }) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (v) => 40 + ((v - x0) / (x1 - x0 || 1)) * 270;
  const sy = (v) => 180 - ((v - y0) / (y1 - y0 || 1)) * 165;
  return (
    <figure className="sm-scatter">
      <svg viewBox="0 0 320 210" role="img" aria-label={label}>
        <line x1="40" y1="182" x2="312" y2="182" className="sm-axis" />
        <line x1="38" y1="12" x2="38" y2="182" className="sm-axis" />
        <text x="36" y="18" className="sm-axis-label" textAnchor="end">{yFormat(y1)}</text>
        <text x="36" y="182" className="sm-axis-label" textAnchor="end">{yFormat(y0)}</text>
        {points.map((p) => (
          <circle key={p.key} cx={sx(p.x)} cy={sy(p.y)} r={p.highlight ? 4.5 : 2.6} className={p.highlight ? 'sm-dot is-ky' : 'sm-dot'}>
            <title>{p.title}</title>
          </circle>
        ))}
        {points.filter((p) => p.highlight).map((p) => <text key={`${p.key}-l`} x={sx(p.x) + 7} y={sy(p.y) + 4} className="sm-axis-label">{p.short}</text>)}
        <text x="176" y="206" className="sm-axis-label" textAnchor="middle">{xLabel}</text>
      </svg>
      <figcaption className="sm-note">{yLabel}, one dot per {points.length > 60 ? 'county' : 'state'}.</figcaption>
    </figure>
  );
}

export function DeprivationPayments() {
  const rural = useLazyArea('rural');
  const local = useLazyArea('local');
  const [index, setIndex] = useState('sdi');
  if (!rural || !local) return <p className="sm-note" role="status">Loading deprivation and payments…</p>;
  const county = rural.get('office-visit-paid-per-visit-by-county');
  const quartiles = rural.get('office-visit-paid-per-visit-by-deprivation-quartile');
  const states = rural.get('fee-ratio-vs-deprivation-states');
  const sdi = rural.get('social-deprivation-index-county');
  const svi = local.get('svi-county-overall');
  if (!county || !quartiles || !states || !sdi) return null;
  const indexRows = new Map(((index === 'sdi' ? sdi : svi)?.rows || []).map((r) => [r.fips || r.key, r.value]));
  const corr = quartiles.correlation?.[index];
  const countyPoints = county.rows
    .filter((r) => Number.isFinite(r.value) && Number.isFinite(indexRows.get(r.fips)))
    .map((r) => ({ key: r.fips, x: indexRows.get(r.fips), y: r.value, title: `${r.label}: ${usd(r.value)} per visit, ${index === 'sdi' ? `deprivation score ${indexRows.get(r.fips)}` : `vulnerability ${Math.round(indexRows.get(r.fips) * 100)}th percentile`}${r.lowVolume ? ' (few visits)' : ''}` }));
  const statePoints = states.rows
    .filter((r) => Number.isFinite(r.value) && Number.isFinite(r.deprivation))
    .map((r) => ({ key: r.key, x: r.deprivation, y: r.value, highlight: r.key === 'KY', short: r.key, title: `${r.label}: Medicaid pays ${r2(r.value)} of Medicare; deprivation ${r.deprivation} (${r.deprivationRank} of 51)` }));
  const suppressed = county.rows.filter((r) => r.suppressed).map((r) => r.label);
  return (
    <div className="sm-deprivation" data-deprivation-payments>
      <p className="sm-note">
        Kentucky Medicaid and Medicare each pay one statewide fee for a given code, so the fee schedule itself does not change with deprivation. What can differ is what Medicaid actually pays per visit, which depends on who bills, managed care plan contracts and how often a visit is paid in part or not at all.
      </p>

      <h3 className="sm-subhead">Kentucky counties: paid per office visit and deprivation</h3>
      <p className="sm-finding" data-deprivation-finding>{quartiles.finding}</p>
      <div className="sm-zip-controls">
        <div className="sm-segmented" role="radiogroup" aria-label="Deprivation index">
          {[['sdi', 'Social Deprivation Index'], ['svi', 'CDC Social Vulnerability Index']].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={index === k} className={index === k ? 'is-active' : ''} onClick={() => setIndex(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="sm-svi-grid">
        <div className="sm-table-wrap">
          <table className="sm-table" aria-label="Paid per office visit by quarter of counties ranked by deprivation">
            <thead><tr><th scope="col">Counties by deprivation (SDI)</th><th scope="col" className="is-num">Paid per visit, mix-adjusted</th><th scope="col" className="is-num">Middle county</th><th scope="col" className="is-num">Visits</th></tr></thead>
            <tbody>
              {quartiles.rows.map((q) => (
                <tr key={q.key} data-deprivation-quartile={q.key}>
                  <th scope="row">{q.label}<small>scores {q.sdiRange?.join('–')}</small></th>
                  <td className="is-num">{usd(q.value)}</td>
                  <td className="is-num">{usd(q.countyMedian)}</td>
                  <td className="is-num">{formatNumber(q.lines, 'count', { compact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Scatter
          points={countyPoints}
          label={`Paid per office visit against ${index === 'sdi' ? 'the Social Deprivation Index' : 'the CDC Social Vulnerability Index'}, one dot per county`}
          xLabel={index === 'sdi' ? 'Less deprived → more deprived' : 'Less vulnerable → more vulnerable'}
          yLabel="Medicaid paid per office visit (adjusted for visit mix)"
          yFormat={usd}
        />
      </div>
      {corr ? <p className="sm-note">County by county: rank correlation {r2(corr.spearmanRho)} across {corr.n} counties (0 = no relationship; ±1 = perfect).</p> : null}
      <p className="sm-proxy">
        Counties are where the billing practice is, not where members live; large groups bill from one address. Paid amounts include visits paid nothing, and rural health clinics and health centers paid per encounter can show little on the visit line itself.
        {suppressed.length ? ` Not shown (fewer than 11 visits): ${suppressed.join(', ')}.` : ''} <MethodInfo measure={county} /> <DataAgeBadge measure={county} short />
      </p>
      <SourceCite source={county.source} period={county.period} />

      <h3 className="sm-subhead">States: fee level and deprivation</h3>
      <p className="sm-finding">{states.finding}</p>
      <Scatter
        points={statePoints}
        label="Medicaid-to-Medicare fee index against state deprivation, one dot per state"
        xLabel="Less deprived → more deprived (population-weighted state score)"
        yLabel="Medicaid fees as a share of Medicare (all services, 2024)"
        yFormat={r2}
      />
      {states.comparability ? <p className="sm-proxy">{states.comparability}</p> : null}
      <p className="sm-note">The Area Deprivation Index needs an account with its publisher and is not used; the Social Deprivation Index (Robert Graham Center) stands in. <MethodInfo measure={states} /> <DataAgeBadge measure={states} short /></p>
      <SourceCite source={states.source} period={states.period} />
    </div>
  );
}
