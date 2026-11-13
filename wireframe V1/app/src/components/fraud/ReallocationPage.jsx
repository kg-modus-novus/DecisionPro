import { useMemo, useState } from 'react';
import { LeveledDollarReallocation, LEVELING_LINES } from '../../lib/fraud/leveledDollarReallocationProgram.js';
import { FEDERAL_MATCHING_RATE_FY2024, FMAP_SOURCE } from '../../data/federalMatchingRate.js';
import { DOCUMENTED_NEEDS, STATE_NAMES } from '../../data/potentialFraudCatalog.js';
import { money, pct, count, downloadText } from './fraudFormat.jsx';

/**
 * Reallocation what-if: if the flagged dollars are fraud, where could they go?
 * A dollar funnel from what was paid to what is available, and need meters that
 * fill as dollars are allocated. Edited gaps and unit costs and added needs are
 * the reviewer's session-only entries: the page stages them as the program's
 * Needs and the program does the arithmetic.
 */

const NO_NEEDS = Object.freeze([]);
const NO_NEED_EDITS = Object.freeze({});
const NO_DRAFT = Object.freeze({ label: '', gap: '', unitCost: '', unitLabel: '' });
/** Each − or + moves a need's allocation by $10M; the program holds it to [0, gap]. */
const ALLOCATION_STEP = 10e6;
const DESTINATIONS = Object.freeze([
  { key: 'medicaid', label: 'Stay in Medicaid' },
  { key: 'general-fund', label: 'To General Fund' },
]);

function defaultAllocations(needs) {
  return Object.fromEntries(needs.map((n) => [n.id, n.defaultAllocation]));
}

/** Reads a gap typed in millions; '' when it is not a positive number. */
export function parseMillions(text) {
  const v = Number(String(text).replace(/[$,\sM]/gi, ''));
  return Number.isFinite(v) && v > 0 ? v * 1e6 : '';
}

/** Reads a unit cost typed in dollars ("75000", "$75K", "1.2M"); blank is 0 (no people-reached estimate); '' when unreadable. */
export function parseDollars(text) {
  const s = String(text).trim();
  if (s === '') return 0;
  const m = /^\$?\s*([\d,]*\.?\d+)\s*([kKmM]?)$/.exec(s);
  if (!m) return '';
  const v = Number(m[1].replace(/,/g, '')) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] ?? 1);
  return Number.isFinite(v) && v >= 0 ? v : '';
}

/** A need's figures as the editor shows them: gap in millions, unit cost in dollars. */
function draftFrom(n) {
  return { label: n.label, gap: String(Math.round(n.gap / 1e5) / 10), unitCost: n.unitCost ? String(n.unitCost) : '', unitLabel: n.unitLabel };
}

function isDraftReadable(d) {
  return d.label.trim() !== '' && parseMillions(d.gap) !== '' && parseDollars(d.unitCost) !== '';
}

function FunnelRow({ label, value, scale, color, strong = false, children }) {
  return (
    <div className={`pfd-fn-row${strong ? ' is-strong' : ''}`} data-funnel={label}>
      <span className="pfd-fn-label">{label}</span>
      <span className="pfd-fn-track">
        {children ?? <i style={{ width: `${(value / scale) * 100}%`, background: color }} />}
      </span>
      <span className="pfd-fn-value">{typeof value === 'number' ? money(value) : value}</span>
    </div>
  );
}

