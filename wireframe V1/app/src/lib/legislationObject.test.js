import { describe, expect, it } from 'vitest';
import {
  LAW_INSTRUMENTS,
  draftsForInstrument,
  getLawInstrument,
} from '../data/alp/legislation.js';
import { buildBrief } from './blend.js';
import { FINDINGS, OPTION_PACKS } from '../data/fixtures.js';

describe('legislation catalog', () => {
  it('provides object-page fields for every instrument', () => {
    expect(LAW_INSTRUMENTS.length).toBeGreaterThan(0);
    for (const law of LAW_INSTRUMENTS) {
      expect(getLawInstrument(law.id)?.id).toBe(law.id);
      expect(law.executiveSummary).toBeTruthy();
      expect(law.primarySources?.length).toBeGreaterThan(0);
      expect(law.detailedAnalysis).toBeTruthy();
      expect(law.relevanceToAnalysis).toBeTruthy();
      expect(law.relatedOpinions?.length).toBeGreaterThan(0);
      expect(law.objectType).toBeTruthy();
      for (const src of law.primarySources) {
        expect(src.href).toMatch(/^https:\/\//);
      }
    }
  });

  it('links drafts to known instruments', () => {
    const drafts = draftsForInstrument('gap-data-freshness');
    expect(drafts.some((d) => d.id === 'draft-freshness')).toBe(true);
  });

  it('attaches instrument ids on brief law notes', () => {
    const findings = FINDINGS.filter((f) => f.id === 'f-pharmacy' || f.id === 'f-avoidable-ed');
    const brief = buildBrief({
      focuses: ['budget', 'access'],
      findings,
      weights: { budget: 1, care: 1, access: 1, mco: 1, district: 1, bill: 1 },
      packs: OPTION_PACKS,
      spineStep: 'Action',
      trustReviewed: true,
    });
    expect(brief.lawNotes.every((n) => n.instrumentId && getLawInstrument(n.instrumentId))).toBe(true);
  });
});
