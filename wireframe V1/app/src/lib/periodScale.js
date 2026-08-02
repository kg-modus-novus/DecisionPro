/**
 * Period Visual Filter scale helpers — Year-first UX without inventing source grains.
 * Native period ids on cube rows stay (piYYYYMM, cyYYYY, latest, …).
 */

export const YEAR_TOKEN_RE = /^y(\d{4})$/;

export function isYearToken(id) {
  return typeof id === 'string' && YEAR_TOKEN_RE.test(id);
}

export function yearToken(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  return `y${y}`;
}

export function parseYearToken(id) {
  const m = typeof id === 'string' ? id.match(YEAR_TOKEN_RE) : null;
  return m ? Number(m[1]) : null;
}

/** Calendar year from a native period id, or null for non-calendar buckets. */
export function calendarYearFromPeriodId(periodId) {
  if (!periodId || typeof periodId !== 'string') return null;
  const pi = periodId.match(/^pi(\d{4})\d{2}$/);
  if (pi) return Number(pi[1]);
  const cy = periodId.match(/^cy(\d{4})$/);
  if (cy) return Number(cy[1]);
  const ky = periodId.match(/^ky(\d{4})/);
  if (ky) return Number(ky[1]);
  // sort-style numeric YYYYMM / YYYY if catalog used bare numbers (defensive)
  if (/^\d{6}$/.test(periodId)) return Number(periodId.slice(0, 4));
  if (/^\d{4}$/.test(periodId)) return Number(periodId);
  return null;
}

export function isNonCalendarPeriodId(periodId) {
  if (!periodId || periodId === 'all') return false;
  return calendarYearFromPeriodId(periodId) == null && !isYearToken(periodId);
}

/**
 * Expand filter ids so year tokens become matching native period ids from the catalog.
 * Year tokens also match by calendar year even when the catalog is incomplete.
 */
export function expandPeriodFilterIds(filterIds, catalogPeriods = []) {
  const ids = Array.isArray(filterIds) ? filterIds : filterIds != null ? [filterIds] : [];
  const expanded = new Set();
  const yearNeedles = new Set();

  for (const id of ids) {
    if (id == null || id === '' || id === 'all') continue;
    if (isYearToken(id)) {
      yearNeedles.add(parseYearToken(id));
      continue;
    }
    expanded.add(id);
  }

  if (yearNeedles.size) {
    for (const opt of catalogPeriods) {
      if (!opt?.id || opt.id === 'all') continue;
      const y = calendarYearFromPeriodId(opt.id);
      if (y != null && yearNeedles.has(y)) expanded.add(opt.id);
    }
  }

  return [...expanded].sort();
}

/** True when a row period matches the period filter (year tokens and/or native ids). */
export function periodMatchesFilter(rowPeriod, filterIds, catalogPeriods = []) {
  const ids = Array.isArray(filterIds) ? filterIds : filterIds != null ? [filterIds] : [];
  const active = ids.filter((id) => id != null && id !== '' && id !== 'all');
  if (!active.length) return true;
  if (rowPeriod == null || rowPeriod === '' || rowPeriod === 'all') return true;

  if (active.includes(rowPeriod)) return true;

  const rowYear = calendarYearFromPeriodId(rowPeriod);
  for (const id of active) {
    if (isYearToken(id) && rowYear != null && rowYear === parseYearToken(id)) return true;
  }

  const expanded = expandPeriodFilterIds(active, catalogPeriods);
  return expanded.includes(rowPeriod);
}

/** Options for Year-scale dropdown / mini-line. */
export function yearScaleOptions(catalogPeriods = []) {
  const years = new Map();
  const nonCalendar = [];

  for (const opt of catalogPeriods) {
    if (!opt?.id || opt.id === 'all') continue;
    const y = calendarYearFromPeriodId(opt.id);
    if (y != null) {
      if (!years.has(y)) {
        years.set(y, {
          id: yearToken(y),
          label: String(y),
          shortLabel: String(y),
          sort: y,
        });
      }
    } else {
      nonCalendar.push({
        id: opt.id,
        label: opt.label || opt.id,
        shortLabel: opt.shortLabel || opt.label || opt.id,
        sort: opt.sort ?? 9000 + nonCalendar.length,
      });
    }
  }

  return [...years.values()].sort((a, b) => a.sort - b.sort).concat(
    nonCalendar.sort((a, b) => a.sort - b.sort || String(a.id).localeCompare(String(b.id))),
  );
}

