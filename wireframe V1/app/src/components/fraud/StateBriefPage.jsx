import { useMemo, useState } from 'react';
import { BRIEF_RULE } from '../../lib/fraud/oversightProgram.js';
import { money, pct, multiple, count } from './fraudFormat.jsx';
import {
  CardHead, KeyValue, MiniBars, NotAvailable, OversightPicker, Pill, Tile, ViewToggle, fewerThan, monthLabel, stateName,
} from './oversightShared.jsx';

/**
 * State oversight brief: for one state, the latest year's services paid above the state's share
 * of national enrollment, most dollars above the line first, each with one reading the program
 * named (BRIEF_READINGS), the brief's totals and three questions a legislator can ask. A row
 * with fewer billers than the program's SmallCellMinimum shows its billers as "fewer than N" and withholds its dollars.
 * Only the public view is built.
 */

const ROWS_SHOWN = 10;
const READING_TONE = Object.freeze({ falling: 'gry', 'ask-why': 'amb', 'new-small': 'blu', 'long-running': 'amb', rising: 'red', steady: 'gry' });

/** The reading in words, from the row's own figures. */
function readingText(row, year) {
  const withheld = row.billersAreWithheld;
  switch (row.reading) {
    case 'falling': return withheld ? `falling: down ${pct(-row.changeOnPriorYear, 0)} on ${year - 1}` : `falling: ${money(row.priorYearPaid)} in ${year - 1}`;
    case 'ask-why': {
      const f = row.firstBlowup;
      if (!f || withheld) return `blew up in ${row.blowupYears.join(', ')}`;
      return `jumped from ${money(f.priorYearPaid)} to ${money(f.statePaid)} in ${f.year}`;
    }
    case 'new-small': return `first flagged in ${year}${row.s.patterns.includes('share-surge') ? '; share doubled' : ''}`;
    case 'long-running': return `far above the line ${row.farAboveYears} years, since ${row.farAboveSince}`;
    case 'rising': return `up ${pct(row.changeOnPriorYear, 0)} on ${year - 1}`;
    default: return row.priorYearIsOnFile ? `close to ${year - 1}` : `not flagged before ${year}`;
  }
}

