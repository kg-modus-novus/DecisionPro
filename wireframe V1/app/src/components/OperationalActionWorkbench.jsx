import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { rankRecommendationsForReview } from '../data/operationalGoals.js';
import { GlossaryText } from './GlossaryTerm.jsx';
import { RecoveryReconciliationWorkspace } from './RecoveryReconciliationWorkspace.jsx';

const KIND_LABELS = {
  input: 'Evidence input',
  transformation: 'Analysis & transformation',
  action: 'Potential action',
};

function SourceList({ sourceIds = [], sources = [] }) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const resolved = sourceIds.map((id) => byId.get(id)).filter(Boolean);
  if (!resolved.length) return <span><GlossaryText text="DecisionPro governed business rule" /></span>;
  return (
    <ul className="ops-explain-sources">
      {resolved.map((source) => (
        <li key={source.id}>
          <a href={source.href} target="_blank" rel="noreferrer">{source.label}</a>
          <span><GlossaryText text={`${source.publisher} · ${source.cadence}`} /></span>
        </li>
      ))}
    </ul>
  );
}

function ExplanationDialog({ item, goal, decisionCase, sources, onClose }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!item) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('a[href], button:not([disabled])') || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="ops-explain-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="ops-explain-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ops-explain-title"
      >
        <header>
          <div>
            <p className="ops-overline"><GlossaryText text={KIND_LABELS[item.kind]} /></p>
            <h3 id="ops-explain-title"><GlossaryText text={item.title} /></h3>
            <p><GlossaryText text={`${goal.label} · ${decisionCase.title}`} /></p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close explanation">
            Close
          </button>
        </header>

        <div className="ops-explain-grid">
          {item.kind !== 'action' ? (
            <section>
              <h4>What it is</h4>
              <p><GlossaryText text={item.summary} /></p>
              {item.value ? <p className="ops-explain-value">{item.value}</p> : null}
              {item.asOf ? <p className="hint"><GlossaryText text={`As of / status: ${item.asOf}`} /></p> : null}
            </section>
          ) : (
            <section className="ops-explain-primary">
              <h4>What needs to happen</h4>
              <p><GlossaryText text={item.summary} /></p>
            </section>
          )}

          {item.kind === 'input' ? (
            <section>
              <h4>Where it comes from</h4>
              <SourceList sourceIds={item.sources} sources={sources} />
            </section>
          ) : null}

          {item.kind === 'transformation' ? (
            <section>
              <h4>How DecisionPro transforms it</h4>
              <p><GlossaryText text={item.method} /></p>
            </section>
          ) : null}

          {item.kind === 'action' ? (
            <>
              <section>
                <h4>Who needs to do it</h4>
                <p><GlossaryText text={item.owner} /></p>
                <p className="hint"><strong>Authority:</strong> <GlossaryText text={item.authority} /></p>
              </section>
              <section>
                <h4>How they do it</h4>
                <ol>{item.how.map((value) => <li key={value}><GlossaryText text={value} /></li>)}</ol>
              </section>
              <section>
                <h4>Expected benefit</h4>
                <p><GlossaryText text={item.expectedImpact} /></p>
              </section>
              <section>
                <h4>How long it should take</h4>
                <p><GlossaryText text={item.timeHorizon} /></p>
              </section>
              <section className="ops-explain-financial">
                <h4>Estimated cost and savings</h4>
                <dl>
                  <div><dt>Estimated cost</dt><dd><GlossaryText text={item.estimatedCost} /></dd></div>
                  <div><dt>Estimated savings</dt><dd><GlossaryText text={item.estimatedSavings} /></dd></div>
                </dl>
              </section>
              <section>
                <h4>Decision status</h4>
                <dl>
                  <div><dt>Review priority</dt><dd>P{item.reviewPriority}</dd></div>
                  <div><dt>Implementation status</dt><dd><GlossaryText text={item.implementationPriority} /></dd></div>
                </dl>
              </section>
              <section>
                <h4>Prerequisites</h4>
                <ul>{item.prerequisites.map((value) => <li key={value}><GlossaryText text={value} /></li>)}</ul>
              </section>
              <section>
                <h4>How success is measured</h4>
                <ul>{item.successMeasures.map((value) => <li key={value}><GlossaryText text={value} /></li>)}</ul>
              </section>
            </>
          ) : null}

          {item.kind !== 'action' ? (
            <section>
              <h4>How it affects people, services, spending or oversight</h4>
              <p><GlossaryText text={item.impact} /></p>
              <p className="hint"><GlossaryText text={`Case impact lenses: ${decisionCase.impactLenses.join(' · ')}`} /></p>
            </section>
          ) : null}

          <section className="ops-explain-guardrail">
            <h4><GlossaryText text={item.kind === 'action' ? 'Decision guardrail' : 'Limitation'} /></h4>
            <p><GlossaryText text={item.guardrail || item.limitation} /></p>
          </section>
        </div>
      </section>
    </div>
  );
}

