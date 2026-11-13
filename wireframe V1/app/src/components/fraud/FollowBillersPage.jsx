import { useMemo } from 'react';
import { GROUP_RULE } from '../../lib/fraud/oversightProgram.js';
import { money, multiple, count } from './fraudFormat.jsx';
import { Legend, Swatch, shortMoney } from './fraudVisuals.jsx';
import {
  CardHead, KeyValue, MiniBars, OversightPicker, Pill, Tile, YearBars, chooseStateCode, countOrWithheld, latestServiceYearId,
  moneyOrWithheld, signedPct, stateName, wholePct,
} from './oversightShared.jsx';

/**
 * Follow the billers: a code can be shut down; the billers remain. For one flagged state and
 * service, a played-out group of billers (the billers of a surging or tripling service in a
 * year) across every service they bill, the code's national payments split by state, and the
 * state's own latest group as a watch list. Counts and dollars only; no biller is listed.
 */

const SERVICE_TILES = 6;
const WATCH_ROWS = 8;
const GROUP_COLORS = Object.freeze({ code: '#ff6b6b', other: '#5db4ff', state: '#f5a04e', otherState: '#ff6b6b', rest: '#3a4f72' });

function pathText(path, key, min) {
  return path.map((p) => (key === 'paid' ? moneyOrWithheld(p.paid, 0) : countOrWithheld(p.billing, min))).join(' → ');
}
function pathYears(path) {
  return path.map((p) => p.year).join(' → ');
}
/** The tag tone for a fall from the peak: steep red, partial amber. */
function fallTone(v) {
  if (v === null) return 'gry';
  if (v <= -0.75) return 'red';
  if (v <= -0.25) return 'amb';
  return 'gry';
}
/** The tag tone for a multiple since the comparison year. */
function growthTone(v) {
  if (v === null) return 'gry';
  if (v >= 3) return 'red';
  if (v >= 1.4) return 'amb';
  return 'gry';
}

export function FollowBillersPage({ review, oversight: o, byId, focusState, setFocusState, focusId, setFocusId }) {
  const keys = useMemo(() => Object.keys(o.GroupsByStateCode), [o]);
  const states = useMemo(() => [...new Set(keys.map((k) => k.split('|')[0]))].sort((a, b) => stateName(a).localeCompare(stateName(b))), [keys]);
  const k = chooseStateCode({ keys, oversight: o, byId, focusState, focusId });
  const options = useMemo(() => keys.filter((x) => x.startsWith(`${focusState}|`)).map((x) => {
    const entry = o.GroupsByStateCode[x];
    const g = o.BillerGroups[entry.shown || entry.watch];
    const parts = [entry.shown ? (entry.shownIsOtherState ? `played out in ${o.BillerGroups[entry.shown].state}` : `played out ${o.BillerGroups[entry.shown].year}`) : '', entry.watch ? `watch list ${o.BillerGroups[entry.watch].year}` : ''].filter(Boolean);
    return { key: x, text: `${g.codeLabel} (${g.hcpcs}) · ${parts.join(' · ')}` };
  }).sort((a, b) => a.text.localeCompare(b.text)), [keys, focusState, o]);
  const entry = k ? o.GroupsByStateCode[k] : null;
  const shown = entry?.shown ? o.BillerGroups[entry.shown] : null;
  const watch = entry?.watch ? o.BillerGroups[entry.watch] : null;
  const head = shown ?? watch;
  const at = (g, y) => g.years.find((r) => r.year === y);

  return (
    <div className="pfd-page" data-oversight-page="follow">
      <h1>Follow the billers · where a billing group goes next</h1>
      <p className="pfd-sub">
        A code can be shut down; the billers remain. This page follows a <b>group of billers</b> (the billers of a surging or tripling service in a year)
        across every service they bill, as counts and dollars only.
        {shown ? <> The {count(shown.members)} {stateName(shown.state)} billers of {shown.codeLabel.toLowerCase()} in {shown.year} were paid <b>{moneyOrWithheld(at(shown, shown.year)?.membersPaid)}</b> for all services that year.</> : null}
        {shown && entry.shownIsOtherState ? <> {stateName(focusState)} has no played-out group of its own for this code, so the group shown is the same code&apos;s in {stateName(shown.state)}.</> : null}
      </p>
      <OversightPicker
        oversight={o}
        states={states}
        focusState={focusState}
        onState={(st) => { setFocusState(st); setFocusId(null); }}
        options={options}
        selected={k}
        onSelect={(x) => setFocusId(latestServiceYearId(o, x))}
      />
      {head ? (
        <div className="pfd-row">
          <div className="pfd-grow pfo-col">
            {shown ? <PlayedOutGroup g={shown} min={o.SmallCellMinimum} /> : (
              <div className="pfd-card"><p>No played-out group for {head.codeLabel} ({head.hcpcs}) is on file in any state: a group needs {GROUP_RULE.playedOutYears} later years on file to show where it went.</p></div>
            )}
            {o.NationalCodeYears[`${head.state}|${head.hcpcs}`] ? <NationalCode n={o.NationalCodeYears[`${head.state}|${head.hcpcs}`]} label={head.codeLabel} /> : null}
          </div>
          <div className="pfd-col-right pfo-col-wide">
            {watch ? <WatchList g={watch} latest={review.LatestYear} min={o.SmallCellMinimum} /> : (
              <div className="pfd-card" data-watch-list>
                <CardHead title={`${stateName(focusState)} group · watch list`} />
                <p className="pfd-note">{stateName(focusState)} has no group for {head.codeLabel} in {review.LatestYear}: the screen did not flag the code as surging or tripling there that year.</p>
              </div>
            )}
            <div className="pfd-card" data-group-kinds>
              <CardHead title="Groups you can follow" note="proposal" />
              <KeyValue k="Billers of a flagged service in a year it surged or tripled"><Pill tone="grn">shown here</Pill></KeyValue>
              <KeyValue k="Billers first paid in the same quarter"><Pill>next</Pill></KeyValue>
              <KeyValue k="Billers of a service a state has limited or closed"><Pill>next</Pill></KeyValue>
            </div>
          </div>
        </div>
      ) : (
        <div className="pfd-card"><p>{stateName(focusState)} has no flagged service with a group of billers on file.</p></div>
      )}
    </div>
  );
}

