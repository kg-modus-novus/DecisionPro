// CodeXen: v1 not-applicable
// Local views from the 2026-10-28 subcommittee requests:
//   #1  zip-code map with multi-select ("these three zip codes"), Allison Adams
//   #8  health measures for the selected place, Rep. Moser
//   #23 social vulnerability overlay and comparison, Allison Adams
// Presentation only. Zip figures are survey or model estimates and say so;
// each names the non-public data that would replace it (methodology and
// enrichment, RESEARCH_BRIEF_2026-10-28.md). Small counts go through CountDisclosure.
import { useEffect, useMemo, useState } from 'react';
import { KY_COUNTY_SHAPES } from '../../data/alp/kyCountyShapes.js';
import { formatNumber } from '../../lib/simpleMode/measureModel.js';
import { maybeMeasure } from '../../lib/simpleMode/sourcedData.js';
import { useLazyArea } from '../../lib/simpleMode/lazyAreas.js';
import { CountDisclosure } from '../../lib/simpleMode/countDisclosureProgram.js';
import { bandIndexFor, quantileBands } from '../../lib/simpleMode/simpleModeData.js';
import { COUNTY_NAME, COUNTY_OPTIONS, geographyLabel } from '../../lib/simpleMode/geography.js';
import { areaUnits, byVulnerabilityQuartile, countiesForZips, summedCount, weightedPercent } from '../../lib/simpleMode/localArea.js';
import { BAND_COLORS } from '../KyCountyHeatMap.jsx';
import { CountyChoropleth, DataAgeBadge, EstimatePill, SourceCite } from './SimpleBlocks.jsx';
import { MethodInfo } from './MethodInfo.jsx';

function useZctaShapes() {
  const [shapes, setShapes] = useState(null);
  useEffect(() => {
    let live = true;
    import('../../data/alp/kyZctaShapes.js').then((m) => { if (live) setShapes(m.KY_ZCTA_SHAPES); });
    return () => { live = false; };
  }, []);
  return shapes;
}

const sviText = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)}th percentile` : '—');
const show = (m, v) => (m?.unit === 'index' ? sviText(v) : formatNumber(v, m?.unit));

// ---- #1 Zip-code map --------------------------------------------------------------

const ZIP_LAYERS = [
  { id: 'zcta-medicaid-members-est', label: 'Medicaid members (estimate)' },
  { id: 'acs-zcta-medicaid-pct', label: 'Residents with Medicaid (Census survey)' },
  { id: 'acs-zcta-uninsured-pct', label: 'Residents without insurance (Census survey)' },
  { id: 'svi-zcta-overall', label: 'Social vulnerability (CDC SVI)' },
  { id: 'svi-zcta-socioeconomic', label: 'Social vulnerability: socioeconomic' },
  { id: 'svi-zcta-housing-transport', label: 'Social vulnerability: housing and transportation' },
  { id: 'places-zcta-checkup', label: 'Adults with a checkup in the past year (CDC estimate)' },
  { id: 'places-zcta-diabetes', label: 'Adults with diabetes (CDC estimate)' },
  { id: 'places-zcta-high-blood-pressure', label: 'Adults with high blood pressure (CDC estimate)' },
  { id: 'places-zcta-depression', label: 'Adults with depression (CDC estimate)' },
];

function boundsOf(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
  }
  return { minX, minY, maxX, maxY };
}

function viewBoxFor(fips) {
  const shape = KY_COUNTY_SHAPES.counties.find((c) => c.fips === fips);
  if (!shape) return KY_COUNTY_SHAPES.viewBox;
  const b = boundsOf(shape.d);
  const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.08;
  return `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
}

function disclosedZipCounts(rows) {
  const d = new CountDisclosure();
  d.CountRows = rows.map((r) => ({ key: r.key, count: r.count }));
  d.GroupTotalIsShown = true;
  d.DiscloseAggregateCounts();
  return { rows: new Map(d.DisclosedRows.map((r) => [r.key, r])), totalWithheld: d.GroupTotalIsWithheld };
}

