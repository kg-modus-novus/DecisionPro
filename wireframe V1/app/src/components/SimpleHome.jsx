import { useEffect, useMemo, useState } from 'react';
import { SmartTileVisual } from '../lib/smartTileVisuals.jsx';
import { formatMeasureValue, formatNumber, sourceLabel, visualFor } from '../lib/simpleMode/measureModel.js';
import { MEASURES, maybeMeasure, measure as getMeasure } from '../lib/simpleMode/sourcedData.js';
import { PAGES, POPULATIONS, QUESTIONS, SIMPLE_TABS, SIMPLE_VIEWS } from '../lib/simpleMode/simpleAreas.js';
import { DEFAULT_TILE_IDS, TILE_CATALOG, localTileReading } from '../lib/simpleMode/simpleTiles.js';
import { planKey } from '../lib/simpleMode/planScorecard.js';
import { MCO_ROWS, MCPAR_SOURCE } from '../lib/simpleMode/simpleModeData.js';
import { SIMPLE_BRIEFINGS } from '../lib/simpleMode/simpleBriefings.js';
import {
  ADDS,
  COUNTY_NAME,
  COUNTY_OPTIONS,
  HOUSE_DISTRICTS,
  SENATE_DISTRICTS,
  countyFacts,
  districtRow,
  geographyCounties,
  geographyLabel,
  populationCount,
} from '../lib/simpleMode/geography.js';
import {
  PINNED_LIMIT,
  addTile,
  moveTileTo,
  nudgeTile,
  orderedTileIds,
  readLayout,
  removeTile,
  storeLayout,
  togglePin,
} from '../lib/simpleMode/tileLayout.js';
import { CountyChoropleth, MeasureCard, MeasureTable, SectionHead, SourceCite } from './simple/SimpleBlocks.jsx';
import { PlanScorecard, SanctionsTable, WaiverTable } from './simple/SimpleWidgets.jsx';

export { SIMPLE_TABS, SIMPLE_VIEWS };

export function SimplePage({ view = 'simple-home', onNavigate, onBrowseSources, focusFips = null, anchor = null }) {
  const [population, setPopulation] = useState('all');
  const [geo, setGeo] = useState(focusFips ? { kind: 'county', key: focusFips } : null);
  const go = (target, opts) => onNavigate?.(target, opts);

  useEffect(() => {
    if (focusFips) setGeo({ kind: 'county', key: focusFips });
  }, [focusFips]);

  useEffect(() => {
    if (!anchor) return;
    // Navigation scrolls the content pane to the top on the next frame; scroll after it.
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-measure-id="${anchor}"], #${CSS.escape(anchor)}`);
      el?.scrollIntoView?.({ block: 'start' });
    }, 120);
    return () => clearTimeout(timer);
  }, [anchor, view]);

  const filters = { population, setPopulation, geo, setGeo };
  return (
    <main className="main sm-home" aria-labelledby="sm-title">
      {view === 'simple-home' && <AtAGlancePage go={go} filters={filters} />}
      {PAGES[view] && <ConfiguredPage page={PAGES[view]} filters={filters} go={go} />}
      {view === 'simple-county' && <CountyPage filters={filters} />}
      {view === 'simple-district' && <DistrictPage filters={filters} />}
    </main>
  );
}

// Kept for callers and tests that render the landing page directly.
export function SimpleHome(props) {
  return <SimplePage {...props} view="simple-home" />;
}

export function PageHeader({ eyebrow, title, lede, children }) {
  return (
    <header className="sm-hero">
      <p className="sm-eyebrow">{eyebrow}</p>
      <h1 id="sm-title">{title}</h1>
      {lede ? <p className="sm-lede">{lede}</p> : null}
      {children}
    </header>
  );
}

// ---- Filter bar -------------------------------------------------------------

function geoValue(geo) {
  return geo ? `${geo.kind}:${geo.key}` : '';
}

