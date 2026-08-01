import { useMemo, useState } from 'react';

function normalize(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(' ');
  return String(value);
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return normalize(a).localeCompare(normalize(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Shared text filter + optional facet filters + column sort for catalog lists.
 * @param {object[]} rows
 * @param {{
 *   searchKeys: (string|((row:object)=>unknown))[],
 *   facets?: { key: string, label: string, getValue?: (row:object)=>string }[],
 *   initialSort?: { key: string, dir: 'asc'|'desc' },
 * }} options
 */
export function useListControls(rows, options) {
  const { searchKeys, facets = [], initialSort = { key: null, dir: 'asc' } } = options;
  const [query, setQuery] = useState('');
  const [facetValues, setFacetValues] = useState(() =>
    Object.fromEntries(facets.map((f) => [f.key, ''])),
  );
  const [sort, setSort] = useState(initialSort);

  const facetOptions = useMemo(() => {
    const out = {};
    for (const facet of facets) {
      const vals = new Set();
      for (const row of rows) {
        const v = facet.getValue ? facet.getValue(row) : row[facet.key];
        if (v != null && v !== '') vals.add(String(v));
      }
      out[facet.key] = [...vals].sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [rows, facets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      for (const facet of facets) {
        const selected = facetValues[facet.key];
        if (!selected) continue;
        const v = String(facet.getValue ? facet.getValue(row) : row[facet.key] ?? '');
        if (v !== selected) return false;
      }
      if (!q) return true;
      return searchKeys.some((key) => {
        const raw = typeof key === 'function' ? key(row) : row[key];
        return normalize(raw).toLowerCase().includes(q);
      });
    });
  }, [rows, query, facetValues, facets, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const getter = sort.getValue;
      const av = getter ? getter(a) : a[sort.key];
      const bv = getter ? getter(b) : b[sort.key];
      return compareValues(av, bv) * dir;
    });
  }, [filtered, sort]);

  function setFacet(key, value) {
    setFacetValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSort(key, getValue) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc', getValue };
      }
      return { key, dir: 'asc', getValue };
    });
  }

  function reset() {
    setQuery('');
    setFacetValues(Object.fromEntries(facets.map((f) => [f.key, ''])));
    setSort(initialSort);
  }

  const activeFilterCount =
    (query.trim() ? 1 : 0) + Object.values(facetValues).filter(Boolean).length;

  return {
    rows: sorted,
    total: rows.length,
    shown: sorted.length,
    query,
    setQuery,
    facets,
    facetValues,
    facetOptions,
    setFacet,
    sort,
    toggleSort,
    reset,
    activeFilterCount,
  };
}

export function ListFilters({ controls, searchPlaceholder = 'Filter list…' }) {
  return (
    <div className="list-filters">
      <label className="list-search">
        <span className="sr-only">Filter</span>
        <input
          type="search"
          value={controls.query}
          onChange={(e) => controls.setQuery(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </label>
      {controls.facets.map((facet) => (
        <label key={facet.key} className="list-facet">
          <span>{facet.label}</span>
          <select
            value={controls.facetValues[facet.key] || ''}
            onChange={(e) => controls.setFacet(facet.key, e.target.value)}
          >
            <option value="">All</option>
            {(controls.facetOptions[facet.key] || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button
        type="button"
        className="ghost"
        onClick={controls.reset}
        disabled={controls.activeFilterCount === 0 && !controls.sort.key}
      >
        Reset
      </button>
      <span className="list-count">
        {controls.shown} of {controls.total}
      </span>
    </div>
  );
}

export function SortableTh({ label, sortKey, controls, getValue, className = '' }) {
  const active = controls.sort.key === sortKey;
  const marker = !active ? '↕' : controls.sort.dir === 'asc' ? '↑' : '↓';
  return (
    <th className={`sortable ${active ? 'sorted' : ''} ${className}`.trim()}>
      <button type="button" onClick={() => controls.toggleSort(sortKey, getValue)}>
        <span>{label}</span>
        <span className="sort-mark" aria-hidden="true">
          {marker}
        </span>
      </button>
    </th>
  );
}
