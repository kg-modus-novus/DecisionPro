import { describe, expect, it } from 'vitest';
import { EVIDENCE_ROOMS, FINDINGS, FOCUS_TABS } from '../data/fixtures.js';
import { HOME_SMART_TILES, getHomeSmartTiles } from '../data/homeSmartTiles.js';
import { ROLE_IDS } from '../data/roleProfiles.js';
import { SMART_TILE_VISUALS } from './smartTileVisuals.jsx';

const ROOM_IDS = new Set(EVIDENCE_ROOMS.map((room) => room.id));
const FOCUS_IDS = new Set(FOCUS_TABS.map((focus) => focus.id));
const FINDING_IDS = new Set(FINDINGS.map((finding) => finding.id));
const VISUALS = new Set(SMART_TILE_VISUALS);

describe('home smart tiles', () => {
  it('defines three actionable insight tiles for every role', () => {
    expect(Object.keys(HOME_SMART_TILES).sort()).toEqual([...ROLE_IDS].sort());

    for (const roleId of ROLE_IDS) {
      const tiles = getHomeSmartTiles(roleId);
      expect(tiles, roleId).toHaveLength(3);
      expect(new Set(tiles.map((tile) => tile.id)).size).toBe(tiles.length);

      for (const tile of tiles) {
        expect(tile.kind).toBeTruthy();
        expect(tile.title).toBeTruthy();
        expect(tile.value).toBeTruthy();
        expect(tile.comparison).toBeTruthy();
        expect(tile.why).toBeTruthy();
        expect(tile.destinationLabel).toBeTruthy();
        expect(VISUALS.has(tile.visual), `${tile.id} visual`).toBe(true);
        if (tile.visual === 'gap') {
          expect(tile.gap?.gapId || tile.comparison).toBeTruthy();
          expect(tile.series).toBeFalsy();
        }
        if (tile.series) {
          expect(tile.series.length).toBeGreaterThan(1);
        }
        expect(['positive', 'critical', 'negative', 'info']).toContain(tile.semantic);
        expect(['up', 'down', 'stable']).toContain(tile.direction);
        expect(['evidence', 'blender', 'legislation', 'sources', 'role-home']).toContain(
          tile.destination.view,
        );
      }
    }
  });

  it('uses valid rooms, focuses, and findings in each destination', () => {
    for (const tiles of Object.values(HOME_SMART_TILES)) {
      for (const tile of tiles) {
        const destination = tile.destination;
        if (destination.view === 'evidence') {
          expect(ROOM_IDS.has(destination.roomId), tile.id).toBe(true);
        }
        for (const focus of destination.focuses || []) {
          expect(FOCUS_IDS.has(focus), `${tile.id}:${focus}`).toBe(true);
        }
        for (const finding of destination.findings || []) {
          expect(FINDING_IDS.has(finding), `${tile.id}:${finding}`).toBe(true);
        }
      }
    }
  });
});
