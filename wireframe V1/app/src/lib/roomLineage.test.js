import { describe, expect, it } from 'vitest';
import { clearCubeCache } from './alpCube.js';
import { buildRoomLineage } from './roomLineage.js';
import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';

describe('buildRoomLineage', () => {
  it('builds bottom-up lineage for every evidence room', () => {
    clearCubeCache();
    for (const roomId of Object.keys(ROOM_CONFIGS)) {
      const graph = buildRoomLineage(roomId, {});
      expect(graph.layers.psa.length, roomId).toBeGreaterThan(0);
      expect(graph.layers.query.recordCount, roomId).toBe(graph.totalCount);
      expect(graph.layers.aggregate.recordCount, roomId).toBe(graph.totalCount);
      expect(graph.nodes.some((n) => n.layer === 'dso'), roomId).toBe(true);
      expect(graph.edges.some((e) => e.to === 'query'), roomId).toBe(true);
    }
  });

  it('updates record counts when filters change (county)', () => {
    clearCubeCache();
    const open = buildRoomLineage('county', {});
    const jefferson = buildRoomLineage('county', { county: 'jefferson' });
    expect(open.totalCount).toBeGreaterThan(jefferson.totalCount);
    expect(jefferson.layers.query.recordCount).toBe(jefferson.totalCount);
    expect(jefferson.layers.psa.every((n) => n.recordCount > 0 || n.status === 'upcoming')).toBe(
      true,
    );
    const psaSum = jefferson.layers.psa.reduce((a, n) => a + n.recordCount, 0);
    expect(psaSum).toBe(jefferson.totalCount);
  });

  it('keeps source fan-in edges into transformation', () => {
    clearCubeCache();
    const graph = buildRoomLineage('utilization', {});
    for (const src of graph.layers.psa) {
      expect(graph.edges).toContainEqual({ from: src.id, to: 'trfn' });
    }
  });

  it('attaches row arrays matching record counts for popup inspection', () => {
    clearCubeCache();
    const graph = buildRoomLineage('county', {});
    expect(graph.layers.query.rows).toHaveLength(graph.layers.query.recordCount);
    expect(graph.layers.aggregate.rows).toHaveLength(graph.layers.aggregate.recordCount);
    expect(graph.layers.dso.rows).toHaveLength(graph.layers.dso.recordCount);
    expect(graph.layers.transformation.rows).toHaveLength(graph.layers.transformation.recordCount);
    for (const src of graph.layers.psa) {
      expect(src.rows).toHaveLength(src.recordCount);
    }
  });
});
