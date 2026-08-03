import { describe, expect, it } from 'vitest';
import { catalogueFromSysIdsForRoom } from './alpCube.js';
import { filterTileExplain } from './tileExplains.js';

describe('catalogueFromSysIdsForRoom', () => {
  it('returns distinct FromSysIDs for a room cube', () => {
    const ids = catalogueFromSysIdsForRoom('utilization');
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('attaches catalogueSources on filter tile explains', () => {
    const explain = filterTileExplain(
      { key: 'period', label: 'Period' },
      { roomId: 'utilization', title: 'Utilization & Access' },
    );
    expect(explain.catalogueSources?.length).toBeGreaterThan(0);
    expect(explain.catalogueSources[0]).toEqual(
      expect.objectContaining({ fromSysId: expect.any(String), label: expect.any(String) }),
    );
    expect(explain.primarySources?.length).toBeGreaterThan(0);
  });
});
