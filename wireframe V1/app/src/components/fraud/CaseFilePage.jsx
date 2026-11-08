import { useMemo, useState } from 'react';
import { STATE_NAMES, PATTERN_LABELS } from '../../data/potentialFraudCatalog.js';
import { FEDERAL_MATCHING_RATE_FY2024, FMAP_SOURCE } from '../../data/federalMatchingRate.js';
import { TIER_RULE, CHECK_KINDS } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { money, pct, multiple, count, downloadText, TIER_CLASS } from './fraudFormat.jsx';
import { FRAUD_COLORS, TIER_COLORS, TIER_DISPLAY_ORDER, tierShortLabel } from './fraudVisuals.jsx';

/**
 * Case file: one potential fraud candidate. A tier-grouped list of the state's case files for the
 * year, the dollars against the enrollment line, a grid of every check (fired, clear, rule out,
 * pending), the explanation review, where the case stands, and the actions. Presentation
 * only: the figures and checks are the program's; the reviewer's entries stay in this session.
 */

const TIERS = Object.fromEntries(TIER_RULE.map((t) => [t.key, t]));
/** Tier groups shown open when the page opens; the others start collapsed. */
const OPEN_GROUPS = ['high', 'verify', 'closed'];

const EXPLANATION_QUESTIONS = [
  { id: 'coverage', q: 'Covered standalone here, bundled elsewhere?' },
  { id: 'rate', q: 'Rate, prior-authorization or state plan change dated to the rise?' },
  { id: 'known', q: 'Known case (fraud control unit, OIG, DOJ)?' },
];
const ANSWERS = [
  { key: 'yes', label: 'Yes', text: 'yes: explains it' },
  { key: 'partly', label: 'Partly', text: 'partly' },
  { key: 'no', label: 'No', text: 'no: does not explain it' },
];
/** The packet's text for each answer; '' is not yet answered. */
const ANSWER_TEXT = { '': 'not yet answered', ...Object.fromEntries(ANSWERS.map((a) => [a.key, a.text])) };
/** Where a case stands, in order. */
const STAGES = ['Opened', 'Explanations checked', 'Claims requested', 'Referred', 'Closed'];
const CLOSED_STAGE = STAGES.length - 1;
/** Why a closed case closed. */
const CLOSED_AS = ['billing convention', 'program design', 'known case', 'no issue found'];

const KIND = {
  fired: { mark: '!', label: 'fired' },
  clear: { mark: '✓', label: 'clear' },
  explain: { mark: '?', label: 'rule out' },
  pending: { mark: '…', label: 'pending' },
};

const NEW_REVIEW = Object.freeze({ answers: Object.fromEntries(EXPLANATION_QUESTIONS.map((q) => [q.id, ''])), stage: 0, closedAs: '', log: [] });
const stageText = (r) => (r.stage === CLOSED_STAGE && r.closedAs ? `${STAGES[r.stage]} as ${r.closedAs}` : STAGES[r.stage]);

