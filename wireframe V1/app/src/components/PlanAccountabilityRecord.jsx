import { useMemo, useState } from 'react';
import { MCPAR_PLAN_PERIOD } from '../data/alp/mcparPlanPeriod.js';
import { GlossaryText } from './GlossaryTerm.jsx';

const PLAN_COLUMNS = [
  { key: 'plan', label: 'Plan', align: 'left' },
  { key: 'enrollment', label: 'Enrollment', kind: 'count' },
  { key: 'mlrPercent', label: 'MLR %', kind: 'number' },
  { key: 'encounterTimelyPercent', label: 'Encounter timely %', kind: 'number' },
  { key: 'overpaymentsReported', label: 'Overpayments reported $', kind: 'usd' },
  { key: 'overpaymentBasisPoints', label: 'bp of premium', kind: 'number', derived: true },
  { key: 'piInvestigationsPer100k', label: 'PI investigations / 100k', kind: 'number', derived: true },
  { key: 'appealsPer1k', label: 'Appeals / 1k', kind: 'number', derived: true },
  { key: 'appealDenialShare', label: 'Appeals denied %', kind: 'percent', derived: true },
  { key: 'grievancesPer1k', label: 'Grievances / 1k', kind: 'number', derived: true },
  { key: 'fairHearingsFiled', label: 'Fair hearings filed', kind: 'count' },
];

const SANCTION_COLUMNS = [
  { key: 'planName', label: 'Plan', align: 'left' },
  { key: 'interventionType', label: 'Intervention', align: 'left' },
  { key: 'interventionTopic', label: 'Topic', align: 'left' },
  { key: 'interventionReason', label: 'Clause or reason as reported', align: 'left', wide: true },
  { key: 'dollarAmount', label: '$' },
  { key: 'noncomplianceInstances', label: 'Instances' },
  { key: 'assessmentDate', label: 'Assessed', align: 'left' },
  { key: 'correctiveActionPlan', label: 'CAP', align: 'left' },
  { key: 'remediationCompleted', label: 'Remediation', align: 'left' },
  { key: 'citedSections', label: 'Contract section (indexed)', align: 'left', wide: true, kind: 'sections' },
];

function citedSectionText(sections) {
  if (!Array.isArray(sections) || !sections.length) return null;
  return sections.map((s) => `${s.sectionNumber} ${s.sectionTitle} · p. ${s.pdfPage}${s.matchedPlanDocument ? '' : ' (common contract structure; plan document not retained)'}`).join(' | ');
}

export function formatRecordValue(value, kind = 'count') {
  if (value == null || value === '') return '—';
  if (kind === 'usd') return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (kind === 'percent') return `${(Number(value) * 100).toFixed(1)}%`;
  if (kind === 'count') return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (kind === 'number') return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return String(value);
}

export function shortProgramName(program = '') {
  const match = program.match(/\(([A-Z]{2,5})\)\s*$/);
  if (match) return match[1];
  if (/dental/i.test(program)) return 'Dental';
  if (/managed care organization contract/i.test(program)) return 'MCO contract';
  return program.replace(/^Statewide Medicaid Managed Care\s*-\s*/i, '').trim();
}

export function largestProgram(stateSlice) {
  const programs = stateSlice?.programs || [];
  return [...programs].sort((a, b) => (b.totals?.enrollment || 0) - (a.totals?.enrollment || 0))[0] || null;
}

