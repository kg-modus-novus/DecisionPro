import { describe, expect, it } from 'vitest';
import { getGlossaryTerm, glossaryMatchPatterns, listGlossaryTerms } from './glossary.js';

describe('glossary', () => {
  it('lists sorted terms with definitions and examples', () => {
    const terms = listGlossaryTerms();
    expect(terms.length).toBeGreaterThan(8);
    for (const t of terms) {
      expect(t.id).toBeTruthy();
      expect(t.term).toBeTruthy();
      expect(t.definition.length).toBeGreaterThan(20);
      expect(t.example.length).toBeGreaterThan(20);
    }
    expect(getGlossaryTerm('psa')?.term).toBe('PSA');
  });

  it('auto-links longer labels before short ones and skips ambiguous tokens', () => {
    const patterns = glossaryMatchPatterns();
    const labels = patterns.map((p) => p.label);
    expect(labels.indexOf('Evidence Room cubes')).toBeLessThan(labels.indexOf('Cube'));
    expect(labels).toContain('PSA');
    expect(labels).not.toContain('Gate');
    expect(labels).not.toContain('REAL');
    expect(labels).not.toContain('Gap');
  });
});