export function FilterBar({ filters }) {
  const { population, setPopulation, geo, setGeo } = filters;
  return (
    <form className="sm-filters" aria-label="Filter by population and place" onSubmit={(e) => e.preventDefault()}>
      <label>
        <span>Who</span>
        <select value={population} onChange={(e) => setPopulation(e.target.value)}>
          {POPULATIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <label>
        <span>Where</span>
        <select
          value={geoValue(geo)}
          onChange={(e) => {
            const [kind, key] = e.target.value.split(':');
            setGeo(kind ? { kind, key } : null);
          }}
        >
          <option value="">All of Kentucky</option>
          <optgroup label="County">
            {COUNTY_OPTIONS.map((c) => <option key={c.fips} value={`county:${c.fips}`}>{c.name} County</option>)}
          </optgroup>
          <optgroup label="House district">
            {HOUSE_DISTRICTS.map((d) => <option key={d.key} value={`house:${d.key}`}>{d.label}{d.legislator ? ` (${d.legislator})` : ''}</option>)}
          </optgroup>
          <optgroup label="Senate district">
            {SENATE_DISTRICTS.map((d) => <option key={d.key} value={`senate:${d.key}`}>{d.label}{d.legislator ? ` (${d.legislator})` : ''}</option>)}
          </optgroup>
          <optgroup label="Area Development District">
            {ADDS.map((d) => <option key={d.key} value={`add:${d.key}`}>{d.label}</option>)}
          </optgroup>
        </select>
      </label>
      <PopulationSummary population={population} geo={geo} />
    </form>
  );
}

function PopulationSummary({ population, geo }) {
  const count = populationCount(geo, population);
  const pop = POPULATIONS.find((p) => p.id === population);
  if (!Number.isFinite(count?.value)) return null;
  return (
    <p className="sm-filter-summary" aria-live="polite">
      <strong>{count.value.toLocaleString('en-US')}</strong> {pop.id === 'all' ? 'Medicaid members' : pop.label.toLowerCase()} in {geographyLabel(geo)}
      {count.period ? `, ${count.period}` : ''}
      {count.estimate ? <span className="sm-estimate-chip">Estimate</span> : null}
    </p>
  );
}

/** Note shown on pages whose figures are statewide or all-member when a filter is set. */
function ScopeNote({ filters, splitIds = [] }) {
  const { population, geo } = filters;
  if (population === 'all' && !geo) return null;
  const parts = [];
  if (geo) parts.push(`${geographyLabel(geo)} is selected: county-level figures on this page are highlighted; the rest are statewide`);
  if (population !== 'all') parts.push(`figures not split by ${POPULATIONS.find((p) => p.id === population).label.toLowerCase()} cover all members`);
  return <p className="sm-scope-note">{parts.join('; ')}.{splitIds.length ? '' : ''}</p>;
}

// ---- At a glance ---------------------------------------------------------------

function AtAGlancePage({ go, filters }) {
  const catalogIds = TILE_CATALOG.map((t) => t.id);
  const [layout, setLayout] = useState(() => readLayout(catalogIds, DEFAULT_TILE_IDS));
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState(null);
  const update = (next) => setLayout(storeLayout(next));
  const tiles = useMemo(() => {
    const byId = new Map(TILE_CATALOG.map((t) => [t.id, t]));
    return orderedTileIds(layout).map((id) => byId.get(id)).filter(Boolean);
  }, [layout]);
  const hidden = TILE_CATALOG.filter((t) => !layout.shown.includes(t.id));

  return (
    <>
      <PageHeader
        eyebrow="Kentucky at a glance"
        title="Kentucky Medicaid in plain numbers"
        lede="Where the money goes, whether people can get care, whether their health is improving, and who is responsible. Every number names its public source and date."
      >
        <nav className="sm-topics" aria-label="Start with a question">
          {QUESTIONS.map((q) => (
            <button key={q.id} type="button" className="sm-chip" onClick={() => go(q.view)}>{q.text}</button>
          ))}
        </nav>
      </PageHeader>

      <FilterBar filters={filters} />

      <BriefingStrip go={go} />

      <div className="sm-glance-layout">
        <section className="sm-section" aria-labelledby="sm-headlines-title">
          <div className="sm-section-head">
            <h2 id="sm-headlines-title">Your dashboard</h2>
            <div className="sm-dash-actions">
              <p className="sm-note">Pin up to {PINNED_LIMIT} tiles to keep them first. Your layout is saved in this browser.</p>
              <button type="button" className="sm-chip" aria-pressed={editing} onClick={() => setEditing(!editing)}>
                {editing ? 'Done' : 'Customize'}
              </button>
            </div>
          </div>
          <ul className={`sm-tiles${editing ? ' is-editing' : ''}`}>
            {tiles.map((tile) => (
              <DashboardTile
                key={tile.id}
                tile={tile}
                filters={filters}
                pinned={layout.pinned.includes(tile.id)}
                pinDisabled={!layout.pinned.includes(tile.id) && layout.pinned.length >= PINNED_LIMIT}
                editing={editing}
                dragging={dragId === tile.id}
                onOpen={() => go(tile.view, { anchor: tile.anchor || tile.measureId })}
                onPin={() => update(togglePin(layout, tile.id))}
                onRemove={() => update(removeTile(layout, tile.id))}
                onNudge={(step) => update(nudgeTile(layout, tile.id, step))}
                onDragStart={() => setDragId(tile.id)}
                onDragEnd={() => setDragId(null)}
                onDropOn={() => { if (dragId) update(moveTileTo(layout, dragId, tile.id)); setDragId(null); }}
              />
            ))}
          </ul>
          {editing ? (
            <div className="sm-catalog" aria-label="Add tiles">
              <h3>Add a tile</h3>
              {hidden.length ? (
                <ul>
                  {hidden.map((t) => (
                    <li key={t.id}>
                      <button type="button" className="sm-chip" onClick={() => update(addTile(layout, t.id))}>
                        + {t.title}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="sm-note">Every tile is on your dashboard.</p>}
              <button type="button" className="sm-link" onClick={() => update({ shown: [...DEFAULT_TILE_IDS], pinned: [] })}>Reset to the standard dashboard</button>
            </div>
          ) : null}
        </section>
        <FactsRail filters={filters} go={go} />
      </div>
    </>
  );
}

function DashboardTile({ tile, filters, pinned, pinDisabled, editing, dragging, onOpen, onPin, onRemove, onNudge, onDragStart, onDragEnd, onDropOn }) {
  const m = maybeMeasure(tile.measureId);
  if (!m) return null;
  const visual = tile.visual ? tile.visual(m) : visualFor(m);
  const isEstimate = m.method === 'estimate';
  const local = localTileReading(m, filters.geo);
  return (
    <li
      className={`sm-tile${pinned ? ' is-pinned' : ''}${dragging ? ' is-dragging' : ''}`}
      data-tile-id={tile.id}
      draggable={editing}
      onDragStart={(e) => { e.dataTransfer?.setData('text/plain', tile.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { if (editing) e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); onDropOn(); }}
    >
      <button type="button" className="sm-tile-body" onClick={onOpen}>
        <span className="sm-tile-area">{tile.title}</span>
        <span className="sm-tile-label">{tile.label || m.label}</span>
        {visual.visual === 'areaTrend' ? <span className="sm-trend-value">{formatMeasureValue(m, { compact: true })}</span> : null}
        <span className="sm-tile-visual"><SmartTileVisual {...visual} /></span>
        <span className="sm-tile-detail">
          {m.period}
          {isEstimate ? <span className="sm-estimate-chip">Estimate</span> : null}
        </span>
        {local ? <span className="sm-tile-local">{local}</span> : null}
        <span className="sm-tile-source">{sourceLabel(m.source)}</span>
      </button>
      <div className="sm-tile-tools">
        {editing ? (
          <>
            <button type="button" className="sm-tool" aria-label={`Move ${tile.title} earlier`} onClick={() => onNudge(-1)}>◀</button>
            <button type="button" className="sm-tool" aria-label={`Move ${tile.title} later`} onClick={() => onNudge(1)}>▶</button>
            <button type="button" className="sm-tool" aria-label={`Remove ${tile.title}`} onClick={onRemove}>✕</button>
          </>
        ) : null}
        <button type="button" className="sm-pin" aria-pressed={pinned} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${tile.title}`} disabled={pinDisabled} onClick={onPin}>
          {pinned ? 'Pinned' : 'Pin'}
        </button>
      </div>
    </li>
  );
}

// ---- Briefing strip -------------------------------------------------------------

function BriefingStrip({ go }) {
  if (!SIMPLE_BRIEFINGS.length) return null;
  return (
    <section className="sm-section sm-briefings" aria-labelledby="sm-briefings-title">
      <SectionHead title="Where the numbers raise questions" note="Ranked by how many of the four questions each one touches. Each is a question to examine, not a finding." />
      <ol className="sm-briefing-list">
        {SIMPLE_BRIEFINGS.map((b, i) => (
          <li key={b.id} className="sm-briefing" data-briefing-id={b.id}>
            <span className="sm-briefing-rank" aria-hidden="true">{i + 1}</span>
            <div className="sm-briefing-body">
              <h3>{b.headline}</h3>
              <p>{b.lede}</p>
              <dl className="sm-briefing-meta">
                <div><dt>Who is affected</dt><dd>{b.affected}</dd></div>
                <div><dt>Responsible</dt><dd>{b.responsible}</dd></div>
                <div><dt>Next action</dt><dd>{b.nextAction}</dd></div>
                <div><dt>Status</dt><dd>{b.status} · as of {b.asOf}</dd></div>
              </dl>
              <button type="button" className="sm-link" onClick={() => go(b.view, { anchor: b.anchor })}>See the numbers</button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---- Facts rail ------------------------------------------------------------------

const STATE_FACTS = [
  { id: 'members-total-dms', label: 'Medicaid and KCHIP members' },
  { id: 'children-enrolled', label: 'Children covered' },
  { id: 'expansion-adults', label: 'Expansion adults' },
  { id: 'members-managed-care-vs-ffs', label: 'In a managed care plan' },
  { id: 'total-medicaid-spending', label: 'Spent in a year' },
  { id: 'fmap', label: 'Federal share of most costs' },
];

function FactsRail({ filters, go }) {
  const { geo, population } = filters;
  const count = populationCount(geo, population);
  const pop = POPULATIONS.find((p) => p.id === population);
  return (
    <aside className="sm-section sm-facts" aria-labelledby="sm-facts-title">
      <h2 id="sm-facts-title">{geo ? geographyLabel(geo) : 'Kentucky facts'}</h2>
      <dl>
        {Number.isFinite(count?.value) ? (
          <div>
            <dt>{pop.id === 'all' ? 'Medicaid members' : pop.label}</dt>
            <dd>{count.value.toLocaleString('en-US')}{count.estimate ? <small className="sm-estimate-chip">Estimate</small> : null}</dd>
          </div>
        ) : null}
        {!geo ? STATE_FACTS.slice(1).map((f) => {
          const m = maybeMeasure(f.id);
          if (!m) return null;
          const value = f.id === 'members-managed-care-vs-ffs' ? `${m.value}%` : formatNumber(m.value, m.unit, { compact: true });
          return <div key={f.id}><dt>{f.label}</dt><dd>{value}<small>{m.period}</small></dd></div>;
        }) : <AreaFacts geo={geo} />}
      </dl>
      <div className="sm-facts-links">
        <button type="button" className="sm-link" onClick={() => go('simple-county', geo?.kind === 'county' ? { focusFips: geo.key } : undefined)}>Medicaid in my county (map)</button>
        <button type="button" className="sm-link" onClick={() => go('simple-district')}>My district</button>
        <button type="button" className="sm-link" onClick={() => go('simple-coverage')}>Who is covered</button>
      </div>
    </aside>
  );
}

function AreaFacts({ geo }) {
  const district = districtRow(geo);
  const counties = geographyCounties(geo) || [];
  if (geo.kind === 'county') {
    return countyFacts(geo.key).map((f) => (
      <div key={f.label}><dt>{f.label}</dt><dd>{f.display}{f.estimate ? <small className="sm-estimate-chip">Estimate</small> : null}</dd></div>
    ));
  }
  return (
    <>
      {district?.legislator ? <div><dt>Represented by</dt><dd>{district.legislator}{district.party ? <small>{district.party}</small> : null}</dd></div> : null}
      <div><dt>Counties</dt><dd>{counties.map((f) => COUNTY_NAME.get(f) || f).join(', ')}</dd></div>
    </>
  );
}

// ---- Configured pages ------------------------------------------------------------

export function ConfiguredPage({ page, filters, go, children }) {
  return (
    <>
      <PageHeader eyebrow={page.eyebrow} title={page.title} lede={page.lede} />
      <FilterBar filters={filters} />
      <ScopeNote filters={filters} />
      {page.statute ? <StatuteNote /> : null}
      {children}
      {page.sections.map((section) => <PageSection key={section.id} section={section} filters={filters} go={go} />)}
    </>
  );
}

function StatuteNote() {
  return (
    <section className="sm-section sm-statute" aria-label="What the law requires">
      <p>
        <strong>KRS 7A.287</strong> (2026 Ky. Acts ch. 179, §17, effective April 14, 2026) requires a healthcare
        transparency dashboard with performance indicators for the Medicaid managed care plans that include, at a
        minimum: (a) follow-up after emergency department visits, (b) cancer screenings, (c) child and adolescent
        well-care visits, (d) postpartum care, (e) diabetes care and management, and (f) hypertension care and management.
      </p>
      <p className="sm-source">
        Source: <a href="https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=57037" target="_blank" rel="noreferrer">Kentucky Revised Statutes 7A.287</a>.
        In federal fiscal year 2024 Kentucky began reporting several of these measures from claims alone, so drops that year partly reflect the change in method.
      </p>
    </section>
  );
}

export function PageSection({ section, filters, go }) {
  if (section.planMeasures) return <PlanMeasuresSection />;
  const Widget = section.widget ? WIDGETS[section.widget] : null;
  const measures = (section.measures || []).map(maybeMeasure).filter(Boolean);
  return (
    <section className="sm-section" id={section.id} aria-labelledby={`sm-${section.id}`}>
      <div className="sm-section-head">
        <h2 id={`sm-${section.id}`}>{section.statute ? <span className="sm-statute-tag">KRS 7A.287 {section.statute}</span> : null}{section.title}</h2>
        {section.note ? <p className="sm-note">{section.note}</p> : null}
      </div>
      {section.map ? <SectionMap map={section.map} filters={filters} /> : null}
      {Widget ? <Widget /> : null}
      <div className="sm-measures">
        {measures.map((m) => <MeasureCard key={m.id} measure={m} />)}
      </div>
      {section.crossReference === 'bh-by-plan' ? <BhByPlanCrossReference /> : null}
      {section.table ? (
        <>
          <MeasureTable
            caption={section.table.caption}
            measures={section.table.measures.map(maybeMeasure).filter(Boolean)}
            rowLabel={section.table.rowLabel}
            sortBy={section.table.sortBy}
          />
          <SourceCite source={maybeMeasure(section.table.measures[0])?.source} period={maybeMeasure(section.table.measures[0])?.period} />
        </>
      ) : null}
    </section>
  );
}

const WIDGETS = { 'plan-scorecard': PlanScorecard, sanctions: SanctionsTable, 'waiver-table': WaiverTable };

const optionKey = (o) => `${o.measureId}:${o.field || ''}`;

function SectionMap({ map, filters }) {
  const [measureId, setMeasureId] = useState(optionKey(map.options[0]));
  const option = map.options.find((o) => optionKey(o) === measureId) || map.options[0];
  const m = maybeMeasure(option.measureId);
  const [selected, setSelected] = useState(filters.geo?.kind === 'county' ? filters.geo.key : null);
  useEffect(() => { setSelected(filters.geo?.kind === 'county' ? filters.geo.key : null); }, [filters.geo?.kind, filters.geo?.key]);
  if (!m) return null;
  const rows = (m.rows || []).filter((r) => r.fips).map((r) => {
    const value = option.field ? r[option.field] : r.value;
    return { ...r, value, label: COUNTY_NAME.get(r.fips) || r.label, display: option.unit === 'hours' ? `${Math.round(value * 60)} min` : undefined };
  });
  const highlight = geographyCounties(filters.geo);
  const row = selected ? rows.find((r) => r.fips === selected) : null;
  return (
    <div className="sm-map-layout">
      <div>
        {map.options.length > 1 ? (
          <label className="sm-mco-sort">
            <span>Shade counties by</span>
            <select value={measureId} onChange={(e) => setMeasureId(e.target.value)}>
              {map.options.map((o) => <option key={optionKey(o)} value={optionKey(o)}>{o.field ? o.legend.replace(/^./, (c) => c.toUpperCase()) : (maybeMeasure(o.measureId)?.label || o.legend)}</option>)}
            </select>
          </label>
        ) : null}
        <CountyChoropleth rows={rows} unit={option.unit} legendLabel={option.legend} selectedFips={selected} highlightFips={highlight} onSelectCounty={setSelected} />
        <SourceCite source={m.source} period={m.period} />
        {m.method === 'estimate' && m.methodNote ? <p className="sm-method">How this is estimated: {m.methodNote}</p> : null}
      </div>
      <aside className="sm-county-panel" aria-live="polite">
        {row ? (
          <>
            <h3>{row.label} County</h3>
            <dl>
              <div><dt>{option.field ? option.legend : m.label}</dt><dd>{row.display ?? formatNumber(row.value, option.unit)}</dd></div>
              {countyFacts(row.fips).slice(0, 8).map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.display}</dd></div>)}
            </dl>
            <button type="button" className="sm-link" onClick={() => setSelected(null)}>Back to statewide</button>
          </>
        ) : (
          <>
            <h3>Statewide</h3>
            <p className="sm-note">Highest</p>
            <RankList rows={rows} order="desc" unit={option.unit} onSelect={setSelected} />
            <p className="sm-note">Lowest</p>
            <RankList rows={rows} order="asc" unit={option.unit} onSelect={setSelected} />
          </>
        )}
      </aside>
    </div>
  );
}

function RankList({ rows, order, unit, onSelect, count = 5 }) {
  const sorted = rows.filter((r) => Number.isFinite(r.value)).sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value)).slice(0, count);
  return (
    <ol className="sm-county-list">
      {sorted.map((r) => (
        <li key={r.fips}>
          <button type="button" className="sm-link" onClick={() => onSelect(r.fips)}>{r.label}</button>
          <span>{r.display ?? formatNumber(r.value, unit)}</span>
        </li>
      ))}
    </ol>
  );
}

// Behavioral health spend per plan member and 7-day follow-up, side by side (Adam: "mash them together").
// Members are the plan enrollment each plan reported for the same year (CMS MCPAR), not today's counts:
// Anthem's members moved to the other plans in January 2025.
function BhByPlanCrossReference() {
  const spend = maybeMeasure('bh-spend-mco');
  const fuh = maybeMeasure('mco-fuh-7day');
  if (!spend) return null;
  const memberRow = (label) => MCO_ROWS.find((r) => planKey(r.plan) === planKey(label));
  const fuhRow = (label) => fuh?.rows.find((r) => planKey(r.label) === planKey(label));
  const rows = spend.rows.map((r) => {
    const members = memberRow(r.label)?.values.enrollment ?? null;
    return { key: r.key, label: r.label, spend: r.value, members, perMember: members ? r.value / members : null, fuh: fuhRow(r.label)?.value ?? null };
  });
  return (
    <div className="sm-crossref">
      <h3>Cross-reference: spending per member and follow-up after a psychiatric stay, by plan</h3>
      <div className="sm-table-wrap">
        <table className="sm-table" aria-label="Behavioral health spending per member and follow-up by plan">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col" className="is-num">BH spending<small>{spend.period}</small></th>
              <th scope="col" className="is-num">Plan members<small>{MCPAR_SOURCE.period}</small></th>
              <th scope="col" className="is-num">BH spending per member per year</th>
              <th scope="col" className="is-num">Seen within 7 days of a psychiatric stay<small>{fuh?.period}</small></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td className="is-num">{formatNumber(r.spend, 'usd', { compact: true })}</td>
                <td className="is-num">{Number.isFinite(r.members) ? r.members.toLocaleString('en-US') : '—'}</td>
                <td className="is-num">{Number.isFinite(r.perMember) ? formatNumber(r.perMember, 'usd') : '—'}</td>
                <td className="is-num">{Number.isFinite(r.fuh) ? `${r.fuh}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sm-note">Spending covers state fiscal year 2024 (July 2023 to June 2024); members are the enrollment each plan reported in its 2024 federal annual report, so per-member figures are approximate. They are not adjusted for how sick each plan’s members are.</p>
      <SourceCite source={{ publisher: 'CMS', title: MCPAR_SOURCE.label, url: MCPAR_SOURCE.uri }} period="Plan members" />
    </div>
  );
}

function PlanMeasuresSection() {
  const planIds = useMemo(() => [...MEASURE_IDS_BY_PREFIX('mco-')], []);
  const [id, setId] = useState(planIds[0]);
  const m = maybeMeasure(id);
  if (!m) return null;
  const rows = [...m.rows].sort((a, b) => (m.betterDirection === 'lower' ? a.value - b.value : b.value - a.value));
  return (
    <section className="sm-section" id="by-plan" aria-labelledby="sm-by-plan">
      <SectionHead title="The same measures by health plan" note="Plan results from the state’s external quality review. Choose a measure." />
      <label className="sm-mco-sort">
        <span>Measure</span>
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {planIds.map((pid) => <option key={pid} value={pid}>{maybeMeasure(pid).label.replace(/ - by health plan$/, '')}</option>)}
        </select>
      </label>
      <div className="sm-table-wrap">
        <table className="sm-table" aria-label={m.label}>
          <thead>
            <tr><th scope="col">Plan</th><th scope="col" className="is-num">{m.period}</th><th scope="col" className="is-num">Target</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td className="is-num">{formatNumber(r.value, m.unit)}</td>
                <td className="is-num">{m.target && Number.isFinite(m.target.value) ? `${formatNumber(m.target.value, m.unit)}${Number.isFinite(r.value) ? (((m.betterDirection === 'lower') ? r.value <= m.target.value : r.value >= m.target.value) ? ' · met' : ' · not met') : ''}` : 'Not set'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m.target ? <p className="sm-note">Target: {m.target.label}.</p> : null}
      <SourceCite source={m.source} period={m.period} asOf={m.asOf} />
    </section>
  );
}

function MEASURE_IDS_BY_PREFIX(prefix) {
  return [...MEASURES.keys()].filter((id) => id.startsWith(prefix));
}

// ---- County and district pages -----------------------------------------------------

function countyMemberRows(population) {
  return COUNTY_OPTIONS.map((c) => {
    const count = populationCount({ kind: 'county', key: c.fips }, population);
    return { fips: c.fips, label: c.name, value: count.value, estimate: count.estimate };
  });
}

function CountyPage({ filters }) {
  const { population, geo } = filters;
  const [selected, setSelected] = useState(geo?.kind === 'county' ? geo.key : null);
  useEffect(() => { setSelected(geo?.kind === 'county' ? geo.key : null); }, [geo?.kind, geo?.key]);
  const rows = useMemo(() => countyMemberRows(population), [population]);
  const pop = POPULATIONS.find((p) => p.id === population);
  const anyEstimate = rows.some((r) => r.estimate);
  const select = (fips) => { setSelected(fips); filters.setGeo(fips ? { kind: 'county', key: fips } : null); };
  const county = selected ? rows.find((r) => r.fips === selected) : null;
  const members = maybeMeasure('county-members');
  return (
    <>
      <PageHeader eyebrow="Medicaid in my county" title="Where Medicaid members live" lede="Darker counties have fewer members. Choose who to count, then select a county to see everything DecisionPro has for it." />
      <FilterBar filters={filters} />
      <section className="sm-section" aria-label="County map">
        <div className="sm-map-layout">
          <div>
            <CountyChoropleth rows={rows} unit="count" legendLabel={pop.id === 'all' ? 'Medicaid members' : pop.label.toLowerCase()} selectedFips={selected} highlightFips={geographyCounties(geo?.kind === 'county' ? null : geo)} onSelectCounty={select} />
            {members ? <SourceCite source={members.source} period={members.period} /> : null}
            {anyEstimate ? <p className="sm-method">County counts for this group are estimates: published county totals split using statewide and Census shares.</p> : null}
          </div>
          <aside className="sm-county-panel" aria-live="polite">
            {county ? (
              <>
                <h3>{county.label} County</h3>
                <dl>
                  <div><dt>{pop.id === 'all' ? 'Medicaid members' : pop.label}</dt><dd>{Number.isFinite(county.value) ? county.value.toLocaleString('en-US') : '—'}</dd></div>
                  {POPULATIONS.filter((p) => p.id !== population && ['all', 'children', 'kchip', 'older'].includes(p.id)).map((p) => {
                    const c = populationCount({ kind: 'county', key: county.fips }, p.id);
                    return <div key={p.id}><dt>{p.id === 'all' ? 'Medicaid members' : p.label}</dt><dd>{Number.isFinite(c.value) ? c.value.toLocaleString('en-US') : '—'}{c.estimate ? <small className="sm-estimate-chip">Estimate</small> : null}</dd></div>;
                  })}
                  {countyFacts(county.fips).map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.display}{f.estimate ? <small className="sm-estimate-chip">Estimate</small> : null}</dd></div>)}
                </dl>
                <button type="button" className="sm-link" onClick={() => select(null)}>Back to statewide</button>
              </>
            ) : (
              <>
                <h3>Statewide</h3>
                <p className="sm-note">Most members</p>
                <RankList rows={rows} order="desc" unit="count" onSelect={select} />
                <p className="sm-note">Fewest members</p>
                <RankList rows={rows} order="asc" unit="count" onSelect={select} />
              </>
            )}
          </aside>
        </div>
        <p className="sm-note">Member counts of 1 to 10 are never shown.</p>
      </section>
    </>
  );
}

function DistrictPage({ filters }) {
  const [chamber, setChamber] = useState(filters.geo?.kind === 'senate' ? 'senate' : 'house');
  const list = chamber === 'house' ? HOUSE_DISTRICTS : SENATE_DISTRICTS;
  const initial = filters.geo && (filters.geo.kind === chamber) ? filters.geo.key : list[0]?.key;
  const [key, setKey] = useState(initial);
  const geo = { kind: chamber, key: list.some((d) => d.key === key) ? key : list[0]?.key };
  const district = districtRow(geo);
  const members = populationCount(geo, 'all');
  const children = populationCount(geo, 'children');
  const est = maybeMeasure(chamber === 'house' ? 'house-district-members-estimate' : 'senate-district-members-estimate');
  const estRow = est?.rows.find((r) => r.key === geo.key);
  const countyRows = (district?.counties || []).map((c) => ({ ...c, members: populationCount({ kind: 'county', key: c.fips }, 'all').value }));
  const mapRows = COUNTY_OPTIONS.map((c) => ({ fips: c.fips, label: c.name, value: populationCount({ kind: 'county', key: c.fips }, 'all').value }));
  return (
    <>
      <PageHeader eyebrow="My district" title="Medicaid in your legislative district" lede="Pick a House or Senate district to see its members, the counties it covers, and what those counties look like." />
      <section className="sm-section sm-district-pick" aria-label="Choose a district">
        <div className="sm-filters">
          <label>
            <span>Chamber</span>
            <select value={chamber} onChange={(e) => { setChamber(e.target.value); setKey((e.target.value === 'house' ? HOUSE_DISTRICTS : SENATE_DISTRICTS)[0]?.key); }}>
              <option value="house">House (100 districts)</option>
              <option value="senate">Senate (38 districts)</option>
            </select>
          </label>
          <label>
            <span>District</span>
            <select value={geo.key} onChange={(e) => { setKey(e.target.value); filters.setGeo({ kind: chamber, key: e.target.value }); }}>
              {list.map((d) => <option key={d.key} value={d.key}>{d.label}{d.legislator ? ` — ${d.legislator}` : ''}</option>)}
            </select>
          </label>
        </div>
      </section>
      {district ? (
        <section className="sm-section" aria-labelledby="sm-district-title">
          <SectionHead title={`${district.label}${district.legislator ? ` · ${district.legislator}${district.party ? ` (${district.party})` : ''}` : ''}`} />
          <div className="sm-map-layout">
            <div>
              <CountyChoropleth rows={mapRows} unit="count" legendLabel="Medicaid members" highlightFips={district.counties.map((c) => c.fips)} />
              <p className="sm-note">Counties outside the district are dimmed.</p>
            </div>
            <aside className="sm-county-panel">
              <dl>
                <div><dt>Medicaid members (estimate)</dt><dd>{Number.isFinite(members.value) ? members.value.toLocaleString('en-US') : '—'}</dd></div>
                <div><dt>Children covered (estimate)</dt><dd>{Number.isFinite(children.value) ? children.value.toLocaleString('en-US') : '—'}</dd></div>
                {estRow?.pctOfPop2020 ? <div><dt>Share of residents on Medicaid</dt><dd>{estRow.pctOfPop2020}%</dd></div> : null}
                <div><dt>Residents (2020 Census)</dt><dd>{Number.isFinite(district.pop2020) ? district.pop2020.toLocaleString('en-US') : '—'}</dd></div>
              </dl>
              {est?.methodNote ? <p className="sm-method">How this is estimated: {est.methodNote}</p> : null}
            </aside>
          </div>
          <div className="sm-table-wrap">
            <table className="sm-table" aria-label="Counties in this district">
              <thead><tr><th scope="col">County</th><th scope="col">In district</th><th scope="col" className="is-num">County Medicaid members</th><th scope="col">Primary care shortage</th></tr></thead>
              <tbody>
                {countyRows.map((c) => (
                  <tr key={c.fips}>
                    <th scope="row">{COUNTY_NAME.get(c.fips) || c.name}</th>
                    <td>{c.whole ? 'Whole county' : `Part (${Math.round((c.shareOfCounty || 0) * 100)}% of residents)`}</td>
                    <td className="is-num">{Number.isFinite(c.members) ? c.members.toLocaleString('en-US') : '—'}</td>
                    <td>{countyFacts(c.fips).find((f) => f.label === 'Primary care shortage area')?.display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceCite source={maybeMeasure(chamber === 'house' ? 'house-districts-counties' : 'senate-districts-counties')?.source} />
        </section>
      ) : null}
    </>
  );
}

export { getMeasure };
