// CodeXen: v1 not-applicable
// Rural access (plan item #12) and the deprivation payment scenario (#6),
// from Sen. Meredith's questions at the 2026-10-28 subcommittee. Presentation
// and wiring only: the scenario's arithmetic is the
// PaymentRedistributionScenario program container. Where the data does not
// support a figure quoted in the room, the page shows what the data says.
import { useMemo, useState } from 'react';
import { formatNumber } from '../../lib/simpleMode/measureModel.js';
import { useLazyArea } from '../../lib/simpleMode/lazyAreas.js';
import { COUNTY_NAME } from '../../lib/simpleMode/geography.js';
import { PaymentRedistributionScenario, REDIRECT_SHARE_MAX_PCT } from '../../lib/simpleMode/paymentScenarioProgram.js';
import { CountyChoropleth, DataAgeBadge, SourceCite } from './SimpleBlocks.jsx';
import { MethodInfo } from './MethodInfo.jsx';

const LAYERS = [
  { id: 'rural-population-share-census-2020', label: 'share of residents living in rural areas', unit: 'percent' },
  { id: 'pcp-per-100k-county', label: 'primary care doctors per 100,000 people', unit: 'ratio' },
  { id: 'pcp-per-100k-county', field: 'change', label: 'change in primary care doctors per 100,000 since 2012', unit: 'ratio' },
  { id: 'social-deprivation-index-county', label: 'social deprivation index (1–100, higher = more deprived)', unit: 'index' },
  { id: 'office-visit-paid-by-county', field: 'perResident', label: 'Medicaid office-visit dollars per resident', unit: 'usd' },
];

