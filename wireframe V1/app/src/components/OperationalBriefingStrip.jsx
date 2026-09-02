import { useState } from 'react';
import { BRIEFING_HEADLINE_RULE, BRIEFING_SOURCE_LABELS } from '../data/operationalBriefings.js';
import { GlossaryText } from './GlossaryTerm.jsx';
import { PlanAccountabilityRecord } from './PlanAccountabilityRecord.jsx';

// Three cards keep the goal tiles within one scroll; "Show all" reveals the rest.
const DEFAULT_VISIBLE = 3;

const KIND_LABELS = {
  observed: 'Observed · joined published facts',
  inferred: 'Inferred ◆ · review prompt',
  gap: 'Gap · evidence not loaded',
};

function RecordBody({ briefing }) {
  const record = briefing.record;
  if (!record) return null;
  if (record.kind === 'mcpar-plan-period' || record.kind === 'sanctions') {
    return <PlanAccountabilityRecord stateCode={briefing.state} program={record.program} mode={record.kind === 'sanctions' ? 'sanctions' : 'plans'} heading={false} />;
  }
  if (record.kind === 'table') {
    return (
      <div className="par-tablewrap">
        <table className="par-table" aria-label={record.caption || briefing.headline}>
          <thead><tr>{record.columns.map((column) => <th key={column.key} className={column.align === 'left' ? 'is-left' : 'is-num'}>{column.label}</th>)}</tr></thead>
          <tbody>
            {record.rows.map((row, index) => (
              <tr key={row.key || index}>
                {record.columns.map((column) => <td key={column.key} className={column.align === 'left' ? 'is-left' : 'is-num'}>{row[column.key] == null || row[column.key] === '' ? '—' : String(row[column.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {record.caption ? <p className="hint">{record.caption}</p> : null}
      </div>
    );
  }
  return null;
}

function BriefingCard({ briefing, goal, onOpenGoal, onOpenRoom }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`ops-briefing-card is-${briefing.kind}`} data-briefing-id={briefing.id}>
      <header className="ops-briefing-card-head">
        <span className={`ops-briefing-kind is-${briefing.kind}`}>{KIND_LABELS[briefing.kind] || briefing.kind}</span>
        <span className="ops-briefing-status">{briefing.status}</span>
        <span className="ops-briefing-asof">as of {briefing.asOf}</span>
      </header>
      <h3 className="ops-briefing-headline"><GlossaryText text={briefing.headline} /></h3>
      <p className="ops-briefing-lede"><GlossaryText text={briefing.lede} /></p>
      {briefing.figures?.length ? (
        <dl className="ops-briefing-figures" aria-label="Key figures">
          {briefing.figures.map((figure) => (
            <div key={figure.label}><dt>{figure.label}</dt><dd>{figure.value}</dd></div>
          ))}
        </dl>
      ) : null}
      <dl className="ops-briefing-meta">
        <div><dt>Validation question</dt><dd><GlossaryText text={briefing.question} /></dd></div>
        <div><dt>Accountable owner</dt><dd><GlossaryText text={briefing.owner} /></dd></div>
        <div><dt>Sources joined</dt><dd>{briefing.sourceSystems.map((id) => BRIEFING_SOURCE_LABELS[id] || id).join(' · ')}</dd></div>
      </dl>
      <p className="ops-briefing-guardrail"><GlossaryText text={briefing.guardrail} /></p>
      <div className="ops-briefing-actions">
        {goal ? (
          <button type="button" className="ops-briefing-open-goal" onClick={() => onOpenGoal?.(goal.id)}>
            Open in {goal.label} →
          </button>
        ) : null}
        {briefing.roomLink && onOpenRoom ? (
          <button type="button" className="ops-briefing-open-room" onClick={() => onOpenRoom(briefing.roomLink.roomId, { filters: { types: briefing.roomLink.types } })}>
            {briefing.roomLink.label || 'Open the list in Funding & Resilience →'}
          </button>
        ) : null}
        {briefing.record ? (
          <button type="button" className="ops-briefing-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide the record ▴' : 'Show the record ▾'}
          </button>
        ) : null}
      </div>
      {open ? <div className="ops-briefing-body"><RecordBody briefing={briefing} /></div> : null}
    </article>
  );
}

/**
 * Operational briefing strip: the ranked cross-source inferences for one
 * state, shown above the goal tiles. Headlines come from governed templates
 * (see BRIEFING_HEADLINE_RULE); every card names its sources, its validation
 * question, and its accountable owner, and opens the goal or the
 * pre-filtered Evidence Room that carries the underlying record.
 */
export function OperationalBriefingStrip({ briefings = [], goals = [], onOpenGoal = null, onOpenRoom = null, stateLabel = '' }) {
  const [showAll, setShowAll] = useState(false);
  if (!briefings.length) return null;
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const visible = showAll ? briefings : briefings.slice(0, DEFAULT_VISIBLE);
  return (
    <section className="ops-briefing-strip" aria-labelledby="ops-briefing-title" data-walkthrough-target="operational-briefing">
      <header className="ops-briefing-head">
        <div>
          <p className="ops-overline"><GlossaryText text="Operational briefing" /></p>
          <h3 id="ops-briefing-title"><GlossaryText text={`What the joined public evidence says today${stateLabel ? ` · ${stateLabel}` : ''}`} /></h3>
          <p className="hint"><GlossaryText text={BRIEFING_HEADLINE_RULE} /></p>
        </div>
        <span className="ops-briefing-count">{briefings.length} briefing{briefings.length === 1 ? '' : 's'}</span>
      </header>
      <div className="ops-briefing-list">
        {visible.map((briefing) => (
          <BriefingCard key={briefing.id} briefing={briefing} goal={goalById.get(briefing.goalId) || null} onOpenGoal={onOpenGoal} onOpenRoom={onOpenRoom} />
        ))}
      </div>
      {briefings.length > DEFAULT_VISIBLE ? (
        <button type="button" className="ops-briefing-show-all" onClick={() => setShowAll((value) => !value)}>
          {showAll ? `Show the top ${DEFAULT_VISIBLE}` : `Show all ${briefings.length} briefings`}
        </button>
      ) : null}
    </section>
  );
}
