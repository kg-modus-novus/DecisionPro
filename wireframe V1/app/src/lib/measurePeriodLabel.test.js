import { describe, expect, it } from 'vitest';
import { formatMeasureComparison, formatMeasurePeriodLabel } from './measurePeriodLabel.js';

describe('measurePeriodLabel', () => {
  it('prefers Core Set periodLabel over bare asOfDate', () => {
    const measure = {
      asOfDate: '2023-12-31',
      fromSysId: 'CMS_MEDICAID_SCORECARD',
      provenance: {
        periodLabel: 'FFY 2024 reporting · MY 2023',
        coreSetYear: 2024,
        measurementYear: 2023,
      },
    };
    expect(formatMeasurePeriodLabel(measure)).toBe('FFY 2024 reporting · MY 2023');
    expect(formatMeasureComparison(measure)).toBe(
      'FFY 2024 reporting · MY 2023 · CMS_MEDICAID_SCORECARD',
    );
  });

  it('falls back to As of date when no Core Set label', () => {
    expect(formatMeasurePeriodLabel({ asOfDate: '2026-03-31' })).toBe('As of 2026-03-31');
  });
});