function PlayedOutGroup({ g, min }) {
  const tiles = g.services.slice(0, SERVICE_TILES);
  const years = g.years.map((r) => r.year);
  return (
    <div className="pfd-card" data-group={g.id}>
      <CardHead title={`${stateName(g.state)} group · the ${count(g.members)} billers of ${g.codeLabel.toLowerCase()} in ${g.year} · paid per year`} note="real figures" />
      <div className="pfo-svc-grid">
        {tiles.map((s) => (
          <div key={s.hcpcs} className="pfo-tile pfo-svc" data-group-service={s.hcpcs}>
            <div className="pfo-svc-head">
              <b>{s.codeLabel} <span className="pfd-code">{s.hcpcs}</span></b>
              <Pill tone={fallTone(s.paidChangeFromPeak)} title={`Paid in ${g.latestYear} against its peak year`}>{s.paidChangeFromPeak !== null && s.paidChangeFromPeak > -0.005 ? `at peak ${g.latestYear}` : signedPct(s.paidChangeFromPeak)}</Pill>
            </div>
            <YearBars
              rows={years.map((y) => ({ year: y, value: s.byYear.find((r) => r.year === y)?.paid ?? null }))}
              colorOf={() => (s.isGroupCode ? GROUP_COLORS.code : GROUP_COLORS.other)}
              label={`${s.codeLabel}: paid to the group per year`}
            />
          </div>
        ))}
      </div>
      <div className="pfo-grid2 pfo-gap">
        <Tile path data="group-paid-path" n={pathText(g.paidPath, 'paid')} label={`the group's payments for all services, ${pathYears(g.paidPath)}`} />
        <Tile path data="group-billing-path" n={pathText(g.billingPath, 'billing', min)} label={`of the group still billing, ${pathYears(g.billingPath)}`} />
      </div>
      <p className="pfd-note">
        The tag on each service is {g.latestYear} against its peak year. Services that rose and fell on the same curve as {g.codeLabel.toLowerCase()} are
        the shape to look for in other states; watching one code alone misses them. Shown: the group&apos;s own code and the {SERVICE_TILES - 1} other services it was paid most for.
      </p>
    </div>
  );
}

