import { describe, expect, it } from 'vitest';
import {
  FUNDING_RESILIENCE_ROOM,
  FUNDING_RESILIENCE_TYPES,
  FUNDING_RESILIENCE_SOURCE_IDS,
  fundingResilienceCsvRows,
} from '../data/alp/fundingResilienceRoom.js';

describe('OFR-08 Funding & Resilience Evidence Room data layer', () => {
  it('is state-neutral: exactly KY and FL, each populated only from its own hydration', () => {
    expect(Object.keys(FUNDING_RESILIENCE_ROOM.byState).sort()).toEqual(['FL', 'KY']);
    for (const state of ['KY', 'FL']) {
      const slice = FUNDING_RESILIENCE_ROOM.byState[state];
      expect(slice.state).toBe(state);
      expect(slice.items.every((item) => item.state === state)).toBe(true);
      expect(slice.items.length).toBeGreaterThan(0);
    }
  });

  it('every item type maps to a known package and source system', () => {
    const knownTypes = new Set(FUNDING_RESILIENCE_TYPES.map((t) => t.id));
    for (const state of ['KY', 'FL']) {
      for (const item of FUNDING_RESILIENCE_ROOM.byState[state].items) {
        expect(knownTypes.has(item.type)).toBe(true);
        expect(item.guardrail).toBeTruthy();
        expect(item.playbook?.goal).toBeTruthy();
        expect(item.playbook?.lookFor).toBeTruthy();
        expect(item.playbook?.steps?.length).toBeGreaterThanOrEqual(3);
        expect(item.playbook?.useResult).toBeTruthy();
        expect(item.playbook?.successMeasure).toBeTruthy();
      }
    }
  });

  it('turns the OFR-01 single-stream aggregate into recipient-level review rows', () => {
    for (const state of ['KY', 'FL']) {
      const rows = FUNDING_RESILIENCE_ROOM.byState[state].items.filter((item) => item.type === 'single-stream');
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((item) => item.title && item.metricValue && item.detail)).toBe(true);
      expect(rows.every((item) => item.guardrail.includes('OFR-tracked'))).toBe(true);
    }
  });

  it('exposes graph-ready ownership and sub-award relationships without inventing named ownership members', () => {
    for (const state of ['KY', 'FL']) {
      const items = FUNDING_RESILIENCE_ROOM.byState[state].items;
      const fundingEdges = items.filter((item) => item.type === 'subaward-edge');
      const ownershipEdges = items.filter((item) => item.type === 'ownership-chain');
      expect(fundingEdges.length).toBeGreaterThan(0);
      expect(ownershipEdges.length).toBeGreaterThan(0);
      expect([...fundingEdges, ...ownershipEdges].every((item) => item.sourceNode && item.targetNode)).toBe(true);
      const exactNameChains = ownershipEdges.filter((item) => item.chainSource !== 'CMS_PROVIDER_DATA');
      const cmsChains = ownershipEdges.filter((item) => item.chainSource === 'CMS_PROVIDER_DATA');
      expect(exactNameChains.length).toBeGreaterThan(0);
      expect(cmsChains.length).toBeGreaterThan(0);
      expect(exactNameChains.every((item) => item.targetNode.includes('matched') && item.targetNode.includes('facilities'))).toBe(true);
      // CMS-reported chains are the publisher's grouping keyed on chain id; a
      // withheld label never echoes the publisher's (possibly personal) name.
      expect(cmsChains.every((item) => item.chainId && item.targetNode.includes('CMS chain'))).toBe(true);
      expect(cmsChains.filter((item) => item.labelWithheld).every((item) => /^CMS chain \S+ \(label withheld/.test(item.title))).toBe(true);
    }
  });

  it('keeps exact and inferred identity crosswalk assertions structurally separate — inferred is always flagged', () => {
    for (const state of ['KY', 'FL']) {
      const items = FUNDING_RESILIENCE_ROOM.byState[state].items;
      const exact = items.filter((i) => i.type === 'identity-exact');
      const inferred = items.filter((i) => i.type === 'identity-inferred');
      expect(exact.every((i) => !i.reviewCandidateOnly)).toBe(true);
      expect(inferred.every((i) => i.reviewCandidateOnly === true)).toBe(true);
    }
  });

  it('waiver/grant horizon items carry a source document citation and retrieval date', () => {
    for (const state of ['KY', 'FL']) {
      const items = FUNDING_RESILIENCE_ROOM.byState[state].items;
      const horizonItems = items.filter((i) => i.type === 'horizon-waiver' || i.type === 'horizon-nofo');
      expect(horizonItems.length).toBeGreaterThan(0);
      for (const item of horizonItems) {
        expect(item.sourceDocumentUri).toBeTruthy();
        expect(item.retrievedAt).toBeTruthy();
      }
    }
  });

  it('never labels a signal as waste, fraud, breach, or a confirmed finding', () => {
    for (const state of ['KY', 'FL']) {
      const text = JSON.stringify(FUNDING_RESILIENCE_ROOM.byState[state]);
      expect(text).not.toMatch(/\bfraud\b|\bbreach\b/i);
      expect(text).toMatch(/never itself|review candidate|never a (closure|compliance)/i);
    }
    expect(FUNDING_RESILIENCE_ROOM.note).toMatch(/review candidate/i);
  });

  it('lineage lists all nine governed OFR sources for each state', () => {
    for (const state of ['KY', 'FL']) {
      const lineageIds = FUNDING_RESILIENCE_ROOM.byState[state].lineage.map((l) => l.fromSysId).sort();
      expect(lineageIds).toEqual([...FUNDING_RESILIENCE_SOURCE_IDS].sort());
    }
  });

  it('builds CSV-ready rows with a stable column set', () => {
    const rows = fundingResilienceCsvRows('KY');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty('type');
      expect(row).toHaveProperty('title');
      expect(row).toHaveProperty('metricValue');
      expect(row).toHaveProperty('guardrail');
      expect(row).toHaveProperty('reviewCandidateOnly');
      expect(row).toHaveProperty('goal');
      expect(row).toHaveProperty('steps');
      expect(row).toHaveProperty('successMeasure');
      expect(row).toHaveProperty('organizationType');
      expect(row).toHaveProperty('publisherLabel');
      expect(row).toHaveProperty('continuationStatus');
      expect(row).toHaveProperty('gapStatus');
      expect(row).toHaveProperty('missingGapInputs');
    }
  });

  it('keeps runway identities governed and Release B continuation evidence honest', () => {
    const rows = FUNDING_RESILIENCE_ROOM.byState.KY.items.filter((item) => item.type === 'award-cliff');
    expect(rows.length).toBeGreaterThan(0);
    const cabinet = rows.find((item) => item.rawSourceName === 'HEALTH SERVICES KENTUCKY CABINET FOR');
    expect(cabinet.organizationName).toBe('Kentucky Cabinet for Health and Family Services');
    expect(cabinet.entityTypeLabel).toBe('Government agency');
    expect(cabinet.continuationAssessment.status).toBe('no_public_continuation_found');
    expect(cabinet.continuationAssessment.reasonCode).toBe('public_search_reconciled_no_affirmative_continuation');
    expect(cabinet.gapAssessment.status).toBe('not_assessable');
    expect(cabinet.gapAssessment.missingInputs).not.toContain('Reconciled public continuation search');
    expect(cabinet.gapAssessment.missingInputs.length).toBeGreaterThan(0);
    expect(cabinet.gapAssessment.gapRefs).not.toContain('GAP-FRI-LEGACY-RAW-CAPTURE');
    expect(rows.every((item) => !['monitor', 'potential_gap', 'gap_mitigated', 'confirmed_gap'].includes(item.gapAssessment.status))).toBe(true);
  });
});