export function CaseFilePage({ radar, review, byId, focusState, setFocusState, focusId, setFocusId, reviews, setReviews, openBlowup }) {
  const focusedAtOpen = focusId ? byId.get(focusId) : undefined;
  const [year, setYear] = useState(focusedAtOpen && focusedAtOpen.state === focusState ? focusedAtOpen.year : review.LatestYear);
  const [openGroups, setOpenGroups] = useState(OPEN_GROUPS);
  const cases = useMemo(() => review.ServiceYears.filter((s) => s.state === focusState && s.year === year), [review, focusState, year]);
  const focused = focusId && byId.get(focusId)?.state === focusState && byId.get(focusId)?.year === year ? byId.get(focusId) : null;
  const s = focused ?? cases[0] ?? null;
  const summary = review.StateYearSummaries[`${focusState}|${year}`];
  const groups = TIER_DISPLAY_ORDER.map((k) => ({ key: k, rows: cases.filter((c) => c.tier.key === k) })).filter((g) => g.rows.length > 0);
  const isOpen = (k) => openGroups.includes(k) || s?.tier.key === k;

  return (
    <div className="pfd-page">
      <div className="pfd-case-grid">
        <aside className="pfd-caselist" aria-label="Case files">
          <div className="pfd-caselist-pick">
            <select aria-label="State" value={focusState} onChange={(e) => { setFocusState(e.target.value); setFocusId(null); }}>{Object.entries(STATE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select aria-label="Year" value={year} onChange={(e) => { setYear(Number(e.target.value)); setFocusId(null); }}>{review.Years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          </div>
          <div className="pfd-caselist-head">{STATE_NAMES[focusState]} · {year} · {count(summary ? summary.services : 0)} files</div>
          {groups.map((g) => (
            <div key={g.key}>
              <button type="button" className="pfd-caselist-group" aria-expanded={isOpen(g.key)} data-case-group={g.key} onClick={() => setOpenGroups(openGroups.includes(g.key) ? openGroups.filter((k) => k !== g.key) : [...openGroups, g.key])}>
                {isOpen(g.key) ? '▾' : '▸'} {tierShortLabel(TIERS[g.key])} · {count(summary.tiers[g.key].services)}
              </button>
              {isOpen(g.key) ? g.rows.map((c) => (
                <button type="button" key={c.id} className={`pfd-caselist-item${c.id === s?.id ? ' is-on' : ''}`} aria-pressed={c.id === s?.id} data-case={c.id} title={`${c.codeLabel} (${c.hcpcs}) · score ${c.score} · ${c.tier.label}`} onClick={() => setFocusId(c.id)}>
                  <i style={{ background: TIER_COLORS[c.tier.key] }} />
                  <span>{c.codeLabel}</span>
                  <b>{c.score}</b>
                </button>
              )) : null}
            </div>
          ))}
        </aside>
        <div className="pfd-grow pfd-minw0">
          {s ? <CaseDetail key={s.id} radar={radar} s={s} reviews={reviews} setReviews={setReviews} openBlowup={openBlowup} /> : <div className="pfd-card"><p>{STATE_NAMES[focusState]} has no flagged service in {year}.</p></div>}
        </div>
      </div>
    </div>
  );
}

function CaseDetail({ radar, s, reviews, setReviews, openBlowup }) {
  const [panel, setPanel] = useState(null);
  const [checkId, setCheckId] = useState(() => (s.checks.find((c) => c.kind === 'fired') ?? s.checks[0]).id);
  const r = reviews[s.id] ?? NEW_REVIEW;
  const fmap = FEDERAL_MATCHING_RATE_FY2024[s.state];
  const shown = s.checks.find((c) => c.id === checkId);

  function update(patch, logLine) {
    const next = { ...r, ...patch, log: logLine ? [...r.log, { at: new Date().toLocaleTimeString(), line: logLine }] : r.log };
    setReviews({ ...reviews, [s.id]: next });
  }

  function packet() {
    const lines = [
      `# Potential fraud case file: ${STATE_NAMES[s.state]} · ${s.codeLabel} (${s.hcpcs}) · ${s.year}`,
      '',
      'Opened by the DecisionPro national radar. Public data only; a candidate for review, not a finding.',
      `Signal score ${s.score} · suggested tier ${s.tier.label} · where the case stands: ${stageText(r)}`,
      '',
      '## Figures',
      `- Paid to ${s.state} providers, ${s.year}: ${money(s.statePaid)} (${pct(s.share)} of all US payments for the code)`,
      `- At the state's enrollment share (${pct(s.enrollmentShare, 2)}): ${money(s.enrollmentLine)}`,
      `- Above the enrollment line: ${money(s.aboveEnrollment)} · above the prior-year line: ${money(s.abovePriorShare)}`,
      `- Billing providers: ${s.billingNpis}, ${s.newBillingNpis} billing it for the first time; top 10 take ${pct(s.top10Share, 0)}`,
      fmap ? `- Federal / state split at FY2024 FMAP ${pct(fmap, 2)}: ${pct(fmap, 0)} / ${pct(1 - fmap, 0)}` : '',
      '',
      '## Signals',
      ...s.checks.map((c) => `- [${KIND[c.kind].label}] ${c.label}: ${c.detail}`),
      '',
      '## Explanation review',
      ...EXPLANATION_QUESTIONS.map((q) => `- ${q.q} ${ANSWER_TEXT[r.answers[q.id]]}`),
      '',
      '## Evidence',
      `- HHS Open Data, Medicaid Provider Spending by HCPCS (T-MSIS 2018–2024, v${radar.asOf})`,
      '- CMS monthly Medicaid and CHIP enrollment (all states)',
      '- NPPES practice state for attribution',
      `- Screen run ${String(radar.screenRun.completedAt).slice(0, 10)} (${radar.screenLoadHistoryId})`,
      '',
      'No person-level data. Provider identities stay in the authorized system.',
    ];
    downloadText(`case-file-${s.state}-${s.hcpcs}-${s.year}.md`, lines.join('\n'), 'text/markdown');
    update({}, 'Exported the case packet');
  }

  return (
    <>
      <div className="pfd-case-title">
        <h1>{s.codeLabel} · {s.hcpcs}</h1>
        <span className={`pfd-tier pfd-tier-large ${TIER_CLASS[s.tier.key] ?? ''}`} title={`Suggested tier: ${s.tier.label}`}>{tierShortLabel(s.tier)} · {s.score}</span>
      </div>
      <p className="pfd-sub pfd-case-sub">
        Case file · {STATE_NAMES[s.state]} {s.year} · {s.checkCounts.fired} of {s.publicCheckCount} public signals fired · {s.dataCheckCount} checks wait on data ·
        {' '}stands at <b className="pfd-warn" data-case-stage>{stageText(r)}</b> · patterns: {s.patterns.map((p) => PATTERN_LABELS[p]).join(', ')}
      </p>

      <div className="pfd-card">
        <p className="pfd-case-sentence">
          {STATE_NAMES[s.state]} was paid <b>{money(s.statePaid)}</b>, which is {pct(s.share)} of all US payments for this service.
          {' '}Its fair share at {pct(s.enrollmentShare)} of US enrollment would be <b>{money(s.enrollmentLine)}</b>.
        </p>
        <CaseMoneyBar s={s} />
        <div className="pfd-case-facts">
          <span>Billers <b>{count(s.billingNpis)}</b> · {count(s.newBillingNpis)} new</span>
          <span>Top 10 take <b>{pct(s.top10Share, 0)}</b></span>
          <span>Federal / state <b>{fmap ? `${pct(fmap, 0)} / ${pct(1 - fmap, 0)}` : '—'}</b>{fmap ? '' : ' (no published rate)'}</span>
          <span><b>{money(s.abovePriorShare)}</b> above last year&apos;s share</span>
          <span>of {money(s.nationalPaid)} paid nationally</span>
        </div>
      </div>

      <div className="pfd-card">
        <div className="pfd-sg-legend">
          Signals ·
          {CHECK_KINDS.map((k) => <span key={k} className={`pfd-sg-key pfd-sg-${k}`}>{KIND[k].mark} {KIND[k].label} {s.checkCounts[k]}</span>)}
          · click a tile
        </div>
        <div className="pfd-sg" role="group" aria-label="Signal checks">
          {s.checks.map((c) => (
            <button type="button" key={c.id} className={`pfd-sg-tile pfd-sg-${c.kind}${c.id === checkId ? ' is-on' : ''}`} data-check-kind={c.kind} data-check={c.id} aria-pressed={c.id === checkId} title={c.label} onClick={() => setCheckId(c.id)}>
              <b>{KIND[c.kind].mark}</b> {c.shortLabel}
            </button>
          ))}
        </div>
        <p className="pfd-sg-detail" data-check-detail><b>{shown.label}</b>: {shown.detail}</p>
        <p className="pfd-note pfd-tight">Every fired signal has innocent explanations to rule out first: coverage design, bundling elsewhere, a rate change, a new benefit.</p>
      </div>

      <div className="pfd-card">
        <h3>Rule out innocent explanations</h3>
        {EXPLANATION_QUESTIONS.map((q) => (
          <div className="pfd-q" key={q.id}>
            <span>{q.q}</span>
            <span className="pfd-seg" role="group" aria-label={q.q}>
              {ANSWERS.map((a) => (
                <button type="button" key={a.key} className={r.answers[q.id] === a.key ? 'is-on' : ''} aria-pressed={r.answers[q.id] === a.key} title={a.text} data-answer={`${q.id}:${a.key}`} onClick={() => update({ answers: { ...r.answers, [q.id]: a.key } }, `${q.q} ${a.text}`)}>{a.label}</button>
              ))}
            </span>
          </div>
        ))}
        <h3 className="pfd-gap-top">Where this case stands</h3>
        <div className="pfd-stepper" role="group" aria-label="Where this case stands">
          {STAGES.map((st, i) => (
            <button type="button" key={st} className={i <= r.stage ? 'is-on' : ''} aria-pressed={i === r.stage} data-stage={i} onClick={() => update({ stage: i, closedAs: i === CLOSED_STAGE ? r.closedAs : '' }, `Stage: ${st}`)}>{st}</button>
          ))}
        </div>
        {r.stage === CLOSED_STAGE ? (
          <div className="pfd-pillrow pfd-closed-as">
            <span className="pfd-pill-label">Closed as</span>
            {CLOSED_AS.map((c) => (
              <button type="button" key={c} className={`pfd-pill${r.closedAs === c ? ' is-on' : ''}`} aria-pressed={r.closedAs === c} data-closed-as={c} onClick={() => update({ closedAs: c }, `Closed as ${c}`)}>{c}</button>
            ))}
          </div>
        ) : null}
        <p className="pfd-note">Answers stay in this browser session; nothing is saved or sent. Public data only; no provider is named.</p>
      </div>
      <div className="pfd-card">
        <h3>Actions</h3>
        <div className="pfd-actions-row">
          <button type="button" className="pfd-btn pfd-btn-danger" onClick={() => setPanel(panel === 'mfcu' ? null : 'mfcu')}>Refer to the Medicaid Fraud Control Unit</button>
          <button type="button" className="pfd-btn" onClick={() => setPanel(panel === 'claims' ? null : 'claims')}>Request state claims</button>
          <button type="button" className="pfd-btn pfd-btn-ghost" onClick={packet}>Export case packet</button>
          <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => openBlowup(s.id)}>See the program blow-up ↗</button>
          <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => setPanel(panel === 'suspend' ? null : 'suspend')}>Payment-suspension test (42 CFR 455.23)</button>
        </div>
        {panel ? <ActionPanel kind={panel} s={s} onRecord={(line) => update({}, line)} onPacket={packet} /> : null}
        {r.log.length ? <ul className="pfd-log">{r.log.map((l, i) => <li key={i}>{l.at} · {l.line}</li>)}</ul> : null}
        <p className="pfd-note">
          Evidence: HHS Open Data T-MSIS provider spending (2018–2024, v{radar.asOf}) · CMS monthly enrollment · NPPES practice state · {FMAP_SOURCE}
          {s.knownCaseId ? ` · known case ${s.knownCaseId}` : ''}.
        </p>
      </div>
    </>
  );
}

/** Paid against the enrollment line: the fair share in green, the rest of paid in red. */
function CaseMoneyBar({ s }) {
  const W = 520;
  const scale = Math.max(s.statePaid, s.enrollmentLine) || 1;
  const fair = Math.max(2, (Math.min(s.statePaid, s.enrollmentLine) / scale) * W);
  const paid = (s.statePaid / scale) * W;
  const lineX = (s.enrollmentLine / scale) * W;
  return (
    <svg className="pfd-case-bar" viewBox={`0 0 ${W} 46`} role="img" aria-label={`Paid ${money(s.statePaid)} against a fair share of ${money(s.enrollmentLine)}`}>
      <rect x="0" y="6" width={paid} height="16" rx="3" fill={FRAUD_COLORS.flag} />
      <rect x="0" y="6" width={fair} height="16" fill={FRAUD_COLORS.fairShare} />
      {s.enrollmentLine > s.statePaid ? <rect x="0" y="6" width={lineX} height="16" rx="3" fill="none" stroke={FRAUD_COLORS.fairShare} strokeDasharray="4 3" /> : null}
      <text x="4" y="38" className="pfd-case-bar-text">fair share {money(s.enrollmentLine)}</text>
      <text x={W - 4} y="38" textAnchor="end" className="pfd-case-bar-text">
        {s.aboveEnrollment > 0 ? `${money(s.aboveEnrollment)} above it · ${multiple(s.excessMultiple)}` : 'within its fair share'}
      </text>
    </svg>
  );
}

function ActionPanel({ kind, s, onRecord, onPacket }) {
  if (kind === 'mfcu') {
    return (
      <div className="pfd-panel">
        <p>A referral goes from the state Medicaid agency&apos;s program-integrity unit to the state Medicaid Fraud Control Unit. DecisionPro does not send it. The packet carries the figures, every signal with its source, the explanation review and where the case stands.</p>
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
  return (
    <div className="pfd-panel">
      <p>Under 42 CFR 455.23 the state must suspend payments to a provider when it finds a credible allegation of fraud, unless good cause applies, and must refer the case to the fraud control unit. A public-data signal alone is not a credible allegation: it needs claims review or other evidence with indicia of reliability. This case is at: <b>{s.tier.label}</b>, screen evidence only.</p>
      <button type="button" className="pfd-btn pfd-btn-ghost" onClick={() => onRecord('Reviewed the payment-suspension test: screen evidence only')}>Record the test</button>
    </div>
  );
}
