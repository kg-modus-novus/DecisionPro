import { useMemo, useState } from 'react';
import { LeveledDollarReallocation, LEVELING_LINES } from '../../lib/fraud/leveledDollarReallocationProgram.js';
import { FEDERAL_MATCHING_RATE_FY2024, FMAP_SOURCE } from '../../data/federalMatchingRate.js';
import { DOCUMENTED_NEEDS, STATE_NAMES } from '../../data/potentialFraudCatalog.js';
import { money, pct, count, downloadText } from './fraudFormat.jsx';

/** Reallocation what-if: if the flagged dollars are fraud, where could they go? */

const NO_NEEDS = Object.freeze([]);

export function ReallocationPage({ radar, review, focusState, setFocusState }) {
  const year = radar.latestYear;
  const services = useMemo(() => review.ServiceYears.filter((s) => s.state === focusState && s.year === year), [review, focusState, year]);
  const needs = DOCUMENTED_NEEDS[focusState] ?? NO_NEEDS;
  const [line, setLine] = useState('enrollment');
  const [scope, setScope] = useState('all');
  const [upheld, setUpheld] = useState(60);
  const [destination, setDestination] = useState('medicaid');
  const [allocations, setAllocations] = useState(() => Object.fromEntries(needs.map((n) => [n.id, n.defaultAllocation])));
  const [saved, setSaved] = useState([]);
  const [lastState, setLastState] = useState(focusState);
  if (lastState !== focusState) {
    setLastState(focusState);
    setScope('all');
    setAllocations(Object.fromEntries(needs.map((n) => [n.id, n.defaultAllocation])));
  }

  const enrollmentShareByState = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(radar.enrollmentShare)) {
      const [st, y] = k.split('|');
      if (Number(y) === year) out[st] = v;
    }
    return out;
  }, [radar, year]);

  const model = useMemo(() => {
    const m = new LeveledDollarReallocation();
    m.State = focusState;
    m.Services = services;
    m.LatestYearStatePaid = radar.latestYearStatePaid;
    m.EnrollmentShareByState = enrollmentShareByState;
    m.Line = line;
    m.Scope = scope;
    m.UpheldSharePct = upheld;
    m.FederalMatchingRate = FEDERAL_MATCHING_RATE_FY2024[focusState] ?? 0;
    m.Destination = destination;
    m.Needs = needs;
    m.Allocations = allocations;
    m.ModelLeveledDollarReallocation();
    return m;
  }, [focusState, services, radar, enrollmentShareByState, line, scope, upheld, destination, needs, allocations]);

  const highCount = services.filter((s) => s.tier.key === 'high').length;
  const topService = [...services].sort((a, b) => b.score - a.score)[0];
  const fmap = FEDERAL_MATCHING_RATE_FY2024[focusState];
  const sources = model.SourcesOfFreedDollars;
  const otherAbove = sources.slice(3).reduce((a, s) => a + s.above, 0);

  function fitToAvailable() {
    setAllocations({ ...model.AllocationsFittedToAvailable });
  }

  function scenarioText() {
    return [
      `Reallocation what-if · ${STATE_NAMES[focusState]} · ${year}`,
      `Line: ${LEVELING_LINES.find((l) => l.key === line).label} · scope: ${scope} · upheld: ${upheld}% · destination: ${destination === 'medicaid' ? 'kept inside Medicaid' : 'returned to the General Fund'}`,
      `Paid on services in scope: ${money(model.StatePaidInScope)} · above the line: ${money(model.DollarsAboveLine)} · freed at ${upheld}%: ${money(model.UpheldDollars)} (federal ${money(model.FederalShare)}, state ${money(model.StateShare)})`,
      `Available: ${money(model.AvailableDollars)} · allocated: ${money(model.AllocatedDollars)} · unallocated: ${money(model.UnallocatedDollars)}`,
      ...model.NeedOutcomes.map((n) => `- ${n.label}: ${money(n.allocated)} of an illustrative ${money(n.gap)} gap${n.unitCost ? ` · about ${count(n.peopleReached)} ${n.unitLabel}` : ''}`),
      'A planning model, not a recovery. Gaps, unit costs and people reached are illustrative until each owner confirms them.',
    ].join('\n');
  }

  return (
    <div className="pfd-page">
      <div className="pfd-head-row">
        <h1>Reallocation what-if · if the flagged dollars are fraud, where could they go?</h1>
        <label className="pfd-inline">State <select value={focusState} onChange={(e) => setFocusState(e.target.value)}>{Object.entries(STATE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <p className="pfd-sub">
        Level {STATE_NAMES[focusState]}&apos;s flagged services to a chosen line, see how much that frees, split it by who paid it, and pair it with documented needs.
        A planning model, not a recovery: nothing moves until a case is upheld.
      </p>
      {model.Errors.length ? <p className="pfd-error">{model.Errors.join(' ')}</p> : null}
      <div className="pfd-row">
        <div className="pfd-col-left">
          <div className="pfd-card">
            <h3>1 · Choose the leveling line</h3>
            <div className="pfd-chips" role="radiogroup" aria-label="Leveling line">
              {LEVELING_LINES.map((l) => (
                <button key={l.key} type="button" role="radio" aria-checked={line === l.key} className={`pfd-chip${line === l.key ? ' is-on' : ''}`} onClick={() => setLine(l.key)}>
                  {l.label}{l.key === 'enrollment' && enrollmentShareByState[focusState] ? ` (${pct(enrollmentShareByState[focusState], 1)} of US)` : ''}
                </button>
              ))}
            </div>
            <div className="pfd-chips" role="radiogroup" aria-label="Services in scope">
              <button type="button" role="radio" aria-checked={scope === 'all'} className={`pfd-chip${scope === 'all' ? ' is-on' : ''}`} onClick={() => setScope('all')}>All {services.length} flagged services</button>
              <button type="button" role="radio" aria-checked={scope === 'high'} className={`pfd-chip${scope === 'high' ? ' is-on' : ''}`} onClick={() => setScope('high')}>Suggested HIGH tier only ({highCount})</button>
              {topService ? <button type="button" role="radio" aria-checked={scope === `service:${topService.hcpcs}`} className={`pfd-chip${scope === `service:${topService.hcpcs}` ? ' is-on' : ''}`} onClick={() => setScope(`service:${topService.hcpcs}`)}>{topService.codeLabel} only</button> : null}
            </div>
            <label className="pfd-note" htmlFor="pfd-upheld">Share of the above-line amount assumed upheld: <b>{upheld}%</b></label>
            <input id="pfd-upheld" type="range" min="0" max="100" step="5" value={upheld} onChange={(e) => setUpheld(Number(e.target.value))} className="pfd-range" />
            {line === 'peer-state' ? <p className="pfd-note">Peer-state line: what {focusState} would be paid at the median ratio of share to enrollment share among the other states billing the code in {year}.{model.ServicesWithoutPeerLine ? ` ${model.ServicesWithoutPeerLine} services have no peer state and free nothing.` : ''}</p> : null}
          </div>
          <div className="pfd-card">
            <h3>2 · What it frees</h3>
            <table className="pfd-table pfd-compact">
              <tbody>
                <tr><td>Paid on {model.ServicesInScope.length} services in scope, {year}</td><td className="r">{money(model.StatePaidInScope)}</td></tr>
                <tr><td>Above the {LEVELING_LINES.find((l) => l.key === line).label.toLowerCase()} line</td><td className="r">{money(model.DollarsAboveLine)}</td></tr>
                <tr><td>At {upheld}% upheld</td><td className="r"><b className="pfd-big">{money(model.UpheldDollars)}</b></td></tr>
                <tr><td>&nbsp;&nbsp;Federal share (FMAP {fmap ? pct(fmap, 2) : '—'})</td><td className="r">{money(model.FederalShare)}</td></tr>
                <tr><td>&nbsp;&nbsp;State share</td><td className="r">{money(model.StateShare)}</td></tr>
              </tbody>
            </table>
            <div className="pfd-chips pfd-chips-stack" role="radiogroup" aria-label="Where the freed dollars go">
              <button type="button" role="radio" aria-checked={destination === 'medicaid'} className={`pfd-chip${destination === 'medicaid' ? ' is-on' : ''}`} onClick={() => setDestination('medicaid')}>Keep inside Medicaid · federal match preserved · {money(model.UpheldDollars)} available</button>
              <button type="button" role="radio" aria-checked={destination === 'general-fund'} className={`pfd-chip${destination === 'general-fund' ? ' is-on' : ''}`} onClick={() => setDestination('general-fund')}>Return to the General Fund · state share only · {money(model.StateShare)}</button>
            </div>
            <p className="pfd-note">{FMAP_SOURCE}. Regular FMAP; expansion-group spending carries a 90% match, so the state share is an upper bound there.</p>
          </div>
          <div className="pfd-card">
            <h3>Where it came from</h3>
            <table className="pfd-table pfd-compact">
              <tbody>
                {sources.slice(0, 3).map((s) => <tr key={s.hcpcs}><td>{s.codeLabel} ({s.hcpcs})</td><td className="r">{money(s.above)}</td></tr>)}
                {sources.length > 3 ? <tr><td>{sources.length - 3} other services</td><td className="r">{money(otherAbove)}</td></tr> : null}
                {sources.length === 0 ? <tr><td colSpan={2}>Nothing above this line in scope.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="pfd-card pfd-grow">
          <h3>3 · Pair it with documented needs</h3>
          {needs.length === 0 ? (
            <p>No documented needs are loaded for {STATE_NAMES[focusState]}. The freed amount above is still available to plan against; needs with an owner and a cost come from the access, quality and funding goals as each state is set up.</p>
          ) : (
            <>
              {model.NeedOutcomes.map((n) => (
                <div className="pfd-alloc" key={n.id}>
                  <label className="pfd-alloc-name" htmlFor={`pfd-need-${n.id}`}>{n.label}<small>{n.owner}</small></label>
                  <input id={`pfd-need-${n.id}`} type="range" min="0" max={n.gap} step="100000" value={allocations[n.id] ?? 0} onChange={(e) => setAllocations({ ...allocations, [n.id]: Number(e.target.value) })} className="pfd-range" />
                  <span className="pfd-alloc-v"><b>{money(n.allocated)}</b></span>
                  <span className="pfd-alloc-g">illustrative gap {money(n.gap, 0)}</span>
                </div>
              ))}
              <div className={`pfd-alloc-total${model.AllocationIsOverAvailable ? ' is-over' : ''}`}>
                <span>Allocated <b>{money(model.AllocatedDollars)}</b> of {money(model.AvailableDollars)} · unallocated <b>{money(model.UnallocatedDollars)}</b></span>
                {model.AllocationIsOverAvailable ? <button type="button" className="pfd-btn pfd-btn-ghost" onClick={fitToAvailable}>Over by {money(-model.UnallocatedDollars)} · fit to available</button> : null}
              </div>
              <p className="pfd-note">Needs with an owner from the access, quality and funding goals. Gap figures and unit costs are illustrative until each owner confirms them.</p>
              <div className="pfd-row">
                <div className="pfd-card pfd-inset pfd-grow">
                  <h3>Result · people reached (illustrative)</h3>
                  <table className="pfd-table pfd-compact">
                    <tbody>
                      {model.NeedOutcomes.filter((n) => n.unitCost > 0).map((n) => <tr key={n.id}><td>{n.unitLabel[0].toUpperCase() + n.unitLabel.slice(1)}</td><td className="r">≈ {count(n.peopleReached)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="pfd-card pfd-inset pfd-grow">
                  <h3>Guardrails</h3>
                  <p className="pfd-note pfd-tight">Dollars move only after the fraud control unit or the Medicaid agency upholds a case and recovery or suspension is final. The federal share returns to CMS unless redirected inside Medicaid by state plan or waiver amendment. The national total would itself change; this holds it constant. No savings is claimed.</p>
                </div>
              </div>
            </>
          )}
          <div className="pfd-actions-row">
            <button type="button" className="pfd-btn" onClick={() => setSaved([...saved, { at: new Date().toLocaleTimeString(), line, scope, upheld, destination, freed: model.UpheldDollars, available: model.AvailableDollars, allocated: model.AllocatedDollars }])}>Save scenario</button>
            <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => downloadText(`reallocation-what-if-${focusState}-${year}.txt`, scenarioText())}>Export for the budget review subcommittee</button>
          </div>
          {saved.length ? (
            <>
              <h3 className="pfd-gap">Compare scenarios (this session)</h3>
              <table className="pfd-table pfd-compact">
                <thead><tr><th>Saved</th><th>Line</th><th>Scope</th><th className="r">Upheld</th><th>Destination</th><th className="r">Freed</th><th className="r">Available</th><th className="r">Allocated</th></tr></thead>
                <tbody>{saved.map((x, i) => <tr key={i}><td>{x.at}</td><td>{x.line}</td><td>{x.scope}</td><td className="r">{x.upheld}%</td><td>{x.destination}</td><td className="r">{money(x.freed)}</td><td className="r">{money(x.available)}</td><td className="r">{money(x.allocated)}</td></tr>)}</tbody>
              </table>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
