import { useMemo, useState } from 'react';
import {
  LAW_INSTRUMENTS,
  scoreInstrumentForBlender,
} from '../data/alp/legislation.js';
import { LawCiteLink } from './LegislationObjectPage.jsx';
import { ChartPair } from './ChartPair.jsx';
import { TrajectoryChart } from './TrajectoryChart.jsx';
import { WeightStrip } from './WeightStrip.jsx';

export const SPINE_CUES = {
  Results: 'Now: what is changing?',
  Path: 'Now: how did we get here?',
  Trajectory: 'Now: where does status quo go?',
  'Law & Pending': 'Now: what law blocks or opens?',
  Trust: 'Now: can we trust these inputs?',
  Action: 'Now: what options to examine?',
};

function ResultsViz({
  blendedFindings,
  radar,
  weights,
  normalizedWeights,
  onSetWeight,
  onResetWeights,
  onOpenEvidence,
  onGotoStep,
  rankedPacks,
}) {
  return (
    <div className="spine-stage">
      <ChartPair
        findings={blendedFindings}
        radar={radar}
        packs={rankedPacks?.slice(0, 3) || []}
        weights={weights}
        normalizedWeights={normalizedWeights}
        onSetWeight={onSetWeight}
        onResetWeights={onResetWeights}
      />
      <WeightStrip
        weights={weights}
        normalizedWeights={normalizedWeights}
        onSetWeight={onSetWeight}
        onReset={onResetWeights}
      />
      <div className="spine-cta-row">
        <button type="button" className="sap-btn ghost" onClick={onOpenEvidence}>
          Open source room
        </button>
        <button type="button" className="sap-btn primary" onClick={() => onGotoStep('Path')}>
          Continue to Path
        </button>
      </div>
    </div>
  );
}

