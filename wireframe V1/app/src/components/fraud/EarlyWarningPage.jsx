import { useMemo } from 'react';
import { PATTERN_LABELS } from '../../data/potentialFraudCatalog.js';
import { SCREEN_PATTERNS } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { ALERT_RULE } from '../../lib/fraud/oversightProgram.js';
import { money, pct, multiple, count, BillingCode } from './fraudFormat.jsx';
import { Legend, Swatch, shortMoney } from './fraudVisuals.jsx';
import {
  CardHead, OversightPicker, Tile, KeyValue, chooseStateCode, fewerThan, latestServiceYearId, monthLabel, monthShort, niceStep, stateName,
} from './oversightShared.jsx';

/**
 * Early warning: when could a rise have been seen? Monthly payments for one state and service
 * with the first month that meets the monthly rule DecisionPro proposes (ALERT_RULE), the
 * annual screen's flag of the same rise, the first confirmed restriction on file, and the known
 * cases' first flags against what was paid afterwards.
 */

const PHASE_COLORS = Object.freeze({ before: '#5db4ff', alert: '#f5c451', after: '#ff6b6b', last: '#4a5d7c' });
const SHARE_COLOR = '#b9a7ff';
/** "2.1× the same months a year earlier", or "up from nothing" when nothing was paid then. */
const timesYearEarlier = (now, before) => (before > 0 ? `${multiple(now / before)}` : 'up from nothing');
const FIRST_FLAG_WORDS = Object.freeze({
  'share-surge': 'Share surge (share at least doubled)',
  'tripled-and-growing': 'Tripled and still growing',
  'persistent-excess': 'Now persistently above enrollment',
  'share-collapse': 'Share collapsed',
});
/** Short words for what followed a known case, by the policy event's kind. */
const FOLLOWED_WORDS = Object.freeze({
  enforcement: 'enforcement',
  'authorization-or-limit': 'limits or prior authorization',
  coverage: 'coverage restricted',
  rate: 'rate cut',
  eligibility: 'eligibility narrowed',
  funding: 'funding cut',
});

