import { describe, expect, it } from 'vitest';
import { clearCubeCache } from './alpCube.js';
import {
  buildLineageWorkbook,
  excelSafeSheetName,
  lineageTilesForExport,
  listActiveVisualFilters,
} from './exportLineageWorkbook.js';
import { buildRoomLineage } from './roomLineage.js';
import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';

describe('exportLineageWorkbook', () => {
  it('makes unique Excel-safe sheet names', () => {
    const used = new Set();
    const a = excelSafeSheetName('PSA_CMS_DATA_MEDICAID_ENR', used);
    const b = excelSafeSheetName('PSA_CMS_DATA_MEDICAID_ENR', used);
    expect(a).toBe('PSA_CMS_DATA_MEDICAID_ENR');
    expect(b).not.toBe(a);
    expect(a.length).toBeLessThanOrEqual(31);
    expect(excelSafeSheetName('Bad:Name*?/\\', new Set())).not.toMatch(/[:*?/\\]/);
  });

  it('lists active visual filters with labels', () => {
    const config = ROOM_CONFIGS.county;
    const rows = listActiveVisualFilters({ county: 'jefferson' }, config);
    expect(rows).toHaveLength(1);
    expect(rows[0].dimension).toBe('county');
    expect(rows[0].valueId).toBe('jefferson');
    expect(rows[0].valueLabel.toLowerCase()).toMatch(/jefferson/);
  });

  it('orders tiles query-first then PSA last', () => {
    clearCubeCache();
    const lineage = buildRoomLineage('command-center', {});
    const tiles = lineageTilesForExport(lineage);
    expect(tiles[0].id).toBe('query');
    expect(tiles[1].id).toBe('aggregate');
    expect(tiles.at(-1).layer).toBe('psa');
  });

  it('builds a workbook with Report first and one sheet per tile', async () => {
    clearCubeCache();
    const lineage = buildRoomLineage('command-center', {});
    const config = ROOM_CONFIGS['command-center'];
    const workbook = await buildLineageWorkbook({ lineage, config, filters: {} });
    const names = workbook.worksheets.map((ws) => ws.name);
    expect(names[0]).toBe('Report');
    expect(names.length).toBe(1 + lineageTilesForExport(lineage).length);

    const report = workbook.getWorksheet('Report');
    const texts = [];
    report.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') texts.push(cell.value);
        if (cell.value?.formula) texts.push(cell.value.formula);
      });
    });
    expect(texts.some((t) => /Visual filters/i.test(t))).toBe(true);
    expect(texts.some((t) => /COUNTA\(/i.test(t))).toBe(true);
    expect(texts.some((t) => /PSA sum equals Query/i.test(t))).toBe(true);
  });
});
