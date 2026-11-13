import { useState } from 'react';
import { SIGNAL_WEIGHTS, SIGNAL_WEIGHT_RANGE, STARTING_TIER_CUTOFFS, TIER_CUTOFF_KEYS, TIER_CUTOFF_RANGE, WORTH_REVIEW_TIER_KEYS } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { money, count } from './fraudFormat.jsx';
import { SIGNAL_SHORT_LABELS, TIER_COLORS, TIER_DISPLAY_ORDER, tierShortLabel } from './fraudVisuals.jsx';

/**
 * The radar's score rule: sliders for each signal's points and the HIGH and
 * VERIFY cut-offs, staged for this browser session. The scoring program checks
 * and applies them (it rejects a rule out of range or with VERIFY not below
 * HIGH, and the module keeps the last rule that worked); this panel only stages
 * the values and shows, for the year on the radar, how many services each tier
 * holds now against DecisionPro's starting rule.
 */

/** The session's starting score rule, staged as the program's INITIAL inputs. */
export const STARTING_SCORE_RULE = Object.freeze({ weights: SIGNAL_WEIGHTS, cutoffs: STARTING_TIER_CUTOFFS });

function Slider({ id, label, value, start, range, onChange }) {
  return (
    <label className="pfd-sr-slider">
      <span className="pfd-sr-name">{label}</span>
      <input type="range" className="pfd-range" min={range.min} max={range.max} step="1" value={value} data-score-rule={id} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <b className="pfd-sr-v">{value}</b>
      <span className={`pfd-sr-start${value === start ? '' : ' is-moved'}`}>{value === start ? 'start' : `was ${start}`}</span>
    </label>
  );
}

// The worth-review services whose dollars may be shown: the shown total leaves out those paid to fewer billers than the minimum.
const shownWorthReviewServices = (ys) => WORTH_REVIEW_TIER_KEYS.reduce((a, k) => a + ys.tiers[k].services - ys.tiers[k].withheldServices, 0);

export function ScoreRulePanel({ review, startingReview, year, scoreRule, setScoreRule, problems }) {
  const [open, setOpen] = useState(false);
  const adjusted = !review.ScoreRuleIsStartingRule;
  const cutoffTiers = TIER_CUTOFF_KEYS.map((k) => review.ActiveTierRule.find((t) => t.key === k));
  const now = review.YearSummaries[year];
  const before = startingReview.YearSummaries[year];
  const setWeight = (k, v) => setScoreRule({ ...scoreRule, weights: { ...scoreRule.weights, [k]: v } });
  const setCutoff = (k, v) => setScoreRule({ ...scoreRule, cutoffs: { ...scoreRule.cutoffs, [k]: v } });
  return (
    <div className={`pfd-card pfd-sr${adjusted ? ' is-adjusted' : ''}`} data-score-rule-panel>
      <div className="pfd-sr-bar">
        <span data-score-rule-summary>
          <b>Score rule:</b> {adjusted ? 'adjusted for this session' : "DecisionPro's starting rule"}{cutoffTiers.map((t) => ` · ${t.shortLabel} ≥ ${t.minScore}`).join('')} · points total {review.SignalWeightsTotal}
        </span>
        <span className="pfd-sr-actions">
          {adjusted ? <button type="button" className="pfd-btn pfd-btn-ghost pfd-sr-btn" data-score-rule-reset onClick={() => setScoreRule(STARTING_SCORE_RULE)}>Reset to starting rule</button> : null}
          <button type="button" className="pfd-btn pfd-btn-ghost pfd-sr-btn" aria-expanded={open} data-score-rule-toggle onClick={() => setOpen(!open)}>{open ? 'Close' : 'Adjust weights and cut-offs'}</button>
        </span>
      </div>
      {problems.length ? <p className="pfd-sr-problem" role="alert" data-score-rule-problem>Not applied: {problems.join('; ')}. The radar keeps the last rule that worked.</p> : null}
      {open ? (
        <div className="pfd-sr-body">
          <div className="pfd-sr-col">
            <div className="pfd-tc-cap">Tier cut-offs (signal score)</div>
            {cutoffTiers.map(({ key: k, shortLabel }) => (
              <Slider key={k} id={`cutoff-${k}`} label={`${shortLabel} at`} value={scoreRule.cutoffs[k]} start={STARTING_TIER_CUTOFFS[k]} range={TIER_CUTOFF_RANGE} onChange={(v) => setCutoff(k, v)} />
            ))}
            <div className="pfd-tc-cap pfd-sr-gap">Services in {year}, now against the starting rule</div>
            <div className="pfd-sr-tiers" data-score-rule-tiers>
              {TIER_DISPLAY_ORDER.map((k) => {
                const a = before.tiers[k].services;
                const b = now.tiers[k].services;
                return (
                  <span key={k} className="pfd-sr-tier" data-score-rule-tier={k}>
                    <i style={{ background: TIER_COLORS[k] }} />{tierShortLabel(review.ActiveTierRule.find((t) => t.key === k))}{' '}
                    <b>{count(b)}</b>{a !== b ? <span className="pfd-muted"> (was {count(a)})</span> : null}
                  </span>
                );
              })}
            </div>
            <p className="pfd-note" data-score-rule-worth>
              Worth review: <b>{money(now.shownWorthReviewAboveEnrollment)}</b> on {count(shownWorthReviewServices(now))} services
              {shownWorthReviewServices(now) !== shownWorthReviewServices(before) || now.shownWorthReviewAboveEnrollment !== before.shownWorthReviewAboveEnrollment ? ` (was ${money(before.shownWorthReviewAboveEnrollment)} on ${count(shownWorthReviewServices(before))})` : ''}.
            </p>
          </div>
          <div className="pfd-sr-col">
            <div className="pfd-tc-cap">Points per signal</div>
            {Object.keys(SIGNAL_WEIGHTS).map((k) => (
              <Slider key={k} id={`weight-${k}`} label={SIGNAL_SHORT_LABELS[k]} value={scoreRule.weights[k]} start={SIGNAL_WEIGHTS[k]} range={SIGNAL_WEIGHT_RANGE} onChange={(v) => setWeight(k, v)} />
            ))}
            <p className="pfd-note">Points total {review.SignalWeightsTotal}; a signal score is capped at 100.</p>
          </div>
          <p className="pfd-note pfd-sr-foot">
            For this browser session only; nothing is saved. The tiers on every page move with the rule. A suggested tier stays a suggestion: a reviewer sets the tier.
          </p>
        </div>
      ) : null}
    </div>
  );
}
