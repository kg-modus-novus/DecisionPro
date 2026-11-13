import { useState } from 'react';
import { SMALL_CELL_MINIMUM, TIER_RULE, WORTH_REVIEW_TIER_KEYS } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { STATE_NAMES } from '../../data/potentialFraudCatalog.js';
import { money, count } from './fraudFormat.jsx';
import { StateTileMap, Swatch, Legend, shortMoney, TIER_COLORS, TIER_DISPLAY_ORDER, tierShortLabel } from './fraudVisuals.jsx';

/**
 * The radar's header: one sentence, a bar splitting the year's dollars above the enrollment line by
 * suggested tier, and a state tile map (colored by worth-review dollars or all dollars above the
 * line) with a panel for the selected state. Presentation only: every figure is a program summary. A state-year
 * or service whose dollars went to fewer than SMALL_CELL_MINIMUM billers shows no dollar figure, color or bar.
 */

const WITHHELD = `withheld: fewer than ${SMALL_CELL_MINIMUM} billers`;
/** A state-year's shown totals leave out services paid to fewer billers than the minimum; say how many. */
const leftOut = (t) => (t.withheldServices > 0 ? ` (leaves out ${t.withheldServices} service${t.withheldServices === 1 ? '' : 's'} paid to fewer than ${SMALL_CELL_MINIMUM} billers)` : '');

const TIERS = Object.fromEntries(TIER_RULE.map((t) => [t.key, t]));

// The national totals are the program's shown totals: they leave out the dollars of services paid to fewer billers
// than the minimum, and the services they cover are counted without those (each tier says how many it leaves out).
const shownServices = (t) => t.services - t.withheldServices;

export function RadarMoneyBar({ ys, year }) {
  const total = ys.shownAboveEnrollment || 1;
  const convention = ys.tiers.convention;
  const worthLabels = WORTH_REVIEW_TIER_KEYS.map((k) => `${tierShortLabel(TIERS[k])} ${money(ys.tiers[k].shownAboveEnrollment)} (${count(shownServices(ys.tiers[k]))})`).join(' + ');
  return (
    <div className="pfd-moneybar-block">
      <p className="pfd-lede">
        In {year}, <b>{money(ys.shownStatePaid)}</b> of {money(ys.nationalPaidInFile)} in Medicaid payments went to {count(shownServices(ys))} flagged services.{' '}
        <b>{money(ys.shownAboveEnrollment)}</b> of that is above what enrollment predicts
        {ys.mostAboveEnrollmentIsConvention ? ', and most of it looks like a billing convention.' : '.'}
        {ys.withheldServices > 0 ? ` These totals leave out ${count(ys.withheldServices)} flagged service${ys.withheldServices === 1 ? '' : 's'} paid to fewer than ${SMALL_CELL_MINIMUM} billers.` : ''}
      </p>
      <div className="pfd-moneybar" role="img" aria-label={`Dollars above the enrollment line in ${year} by suggested tier`}>
        {TIER_DISPLAY_ORDER.map((k) => {
          const v = ys.tiers[k].shownAboveEnrollment;
          if (v <= 0) return null;
          return <span key={k} className="pfd-moneybar-seg" style={{ width: `${Math.max(0.6, (v / total) * 100)}%`, background: TIER_COLORS[k] }} title={`${tierShortLabel(TIERS[k])}: ${money(v)} on ${count(shownServices(ys.tiers[k]))} services`} />;
        })}
      </div>
      <div className="pfd-moneybar-caption">
        <span className="pfd-worth"><b>Worth review: {money(ys.shownWorthReviewAboveEnrollment)}</b> · {worthLabels}</span>
        <span className="pfd-muted">Likely convention: {money(convention.shownAboveEnrollment)} ({count(shownServices(convention))})</span>
      </div>
      <Legend>
        {TIER_DISPLAY_ORDER.map((k) => <Swatch key={k} color={TIER_COLORS[k]} label={`${tierShortLabel(TIERS[k])} ${money(ys.tiers[k].shownAboveEnrollment)} · ${count(shownServices(ys.tiers[k]))}`} />)}
      </Legend>
    </div>
  );
}

const RAMP = [['#FAECE7', '#712B13'], ['#F5C4B3', '#712B13'], ['#F0997B', '#4A1B0C'], ['#D85A30', '#FAECE7'], ['#993C1D', '#FAECE7']];
const RAMP_CUTS = { review: [10e6, 50e6, 150e6, 300e6], all: [250e6, 500e6, 1e9, 3e9] };
const MAP_MODES = [
  { key: 'review', label: 'Worth review $' },
  { key: 'all', label: 'All $ above line' },
];

