import { describe, expect, it } from 'vitest';
import { getHomeSmartTiles } from '../data/homeSmartTiles.js';
import { getRoleLandingTiles } from '../data/roleTileProfiles.js';
import { buildSmartTileExplain } from './smartTileExplain.js';

describe('buildSmartTileExplain', () => {
  it('cites the actual maternal rate in interpret copy', () => {
    const tiles = getRoleLandingTiles('legislator');
    const maternal = tiles.find((t) => t.measureId === 'M-012');
    const explain = buildSmartTileExplain(maternal);
    expect(explain.interpret).toMatch(/78\.2%/);
    expect(explain.interpret.toLowerCase()).toMatch(/here/);
    expect(explain.useData).toMatch(/78\.2%/);
  });

  it('cites Explicit Gap labels for HD spend signals', () => {
    const [hd] = getHomeSmartTiles('legislator');
    const explain = buildSmartTileExplain(hd);
    expect(explain.interpret).toMatch(/Gap/i);
    expect(explain.interpret).toMatch(/GAP-HD-EXPENDITURE|HD spend|House-district/i);
  });

  it('builds explains for every role-signal tile', () => {
    for (const roleId of [
      'legislator',
      'legislative-staff',
      'budget-analyst',
      'medicaid-leadership',
      'policy-analyst',
      'oversight-auditor',
      'data-steward',
    ]) {
      for (const tile of getHomeSmartTiles(roleId)) {
        const explain = buildSmartTileExplain(tile);
        expect(explain.title, tile.id).toBeTruthy();
        expect(explain.interpret, tile.id).toMatch(/Here,/);
        const shown = String(tile.value || '');
        const citesValue = shown && explain.interpret.includes(shown);
        const citesGap = /Gap/i.test(explain.interpret);
        expect(citesValue || citesGap, `${tile.id}: ${explain.interpret}`).toBe(true);
      }
    }
  });
});
