import { describe, expect, it } from 'vitest';
import { DATA_FLOW_CATALOG, DATA_FLOWS } from '../data/fixtures.js';
import { buildCombinedDataFlowGraph } from './combinedDataFlowGraph.js';

describe('buildCombinedDataFlowGraph', () => {
  it('stacks Evidence Rooms above cubes for selected flows', () => {
    const selected = DATA_FLOW_CATALOG.filter((r) =>
      ['enrollment', 'mco', 'public-hydration'].includes(r.id),
    );
    const graph = buildCombinedDataFlowGraph(selected, DATA_FLOWS);
    expect(graph.edges.length).toBeGreaterThan(0);

    const rooms = graph.nodes.filter((n) => n.type === 'evidenceRoom');
    const cubes = graph.nodes.filter((n) => n.type === 'cube');
    const psas = graph.nodes.filter((n) => n.type === 'psa');

    expect(rooms.map((r) => r.meta).sort()).toEqual(
      expect.arrayContaining(['command-center', 'mco', 'outcomes']),
    );
    expect(cubes.some((c) => c.technicalName === 'CUBE_EXEC_LANDING')).toBe(true);
    expect(cubes.some((c) => String(c.technicalName).startsWith('CUBE_ROOM_'))).toBe(true);
    expect(psas.length).toBeGreaterThanOrEqual(2);

    for (const room of rooms) {
      const roomCube = graph.nodes.find(
        (n) => n.type === 'cube' && n.detail?.roomId === room.detail.roomId,
      );
      expect(roomCube).toBeTruthy();
      expect(graph.edges.some((e) => e.from === roomCube.id && e.to === room.id)).toBe(true);
    }
  });

  it('synthesizes planned flows without a canvas', () => {
    const planned = DATA_FLOW_CATALOG.find((r) => r.id === 'scorecard');
    const graph = buildCombinedDataFlowGraph([planned], DATA_FLOWS);
    expect(graph.nodes.some((n) => n.type === 'psa')).toBe(true);
    expect(graph.nodes.some((n) => n.type === 'evidenceRoom')).toBe(true);
    expect(graph.nodes.every((n) => n.type !== 'report')).toBe(true);
  });
});
