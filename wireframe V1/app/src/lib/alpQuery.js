/**
 * Filter / aggregate helpers for ALP evidence rooms.
 */

export function applyFilters(rows, filters) {
  return rows.filter((row) =>
    Object.entries(filters).every(([key, value]) => {
      if (value == null || value === '' || value === 'all') return true;
      return row[key] === value;
    }),
  );
}

export function aggregateBy(rows, dimensionKey, valueKey, { top = 8 } = {}) {
  const map = new Map();
  for (const row of rows) {
    const key = row[dimensionKey] ?? 'unknown';
    const add = Number(row[valueKey]) || 0;
    map.set(key, (map.get(key) || 0) + add);
  }
  return [...map.entries()]
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

export function seriesByPeriod(rows, valueKey) {
  const map = new Map();
  for (const row of rows) {
    const key = row.period;
    map.set(key, (map.get(key) || 0) + (Number(row[valueKey]) || 0));
  }
  return [...map.entries()].map(([id, value]) => ({ id, value }));
}

export function countBy(rows, dimensionKey) {
  const map = new Map();
  for (const row of rows) {
    const key = row[dimensionKey] ?? 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value);
}
