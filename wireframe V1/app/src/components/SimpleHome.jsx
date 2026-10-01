import { useMemo, useState } from 'react';
import {
  FEWEST_MEMBERS_COUNTIES,
  HEADLINE_TILES,
  HEADLINE_TILE_IDS,
  HOT_TOPICS,
  KY_COUNTY_ROWS,
  MCO_COMPARABLE_MEASURE_IDS,
  MEMBERS_SOURCE,
  MEMBER_BANDS,
  MOST_MEMBERS_COUNTIES,
  SIMPLE_MODE_GAPS,
  formatUsd,
} from '../lib/simpleMode/simpleModeData.js';
import {
  PINNED_TILES_MAX,
  orderTilesByPins,
  readPinnedTiles,
  storePinnedTiles,
  togglePinnedTile,
} from '../lib/simpleMode/pinnedTiles.js';
import {
  BH_SOURCE,
  BH_SPEND,
  BH_SPEND_BY_PLAN_SFY2024,
  IS_REVIEW_BUILD,
  PLAN_STATUS_SOURCE,
  REVIEW_MCO_MEASURES,
  REVIEW_TILES,
  WAITLIST_UNDUPLICATED,
  WAIVERS,
  WAIVER_NEW_SLOTS_SFY26,
  WAIVER_SOURCE,
  rankReviewMcos,
} from '../lib/simpleMode/reviewData.js';
import { KyCountyHeatMap } from './KyCountyHeatMap.jsx';
import { McoComparison, ReviewMcoComparison, SourceLine } from './McoComparison.jsx';

// Simple-mode tabs, in left-nav order. Each is its own page.
export const SIMPLE_TABS = [
  { view: 'simple-home', label: 'At a glance' },
  { view: 'simple-plans', label: 'Plan consolidation' },
  { view: 'simple-county', label: 'Medicaid in my county' },
  { view: 'simple-waivers', label: 'Waiver waitlists' },
  { view: 'simple-bh', label: 'Behavioral health' },
  { view: 'simple-district', label: 'My district' },
];
export const SIMPLE_VIEWS = SIMPLE_TABS.map((t) => t.view);

// Tile and topic targets → the tab that carries them.
const TARGET_VIEW = {
  map: 'simple-county',
  mco: 'simple-plans',
  waivers: 'simple-waivers',
  bh: 'simple-bh',
  'gap-waivers': 'simple-waivers',
  'gap-behavioral-health': 'simple-bh',
  'gap-districts': 'simple-district',
};

const GAP = Object.fromEntries(SIMPLE_MODE_GAPS.map((g) => [g.id, g]));

export function SimplePage({ view = 'simple-home', review = IS_REVIEW_BUILD, onNavigate, onBrowseSources, focusFips = null }) {
  const go = (target, opts) => onNavigate?.(TARGET_VIEW[target] || target, opts);
  return (
    <main className="main sm-home" aria-labelledby="sm-title">
      {review ? <ReviewBanner /> : null}
      {view === 'simple-home' && <AtAGlancePage review={review} go={go} />}
      {view === 'simple-plans' && <PlansPage review={review} onBrowseSources={onBrowseSources} />}
      {view === 'simple-county' && <CountyPage key={focusFips || 'statewide'} focusFips={focusFips} onBrowseSources={onBrowseSources} />}
      {view === 'simple-waivers' && <WaiversPage review={review} />}
      {view === 'simple-bh' && <BehavioralHealthPage review={review} />}
      {view === 'simple-district' && <DistrictPage />}
    </main>
  );
}

// Kept for callers and tests that render the landing page directly.
export function SimpleHome(props) {
  return <SimplePage {...props} view="simple-home" />;
}

function ReviewBanner() {
  return (
    <aside className="sm-review-banner" role="note" aria-label="Review draft">
      <strong>Draft for review — not for distribution</strong>
      <p>
        Prepared for Adam Mather’s review. Figures marked “entered by hand” are typed in from the
        state documents named beside them, and the plan ranking is a draft for discussion.
      </p>
    </aside>
  );
}

function PageHeader({ eyebrow, title, lede }) {
  return (
    <header className="sm-hero">
      <p className="sm-eyebrow">{eyebrow}</p>
      <h1 id="sm-title">{title}</h1>
      {lede ? <p className="sm-lede">{lede}</p> : null}
    </header>
  );
}