export function RadarStateMap({ radar, review, year, selected, isFiltered, onSelect, onClear, openCase, openState }) {
  const [mode, setMode] = useState('review');
  const summary = (st) => review.StateYearSummaries[`${st}|${year}`];
  const valueOf = (st) => (mode === 'review' ? summary(st)?.shownWorthReviewAboveEnrollment : summary(st)?.shownAboveEnrollment) ?? 0;
  const max = Math.max(0, ...Object.keys(STATE_NAMES).map(valueOf));
  const tileStyle = (st) => {
    const v = valueOf(st);
    if (v <= 0) return null;
    const [background, color] = RAMP[RAMP_CUTS[mode].filter((c) => v >= c).length];
    return { background, color };
  };
  const tileTitle = (st) => {
    const t = summary(st);
    if (!t) return `${STATE_NAMES[st]}: no flagged service in ${year}`;
    if (t.dollarsAreWithheld) return `${STATE_NAMES[st]}: dollars ${WITHHELD} · ${t.tiers.high.services} HIGH, ${t.tiers.verify.services} VERIFY`;
    return `${STATE_NAMES[st]}: ${money(t.shownWorthReviewAboveEnrollment)} worth review of ${money(t.shownAboveEnrollment)} above the line${leftOut(t)} · ${t.tiers.high.services} HIGH, ${t.tiers.verify.services} VERIFY`;
  };
  const bt = radar.backtest;
  return (
    <div className="pfd-card pfd-mapblock">
      <div className="pfd-pillrow">
        <span className="pfd-pill-label">Color states by</span>
        {MAP_MODES.map((m) => (
          <button key={m.key} type="button" className={`pfd-pill${mode === m.key ? ' is-on' : ''}`} aria-pressed={mode === m.key} onClick={() => setMode(m.key)} data-map-mode={m.key}>{m.label}</button>
        ))}
        <span className="pfd-note pfd-tight">Backtest {bt.filter((b) => b.ok).length}/{bt.length} known cases · click a state to filter the list</span>
        {isFiltered ? <button type="button" className="pfd-btn pfd-btn-ghost pfd-push" onClick={onClear}>Show all states</button> : null}
      </div>
      <div className="pfd-mapblock-row">
        <div>
          <StateTileMap
            size="large"
            label={`States by ${mode === 'review' ? 'worth-review dollars' : 'dollars above the enrollment line'} in ${year}`}
            selected={selected}
            onSelect={onSelect}
            tileStyle={tileStyle}
            tileTitle={tileTitle}
            tileMark={(st) => (summary(st)?.tiers.high.services ? '●' : '')}
            tileText={(st) => (valueOf(st) > 0 ? shortMoney(valueOf(st)) : '')}
          />
          <div className="pfd-ramp">
            <span>none</span>
            <span className="pfd-ramp-steps">
              {RAMP.map(([bg], i) => (
                <span key={bg} className="pfd-ramp-step"><i style={{ background: bg }} /><small>{i === 0 ? `< ${shortMoney(RAMP_CUTS[mode][0])}` : `${shortMoney(RAMP_CUTS[mode][i - 1])}+`}</small></span>
              ))}
            </span>
            <span>max {shortMoney(max)}</span>
            <span className="pfd-ramp-dot">● has a HIGH row</span>
          </div>
        </div>
        <StatePanel review={review} year={year} state={selected} openCase={openCase} openState={openState} />
      </div>
    </div>
  );
}

function StatePanel({ review, year, state, openCase, openState }) {
  const t = review.StateYearSummaries[`${state}|${year}`];
  if (!t) {
    return (
      <div className="pfd-statepanel">
        <h4>{STATE_NAMES[state]} · {year}</h4>
        <p className="pfd-note">{STATE_NAMES[state]} has no flagged service in {year}.</p>
      </div>
    );
  }
  const rows = review.ServiceYears.filter((s) => s.state === state && s.year === year && s.aboveEnrollment > 0)
    .sort((a, b) => b.aboveEnrollment - a.aboveEnrollment).slice(0, 5);
  const top = Math.max(1, ...rows.filter((s) => !s.statePaidIsWithheld).map((s) => s.aboveEnrollment));
  return (
    <div className="pfd-statepanel" data-state-panel={state}>
      <h4>{STATE_NAMES[state]} · {year}</h4>
      <p className="pfd-statepanel-sub">{t.dollarsAreWithheld ? <>Dollars {WITHHELD}</> : <><b>{money(t.shownWorthReviewAboveEnrollment)}</b> worth review of {money(t.shownAboveEnrollment)} above the line{leftOut(t)}</>} · {count(t.services)} flagged services</p>
      <div className="pfd-tiercounts">
        {TIER_DISPLAY_ORDER.filter((k) => t.tiers[k].services > 0).map((k) => <Swatch key={k} color={TIER_COLORS[k]} label={`${tierShortLabel(TIERS[k])} ${t.tiers[k].services}`} />)}
      </div>
      <div className="pfd-statepanel-label">Most dollars above the line</div>
      {rows.map((s) => (
        <button type="button" key={s.id} className="pfd-hbar" onClick={() => openCase(s.id)} title={`${s.codeLabel} (${s.hcpcs}): ${s.statePaidIsWithheld ? WITHHELD : `${money(s.aboveEnrollment)} above the line`} · ${tierShortLabel(s.tier)} · open the case file`}>
          <span className="pfd-hbar-name">{s.codeLabel} <span className="pfd-code">{s.hcpcs}</span></span>
          <span className="pfd-hbar-track">{s.statePaidIsWithheld ? null : <i style={{ width: `${(s.aboveEnrollment / top) * 100}%`, background: TIER_COLORS[s.tier.key] }} />}</span>
          <span className="pfd-hbar-v">{s.statePaidIsWithheld ? 'withheld' : money(s.aboveEnrollment)}</span>
        </button>
      ))}
      <div className="pfd-actions-row">
        <button type="button" className="pfd-btn" onClick={() => openState(state, 'cases')}>Open {STATE_NAMES[state]} case files →</button>
        <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => openState(state, 'realloc')}>Reallocation what-if</button>
        <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => openState(state, 'blowups')}>Program blow-ups</button>
      </div>
    </div>
  );
}
