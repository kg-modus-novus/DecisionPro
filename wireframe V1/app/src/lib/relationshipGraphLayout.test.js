import { describe, expect, it } from 'vitest';
import { buildRelationshipGraph, wrapGraphLabel, zoomViewportAtPoint } from './relationshipGraphLayout.js';

describe('relationship graph layout', () => {
  it('deduplicates shared endpoints and aggregates sub-award actions into organization relationships', () => {
    const graph = buildRelationshipGraph([
      { type: 'subaward-edge', sourceNode: 'Prime A', targetNode: 'Recipient 1', relationshipValue: 100, date: '2024-01-01', evidenceContext: { actionDate: '2024-01-01', amount: 100, assistanceListing: '93.958', recipientEin: '123', primeOrganization: 'Prime A' } },
      { type: 'subaward-edge', sourceNode: 'Prime A', targetNode: 'Recipient 1', relationshipValue: 25, date: '2025-01-01', evidenceContext: { actionDate: '2025-01-01', amount: 25, assistanceListing: '93.958', recipientEin: '123', primeOrganization: 'Prime A' } },
      { type: 'subaward-edge', sourceNode: 'Prime A', targetNode: 'Recipient 2', relationshipValue: 50 },
      { type: 'subaward-edge', sourceNode: 'Prime B', targetNode: 'Recipient 2', relationshipValue: 10 },
    ]);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);
    expect(graph.recordCount).toBe(4);
    expect(new Set(graph.edges.map((edge) => edge.sourceId)).size).toBe(2);
    expect(new Set(graph.edges.map((edge) => edge.targetId)).size).toBe(2);
    expect(graph.edges.every((edge) => edge.path.startsWith('M ') && edge.path.includes(' C '))).toBe(true);
    const primeA = graph.nodes.find((node) => node.label === 'Prime A');
    expect(primeA.roleLabel).toBe('Prime organization');
    expect(primeA.metricLabel).toBe('Funding shown $175');
    expect(primeA.financialLabel).toMatch(/\$175/);
    expect(primeA.connectionLabel).toBe('3 sub-award actions to 2 sub-recipient organizations');
    expect(primeA.contextRows).toEqual([
      { actionDate: '2025-01-01', amount: 25, assistanceListing: '93.958', recipientEin: '123', primeOrganization: 'Prime A' },
      { actionDate: '2024-01-01', amount: 100, assistanceListing: '93.958', recipientEin: '123', primeOrganization: 'Prime A' },
    ]);
    expect(graph.edges.find((edge) => edge.item.targetNode === 'Recipient 1').item.graphMetricValue).toBe('2 sub-award actions · 2024–2025 · $125');
  });

  it('does not imply that ownership relationships carry funding amounts', () => {
    const graph = buildRelationshipGraph([
      { type: 'ownership-chain', sourceNode: 'Owner A', targetNode: 'Facility A', relationshipValue: 1, graphMetricValue: '2 stars', graphDetail: 'Managing control' },
    ]);
    const owner = graph.nodes.find((node) => node.kind === 'source');
    const facility = graph.nodes.find((node) => node.kind === 'target');
    expect(owner.metricLabel).toMatch(/1 matched facility/);
    expect(owner.financialLabel).toMatch(/No funding amount/);
    expect(facility.metricLabel).toBe('Quality 2 stars');
  });

  it('wraps long labels to no more than two SVG lines', () => {
    expect(wrapGraphLabel('A very long organization name that needs to fit inside one graphical node', 22).length).toBe(2);
  });

  it('zooms around the pointer while preserving the pointed graph coordinate', () => {
    const current = { x: 0, y: 0, scale: 1 };
    const next = zoomViewportAtPoint(current, 400, 250, -120);
    expect(next.scale).toBeGreaterThan(1);
    expect((400 - next.x) / next.scale).toBeCloseTo(400);
    expect((250 - next.y) / next.scale).toBeCloseTo(250);
  });
});
