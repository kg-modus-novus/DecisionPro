import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KY_RECOVERY_RECONCILIATION, recoveryReconciliationTotals } from '../data/alp/kyRecoveryReconciliation.js';
import { GlossaryText } from './GlossaryTerm.jsx';

const DISPOSITIONS = [
  ['awaiting-evidence', 'Awaiting evidence'],
  ['recovered', 'Recovered'],
  ['outstanding', 'Outstanding'],
  ['duplicate', 'Duplicate'],
  ['non-actionable', 'Non-actionable'],
  ['disputed', 'Disputed'],
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 4, maximumFractionDigits: 4 });

const HELP = {
  period: ['Review period', 'The reporting period represented by the loaded MCPAR source. CY 2024 is the only governed period currently loaded, so it is fixed on this screen rather than presented as a choice that does not exist. To inspect source availability, return to the Decision case and open the Data Sources tab. A Data Steward must run the governed ingestion process before another period can appear here.'],
  scope: ['Plan scope', 'The plan rows included in the summary, estimates, table, and downloaded files. Choose all six plans or one plan using this control.'],
  plan: ['Plan', 'The Kentucky managed-care reporting entity named in the official MCPAR public-use file. DecisionPro aligns records at plan and reporting-period grain.'],
  candidate: ['Reported candidate', 'Provider-overpayment dollars reported by the plan in MCPAR question D1.X.9c. This is a candidate pool—not confirmed debt, waste, recovery, or savings.'],
  premium: ['Premium / share', 'Corresponding annual premium revenue from MCPAR question D1.X.9d and the reported candidate divided by that premium. The ratio supplies scale context only.'],
  evidence: ['DPro evidence status', 'Whether DecisionPro has the authorized evidence needed to classify recovery. Public MCPAR does not contain plan-level recovery status, so every row starts awaiting an authorized record.'],
  disposition: ['Reviewer disposition', 'The human-reviewed classification supported by the authorized recovery record: recovered, outstanding, duplicate, non-actionable, disputed, or still awaiting evidence.'],
  recovered: ['Recovered amount', 'The amount actually recovered according to an authorized record. Enter a value only after selecting Recovered. The smaller value below is a 25% planning sensitivity case—not a confirmed amount and not a value to copy into this field without evidence.'],
  reference: ['Evidence reference / notes', 'The non-PHI PI-06, PI-02, CP-06, recovery-ledger, payment-record, or case reference supporting the disposition, plus reviewer context.'],
  plans: ['Plans in scope', 'Count of Kentucky plans currently included by the Plan scope control on this screen. DecisionPro matched all six loaded plans to a reported candidate and reporting period.'],
  pool: ['Reported candidate pool', 'Sum of all six MCPAR plan-reported candidate amounts. It is exact for the loaded public file but is not a recovery forecast.'],
  confirmedRecovered: ['Confirmed recovered', 'Sum of reviewer-entered recovered amounts for rows classified Recovered. Zero means no authorized recovery evidence has yet been entered in this session.'],
  confirmedOutstanding: ['Confirmed outstanding', 'Sum of reported candidates for rows a reviewer classified Outstanding. Zero means no row has yet been confirmed outstanding in this session.'],
  awaiting: ['Awaiting evidence', 'Number of plan rows that still require an authorized recovery record and reviewer classification.'],
  scenario: ['Planning recovery scenario', 'A sensitivity range, not a forecast. Low, planning, and high cases apply 10%, 25%, and 50% to the public candidate pool because no governed Kentucky historical recovery-rate series is available.'],
  effort: ['Estimated review effort', 'Six plans multiplied by an estimated 12–20 hours per plan for record retrieval, contract/period validation, classification, and review.'],
  cost: ['Estimated review cost', 'Estimated review hours multiplied by an assumed loaded staff cost of $60–$80 per hour. This excludes litigation, audit, system remediation, and collection costs.'],
  duration: ['Estimated duration', 'A 3–6 week elapsed planning range after authorized evidence is available, assuming plan reviews can proceed partly in parallel.'],
};