export function StateBriefPage({ radar, oversight: o, focusState, setFocusState, setFocusId, openCase, setPage }) {
  const [showAll, setShowAll] = useState(false);
  const states = useMemo(() => Object.keys(o.StateBriefs).sort((a, b) => stateName(a).localeCompare(stateName(b))), [o]);
  const b = o.StateBriefs[focusState] ?? null;
  const name = stateName(focusState);
  const rows = b ? (showAll ? b.rows : b.rows.slice(0, ROWS_SHOWN)) : [];
  const withProfile = b ? b.rows.filter((row) => o.BillerProfiles[`${b.state}|${row.hcpcs}`]).length : 0;
  const enrollmentAsOf = (radar.coverage ?? []).find((c) => c.dataRequestId === 'DR-REAL-PI-ENROLLMENT-ALL-STATES')?.asOf ?? '';
  const lead = b ? b.rows.slice(0, 2) : [];

  return (
    <div className="pfd-page" data-oversight-page="brief">
      <div className="pfd-head-row">
        <h1>Medicaid spending oversight brief · {name}{b ? ` · ${b.year}` : ''}</h1>
        <ViewToggle views={[
          { label: 'Public view', on: true },
          { label: 'Legislator view', needs: 'sign-in; adds case files and the ledger' },
          { label: 'Agency view', needs: 'a data agreement; adds provider lists and the agency\'s own responses' },
        ]}
        />
      </div>
      {b ? (
        <p className="pfd-sub">
          {name} holds <b>{pct(b.enrollmentShare, 2)}</b> of national Medicaid and CHIP enrollment. In {b.year}, <b>{count(b.services)} services</b> were paid above that share,
          {' '}<b>{money(b.aboveEnrollment)}</b> above the line in total.
          {' '}{b.largeBlowups === 0 ? `No program paid ${money(BRIEF_RULE.largeBlowupPaid, 0)} or more blew up in ${b.year}.` : `${count(b.largeBlowups)} program${b.largeBlowups === 1 ? '' : 's'} paid ${money(BRIEF_RULE.largeBlowupPaid, 0)} or more blew up in ${b.year}.`}
          {lead.length ? <> The largest gaps: {lead.map((row, i) => <span key={row.id}>{i ? ' and ' : ''}{row.codeLabel.toLowerCase()} ({row.readingLabel.toLowerCase()})</span>)}.</> : null}
        </p>
      ) : <p className="pfd-sub">{name} has no service paid above its enrollment share in the latest year.</p>}
      <OversightPicker states={states} focusState={focusState} onState={(st) => { setFocusState(st); setFocusId(null); setShowAll(false); }} />
      {b ? (
        <div className="pfd-row pfo-brief">
          <div className="pfd-grow pfo-col pfo-brief-main">
            <div className="pfd-card" data-brief-rows>
              <CardHead title="Where payments sit furthest above the enrollment line" note={`real figures · ${b.year} may be preliminary`} />
              <div className="pfd-table-wrap">
                <table className="pfd-table pfo-brief-table">
                  <thead>
                    <tr>
                      <th>Service</th><th>{b.rows[0]?.seriesPaid[0]?.year ?? ''}–{String(b.year).slice(2)}</th><th className="r">Paid {b.year}</th><th className="r">Share of US</th>
                      <th className="r">× enrollment</th><th className="r">Billers</th><th>Reading</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="pfd-click" onClick={() => openCase(row.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openCase(row.id); }} data-brief-row={row.hcpcs}>
                        <td><b>{row.codeLabel}</b> <span className="pfd-code">{row.hcpcs}</span></td>
                        <td>{row.billersAreWithheld ? <span className="pfd-note">withheld</span> : <MiniBars values={row.seriesPaid.map((r) => r.paid)} label={`${row.codeLabel} paid per year`} />}</td>
                        <td className="r"><b>{row.billersAreWithheld ? 'withheld' : money(row.statePaid)}</b></td>
                        <td className="r">{pct(row.share)}</td>
                        <td className="r"><b>{multiple(row.excessMultiple)}</b></td>
                        <td className="r">{row.billersAreWithheld ? fewerThan(o.SmallCellMinimum) : count(row.billers)}</td>
                        <td>{readingText(row, b.year)}</td>
                        <td><Pill tone={READING_TONE[row.reading]}>{row.readingLabel}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {b.rows.length > ROWS_SHOWN ? (
                <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => setShowAll(!showAll)} data-brief-show-all>
                  {showAll ? `Show the first ${ROWS_SHOWN}` : `Show all ${count(b.rows.length)}`}
                </button>
              ) : null}
              <div className="pfo-grid4 pfo-gap">
                <Tile data="brief-services" n={count(b.services)} label="services above the enrollment line" />
                <Tile data="brief-above" n={money(b.aboveEnrollment)} label="paid above the line, all flagged services" />
                <Tile data="brief-blowups" tone={b.largeBlowups ? 'red' : 'green'} n={count(b.largeBlowups)} label={`programs over ${money(BRIEF_RULE.largeBlowupPaid, 0)} that blew up in ${b.year}`} />
                <button type="button" className="pfo-tile pfo-tile-btn" onClick={() => setPage('patterns')} data-tile="brief-profiles">
                  <div className="pfo-tile-n pfo-tone-amber">{count(withProfile)}</div>
                  <div className="pfo-tile-l">services with a provider-pattern screen ready</div>
                </button>
              </div>
            </div>
            <div className="pfd-card" data-brief-questions>
              <CardHead title="What a legislator can ask" />
              <ol className="pfo-questions">{b.questions.map((q) => <li key={q.kind}>{q.text}</li>)}</ol>
            </div>
          </div>
          <div className="pfd-col-right pfo-brief-side">
            <div className="pfd-card" data-data-clock>
              <CardHead title="Data clock" />
              <KeyValue k="Public spending file">through Dec {b.year}</KeyValue>
              <KeyValue k="Published">{monthLabel(String(radar.asOf ?? '').slice(0, 7))}</KeyValue>
              <KeyValue k="Enrollment">{enrollmentAsOf ? `through ${monthLabel(enrollmentAsOf.slice(0, 7))}` : 'not loaded'}</KeyValue>
              <KeyValue k="State claims feed"><Pill tone="amb">not connected</Pill></KeyValue>
              <p className="pfd-note">With a state feed the brief runs monthly and the early-warning page turns on.</p>
            </div>
            <div className="pfd-card" data-brief-views>
              <CardHead title="Three views of the same figures" />
              <KeyValue k={<><b>Public</b> · counts and dollars by service</>}><Pill tone="grn">on</Pill></KeyValue>
              <KeyValue k={<><b>Legislator</b> · adds case files and the ledger</>}><Pill>sign-in · not built</Pill></KeyValue>
              <KeyValue k={<><b>Agency</b> · adds provider lists and its own responses</>}><Pill>data agreement · not built</Pill></KeyValue>
            </div>
            <div className="pfd-card" data-agency-response>
              <CardHead title="Agency response" note="not available yet" />
              <NotAvailable>{name}&apos;s Medicaid agency could attach context to any line, shown here unedited. Responses need the agency&apos;s sign-in, which is not built.</NotAvailable>
            </div>
            <div className="pfd-card pfo-howto">
              <CardHead title="How to read this brief" />
              <p className="pfo-lead">
                Every line is a question for review, not a finding. A high share can reflect how a state designs or codes a benefit. Payments are placed in a state by
                the biller&apos;s registered practice location. Rows with {fewerThan(o.SmallCellMinimum)} billers show no dollars.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
