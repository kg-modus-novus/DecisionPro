import { describe, expect, it } from 'vitest';
import {
  abbreviateSourceScaleLine,
  buildSourceScaleDisplayLines,
  sanitizeSourceScaleLabel,
} from './sourceScaleDisplay.js';

describe('sourceScaleDisplay', () => {
  it('abbreviates Financial Management open-data table to Fi-Mgt', () => {
    const result = abbreviateSourceScaleLine('1 Financial Management open-data table');
    expect(result.short).toBe('1 Fi-Mgt');
    expect(result.full).toBe('1 Financial Management open-data table');
    expect(result.abbreviated).toBe(true);
  });

  it('builds short tile lines with expansions for long dataset labels', () => {
    const lines = buildSourceScaleDisplayLines(
      {
        label: '1 Financial Management open-data table · 1 year · 15,511 rows',
        batches: [
          { kind: 'dataset', count: 1, label: 'Financial Management open-data table' },
          { kind: 'year', count: 1, label: 'year currently published in API (2016)' },
        ],
        recordCount: 15511,
        recordUnit: 'rows',
      },
      'rows',
    );
    expect(lines[0].short).toBe('1 Fi-Mgt');
    expect(lines[0].full).toContain('Financial Management');
    expect(lines.some((l) => l.short === '15,511 rows')).toBe(true);
  });

  it('shortens long PDF labels', () => {
    const result = abbreviateSourceScaleLine(
      '14 quality/eval PDFs (13 on page + FY2025 summary)',
    );
    expect(result.short).toBe('14 Q/E PDFs');
    expect(result.abbreviated).toBe(true);
  });

  it('ignores space-only differences as abbreviations', () => {
    const result = abbreviateSourceScaleLine('51 states + DC');
    expect(result.abbreviated).toBe(false);
    expect(result.short).toBe('51 states + DC');
  });

  it('strips HTTP 200 probe notes from display labels', () => {
    expect(sanitizeSourceScaleLabel('2 monthly county PDFs (HTTP 200)')).toBe(
      '2 monthly county PDFs',
    );
    const result = abbreviateSourceScaleLine('2 monthly county PDFs (HTTP 200)');
    expect(result.full).toBe('2 monthly county PDFs');
    expect(result.short).toBe('2 county PDFs');
  });
});
