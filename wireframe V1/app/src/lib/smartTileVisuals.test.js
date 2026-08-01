import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ComparisonPills,
  SMART_TILE_VISUALS,
  formatCompactNumber,
  resolveDisplayUnit,
  seriesTickPositions,
} from './smartTileVisuals.jsx';

describe('resolveDisplayUnit', () => {
  it('drops percent when the value already includes %', () => {
    expect(resolveDisplayUnit('-6.27%', 'percent')).toBeNull();
    expect(resolveDisplayUnit('78.2%', 'percent')).toBeNull();
  });

  it('keeps unit labels that are not already in the value', () => {
    expect(resolveDisplayUnit('1,294,021', 'persons')).toBe('persons');
    expect(resolveDisplayUnit('78.2', 'percent')).toBe('percent');
  });
});

describe('SMART_TILE_VISUALS', () => {
  it('includes SAP-mapped content styles from the style catalog', () => {
    expect(SMART_TILE_VISUALS).toEqual(
      expect.arrayContaining([
        'metric',
        'areaTrend',
        'barCompare',
        'bullet',
        'radial',
        'heroBreakdown',
        'status',
        'gap',
      ]),
    );
  });
});

describe('seriesTickPositions', () => {
  it('places a tick for every period including intermediates', () => {
    expect(seriesTickPositions(3)).toEqual([0, 50, 100]);
    expect(seriesTickPositions(2)).toEqual([0, 100]);
    expect(seriesTickPositions(1)).toEqual([]);
  });
});

describe('formatCompactNumber', () => {
  it('compacts large enrollment counts for under-chart labels', () => {
    expect(formatCompactNumber(1294021, { unit: 'persons' })).toBe('1.3M');
    expect(formatCompactNumber(1325311, { unit: 'persons' })).toBe('1.3M');
    expect(formatCompactNumber(198412, { unit: 'persons' })).toBe('198K');
  });

  it('keeps percent series readable', () => {
    expect(formatCompactNumber(-6.27, { unit: 'percent' })).toBe('-6.3%');
    expect(formatCompactNumber(78.2, { unit: 'percent' })).toBe('78.2%');
  });
});

describe('ComparisonPills', () => {
  it('puts label and value above a filled track', () => {
    const html = renderToStaticMarkup(
      createElement(ComparisonPills, {
        rows: [
          { label: 'Fed KY total', display: '12,840M', value: 12840, tone: 'warning' },
          { label: 'Pharmacy pub.', display: '$1,862M', value: 1862, tone: 'negative' },
          { label: 'Claim-grain $', display: 'Gap', isGap: true },
        ],
      }),
    );
    expect(html).toContain('st-compare-head');
    expect(html).toContain('st-compare-track');
    expect(html).toContain('Fed KY total');
    expect(html).toContain('12,840M');
    expect(html).toContain('is-warning');
    expect(html).toContain('is-gap');
    expect(html).not.toContain('#6ec8ff');
  });
});
