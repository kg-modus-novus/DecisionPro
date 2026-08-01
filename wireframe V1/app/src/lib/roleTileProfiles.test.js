import { describe, expect, it } from 'vitest';
import { ACCURATE_LANDING } from '../data/alp/accurateLanding.js';
import {
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
    ['M-003', 'metric'],
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
      }
    }
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

  it('gives county metric a share graphic vs KY total', () => {
    const tiles = getRoleLandingTiles('legislator');
    const county = tiles.find((t) => t.measureId === 'M-003');
    expect(county.visual).toBe('metric');
    expect(county.share.current).toBeGreaterThan(0);
    expect(county.share.total).toBeGreaterThan(county.share.current);
  });

  it('gives federal expenditure REAL peer comparison pills (not a lone bump)', () => {
    const tiles = getRoleLandingTiles('budget-analyst');
    const fed = tiles.find((t) => t.measureId === 'M-004');
    expect(fed.compareRows.length).toBeGreaterThanOrEqual(2);
    expect(fed.compareRows.some((r) => /Fed/i.test(r.label))).toBe(true);
    expect(fed.compareRows.some((r) => /Pharmacy|Gap/i.test(r.label))).toBe(true);
  });
});