export function EarlyWarningPage({ radar, review, oversight: o, byId, focusState, setFocusState, focusId, setFocusId, openCase }) {
  const keys = useMemo(() => Object.keys(o.EarlyWarnings), [o]);
  const states = useMemo(() => [...new Set(keys.map((k) => k.split('|')[0]))].sort((a, b) => stateName(a).localeCompare(stateName(b))), [keys]);
  const k = chooseStateCode({ keys, oversight: o, byId, focusState, focusId });
  const options = useMemo(() => keys.filter((x) => x.startsWith(`${focusState}|`))
    .map((x) => o.EarlyWarnings[x])
    .sort((a, b) => (Boolean(b.firstAlertMonth) - Boolean(a.firstAlertMonth)) || (b.paidAfterAlert - a.paidAfterAlert) || a.hcpcs.localeCompare(b.hcpcs))
    .map((e) => ({ key: e.id, mark: e.firstAlertMonth ? '●' : '', text: `${e.codeLabel} (${e.hcpcs})${e.firstAlertMonth ? ` · first alert ${monthLabel(e.firstAlertMonth)}` : ' · no alert'}` })), [keys, focusState, o]);
  const e = k ? o.EarlyWarnings[k] : null;
  const latest = review.LatestYear;
  const ys = review.YearSummaries[latest];

  return (
    <div className="pfd-page" data-oversight-page="early">
      <h1>{e ? <>Early warning · {stateName(e.state)} · {e.codeLabel} (<BillingCode code={e.hcpcs} plain />)</> : 'Early warning'}</h1>
      {e ? <EarlySummary e={e} /> : <p className="pfd-sub">When could a rise have been seen? Pick a state with a flagged service.</p>}
      <OversightPicker
        oversight={o}
        markLabel="● the monthly rule alerted"
        states={states}
        focusState={focusState}
        onState={(st) => { setFocusState(st); setFocusId(null); }}
        options={options}
        selected={k}
        onSelect={(x) => setFocusId(latestServiceYearId(o, x))}
      />
      {e ? (
        <div className="pfd-row">
          <div className="pfd-card pfd-grow" data-early-chart>
            <CardHead title={`Paid per month · ${stateName(e.state)} billers`} note={`HHS T-MSIS provider spending, v${radar.asOf} · real figures`} />
            <MonthlyChart e={e} min={o.SmallCellMinimum} />
            <p className="pfd-note">
              Alert rule shown: three months&apos; payments at least {ALERT_RULE.multiple === 2 ? 'twice' : `${ALERT_RULE.multiple} times`} the same three months a year earlier, and at least {money(ALERT_RULE.minimumPaid, 0)}.
              It is a monthly rule DecisionPro proposes, not yet part of the screen.
              <BillersNote e={e} />
            </p>
          </div>
          <div className="pfd-col-right">
            <ThreeClocks e={e} radar={radar} openCase={openCase} />
            <FirstFlags o={o} latest={latest} ys={ys} />
            <div className="pfo-grid2">
              <Tile
                data="paid-after-alert"
                tone="red"
                n={e.firstAlertMonth ? (e.paidAfterAlertIsKnown ? money(e.paidAfterAlert) : 'not known') : '—'}
                label={e.firstAlertMonth
                  ? `paid after the first-alert month, ${monthLabel(e.paidAfterAlertFrom)} – ${monthLabel(e.paidAfterAlertTo)}${e.paidAfterAlertIsKnown ? '' : ' (a month in between is withheld)'}`
                  : 'no month met the monthly rule'}
              />
              <Tile
                data="months-to-restriction"
                n={e.firstRestrictionIsOnFile ? `${e.monthsToFirstRestriction} months` : 'none on file'}
                label={e.firstRestrictionIsOnFile ? 'from the alert month to the first confirmed restriction on file' : 'no confirmed restriction on file after the alert'}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="pfd-row">
          <div className="pfd-card pfd-grow"><p>{stateName(focusState)} has no flagged service with a monthly series.</p></div>
          <div className="pfd-col-right"><FirstFlags o={o} latest={latest} ys={ys} /></div>
        </div>
      )}
      <KnownCases o={o} byId={byId} openCase={openCase} />
    </div>
  );
}

function FirstFlags({ o, latest, ys }) {
  return (
    <div className="pfd-card" data-first-flags>
      <CardHead title={`Flagged for the first time in ${latest}`} note="all states · real counts" />
      <div className="pfo-firsts">
        <div>
          <div className="pfo-big pfo-tone-amber">{count(o.FirstFlagsInLatestYear.services)}</div>
          <div className="pfd-note">of {count(o.FirstFlagsInLatestYear.flags)} flags in {latest} are a state and service never flagged before</div>
        </div>
        <div className="pfo-flex1">
          {SCREEN_PATTERNS.map((p) => <KeyValue key={p} k={FIRST_FLAG_WORDS[p] ?? PATTERN_LABELS[p]}>{count(o.FirstFlagsInLatestYear.byPattern[p] ?? 0)}</KeyValue>)}
        </div>
      </div>
      <p className="pfd-note">
        A service can show more than one pattern.{ys?.incompleteReportingServices ? ` ${latest} reporting is preliminary for ${count(ys.incompleteReportingServices)} of its ${count(ys.services)} flags in the public file.` : ''} This is the watch list a monthly feed would keep current.
      </p>
    </div>
  );
}

