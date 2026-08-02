import { getGlossaryTerm, glossaryMatchPatterns } from '../data/glossary.js';
import { useGlossary } from '../lib/GlossaryContext.jsx';

/**
 * Inline glossary link for a known term id.
 */
export function GlossaryTerm({ id, children }) {
  const { openGlossary } = useGlossary();
  const entry = getGlossaryTerm(id);
  if (!entry) return children || null;
  return (
    <button
      type="button"
      className="glossary-term-link"
      onClick={(e) => {
        e.stopPropagation();
        openGlossary(id);
      }}
      title={`Glossary: ${entry.term}`}
    >
      {children || entry.term}
    </button>
  );
}

/**
 * Replace glossary terms inside a plain string with hyperlinks.
 */
export function GlossaryText({ text }) {
  if (text == null || text === '') return null;
  const source = String(text);
  const patterns = glossaryMatchPatterns();
  if (!patterns.length) return source;

  const nodes = [];
  let i = 0;
  let key = 0;
  while (i < source.length) {
    let hit = null;
    let hitAt = -1;
    for (const p of patterns) {
      const idx = source.toLowerCase().indexOf(p.label.toLowerCase(), i);
      if (idx === -1) continue;
      // Prefer earliest match; among ties, patterns already longest-first.
      if (hitAt === -1 || idx < hitAt) {
        hitAt = idx;
        hit = p;
      }
    }
    if (!hit || hitAt === -1) {
      nodes.push(source.slice(i));
      break;
    }
    if (hitAt > i) nodes.push(source.slice(i, hitAt));
    const matched = source.slice(hitAt, hitAt + hit.label.length);
    // Avoid linking inside longer already-linked spans by advancing past match.
    nodes.push(
      <GlossaryTerm key={`g-${key}-${hit.id}`} id={hit.id}>
        {matched}
      </GlossaryTerm>,
    );
    key += 1;
    i = hitAt + hit.label.length;
  }
  return <>{nodes}</>;
}
