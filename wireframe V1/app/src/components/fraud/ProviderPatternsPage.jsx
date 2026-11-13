import { useMemo } from 'react';
import { COMPARABLE_PROFILE, HIGH_SIGN_RANK } from '../../lib/fraud/oversightProgram.js';
import { money, count, BillingCode } from './fraudFormat.jsx';
import { Legend, Swatch, shortMoney } from './fraudVisuals.jsx';
import {
  CardHead, OversightPicker, Pill, Tile, ViewToggle, chooseStateCode, countOrWithheld, fewerThan, latestServiceYearId, moneyOrWithheld, stateName, wholePct,
} from './oversightShared.jsx';

/**
 * Provider patterns: are the billers of a flagged service established, or did many appear
 * recently and live off this one code? Counts and dollars of billers by the year they first
 * billed the code, the three newcomer signs ranked against comparable state services, other
 * patterns and practice areas. No biller is named; the authorized provider list is not built.
 */

const COLORS = Object.freeze({ depends: '#ff6b6b', other: '#5db4ff', withheld: '#33496b' });
/** The pill tone of a sign's rank: red when the program finds it high, amber in the top quarter. */
function rankTone(sign) {
  if (sign.signIsHigh) return 'red';
  if (sign.rankAmongComparable >= 0.75) return 'amb';
  return 'gry';
}
function cityName(c) {
  return c === 'all other areas' ? c : c.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

export function ProviderPatternsPage({ oversight: o, byId, focusState, setFocusState, focusId, setFocusId, setPage }) {
  const keys = useMemo(() => Object.keys(o.BillerProfiles), [o]);
  const states = useMemo(() => [...new Set(keys.map((k) => k.split('|')[0]))].sort((a, b) => stateName(a).localeCompare(stateName(b))), [keys]);
  const k = chooseStateCode({ keys, oversight: o, byId, focusState, focusId });
  const options = useMemo(() => keys.filter((x) => x.startsWith(`${focusState}|`)).map((x) => o.BillerProfiles[x])
    .sort((a, b) => (b.paid ?? 0) - (a.paid ?? 0))
    .map((p) => ({ key: p.id, text: `${p.codeLabel} (${p.hcpcs}) · ${countOrWithheld(p.billers, o.SmallCellMinimum)} billers` })), [keys, focusState, o]);
  const p = k ? o.BillerProfiles[k] : null;
  const year = o.ProfileYear;

  return (
    <div className="pfd-page" data-oversight-page="patterns">
      <div className="pfd-head-row">
        <h1>{p ? <>Provider patterns · {stateName(p.state)} · {p.codeLabel} (<BillingCode code={p.hcpcs} plain />), {year}</> : 'Provider patterns'}</h1>
        <ViewToggle views={[{ label: 'Public view · counts only', on: true }, { label: 'Authorized view · provider list', needs: 'a data agreement and sign-in; not built' }]} />
      </div>
      <p className="pfd-sub">Are the billers of this service established, or did many of them appear recently and live off this one code? No biller is named.</p>
      <OversightPicker
        states={states}
        focusState={focusState}
        onState={(st) => { setFocusState(st); setFocusId(null); }}
        options={options}
        selected={k}
        onSelect={(x) => setFocusId(latestServiceYearId(o, x))}
      />
      {p ? (
        <>
          <Signs o={o} p={p} year={year} setPage={setPage} />
          <div className="pfd-row">
            <div className="pfd-card pfd-grow" data-cohorts>
              <CardHead title="Billers grouped by the year they first billed this code" note="real figures" />
              <Legend>
                <Swatch color={COLORS.depends} label={`depends on this code: ${Math.round(o.StageParameters.dependenceShare * 100)}% or more of the biller's ${year} Medicaid payments`} />
                <Swatch color={COLORS.other} label="bills mostly other services" />
                <Swatch color={COLORS.withheld} label={`${fewerThan(o.SmallCellMinimum)} billers: withheld`} />
              </Legend>
              <div className="pfo-cohorts">
                <div><div className="pfo-chart-title">How many billers</div><CohortBars p={p} year={year} pick="count" min={o.SmallCellMinimum} /></div>
                <div><div className="pfo-chart-title">What they were paid for it in {year}</div><CohortBars p={p} year={year} pick="paid" min={o.SmallCellMinimum} /></div>
              </div>
              <p className="pfd-note">Each bar is a group of billers; the shaded columns are new to the code.</p>
              <CardHead title="Where the billers are · practice ZIP area" note={`areas with ${fewerThan(o.SmallCellMinimum)} billers are merged`} />
              <Areas p={p} min={o.SmallCellMinimum} />
            </div>
            <div className="pfd-col-right">
              <OtherPatterns p={p} year={year} min={o.SmallCellMinimum} stage={o.StageParameters} />
              <div className="pfd-card pfo-care">
                <CardHead title="Read with care" />
                <ul className="pfo-care-list">
                  <li>A new biller can be a legitimate new clinic. A pattern here is a reason to ask, not an answer.</li>
                  <li>Related companies are normal: an operator, its therapy company and its property company can each hold a number.</li>
                  <li>Ownership changes can take CMS a year or more to record, so a biller&apos;s history may belong to a prior operator.</li>
                  <li>The public file runs 14 months or more behind.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="pfd-card"><p>{stateName(focusState)} has no flagged service with a provider profile for {year}.</p></div>
      )}
    </div>
  );
}

function Signs({ o, p, year, setPage }) {
  const min = o.SmallCellMinimum;
  const high = p.HighSignCount;
  const figure = {
    'newcomer-billers': p.newcomerBillers === null ? 'a group is withheld' : `${count(p.newcomerBillers)} of ${countOrWithheld(p.billers, min)}`,
    'newcomer-paid': moneyOrWithheld(p.newcomerPaid),
    'dependent-newcomer-paid': moneyOrWithheld(p.dependentNewcomerPaid),
  };
  return (
    <div className="pfd-card pfo-lookfor" data-profile-signs>
      <CardHead title="What to look for" />
      <p className="pfo-lead">
        In a settled service, most of the money goes to providers that have billed it for years and that bill many other things. A service is worth a closer look
        when <b>many billers arrive at once</b>, when the newcomers <b>live off the one code</b>, and when they <b>reach large sums quickly</b>.
        {' '}Here {high === 0 ? 'none' : high === 3 ? 'all three' : high} of the three newcomer signs {high === 1 ? 'sits' : 'sit'} above {Math.round(HIGH_SIGN_RANK * 100)}% of comparable state services. Speed has no benchmark yet.
      </p>
      <div className="pfd-table-wrap">
        <table className="pfd-table">
          <thead><tr><th>Sign</th><th className="r">A typical state service</th><th className="r">This service, other states</th><th className="r">{stateName(p.state)}</th><th>Against {count(o.ComparableProfileCount)} comparable state services</th></tr></thead>
          <tbody>
            {p.signs.map((s) => (
              <tr key={s.id} data-sign={s.id}>
                <td>{s.label}</td>
                <td className="r">{wholePct(s.typical)}</td>
                <td className="r">{s.otherStatesMedian === null ? '—' : wholePct(s.otherStatesMedian)}</td>
                <td className="r">{s.signValueIsWithheld ? <b>withheld</b> : <b className="pfo-tone-red pfo-strong">{wholePct(s.value)}</b>} <span className="pfd-note">{figure[s.id]}</span></td>
                <td><Pill tone={rankTone(s)}>higher than {Math.floor(s.rankAmongComparable * 100)}% of them</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pfd-note">
        Typical is the middle value of state services with at least {COMPARABLE_PROFILE.minBillers} billers and {money(COMPARABLE_PROFILE.minPaid, 0)} paid in {year}; other states is the middle value of the
        code&apos;s {count(p.otherStates)} other states. A state that switches billing codes makes every biller look new, so check the{' '}
        <button type="button" className="pfd-link" onClick={() => setPage('ledger')}>explanation ledger</button> before reading these as unusual.
      </p>
    </div>
  );
}

/** Three stacked columns (established, new the year before, new this year): depends below, other above. */
function CohortBars({ p, year, pick, min }) {
  const W = 300;
  const H = 230;
  const bottom = H - 38;
  const colW = W / 3;
  const bw = colW * 0.7;
  const value = (m) => (pick === 'count' ? m.count : m.paid);
  const totals = p.cohorts.map((c) => {
    const d = value(c.depends);
    const o = value(c.other);
    return d === null || o === null ? null : d + o;
  });
  const max = Math.max(...p.cohorts.flatMap((c) => [value(c.depends) ?? 0, value(c.other) ?? 0]), ...totals.map((t) => t ?? 0), 1);
  const h = (v) => (v / max) * (bottom - 26);
  const text = (v) => (pick === 'count' ? count(v) : shortMoney(v));
  const names = [
    { t: `Before ${year - 1}`, s: 'established' },
    { t: String(year - 1), s: 'new to the code' },
    { t: String(year), s: 'new to the code' },
  ];
  return (
    <svg className="pfo-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={pick === 'count' ? 'Billers by the year they first billed the code' : 'Paid by the year the billers first billed the code'}>
      {p.cohorts.map((c, i) => {
        const x = i * colW + (colW - bw) / 2;
        const d = value(c.depends);
        const o = value(c.other);
        const dh = d === null ? 14 : h(d);
        const oh = o === null ? 14 : h(o);
        return (
          <g key={c.id} data-cohort={c.id}>
            {i > 0 ? <rect x={i * colW + 4} y={4} width={colW - 8} height={H - 8} rx="4" fill="#211c10" /> : null}
            <rect x={x} y={bottom - dh} width={bw} height={dh} fill={d === null ? COLORS.withheld : COLORS.depends} />
            <rect x={x} y={bottom - dh - oh} width={bw} height={oh} fill={o === null ? COLORS.withheld : COLORS.other} />
            {dh >= 16 ? <text x={x + bw / 2} y={bottom - dh / 2 + 4} textAnchor="middle" fontSize="11" fill="#1a0c0c">{d === null ? `<${min}` : text(d)}</text> : null}
            {oh >= 16 ? <text x={x + bw / 2} y={bottom - dh - oh / 2 + 4} textAnchor="middle" fontSize="11" fill="#08223a">{o === null ? `<${min}` : text(o)}</text> : null}
            <text x={x + bw / 2} y={bottom - dh - oh - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{totals[i] === null ? 'withheld' : text(totals[i])}</text>
            <line x1={i * colW + 6} x2={(i + 1) * colW - 6} y1={bottom} y2={bottom} stroke="#33496b" />
            <text x={i * colW + colW / 2} y={bottom + 16} textAnchor="middle" fontSize="12" fontWeight="700" fill={i === 0 ? '#e7eef8' : '#f5c451'}>{names[i].t}</text>
            <text x={i * colW + colW / 2} y={bottom + 30} textAnchor="middle" fontSize="10.5" fill="#8aa3c2">{names[i].s}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Areas({ p, min }) {
  const total = p.areas.reduce((a, r) => a + (r.paid ?? 0), 0) || 1;
  return (
    <div className="pfo-areas" data-areas>
      {p.areas.map((a) => (
        <div key={`${a.zip3}|${a.city}`} className="pfo-area">
          <span className="pfo-area-name">{a.zip3 ? `ZIP ${a.zip3} · ${cityName(a.city)}` : 'All other areas, merged'}</span>
          <div className="pfo-area-bar"><i style={{ width: `${((a.paid ?? 0) / total) * 100}%` }} /></div>
          <b className="pfo-area-v">{countOrWithheld(a.billers, min)} · {moneyOrWithheld(a.paid)}</b>
        </div>
      ))}
      {p.areas.length === 0 ? <p className="pfd-note">No practice area is on file for these billers.</p> : null}
    </div>
  );
}

function OtherPatterns({ p, year, min, stage }) {
  const of = (m) => (m.count === null ? fewerThan(min) : count(m.count));
  return (
    <div className="pfd-card" data-other-patterns>
      <CardHead title={`Other patterns · billers and their ${year} dollars`} note="real figures" />
      <p className="pfd-note pfo-tight">These overlap: one biller can appear in several, so they do not add up.</p>
      <div className="pfo-grid2">
        <Tile tone="amber" n={of(p.noPaymentBefore)} small={`of ${countOrWithheld(p.billers, min)}`} label={`have no payment of any kind in the file before ${year - 1}`} detail={moneyOrWithheld(p.noPaymentBefore.paid)} />
        <Tile tone="amber" n={of(p.recentlyEnumerated)} small={`of ${countOrWithheld(p.billers, min)}`} label={`registered with NPPES in ${year - stage.recentNppesYears} or later`} detail={moneyOrWithheld(p.recentlyEnumerated.paid)} />
        <Tile
          tone="amber"
          path={p.millionFast.count === null}
          n={of(p.millionFast)}
          small={`of ${of(p.million)}`}
          label={`million-dollar billers got there within ${stage.fastMonths} months of their first claim`}
          detail={p.millionMedianMonths === null ? 'median withheld' : `median ${p.millionMedianMonths} months`}
        />
        <Tile
          n={of(p.sharedAddress)}
          small={p.sharedAddresses === null ? '' : `at ${count(p.sharedAddresses)}`}
          label="billers share a practice address with another biller"
          detail={`${moneyOrWithheld(p.sharedAddress.paid)} · often one organization with several numbers`}
        />
        <Tile n="withheld" label="the ten largest billers' share of the dollars" detail={`ten billers: fewer than ${min}`} />
        <Tile n={`${countOrWithheld(p.organizations, min)} / ${countOrWithheld(p.individuals, min)}`} label="organizations / individual practitioners" detail="NPPES entity type" />
      </div>
    </div>
  );
}