function EarlySummary({ e }) {
  const st = stateName(e.state);
  if (!e.firstAlertMonth) {
    return <p className="pfd-sub">When could this have been seen? No month met the monthly rule from January {e.changeStartYear - 1} on, the January before the rise the screen flags begins. The chart shows what was paid each month.</p>;
  }
  const at = e.months.findIndex((m) => m.ym === e.firstAlertMonth);
  const yearBefore = e.months.slice(Math.max(0, at - 12), at).map((m) => m.paid).filter((v) => v !== null);
  const range = yearBefore.length ? `Payments ran between ${money(Math.min(...yearBefore))} and ${money(Math.max(...yearBefore))} a month in the year before, then the` : 'The';
  return (
    <p className="pfd-sub">
      When could this have been seen? {range} three months to <b>{monthLabel(e.firstAlertMonth)}</b> paid {e.firstAlert.yearEarlierThreeMonthPaid > 0 ? `${timesYearEarlier(e.firstAlert.threeMonthPaid, e.firstAlert.yearEarlierThreeMonthPaid)} the same months a year earlier` : 'where nothing was paid the same months a year earlier'}.
      {' '}From {monthLabel(e.paidAfterAlertFrom)} to {monthLabel(e.paidAfterAlertTo)} {st} billers were paid <b>{e.paidAfterAlertIsKnown ? money(e.paidAfterAlert) : 'an amount not known (a month is withheld)'}</b> for this one service.
    </p>
  );
}

function BillersNote({ e }) {
  const known = e.months.filter((m) => m.billers !== null && m.billers !== undefined);
  if (!known.length) return null;
  const peak = known.reduce((a, m) => (m.billers > a.billers ? m : a));
  const alert = e.firstAlert;
  return (
    <>
      {' '}Billers paid in the month:{alert && alert.billers !== null ? ` ${count(alert.billers)} in ${monthLabel(alert.ym)},` : ''} {count(peak.billers)} in {monthLabel(peak.ym)} (the most).
    </>
  );
}