function lowerFirst(value = '') {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
}

function GoalTile({ goal, onSelect }) {
  return (
    <article
      className="ops-goal-tile"
      onClick={(event) => onSelect(event.currentTarget.querySelector('.ops-goal-open'))}
    >
      <span className="ops-goal-intent">If you want to</span>
      <strong><GlossaryText text={goal.label} /></strong>
      <span className="ops-goal-invitation"><GlossaryText text={`Click here to ${lowerFirst(goal.objective)}`} /></span>
      <button type="button" className="ops-goal-open" aria-label={`If you want to ${goal.label}, click here to ${lowerFirst(goal.objective)}`}>Open goal →</button>
    </article>
  );
}

function GoalUseGuide({ goal, opportunity }) {
  const decisionCase = goal.cases.find((item) => item.id === opportunity.caseId);
  const selectedAction = decisionCase?.actions.find((item) => item.id === opportunity.actionId);
  return (
    <section className="ops-goal-use-guide" aria-labelledby={`goal-use-${goal.id}`}>
      <header>
        <p className="ops-overline"><GlossaryText text="How to use this opportunity" /></p>
        <h4 id={`goal-use-${goal.id}`}><GlossaryText text="What to do on this screen" /></h4>
        <p><GlossaryText text={`Use this page to evaluate “${opportunity.headline}” and decide whether its modeled benefit is worth pursuing.`} /></p>
      </header>
      <ol>
        <li><strong><GlossaryText text="Check the benefit calculation above." /></strong> <GlossaryText text="It identifies the absolute modeled benefit, relative improvement, baseline, and assumptions." /></li>
        <li><strong><GlossaryText text="Read left to right on this screen:" /></strong> <GlossaryText text="Inputs show what DecisionPro has, Analysis and transformations show how it was interpreted, and Potential actions show who can act and what benefit to test." /></li>
        <li><strong><GlossaryText text="Click any input or transformation card" /></strong> <GlossaryText text="to see its source, method, effect, and limitation before accepting the recommendation." /></li>
        <li>
          <strong><GlossaryText text="Open the recommended action under Potential actions on this screen." /></strong>{' '}
          {selectedAction?.deliverableId
            ? <GlossaryText text={`Choose “${selectedAction.title}.” It opens the DecisionPro-prepared workpaper and the controls used to complete its review.`} />
            : <GlossaryText text={`Choose “${selectedAction?.title}.” Its explanation identifies the accountable owner, required evidence, method, benefit, timing, and cost basis. No separate execution screen exists for this action in this release.`} />}
        </li>
      </ol>
      <p className="ops-goal-use-boundary"><strong>Period, scope, and source details:</strong> <GlossaryText text="this opportunity detail is not a filter screen. Read the period/status on each Input card; click that card for its exact source and limitation. Use the Evidence and Data tab above for loaded evidence, or the Data Sources tab above for source availability. If a prepared workpaper supports filtering, its controls appear at the top of that workpaper and the instructions name them." /></p>
    </section>
  );
}