export function ZipMapSection({ filters }) {
  const local = useLazyArea('local');
  const shapes = useZctaShapes();
  const [layerId, setLayerId] = useState(ZIP_LAYERS[0].id);
  const [zoom, setZoom] = useState(filters.geo?.kind === 'county' ? filters.geo.key : '');
  const [selected, setSelected] = useState(() => (filters.geo?.kind === 'zips' ? filters.geo.keys : []));
  const [search, setSearch] = useState('');
  const layer = local?.get(layerId);
  const bands = useMemo(() => quantileBands((layer?.rows || []).map((r) => r.value)), [layer]);
  if (!local || !shapes) return <p className="sm-note" role="status">Loading zip-code data…</p>;
  const byZip = new Map((layer?.rows || []).map((r) => [r.key, r]));
  const toggle = (zip) => setSelected((s) => (s.includes(zip) ? s.filter((z) => z !== zip) : [...s, zip]));
  const addSearch = (e) => {
    e.preventDefault();
    const zip = search.trim();
    if (shapes.zctas[zip] && !selected.includes(zip)) setSelected([...selected, zip]);
    setSearch('');
  };
  return (
    <section className="sm-section" aria-labelledby="sm-zip-title" data-zip-map>
      <div className="sm-section-head">
        <h2 id="sm-zip-title">Zip codes</h2>
        <p className="sm-note">Click zip codes on the map, or type one, to build an area. Zoom to a county to see city zip codes.</p>
      </div>
      <div className="sm-zip-controls">
        <label className="sm-mco-sort"><span>Shade by</span>
          <select value={layerId} onChange={(e) => setLayerId(e.target.value)}>
            {ZIP_LAYERS.filter((l) => local.get(l.id)).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <label className="sm-mco-sort"><span>Zoom to</span>
          <select value={zoom} onChange={(e) => setZoom(e.target.value)}>
            <option value="">All of Kentucky</option>
            {COUNTY_OPTIONS.map((c) => <option key={c.fips} value={c.fips}>{c.name} County</option>)}
          </select>
        </label>
        <form className="sm-zip-search" onSubmit={addSearch}>
          <input aria-label="Add a zip code" inputMode="numeric" maxLength={5} placeholder="Add zip, e.g. 40203" value={search} onChange={(e) => setSearch(e.target.value.replace(/\D/g, ''))} />
          <button type="submit" className="sm-chip">Add</button>
        </form>
      </div>
      <div className="sm-map-layout">
        <figure className="sm-map">
          <svg viewBox={zoom ? viewBoxFor(zoom) : shapes.viewBox} className="sm-map-svg sm-zip-svg" role="group" aria-label={`Kentucky zip codes shaded by ${layer?.label || ''}`}>
            {Object.entries(shapes.zctas).map(([zip, shape]) => {
              const row = byZip.get(zip);
              const band = bandIndexFor(row?.value, bands);
              const isSelected = selected.includes(zip);
              return (
                <path
                  key={zip}
                  d={shape.d}
                  data-zcta={zip}
                  className={`sm-zip${isSelected ? ' is-selected' : ''}`}
                  fill={band == null ? '#3a4656' : BAND_COLORS[band]}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`ZIP ${zip}: ${row ? show(layer, row.value) : 'no figure'}`}
                  onClick={() => toggle(zip)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(zip); } }}
                >
                  <title>{`ZIP ${zip}: ${row ? show(layer, row.value) : 'no figure'}`}</title>
                </path>
              );
            })}
            {KY_COUNTY_SHAPES.counties.map((c) => <path key={c.fips} d={c.d} className="sm-zip-county-line" aria-hidden="true" />)}
          </svg>
          <figcaption className="sm-map-legend">
            <span>{layer?.label}</span>
            <ol>{bands.map((b) => <li key={b.index}><i style={{ background: BAND_COLORS[b.index] }} aria-hidden="true" />{show(layer, b.min)}–{show(layer, b.max)}</li>)}</ol>
          </figcaption>
          {layer ? <p className="sm-note">{layer.method === 'estimate' ? <EstimatePill note={layer.methodNote} /> : null} <MethodInfo measure={layer} /> <DataAgeBadge measure={layer} short /></p> : null}
          {layer ? <SourceCite source={layer.source} period={layer.period} /> : null}
        </figure>
        <ZipSelectionPanel local={local} selected={selected} setSelected={setSelected} filters={filters} />
      </div>
    </section>
  );
}

