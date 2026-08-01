import { describe, expect, it } from 'vitest';
import { buildAskSamEvidencePack, slimProvenance } from './askSamEvidencePack.js';

describe('askSamEvidencePack', () => {
  it('slims provenance without PSA object keys', () => {
    const slim = slimProvenance({
      asOfDate: '2026-03-31',
      fromSysId: 'CMS_DATA_MEDICAID_ENR',
      loadHistoryId: 'LH-1',
      sourcePageUri: 'https://example.test',
      psaObjectKey: 'psa/secret/path.csv',
      measureFlow: ['PSA', 'Cleanse', 'Cube'],
    });
    expect(slim.psaObjectKey).toBeUndefined();
    expect(slim.loadHistoryId).toBe('LH-1');
    expect(slim.measureFlow).toEqual(['PSA', 'Cleanse', 'Cube']);
  });

  it('builds a pack with landing tiles and gaps for a role', () => {
    const pack = buildAskSamEvidencePack({
      view: 'role-home',
      roleId: 'legislator',
      spineStep: 'Results',
      focuses: ['care'],
      findings: [{ id: 'f-pharmacy', title: 'Pharmacy', focusId: 'budget' }],
      pack: { id: 'p1', title: 'Access pack', tags: ['access'] },
      askSamHint: 'Start with county membership',
    });
    expect(pack.schema).toMatch(/ask-sam-evidence-pack/);
    expect(pack.ui.roleId).toBe('legislator');
    expect(pack.ui.askSamHint).toMatch(/county/i);
    expect(pack.landing.accurateLandingTiles.length).toBeGreaterThan(0);
    expect(pack.landing.roleHomeTiles.length).toBeGreaterThan(0);
    expect(pack.blender.findings[0].id).toBe('f-pharmacy');
    expect(pack.sourcesIndex.length).toBeGreaterThan(0);
    const json = JSON.stringify(pack);
    expect(json).not.toMatch(/psaObjectKey/);
  });
});