export function RuralPanel() {
  const area = useLazyArea('rural');
  const [layerKey, setLayerKey] = useState('0');
  const [selected, setSelected] = useState(null);
  if (!area) return <p className="sm-note" role="status">Loading rural access figures…</p>;
  const m = (id) => area.get(id);
  const layer = LAYERS[Number(layerKey)];
  const lm = m(layer.id);
  const rows = (lm?.rows || []).filter((r) => r.fips).map((r) => ({ fips: r.fips, label: COUNTY_NAME.get(r.fips) || r.label, value: layer.field ? r[layer.field] : r.value }));
  const rural = m('rural-population-share-census-2020');
  const nonmetro = m('nonmetro-population-share');
  const pcpShare = m('pcp-share-rural-counties');
  const pcp = m('pcp-per-100k-county');
  const hpsa = m('hpsa-primary-care-by-designation-type');
  const ambulance = m('ambulance-desert-counties-share');
  const rhtp = m('rhtp-award-fy2026');
  const rhtpInit = m('rhtp-initiatives');
  const declined = (pcp?.rows || []).filter((r) => r.change < 0).length;
  const pcpRural = pcpShare?.rows.find((r) => r.key === 'nonmetro');
  const pcpUrban = pcpShare?.rows.find((r) => r.key !== 'nonmetro');
  return (
    <div className="sm-rural" data-rural>
      <dl className="sm-rural-facts">
        {rural ? <div><dt>Kentuckians living in rural areas</dt><dd>{formatNumber(rural.value, 'percent')}<small>{nonmetro ? `${formatNumber(nonmetro.value, 'percent')} live in the 81 nonmetro counties` : ''}</small><MethodInfo measure={rural} /></dd></div> : null}
        {pcpShare ? <div><dt>Primary care doctors practicing in rural counties</dt><dd>{formatNumber(pcpShare.value, 'percent')}<small>{pcpRural && pcpUrban ? `${formatNumber(pcpRural.value, 'ratio')} per 100,000 people in rural counties vs ${formatNumber(pcpUrban.value, 'ratio')} in metro counties` : ''}</small><MethodInfo measure={pcpShare} /></dd></div> : null}
        {pcp ? <div><dt>Counties with fewer primary care doctors per person than in 2012</dt><dd>{declined} of 120<MethodInfo measure={pcp} /></dd></div> : null}
        {ambulance ? <div><dt>Counties reported as ambulance deserts</dt><dd>{formatNumber(ambulance.value, 'percent')}<small>{ambulance.comparability || ''}</small><MethodInfo measure={ambulance} /></dd></div> : null}
        {rhtp ? <div><dt>Rural Health Transformation award, FFY 2026</dt><dd>{formatNumber(rhtp.value, 'usd', { compact: true })}<small>{rhtp.rows?.find((r) => r.key === 'Kentucky')?.rank ? `${rhtp.rows.find((r) => r.key === 'Kentucky').rank}th largest of 50 states` : ''}</small><MethodInfo measure={rhtp} /></dd></div> : null}
      </dl>
      {hpsa ? (
        <div className="sm-table-wrap">
          <table className="sm-table" aria-label={hpsa.label}>
            <caption className="sm-note">Primary care shortage designations by type. “107 of 120” and “112 of 120” count different designation types.</caption>
            <thead><tr><th scope="col">Designation</th><th scope="col" className="is-num">Counties</th></tr></thead>
            <tbody>{hpsa.rows.map((r) => <tr key={r.key}><th scope="row">{r.label}</th><td className="is-num">{r.value}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
      <div className="sm-map-layout">
        <div>
          <label className="sm-mco-sort"><span>Shade counties by</span>
            <select value={layerKey} onChange={(e) => setLayerKey(e.target.value)}>{LAYERS.map((l, i) => (m(l.id) ? <option key={`${l.id}-${i}`} value={String(i)}>{l.label}</option> : null))}</select>
          </label>
          <CountyChoropleth rows={rows} unit={layer.unit} legendLabel={layer.label} selectedFips={selected} onSelectCounty={setSelected} />
          {lm ? <p className="sm-note"><MethodInfo measure={lm} /> <DataAgeBadge measure={lm} short /></p> : null}
          {lm ? <SourceCite source={lm.source} period={lm.period} /> : null}
        </div>
        <aside className="sm-county-panel" aria-live="polite">
          {rhtpInit ? (
            <>
              <h3>Kentucky’s rural transformation initiatives</h3>
              <ul className="sm-rhtp">{rhtpInit.rows.map((r) => <li key={r.key}><strong>{r.label}</strong>{r.goal ? <span>{r.goal}</span> : null}</li>)}</ul>
              <p className="sm-note">Budgets and counties by initiative are not public yet.</p>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

const SCENARIO_POOLS = [
  { id: 'office-visit-paid-by-county', label: 'Medicaid office-visit payments (CY 2023)' },
];
const SCENARIO_INDEXES = [
  { id: 'social-deprivation-index-county', label: 'Social Deprivation Index' },
];

export function DeprivationScenario() {
  const area = useLazyArea('rural');
  const [share, setShare] = useState(5);
  const [index] = useState(SCENARIO_INDEXES[0].id);
  const pool = area?.get(SCENARIO_POOLS[0].id);
  const idx = area?.get(index);
  const gap = area?.get('rural-urban-office-visit-payment-gap');
  const scenario = useMemo(() => {
    if (!pool || !idx) return null;
    const s = new PaymentRedistributionScenario();
    s.CountyPayments = pool.rows.filter((r) => r.fips).map((r) => ({ fips: r.fips, paid: r.value, metro: r.metro === true }));
    s.CountyIndex = idx.rows.filter((r) => r.fips).map((r) => ({ fips: r.fips, index: r.value }));
    s.RedirectSharePct = share;
    s.ModelPaymentRedistribution();
    return s;
  }, [pool, idx, share]);
  if (!area) return <p className="sm-note" role="status">Loading the payment scenario…</p>;
  if (!scenario) return null;
  const outcomes = [...scenario.CountyOutcomes].sort((a, b) => b.changePct - a.changePct);
  const mapRows = scenario.CountyOutcomes.map((o) => ({ fips: o.fips, label: COUNTY_NAME.get(o.fips), value: Math.round(o.changePct * 10) / 10 }));
  const gapBefore = gap?.value;
  const gapAfter = Number.isFinite(gapBefore) ? ((1 + gapBefore / 100) * (1 + scenario.NonmetroPaymentChangePct / 100) / (1 + scenario.MetroPaymentChangePct / 100) - 1) * 100 : null;
  return (
    <div className="sm-scenario" data-scenario>
      <p className="sm-note">
        An illustration, not a forecast. Each county gives up the share you choose of its Medicaid office-visit payments (calendar year 2023); the total is returned to counties in proportion to their payments times their deprivation score.
        Visits are held constant. The real pool is larger: most physician payments flow through managed care plans.
      </p>
      <label className="sm-scenario-slider">
        <span>Share of the pool redirected by deprivation: <strong>{share}%</strong></span>
        <input type="range" min="0" max={REDIRECT_SHARE_MAX_PCT} step="1" value={share} onChange={(e) => setShare(Number(e.target.value))} aria-label="Share of the pool redirected" />
      </label>
      <dl className="sm-rural-facts">
        <div><dt>Amount redirected</dt><dd>{formatNumber(scenario.RedirectedTotal, 'usd', { compact: true })}<small>of {formatNumber(scenario.PoolTotal, 'usd', { compact: true })}</small></dd></div>
        <div><dt>Rural (nonmetro) counties’ share of the pool</dt><dd>{formatNumber(scenario.NonmetroShareBefore, 'percent')} → {formatNumber(scenario.NonmetroShareAfter, 'percent')}</dd></div>
        <div><dt>Payment change, rural counties</dt><dd>{scenario.NonmetroPaymentChangePct >= 0 ? '+' : ''}{formatNumber(scenario.NonmetroPaymentChangePct, 'percent')}</dd></div>
        <div><dt>Payment change, metro counties</dt><dd>{scenario.MetroPaymentChangePct >= 0 ? '+' : ''}{formatNumber(scenario.MetroPaymentChangePct, 'percent')}</dd></div>
        {Number.isFinite(gapAfter) ? <div><dt>Rural vs metro payment per office visit</dt><dd>{formatNumber(gapBefore, 'percent')} → {formatNumber(gapAfter, 'percent')}<MethodInfo measure={gap} /></dd></div> : null}
      </dl>
      <div className="sm-map-layout">
        <div>
          <CountyChoropleth rows={mapRows} unit="percent" legendLabel="change in payments under the scenario (%)" />
          <p className="sm-note"><MethodInfo measure={pool} /> <MethodInfo measure={idx} /> <DataAgeBadge measure={pool} short /></p>
        </div>
        <aside className="sm-county-panel">
          <h3>Largest increases</h3>
          <ol className="sm-county-list">{outcomes.slice(0, 5).map((o) => <li key={o.fips}>{COUNTY_NAME.get(o.fips)}<span>+{formatNumber(o.changePct, 'percent')} ({formatNumber(o.change, 'usd', { compact: true })})</span></li>)}</ol>
          <h3>Largest decreases</h3>
          <ol className="sm-county-list">{outcomes.slice(-5).reverse().map((o) => <li key={o.fips}>{COUNTY_NAME.get(o.fips)}<span>{formatNumber(o.changePct, 'percent')} ({formatNumber(o.change, 'usd', { compact: true })})</span></li>)}</ol>
        </aside>
      </div>
      <p className="sm-note">The Area Deprivation Index requires an account with its publisher and is not used; the Social Deprivation Index (Robert Graham Center) stands in. Payments are placed by the billing practice’s county.</p>
      <SourceCite source={pool.source} period={pool.period} />
    </div>
  );
}
