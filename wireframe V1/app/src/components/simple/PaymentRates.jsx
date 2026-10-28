// CodeXen: v1 not-applicable
// Payment rates (plan items #22, #24, #11; Commissioner Lee and Secretary
// Sachdev at the 2026-10-28 subcommittee): what Medicare pays physicians in
// Kentucky and its neighbors and why, what Kentucky Medicaid pays as a percent
// of that, and how far rates spread between states. Every side-by-side
// comparison passes through the FeeComparison program container (#24).
import { useMemo, useState } from 'react';
import { formatNumber } from '../../lib/simpleMode/measureModel.js';
import { useLazyArea } from '../../lib/simpleMode/lazyAreas.js';
import { FeeComparison } from '../../lib/simpleMode/feeComparisonProgram.js';
import { DataAgeBadge, SourceCite } from './SimpleBlocks.jsx';
import { MethodInfo } from './MethodInfo.jsx';

const usd = (v) => formatNumber(v, 'usd');
const pct = (v) => formatNumber(v, 'percent');
const STATE_NAME = { KY: 'Kentucky', IN: 'Indiana', OH: 'Ohio', WV: 'West Virginia', VA: 'Virginia', TN: 'Tennessee', MO: 'Missouri', IL: 'Illinois' };

function codeOptions(rows) {
  const seen = new Map();
  for (const r of rows) if (r.hcpcs && !seen.has(r.hcpcs)) seen.set(r.hcpcs, String(r.label).replace(/^.*?:\s*/, '').replace(/\s*\((non-)?facility\)$/, '').replace(/\s*-\s*\S+\s+(non-)?facility$/, ''));
  return [...seen.entries()];
}

export function MedicareByState() {
  const fees = useLazyArea('fees');
  const [code, setCode] = useState('99213');
  const [setting, setSetting] = useState('non-facility');
  if (!fees) return <p className="sm-note" role="status">Loading the Medicare fee schedule…</p>;
  const basket = fees.get('medicare-pfs-locality-basket');
  const cf = fees.get('medicare-pfs-conversion-factor');
  const kyBasket = fees.get('medicare-pfs-ky-basket');
  const rows = basket.rows.filter((r) => r.hcpcs === code && r.setting === setting).sort((a, b) => b.value - a.value);
  const codes = codeOptions(kyBasket.rows);
  const national = rows[0]?.national;
  const ky = rows.find((r) => r.state === 'KY');
  return (
    <div data-medicare-by-state>
      <div className="sm-zip-controls">
        <label className="sm-mco-sort"><span>Service</span>
          <select value={code} onChange={(e) => setCode(e.target.value)}>{codes.map(([c, l]) => <option key={c} value={c}>{c} · {l}</option>)}</select>
        </label>
        <div className="sm-segmented" role="radiogroup" aria-label="Setting">
          {[['non-facility', 'Office'], ['facility', 'Hospital or facility']].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={setting === k} className={setting === k ? 'is-active' : ''} onClick={() => setSetting(k)}>{l}</button>
          ))}
        </div>
      </div>
      {ky ? (
        <p className="sm-drivers-lede">
          Medicare pays <strong>{usd(ky.value)}</strong> for {code} in Kentucky, {ky.diffFromNational < 0 ? `${usd(Math.abs(ky.diffFromNational))} below` : `${usd(ky.diffFromNational)} above`} the national amount of {usd(national)}.
          {' '}Of the difference, {usd(ky.diffWork)} is the work adjustment, {usd(ky.diffPracticeExpense)} practice costs (rent and staff), and {usd(ky.diffMalpractice)} malpractice insurance.
        </p>
      ) : <p className="sm-note">Medicare does not price {code} in this setting.</p>}
      <ol className="sm-state-bars" aria-label={`Medicare payment for ${code} by payment area`}>
        {rows.map((r) => (
          <li key={r.key} className={r.state === 'KY' ? 'is-ky' : ''} data-locality={r.key}>
            <span className="sm-state-rank">{r.state}</span>
            <span className="sm-state-name">{r.localityName}</span>
            <span className="sm-state-bar"><i style={{ width: `${(r.value / (rows[0]?.value || 1)) * 100}%` }} /></span>
            <span className="sm-state-value">{usd(r.value)}<small> {formatNumber(r.pctOfNational, 'percent')} of US</small></span>
          </li>
        ))}
      </ol>
      <p className="sm-note">
        Medicare’s formula: work, practice expense and malpractice units, each times the payment area’s geographic adjustment, times the conversion factor ({usd(cf?.value)} in {cf?.period}).
        Kentucky is one statewide payment area. <MethodInfo measure={basket} /> <DataAgeBadge measure={basket} short />
      </p>
      <SourceCite source={basket.source} period={basket.period} />
    </div>
  );
}