function HelpButton({ helpKey, compact = false }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const [title, explanation] = HELP[helpKey];

  const closeHelp = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeHelp();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const popover = open ? createPortal(
    <span className="recovery-help-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeHelp(); }}>
      <span className="recovery-help-popover" role="dialog" aria-modal="true" aria-label={`${title} explanation`} onMouseDown={(event) => event.stopPropagation()}>
        <strong><GlossaryText text={title} /></strong>
        <span><GlossaryText text={explanation} /></span>
        <button ref={closeRef} type="button" onClick={closeHelp} aria-label={`Close ${title} explanation`}>Close</button>
      </span>
    </span>,
    document.body,
  ) : null;

  return (
    <>
      <span className={`recovery-help${compact ? ' is-compact' : ''}`}>
        <button ref={triggerRef} type="button" aria-label={`Explain ${title}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>?</button>
      </span>
      {popover}
    </>
  );
}

function LabelWithHelp({ children, helpKey }) {
  return <span className="recovery-label-help"><span><GlossaryText text={children} /></span><HelpButton helpKey={helpKey} /></span>;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RecoveryReconciliationWorkspace({ onBack, data = KY_RECOVERY_RECONCILIATION }) {
  const [rows, setRows] = useState(() => data.rows.map((row) => ({ ...row })));
  const selectedPeriod = data.reportingPeriod.label;
  const [selectedScope, setSelectedScope] = useState('all');
  const workspaceRef = useRef(null);
  const headingRef = useRef(null);
  const topTableScrollRef = useRef(null);
  const tableScrollRef = useRef(null);
  const visibleRows = useMemo(
    () => (selectedScope === 'all' ? rows : rows.filter((row) => row.id === selectedScope)),
    [rows, selectedScope],
  );
  const totals = useMemo(() => recoveryReconciliationTotals(visibleRows), [visibleRows]);
  const assumptions = data.planningEstimate;
  const estimates = useMemo(() => ({
    lowRecovery: totals.reportedCandidate * assumptions.lowRecoveryRate,
    planningRecovery: totals.reportedCandidate * assumptions.planningRecoveryRate,
    highRecovery: totals.reportedCandidate * assumptions.highRecoveryRate,
    lowHours: visibleRows.length * assumptions.reviewHoursPerPlanLow,
    highHours: visibleRows.length * assumptions.reviewHoursPerPlanHigh,
    lowCost: visibleRows.length * assumptions.reviewHoursPerPlanLow * assumptions.loadedHourlyCostLow,
    highCost: visibleRows.length * assumptions.reviewHoursPerPlanHigh * assumptions.loadedHourlyCostHigh,
  }), [assumptions, visibleRows.length, totals.reportedCandidate]);

  useEffect(() => {
    workspaceRef.current?.scrollIntoView?.({ block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const updateRow = (id, field, value) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const syncTableScroll = (source, target) => {
    if (target.current && target.current.scrollLeft !== source.currentTarget.scrollLeft) {
      target.current.scrollLeft = source.currentTarget.scrollLeft;
    }
  };

  const exportReview = () => downloadCsv(
    'decisionpro-ky-recovery-reconciliation-review.csv',
    ['plan', 'reporting_period', 'reported_candidate', 'premium_revenue', 'candidate_share_of_premium', 'evidence_status', 'reviewer_disposition', 'recovered_amount', 'evidence_reference', 'reviewer_notes'],
    visibleRows.map((row) => [row.plan, selectedPeriod, row.reportedCandidate.toFixed(2), row.premiumRevenue.toFixed(2), row.candidateShareOfPremium.toFixed(8), row.evidenceStatus, row.disposition, row.recoveredAmount, row.evidenceReference, row.reviewerNotes]),
  );

  const exportTemplate = () => downloadCsv(
    'decisionpro-ky-authorized-recovery-status-template.csv',
    ['plan', 'recovery_status', 'recovered_amount', 'recovery_date', 'evidence_reference', 'reviewer', 'notes'],
    visibleRows.map((row) => [row.plan, '', '', '', '', '', '']),
  );

  return (
    <section ref={workspaceRef} className="recovery-workspace" aria-labelledby="recovery-workspace-title">
      <header className="recovery-workspace-head">
        <button type="button" className="ops-goal-detail-back" onClick={onBack}>← Decision case</button>
        <div>
          <p className="ops-overline"><GlossaryText text="DecisionPro prepared deliverable" /></p>
          <h3 ref={headingRef} id="recovery-workspace-title" tabIndex="-1"><GlossaryText text="Recovery reconciliation — ready for review" /></h3>
          <p><GlossaryText text="DecisionPro populated the public-source evidence and built the six-plan review queue. A reviewer supplies only the authorized recovery disposition and evidence reference." /></p>
        </div>
      </header>

      <section className="recovery-use-guide" aria-labelledby="recovery-use-title">
        <header><p className="ops-overline"><GlossaryText text="How to use this screen" /></p><h4 id="recovery-use-title"><GlossaryText text="DecisionPro prepared the work; complete the evidence-backed review" /></h4></header>
        <ol>
          <li><GlossaryText text={`Confirm the period on this screen: in Review setup immediately below, verify the fixed Review period of ${data.reportingPeriod.label}. It comes from the only governed MCPAR package currently loaded. To add another period, a data operator must run the governed MCPAR ingestion outside this dashboard; there is no period-change action on this screen.`} /></li>
          <li><GlossaryText text="Choose the scope on this screen: in Review setup, use Plan scope to review all six plans or one named plan. That control updates the summary, estimates, table, and downloaded files." /></li>
          <li><GlossaryText text="Review what DecisionPro prepared on this screen: check the candidate pool, planning estimates, plan alignment, premium context, and evidence-status columns." /></li>
          <li><GlossaryText text="Obtain the missing authorized evidence: click Download recovery-status template on this screen, then have the DMS program-integrity or finance owner populate it from PI-06, PI-02, CP-06, the recovery ledger, or a payment record outside DecisionPro. Do not use PHI." /></li>
          <li><GlossaryText text="Record the review on this screen: in each plan row, select Reviewer disposition and enter Recovered amount, Evidence reference, and Reviewer notes when supported." /></li>
          <li><GlossaryText text="Share the result from this screen: click Download review workpaper. Current edits are session-only until governed persistence is implemented." /></li>
        </ol>
      </section>

      <section className="recovery-view-controls" aria-labelledby="recovery-view-controls-title">
        <h4 id="recovery-view-controls-title">Review setup</h4>
        <div>
          <div className="recovery-control-label"><label htmlFor="recovery-period">Review period</label><HelpButton helpKey="period" compact /></div>
          <select id="recovery-period" value={selectedPeriod} disabled aria-describedby="recovery-period-help">
            <option value={data.reportingPeriod.label}>{data.reportingPeriod.label} — only loaded period</option>
          </select>
          <small id="recovery-period-help"><GlossaryText text="Read-only on this screen. To inspect availability, click ← Decision case, then open the Data Sources tab. A Data Steward must load a newer governed MCPAR package before another period can appear here." /></small>
        </div>
        <div>
          <div className="recovery-control-label"><label htmlFor="recovery-scope">Plan scope</label><HelpButton helpKey="scope" compact /></div>
          <select id="recovery-scope" value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)}>
            <option value="all">All {rows.length} plans</option>
            {rows.map((row) => <option key={row.id} value={row.id}>{row.plan}</option>)}
          </select>
          <small><GlossaryText text="Choose all plans or one plan. This changes the table, calculations, and downloaded files." /></small>
        </div>
        <p><strong>Current view:</strong> {selectedPeriod} · {selectedScope === 'all' ? `All ${rows.length} plans` : visibleRows[0]?.plan}</p>
      </section>

      <div className="recovery-boundary" role="status">
        <strong><GlossaryText text="What DecisionPro completed" /></strong>
        <span><GlossaryText text="Plan alignment, reported candidate amounts, premium context, period, source provenance, Kentucky authority locator, calculation, review controls, and export." /></span>
        <strong><GlossaryText text="What remains for DMS review" /></strong>
        <span><GlossaryText text="Confirm each recovery status against an authorized PI-06, PI-02, CP-06, recovery-ledger, or payment record." /></span>
      </div>

      <div className="recovery-summary" aria-label="Reconciliation summary">
        <div><LabelWithHelp helpKey="plans">Plans in current scope</LabelWithHelp><strong>{visibleRows.length}</strong><small>of {rows.length} loaded</small></div>
        <div><LabelWithHelp helpKey="pool">Reported candidate pool</LabelWithHelp><strong>{money.format(totals.reportedCandidate)}</strong></div>
        <div><LabelWithHelp helpKey="confirmedRecovered">Confirmed recovered</LabelWithHelp><strong>{money.format(totals.confirmedRecovered)}</strong><small><GlossaryText text={`${money.format(estimates.planningRecovery)} planning scenario`} /></small></div>
        <div><LabelWithHelp helpKey="confirmedOutstanding">Confirmed outstanding</LabelWithHelp><strong>{money.format(totals.confirmedOutstanding)}</strong><small>{money.format(totals.reportedCandidate - totals.confirmedRecovered - totals.confirmedOutstanding)} remains unclassified</small></div>
        <div><LabelWithHelp helpKey="awaiting">Awaiting evidence</LabelWithHelp><strong>{totals.awaitingEvidence}</strong></div>
      </div>

      <section className="recovery-estimates" aria-labelledby="recovery-estimates-title">
        <header><div><p className="ops-overline"><GlossaryText text="Planning estimates—not confirmed findings" /></p><h4 id="recovery-estimates-title"><GlossaryText text="What review could require and potentially yield" /></h4></div><p><GlossaryText text={assumptions.justification} /></p></header>
        <div>
          <article><LabelWithHelp helpKey="scenario">Planning recovery scenario</LabelWithHelp><strong>{money.format(estimates.lowRecovery)}–{money.format(estimates.highRecovery)}</strong><small><GlossaryText text={`Planning case: ${money.format(estimates.planningRecovery)}`} /></small></article>
          <article><LabelWithHelp helpKey="effort">Estimated review effort</LabelWithHelp><strong>{estimates.lowHours}–{estimates.highHours} staff hours</strong><small>{assumptions.reviewHoursPerPlanLow}–{assumptions.reviewHoursPerPlanHigh} hours × {visibleRows.length} {visibleRows.length === 1 ? 'plan' : 'plans'}</small></article>
          <article><LabelWithHelp helpKey="cost">Estimated review cost</LabelWithHelp><strong>{money.format(estimates.lowCost)}–{money.format(estimates.highCost)}</strong><small>At {money.format(assumptions.loadedHourlyCostLow)}–{money.format(assumptions.loadedHourlyCostHigh)} per loaded hour</small></article>
          <article><LabelWithHelp helpKey="duration">Estimated duration</LabelWithHelp><strong>{assumptions.elapsedWeeksLow}–{assumptions.elapsedWeeksHigh} weeks</strong><small>After authorized records are available</small></article>
        </div>
      </section>

      <div className="recovery-toolbar">
        <div>
          <button type="button" onClick={exportReview}>Download review workpaper</button>
          <button type="button" className="secondary" onClick={exportTemplate}>Download recovery-status template</button>
        </div>
        <p><GlossaryText text="Session review: edits below are not yet persisted. Plan-level or aggregate evidence only—do not use PHI or person-level records." /></p>
      </div>

      <div className="recovery-table-shell">
        <div
          ref={topTableScrollRef}
          className="recovery-horizontal-scroll"
          role="region"
          aria-label="Horizontal table scroll"
          tabIndex="0"
          onScroll={(event) => syncTableScroll(event, tableScrollRef)}
        ><div aria-hidden="true" /></div>
        <div ref={tableScrollRef} className="recovery-table-wrap" onScroll={(event) => syncTableScroll(event, topTableScrollRef)}>
          <table className="recovery-table">
          <caption>Plan-by-plan public evidence and reviewer disposition</caption>
          <thead><tr><th><LabelWithHelp helpKey="plan">Plan</LabelWithHelp></th><th><LabelWithHelp helpKey="candidate">Reported candidate</LabelWithHelp></th><th><LabelWithHelp helpKey="premium">Premium / share</LabelWithHelp></th><th><LabelWithHelp helpKey="evidence">DPro evidence status</LabelWithHelp></th><th><LabelWithHelp helpKey="disposition">Reviewer disposition</LabelWithHelp></th><th><LabelWithHelp helpKey="recovered">Recovered amount</LabelWithHelp></th><th><LabelWithHelp helpKey="reference">Evidence reference / notes</LabelWithHelp></th></tr></thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} data-recovery-plan={row.id}>
                <th scope="row">{row.plan}<small>{data.reportingPeriod.label}</small></th>
                <td className="numeric">{money.format(row.reportedCandidate)}</td>
                <td className="numeric">{money.format(row.premiumRevenue)}<small>{percent.format(row.candidateShareOfPremium)}</small></td>
                <td><span className="recovery-status"><GlossaryText text={row.evidenceStatus} /></span></td>
                <td><div className="recovery-field"><label><span className="sr-only">Disposition for {row.plan}</span><select value={row.disposition} onChange={(event) => updateRow(row.id, 'disposition', event.target.value)}>{DISPOSITIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><HelpButton helpKey="disposition" compact /></div></td>
                <td><div className="recovery-field"><label><span className="sr-only">Recovered amount for {row.plan}</span><input type="number" min="0" step="0.01" value={row.recoveredAmount} disabled={row.disposition !== 'recovered'} placeholder={row.disposition === 'recovered' ? 'Enter confirmed amount' : 'Needs recovered status'} onChange={(event) => updateRow(row.id, 'recoveredAmount', event.target.value)} /></label><HelpButton helpKey="recovered" compact /></div><small className="recovery-field-estimate"><GlossaryText text={`25% planning scenario: ${money.format(row.reportedCandidate * assumptions.planningRecoveryRate)}`} /></small></td>
                <td><div className="recovery-field"><label><span className="sr-only">Evidence reference for {row.plan}</span><input value={row.evidenceReference} placeholder="PI-06 / ledger reference" onChange={(event) => updateRow(row.id, 'evidenceReference', event.target.value)} /></label><HelpButton helpKey="reference" compact /></div><label><span className="sr-only">Reviewer notes for {row.plan}</span><textarea rows="2" value={row.reviewerNotes} placeholder="Explain the evidence and decision" onChange={(event) => updateRow(row.id, 'reviewerNotes', event.target.value)} /></label></td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      <section className="recovery-authority">
        <div><p className="ops-overline"><GlossaryText text="Kentucky authority locator" /></p><h4><GlossaryText text={data.authority.contractLocation} /></h4><p><GlossaryText text={`${data.authority.standard}. ${data.authority.summary}`} /></p></div>
        <div><p className="ops-overline"><GlossaryText text="Reported monitoring path" /></p><p><GlossaryText text={data.authority.monitoring} /></p></div>
        <div><p className="ops-overline"><GlossaryText text="Source provenance" /></p><p><GlossaryText text={`${data.source.title} · ${data.reportingPeriod.label}`} /></p><a href={data.source.uri} target="_blank" rel="noreferrer">Open official source ↗</a></div>
      </section>

      <p className="recovery-guardrail"><GlossaryText text={`Decision guardrail: ${data.completionBoundary}`} /></p>
    </section>
  );
}
