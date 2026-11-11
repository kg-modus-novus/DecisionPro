import { describe, expect, it } from 'vitest';
import { getGlossaryTerm, getGlossaryTermForBillingCode, glossaryMatchPatterns, listGlossaryTerms } from './glossary.js';

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

  it('describes a billing code by its own entry, else its code family, else what a billing code is', () => {
    expect(getGlossaryTermForBillingCode('H2027').id).toBe('hcpcs-h2027');
    expect(getGlossaryTermForBillingCode('H0036').id).toBe('hcpcs-h0036');
    expect(getGlossaryTermForBillingCode(' h0038 ').id).toBe('hcpcs-h0038');
    expect(getGlossaryTermForBillingCode('H0015').id).toBe('hcpcs-h-codes');
    expect(getGlossaryTermForBillingCode('97535').id).toBe('hcpcs-code');
    expect(getGlossaryTermForBillingCode('')).toBeNull();
    expect(getGlossaryTermForBillingCode(undefined)).toBeNull();
    expect(getGlossaryTerm('hcpcs-code').reference.href).toContain('cms.gov');
    // One entry per code and per family, so a code never has two descriptions.
    const codes = listGlossaryTerms().map((t) => t.billingCode).filter(Boolean);
    const families = listGlossaryTerms().map((t) => t.billingCodePrefix).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(families).size).toBe(families.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z0-9]{5}$/);
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
