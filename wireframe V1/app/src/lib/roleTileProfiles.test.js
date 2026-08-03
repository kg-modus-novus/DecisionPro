import { describe, expect, it } from 'vitest';
import { ACCURATE_LANDING } from '../data/alp/accurateLanding.js';
import {
  MEASURE_EVIDENCE_DESTINATION,
  ROLE_LANDING_PROFILES,
  ROLE_TILE_PROFILE_IDS,
  getRoleLandingTiles,
  measureSeriesPoints,
} from '../data/roleTileProfiles.js';
import { ROLE_IDS } from '../data/roleProfiles.js';
import { SMART_TILE_VISUALS } from './smartTileVisuals.jsx';

const MEASURE_IDS = new Set((ACCURATE_LANDING.measures || []).map((m) => m.measureId));
const VISUALS = new Set(SMART_TILE_VISUALS);

/** Locked matrix from docs/planning/smart-tile-style-catalog.md §4 */
const LANDING_MATRIX = {
  legislator: [
    ['M-001', 'areaTrend'],
    ['M-003', 'barCompare'],
    ['M-003', 'barCompare'],
    ['M-012', 'radial'],
    ['M-002', 'bullet'],
  ],
  'legislative-staff': [
    ['M-012', 'radial'],
    ['M-014', 'status'],
    ['M-001', 'areaTrend'],
    ['M-010', 'radial'],
  ],
  'budget-analyst': [
    ['M-017', 'heroBreakdown'],
    ['M-002', 'bullet'],
    ['M-004', 'metric'],
    ['M-001', 'areaTrend'],
  ],
  'medicaid-leadership': [
    ['M-007', 'bullet'],
    ['M-014', 'status'],
    ['M-010', 'radial'],
    ['M-001', 'areaTrend'],
  ],
  'policy-analyst': [
    ['M-010', 'barCompare'],
    ['M-012', 'radial'],
    ['M-017', 'metric'],
    ['M-011', 'areaTrend'],
  ],
};

describe('roleTileProfiles', () => {
  it('covers every role with a landing profile', () => {
    expect([...ROLE_TILE_PROFILE_IDS].sort()).toEqual([...ROLE_IDS].sort());
  });

  it('selects real measure ids and known visuals', () => {
    for (const roleId of ROLE_IDS) {
      const profile = ROLE_LANDING_PROFILES[roleId];
      expect(profile.length).toBeGreaterThanOrEqual(3);
      for (const entry of profile) {
        if (entry.catalogue) continue;
        expect(MEASURE_IDS.has(entry.measureId), `${roleId}:${entry.measureId}`).toBe(true);
        expect(VISUALS.has(entry.visual), `${roleId}:${entry.visual}`).toBe(true);
      }
      const tiles = getRoleLandingTiles(roleId);
      expect(tiles.length).toBeGreaterThanOrEqual(3);
      for (const tile of tiles) {
        expect(VISUALS.has(tile.visual), tile.measureId).toBe(true);
        expect(tile.title).toBeTruthy();
        expect(tile.value).toBeTruthy();
        if (tile.measure) {
          expect(tile.destination?.view).toBe('evidence');
          expect(tile.destination?.roomId).toBeTruthy();
          expect(tile.trustLabel).toMatch(/trust/i);
          expect(tile.destinationLabel).not.toMatch(/trust/i);
        }
      }
    }
  });

  it('maps core Accurate measures to Evidence Room destinations', () => {
    expect(MEASURE_EVIDENCE_DESTINATION['M-001'].roomId).toBe('command-center');
    expect(MEASURE_EVIDENCE_DESTINATION['M-003'].roomId).toBe('county');
    expect(MEASURE_EVIDENCE_DESTINATION['M-003'].filters.county).toBeUndefined();
    expect(MEASURE_EVIDENCE_DESTINATION['M-012'].roomId).toBe('outcomes');
  });

  it('matches the locked Accurate Landing style matrix', () => {
    for (const [roleId, expected] of Object.entries(LANDING_MATRIX)) {
      const profile = ROLE_LANDING_PROFILES[roleId].filter((e) => !e.catalogue);
      expect(profile.map((e) => [e.measureId, e.visual])).toEqual(expected);
    }
  });

  it('binds REAL measureSeries into areaTrend tiles when available', () => {
    const m001 = measureSeriesPoints('M-001');
    expect(m001?.series?.length).toBeGreaterThanOrEqual(2);
    const tiles = getRoleLandingTiles('legislator');
    const enroll = tiles.find((t) => t.measureId === 'M-001');
    expect(enroll.visual).toBe('areaTrend');
    expect(enroll.series.length).toBeGreaterThanOrEqual(2);
    expect(enroll.seriesLabels.length).toBe(enroll.series.length);
  });

  it('builds radial percent content for quality rates', () => {
    const tiles = getRoleLandingTiles('legislator');
    const maternal = tiles.find((t) => t.measureId === 'M-012');
    expect(maternal.visual).toBe('radial');
    expect(maternal.radial.percent).toBeGreaterThan(0);
  });

  it('gives county enrollment top-3 and bottom-3 barCompare graphs', () => {
    const tiles = getRoleLandingTiles('legislator');
    const top = tiles.find((t) => t.measureId === 'M-003');
    const bottom = tiles.find((t) => t.measureId === 'M-003-BOTTOM');
    expect(top.visual).toBe('barCompare');
    expect(top.title).toMatch(/top 3/i);
    expect(top.bars).toHaveLength(3);
    expect(top.bars[0].value).toBeGreaterThanOrEqual(top.bars[1].value);
    expect(top.bars.map((b) => b.label)).toEqual(['Jefferson', 'Fayette', 'Warren']);
    expect(bottom.visual).toBe('barCompare');
    expect(bottom.title).toMatch(/bottom 3/i);
    expect(bottom.bars).toHaveLength(3);
    expect(bottom.bars[0].value).toBeLessThanOrEqual(bottom.bars[1].value);
    expect(bottom.bars.map((b) => b.label)).toEqual(['Pike', 'Boone', 'Kenton']);
    expect(top.measure?.measureId).toBe('M-003');
    expect(bottom.measure?.measureId).toBe('M-003');
  });

  it('gives federal expenditure REAL peer comparison pills (not a lone bump)', () => {
    const tiles = getRoleLandingTiles('budget-analyst');
    const fed = tiles.find((t) => t.measureId === 'M-004');
    expect(fed.compareRows.length).toBeGreaterThanOrEqual(2);
    expect(fed.compareRows.some((r) => /Fed/i.test(r.label))).toBe(true);
    expect(fed.compareRows.some((r) => /Pharmacy|Gap/i.test(r.label))).toBe(true);
  });
});