/** Month/native options, optionally scoped to selected calendar years. */
export function monthScaleOptions(catalogPeriods = [], selectedYearTokens = []) {
  const years = selectedYearTokens.map(parseYearToken).filter((y) => y != null);
  const scoped = years.length > 0;

  return catalogPeriods
    .filter((opt) => {
      if (!opt?.id || opt.id === 'all') return false;
      const y = calendarYearFromPeriodId(opt.id);
      if (y == null) return !scoped; // non-calendar only when no year scope
      return !scoped || years.includes(y);
    })
    .map((opt) => ({
      id: opt.id,
      label: opt.label || opt.id,
      shortLabel: opt.shortLabel || opt.label || opt.id,
      sort: opt.sort ?? 0,
    }))
    .sort((a, b) => a.sort - b.sort || String(a.id).localeCompare(String(b.id)));
}

/**
 * Roll native period aggregate series up to year tokens (+ non-calendar buckets).
 * series items: { id, value, count? }
 */
export function rollupSeriesByYear(series = [], catalogPeriods = []) {
  const byKey = new Map();
  const labelSort = new Map(
    yearScaleOptions(catalogPeriods).map((o) => [o.id, o.sort]),
  );

  for (const item of series) {
    if (!item?.id || item.id === 'all') continue;
    const y = calendarYearFromPeriodId(item.id);
    const key = y != null ? yearToken(y) : item.id;
    if (!byKey.has(key)) byKey.set(key, { id: key, value: 0, count: 0 });
    const b = byKey.get(key);
    b.value += Number(item.value) || 0;
    b.count += item.count != null ? item.count : 1;
  }

  return [...byKey.values()].sort(
    (a, b) =>
      (labelSort.get(a.id) ?? calendarYearFromPeriodId(a.id) ?? 9999) -
        (labelSort.get(b.id) ?? calendarYearFromPeriodId(b.id) ?? 9999) ||
      String(a.id).localeCompare(String(b.id)),
  );
}

/** Which year tokens are implied by current period filter selection. */
export function selectedYearTokensFromPeriodFilter(filterIds, catalogPeriods = []) {
  const ids = Array.isArray(filterIds) ? filterIds : filterIds != null ? [filterIds] : [];
  const years = new Set();
  for (const id of ids) {
    if (isYearToken(id)) {
      years.add(id);
      continue;
    }
    const y = calendarYearFromPeriodId(id);
    if (y != null) years.add(yearToken(y));
  }
  // If only non-calendar selected, no year scope
  return [...years].sort();
}

/** Highlight year points when any native period in that year is selected. */
export function selectedIdsForYearScale(filterIds) {
  const ids = Array.isArray(filterIds) ? filterIds : filterIds != null ? [filterIds] : [];
  const out = new Set();
  for (const id of ids) {
    if (isYearToken(id) || isNonCalendarPeriodId(id)) {
      out.add(id);
      continue;
    }
    const y = calendarYearFromPeriodId(id);
    if (y != null) out.add(yearToken(y));
    else if (id) out.add(id);
  }
  return out;
}

/**
 * Month-scale selection: expand year tokens to every native period in those years
 * so a Year filter (e.g. 2026) highlights all months in that year.
 */
export function selectedIdsForMonthScale(filterIds, catalogPeriods = []) {
  const ids = Array.isArray(filterIds) ? filterIds : filterIds != null ? [filterIds] : [];
  const out = new Set();
  const yearNeedles = new Set();
  for (const id of ids) {
    if (!id || id === 'all') continue;
    if (isYearToken(id)) {
      yearNeedles.add(parseYearToken(id));
      continue;
    }
    // Native / non-calendar selections stay exact — do not expand a month to its year.
    out.add(id);
  }
  if (yearNeedles.size) {
    for (const opt of catalogPeriods) {
      if (!opt?.id || opt.id === 'all') continue;
      const y = calendarYearFromPeriodId(opt.id);
      if (y != null && yearNeedles.has(y)) out.add(opt.id);
    }
  }
  return out;
}