export function SpineStage({
  step,
  blendedFindings,
  radar,
  weights,
  normalizedWeights,
  onSetWeight,
  onResetWeights,
  rankedPacks,
  packsUnlocked,
  focuses,
  activePack,
  brief,
  trustReviewed,
  onTrustReviewed,
  pathPinned,
  onPinPath,
  onOpenLegislation,
  onOpenLaw,
  onOpenEvidence,
  onOpenPack,
  onOpenBrief,
  onGotoStep,
}) {
  const [localNote] = useState('Pinned for brief examination');

  const lawItems = useMemo(() => {
    const packTags = activePack?.tags || [];
    return LAW_INSTRUMENTS.map((law) => scoreInstrumentForBlender(law, focuses, packTags))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
  }, [activePack, focuses]);

  if (blendedFindings.length < 2 && step === 'Results') {
    return (
      <div className="empty-blender">
        <p>Send findings from focus tabs into the blender.</p>
        <p className="hint">Tip: add 2 or more findings to begin blending and unlock Win-Win-Win suggestions.</p>
        <ul>
          {blendedFindings.map((f) => (
            <li key={f.id}>{f.title}</li>
          ))}
        </ul>
        <div className="spine-cta-row">
          <button type="button" className="sap-btn primary" onClick={onOpenEvidence}>
            Browse Evidence Rooms
          </button>
        </div>
      </div>
    );
  }

  if (blendedFindings.length < 2) {
    return (
      <div className="spine-stage">
        <p className="hint">Blend 2+ findings to unlock this spine stage’s full content.</p>
        <div className="spine-cta-row">
          <button type="button" className="sap-btn ghost" onClick={() => onGotoStep('Results')}>
            Back to Results
          </button>
          <button type="button" className="sap-btn primary" onClick={onOpenEvidence}>
            Browse Evidence Rooms
          </button>
        </div>
      </div>
    );
  }

  if (step === 'Results') {
    return (
      <ResultsViz
        blendedFindings={blendedFindings}
        radar={radar}
        weights={weights}
        normalizedWeights={normalizedWeights}
        onSetWeight={onSetWeight}
        onResetWeights={onResetWeights}
        onOpenEvidence={onOpenEvidence}
        onGotoStep={onGotoStep}
        rankedPacks={rankedPacks}
      />
    );
  }

  if (step === 'Path') {
    return (
      <div className="spine-stage">
        <p className="hint">Finding → driver note → lever tags (examination path).</p>
        <ul className="spine-path-list">
          {blendedFindings.map((f) => {
            const relatedPack = rankedPacks.find((p) =>
              (p.tags || []).includes(f.focusId),
            );
            return (
              <li key={f.id} className="spine-path-card">
                <strong>{f.title}</strong>
                <span className="spine-path-arrow">→</span>
                <span>{f.sourceIncentiveNote || f.magnitude}</span>
                {(f.primarySources || []).length ? (
                  <span className="spine-path-sources">
                    {(f.primarySources || []).slice(0, 2).map((src, i) => (
                      <span key={src.id || src.href}>
                        {i > 0 ? ' · ' : ''}
                        <a href={src.href} target="_blank" rel="noopener noreferrer">
                          {src.label}
                        </a>
                      </span>
                    ))}
                  </span>
                ) : null}
                <span className="spine-path-arrow">→</span>
                <span className="spine-path-levers">
                  {(relatedPack?.levers || ['Oversight packaging', 'Contract measure review'])
                    .slice(0, 2)
                    .join(' · ')}
                </span>
              </li>
            );
          })}
        </ul>
        <WeightStrip
          weights={weights}
          normalizedWeights={normalizedWeights}
          onSetWeight={onSetWeight}
          onReset={onResetWeights}
          compact
        />
        <div className="spine-cta-row">
          <button type="button" className="sap-btn ghost" onClick={onPinPath}>
            {pathPinned ? `Path pinned · ${localNote}` : 'Pin path for brief'}
          </button>
          <button type="button" className="sap-btn primary" onClick={() => onGotoStep('Trajectory')}>
            Continue to Trajectory
          </button>
        </div>
      </div>
    );
  }

  if (step === 'Trajectory') {
    return (
      <div className="spine-stage">
        <TrajectoryChart
          caption="Status quo if no change — compare mentally with packs under your current blender weights."
        />
        <WeightStrip
          weights={weights}
          normalizedWeights={normalizedWeights}
          onSetWeight={onSetWeight}
          onReset={onResetWeights}
          compact
        />
        <div className="spine-cta-row">
          <button type="button" className="sap-btn primary" onClick={() => onGotoStep('Law & Pending')}>
            Continue to Law & Pending
          </button>
        </div>
      </div>
    );
  }

  if (step === 'Law & Pending') {
    return (
      <div className="spine-stage">
        <p className="hint">Blockers and openings scored to this blend — verify cites in Law ↔ blender.</p>
        <ul className="spine-law-list">
          {lawItems.map((law) => (
            <li key={law.id}>
              <span className={`leg-kind ${law.kind}`}>{law.kind}</span>
              <LawCiteLink instrumentId={law.id} onOpenLaw={onOpenLaw}>
                <strong>{law.cite}</strong>
              </LawCiteLink>
              <span>{law.title}</span>
              <em>
                Blocker {(law.blockerStrength * 100).toFixed(0)}% · Opening{' '}
                {(law.opportunityStrength * 100).toFixed(0)}% · Relevance{' '}
                {(law.relevance * 100).toFixed(0)}%
              </em>
            </li>
          ))}
        </ul>
        <div className="spine-cta-row">
          <button type="button" className="sap-btn ghost" onClick={onOpenLegislation}>
            Open Law ↔ blender
          </button>
          <button type="button" className="sap-btn primary" onClick={() => onGotoStep('Trust')}>
            Continue to Trust
          </button>
        </div>
      </div>
    );
  }

  if (step === 'Trust') {
    return (
      <div className="spine-stage" data-walkthrough-target="blender-trust">
        <table className="alp-table sap-table spine-trust-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Details</th>
              <th>Mitigation</th>
            </tr>
          </thead>
          <tbody>
            {(brief.trustRows || []).map((row) => (
              <tr key={row.category}>
                <td>{row.category}</td>
                <td>{row.details}</td>
                <td>{row.mitigation}</td>
              </tr>
            ))}
            {blendedFindings.map((f) => (
              <tr key={f.id}>
                <td>Finding freshness</td>
                <td>
                  {f.title}: {f.freshness}
                </td>
                <td>{f.sourceIncentiveNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <label className="spine-trust-check">
          <input
            type="checkbox"
            checked={trustReviewed}
            onChange={(e) => onTrustReviewed(e.target.checked)}
          />
          Mark trust reviewed for examination (clears incomplete-trust brief warning when no lagged gaps remain)
        </label>
        <div className="spine-cta-row">
          <button
            type="button"
            className="sap-btn primary"
            onClick={() => {
              onTrustReviewed(true);
              onGotoStep('Action');
            }}
          >
            Acknowledge & go to Action
          </button>
        </div>
      </div>
    );
  }

  // Action
  return (
    <div className="spine-stage" data-walkthrough-target="blender-packs">
      {!trustReviewed ? (
        <p className="spine-warn">
          Trust not marked reviewed — Action is available, but the Consideration Brief will keep a trust warning.
        </p>
      ) : (
        <p className="hint">Trust marked reviewed for this blend. Options remain examination candidates only.</p>
      )}
      {!packsUnlocked ? (
        <p className="hint">Blend 2+ findings to unlock packs.</p>
      ) : (
        <ul className="spine-action-packs">
          {rankedPacks.slice(0, 3).map((pack) => (
            <li key={pack.id}>
              <button type="button" className="pack-card" onClick={() => onOpenPack(pack.id)}>
                <strong>{pack.title}</strong>
                <span>
                  Score {(pack.score * 100).toFixed(0)} · {pack.evidenceLevel}
                </span>
                <span className="tags">{(pack.tags || []).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="spine-cta-row">
        <button type="button" className="sap-btn ghost" onClick={() => onGotoStep('Trust')}>
          Back to Trust
        </button>
        <button
          type="button"
          className="sap-btn primary"
          onClick={onOpenBrief}
          disabled={!packsUnlocked}
        >
          Export Consideration Brief
        </button>
      </div>
    </div>
  );
}
