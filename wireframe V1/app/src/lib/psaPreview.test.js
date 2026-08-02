import { describe, expect, it } from 'vitest';
import { buildPsaPreview } from './psaPreview.js';

describe('buildPsaPreview', () => {
  it('builds MCO roster columns from the curated PSA fixture', () => {
    const preview = buildPsaPreview({
      fromSysId: 'KY_DMS_MCO_CONTRACTS',
      disposition: 'LOADED',
      loadedDepth: { loadedRowCount: 6 },
    });
    expect(preview.columns).toContain('mco_key');
    expect(preview.rows.length).toBe(6);
    expect(preview.totalRowCount).toBe(6);
    expect(preview.rows[0][0]).toBe('aetna');
  });

  it('builds hydration-pack rows for Scorecard binds', () => {
    const preview = buildPsaPreview({
      fromSysId: 'CMS_MEDICAID_SCORECARD',
      disposition: 'LOADED',
      loadedDepth: { loadedRowCount: 11 },
    });
    expect(preview.columns).toContain('measure_id');
    expect(preview.rows.length).toBeGreaterThan(0);
    expect(preview.note).toMatch(/PUBLIC_HYDRATION/);
  });

  it('lists Kentucky enrollment periods and reports full PSA land size', () => {
    const preview = buildPsaPreview({
      fromSysId: 'CMS_DATA_MEDICAID_ENR',
      disposition: 'LOADED',
      loadedDepth: {
        loadedRowCount: 10812,
        periodIds: ['pi202501', 'pi202502'],
        asOfDates: ['2025-01-31', '2025-02-28'],
      },
    });
    expect(preview.columns).toContain('reporting_period');
    expect(preview.rows).toHaveLength(2);
    expect(preview.totalRowCount).toBe(10812);
    expect(preview.truncated).toBe(true);
    expect(preview.note).toMatch(/10,812/);
  });

  it('honors export-attached psaPreview payloads', () => {
    const preview = buildPsaPreview({
      fromSysId: 'CMS_DATA_MEDICAID',
      disposition: 'LOADED',
      loadedDepth: {
        loadedRowCount: 1,
        psaPreview: {
          columns: ['a', 'b'],
          rows: [['1', 'two']],
          totalRowCount: 1,
          note: 'Attached sample.',
        },
      },
    });
    expect(preview.columns).toEqual(['a', 'b']);
    expect(preview.rows).toEqual([['1', 'two']]);
    expect(preview.note).toBe('Attached sample.');
  });

  it('explains empty PSA for gaps', () => {
    const preview = buildPsaPreview({
      kind: 'gap',
      disposition: 'GAP',
      fromSysId: 'GAP-CLAIMS-COST-DRIVERS',
    });
    expect(preview.totalRowCount).toBe(0);
    expect(preview.rows[0][0]).toMatch(/Explicit Gap/);
  });
});
