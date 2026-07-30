import {
  draftsForInstrument,
  getLawInstrument,
  scoreInstrumentForBlender,
} from '../data/alp/legislation.js';
import { PageTitleWithBack } from './ContentBackBar.jsx';

const KIND_LABEL = {
  existing: 'Existing statute',
  pending: 'Pending legislation',
  gap: 'Statutory / contract gap',
};

const TYPE_LABEL = {
  statute: 'Statute object',
  'pending-bill': 'Pending bill object',
  'statutory-gap': 'Gap object',
};

/**
 * Object page for a law, pending bill, or statutory gap instrument.
 * Executive summary + authoritative sources → detailed analysis & relevance → related opinions list.
 */
export function LegislationObjectPage({
  instrumentId,
  focuses = [],
  pack = null,
  onClose,
  onOpenLegislation,
}) {
  const base = getLawInstrument(instrumentId);
  if (!base) {
    return (
      <main className="main law-object-page">
        <header className="law-object-header">
          <PageTitleWithBack>
            <div className="law-object-header-main">
              <p className="hint">Instrument not found in the curated catalog.</p>
            </div>
          </PageTitleWithBack>
        </header>
      </main>
    );
  }

  const packTags = pack?.tags || [];
  const law = scoreInstrumentForBlender(base, focuses, packTags);
  const drafts = draftsForInstrument(law.id);
  const focusLabel = focuses.length ? focuses.join(', ') : 'none selected';
  const relevanceBlurb = pack
    ? `${law.relevanceToAnalysis} Active pack: “${pack.title}”. Scored relevance ${(law.relevance * 100).toFixed(0)}% against focuses [${focusLabel}] and pack tags.`
    : `${law.relevanceToAnalysis} Scored relevance ${(law.relevance * 100).toFixed(0)}% against blender focuses [${focusLabel}].`;

  return (
    <main className="main law-object-page" aria-label={`${law.cite} object page`}>
      <header className="law-object-header" data-walkthrough-target="law-object-header">
        <PageTitleWithBack
          actions={
            <div className="law-object-header-kpis" aria-label="Instrument strengths">
              <div className="sap-object-kpi">
                <span>Blocker</span>
                <strong>{(law.blockerStrength * 100).toFixed(0)}%</strong>
              </div>
              <div className="sap-object-kpi">
                <span>Opening</span>
                <strong>{(law.opportunityStrength * 100).toFixed(0)}%</strong>
              </div>
              <div className="sap-object-kpi">
                <span>Relevance</span>
                <strong>{(law.relevance * 100).toFixed(0)}%</strong>
              </div>
            </div>
          }
        >
          <div className="law-object-header-main">
            <p className="sap-alp-eyebrow">
              {TYPE_LABEL[law.objectType] || 'Legislation object'} · curated catalog
            </p>
            <div className="law-object-title-row">
              <span className={`leg-kind ${law.kind}`}>{KIND_LABEL[law.kind] || law.kind}</span>
              <span className="sap-pill neutral">{law.status}</span>
            </div>
            <h1>{law.title}</h1>
            <p className="law-object-cite">{law.cite}</p>
            <p className="hint">
              Examination material only — not legal advice, not a live bill feed. Verify cites against
              official LRC / General Assembly sources before legislative use.
            </p>
          </div>
        </PageTitleWithBack>
      </header>

      <section
        className="law-object-card law-object-exec"
        aria-labelledby="law-exec-heading"
        data-walkthrough-target="law-object-page"
      >
        <h2 id="law-exec-heading">Executive summary</h2>
        <p>{law.executiveSummary || law.summary}</p>
        <h3>Primary authoritative sources</h3>
        <ul className="law-source-list" data-walkthrough-target="law-object-sources">
          {(law.primarySources || []).map((src) => (
            <li key={src.href}>
              <a href={src.href} target="_blank" rel="noopener noreferrer">
                {src.label}
              </a>
              <span className="hint">{src.publisher}</span>
            </li>
          ))}
          {!(law.primarySources || []).length && (
            <li className="hint">No primary sources cataloged for this instrument yet.</li>
          )}
        </ul>
      </section>

      <section className="law-object-card" aria-labelledby="law-detail-heading">
        <h2 id="law-detail-heading">Detailed analysis</h2>
        <p>{law.detailedAnalysis || law.summary}</p>
        <dl className="alp-dl law-object-dl">
          <div>
            <dt>Kind</dt>
            <dd>{KIND_LABEL[law.kind] || law.kind}</dd>
          </div>
          <div>
            <dt>Object type</dt>
            <dd>{TYPE_LABEL[law.objectType] || law.objectType}</dd>
          </div>
          <div>
            <dt>Impacts focuses</dt>
            <dd>{(law.impacts || []).join(', ') || '—'}</dd>
          </div>
          <div>
            <dt>Blender hooks</dt>
            <dd>{(law.blenderHooks || []).join(', ') || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="law-object-card" aria-labelledby="law-relevance-heading">
        <h2 id="law-relevance-heading">Why this is relevant to the current analysis</h2>
        <p>{relevanceBlurb}</p>
        {drafts.length ? (
          <>
            <h3>Linked draft bill suggestions</h3>
            <ul className="law-draft-list">
              {drafts.map((d) => (
                <li key={d.id}>
                  <strong>{d.title}</strong>
                  {d.surgical ? <span className="sap-pill ok">Surgical</span> : (
                    <span className="sap-pill neutral">Broader</span>
                  )}
                  <span>{d.summary}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="spine-cta-row">
          {onOpenLegislation ? (
            <button type="button" className="sap-btn ghost" onClick={onOpenLegislation}>
              Open Law ↔ blender workspace
            </button>
          ) : null}
        </div>
      </section>

      <section className="law-object-card law-object-related" aria-labelledby="law-related-heading">
        <header className="sap-section-head">
          <div>
            <h2 id="law-related-heading">Related opinions & analyses</h2>
            <p className="hint">
              External web pages offering related opinions or analyses — not authoritative Kentucky
              law, not LRC counsel.
            </p>
          </div>
        </header>
        <ul className="law-related-list">
          {(law.relatedOpinions || []).map((item) => (
            <li key={item.href}>
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                {item.label}
              </a>
              <span className="law-related-meta">
                <em>{item.publisher}</em>
                {item.note ? <span>{item.note}</span> : null}
              </span>
            </li>
          ))}
          {!(law.relatedOpinions || []).length && (
            <li className="hint">No related opinion links cataloged yet.</li>
          )}
        </ul>
      </section>
    </main>
  );
}

/** Inline hyperlink control that opens a legislation object page. */
export function LawCiteLink({ instrumentId, children, className = '', onOpenLaw }) {
  if (!instrumentId || !onOpenLaw) {
    return <span className={className}>{children}</span>;
  }
  return (
    <button
      type="button"
      className={`law-cite-link ${className}`.trim()}
      onClick={() => onOpenLaw(instrumentId)}
    >
      {children}
    </button>
  );
}
