import { describe, expect, it } from 'vitest';
import {
  FINDING_PRIMARY_SOURCES,
  ROOM_PRIMARY_SOURCES,
  SOURCE,
  primarySourcesForFinding,
  primarySourcesForRoom,
  primarySourcesForSourceLabel,
} from '../data/alp/primarySources.js';
import { FINDINGS } from '../data/fixtures.js';
import { SEED_CUBES } from '../data/alp/seedCubes.js';
import { listSlice } from './alpCube.js';

describe('primary data sources', () => {
  it('includes CMS performance and data portals in the catalog', () => {
    expect(SOURCE.cmsPartCDPerformance.href).toContain('part-c-d-performance-data');
    expect(SOURCE.cmsStarRatingsFactSheet2026.href).toContain('part-c-d-performance-data');
    expect(SOURCE.cmsStarRatingsFactSheet2026Pdf.href).toContain('2026-star-ratings-fact-sheet.pdf');
    expect(SOURCE.cmsDataSearch.href).toBe('https://data.cms.gov/search');
    expect(SOURCE.kyDmsManagedCare.href).toContain('mco-options');
    expect(SOURCE.kyOpenData.href).toContain('opengisdata.ky.gov');
    expect(SOURCE.cmsStatsTrends.href).toBe('https://www.cms.gov/data-research');
  });

  it('attaches primary sources to every finding and room cube', () => {
    for (const f of FINDINGS) {
      expect(f.primarySources?.length).toBeGreaterThan(0);
      expect(primarySourcesForFinding(f.id).length).toBeGreaterThan(0);
      expect(FINDING_PRIMARY_SOURCES[f.id]).toBeTruthy();
    }
    for (const roomId of Object.keys(SEED_CUBES)) {
      expect(SEED_CUBES[roomId].primarySources?.length).toBeGreaterThan(0);
      expect(ROOM_PRIMARY_SOURCES[roomId]?.length).toBeGreaterThan(0);
      expect(primarySourcesForRoom(roomId).length).toBeGreaterThan(0);
    }
  });

  it('puts primary source links on ALP object rows', () => {
    const { rows } = listSlice('mco', {}, { page: 0, pageSize: 3 });
    expect(rows[0].primarySources.some((s) => s.href.includes('part-c-d-performance-data'))).toBe(true);
    const defs = listSlice('measure-definitions', {}, { page: 0, pageSize: 1 }).rows[0];
    expect(primarySourcesForSourceLabel(defs.source).length).toBeGreaterThan(0);
    expect(defs.primarySources.length).toBeGreaterThan(0);
  });
});
