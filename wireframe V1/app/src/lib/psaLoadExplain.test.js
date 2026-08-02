import { describe, expect, it } from 'vitest';
import { buildPsaLoadExplain } from './psaLoadExplain.js';

describe('buildPsaLoadExplain', () => {
  it('says all data was loaded when PSA matches publisher record total', () => {
    const explain = buildPsaLoadExplain({
      fromSysId: 'CMS_PI',
      disposition: 'LOADED',
      loadedDepth: {
        sourceRecordCount: 10812,
        sourceRecordUnit: 'rows',
        loadedRowCount: 10812,
        sourceScale: { recordCount: 10812, recordUnit: 'rows', label: '1 CSV · 10,812 rows' },
      },
    });
    expect(explain.status).toBe('all');
    expect(explain.verdict).toBe('All data was loaded.');
    expect(explain.reason).toBeNull();
  });

  it('explains curated bind when PSA holds fewer publisher rows', () => {
    const explain = buildPsaLoadExplain({
      fromSysId: 'CMS_RX',
      disposition: 'LOADED',
      loadedDepth: {
        sourceRecordCount: 18511,
        sourceRecordUnit: 'rows',
        loadedRowCount: 1,
        sourceRecordNote:
          'Publisher inventory from CMS Medicaid Spending by Drug CSV. KY program total in DecisionPro is a curated aggregate bind, not a rollup of national drug rows.',
        sourceScale: {
          recordCount: 18511,
          recordUnit: 'rows',
          note: 'Publisher inventory from CMS Medicaid Spending by Drug CSV. KY program total in DecisionPro is a curated aggregate bind, not a rollup of national drug rows.',
        },
      },
    });
    expect(explain.status).toBe('partial');
    expect(explain.verdict).toMatch(/less data than the publisher/i);
    expect(explain.reason).toMatch(/curated aggregate bind/i);
  });

  it('compares PDF inventory when record totals are absent', () => {
    const explain = buildPsaLoadExplain({
      fromSysId: 'KY_EVAL',
      disposition: 'LOADED',
      loadedDepth: {
        sourceRecordCount: null,
        loadedRowCount: 1,
        sourceScale: {
          recordCount: null,
          batches: [{ kind: 'pdf', count: 14, label: 'quality/eval PDFs' }],
          note: 'Publisher inventory: 14 quality/eval PDFs. DecisionPro binds evaluation meta from the summary PDF.',
        },
      },
    });
    expect(explain.status).toBe('partial');
    expect(explain.reason).toMatch(/summary PDF/i);
  });

  it('treats matching PDF count as a full load', () => {
    const explain = buildPsaLoadExplain({
      fromSysId: 'KY_COUNTY',
      disposition: 'LOADED',
      loadedDepth: {
        sourceRecordCount: null,
        loadedRowCount: 2,
        sourceScale: {
          batches: [{ kind: 'pdf', count: 2, label: 'monthly county PDFs' }],
        },
      },
    });
    expect(explain.status).toBe('all');
    expect(explain.verdict).toBe('All data was loaded.');
  });
});