function PlanPeriodTable({ program }) {
  const flagsByPlan = new Map(program.plans.map((plan) => [plan.plan, plan.dataQualityFlags || []]));
  return (
    <div className="par-tablewrap">
      <table className="par-table" aria-label={`${shortProgramName(program.program)} plan-period accountability record`}>
        <thead>
          <tr>{PLAN_COLUMNS.map((column) => <th key={column.key} className={column.align === 'left' ? 'is-left' : 'is-num'}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {program.plans.map((plan) => {
            const flags = flagsByPlan.get(plan.plan) || [];
            return (
              <tr key={plan.plan}>
                {PLAN_COLUMNS.map((column) => {
                  if (column.key === 'plan') {
                    return (
                      <td key={column.key} className="is-left">
                        <strong>{plan.plan}</strong>
                        {flags.length ? <small className="par-flag">‡ {flags.map((flag) => flag.id).join(', ')}</small> : null}
                      </td>
                    );
                  }
                  const source = column.derived ? plan.derived : plan.measures;
                  const comparable = column.derived ? program.comparability?.[column.key]?.comparable !== false : true;
                  return (
                    <td key={column.key} className={`is-num${column.derived && !comparable ? ' is-noncomparable' : ''}`} title={column.derived && !comparable ? program.comparability?.[column.key]?.note : undefined}>
                      {formatRecordValue(source?.[column.key], column.kind)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SanctionRecordTable({ program }) {
  const sanctions = program.sanctions;
  if (!sanctions?.records?.length) {
    return <p className="hint"><GlossaryText text={sanctions?.note || 'No sanction records reported for this program.'} /></p>;
  }
  return (
    <div className="par-tablewrap">
      <table className="par-table" aria-label={`${shortProgramName(program.program)} state-reported sanction records`}>
        <thead>
          <tr>{SANCTION_COLUMNS.map((column) => <th key={column.key} className={column.align === 'left' ? 'is-left' : 'is-num'}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {sanctions.records.map((record) => (
            <tr key={record.index}>
              {SANCTION_COLUMNS.map((column) => {
                const value = column.kind === 'sections' ? citedSectionText(record[column.key]) : record[column.key];
                const remediationOpen = column.key === 'remediationCompleted' && /^no|in progress/i.test(String(value || ''));
                return (
                  <td key={column.key} className={`${column.align === 'left' ? 'is-left' : 'is-num'}${column.wide ? ' is-wide' : ''}${remediationOpen ? ' is-open' : ''}`}>
                    {value == null || value === '' ? (column.kind === 'sections' ? 'no section number cited' : '—') : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparabilityStrip({ program }) {
  const entries = Object.entries(program.comparability || {});
  if (!entries.length) return null;
  const labels = Object.fromEntries(PLAN_COLUMNS.filter((c) => c.derived).map((c) => [c.key, c.label]));
  return (
    <ul className="par-comparability" aria-label="Measure comparability">
      {entries.map(([key, entry]) => (
        <li key={key} className={entry.comparable ? 'is-comparable' : 'is-noncomparable'} title={entry.note}>
          <span>{labels[key] || key}</span>
          <strong>{entry.dispersion == null ? 'n/a' : `${entry.dispersion}×`}</strong>
          <small>{entry.comparable ? 'comparable' : 'non-comparable'}</small>
        </li>
      ))}
    </ul>
  );
}

/**
 * The plan × program × reporting-period accountability record built by the
 * warehouse from the retained MCPAR PUF. mode: 'full' | 'plans' | 'sanctions'.
 */
export function PlanAccountabilityRecord({ stateCode = 'KY', program: programName = null, mode = 'full', heading = true }) {
  const state = String(stateCode).toUpperCase() === 'FL' ? 'FL' : 'KY';
  const slice = MCPAR_PLAN_PERIOD.byState[state];
  const programs = slice?.programs || [];
  const initial = useMemo(() => programs.find((p) => p.program === programName) || largestProgram(slice), [programs, programName, slice]);
  const [selectedProgram, setSelectedProgram] = useState(initial?.program || null);
  const program = programs.find((p) => p.program === selectedProgram) || initial;

  if (!slice || !program) {
    return (
      <section className="par-record" aria-label="Plan-period accountability record">
        <p className="hint">{slice?.gap?.reason || 'The MCPAR plan-period record is not available for this state.'}</p>
      </section>
    );
  }

  const flagged = program.plans.flatMap((plan) => (plan.dataQualityFlags || []).map((flag) => ({ plan: plan.plan, ...flag })));

  return (
    <section className="par-record" aria-label={`${state} plan-period accountability record`} data-par-state={state}>
      {heading ? (
        <header className="par-head">
          <div>
            <p className="ops-overline"><GlossaryText text="Plan-period accountability record" /></p>
            <h4><GlossaryText text={`${state === 'FL' ? 'Florida' : 'Kentucky'} plan × program, MCPAR ${MCPAR_PLAN_PERIOD.reportingYear}`} /></h4>
            <p className="hint"><GlossaryText text="Every cell is a state-reported annual response: an investigation lead, never proof of breach. Derived ratios shaded amber are non-comparable until the reporting definition is confirmed." /></p>
          </div>
          {programs.length > 1 ? (
            <label className="par-program-select">
              Program
              <select value={program.program} onChange={(event) => setSelectedProgram(event.target.value)}>
                {programs.map((p) => <option key={p.program} value={p.program}>{shortProgramName(p.program)} · {p.plans.length} plan{p.plans.length === 1 ? '' : 's'}</option>)}
              </select>
            </label>
          ) : null}
        </header>
      ) : null}

      {mode !== 'sanctions' ? (
        <>
          <PlanPeriodTable program={program} />
          <ComparabilityStrip program={program} />
          {flagged.length ? (
            <ul className="par-flags" aria-label="Publisher-side data-quality flags">
              {flagged.map((flag) => <li key={`${flag.plan}-${flag.id}`}><strong>‡ {flag.plan}</strong> — {flag.text}</li>)}
            </ul>
          ) : null}
        </>
      ) : null}

      {mode !== 'plans' ? (
        <div className="par-sanctions">
          <h5><GlossaryText text={`State-reported sanction, corrective-action, and compliance-letter records (${program.sanctions?.records?.length || 0})`} /></h5>
          <SanctionRecordTable program={program} />
          {program.sanctions?.byPlan?.length ? (
            <p className="hint">
              By plan: {program.sanctions.byPlan.map((row) => `${row.plan} ${row.records}${row.notRemediated ? ` (${row.notRemediated} not remediated)` : ''}`).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}

      <footer className="par-provenance hint">
        {state === 'KY' && program.sanctions?.records?.some((record) => record.citedSections?.length) ? (
          <>Contract sections resolved against the retained Kentucky MCO contract PDFs (section index; applicability is the reviewer's determination). </>
        ) : null}
        Source: CMS MCPAR PUF {MCPAR_PLAN_PERIOD.reportingYear} · {slice.rowCount.toLocaleString()} {state} rows re-read from the retained PSA file
        {slice.source?.contentHash ? ` (sha256 ${slice.source.contentHash.slice(0, 12)}…)` : ''} · reconciliation {MCPAR_PLAN_PERIOD.reconciliation?.status}
        {' · '}No submitter or contact fields are read from the publisher file.
      </footer>
    </section>
  );
}
