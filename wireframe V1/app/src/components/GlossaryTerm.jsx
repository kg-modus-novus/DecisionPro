import { getGlossaryTerm, glossaryMatchPatterns } from '../data/glossary.js';
import { useOptionalGlossary } from '../lib/GlossaryContext.jsx';

/**
 * Inline glossary link for a known term id.
 */
export function GlossaryTerm({ id, children }) {
  const glossary = useOptionalGlossary();
  const entry = getGlossaryTerm(id);
  if (!entry || !glossary) return children || entry?.term || null;
  return (
    <button
      type="button"
      className="glossary-term-link"
      onClick={(e) => {
        e.stopPropagation();
        glossary.openGlossary(id);
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
  const lowerSource = source.toLowerCase();
  const isWordCharacter = (value) => Boolean(value && /[a-z0-9]/i.test(value));
  while (i < source.length) {
    let hit = null;
    let hitAt = -1;
    for (const p of patterns) {
      const lowerLabel = p.label.toLowerCase();
      let idx = lowerSource.indexOf(lowerLabel, i);
      while (idx !== -1) {
        const before = idx > 0 ? source[idx - 1] : '';
        const afterIndex = idx + p.label.length;
        const after = afterIndex < source.length ? source[afterIndex] : '';
        if (!isWordCharacter(before) && !isWordCharacter(after)) break;
        idx = lowerSource.indexOf(lowerLabel, idx + 1);
      }
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