export function MedicaidVersusMedicare() {
  const fees = useLazyArea('fees');
  const [code, setCode] = useState('99213');
  const [setting, setSetting] = useState('non-facility');
  const comparison = useMemo(() => {
    if (!fees) return null;
    const c = new FeeComparison();
    c.RateRows = [...(fees.get('ky-medicaid-fee-pct-medicare')?.rows || []), ...(fees.get('neighbor-medicaid-fee-pct-medicare')?.rows || [])];
    c.SelectedCode = code;
    c.SelectedSetting = setting;
    c.CompareRatesOnNormalizedBasis();
    return c;
  }, [fees, code, setting]);
  if (!fees || !comparison) return <p className="sm-note" role="status">Loading Medicaid fee schedules…</p>;
  const kyRates = fees.get('ky-medicaid-fee-pct-medicare');
  const index = fees.get('office-visit-fee-index-states');
  const kff = fees.get('kff-medicaid-medicare-fee-index');
  const kffKy = kff?.rows.find((r) => r.key === 'KY');
  const codes = codeOptions(kyRates.rows);
  return (
    <div data-medicaid-vs-medicare>
      <dl className="sm-rural-facts">
        {index ? <div><dt>Kentucky Medicaid office-visit fees, % of Medicare</dt><dd>{pct(index.value)}<small>Average of 9 office-visit codes; {index.rows.find((r) => r.key === 'KY')?.rank}th of {index.rows.length} states compared</small><MethodInfo measure={index} /></dd></div> : null}
        {kffKy ? <div><dt>All services, Medicaid ÷ Medicare (KFF/Urban)</dt><dd>{formatNumber(kffKy.allServices, 'ratio')}<small>US {formatNumber(kff.rows.find((r) => r.key === 'US' || r.key === 'United States')?.allServices ?? kff.comparison?.value, 'ratio')} · primary care {formatNumber(kffKy.primaryCare, 'ratio')} · {kff.period}</small><MethodInfo measure={kff} /></dd></div> : null}
      </dl>
      <div className="sm-zip-controls">
        <label className="sm-mco-sort"><span>Service</span>
          <select value={code} onChange={(e) => setCode(e.target.value)}>{codes.map(([c, l]) => <option key={c} value={c}>{c} · {l}</option>)}</select>
        </label>
        <div className="sm-segmented" role="radiogroup" aria-label="Setting">
          {[['non-facility', 'Office'], ['facility', 'Facility'], ['n/a', 'Not split']].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={setting === k} className={setting === k ? 'is-active' : ''} onClick={() => setSetting(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="sm-table-wrap">
        <table className="sm-table" aria-label={`Medicaid rates for ${code} as a percent of Medicare`}>
          <thead><tr><th scope="col">State</th><th scope="col" className="is-num">Medicaid rate</th><th scope="col" className="is-num">Medicare in that state</th><th scope="col" className="is-num">% of Medicare</th><th scope="col">As posted</th></tr></thead>
          <tbody>
            {comparison.ComparedRows.map((r) => (
              <tr key={r.key} className={r.state === 'KY' ? 'is-ky-row' : ''} data-fee-state={r.state}>
                <th scope="row">{STATE_NAME[r.state] || r.state}{r.practitionerTier ? <small>{r.practitionerTier}</small> : null}</th>
                <td className="is-num">{usd(r.value)}<small>per {r.unit}</small></td>
                <td className="is-num">{usd(r.medicareAmount)}</td>
                <td className="is-num">{Number.isFinite(r.pctOfMedicare) ? pct(r.pctOfMedicare) : '—'}</td>
                <td><small>{r.posted}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparison.ComparedRowCount === 0 ? <p className="sm-note">No state posts a comparable rate for {code} in this setting.</p> : null}
      {comparison.ExcludedRows.length ? (
        <p className="sm-proxy">Not compared: {comparison.ExcludedRows.map((x) => `${STATE_NAME[x.state] || x.state} (${x.reason})`).join('; ')}.</p>
      ) : null}
      <p className="sm-note">
        Rates are compared only for the same code, setting and unit of service, at each state’s main practitioner level, and only as posted payment rates (never charges).
        These are fee-for-service schedules; most Kentucky members are in managed care plans, which set their own rates. <MethodInfo measure={kyRates} /> <DataAgeBadge measure={kyRates} short />
      </p>
      <SourceCite source={kyRates.source} period={kyRates.period} />
    </div>
  );
}

const SPREADS = ['spread-psychotherapy-90837', 'spread-sud-h0004', 'spread-aba-97153', 'spread-fqhc-visit'];

export function PaymentSpread() {
  const fees = useLazyArea('fees');
  if (!fees) return <p className="sm-note" role="status">Loading payment spreads…</p>;
  return (
    <div className="sm-measures sm-spreads" data-payment-spread>
      {SPREADS.map((id) => fees.get(id)).filter(Boolean).map((m) => {
        const s = m.spread;
        const q = m.qualityPairing;
        const qKy = q?.rows?.find((r) => r.key === 'KY');
        return (
          <article key={m.id} className="sm-measure" data-measure-id={m.id}>
            <header className="sm-measure-head"><h3>{m.label}</h3><span className="sm-measure-badges"><MethodInfo measure={m} /></span></header>
            {s ? (
              <>
                <p className="sm-trend-value">{formatNumber(s.highestToLowest, 'ratio')}×</p>
                <p className="sm-note">Highest neighbor pays {formatNumber(s.highestToLowest, 'ratio')} times the lowest.</p>
                <dl className="sm-contract">
                  <div><dt>Kentucky</dt><dd>{usd(s.kyRate)}</dd></div>
                  <div><dt>Highest ({STATE_NAME[s.highestNeighbor.state]})</dt><dd>{usd(s.highestNeighbor.rate)}</dd></div>
                  <div><dt>Lowest ({STATE_NAME[s.lowestNeighbor.state]})</dt><dd>{usd(s.lowestNeighbor.rate)}</dd></div>
                </dl>
              </>
            ) : <p className="sm-note">{m.rows?.find((r) => r.key === 'KY')?.note || 'Kentucky does not publish this rate.'}</p>}
            {q && qKy ? <p className="sm-proxy">Quality, for context: {q.measure}: Kentucky {pct(qKy.value)} vs median state {pct(q.median)}. A state-level pairing, not evidence that the rate causes the result.</p> : <p className="sm-proxy">No comparable quality measure exists across states for this service.</p>}
          </article>
        );
      })}
      <p className="sm-note">These are spreads between states’ posted rates. The tenfold spread Indiana described was between providers within one state; that needs paid-claims data by provider, available under a data use agreement.</p>
    </div>
  );
}