function ZipSelectionPanel({ local, selected, setSelected, filters }) {
  if (!selected.length) {
    return (
      <aside className="sm-county-panel" aria-live="polite">
        <h3>No zip codes selected</h3>
        <p className="sm-note">Select one or more zip codes to add up their figures.</p>
      </aside>
    );
  }
  const members = local.get('zcta-medicaid-members-est');
  const units = selected.map((key) => ({ level: 'zcta', key, share: 1 }));
  const memberRows = selected.map((key) => ({ key, count: members?.rows.find((r) => r.key === key)?.value }));
  const disclosed = disclosedZipCounts(memberRows);
  const total = summedCount(members, units);
  const residents = summedCount(local.get('acs-zcta-population'), units);
  const acsPop = (row) => local.get('acs-zcta-population')?.rows.find((r) => r.key === row.key)?.value;
  const medicaidPct = weightedPercent(local.get('acs-zcta-medicaid-pct'), units, acsPop);
  const uninsuredPct = weightedPercent(local.get('acs-zcta-uninsured-pct'), units, acsPop);
  const svi = weightedPercent(local.get('svi-zcta-overall'), units, acsPop);
  const crosswalk = local.get('zcta-county-crosswalk');
  const counties = countiesForZips(crosswalk, selected);
  const useArea = () => filters.setGeo({ kind: 'zips', keys: [...selected], counties });
  return (
    <aside className="sm-county-panel" aria-live="polite" data-zip-selection>
      <h3>{geographyLabel({ kind: 'zips', keys: selected })}</h3>
      <dl>
        <div><dt>Medicaid members</dt><dd>{disclosed.totalWithheld ? 'Withheld' : formatNumber(total?.value, 'count')} <EstimatePill small note={members?.methodology || members?.methodNote} /></dd></div>
        <div><dt>Residents</dt><dd>{formatNumber(residents?.value, 'count')}{residents?.moe ? <small> ±{formatNumber(residents.moe, 'count')}</small> : null}</dd></div>
        <div><dt>Residents with Medicaid (survey)</dt><dd>{formatNumber(medicaidPct?.value, 'percent')}</dd></div>
        <div><dt>Without insurance (survey)</dt><dd>{formatNumber(uninsuredPct?.value, 'percent')}</dd></div>
        <div><dt>Social vulnerability</dt><dd>{sviText(svi?.value)}</dd></div>
        <div><dt>Counties</dt><dd>{counties.map((f) => COUNTY_NAME.get(f) || f).join(', ')}</dd></div>
      </dl>
      <table className="sm-table sm-zip-table" aria-label="Selected zip codes">
        <thead><tr><th scope="col">ZIP</th><th scope="col" className="is-num">Members (est.)</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
        <tbody>
          {selected.map((zip) => (
            <tr key={zip}>
              <th scope="row">{zip}</th>
              <td className="is-num">{disclosed.rows.get(zip)?.display ?? '—'}</td>
              <td><button type="button" className="sm-tool" aria-label={`Remove ${zip}`} onClick={() => setSelected(selected.filter((z) => z !== zip))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sm-note">Member counts of 1 to 10 are never shown. Several zip codes combined, survey shares and vulnerability are population-weighted.</p>
      <div className="sm-facts-links">
        <button type="button" className="sm-chip" onClick={useArea}>Use these zip codes as my area</button>
        <button type="button" className="sm-link" onClick={() => setSelected([])}>Clear</button>
      </div>
    </aside>
  );
}

// ---- #8 Health measures for the selected place -----------------------------------------

const LOCAL_OUTCOMES = [
  { key: 'mammography', label: 'Mammogram in the past two years (women 50–74)', krs: '(b)', medicaid: 'cs-bcs-breast-screening-ffy2024' },
  { key: 'colorectal-screening', label: 'Up to date on colorectal cancer screening (45–75)', krs: '(b)', medicaid: 'cs-col-colorectal-ffy2024' },
  { key: 'checkup', label: 'Routine checkup in the past year', krs: null, medicaid: null },
  { key: 'diabetes', label: 'Adults with diagnosed diabetes', krs: '(e)', medicaid: 'cs-hbd-a1c-controlled-ffy2024', context: true },
  { key: 'high-blood-pressure', label: 'Adults with high blood pressure', krs: '(f)', medicaid: 'cs-cbp-blood-pressure-control', context: true },
  { key: 'bp-medicine', label: 'Taking medicine for high blood pressure', krs: '(f)', medicaid: 'cs-cbp-blood-pressure-control', context: true },
  { key: 'mental-distress', label: 'Frequent mental distress', krs: null, medicaid: null },
  { key: 'depression', label: 'Adults ever told they have depression', krs: null, medicaid: null },
];

export function LocalOutcomes({ filters }) {
  const local = useLazyArea('local');
  if (!local) return <p className="sm-note" role="status">Loading local health estimates…</p>;
  const geo = filters?.geo;
  const units = areaUnits(geo);
  const level = geo?.kind === 'zips' ? 'zcta' : 'county';
  const place = geo ? geographyLabel(geo) : 'Kentucky';
  return (
    <div className="sm-local-outcomes" data-local-outcomes>
      <p className="sm-note">
        {geo ? <>Estimates for <strong>{place}</strong>. </> : <>Choose a county, district or zip codes above to see estimates for that place. </>}
        These are CDC model estimates for <strong>all adults living there</strong>, not only Medicaid members. Kentucky does not publish its Medicaid measures for places smaller than the state.
      </p>
      <div className="sm-table-wrap">
        <table className="sm-table" aria-label={`Health estimates for ${place}`}>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              {geo ? <th scope="col" className="is-num">{place}<small>all adults, CDC estimate</small></th> : null}
              <th scope="col" className="is-num">Kentucky<small>all adults, CDC estimate</small></th>
              <th scope="col" className="is-num">Kentucky Medicaid<small>members, statewide</small></th>
              <th scope="col"><span className="sr-only">Method</span></th>
            </tr>
          </thead>
          <tbody>
            {LOCAL_OUTCOMES.map((o) => {
              const m = local.get(`places-${level}-${o.key}`);
              const state = local.get(`places-county-${o.key}`);
              if (!m || !state) return null;
              const here = geo ? weightedPercent(m, units) : null;
              const medicaid = o.medicaid ? maybeMeasure(o.medicaid) : null;
              return (
                <tr key={o.key} data-local-measure={o.key}>
                  <th scope="row">{o.krs ? <span className="sm-statute-tag">KRS 7A.287 {o.krs}</span> : null}{o.label}</th>
                  {geo ? (
                    <td className="is-num">
                      {here ? formatNumber(here.value, 'percent') : '—'}
                      {here && Number.isFinite(here.ciLow) ? <small>{formatNumber(here.ciLow, 'percent')}–{formatNumber(here.ciHigh, 'percent')}</small> : null}
                      {here?.combined ? <small>{here.areasFound === 1 ? 'estimated for part of a county' : `combined from ${here.areasFound} areas`}</small> : null}
                    </td>
                  ) : null}
                  <td className="is-num">{formatNumber(state.value, 'percent')}</td>
                  <td className="is-num">
                    {medicaid ? <>{formatNumber(medicaid.value, medicaid.unit)}<small>{o.context ? 'related: ' : ''}{medicaid.label}</small></> : '—'}
                  </td>
                  <td><MethodInfo measure={m} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sm-note">Diabetes and blood pressure rows show how common the condition is locally beside the related Medicaid care measure; they are not the same measure. <DataAgeBadge measure={local.get('places-county-diabetes')} short /></p>
      <SourceCite source={local.get('places-county-mammography')?.source} />
    </div>
  );
}

// ---- #23 Social vulnerability comparison ----------------------------------------------

const SVI_COMPARE = [
  { id: 'pcp-per-10k-county', label: 'Primary care doctors per 10,000 people' },
  { id: 'members-per-medicaid-pcp-county-est', label: 'Members per Medicaid primary care doctor (estimate)' },
  { id: 'drive-time-health-center-county-est', label: 'Drive to nearest health center (hours, estimate)' },
  { id: 'drive-time-otp-county-est', label: 'Drive to nearest methadone clinic (hours, estimate)' },
  { id: 'preventable-hospital-stays-county', label: 'Preventable hospital stays' },
  { id: 'county-members', label: 'Medicaid members as a share of residents', value: (r) => r.pctOfPop2020 },
];

const INDEXES = [
  { id: 'svi-county-overall', label: 'Social vulnerability (CDC SVI): overall', area: 'local' },
  { id: 'svi-county-socioeconomic', label: 'SVI: socioeconomic', area: 'local' },
  { id: 'svi-county-household', label: 'SVI: household characteristics', area: 'local' },
  { id: 'svi-county-minority', label: 'SVI: racial and ethnic minority status', area: 'local' },
  { id: 'svi-county-housing-transport', label: 'SVI: housing and transportation', area: 'local' },
  { id: 'social-deprivation-index-county', label: 'Social Deprivation Index (Robert Graham Center)', area: 'rural' },
];

// Outlines drawn over the shaded map, so vulnerability can be read against another layer.
const OUTLINES = [
  { id: 'none', label: 'No outline' },
  { id: 'hpsa-geographic', label: 'Primary care shortage for all residents (whole county)' },
  { id: 'hpsa-any', label: 'Any whole-county primary care shortage' },
  { id: 'rural', label: 'Rural (nonmetro) counties' },
  { id: 'measure-top', label: 'Worst quarter of the chosen measure' },
];

const SDI_ID = 'social-deprivation-index-county';
const indexText = (id, v) => (id === SDI_ID ? (Number.isFinite(v) ? `score ${v} of 100` : '—') : sviText(v));
const indexShare = (id, v) => (id === SDI_ID ? v / 100 : v);

export function VulnerabilityComparison() {
  const local = useLazyArea('local');
  const rural = useLazyArea('rural');
  const [id, setId] = useState(SVI_COMPARE[0].id);
  const [theme, setTheme] = useState('svi-county-overall');
  const [outline, setOutline] = useState('hpsa-geographic');
  if (!local || !rural) return <p className="sm-note" role="status">Loading social vulnerability…</p>;
  const option = SVI_COMPARE.find((o) => o.id === id) || SVI_COMPARE[0];
  const m = maybeMeasure(option.id);
  const indexDef = INDEXES.find((x) => x.id === theme) || INDEXES[0];
  const svi = (indexDef.area === 'rural' ? rural : local).get(theme);
  if (!m || !svi) return null;
  const valueOf = option.value || ((r) => r.value);
  const groups = byVulnerabilityQuartile(m, svi, valueOf);
  const sviBy = new Map(svi.rows.map((r) => [r.fips || r.key, r.value]));
  const points = m.rows.filter((r) => r.fips && Number.isFinite(valueOf(r)) && Number.isFinite(sviBy.get(r.fips)));
  const maxY = Math.max(...points.map(valueOf));
  const unit = option.value ? 'percent' : m.unit;
  const outlineDef = OUTLINES.find((o) => o.id === outline) || OUTLINES[0];
  const outlineFips = outlineCounties(outline, rural, m, valueOf);
  const mapRows = svi.rows.filter((r) => r.fips).map((r) => ({ fips: r.fips, label: COUNTY_NAME.get(r.fips) || r.label, value: r.value, display: indexText(theme, r.value) }));
  const disagree = indexDisagreement(local.get('svi-county-overall'), rural.get(SDI_ID));
  return (
    <div className="sm-svi-compare" data-svi-compare>
      <div className="sm-zip-controls">
        <label className="sm-mco-sort"><span>Measure</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {SVI_COMPARE.filter((o) => maybeMeasure(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="sm-mco-sort"><span>Vulnerability index</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} data-svi-index>
            {INDEXES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <label className="sm-mco-sort"><span>Outline</span>
          <select value={outline} onChange={(e) => setOutline(e.target.value)} data-svi-outline>
            {OUTLINES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div className="sm-map-layout" data-svi-overlay>
        <div>
          <CountyChoropleth rows={mapRows} unit="index" legendLabel={indexDef.label} outlineFips={outlineFips} outlineLabel={outlineDef.label} />
          <p className="sm-note">Shading: {indexDef.label} (lighter = more vulnerable). Outline: {outlineDef.label.toLowerCase()}{outline === 'measure-top' ? ` (${option.label.toLowerCase()})` : ''}.</p>
        </div>
        <div className="sm-table-wrap">
          <table className="sm-table" aria-label="Measure by vulnerability quarter of counties">
            <thead><tr><th scope="col">Counties by vulnerability</th><th scope="col" className="is-num">Counties</th><th scope="col" className="is-num">Average</th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.quartile} data-svi-quartile={g.quartile}>
                  <th scope="row">{['Least vulnerable quarter', 'Second quarter', 'Third quarter', 'Most vulnerable quarter'][g.quartile - 1]}</th>
                  <td className="is-num">{g.counties}</td>
                  <td className="is-num">{formatNumber(g.mean, unit === 'hours' ? 'hours' : unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sm-note">Simple average of the counties in each quarter, ranked against other Kentucky counties. {groups.reduce((a, g) => a + g.counties, 0)} of 120 counties have a figure for this measure; the rest are left out.</p>
          <figure className="sm-scatter">
            <svg viewBox="0 0 320 200" role="img" aria-label={`${option.label} against ${indexDef.label}, one dot per county`}>
              <line x1="30" y1="180" x2="315" y2="180" className="sm-axis" />
              <line x1="30" y1="5" x2="30" y2="180" className="sm-axis" />
              {points.map((r) => (
                <circle key={r.fips} cx={30 + indexShare(theme, sviBy.get(r.fips)) * 285} cy={180 - (maxY ? (valueOf(r) / maxY) * 170 : 0)} r="2.6" className="sm-dot">
                  <title>{`${COUNTY_NAME.get(r.fips) || r.label}: ${formatNumber(valueOf(r), unit)}, ${indexText(theme, sviBy.get(r.fips))}`}</title>
                </circle>
              ))}
              <text x="172" y="197" className="sm-axis-label" textAnchor="middle">Less vulnerable → more vulnerable</text>
            </svg>
          </figure>
        </div>
      </div>
      {disagree ? (
        <details className="sm-dq" data-svi-sdi>
          <summary>Where the CDC SVI and the Social Deprivation Index disagree</summary>
          <p className="sm-note">The two indexes rank Kentucky counties alike overall (rank correlation {disagree.rho.toFixed(2)}). These {disagree.rows.length} counties sit two or more quarters apart on them. The SVI weighs household makeup, minority status, housing and transportation; the SDI weighs poverty, education, employment, crowding, single-parent homes and car access.</p>
          <div className="sm-table-wrap">
            <table className="sm-table" aria-label="Counties ranked differently by the two indexes">
              <thead><tr><th scope="col">County</th><th scope="col" className="is-num">SVI quarter</th><th scope="col" className="is-num">SDI quarter</th></tr></thead>
              <tbody>{disagree.rows.map((r) => <tr key={r.fips}><th scope="row">{COUNTY_NAME.get(r.fips)}</th><td className="is-num">{r.svi}</td><td className="is-num">{r.sdi}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="sm-note">Quarter 1 = least vulnerable or deprived, 4 = most. The Area Deprivation Index needs an account with its publisher and is not used.</p>
        </details>
      ) : null}
      <p className="sm-note"><MethodInfo measure={svi} /> <DataAgeBadge measure={svi} short /></p>
      <SourceCite source={svi.source} period={svi.period} />
    </div>
  );
}

function outlineCounties(kind, rural, measure, valueOf) {
  if (kind === 'none') return null;
  if (kind === 'hpsa-geographic' || kind === 'hpsa-any') {
    const rows = rural.get('hpsa-primary-care-county-detail')?.rows || [];
    return rows.filter((r) => (kind === 'hpsa-geographic' ? r.category === 'whole-geographic' : String(r.category).startsWith('whole-'))).map((r) => r.fips);
  }
  if (kind === 'rural') return (rural.get('rucc-2023-county')?.rows || []).filter((r) => r.metro === false).map((r) => r.fips);
  const rows = (measure.rows || []).filter((r) => r.fips && Number.isFinite(valueOf(r)));
  const worseIsHigh = measure.betterDirection !== 'higher';
  const sorted = [...rows].sort((a, b) => (worseIsHigh ? valueOf(b) - valueOf(a) : valueOf(a) - valueOf(b)));
  return sorted.slice(0, Math.ceil(sorted.length / 4)).map((r) => r.fips);
}

function indexDisagreement(svi, sdi) {
  if (!svi || !sdi) return null;
  const quarterOf = (m) => {
    const rows = m.rows.filter((r) => r.fips && Number.isFinite(r.value)).sort((a, b) => a.value - b.value || a.fips.localeCompare(b.fips));
    return new Map(rows.map((r, i) => [r.fips, { rank: i + 1, q: Math.min(4, Math.floor((i * 4) / rows.length) + 1) }]));
  };
  const a = quarterOf(svi);
  const b = quarterOf(sdi);
  const both = [...a.keys()].filter((f) => b.has(f));
  const n = both.length;
  if (n < 10) return null;
  const d2 = both.reduce((sum, f) => sum + (a.get(f).rank - b.get(f).rank) ** 2, 0);
  const rho = 1 - (6 * d2) / (n * (n * n - 1));
  const rows = both
    .filter((f) => Math.abs(a.get(f).q - b.get(f).q) >= 2)
    .map((f) => ({ fips: f, svi: a.get(f).q, sdi: b.get(f).q }))
    .sort((x, y) => (COUNTY_NAME.get(x.fips) || '').localeCompare(COUNTY_NAME.get(y.fips) || ''));
  return { rho, rows };
}
