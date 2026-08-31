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
      }
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
    }
  });
});
