// CodeXen: v1 not-applicable
// Hospital finances and prices (plan items #9 and #2), framed the way Indiana's
// Secretary described her sequence (subcommittee 2026-10-28): price
// transparency, then "how are these hospitals doing?", then ownership.
// Presentation only. Margins, prices and payment levels come from the sourced
// research file; a negative margin is described, never labeled distress.
import { useEffect, useMemo, useState } from 'react';
import { HOSPITAL_SUBTABS } from '../../lib/simpleMode/simpleAreas.js';
import { formatNumber } from '../../lib/simpleMode/measureModel.js';
import { useLazyArea } from '../../lib/simpleMode/lazyAreas.js';
import { DataAgeBadge, SourceCite, SubTabs } from './SimpleBlocks.jsx';
import { MethodInfo } from './MethodInfo.jsx';

const GROUPS = [
  ['all', 'All hospitals'],
  ['critical access', 'Critical access'],
  ['rural', 'Rural (not critical access)'],
  ['urban', 'Urban'],
  ['system', 'Part of a multi-hospital system'],
  ['no-system', 'Independent'],
];
const TIERS = [
  ['double-digit', 'Margin 10% or higher'],
  ['low single-digit', 'Margin 0% to under 10%'],
  ['negative', 'Negative margin'],
];
const PEERS = { KY: 'Kentucky', IN: 'Indiana', TN: 'Tennessee', OH: 'Ohio', WV: 'West Virginia', VA: 'Virginia', IL: 'Illinois', MO: 'Missouri' };

const pct = (v) => formatNumber(v, 'percent');
const usd = (v) => formatNumber(v, 'usd');

