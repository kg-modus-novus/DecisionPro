import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getGlossaryTerm, listGlossaryTerms } from '../data/glossary.js';
import { useGlossary } from '../lib/GlossaryContext.jsx';

/**
 * Top-level glossary browser — open from the topbar or an inline term link.
 */
export function GlossaryModal() {
  const { open, termId, closeGlossary, setTermId } = useGlossary();
  const titleId = useId();
  const closeRef = useRef(null);
  const activeRef = useRef(null);
  const [query, setQuery] = useState('');
  const terms = useMemo(() => listGlossaryTerms(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter((t) => {
      const hay = [t.term, ...(t.aliases || []), t.definition, t.example].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [terms, query]);

  const active = getGlossaryTerm(termId) || filtered[0] || null;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') closeGlossary();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, closeGlossary]);

  useEffect(() => {
    if (!open) return;
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, termId, filtered]);

  if (!open) return null;

  return (
    <div className="explain-overlay glossary-overlay" role="presentation" onClick={closeGlossary}>
      <div
        className="explain-modal glossary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="explain-modal-head">
          <div>
            <p className="explain-eyebrow">DecisionPro glossary</p>
            <h2 id={titleId}>Terms legislators may want defined</h2>
          </div>
          <button type="button" className="explain-close" onClick={closeGlossary} ref={closeRef}>
            Close
          </button>
        </header>

        <div className="glossary-modal-body">
          <aside className="glossary-list-pane" aria-label="Glossary terms">
            <label className="sr-only" htmlFor="glossary-search">
              Search glossary
            </label>
            <input
              id="glossary-search"
              type="search"
              className="glossary-search"
              placeholder="Search terms…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="glossary-term-list">
              {filtered.map((t) => {
                const selected = active?.id === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      ref={selected ? activeRef : undefined}
                      className={`glossary-term-list-btn${selected ? ' is-selected' : ''}`}
                      onClick={() => setTermId(t.id)}
                    >
                      {t.term}
                    </button>
                  </li>
                );
              })}
              {!filtered.length ? <li className="hint">No terms match that search.</li> : null}
            </ul>
          </aside>

          <article className="glossary-detail-pane" aria-live="polite">
            {active ? (
              <>
                <h3>{active.term}</h3>
                {active.aliases?.length ? (
                  <p className="hint">Also: {active.aliases.join(' · ')}</p>
                ) : null}
                <section>
                  <h4>Meaning</h4>
                  <p>{active.definition}</p>
                </section>
                <section>
                  <h4>Example in DecisionPro</h4>
                  <p>{active.example}</p>
                </section>
              </>
            ) : (
              <p className="hint">Select a term to read its definition and an example.</p>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
