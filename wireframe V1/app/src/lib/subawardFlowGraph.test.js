import { describe, expect, it } from 'vitest';
import { SUBAWARD_FLOW_GRAPH } from '../data/alp/subawardFlowGraph.js';

describe('OFR-06 federal sub-award flow graph', () => {
  it('is state-neutral: exactly KY and FL, each populated only from its own hydration', () => {
    expect(Object.keys(SUBAWARD_FLOW_GRAPH.byState).sort()).toEqual(['FL', 'KY']);
    for (const state of ['KY', 'FL']) {
      expect(SUBAWARD_FLOW_GRAPH.byState[state].state).toBe(state);
    }
  });

  it('labels every funding edge with an explicit identity confidence', () => {
    for (const state of ['KY', 'FL']) {
      const slice = SUBAWARD_FLOW_GRAPH.byState[state];
      expect(slice.identityConfidenceNote).toMatch(/exact-derived|unresolved/);
      for (const edge of slice.fundingEdges.edges) {
        expect(['exact-derived', 'unresolved']).toContain(edge.identityConfidence);
        if (edge.identityConfidence === 'unresolved') {
          expect(edge.recipientEin).toBeNull();
        }
      }
    }
  });

  it('never labels concentration or overlap as duplication, waste, or a finding', () => {
    for (const state of ['KY', 'FL']) {
      const text = JSON.stringify(SUBAWARD_FLOW_GRAPH.byState[state]);
      expect(text).not.toMatch(/\bfraud\b|\bbreach\b/i);
      expect(text).toMatch(/never itself evidence of duplication, waste/i);
    }
  });

  it('caps the funding-edge list', () => {
    for (const state of ['KY', 'FL']) {
      expect(SUBAWARD_FLOW_GRAPH.byState[state].fundingEdges.edges.length).toBeLessThanOrEqual(25);
    }
  });

  it('passed Source Reconciliation on the last gate run (no fake green)', () => {
    expect(SUBAWARD_FLOW_GRAPH.reconciliation.status).toBe('PASS');
    expect(SUBAWARD_FLOW_GRAPH.reconciliation.claimAllowed).toBe(true);
    for (const check of SUBAWARD_FLOW_GRAPH.reconciliation.checks) {
      expect(check.ok).toBe(true);
    }
  });
});