function AtAGlancePage({ review, go }) {
  const allTiles = review
    ? [...HEADLINE_TILES.filter((t) => t.id !== 'mco-count'), ...REVIEW_TILES.map((t) => (t.id === 'review-bh-spend' ? { ...t, target: 'bh' } : t))]
    : HEADLINE_TILES;
  const allTileIds = review ? allTiles.map((t) => t.id) : HEADLINE_TILE_IDS;
  const [pins, setPins] = useState(() => readPinnedTiles(allTileIds));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tiles = useMemo(() => orderTilesByPins(allTiles, pins), [pins, review]);

  return (
    <>
      <header className="sm-hero">
        <p className="sm-eyebrow">Kentucky at a glance</p>
        <h1 id="sm-title">Kentucky Medicaid in plain numbers</h1>
        <p className="sm-lede">
          Where Medicaid members live, what the state pays its managed care plans, and how those plans
          compare. Every number names its public source and date.
        </p>
        <nav className="sm-topics" aria-label="Start with a topic">
          {HOT_TOPICS.map((topic) => (
            <button key={topic.id} type="button" className="sm-chip" onClick={() => go(topic.target)}>
              {topic.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="sm-section" aria-labelledby="sm-headlines-title">
        <div className="sm-section-head">
          <h2 id="sm-headlines-title">The headlines</h2>
          <p className="sm-note">Pin up to {PINNED_TILES_MAX} to keep them first. Pins are saved in this browser only.</p>
        </div>
        <ul className="sm-tiles">
          {tiles.map((tile) => {
            const pinned = pins.includes(tile.id);
            return (
              <li key={tile.id} className={`sm-tile${pinned ? ' is-pinned' : ''}`} data-tile-id={tile.id}>
                <button type="button" className="sm-tile-body" onClick={() => go(tile.target, { focusFips: tile.focusFips || null })}>
                  <span className="sm-tile-label">{tile.label}</span>
                  <strong className="sm-tile-value">{tile.value}</strong>
                  <span className="sm-tile-detail">{tile.detail}</span>
                  <span className="sm-tile-source">{tile.source.label}</span>
                  {tile.handEntered ? <span className="sm-hand">Entered by hand</span> : null}
                </button>
                <button
                  type="button"
                  className="sm-pin"
                  aria-pressed={pinned}
                  aria-label={`${pinned ? 'Unpin' : 'Pin'} ${tile.label}`}
                  disabled={!pinned && pins.length >= PINNED_TILES_MAX}
                  onClick={() => setPins((current) => storePinnedTiles(togglePinnedTile(current, tile.id)))}
                >
                  {pinned ? 'Pinned' : 'Pin'}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function PlansPage({ review, onBrowseSources }) {
  const gaps = review ? [GAP['gap-mco-quality']] : [GAP['gap-plan-contracts'], GAP['gap-mco-quality']];
  return (
    <>
      <PageHeader
        eyebrow="Plan consolidation"
        title="How the managed care plans compare"
        lede={review
          ? 'Kentucky now has five plans. Anthem’s 2024 figures are shown greyed for reference.'
          : 'Every plan that filed the 2024 federal report. Changes to plan contracts since then are not loaded yet.'}
      />
      <section className="sm-section" aria-label="Plan comparison">
        {review ? (
          <ReviewMcoComparison
            onBrowseSources={onBrowseSources}
            measures={REVIEW_MCO_MEASURES}
            rank={rankReviewMcos}
            comparableIds={MCO_COMPARABLE_MEASURE_IDS}
            sources={[PLAN_STATUS_SOURCE, BH_SOURCE]}
          />
        ) : (
          <McoComparison onBrowseSources={onBrowseSources} />
        )}
      </section>
      <GapList gaps={gaps} />
    </>
  );
}

function CountyPage({ focusFips, onBrowseSources }) {
  const [selectedFips, setSelectedFips] = useState(focusFips);
  const selected = KY_COUNTY_ROWS.find((row) => row.fips === selectedFips) || null;
  return (
    <>
      <PageHeader
        eyebrow="Medicaid in my county"
        title="Where Medicaid members live"
        lede="Darker counties have fewer members. Select a county to see its numbers."
      />
      <section className="sm-section" aria-label="County map">
        <div className="sm-map-layout">
          <KyCountyHeatMap rows={KY_COUNTY_ROWS} bands={MEMBER_BANDS} selectedFips={selectedFips} onSelectCounty={setSelectedFips} />
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
                <button type="button" className="sm-link" onClick={() => setSelectedFips(null)}>Back to statewide</button>
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
        <p className="sm-note">Member counts of 1 to 10 are never shown.</p>
      </section>
      <GapList gaps={[GAP['gap-demographics']]} />
    </>
  );
}

function WaiversPage({ review }) {
  if (!review) {
    return (
      <>
        <PageHeader eyebrow="Waiver waitlists" title="Waiver slots and waitlists" />
        <GapList gaps={[GAP['gap-waivers']]} />
      </>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Waiver waitlists"
        title="Waiver slots and waitlists"
        lede={`${WAITLIST_UNDUPLICATED.toLocaleString('en-US')} people are waiting, each counted once. ${WAIVER_NEW_SLOTS_SFY26}`}
      />
      <section className="sm-section" aria-label="1915(c) waivers">
        <div className="sm-table-wrap">
          <table className="sm-table" aria-label="1915(c) waivers">
            <thead>
              <tr>
                <th scope="col">Waiver</th>
                <th scope="col" className="is-num">Funded slots</th>
                <th scope="col" className="is-num">Filled</th>
                <th scope="col" className="is-num">On waitlist</th>
                <th scope="col" className="is-num">Average wait</th>
              </tr>
            </thead>
            <tbody>
              {WAIVERS.map((w) => (
                <tr key={w.id}>
                  <th scope="row">{w.name}<small>{w.serves}</small></th>
                  <td className="is-num">{w.funded.toLocaleString('en-US')}</td>
                  <td className="is-num">{w.filled.toLocaleString('en-US')}</td>
                  <td className="is-num">{w.waitlist.toLocaleString('en-US')}</td>
                  <td className="is-num">{formatWait(w.avgDaysWaiting)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sm-source">Entered by hand from: {WAIVER_SOURCE.label}</p>
        <p className="sm-hand">Entered by hand</p>
      </section>
    </>
  );
}

function BehavioralHealthPage({ review }) {
  if (!review) {
    return (
      <>
        <PageHeader eyebrow="Behavioral health" title="Behavioral health spending" />
        <GapList gaps={[GAP['gap-behavioral-health']]} />
      </>
    );
  }
  const plans = Object.entries(BH_SPEND_BY_PLAN_SFY2024).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <PageHeader
        eyebrow="Behavioral health"
        title="Behavioral health spending"
        lede={`Managed care plans spent ${formatUsd(BH_SPEND.sfy2024, { compact: true })} on behavioral health in SFY 2024, up from ${formatUsd(BH_SPEND.sfy2023, { compact: true })} in SFY 2023. ${formatUsd(BH_SPEND.sudSfy2024, { compact: true })} of it was for substance use disorder.`}
      />
      <section className="sm-section" aria-label="Behavioral health spend by plan">
        <div className="sm-table-wrap">
          <table className="sm-table" aria-label="Behavioral health spend by plan, SFY 2024">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col" className="is-num">Behavioral health spend, SFY 2024</th>
                <th scope="col" className="is-num">Share of all plans</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(([plan, amount]) => (
                <tr key={plan}>
                  <th scope="row">{plan}</th>
                  <td className="is-num">{formatUsd(amount)}</td>
                  <td className="is-num">{((amount / BH_SPEND.sfy2024) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sm-source">Entered by hand from: {BH_SOURCE.label}</p>
        <p className="sm-hand">Entered by hand</p>
      </section>
    </>
  );
}

function DistrictPage() {
  return (
    <>
      <PageHeader
        eyebrow="My district"
        title="Medicaid in your legislative district"
        lede="District and Area Development District views are planned. Until they are loaded, use the county map."
      />
      <GapList gaps={[GAP['gap-districts'], GAP['gap-add']]} />
    </>
  );
}

function GapList({ gaps }) {
  return (
    <section className="sm-section" aria-label="Not loaded yet">
      <div className="sm-section-head">
        <h2>Not loaded yet</h2>
        <p className="sm-note">DecisionPro shows no number until it has a sourced one.</p>
      </div>
      <ul className="sm-gaps">
        {gaps.filter(Boolean).map((gap) => (
          <li key={gap.id} className="sm-gap" data-gap-id={gap.id}>
            <small>{gap.topic}</small>
            <h3>{gap.title}</h3>
            <p>{gap.why}</p>
            <p className="sm-gap-unblock"><span>To add it:</span> {gap.unblock}</p>
          </li>
        ))}
      </ul>
    </section>
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

function formatWait(days) {
  if (!Number.isFinite(days)) return 'No waitlist';
  return days < 365 ? `${Math.round(days / 30.4)} months` : `${(days / 365).toFixed(1)} years`;
}

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : 'Not reported';
}