function NationalCode({ n, label }) {
  const total = Math.max(...n.years.map((y) => y.national), 1);
  const W = 520;
  const H = 170;
  const bottom = H - 18;
  const step = W / Math.max(1, n.years.length);
  const bw = step * 0.62;
  const h = (v) => (v / total) * (bottom - 18);
  return (
    <div className="pfd-card" data-national-code={n.hcpcs}>
      <CardHead title={`${label}, whole country · paid per year`} note="real figures" />
      <div className="pfo-national">
        <svg className="pfo-chart pfo-national-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: national paid per year by state`}>
          {n.years.map((y, i) => {
            const x = i * step + (step - bw) / 2;
            const rest = h(y.restPaid);
            const state = h(y.statePaid);
            const other = h(y.otherPaid);
            return (
              <g key={y.year}>
                <rect x={x} y={bottom - rest} width={bw} height={rest} fill={GROUP_COLORS.rest} />
                <rect x={x} y={bottom - rest - state} width={bw} height={state} fill={GROUP_COLORS.state} />
                <rect x={x} y={bottom - rest - state - other} width={bw} height={other} fill={GROUP_COLORS.otherState} />
                <text x={x + bw / 2} y={bottom - h(y.national) - 4} textAnchor="middle" fontSize="10" fill="#dbe6f5">{shortMoney(y.national)}</text>
                <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize="10.5" fill="#b5c5db">{y.year}</text>
              </g>
            );
          })}
        </svg>
        <div>
          <Legend>
            <Swatch color={GROUP_COLORS.state} label={stateName(n.state)} />
            {n.other ? <Swatch color={GROUP_COLORS.otherState} label={stateName(n.other)} /> : null}
            <Swatch color={GROUP_COLORS.rest} label="all other states" />
          </Legend>
          <p className="pfd-note">
            {n.other ? `${stateName(n.other)} is the other state paid the most for the code in the latest year.` : 'No other state leads the code.'} Watch the total against the leading state: a total
            that holds while the leading state changes is the shape of billing that moved.
          </p>
        </div>
      </div>
    </div>
  );
}

function WatchList({ g, latest, min }) {
  const own = g.years.find((r) => r.year === g.year);
  const codePaid = own?.membersCodePaid ?? null;
  const allPaid = own?.membersPaid ?? null;
  const others = g.services.filter((s) => !s.isGroupCode)
    .sort((a, b) => (b.paidMultipleSinceComparison ?? -1) - (a.paidMultipleSinceComparison ?? -1) || b.peakPaid - a.peakPaid)
    .slice(0, WATCH_ROWS);
  const years = g.years.map((r) => r.year);
  return (
    <div className="pfd-card" data-watch-list={g.id}>
      <CardHead title={`${stateName(g.state)} group · watch list`} note="real figures" />
      <p className="pfo-lead">
        The {count(g.members)} {stateName(g.state)} billers of {g.codeLabel.toLowerCase()} in {g.year}.
        {codePaid !== null && allPaid ? <> {g.codeLabel} was <b>{wholePct(codePaid / allPaid)}</b> of the {money(allPaid)} they were paid for all services.</> : null}
        {' '}These are the other services the group already bills.
      </p>
      <div className="pfd-table-wrap">
        <table className="pfd-table pfo-compact">
          <thead><tr><th>Other service they bill</th><th>{years[0]}–{String(years[years.length - 1]).slice(2)}</th><th className="r">{g.comparisonYear}</th><th className="r">{g.latestYear}</th><th className="r">Change</th></tr></thead>
          <tbody>
            {others.map((s) => (
              <tr key={s.hcpcs} data-watch-service={s.hcpcs}>
                <td>{s.codeLabel} <span className="pfd-code">{s.hcpcs}</span></td>
                <td><MiniBars width={56} values={years.map((y) => s.byYear.find((r) => r.year === y)?.paid ?? null)} label={`${s.codeLabel} paid per year`} /></td>
                <td className="r">{moneyOrWithheld(s.anchorPaid)}</td>
                <td className="r">{moneyOrWithheld(s.latestPaid)}</td>
                <td className="r"><Pill tone={growthTone(s.paidMultipleSinceComparison)}>{s.paidMultipleSinceComparison === null ? '—' : multiple(s.paidMultipleSinceComparison)}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pfo-grid2 pfo-gap">
        <Tile path data="watch-paid-path" n={pathText(g.paidPath, 'paid')} label={`the group's payments for all services, ${pathYears(g.paidPath)}`} />
        <Tile path data="watch-billing-path" n={pathText(g.billingPath, 'billing', min)} label={`of the group billing Medicaid, ${pathYears(g.billingPath)}`} />
      </div>
      <p className="pfd-note">Public data ends December {latest}. Where this group&apos;s billing goes next is visible only in the state&apos;s own claims.</p>
    </div>
  );
}
