import { describe, expect, it } from 'vitest';
import { signedValueDomain, valueToPlotY } from './miniChartScale.js';

describe('miniChartScale', () => {
  it('keeps negative gap points inside the plot band', () => {
    const { min, max } = signedValueDomain([-7.9, -6.6, -4.6, 0.4, 0]);
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(0);
    const top = 14;
    const bottom = 70;
    const yNeg = valueToPlotY(-7.9, min, max, top, bottom);
    const yPos = valueToPlotY(0.4, min, max, top, bottom);
    const yZero = valueToPlotY(0, min, max, top, bottom);
    expect(yNeg).toBeGreaterThanOrEqual(top);
    expect(yNeg).toBeLessThanOrEqual(bottom);
    expect(yPos).toBeGreaterThanOrEqual(top);
    expect(yPos).toBeLessThanOrEqual(bottom);
    expect(yNeg).toBeGreaterThan(yPos);
    expect(yZero).toBeGreaterThan(yPos);
    expect(yZero).toBeLessThan(yNeg);
  });

  it('anchors all-positive series at zero', () => {
    const { min, max } = signedValueDomain([2, 5, 9]);
    expect(min).toBe(0);
    expect(max).toBe(9);
  });
});