/** Monthly bars by phase against the first alert, the state's share of US payments as a dashed line (0–100%). */
function MonthlyChart({ e, min }) {
  const W = 640;
  const H = 330;
  const left = 46;
  const right = W - 6;
  const top = 64;
  const bottom = H - 24;
  const alertYear = e.firstAlertMonth ? Number(e.firstAlertMonth.slice(0, 4)) : 0;
  const lastYear = Number(e.months[e.months.length - 1].ym.slice(0, 4));
  const fromYear = alertYear ? alertYear - 2 : lastYear - 3;
  const months = e.months.filter((m) => Number(m.ym.slice(0, 4)) >= fromYear);
  const max = Math.max(...months.map((m) => m.paid ?? 0), 1);
  const stepY = niceStep(max);
  const yMax = Math.ceil(max / stepY) * stepY;
  const y = (v) => bottom - (v / yMax) * (bottom - top);
  const step = (right - left) / months.length;
  const bw = step * 0.82;
  const xOf = (i) => left + i * step + (step - bw) / 2;
  const withheld = months.some((m) => m.paid === null);
  const alertIndex = months.findIndex((m) => m.phase === 'alert');
  const sharePoints = [];
  let segment = [];
  months.forEach((m, i) => {
    if (m.share === null) { if (segment.length) sharePoints.push(segment); segment = []; return; }
    segment.push(`${xOf(i) + bw / 2},${bottom - Math.min(1, m.share) * (bottom - top)}`);
  });
  if (segment.length) sharePoints.push(segment);
  const ticks = Array.from({ length: Math.round(yMax / stepY) + 1 }, (_, i) => i * stepY);
  const last = e.months[e.months.length - 1];
  const a = e.firstAlert;
  const ax = alertIndex >= 0 ? xOf(alertIndex) + bw / 2 : 0;
  const boxW = 312;
  const boxX = alertIndex >= 0 ? (ax > W / 2 ? ax - boxW - 8 : ax + 8) : 0;
  const windowStart = a ? e.months[e.months.findIndex((m) => m.ym === a.ym) - (ALERT_RULE.windowMonths - 1)]?.ym : '';
  return (
    <>
      <Legend>
        <Swatch color={PHASE_COLORS.before} label={e.firstAlertMonth ? 'before the alert' : 'paid in the month'} />
        {e.firstAlertMonth ? <Swatch color={PHASE_COLORS.alert} label="alert month" /> : null}
        {e.firstAlertMonth ? <Swatch color={PHASE_COLORS.after} label="paid after the alert" /> : null}
        <Swatch color={PHASE_COLORS.last} label={`${monthLabel(last.ym)}, the last month in the file (often short)`} />
        {withheld ? <Swatch kind="outline" color="#6f88a8" label={`withheld: ${fewerThan(min)} billers`} /> : null}
        <Swatch kind="dashed" color={SHARE_COLOR} label={`${stateName(e.state)} share of US payments (0–100%)`} />
      </Legend>
      <svg className="pfo-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${stateName(e.state)} ${e.hcpcs} paid per month${e.firstAlertMonth ? `, first alert ${monthLabel(e.firstAlertMonth)}` : ''}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke="#172a45" />
            <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#7f98b8">{shortMoney(t)}</text>
          </g>
        ))}
        {months.map((m, i) => (
          <g key={m.ym}>
            {m.ym.endsWith('-01') ? (
              <>
                <line x1={left + i * step} x2={left + i * step} y1={top} y2={bottom} stroke="#1c3050" strokeDasharray="2 3" />
                <text x={left + i * step + 2} y={H - 8} fontSize="11" fill="#b5c5db" fontWeight="600">{m.ym.slice(0, 4)}</text>
              </>
            ) : null}
            {m.paid === null
              ? <rect x={xOf(i)} y={bottom - 6} width={bw} height="6" fill="none" stroke="#6f88a8" strokeDasharray="2 2" />
              : <rect x={xOf(i)} y={y(m.paid)} width={bw} height={Math.max(1, bottom - y(m.paid))} rx="1.5" fill={PHASE_COLORS[m.phase]} data-month={m.ym} data-phase={m.phase}>
                <title>{`${monthLabel(m.ym)}: ${money(m.paid)} paid · ${m.billers === null ? fewerThan(min) : count(m.billers)} billers${m.share === null ? '' : ` · ${pct(m.share)} of US`}${m.isAlert ? ' · meets the monthly rule' : ''}`}</title>
              </rect>}
          </g>
        ))}
        {sharePoints.map((pts, i) => <polyline key={i} fill="none" stroke={SHARE_COLOR} strokeWidth="1.6" strokeDasharray="4 3" points={pts.join(' ')} />)}
        {alertIndex >= 0 && a ? (
          <g data-first-alert={a.ym}>
            <line x1={ax} x2={ax} y1={8} y2={bottom} stroke={PHASE_COLORS.alert} strokeWidth="1.5" />
            <rect x={boxX} y={4} width={boxW} height={a.share !== null && a.shareBefore !== null ? 52 : 40} rx="5" fill="#2b2209" stroke="#94721c" />
            <text x={boxX + 10} y={21} fontSize="12" fill={PHASE_COLORS.alert} fontWeight="700">First alert: {monthLabel(a.ym)}</text>
            <text x={boxX + 10} y={37} fontSize="11" fill="#e8dcb5">
              {windowStart ? `${monthShort(windowStart)}–${monthShort(a.ym)} ` : ''}paid {money(a.threeMonthPaid)}, {a.yearEarlierThreeMonthPaid > 0 ? `${timesYearEarlier(a.threeMonthPaid, a.yearEarlierThreeMonthPaid)} the ${money(a.yearEarlierThreeMonthPaid)} of a year earlier` : 'up from nothing a year earlier'}
            </text>
            {a.share !== null && a.shareBefore !== null ? <text x={boxX + 10} y={50} fontSize="10.5" fill="#bfae7a">share of US payments went from {pct(a.shareBefore, 0)} to {pct(a.share, 0)} in one month</text> : null}
          </g>
        ) : null}
      </svg>
    </>
  );
}

