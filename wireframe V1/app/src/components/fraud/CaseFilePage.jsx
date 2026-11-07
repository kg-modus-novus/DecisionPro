import { useMemo, useState } from 'react';
import { STATE_NAMES, PATTERN_LABELS } from '../../data/potentialFraudCatalog.js';
import { FEDERAL_MATCHING_RATE_FY2024, FMAP_SOURCE } from '../../data/federalMatchingRate.js';
import { money, pct, count, downloadText, TierBadge } from './fraudFormat.jsx';

/** Case file: one potential fraud candidate with every public-data signal, the explanation review and the actions. */

const EXPLANATION_QUESTIONS = [
  { id: 'coverage', q: 'Covered standalone here, bundled elsewhere?' },
  { id: 'rate', q: 'Rate, prior-authorization or state plan change dated to the rise?' },
  { id: 'known', q: 'Known case (fraud control unit, OIG, DOJ)?' },
];
const ANSWERS = ['not yet answered', 'yes: explains it', 'no: does not explain it', 'partly'];
const DISPOSITIONS = ['none recorded', 'explained: billing convention', 'explained: program design', 'verify: request claims', 'refer to the fraud control unit', 'closed: known case'];

const KIND = { fired: { mark: '!', cls: 'y' }, clear: { mark: '✓', cls: 'n' }, explain: { mark: '?', cls: 'm' }, pending: { mark: '…', cls: 'p' } };

export function CaseFilePage({ radar, review, byId, focusState, setFocusState, focusId, setFocusId, reviews, setReviews, openBlowup }) {
  const [year, setYear] = useState(review.LatestYear);
  const cases = useMemo(() => review.ServiceYears.filter((s) => s.state === focusState && s.year === year), [review, focusState, year]);
  const focused = focusId && byId.get(focusId)?.state === focusState ? byId.get(focusId) : null;
  const s = focused ?? cases[0] ?? null;

  return (
    <div className="pfd-page">
      <div className="pfd-head-row">
        <label className="pfd-inline">State <select value={focusState} onChange={(e) => { setFocusState(e.target.value); setFocusId(null); }}>{Object.entries(STATE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="pfd-inline">Year <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setFocusId(null); }}>{review.Years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
        <label className="pfd-inline pfd-grow">Case file <select value={s?.id ?? ''} onChange={(e) => setFocusId(e.target.value)}>
          {cases.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.codeLabel} ({c.hcpcs}) · score {c.score} · {c.tier.label}</option>)}
          {focused && focused.year !== year ? <option value={focused.id}>{focused.year} · {focused.codeLabel} ({focused.hcpcs})</option> : null}
        </select></label>
        <span className="pfd-note">{cases.length} case files for {STATE_NAMES[focusState]} in {year}</span>
      </div>
      {s ? <CaseDetail radar={radar} s={s} reviews={reviews} setReviews={setReviews} openBlowup={openBlowup} /> : <div className="pfd-card"><p>{STATE_NAMES[focusState]} has no flagged service in {year}.</p></div>}
    </div>
  );
}