function buildGoalOpportunities(goal) {
  return goal.cases.flatMap((decisionCase) => (
    rankRecommendationsForReview(decisionCase.actions).map((actionItem, index) => {
      const evidenceInput = decisionCase.inputs[Math.min(index, decisionCase.inputs.length - 1)] || decisionCase.inputs[0];
      const authored = actionItem.opportunity || {};
      return {
        id: actionItem.id,
        caseId: decisionCase.id,
        actionId: actionItem.id,
        headline: authored.headline || actionItem.title,
        absoluteHeading: authored.absoluteHeading || 'Modeled absolute benefit',
        absoluteValue: authored.absoluteValue || '1 scoped result',
        absoluteLabel: authored.absoluteLabel || 'modeled absolute benefit from completing the scoped action',
        improvementHeading: authored.improvementHeading || 'Modeled improvement',
        improvementValue: authored.improvementValue || '100%',
        improvementLabel: authored.improvementLabel || 'scoped completion target',
        calculationBasis: authored.calculationBasis || 'Planning target for the scoped action; replace with a measured baseline and result when available.',
        analyzed: authored.analyzed || `${evidenceInput?.value || 'the loaded'} ${lowerFirst(evidenceInput?.title || 'governed evidence')}`,
        finding: authored.finding || actionItem.summary,
        potential: authored.potential || actionItem.expectedImpact,
        confidence: authored.confidence || decisionCase.confidence,
        caveat: authored.caveat || 'Potential outcome—not a confirmed finding, savings forecast, or implementation decision.',
      };
    })
  ));
}

