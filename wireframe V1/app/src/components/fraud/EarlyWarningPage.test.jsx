import { describe, expect, it } from 'vitest';
import { followedLines } from './EarlyWarningPage.jsx';

describe('followedLines', () => {
  it('gives each event its month so two same-kind events in one year read differently', () => {
    const lines = followedLines([
      { id: 'a', kind: 'authorization-or-limit', effectiveDate: '2025-01-01', summary: 'January letter' },
      { id: 'b', kind: 'authorization-or-limit', effectiveDate: '2025-06-25', summary: 'House Bill 695' },
    ]);
    expect(lines.map((l) => l.text)).toEqual(['Jan 2025 limits or prior authorization', 'Jun 2025 limits or prior authorization']);
    expect(new Set(lines.map((l) => l.text)).size).toBe(lines.length);
  });

  it('counts events with the same month and kind on one line', () => {
    const lines = followedLines([
      { id: 'a', kind: 'enforcement', effectiveDate: '2024-03-01', summary: 'one' },
      { id: 'b', kind: 'enforcement', effectiveDate: '2024-03-15', summary: 'two' },
    ]);
    expect(lines).toEqual([{ key: 'Mar 2024|enforcement', text: 'Mar 2024 enforcement (2 events)', title: 'one | two' }]);
  });
});