function CaseDetail({ radar, s, reviews, setReviews, openBlowup }) {
  const [panel, setPanel] = useState(null);
  const r = reviews[s.id] ?? { answers: {}, disposition: DISPOSITIONS[0], log: [] };
  const fmap = FEDERAL_MATCHING_RATE_FY2024[s.state];
  const atLine = s.enrollmentLine;
  const fired = s.checks.filter((c) => c.kind === 'fired').length;
  const available = s.checks.filter((c) => c.kind !== 'pending').length;
  const pending = s.checks.filter((c) => c.kind === 'pending').length;

  function update(patch, logLine) {
    const next = { ...r, ...patch, log: logLine ? [...r.log, { at: new Date().toLocaleTimeString(), line: logLine }] : r.log };
    setReviews({ ...reviews, [s.id]: next });
  }

  function packet() {
    const lines = [
      `# Potential fraud case file: ${STATE_NAMES[s.state]} · ${s.codeLabel} (${s.hcpcs}) · ${s.year}`,
      '',
      `Opened by the DecisionPro national radar. Public data only; a candidate for review, not a finding.`,
      `Signal score ${s.score} · suggested tier ${s.tier.label} · reviewer disposition: ${r.disposition}`,
      '',
      '## Figures',
      `- Paid to ${s.state} providers, ${s.year}: ${money(s.statePaid)} (${pct(s.share)} of all US payments for the code)`,
      `- At the state's enrollment share (${pct(s.enrollmentShare, 2)}): ${money(atLine)}`,
      `- Above the enrollment line: ${money(s.aboveEnrollment)} · above the prior-year line: ${money(s.abovePriorShare)}`,
      `- Billing providers: ${s.billingNpis}, ${s.newBillingNpis} billing it for the first time; top 10 take ${pct(s.top10Share, 0)}`,
      fmap ? `- Federal / state split at FY2024 FMAP ${pct(fmap, 2)}: ${pct(fmap, 0)} / ${pct(1 - fmap, 0)}` : '',
      '',
      '## Signals',
      ...s.checks.map((c) => `- [${c.kind}] ${c.label}: ${c.detail}`),
      '',
      '## Explanation review',
      ...EXPLANATION_QUESTIONS.map((q) => `- ${q.q} ${r.answers[q.id] ?? ANSWERS[0]}`),
      '',
      '## Evidence',
      `- HHS Open Data, Medicaid Provider Spending by HCPCS (T-MSIS 2018–2024, v${radar.asOf})`,
      '- CMS monthly Medicaid and CHIP enrollment (all states)',
      '- NPPES practice state for attribution',
      `- Screen run ${String(radar.screenRun.completedAt).slice(0, 10)} (${radar.screenLoadHistoryId})`,
      '',
      'No person-level data. Provider identities stay in the authorized system.',
    ].filter((l) => l !== null);
    downloadText(`case-file-${s.state}-${s.hcpcs}-${s.year}.md`, lines.join('\n'), 'text/markdown');
    update({}, 'Exported the case packet');
  }

  return (
    <>
      <div className="pfd-case-head">
        <div className="pfd-grow">
          <h1>Case file · {STATE_NAMES[s.state]} · {s.codeLabel} ({s.hcpcs}) · {s.year}</h1>
          <p className="pfd-sub">
            Potential fraud candidate opened by the national radar. Status: <b className="pfd-warn">{r.disposition === DISPOSITIONS[0] ? 'under review' : r.disposition}</b>
            {' '}· patterns: {s.patterns.map((p) => PATTERN_LABELS[p]).join(', ')} · data: T-MSIS v{radar.asOf}.
          </p>
        </div>
        <div className="pfd-case-tier">
          <TierBadge tier={s.tier} large />
          <div className="pfd-note">suggested · score {s.score} · {fired} of {available} available signals fired · {pending} pending data</div>
        </div>
      </div>
      <div className="pfd-kpis">
        <div className="pfd-kpi"><small>Paid to {s.state} providers, {s.year}</small><b>{money(s.statePaid)}</b><em>{pct(s.share)} of all US payments for the code</em></div>
        <div className="pfd-kpi"><small>At {s.state}&apos;s enrollment share</small><b>{money(atLine)}</b><em>{pct(s.enrollmentShare, 2)} of {money(s.nationalPaid)} national</em></div>
        <div className="pfd-kpi"><small>Dollars above that line</small><b>{money(s.aboveEnrollment)}</b><em>{money(s.abovePriorShare)} above the prior-year share</em></div>
        <div className="pfd-kpi"><small>Billing providers</small><b>{count(s.billingNpis)}</b><em>{s.newBillingNpis} new in {s.year} · top-10 take {pct(s.top10Share, 0)}</em></div>
        <div className="pfd-kpi"><small>Federal / state split</small><b>{fmap ? `${pct(fmap, 0)} / ${pct(1 - fmap, 0)}` : '—'}</b><em>{fmap ? `FY2024 FMAP ${pct(fmap, 2)}` : 'no published rate'}</em></div>
      </div>
      <div className="pfd-row">
        <div className="pfd-card pfd-grow">
          <h3>Signal checklist · public data</h3>
          {s.checks.map((c, i) => (
            <div className="pfd-check" key={i}><b className={`pfd-check-${KIND[c.kind].cls}`} aria-label={c.kind}>{KIND[c.kind].mark}</b><span>{c.label}</span><em>{c.detail}</em></div>
          ))}
          <p className="pfd-note">! fired · ✓ clear · ? an innocent explanation to rule out · … pending a join or non-public data. Every fired signal has innocent explanations to rule out first: coverage design, bundling elsewhere, a rate change, a new benefit.</p>
        </div>
        <div className="pfd-col-right">
          <div className="pfd-card">
            <h3>Explanation review</h3>
            <table className="pfd-table pfd-compact">
              <tbody>
                {EXPLANATION_QUESTIONS.map((q) => (
                  <tr key={q.id}><td>{q.q}</td><td>
                    <select aria-label={q.q} value={r.answers[q.id] ?? ANSWERS[0]} onChange={(e) => update({ answers: { ...r.answers, [q.id]: e.target.value } }, `${q.q} ${e.target.value}`)}>
                      {ANSWERS.map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </td></tr>
                ))}
                <tr><td>Reviewer disposition</td><td>
                  <select aria-label="Reviewer disposition" value={r.disposition} onChange={(e) => update({ disposition: e.target.value }, `Disposition: ${e.target.value}`)}>
                    {DISPOSITIONS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </td></tr>
              </tbody>
            </table>
            <p className="pfd-note">Kept in this browser session only; nothing is saved or sent.</p>
          </div>
          <div className="pfd-card">
            <h3>Actions</h3>
            <div className="pfd-action-stack">
              <button type="button" className="pfd-btn pfd-btn-danger" onClick={() => setPanel(panel === 'mfcu' ? null : 'mfcu')}>Refer to the Medicaid Fraud Control Unit</button>
              <button type="button" className="pfd-btn" onClick={() => setPanel(panel === 'claims' ? null : 'claims')}>Request state claims: modifiers, units, place of service, county</button>
              <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => setPanel(panel === 'suspend' ? null : 'suspend')}>Payment-suspension review (42 CFR 455.23): credible allegation test</button>
              <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => setPanel(panel === 'joins' ? null : 'joins')}>Run the {pending} pending joins</button>
              <button type="button" className="pfd-btn pfd-btn-ghost" onClick={packet}>Export case packet (Markdown)</button>
              <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => openBlowup(s.id)}>See the program blow-up →</button>
            </div>
            {panel ? <ActionPanel kind={panel} s={s} pending={s.checks.filter((c) => c.kind === 'pending')} onRecord={(line) => update({}, line)} onPacket={packet} /> : null}
            {r.log.length ? <ul className="pfd-log">{r.log.map((l, i) => <li key={i}>{l.at} · {l.line}</li>)}</ul> : null}
          </div>
          <div className="pfd-card">
            <h3>Evidence</h3>
            <p className="pfd-note pfd-tight">
              HHS Open Data: Medicaid Provider Spending by HCPCS (T-MSIS 2018–2024, v{radar.asOf}) · CMS monthly Medicaid and CHIP enrollment · NPPES practice state ·
              {' '}{FMAP_SOURCE}{s.knownCaseId ? ` · known case ${s.knownCaseId}` : ''}. No person-level data; provider identities stay in the authorized system.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function ActionPanel({ kind, s, pending, onRecord, onPacket }) {
  if (kind === 'mfcu') {
    return (
      <div className="pfd-panel">
        <p>A referral goes from the state Medicaid agency&apos;s program-integrity unit to the state Medicaid Fraud Control Unit. DecisionPro does not send it. The packet carries the figures, every signal with its source, the explanation review and the reviewer disposition.</p>
        <button type="button" className="pfd-btn" onClick={() => { onPacket(); onRecord('Prepared a referral packet'); }}>Download the referral packet</button>
      </div>
    );
  }
  if (kind === 'claims') {
    const text = `Request for ${s.state} Medicaid claims, ${s.hcpcs} (${s.codeLabel}), calendar ${s.year - 2}–${s.year}: billing and servicing NPI, modifiers (group vs individual), units per line, place of service, member county, prior-authorization decision, managed care plan. Purpose: test the potential fraud signals in the DecisionPro case file. Aggregate results only leave the authorized system.`;
    return (
      <div className="pfd-panel">
        <p>{text}</p>
        <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => { navigator.clipboard?.writeText(text); onRecord('Copied the claims request'); }}>Copy the request</button>
      </div>
    );
  }
  if (kind === 'suspend') {
    return (
      <div className="pfd-panel">
        <p>Under 42 CFR 455.23 the state must suspend payments to a provider when it finds a credible allegation of fraud, unless good cause applies, and must refer the case to the fraud control unit. A public-data signal alone is not a credible allegation: it needs claims review or other evidence with indicia of reliability. This case is at: <b>{s.tier.label}</b>, screen evidence only.</p>
        <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => onRecord('Reviewed the payment-suspension test: screen evidence only')}>Record the test</button>
      </div>
    );
  }
  return (
    <div className="pfd-panel">
      <p>These joins run in the warehouse, not in the browser:</p>
      <ul className="pfd-list">{pending.map((p, i) => <li key={i}><b>{p.label}</b>: {p.detail}</li>)}</ul>
    </div>
  );
}