export function ReallocationPage({ radar, review, focusState, setFocusState }) {
  const year = radar.latestYear;
  // The what-if draws only on services whose dollars may be shown: one paid to fewer billers than the small-cell
  // minimum (the signal review's answer) would give its dollars back through the scope totals, so it is left out.
  const yearServices = useMemo(() => review.ServiceYears.filter((s) => s.state === focusState && s.year === year), [review, focusState, year]);
  const services = useMemo(() => yearServices.filter((s) => !s.statePaidIsWithheld), [yearServices]);
  const leftOutServices = yearServices.length - services.length;
  const catalogNeeds = DOCUMENTED_NEEDS[focusState] ?? NO_NEEDS;
  const [line, setLine] = useState('enrollment');
  const [scope, setScope] = useState('all');
  const [upheld, setUpheld] = useState(60);
  const [destination, setDestination] = useState('medicaid');
  const [allocations, setAllocations] = useState(() => defaultAllocations(catalogNeeds));
  const [needEdits, setNeedEdits] = useState(NO_NEED_EDITS);
  const [addedNeeds, setAddedNeeds] = useState(NO_NEEDS);
  const [addedCount, setAddedCount] = useState(0);
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState(NO_DRAFT);
  const [adding, setAdding] = useState(false);
  const [newNeed, setNewNeed] = useState(NO_DRAFT);
  const [saved, setSaved] = useState([]);
  const [lastState, setLastState] = useState(focusState);
  if (lastState !== focusState) {
    setLastState(focusState);
    setScope('all');
    setAllocations(defaultAllocations(catalogNeeds));
    setNeedEdits(NO_NEED_EDITS);
    setAddedNeeds(NO_NEEDS);
    setEditing('');
    setAdding(false);
  }

  // Boundary: the catalog's needs with the reviewer's edits, then the needs the reviewer added.
  const needs = useMemo(() => [
    ...catalogNeeds.map((n) => ({ ...n, ...needEdits[n.id], edited: Boolean(needEdits[n.id]), added: false })),
    ...addedNeeds,
  ], [catalogNeeds, needEdits, addedNeeds]);

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
  const lineLabel = LEVELING_LINES.find((l) => l.key === line).label;
  const scale = Math.max(model.StatePaidInScope, 1);
  const over = model.AllocationIsOverAvailable;
  const scopes = [
    { key: 'all', label: `All ${services.length}` },
    { key: 'high', label: `HIGH only (${highCount})` },
    ...(topService ? [{ key: `service:${topService.hcpcs}`, label: `${topService.codeLabel} only` }] : []),
  ];

  function stepAllocation(n, delta) {
    // The program holds the staged allocation to [0, gap].
    setAllocations({ ...allocations, [n.id]: n.allocated + delta });
  }

  function startEdit(n) {
    setEditing(n.id);
    setDraft(draftFrom(n));
  }

  function saveEdit(n) {
    if (!isDraftReadable({ ...draft, label: n.label })) return;
    const fields = { gap: parseMillions(draft.gap), unitCost: parseDollars(draft.unitCost), unitLabel: draft.unitLabel.trim() || 'units' };
    if (n.added) setAddedNeeds(addedNeeds.map((a) => (a.id === n.id ? { ...a, ...fields } : a)));
    else setNeedEdits({ ...needEdits, [n.id]: fields });
    // Stage the program's held allocation, so a gap raised later does not bring back an older, larger one.
    setAllocations({ ...allocations, [n.id]: n.allocated });
    setEditing('');
  }

  function addNeed() {
    if (!isDraftReadable(newNeed)) return;
    const id = `added-${addedCount + 1}`;
    setAddedCount(addedCount + 1);
    setAddedNeeds([...addedNeeds, { id, label: newNeed.label.trim(), owner: 'Added this session', gap: parseMillions(newNeed.gap), unitCost: parseDollars(newNeed.unitCost), unitLabel: newNeed.unitLabel.trim() || 'units', edited: false, added: true }]);
    setAllocations({ ...allocations, [id]: 0 });
    setNewNeed(NO_DRAFT);
    setAdding(false);
  }

  function removeNeed(n) {
    setAddedNeeds(addedNeeds.filter((a) => a.id !== n.id));
  }

  function fitToAvailable() {
    setAllocations({ ...allocations, ...model.AllocationsFittedToAvailable });
  }

  function scenarioText() {
    return [
      `Reallocation what-if · ${STATE_NAMES[focusState]} · ${year}`,
      `Line: ${lineLabel} · scope: ${scope} · upheld: ${upheld}% · destination: ${destination === 'medicaid' ? 'kept inside Medicaid' : 'returned to the General Fund'}`,
      `Above each line in scope: ${LEVELING_LINES.map((l) => `${l.label} ${money(model.DollarsAboveEachLine[l.key])}`).join(' · ')}`,
      `Paid on services in scope: ${money(model.StatePaidInScope)} · above the line: ${money(model.DollarsAboveLine)} · freed at ${upheld}%: ${money(model.UpheldDollars)} (federal ${money(model.FederalShare)}, state ${money(model.StateShare)})`,
      `Available: ${money(model.AvailableDollars)} · allocated: ${money(model.AllocatedDollars)} · unallocated: ${money(model.UnallocatedDollars)}`,
      ...model.NeedOutcomes.map((n) => `- ${n.label}${n.added ? ' (added this session)' : ''}: ${money(n.allocated)} of an illustrative ${money(n.gap)} gap${n.edited ? ' (edited this session)' : ''}${n.unitCost ? ` · about ${count(n.peopleReached)} ${n.unitLabel}` : ''}`),
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
        Level {STATE_NAMES[focusState]}&apos;s flagged {year} services to a line, see how much that frees and who paid it, and pair it with documented needs.
        A planning model, not a recovery: nothing moves until a case is upheld.
      </p>
      {model.Errors.length ? <p className="pfd-error">{model.Errors.join(' ')}</p> : null}

      <div className="pfd-card pfd-rl-controls">
        <div>
          <div className="pfd-rl-cap">Level to</div>
          <span className="pfd-seg" role="radiogroup" aria-label="Leveling line">
            {LEVELING_LINES.map((l) => (
              <button key={l.key} type="button" role="radio" aria-checked={line === l.key} data-line={l.key} className={line === l.key ? 'is-on' : ''} onClick={() => setLine(l.key)}>
                {l.label} <b>{money(model.DollarsAboveEachLine[l.key])}</b>
              </button>
            ))}
          </span>
        </div>
        <div>
          <div className="pfd-rl-cap">Services</div>
          <span className="pfd-seg" role="radiogroup" aria-label="Services in scope">
            {scopes.map((s) => (
              <button key={s.key} type="button" role="radio" aria-checked={scope === s.key} data-scope={s.key} className={scope === s.key ? 'is-on' : ''} onClick={() => setScope(s.key)}>{s.label}</button>
            ))}
          </span>
        </div>
        <div className="pfd-rl-upheld">
          <label className="pfd-rl-cap" htmlFor="pfd-upheld">Assume upheld on review: <b>{upheld}%</b></label>
          <input id="pfd-upheld" type="range" min="0" max="100" step="5" value={upheld} onChange={(e) => setUpheld(Number(e.target.value))} className="pfd-rl-range" />
        </div>
        <div>
          <div className="pfd-rl-cap">Money goes</div>
          <span className="pfd-seg" role="radiogroup" aria-label="Where the freed dollars go">
            {DESTINATIONS.map((d) => (
              <button key={d.key} type="button" role="radio" aria-checked={destination === d.key} data-destination={d.key} className={destination === d.key ? 'is-on' : ''} onClick={() => setDestination(d.key)}>{d.label}</button>
            ))}
          </span>
        </div>
      </div>

      <div className="pfd-card">
        <h3>What it frees · {STATE_NAMES[focusState]} {year}</h3>
        <div className="pfd-funnel">
          <FunnelRow label={`Paid on ${model.ServicesInScope.length} flagged services`} value={model.StatePaidInScope} scale={scale} color="#B4B2A9" />
          <FunnelRow label={`Above the ${lineLabel.toLowerCase()} line`} value={model.DollarsAboveLine} scale={scale} color="#F0997B" />
          <FunnelRow label={`Upheld at ${upheld}%`} value={model.UpheldDollars} scale={scale} color="#E24B4A" />
          <FunnelRow label="Who paid it" value={<small>fed {money(model.FederalShare)}<br />state {money(model.StateShare)}</small>} scale={scale}>
            <i style={{ width: `${(model.FederalShare / scale) * 100}%`, background: '#85B7EB' }} title={`Federal share ${money(model.FederalShare)} at FMAP ${fmap ? pct(fmap, 2) : '—'}`} />
            <i style={{ width: `${(model.StateShare / scale) * 100}%`, background: '#185FA5' }} title={`State share ${money(model.StateShare)}`} />
          </FunnelRow>
          <FunnelRow label="Available to plan" value={model.AvailableDollars} scale={scale} color="#1D9E75" strong />
          <p className="pfd-fn-note">
            {destination === 'medicaid'
              ? 'Kept in Medicaid, the federal match is drawn again, so all of it is available.'
              : 'Returned to the General Fund, only the state share comes back.'}
          </p>
        </div>
        <p className="pfd-note">
          Where it came from: {sources.length === 0 ? 'nothing above this line in scope.' : (
            <>
              {sources.slice(0, 3).map((s, i) => <span key={s.hcpcs}>{i ? ' · ' : ''}{s.codeLabel} ({s.hcpcs}) <b>{money(s.above)}</b></span>)}
              {sources.length > 3 ? <span> · {sources.length - 3} other services <b>{money(otherAbove)}</b></span> : null}
              {leftOutServices > 0 ? <span className="pfd-note" data-left-out> · {leftOutServices} service{leftOutServices === 1 ? '' : 's'} paid to fewer than {review.SmallCellMinimum} billers {leftOutServices === 1 ? 'is' : 'are'} left out</span> : null}
            </>
          )}
        </p>
        {line === 'peer-state' ? <p className="pfd-note">Peer-state line: what {focusState} would be paid at the median ratio of share to enrollment share among the other states billing the code in {year}.{model.ServicesWithoutPeerLine ? ` ${model.ServicesWithoutPeerLine} services have no peer state and free nothing.` : ''}</p> : null}
      </div>

      <div className="pfd-card">
        <div className="pfd-rl-needs-head">
          <h3>Documented needs <small>illustrative gaps and unit costs · click a gap to edit</small></h3>
          <span className={`pfd-rl-alloc${over ? ' is-over' : ''}`} data-allocated>
            Allocated <b>{money(model.AllocatedDollars)}</b> of {money(model.AvailableDollars)}{over ? ` · over by ${money(-model.UnallocatedDollars)}` : ` · ${money(model.UnallocatedDollars)} unallocated`}
          </span>
        </div>
        <div className="pfd-rl-gauge"><i className={over ? 'is-over' : ''} style={{ width: `${Math.min(100, (model.AllocatedDollars / Math.max(model.AvailableDollars, 1)) * 100)}%` }} /></div>
        {model.NeedOutcomes.length === 0 ? (
          <p className="pfd-note">No documented needs are loaded for {STATE_NAMES[focusState]}. Add one to plan against the freed amount; needs with an owner and a cost come from the access, quality and funding goals as each state is set up.</p>
        ) : model.NeedOutcomes.map((n) => (
          <div className="pfd-rl-need" key={n.id} data-need={n.id}>
            <div>
              <div className="pfd-rl-need-top">
                <span>{n.label} <small>{n.owner}{n.edited ? ' · edited this session' : ''}</small></span>
                <span className="pfd-rl-need-fig">
                  <b>{money(n.allocated)}</b> of{' '}
                  <button type="button" className="pfd-rl-gap" data-gap={n.id} aria-expanded={editing === n.id} onClick={() => startEdit(n)} title="Edit this need's gap and unit cost (this session only)">{money(n.gap)} gap</button>
                  {n.unitCost > 0 ? <> · ≈ {count(n.peopleReached)} {n.unitLabel}</> : null}
                </span>
              </div>
              <div className="pfd-rl-meter"><i style={{ width: `${(n.allocated / n.gap) * 100}%` }} /></div>
              {editing === n.id ? (
                <div className="pfd-rl-add" data-need-editor={n.id}>
                  <label>Gap, $M <input aria-label={`Gap for ${n.label}, in millions`} autoFocus value={draft.gap} onChange={(e) => setDraft({ ...draft, gap: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(n); if (e.key === 'Escape') setEditing(''); }} /></label>
                  <label>Cost per unit, $ <input aria-label={`Cost per unit for ${n.label}`} placeholder="blank: no estimate" value={draft.unitCost} onChange={(e) => setDraft({ ...draft, unitCost: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(n); if (e.key === 'Escape') setEditing(''); }} /></label>
                  <label>A unit is <input aria-label={`What a unit is for ${n.label}`} value={draft.unitLabel} onChange={(e) => setDraft({ ...draft, unitLabel: e.target.value })} /></label>
                  <button type="button" className="pfd-btn" disabled={!isDraftReadable({ ...draft, label: n.label })} onClick={() => saveEdit(n)}>Save</button>
                  <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => setEditing('')}>Cancel</button>
                </div>
              ) : null}
            </div>
            <div className="pfd-rl-steps">
              <button type="button" aria-label={`Less for ${n.label}`} data-step={`${n.id}:-`} disabled={n.allocated <= 0} onClick={() => stepAllocation(n, -ALLOCATION_STEP)}>−</button>
              <button type="button" aria-label={`More for ${n.label}`} data-step={`${n.id}:+`} disabled={n.allocated >= n.gap} onClick={() => stepAllocation(n, ALLOCATION_STEP)}>+</button>
              {n.added ? <button type="button" aria-label={`Remove ${n.label}`} onClick={() => removeNeed(n)}>✕</button> : null}
            </div>
          </div>
        ))}
        {adding ? (
          <div className="pfd-rl-add">
            <input aria-label="New need" placeholder="Need (e.g. dental access, rural counties)" value={newNeed.label} onChange={(e) => setNewNeed({ ...newNeed, label: e.target.value })} />
            <input aria-label="New need gap, in millions" placeholder="Gap, $M" value={newNeed.gap} onChange={(e) => setNewNeed({ ...newNeed, gap: e.target.value })} />
            <input aria-label="New need cost per unit" placeholder="Cost per unit, $ (optional)" value={newNeed.unitCost} onChange={(e) => setNewNeed({ ...newNeed, unitCost: e.target.value })} />
            <input aria-label="New need unit" placeholder="A unit is (e.g. clinics)" value={newNeed.unitLabel} onChange={(e) => setNewNeed({ ...newNeed, unitLabel: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') addNeed(); }} />
            <button type="button" className="pfd-btn" disabled={!isDraftReadable(newNeed)} onClick={addNeed}>Add</button>
            <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => { setAdding(false); setNewNeed(NO_DRAFT); }}>Cancel</button>
          </div>
        ) : null}
        <div className="pfd-actions-row">
          <button type="button" className="pfd-btn" disabled={!over} onClick={fitToAvailable}>Fit to available</button>
          <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => setAdding(true)}>+ Add a need</button>
          <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => setSaved([...saved, { at: new Date().toLocaleTimeString(), line, scope, upheld, destination, freed: model.UpheldDollars, available: model.AvailableDollars, allocated: model.AllocatedDollars }])}>Save scenario</button>
          <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => downloadText(`reallocation-what-if-${focusState}-${year}.txt`, scenarioText())}>Export for subcommittee</button>
        </div>
        <p className="pfd-note">
          A planning model, not a recovery: nothing moves until a case is upheld. FY2024 FMAP {fmap ? pct(fmap, 2) : '—'} ({FMAP_SOURCE}; regular FMAP, so the state share is an upper bound for expansion-group spending at a 90% match).
          Gaps, unit costs and people reached are illustrative until each owner confirms them; edits and added needs last only this session.
          Guardrails: dollars move only after the fraud control unit or the Medicaid agency upholds a case and recovery or suspension is final; the federal share returns to CMS unless redirected inside Medicaid by state plan or waiver amendment; the national total would itself change, and this holds it constant. No savings is claimed.
        </p>
        {saved.length ? (
          <>
            <h3 className="pfd-gap-top">Compare scenarios (this session)</h3>
            <table className="pfd-table pfd-compact">
              <thead><tr><th>Saved</th><th>Line</th><th>Scope</th><th className="r">Upheld</th><th>Destination</th><th className="r">Freed</th><th className="r">Available</th><th className="r">Allocated</th></tr></thead>
              <tbody>{saved.map((x, i) => <tr key={i}><td>{x.at}</td><td>{x.line}</td><td>{x.scope}</td><td className="r">{x.upheld}%</td><td>{x.destination}</td><td className="r">{money(x.freed)}</td><td className="r">{money(x.available)}</td><td className="r">{money(x.allocated)}</td></tr>)}</tbody>
            </table>
          </>
        ) : null}
      </div>
    </div>
  );
}
