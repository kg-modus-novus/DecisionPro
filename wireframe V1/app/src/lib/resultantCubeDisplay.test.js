import { describe, expect, it } from 'vitest';
import { buildCubeFactRowTotals, formatResultantCubeLine } from './resultantCubeDisplay.js';

describe('resultantCubeDisplay', () => {
  it('aggregates fact totals across sources and formats both counts', () => {
    const totals = buildCubeFactRowTotals([
      {
        loadedDepth: {
          resultantCubes: [
            { cubeId: 'benchmarks', label: 'benchmarks', rowCount: 11 },
            { cubeId: 'outcomes', label: 'outcomes', rowCount: 11 },
          ],
        },
      },
      {
        loadedDepth: {
          resultantCubes: [{ cubeId: 'benchmarks', label: 'benchmarks', rowCount: 2 }],
        },
      },
    ]);
    expect(totals.get('benchmarks')).toBe(13);
    expect(formatResultantCubeLine({ cubeId: 'benchmarks', label: 'benchmarks', rowCount: 11 }, totals).text).toBe(
      'benchmarks: 11 · fact 13',
    );
  });

  it('prefers exported factRowCount when present', () => {
    const line = formatResultantCubeLine(
      { cubeId: 'mco', label: 'mco', rowCount: 1, factRowCount: 2 },
      new Map([['mco', 99]]),
    );
    expect(line.text).toBe('mco: 1 · fact 2');
  });
});
