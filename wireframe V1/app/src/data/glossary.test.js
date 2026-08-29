import { describe, expect, it } from 'vitest';
import { getGlossaryTerm, glossaryMatchPatterns, listGlossaryTerms } from './glossary.js';

describe('glossary', () => {
  it('lists sorted terms with definitions and examples', () => {
    const terms = listGlossaryTerms();
    expect(terms.length).toBeGreaterThan(45);
    expect(new Set(terms.map((term) => term.id)).size).toBe(terms.length);
    for (const t of terms) {
      expect(t.id).toBeTruthy();
      expect(t.term).toBeTruthy();
      expect(t.definition.length).toBeGreaterThan(20);
      expect(t.example.length).toBeGreaterThan(20);
    }
    expect(getGlossaryTerm('psa')?.term).toBe('PSA');
    for (const id of ['mcpar', 'puf', 'leie', 'provider-data-catalog', 'usaspending', 'encounter-data', 'network-adequacy', 'modeled-benefit', 'recovery-reconciliation', 'phi']) {
      expect(getGlossaryTerm(id), `Missing operational glossary term ${id}`).toBeTruthy();
    }
    expect(getGlossaryTerm('mcpar').reference.href).toMatch(/^https:\/\//);
    expect(getGlossaryTerm('leie').reference.href).toContain('oig.hhs.gov');
    expect(getGlossaryTerm('provider-data-catalog').reference.href).toContain('data.cms.gov');
    expect(getGlossaryTerm('modeled-benefit').definition).toContain('not a measured outcome');
  });

  it('auto-links longer labels before short ones and skips ambiguous tokens', () => {
    const patterns = glossaryMatchPatterns();
    const labels = patterns.map((p) => p.label);
    expect(labels.indexOf('Evidence Room cubes')).toBeLessThan(labels.indexOf('Cube'));
    expect(labels).toContain('PSA');
    expect(labels).not.toContain('Gate');
    expect(labels).not.toContain('REAL');
    expect(labels).not.toContain('Gap');
    expect(labels).toContain('MCPAR');
    expect(labels).toContain('CMS Provider Data Catalog');
    expect(labels).toContain('public API');
    expect(labels).toContain('USAspending API v2');
    expect(labels).toContain('API');
    expect(new Set(labels.map((label) => label.toLowerCase())).size).toBe(labels.length);
  });
});