function GoalOpportunityPanel({ goal, opportunities, onSelect }) {
  return (
    <section className="ops-opportunity-panel" aria-labelledby={`opportunity-title-${goal.id}`}>
      <header>
        <div>
          <p className="ops-overline"><GlossaryText text="What you can get from this page" /></p>
          <h4 id={`opportunity-title-${goal.id}`}><GlossaryText text={`DecisionPro analyzed evidence showing ${goal.leadValue} ${goal.leadLabel}`} /></h4>
          <p><GlossaryText text="Choose an opportunity to focus the evidence, analysis, and recommended action." /></p>
        </div>
      </header>

      <div className="ops-opportunity-grid" aria-label={`${goal.label} opportunities`}>
        {opportunities.map((opportunity) => {
          return (
            <article
              key={opportunity.id}
              className="ops-opportunity-tile"
              data-opportunity-id={opportunity.id}
              onClick={(event) => onSelect(opportunity.id, event.currentTarget.querySelector('.ops-opportunity-open'))}
            >
              <span className="ops-opportunity-status"><GlossaryText text={opportunity.confidence} /></span>
              <span className="ops-opportunity-benefits" aria-label="Quantified opportunity benefit">
                <span className="ops-opportunity-benefit">
                  <span><GlossaryText text={opportunity.absoluteHeading} /></span>
                  <strong className="ops-opportunity-benefit-value">{opportunity.absoluteValue}</strong>
                  <small><GlossaryText text={opportunity.absoluteLabel} /></small>
                </span>
                <span className="ops-opportunity-benefit">
                  <span><GlossaryText text={opportunity.improvementHeading} /></span>
                  <strong className="ops-opportunity-benefit-value">{opportunity.improvementValue}</strong>
                  <small><GlossaryText text={opportunity.improvementLabel} /></small>
                </span>
              </span>
              <h5><GlossaryText text={opportunity.headline} /></h5>
              <p className="ops-opportunity-calculation"><b>Calculation:</b> <GlossaryText text={opportunity.calculationBasis} /></p>
              <p><b>Analyzed:</b> <GlossaryText text={`${opportunity.analyzed}.`} /></p>
              <p><b>Found:</b> <GlossaryText text={opportunity.finding} /></p>
              <p><b>Potential result:</b> <GlossaryText text={opportunity.potential} /></p>
              <small className="ops-opportunity-caveat"><GlossaryText text={opportunity.caveat} /></small>
              <button type="button" className="ops-opportunity-open" aria-label={`Open ${opportunity.headline} details`}>Open opportunity details →</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function OpportunityDetailHeader({ goal, opportunity, onBack, headingRef }) {
  return (
    <header className="ops-opportunity-detail-head">
      <button type="button" className="ops-goal-detail-back ops-opportunity-detail-back" onClick={onBack}>
        ← {goal.label} opportunities
      </button>
      <div>
        <p className="ops-overline"><GlossaryText text={`${goal.label} · Opportunity detail`} /></p>
        <h3 ref={headingRef} tabIndex="-1"><GlossaryText text={opportunity.headline} /></h3>
        <p><GlossaryText text={opportunity.potential} /></p>
      </div>
      <section className="ops-opportunity-detail-benefit" aria-label="Selected opportunity quantified benefit">
        <div><span><GlossaryText text={opportunity.absoluteHeading} /></span><strong>{opportunity.absoluteValue}</strong><small><GlossaryText text={opportunity.absoluteLabel} /></small></div>
        <div><span><GlossaryText text={opportunity.improvementHeading} /></span><strong>{opportunity.improvementValue}</strong><small><GlossaryText text={opportunity.improvementLabel} /></small></div>
        <p><b>Calculation:</b> <GlossaryText text={opportunity.calculationBasis} /></p>
      </section>
    </header>
  );
}

function ExplainableCard({ item, onExplain }) {
  if (item.kind === 'action') {
    return (
      <article
        className="ops-flow-card ops-flow-card-action ops-action-brief"
        data-ops-item-kind={item.kind}
        onClick={(event) => onExplain(item, event.currentTarget.querySelector('.ops-flow-card-open'))}
      >
        <span className="ops-flow-card-topline">Review P{item.reviewPriority}</span>
        <strong><GlossaryText text={item.title} /></strong>
        <dl className="ops-action-brief-facts">
          <div><dt>Who</dt><dd><GlossaryText text={item.owner} /></dd></div>
          <div><dt>Do what</dt><dd><GlossaryText text={item.summary} /></dd></div>
          <div>
            <dt>How</dt>
            <dd><ol>{item.how.map((step) => <li key={step}><GlossaryText text={step} /></li>)}</ol></dd>
          </div>
          <div><dt>Benefit</dt><dd><GlossaryText text={item.expectedImpact} /></dd></div>
          <div><dt>Time</dt><dd><GlossaryText text={item.timeHorizon} /></dd></div>
          <div><dt>Estimated cost</dt><dd><GlossaryText text={item.estimatedCost} /></dd></div>
          <div><dt>Estimated savings</dt><dd><GlossaryText text={item.estimatedSavings} /></dd></div>
        </dl>
        <small><GlossaryText text={`Implementation: ${item.implementationPriority}`} /></small>
        {item.deliverableId ? <><small className="ops-deliverable-ready"><GlossaryText text="DPro deliverable: 6-plan reconciliation prepared" /></small><button type="button" className="ops-flow-card-open" aria-label={`Open prepared ${item.title}`}>Open prepared reconciliation</button></> : <button type="button" className="ops-flow-card-open" aria-label={`Explain ${item.title}`}>Open full action explanation</button>}
      </article>
    );
  }

  return (
    <article
      className={`ops-flow-card ops-flow-card-${item.kind}`}
      data-ops-item-kind={item.kind}
      onClick={(event) => onExplain(item, event.currentTarget.querySelector('.ops-flow-card-open'))}
    >
      <span className="ops-flow-card-topline">
        {item.kind === 'action' ? `Review P${item.reviewPriority}` : KIND_LABELS[item.kind]}
      </span>
      {item.value ? <b>{item.value}</b> : null}
      <strong><GlossaryText text={item.title} /></strong>
      <span><GlossaryText text={item.summary} /></span>
      <button type="button" className="ops-flow-card-open" aria-label={`Explain ${item.title}`}>Open explanation</button>
    </article>
  );
}

function DecisionCase({ goal, decisionCase, sources, onExplain, focusedActionId = null }) {
  const actions = useMemo(
    () => rankRecommendationsForReview(decisionCase.actions)
      .filter((actionItem) => !focusedActionId || actionItem.id === focusedActionId),
    [decisionCase.actions, focusedActionId],
  );

  return (
    <article className={`ops-decision-case${focusedActionId ? ' is-opportunity-focused' : ''}`} data-ops-case-id={decisionCase.id}>
      <header>
        <div>
          <p className="ops-overline"><GlossaryText text={focusedActionId ? 'Focused opportunity decision case' : 'Prioritized decision case'} /></p>
          <h3><GlossaryText text={decisionCase.title} /></h3>
          <p><GlossaryText text={decisionCase.question} /></p>
        </div>
        <div className="ops-case-confidence">
          <span><GlossaryText text="Evidence confidence" /></span>
          <strong><GlossaryText text={decisionCase.confidence} /></strong>
        </div>
      </header>

      <div className="ops-flow-grid" aria-label={`${decisionCase.title} evidence-to-action flow`}>
        <section className="ops-flow-lane ops-flow-inputs" aria-labelledby={`${decisionCase.id}-inputs`}>
          <header>
            <span>1</span>
            <div><h4 id={`${decisionCase.id}-inputs`}>Inputs</h4><p><GlossaryText text="Observed evidence and explicit gaps" /></p></div>
          </header>
          <div>{decisionCase.inputs.map((item) => <ExplainableCard key={item.id} item={item} onExplain={onExplain} />)}</div>
        </section>

        <section className="ops-flow-lane ops-flow-transforms" aria-labelledby={`${decisionCase.id}-transforms`}>
          <header>
            <span>2</span>
            <div><h4 id={`${decisionCase.id}-transforms`}>Analysis & transformations</h4><p><GlossaryText text="Reconciliation, rules and limitations" /></p></div>
          </header>
          <div>{decisionCase.transformations.map((item) => <ExplainableCard key={item.id} item={item} onExplain={onExplain} />)}</div>
        </section>

        <section className="ops-flow-lane ops-flow-actions" aria-labelledby={`${decisionCase.id}-actions`}>
          <header>
            <span>3</span>
            <div><h4 id={`${decisionCase.id}-actions`}>Potential actions</h4><p><GlossaryText text="Sorted by recommended review priority" /></p></div>
          </header>
          <div>{actions.map((item) => <ExplainableCard key={item.id} item={item} onExplain={onExplain} />)}</div>
        </section>
      </div>
    </article>
  );
}

export const OperationalActionWorkbench = forwardRef(function OperationalActionWorkbench({ goals = [], sources = [] }, ref) {
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [activeDeliverable, setActiveDeliverable] = useState(null);
  const explanationTriggerRef = useRef(null);
  const selectedGoalTriggerRef = useRef(null);
  const selectedOpportunityTriggerRef = useRef(null);
  const detailHeadingRef = useRef(null);
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) || null;
  const goalOpportunities = useMemo(
    () => (selectedGoal ? buildGoalOpportunities(selectedGoal) : []),
    [selectedGoal],
  );
  const selectedOpportunity = goalOpportunities.find((item) => item.id === selectedOpportunityId) || null;

  const closeExplanation = () => {
    setExplanation(null);
    window.requestAnimationFrame(() => explanationTriggerRef.current?.focus());
  };

  const openGoal = (goalId, trigger) => {
    selectedGoalTriggerRef.current = trigger;
    setSelectedGoalId(goalId);
    setSelectedOpportunityId(null);
    setExplanation(null);
    window.requestAnimationFrame(() => detailHeadingRef.current?.focus());
  };

  const closeGoal = () => {
    setSelectedGoalId(null);
    setSelectedOpportunityId(null);
    setExplanation(null);
    window.requestAnimationFrame(() => selectedGoalTriggerRef.current?.focus());
  };

  const openOpportunity = (opportunityId, trigger) => {
    selectedOpportunityTriggerRef.current = trigger;
    setSelectedOpportunityId(opportunityId);
    setExplanation(null);
    window.requestAnimationFrame(() => detailHeadingRef.current?.focus());
  };

  const closeOpportunity = () => {
    setSelectedOpportunityId(null);
    setExplanation(null);
    window.requestAnimationFrame(() => selectedOpportunityTriggerRef.current?.focus());
  };

  const closeDeliverable = () => {
    setActiveDeliverable(null);
    window.requestAnimationFrame(() => explanationTriggerRef.current?.focus());
  };

  useImperativeHandle(ref, () => ({
    goBackOneScreen() {
      if (activeDeliverable) {
        closeDeliverable();
        return true;
      }
      if (selectedOpportunity) {
        closeOpportunity();
        return true;
      }
      if (selectedGoal) {
        closeGoal();
        return true;
      }
      return false;
    },
  }), [activeDeliverable, selectedGoal, selectedOpportunity]);

  if (!goals.length) return null;

  if (activeDeliverable === 'ky-recovery-reconciliation') {
    return <RecoveryReconciliationWorkspace onBack={closeDeliverable} />;
  }

  return (
    <section
      className={`ops-action-workbench${selectedGoal ? ' is-detail' : ' is-goal-index'}`}
      aria-label="Operational intelligence goals"
    >
      {!selectedGoal ? (
        <div className="ops-goal-grid" aria-label="Operational intelligence goal categories">
          {goals.map((goal) => (
            <GoalTile
              key={goal.id}
              goal={goal}
              onSelect={(trigger) => openGoal(goal.id, trigger)}
            />
          ))}
        </div>
      ) : (
        <section className="ops-selected-goal" aria-live="polite">
          {!selectedOpportunity ? (
            <>
              <header className="ops-goal-detail-head">
                <button
                  type="button"
                  className="ops-goal-detail-back"
                  aria-label="All goals"
                  onClick={closeGoal}
                >
                  ← All goals
                </button>
                <div>
                  <p className="ops-overline"><GlossaryText text="Operational goal" /></p>
                  <h3 ref={detailHeadingRef} tabIndex="-1"><GlossaryText text={selectedGoal.label} /></h3>
                  <p><GlossaryText text={selectedGoal.objective} /></p>
                </div>
              </header>

              <GoalOpportunityPanel
                goal={selectedGoal}
                opportunities={goalOpportunities}
                onSelect={openOpportunity}
              />
            </>
          ) : (
            <section className="ops-opportunity-detail">
              <OpportunityDetailHeader
                goal={selectedGoal}
                opportunity={selectedOpportunity}
                onBack={closeOpportunity}
                headingRef={detailHeadingRef}
              />

              <GoalUseGuide goal={selectedGoal} opportunity={selectedOpportunity} />

              {selectedGoal.cases
                .filter((decisionCase) => decisionCase.id === selectedOpportunity.caseId)
                .map((decisionCase) => (
                <DecisionCase
                  key={decisionCase.id}
                  goal={selectedGoal}
                  decisionCase={decisionCase}
                  sources={sources}
                  focusedActionId={selectedOpportunity.actionId}
                  onExplain={(item, trigger) => {
                    explanationTriggerRef.current = trigger;
                    if (item.deliverableId) {
                      setActiveDeliverable(item.deliverableId);
                    } else {
                      setExplanation({ item, decisionCase });
                    }
                  }}
                />
              ))}
            </section>
          )}
        </section>
      )}

      <ExplanationDialog
        item={explanation?.item}
        decisionCase={explanation?.decisionCase}
        goal={selectedGoal}
        sources={sources}
        onClose={closeExplanation}
      />
    </section>
  );
});
