import { useMemo, useRef, useState } from 'react';
import {
  FEWEST_MEMBERS_COUNTIES,
  HEADLINE_TILES,
  HEADLINE_TILE_IDS,
  HOT_TOPICS,
  KY_COUNTY_ROWS,
  MEMBERS_SOURCE,
  MEMBER_BANDS,
  MOST_MEMBERS_COUNTIES,
  SIMPLE_MODE_GAPS,
} from '../lib/simpleMode/simpleModeData.js';
import {
  PINNED_TILES_MAX,
  orderTilesByPins,
  readPinnedTiles,
  storePinnedTiles,
  togglePinnedTile,
} from '../lib/simpleMode/pinnedTiles.js';
import { KyCountyHeatMap } from './KyCountyHeatMap.jsx';
import { McoComparison, SourceLine } from './McoComparison.jsx';

export function SimpleHome({ onOpenFullWorkspace, onBrowseSources }) {
  const [pins, setPins] = useState(() => readPinnedTiles(HEADLINE_TILE_IDS));
  const [selectedFips, setSelectedFips] = useState(null);
  const [focusedGapId, setFocusedGapId] = useState(null);
  const mapRef = useRef(null);
  const mcoRef = useRef(null);
  const gapsRef = useRef(null);

  const tiles = useMemo(() => orderTilesByPins(HEADLINE_TILES, pins), [pins]);
  const selected = KY_COUNTY_ROWS.find((row) => row.fips === selectedFips) || null;

  function togglePin(id) {
    setPins((current) => storePinnedTiles(togglePinnedTile(current, id)));
  }

  function goTo(target, focusFips = null) {
    if (target === 'map') {
      if (focusFips) setSelectedFips(focusFips);
      mapRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } else if (target === 'mco') {
      mcoRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } else {
      setFocusedGapId(target);
      gapsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <main className="main sm-home" aria-labelledby="sm-title">
      <header className="sm-hero">
        <p className="sm-eyebrow">Kentucky at a glance</p>
        <h1 id="sm-title">Kentucky Medicaid in plain numbers</h1>
        <p className="sm-lede">
          Where Medicaid members live, what the state pays its managed care plans, and how those plans
          compare. Every number names its public source and date.
        </p>
        <nav className="sm-topics" aria-label="Start with a topic">
          {HOT_TOPICS.map((topic) => (
            <button key={topic.id} type="button" className="sm-chip" onClick={() => goTo(topic.target)}>
              {topic.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="sm-section" aria-labelledby="sm-headlines-title">
        <div className="sm-section-head">
          <h2 id="sm-headlines-title">The headlines</h2>
          <p className="sm-note">
            Pin up to {PINNED_TILES_MAX} to keep them first. Pins are saved in this browser only.
          </p>
        </div>
        <ul className="sm-tiles">
          {tiles.map((tile) => {
            const pinned = pins.includes(tile.id);
            return (
              <li key={tile.id} className={`sm-tile${pinned ? ' is-pinned' : ''}`} data-tile-id={tile.id}>
                <button type="button" className="sm-tile-body" onClick={() => goTo(tile.target, tile.focusFips)}>
                  <span className="sm-tile-label">{tile.label}</span>
                  <strong className="sm-tile-value">{tile.value}</strong>
                  <span className="sm-tile-detail">{tile.detail}</span>
                  <span className="sm-tile-source">{tile.source.label}</span>
                </button>
                <button
                  type="button"
                  className="sm-pin"
                  aria-pressed={pinned}
                  aria-label={`${pinned ? 'Unpin' : 'Pin'} ${tile.label}`}
                  disabled={!pinned && pins.length >= PINNED_TILES_MAX}
                  onClick={() => togglePin(tile.id)}
                >
                  {pinned ? 'Pinned' : 'Pin'}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sm-section" ref={mapRef} aria-labelledby="sm-map-title">
        <div className="sm-section-head">
          <h2 id="sm-map-title">Where Medicaid members live</h2>
          <p className="sm-note">Darker counties have fewer members. Select a county to see its numbers.</p>
        </div>
        <div className="sm-map-layout">
          <KyCountyHeatMap
            rows={KY_COUNTY_ROWS}
            bands={MEMBER_BANDS}
            selectedFips={selectedFips}
            onSelectCounty={setSelectedFips}
          />
          <aside className="sm-county-panel" aria-live="polite">
            {selected ? (
              <>
                <h3>{selected.name} County</h3>
                <dl>
                  <div><dt>Medicaid members</dt><dd>{selected.membersDisplay}</dd></div>
                  <div><dt>Primary-care shortage area</dt><dd>{selected.hpsaLabel}</dd></div>
                  <div><dt>Nursing facility beds</dt><dd>{formatCount(selected.certifiedSnfBeds)}</dd></div>
                  <div><dt>Nursing facilities</dt><dd>{formatCount(selected.snfFacilityCount)}</dd></div>
                </dl>
                <button type="button" className="sm-link" onClick={() => setSelectedFips(null)}>
                  Back to statewide
                </button>
              </>
            ) : (
              <>
                <h3>Statewide</h3>
                <p className="sm-note">Most members</p>
                <CountyList rows={MOST_MEMBERS_COUNTIES} onSelect={setSelectedFips} />
                <p className="sm-note">Fewest members</p>
                <CountyList rows={FEWEST_MEMBERS_COUNTIES} onSelect={setSelectedFips} />
              </>
            )}
          </aside>
        </div>
        <SourceLine source={MEMBERS_SOURCE} onBrowseSources={onBrowseSources} />
        <p className="sm-note">
          Member counts of 1 to 10 are never shown. Districts and Area Development Districts are coming;
          see “Not loaded yet” below.
        </p>
      </section>

      <section className="sm-section" ref={mcoRef} aria-labelledby="sm-mco-title">
        <div className="sm-section-head">
          <h2 id="sm-mco-title">How the managed care plans compare</h2>
          <p className="sm-note">Every plan that filed the 2024 federal report. Changes to plan contracts since then are not loaded yet.</p>
        </div>
        <McoComparison onBrowseSources={onBrowseSources} />
      </section>

      <section className="sm-section" ref={gapsRef} aria-labelledby="sm-gaps-title">
        <div className="sm-section-head">
          <h2 id="sm-gaps-title">Not loaded yet</h2>
          <p className="sm-note">These topics come up every session. DecisionPro shows no number until it has a sourced one.</p>
        </div>
        <ul className="sm-gaps">
          {SIMPLE_MODE_GAPS.map((gap) => (
            <li key={gap.id} className={`sm-gap${focusedGapId === gap.id ? ' is-focused' : ''}`} data-gap-id={gap.id}>
              <small>{gap.topic}</small>
              <h3>{gap.title}</h3>
              <p>{gap.why}</p>
              <p className="sm-gap-unblock"><span>To add it:</span> {gap.unblock}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="sm-footer">
        <p>Want the detail behind these numbers?</p>
        <button type="button" className="sm-cta" onClick={onOpenFullWorkspace}>
          Open the full DecisionPro workspace <span aria-hidden="true">→</span>
        </button>
      </footer>
    </main>
  );
}

function CountyList({ rows, onSelect }) {
  return (
    <ol className="sm-county-list">
      {rows.map((row) => (
        <li key={row.fips}>
          <button type="button" className="sm-link" onClick={() => onSelect(row.fips)}>{row.name}</button>
          <span>{row.membersDisplay}</span>
        </li>
      ))}
    </ol>
  );
}

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : 'Not reported';
}