function ThreeClocks({ e, radar, openCase }) {
  const f = e.annualFlag;
  const published = String(radar.asOf ?? '').slice(0, 7);
  return (
    <div className="pfd-card" data-three-clocks>
      <CardHead title="Three clocks" />
      <div className="pfo-clock">
        <div className="pfo-clock-d">{e.firstAlertMonth ? monthLabel(e.firstAlertMonth) : 'none'}</div>
        <div>{e.firstAlertMonth
          ? <><b>Monthly screen on the state&apos;s own claims</b> would have alerted here. Needs a claims feed from the Medicaid agency.</>
          : <><b>Monthly screen</b>: no month met the rule from January {e.changeStartYear - 1} on.</>}
        </div>
      </div>
      <div className="pfo-clock">
        <div className="pfo-clock-d">{f ? `Year ${f.year}` : '—'}</div>
        <div>{f
          ? <><b>Annual screen (this module)</b> flags {f.year}{f.patterns.length ? ` (${f.patterns.map((p) => PATTERN_LABELS[p]).join(', ')})` : ''}: {f.priorYearPaidIsWithheld ? 'withheld' : money(f.priorYearPaid)} to {f.statePaidIsWithheld ? 'withheld' : money(f.statePaid)}, share of US from {f.priorYearPaidIsWithheld ? 'withheld' : pct(f.priorYearShare)} to {f.statePaidIsWithheld ? 'withheld' : pct(f.share)}. <button type="button" className="pfd-link" onClick={() => openCase(f.id)}>Open the case file</button></>
          : <><b>Annual screen</b>: the year the rise begins is not a flagged year.</>}
        </div>
      </div>
      <div className="pfo-clock">
        <div className="pfo-clock-d">{monthLabel(published)}</div>
        <div><b>The public file was published</b> (v{radar.asOf}). Before then nobody outside government could run either screen.</div>
      </div>
      <div className="pfo-clock">
        <div className="pfo-clock-d">{e.firstRestrictionIsOnFile ? monthLabel(e.firstRestriction.effectiveDate) : '—'}</div>
        <div>{e.firstRestrictionIsOnFile
          ? <>First confirmed restriction on file. <span className="pfd-note">{e.firstRestriction.summary}</span></>
          : <>No confirmed restriction on file after the alert. The explanation ledger lists every event on file.</>}
        </div>
      </div>
    </div>
  );
}

function KnownCases({ o, byId, openCase }) {
  return (
    <div className="pfd-card" data-known-outcomes>
      <CardHead title="Known cases · first flag against what was paid afterwards" note="annual screen · real figures" />
      <div className="pfd-table-wrap">
        <table className="pfd-table">
          <thead><tr><th>Case</th><th>First flag of the blow-up</th><th className="r">Paid that year</th><th className="r">Paid in the years after</th><th>What followed (confirmed, on file)</th></tr></thead>
          <tbody>
            {o.KnownCaseOutcomes.map((c) => {
              const flagId = `${c.id}|${c.firstFlagYear}`;
              return (
                <tr key={c.id} className={byId.has(flagId) ? 'pfd-click' : undefined} onClick={() => (byId.has(flagId) ? openCase(flagId) : null)}>
                  <td>{stateName(c.state)} · {c.codeLabel} <span className="pfd-code">{c.hcpcs}</span></td>
                  <td>{c.firstFlagYear}{c.patterns.length ? ` · ${c.patterns.map((p) => PATTERN_LABELS[p]).join(', ')}` : ''}</td>
                  <td className="r">{c.paidThatYearIsWithheld ? 'withheld' : money(c.paidThatYear)}</td>
                  <td className="r"><b>{c.paidAfterIsKnown ? money(c.paidAfter) : 'withheld'}</b> {c.afterFrom ? <span className="pfd-note">{c.afterFrom === c.afterTo ? c.afterFrom : `${c.afterFrom}–${String(c.afterTo).slice(2)}`}</span> : null}</td>
                  <td>{c.followed.length ? c.followed.map((f) => <span key={f.id} title={f.summary}>{f.effectiveDate.slice(0, 4)} {FOLLOWED_WORDS[f.kind] ?? f.kind}<br /></span>) : <span className="pfd-note">nothing confirmed on file</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
