// CodeXen: v1 not-applicable
// Local figures for any place a viewer picks: one county, several counties, a
// legislative district or Area Development District, or a hand-picked set of
// zip codes (plan items #1, #8, #23). Presentation arithmetic only: it
// combines published rows by population weight or by sum for display and
// labels the result an estimate whenever more than one area is combined or a
// county is split. Small-count suppression stays in CountDisclosure.
import { ADDS, HOUSE_DISTRICTS, SENATE_DISTRICTS } from './geography.js';

/**
 * The published areas a geography is made of, each with the share of that
 * area's residents that falls inside it:
 * [{ level: 'county' | 'zcta', key, share }].
 */
export function areaUnits(geo) {
  if (!geo) return [];
  if (geo.kind === 'county') return [{ level: 'county', key: geo.key, share: 1 }];
  if (geo.kind === 'counties') return (geo.keys || []).map((key) => ({ level: 'county', key, share: 1 }));
  if (geo.kind === 'zips') return (geo.keys || []).map((key) => ({ level: 'zcta', key, share: 1 }));
  if (geo.kind === 'add') return (ADDS.find((d) => d.key === geo.key)?.counties || []).map((key) => ({ level: 'county', key, share: 1 }));
  if (geo.kind === 'house' || geo.kind === 'senate') {
    const list = geo.kind === 'house' ? HOUSE_DISTRICTS : SENATE_DISTRICTS;
    return (list.find((d) => d.key === geo.key)?.counties || []).map((c) => ({ level: 'county', key: c.fips, share: c.whole ? 1 : (c.shareOfCounty || 0) }));
  }
  return [];
}

/** True when combining areas or splitting a county makes the local figure an estimate. */
export function isCombined(units) {
  return units.length > 1 || units.some((u) => u.share < 1);
}

function rowIndex(measure) {
  if (!measure) return new Map();
  if (!measure.__index) Object.defineProperty(measure, '__index', { value: new Map((measure.rows || []).map((r) => [r.key, r])) });
  return measure.__index;
}

/**
 * A percentage for the place, weighted by each area's population. `weightOf`
 * reads a row's population (PLACES rows carry adults as pop18). A single
 * whole area keeps its own confidence interval.
 */
export function weightedPercent(measure, units, populationOf = (row) => row.pop18) {
  const index = rowIndex(measure);
  let weight = 0;
  let sum = 0;
  let found = 0;
  for (const u of units) {
    const row = index.get(u.key);
    if (!row || !Number.isFinite(row.value)) continue;
    const pop = Number(populationOf(row)) || 1;
    weight += pop * u.share;
    sum += row.value * pop * u.share;
    found += 1;
  }
  if (!found || !weight) return null;
  const single = units.length === 1 && units[0].share === 1 ? index.get(units[0].key) : null;
  return {
    value: Math.round((sum / weight) * 10) / 10,
    ciLow: single?.ciLow,
    ciHigh: single?.ciHigh,
    combined: isCombined(units),
    areasFound: found,
    areasAsked: units.length,
  };
}

/** A count for the place: the sum of each area's count times its share. */
export function summedCount(measure, units) {
  const index = rowIndex(measure);
  let total = 0;
  let found = 0;
  let moeSquares = 0;
  for (const u of units) {
    const row = index.get(u.key);
    if (!row || !Number.isFinite(row.value)) continue;
    total += row.value * u.share;
    if (Number.isFinite(row.moe)) moeSquares += (row.moe * u.share) ** 2;
    found += 1;
  }
  if (!found) return null;
  return {
    value: Math.round(total),
    // Census approximation for the margin of error of a sum.
    moe: moeSquares ? Math.round(Math.sqrt(moeSquares)) : undefined,
    combined: isCombined(units),
    areasFound: found,
    areasAsked: units.length,
  };
}

/** The counties a set of zip codes touches, from the population crosswalk. */
export function countiesForZips(crosswalk, keys) {
  const index = rowIndex(crosswalk);
  const counties = new Set();
  for (const key of keys) for (const c of index.get(key)?.counties || []) if (c.share > 0) counties.add(c.fips);
  return [...counties];
}

/** Quartile (1 = least vulnerable) of each value among a list of values. */
export function quartileOf(value, sortedValues) {
  if (!Number.isFinite(value) || !sortedValues.length) return null;
  const below = sortedValues.filter((v) => v < value).length;
  return Math.min(4, Math.floor((below / sortedValues.length) * 4) + 1);
}

/**
 * A county measure averaged within each SVI quartile of counties (#23):
 * [{ quartile, counties, mean }]. County means are simple averages and are
 * labeled so on the page.
 */
export function byVulnerabilityQuartile(countyMeasure, sviMeasure, valueOf = (row) => row.value) {
  const svi = rowIndex(sviMeasure);
  const sviValues = [...svi.values()].map((r) => r.value).filter(Number.isFinite).sort((a, b) => a - b);
  const groups = [1, 2, 3, 4].map((quartile) => ({ quartile, values: [] }));
  for (const row of countyMeasure?.rows || []) {
    const q = quartileOf(svi.get(row.fips || row.key)?.value, sviValues);
    const v = valueOf(row);
    if (q && Number.isFinite(v)) groups[q - 1].values.push(v);
  }
  return groups.map((g) => ({
    quartile: g.quartile,
    counties: g.values.length,
    mean: g.values.length ? g.values.reduce((a, b) => a + b, 0) / g.values.length : null,
  }));
}
