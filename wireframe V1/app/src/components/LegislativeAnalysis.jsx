import { useMemo, useState } from 'react';
import {
  DRAFT_BILL_TEMPLATES,
  LAW_INSTRUMENTS,
  scoreInstrumentForBlender,
} from '../data/alp/legislation.js';
import { FOCUS_TABS } from '../data/fixtures.js';
import { LawCiteLink } from './LegislationObjectPage.jsx';
import { PageTitleWithBack } from './ContentBackBar.jsx';

/**
 * Bi-directional legislative analysis:
 * blender opportunities/balances ↔ existing/proposed law blockers & openings.
 * Synthetic / curated only — not legal advice, not a live bill feed.
 */
export function LegislativeAnalysis({
  focuses = [],
  findings = [],
  pack = null,
  onOpenBlender,
  onOpenLaw,
}) {
  const packTags = pack?.tags || [];
  const [selectedId, setSelectedId] = useState(LAW_INSTRUMENTS[0]?.id);
  const [draftId, setDraftId] = useState(DRAFT_BILL_TEMPLATES[0]?.id);
  const [mode, setMode] = useState('both'); // blockers | opportunities | both

  const scored = useMemo(() => {
    return LAW_INSTRUMENTS.map((law) => scoreInstrumentForBlender(law, focuses, packTags)).sort(
      (a, b) => b.relevance - a.relevance,
    );
  }, [focuses, packTags]);

  const selected = scored.find((x) => x.id === selectedId) || scored[0];
  const draft = DRAFT_BILL_TEMPLATES.find((d) => d.id === draftId) || DRAFT_BILL_TEMPLATES[0];

  const linkedDrafts = useMemo(() => {
    if (!selected) return [];
    return DRAFT_BILL_TEMPLATES.filter(
      (d) => d.addresses.includes(selected.id) || d.supportsOpportunities.includes(selected.id),
    );
  }, [selected]);

  const findingHooks = useMemo(
    () =>
      findings.map((f) => ({
        id: f.id,
        title: f.title,
        focusId: f.focusId,
        note: f.sourceIncentiveNote || f.summary || '',
      })),
    [findings],
  );

  const blockers = scored.filter((x) => x.blockerStrength >= 0.45);
  const opportunities = scored.filter((x) => x.opportunityStrength >= 0.55);

  const visible = scored.filter((x) => {
    if (mode === 'blockers') return x.blockerStrength >= 0.4;
    if (mode === 'opportunities') return x.opportunityStrength >= 0.5;
    return true;
  });

  return (
    <main className="main leg-analysis">
      <header className="leg-head" data-walkthrough-target="legislation-header">
        <PageTitleWithBack
          actions={
            <div className="leg-head-side">
              <div className="er-chip">CURATED / SYNTHETIC · not legal advice · not a live bill feed</div>
              <button type="button" className="sap-btn ghost" onClick={onOpenBlender}>
                Open Consideration Blender
              </button>
            </div>
          }
        >
          <div>
            <p className="sap-alp-eyebrow">Legislative Analysis · bi-directional</p>
            <h2>Law ↔ decision analysis</h2>
            <p className="hint">
              Explore related law, identify blockers, examine surgical draft wording, and reverse-map how
              existing or proposed legislation creates or removes blockers for blender opportunities.
            </p>
          </div>
        </PageTitleWithBack>
      </header>

      <section className="leg-context" aria-label="Blender context">
        <div>
          <h3>Active blender focuses</h3>
          <div className="leg-focus-row">
            {FOCUS_TABS.map((tab) => (
              <span
                key={tab.id}
                className={`leg-focus-chip ${focuses.includes(tab.id) ? 'on' : ''}`}
                style={{ '--tab': tab.color }}
              >
                {tab.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3>Findings in blend</h3>
          {findingHooks.length ? (
            <ul className="leg-finding-list">
              {findingHooks.map((f) => (
                <li key={f.id}>
                  <strong>{f.title}</strong>
                  <span>{f.note}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">No findings blended yet — relevance uses focuses and pack tags only.</p>
          )}
        </div>
        <div>
          <h3>Active win-win-win pack</h3>
          {pack ? (
            <p>
              <strong>{pack.title}</strong>
              <br />
              <span className="hint">Tags: {pack.tags?.join(' · ')}</span>
            </p>
          ) : (
            <p className="hint">No pack selected — select one in the blender for tighter linkage.</p>
          )}
        </div>
      </section>

      <section className="leg-bidir" aria-label="Bi-directional map">
        <article className="leg-panel">
          <h3>Blockers in law / gaps</h3>
          <p className="hint">Weaknesses that obstruct opportunities sought in the blender</p>
          <ul>
            {blockers.map((b) => (
              <li key={b.id}>
                <div className={`leg-panel-item ${selected?.id === b.id ? 'on' : ''}`}>
                  <LawCiteLink instrumentId={b.id} onOpenLaw={onOpenLaw}>
                    <strong>{b.cite}</strong>
                  </LawCiteLink>
                  <button type="button" className="leg-panel-select" onClick={() => setSelectedId(b.id)}>
                    <span>Blocker {(b.blockerStrength * 100).toFixed(0)}%</span>
                    <em>{b.title}</em>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
        <article className="leg-panel center">
          <h3>Balance modeled</h3>
          <p>
            Opportunities sought ↔ statutory openings and pending measures that can remove blockers —
            or create new ones if poorly scoped.
          </p>
          <div className="leg-balance">
            <div>
              <span>Blocker pressure</span>
              <div className="leg-meter">
                <i
                  style={{
                    width: `${Math.round(
                      (blockers.reduce((a, b) => a + b.blockerStrength, 0) / Math.max(blockers.length, 1)) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <span>Opportunity opening</span>
              <div className="leg-meter ok">
                <i
                  style={{
                    width: `${Math.round(
                      (opportunities.reduce((a, b) => a + b.opportunityStrength, 0) /
                        Math.max(opportunities.length, 1)) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <p className="hint">
            Direction A: law → analysis (what blocks this decision). Direction B: analysis → law (what
            bills would surgically unblock the modeled balance).
          </p>
        </article>
        <article className="leg-panel">
          <h3>Opportunities / openings</h3>
          <p className="hint">Existing or proposed language that can enable blender balances</p>
          <ul>
            {opportunities.map((o) => (
              <li key={o.id}>
                <div className={`leg-panel-item ${selected?.id === o.id ? 'on' : ''}`}>
                  <LawCiteLink instrumentId={o.id} onOpenLaw={onOpenLaw}>
                    <strong>{o.cite}</strong>
                  </LawCiteLink>
                  <button type="button" className="leg-panel-select" onClick={() => setSelectedId(o.id)}>
                    <span>Opening {(o.opportunityStrength * 100).toFixed(0)}%</span>
                    <em>{o.title}</em>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <div className="leg-workspace" data-walkthrough-target="legislation-workspace">
        <aside className="leg-instrument-list" aria-label="Law instruments">
          <div className="leg-mode-toggle" role="group" aria-label="Filter instruments">
            {[
              ['both', 'All'],
              ['blockers', 'Blockers'],
              ['opportunities', 'Openings'],
            ].map(([id, label]) => (
              <button key={id} type="button" className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>
                {label}
              </button>
            ))}
          </div>
          <ul>
            {visible.map((law) => (
              <li key={law.id}>
                <div className={`leg-instrument-item ${selected?.id === law.id ? 'on' : ''}`}>
                  <span className={`leg-kind ${law.kind}`}>{law.kind}</span>
                  <LawCiteLink instrumentId={law.id} onOpenLaw={onOpenLaw}>
                    <strong>{law.cite}</strong>
                  </LawCiteLink>
                  <button
                    type="button"
                    className="leg-instrument-select"
                    onClick={() => {
                      setSelectedId(law.id);
                      const first = DRAFT_BILL_TEMPLATES.find(
                        (d) => d.addresses.includes(law.id) || d.supportsOpportunities.includes(law.id),
                      );
                      if (first) setDraftId(first.id);
                    }}
                  >
                    <strong>{law.title}</strong>
                    <span className="hint">Relevance {(law.relevance * 100).toFixed(0)}% · select for workspace</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="leg-detail" aria-label="Selected instrument">
          {selected ? (
            <>
              <header>
                <p className="hint">{selected.status}</p>
                <h3>{selected.title}</h3>
                <p className="leg-cite">
                  <LawCiteLink instrumentId={selected.id} onOpenLaw={onOpenLaw}>
                    {selected.cite}
                  </LawCiteLink>
                </p>
              </header>
              <p>{selected.summary}</p>
              <p>
                <button type="button" className="sap-btn primary" onClick={() => onOpenLaw?.(selected.id)}>
                  Open legislation object page
                </button>
              </p>
              <dl className="alp-dl">
                <div>
                  <dt>Kind</dt>
                  <dd>{selected.kind}</dd>
                </div>
                <div>
                  <dt>Blocker strength</dt>
                  <dd>{(selected.blockerStrength * 100).toFixed(0)}%</dd>
                </div>
                <div>
                  <dt>Opportunity strength</dt>
                  <dd>{(selected.opportunityStrength * 100).toFixed(0)}%</dd>
                </div>
                <div>
                  <dt>Impacts focuses</dt>
                  <dd>{selected.impacts.join(', ')}</dd>
                </div>
                <div>
                  <dt>Blender hooks</dt>
                  <dd>{selected.blenderHooks.join(', ')}</dd>
                </div>
              </dl>

              <h4>Impact on current decision analysis</h4>
              <p>
                Relative to active focuses
                {pack ? ` and pack “${pack.title}”` : ''}, this instrument scores{' '}
                <strong>{(selected.relevance * 100).toFixed(0)}% relevance</strong>. High blocker
                strength suggests the modeled balance may stall without a legal/contracting lever;
                high opportunity strength suggests an opening to examine (not prescribe).
              </p>

              <h4>Linked draft bill suggestions</h4>
              <ul className="leg-draft-links">
                {linkedDrafts.map((d) => (
                  <li key={d.id}>
                    <button type="button" className={draft?.id === d.id ? 'on' : ''} onClick={() => setDraftId(d.id)}>
                      {d.title}
                      {d.surgical ? ' · surgical' : ''}
                    </button>
                  </li>
                ))}
                {!linkedDrafts.length && <li className="hint">No draft templates linked — browse all drafts below.</li>}
              </ul>
            </>
          ) : null}
        </section>

        <section className="leg-draft" aria-label="Draft bill wording">
          <header>
            <p className="sap-alp-eyebrow">Suggested bill language · options to examine</p>
            <h3>{draft?.title}</h3>
            <p className="hint">{draft?.summary}</p>
            {draft?.surgical ? <span className="sap-pill ok">Surgical amendment style</span> : (
              <span className="sap-pill neutral">Broader reporting / authority</span>
            )}
          </header>
          <label className="leg-draft-picker">
            Draft template
            <select value={draft?.id} onChange={(e) => setDraftId(e.target.value)}>
              {DRAFT_BILL_TEMPLATES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          <pre className="leg-draft-body">{draft?.draftWording}</pre>
          <p className="hint">
            Draft wording is examination material for legislative packaging. It is not legislative
            counsel, not introduced language, and not a recommendation to enact.
          </p>
          <h4>Addresses / supports</h4>
          <p className="hint">
            Addresses: {(draft?.addresses || []).join(', ') || '—'}
            <br />
            Supports openings: {(draft?.supportsOpportunities || []).join(', ') || '—'}
          </p>
        </section>
      </div>
    </main>
  );
}