export function HospitalsPage({ anchor = null, onSubtabChange } = {}) {
  const area = useLazyArea('hospitals');
  const [marginKind, setMarginKind] = useState('operating');
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const hospitals = useMemo(() => buildHospitalRows(area), [area]);
  const [tab, setTab] = useState(HOSPITAL_SUBTABS.some((t) => t.id === anchor) ? anchor : 'margins');
  useEffect(() => { if (HOSPITAL_SUBTABS.some((t) => t.id === anchor)) setTab(anchor); }, [anchor]);
  if (!area) return <p className="sm-note" role="status">Loading hospital figures…</p>;
  const thirds = area.get(marginKind === 'operating' ? 'hospital-operating-margin-thirds' : 'hospital-total-margin-thirds');
  const tierRows = TIERS.map(([key, label]) => ({ key, label, row: thirds.rows.find((r) => r.group === group && (group === 'all' ? r.key === key : r.key === `${group}|${key}`)) }));
  // Whole-percent shares that add to 100 (largest remainder), so three boxes never read 101%.
  const counted = tierRows.map((t) => t.row?.value || 0);
  const total = counted.reduce((a, b) => a + b, 0) || 1;
  const exact = counted.map((n) => (n / total) * 100);
  const shares = exact.map(Math.floor);
  [...exact.keys()].sort((a, b) => (exact[b] - shares[b]) - (exact[a] - shares[a])).slice(0, 100 - shares.reduce((a, b) => a + b, 0)).forEach((i) => { shares[i] += 1; });
  const median = (id) => area.get(id);
  const state = area.get('commercial-hospital-price-pct-medicare-state');
  const stateRows = state.rows.filter((r) => PEERS[r.key]).sort((a, b) => b.value - a.value);
  const ky = state.rows.find((r) => r.key === 'KY');
  const hrip = area.get('hrip-payment-level-pct-of-commercial');
  const hripMedicare = area.get('hrip-payment-level-pct-of-medicare-estimate');
  const cb = area.get('hospital-community-benefit-pct');
  const dollars = area.get('commercial-hospital-price-dollars-per-case-hospital');
  const dollarRows = (dollars?.rows || []).filter((r) => r.setting === 'inpatient facility' && Number.isFinite(r.value)).sort((a, b) => b.value - a.value);
  const dollarMissing = (dollars?.rows || []).filter((r) => r.setting === 'inpatient facility' && !Number.isFinite(r.value));
  const hripDollars = area.get('hrip-payment-level-dollars-estimate');
  const shown = hospitals.filter((h) => !query || `${h.label} ${h.county} ${h.system}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <SubTabs tabs={HOSPITAL_SUBTABS} current={tab} onSelect={(id) => { setTab(id); onSubtabChange?.(id); }} label="Hospital analyses" />
      {tab === 'margins' ? (
      <section className="sm-section" aria-labelledby="sm-hosp-margins" data-hospital-margins>
        <div className="sm-section-head">
          <h2 id="sm-hosp-margins">How Kentucky hospitals are doing</h2>
          <p className="sm-note">{thirds.value} acute-care and critical access hospitals with a full-year cost report. Indiana described its hospitals in thirds; here is Kentucky the same way.</p>
        </div>
        <div className="sm-zip-controls">
          <div className="sm-segmented" role="radiogroup" aria-label="Margin">
            {[['operating', 'Operating margin'], ['total', 'Total margin']].map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={marginKind === k} className={marginKind === k ? 'is-active' : ''} onClick={() => setMarginKind(k)}>{l}</button>
            ))}
          </div>
          <label className="sm-mco-sort"><span>Hospitals</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>{GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
        </div>
        <ul className="sm-thirds">
          {tierRows.map(({ key, label, row }, i) => (
            <li key={key} className={`is-${key.replace(/\s/g, '-')}`} data-tier={key}>
              <strong>{row ? row.value : 0}</strong>
              <span>{label}</span>
              <small>{row ? `${shares[i]}% of hospitals` : ''}</small>
            </li>
          ))}
        </ul>
        <p className="sm-note">
          {marginKind === 'operating'
            ? 'Operating margin counts only patient care: what hospitals earn from patients minus what care costs.'
            : 'Total margin adds other income (investments, grants, gifts). Many Kentucky hospitals book large other income, so total margins run far above operating margins; the cost report does not say what that income is.'}
          {' '}<MethodInfo measure={thirds} /> <DataAgeBadge measure={thirds} short />
        </p>
        <dl className="sm-contract sm-hosp-medians">
          {[['hospital-operating-margin', 'Median operating margin', pct], ['hospital-total-margin', 'Median total margin', pct], ['hospital-medicaid-revenue-share', 'Median Medicaid share of patient revenue', pct], ['hospital-days-cash-on-hand', 'Median days of cash on hand (independent hospitals)', (v) => formatNumber(v, 'days')], ['hospital-cash-and-investments', 'Cash and investments on hospital balance sheets', (v) => formatNumber(v, 'usd', { compact: true })]].map(([id, label, f]) => {
            const m = median(id);
            return m ? <div key={id}><dt>{label}</dt><dd>{f(m.value)} <MethodInfo measure={m} /></dd></div> : null;
          })}
        </dl>
        <p className="sm-proxy">Most systems hold cash centrally, so hospital balance sheets understate system reserves; this is not comparable to Indiana’s system-level figures.</p>
        <SourceCite source={thirds.source} period={thirds.period} />
      </section>
      ) : null}

      {tab === 'prices' ? (
      <section className="sm-section" aria-labelledby="sm-hosp-prices" data-hospital-prices>
        <div className="sm-section-head">
          <h2 id="sm-hosp-prices">What employers and insurers pay compared with Medicare</h2>
          <p className="sm-note">Commercial hospital prices as a percent of what Medicare would pay for the same care (RAND hospital price study).</p>
        </div>
        <div className="sm-states-head">
          <div className="sm-states-ky">
            <span className="sm-tile-area">Kentucky, {state.period}</span>
            <strong>{pct(ky.value)}</strong>
            <span>of Medicare · {ky.rank}th of 50 states (1 = highest prices)</span>
          </div>
          <ol className="sm-state-bars" aria-label="Commercial hospital prices as a percent of Medicare, Kentucky and neighbors">
            {stateRows.map((r) => (
              <li key={r.key} className={r.key === 'KY' ? 'is-ky' : 'is-peer'} data-state={r.key}>
                <span className="sm-state-rank">{r.rank}</span>
                <span className="sm-state-name">{PEERS[r.key]}</span>
                <span className="sm-state-bar"><i style={{ width: `${(r.value / 350) * 100}%` }} /></span>
                <span className="sm-state-value">{pct(r.value)}</span>
              </li>
            ))}
          </ol>
        </div>
        {state.comparability ? <p className="sm-proxy">{state.comparability}</p> : null}
        <p className="sm-note"><MethodInfo measure={state} /> <DataAgeBadge measure={state} short /></p>
        <SourceCite source={state.source} period={state.period} />
        {dollars ? (
          <div className="sm-hosp-dollars" data-hospital-dollars>
            <h3>The same prices in dollars per inpatient stay</h3>
            <p className="sm-note">
              Each hospital’s commercial price (percent of Medicare) times what Medicare pays that hospital per inpatient stay, from its own cost report. Medicare’s amount already adjusts for how sick patients are, teaching, care for low-income patients and local wages, so it is the common yardstick. Middle hospital: <strong>{usd(dollars.value)}</strong> per stay.
            </p>
            <p className="sm-note"><strong>What it covers:</strong> the hospital’s own payment for an inpatient stay. Doctors bill separately, and capital, medical education and uncompensated-care payments are left out on both sides. <MethodInfo measure={dollars} /></p>
            <div className="sm-table-wrap">
              <table className="sm-table" aria-label="Commercial price per inpatient stay by hospital">
                <thead><tr><th scope="col">Hospital</th><th scope="col" className="is-num">Commercial, % of Medicare</th><th scope="col" className="is-num">Medicare pays per stay</th><th scope="col" className="is-num">Commercial per stay</th></tr></thead>
                <tbody>
                  {dollarRows.map((r) => (
                    <tr key={r.key} data-ccn={r.ccn}>
                      <th scope="row">{r.label}</th>
                      <td className="is-num">{pct(r.pctOfMedicare)}</td>
                      <td className="is-num">{usd(r.medicarePerCase)}</td>
                      <td className="is-num">{usd(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sm-proxy">
              RAND’s percentages cover 2020–2022 and are applied to 2024–2025 Medicare amounts, so these are approximate dollars. Medicare patients are older and sicker than commercial patients, so compare hospitals on the percent and use the dollars for scale. Outpatient prices stay as percentages: the public cost report has no count of Medicare outpatient services to convert with.
              {dollarMissing.length ? ` ${dollarMissing.length} hospitals have no dollar figure: RAND reports no inpatient price for small hospitals, and Medicare pays critical access hospitals on cost.` : ''}
            </p>
            <p className="sm-note"><DataAgeBadge measure={dollars} short /></p>
            <SourceCite source={dollars.source} period={dollars.period} />
          </div>
        ) : null}
        <div className="sm-answer">
          <h3>What public data can answer, and what needs state data</h3>
          <ul>
            <li><strong>Answerable now:</strong> commercial prices as a percent of Medicare for Kentucky and most of its hospitals (2020–2022), hospital margins, Medicaid’s share of hospital revenue, community benefit, and how far Medicaid directed payments raise hospital payments.</li>
            <li><strong>Needs Kentucky claims data:</strong> current prices by insurer and procedure, how well insurers’ posted prices match what they actually paid (Indiana found a 21% match), and Medicaid payments compared with commercial payments for the same hospital and service. These need an all-payer claims database or insurer data under a data use agreement.</li>
          </ul>
        </div>
      </section>
      ) : null}

      {tab === 'medicaid' && hrip ? (
        <section className="sm-section" aria-labelledby="sm-hosp-hrip">
          {hripDollars ? (
            <div className="sm-hosp-dollars" data-hrip-dollars>
              <h3>In dollars per inpatient stay ({hripDollars.period})</h3>
              <div className="sm-table-wrap">
                <table className="sm-table" aria-label="Medicaid managed care hospital payments in dollars">
                  <thead><tr><th scope="col">Payment</th><th scope="col" className="is-num">Dollars</th><th scope="col">As posted</th></tr></thead>
                  <tbody>
                    {hripDollars.rows.filter((r) => Number.isFinite(r.value)).map((r) => (
                      <tr key={r.key}><th scope="row">{r.label}</th><td className="is-num">{r.unit === 'inpatient discharge' ? usd(r.value) : formatNumber(r.value, 'usd', { compact: true })}<small>{r.unit === 'inpatient discharge' ? 'per stay' : r.unit}</small></td><td><small>{r.posted}</small></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="sm-note">Converted from the program’s posted percentages using its own published dollar add-on per stay. <MethodInfo measure={hripDollars} /></p>
            </div>
          ) : null}
          <div className="sm-section-head">
            <h2 id="sm-hosp-hrip">What Medicaid managed care pays hospitals</h2>
            <p className="sm-note">Kentucky states hospital payment levels as a percent of the average commercial rate. Directed payments (HRIP) raise plan payments to that rate; there are no separate tiers for critical access or rural hospitals.</p>
          </div>
          <div className="sm-table-wrap">
            <table className="sm-table" aria-label={hrip.label}>
              <thead><tr><th scope="col">Payment</th><th scope="col" className="is-num">% of average commercial rate</th>{hripMedicare ? <th scope="col" className="is-num">≈ % of Medicare (estimate)</th> : null}</tr></thead>
              <tbody>
                {hrip.rows.filter((r) => /^(ip|op)-(base|hrip|other-sdp|total)$/.test(r.key)).map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.label}</th>
                    <td className="is-num">{pct(r.value)}</td>
                    {hripMedicare ? <td className="is-num">{(() => { const e = hripMedicare.rows.find((x) => x.key === r.key); return e ? pct(e.value) : ''; })()}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sm-note">{hrip.period} <MethodInfo measure={hrip} /> {hripMedicare ? <MethodInfo measure={hripMedicare} /> : null}</p>
          <SourceCite source={hrip.source} period={hrip.period} />
        </section>
      ) : null}

      {tab === 'list' ? (
      <section className="sm-section" aria-labelledby="sm-hosp-list" data-hospital-list>
        <div className="sm-section-head">
          <h2 id="sm-hosp-list">Hospital by hospital</h2>
          <label className="sm-mco-sort"><span>Find</span><input className="sm-hosp-search" value={query} placeholder="Hospital, county or system" onChange={(e) => setQuery(e.target.value)} aria-label="Find a hospital" /></label>
        </div>
        <div className="sm-table-wrap">
          <table className="sm-table" aria-label="Kentucky hospitals">
            <thead>
              <tr>
                <th scope="col">Hospital</th><th scope="col">Type</th>
                <th scope="col" className="is-num">Operating margin</th><th scope="col" className="is-num">Total margin</th>
                <th scope="col" className="is-num">Medicaid share</th><th scope="col" className="is-num">Commercial price, % of Medicare</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((h) => (
                <tr key={h.ccn} data-ccn={h.ccn}>
                  <th scope="row">{h.label}<small>{h.county} County{h.system ? ` · ${h.system}` : ''}</small></th>
                  <td>{h.hospitalType}</td>
                  <td className="is-num">{pct(h.operating)}</td>
                  <td className="is-num">{pct(h.total)}</td>
                  <td className="is-num">{pct(h.medicaid)}</td>
                  <td className="is-num">{Number.isFinite(h.commercial) ? pct(h.commercial) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sm-note">Margins from each hospital’s latest full-year Medicare cost report; commercial prices from RAND (2020–2022). A blank means the source has no figure for that hospital.</p>
      </section>
      ) : null}

      {tab === 'benefit' && cb ? (
        <section className="sm-section" aria-labelledby="sm-hosp-cb">
          <div className="sm-section-head">
            <h2 id="sm-hosp-cb">Community benefit reported by nonprofit hospitals</h2>
            <p className="sm-note">From IRS Form 990 Schedule H, by filing organization. Median {pct(cb.value)} of expenses. <MethodInfo measure={cb} /> <DataAgeBadge measure={cb} short /></p>
          </div>
          <div className="sm-table-wrap">
            <table className="sm-table" aria-label={cb.label}>
              <thead><tr><th scope="col">Organization</th><th scope="col" className="is-num">Community benefit, % of expenses</th><th scope="col" className="is-num">Financial assistance</th><th scope="col" className="is-num">Medicaid shortfall</th><th scope="col" className="is-num">Total revenue</th></tr></thead>
              <tbody>
                {[...cb.rows].sort((a, b) => b.value - a.value).map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.label}{r.facilityNames?.length ? <small>{r.facilityNames.slice(0, 3).join(', ')}{r.facilityNames.length > 3 ? ', …' : ''}</small> : null}</th>
                    <td className="is-num">{pct(r.value)}</td>
                    <td className="is-num">{pct(r.financialAssistancePct)}</td>
                    <td className="is-num">{pct(r.medicaidShortfallPct)}</td>
                    <td className="is-num">{formatNumber(r.totalRevenue, 'usd', { compact: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceCite source={cb.source} period={cb.period} />
        </section>
      ) : null}
    </>
  );
}

function buildHospitalRows(area) {
  if (!area) return [];
  const byCcn = (id) => new Map((area.get(id)?.rows || []).filter((r) => r.ccn).map((r) => [r.ccn, r]));
  const op = byCcn('hospital-operating-margin');
  const total = byCcn('hospital-total-margin');
  const medicaid = byCcn('hospital-medicaid-revenue-share');
  const commercial = byCcn('commercial-hospital-price-pct-medicare-hospital');
  return [...op.values()].map((r) => ({
    ccn: r.ccn,
    label: r.label,
    county: r.county,
    hospitalType: r.hospitalType === 'critical access' ? 'Critical access' : r.hospitalType === 'rural' ? 'Rural' : 'Urban',
    system: r.system || '',
    operating: r.value,
    total: total.get(r.ccn)?.value,
    medicaid: medicaid.get(r.ccn)?.value,
    commercial: commercial.get(r.ccn)?.value,
  })).sort((a, b) => a.label.localeCompare(b.label));
}
