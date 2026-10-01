// CodeXen: v1 not-applicable
// Geography and population lookups for the simple-mode filter bar and the
// "Kentucky facts" / "Your area" panel. Presentation only: it reads sourced
// rows and the release 1 county view model; it computes shares for display.
import { KY_COUNTY_ROWS } from './simpleModeData.js';
import { formatNumber } from './measureModel.js';
import { maybeMeasure } from './sourcedData.js';

const rowsOf = (id) => maybeMeasure(id)?.rows || [];
const byKey = (id) => new Map(rowsOf(id).map((r) => [r.key, r]));
const byFips = (id) => new Map(rowsOf(id).filter((r) => r.fips).map((r) => [r.fips, r]));

export const COUNTY_OPTIONS = [...KY_COUNTY_ROWS].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ fips: c.fips, name: c.name }));
export const COUNTY_NAME = new Map(KY_COUNTY_ROWS.map((c) => [c.fips, c.name]));

export const HOUSE_DISTRICTS = rowsOf('house-districts-counties');
export const SENATE_DISTRICTS = rowsOf('senate-districts-counties');
export const ADDS = rowsOf('area-development-districts');

const HOUSE_MEMBERS = byKey('house-district-members-estimate');
const SENATE_MEMBERS = byKey('senate-district-members-estimate');

/** Geography value: null (statewide) | { kind: 'county'|'house'|'senate'|'add', key } */
export function geographyLabel(geo) {
  if (!geo) return 'Kentucky';
  if (geo.kind === 'county') return `${COUNTY_NAME.get(geo.key) || geo.key} County`;
  if (geo.kind === 'house') return HOUSE_DISTRICTS.find((d) => d.key === geo.key)?.label || geo.key;
  if (geo.kind === 'senate') return (SENATE_DISTRICTS.find((d) => d.key === geo.key)?.label || geo.key);
  if (geo.kind === 'add') return ADDS.find((d) => d.key === geo.key)?.label || geo.key;
  return 'Kentucky';
}

export function geographyCounties(geo) {
  if (!geo) return null;
  if (geo.kind === 'county') return [geo.key];
  if (geo.kind === 'house') return (HOUSE_DISTRICTS.find((d) => d.key === geo.key)?.counties || []).map((c) => c.fips);
  if (geo.kind === 'senate') return (SENATE_DISTRICTS.find((d) => d.key === geo.key)?.counties || []).map((c) => c.fips);
  if (geo.kind === 'add') return ADDS.find((d) => d.key === geo.key)?.counties || [];
  return null;
}

export function districtRow(geo) {
  if (geo?.kind === 'house') return HOUSE_DISTRICTS.find((d) => d.key === geo.key) || null;
  if (geo?.kind === 'senate') return SENATE_DISTRICTS.find((d) => d.key === geo.key) || null;
  return null;
}

// ---- Population counts ----------------------------------------------------

const STATE_GROUPS = (() => {
  const age = byKey('members-by-age-band');
  const elig = byKey('members-by-eligibility-category');
  const dual = byKey('dual-eligibles');
  const kids = byKey('children-kchip-vs-medicaid');
  const total = maybeMeasure('members-total-dms');
  const v = (map, k) => map.get(k)?.value ?? null;
  // Shares for groups from the October 2025 eligibility report divide by that report's own total.
  const eligBase = maybeMeasure('members-by-eligibility-category')?.value ?? null;
  const dualBase = ['full', 'partial', 'other-no-rx', 'non-dual'].reduce((sum, k) => sum + (v(dual, k) || 0), 0) || null;
  return {
    all: { value: total?.value ?? null, period: total?.period, estimate: false },
    children: { value: v(age, '0-18'), period: maybeMeasure('members-by-age-band')?.period, estimate: false },
    working: { value: v(age, '19-64'), period: maybeMeasure('members-by-age-band')?.period, estimate: true },
    older: { value: v(age, '65+'), period: maybeMeasure('members-by-age-band')?.period, estimate: true },
    expansion: { value: maybeMeasure('expansion-adults')?.value ?? null, period: maybeMeasure('expansion-adults')?.period, estimate: false, base: eligBase },
    disabled: { value: (v(elig, 'blind-and-disabled-adult') || 0) + (v(elig, 'blind-and-disabled-child') || 0), period: maybeMeasure('members-by-eligibility-category')?.period, estimate: false, base: eligBase },
    duals: { value: (v(dual, 'full') || 0) + (v(dual, 'partial') || 0), period: maybeMeasure('dual-eligibles')?.period, estimate: false, base: dualBase },
    kchip: { value: v(kids, 'kchip'), period: maybeMeasure('children-kchip-vs-medicaid')?.period, estimate: false },
  };
})();

/** A group's share of members, using the total from the same report as the group count. */
function groupShare(pop) {
  const g = STATE_GROUPS[pop];
  return g.value / (g.base || STATE_GROUPS.all.value);
}

const COUNTY_MEMBERS = byFips('county-members');
const COUNTY_AGE = byFips('county-members-by-age-band');
const COUNTY_CHILDREN = byFips('children-enrolled');

function countyPopulation(fips, pop) {
  const members = COUNTY_MEMBERS.get(fips)?.value ?? null;
  const age = COUNTY_AGE.get(fips);
  const kids = COUNTY_CHILDREN.get(fips);
  switch (pop) {
    case 'all': return { value: members, estimate: false };
    case 'children': return { value: kids?.value ?? age?.age0to18 ?? null, estimate: false };
    case 'kchip': return { value: kids?.kchip ?? null, estimate: false };
    case 'working': return { value: age?.age19to64 ?? null, estimate: true };
    case 'older': return { value: age?.age65plus ?? null, estimate: true };
    default: {
      // Groups with no county publication: county members × statewide share.
      const share = groupShare(pop);
      return { value: Number.isFinite(members) && Number.isFinite(share) ? Math.round(members * share) : null, estimate: true };
    }
  }
}

/** Members in a geography for a population, with whether it is an estimate. */
export function populationCount(geo, pop = 'all') {
  if (!geo) return STATE_GROUPS[pop] || STATE_GROUPS.all;
  if (geo.kind === 'county') return { ...countyPopulation(geo.key, pop), period: maybeMeasure('county-members')?.period };
  if (geo.kind === 'house' || geo.kind === 'senate') {
    const est = (geo.kind === 'house' ? HOUSE_MEMBERS : SENATE_MEMBERS).get(geo.key);
    const all = est?.value ?? null;
    const value = pop === 'all' ? all : pop === 'children' ? est?.children ?? null : Number.isFinite(all) ? Math.round(all * groupShare(pop)) : null;
    return { value, estimate: true, period: maybeMeasure('house-district-members-estimate')?.period };
  }
  if (geo.kind === 'add') {
    const add = ADDS.find((d) => d.key === geo.key);
    let value = 0;
    let estimate = false;
    for (const fips of add?.counties || []) {
      const c = countyPopulation(fips, pop);
      value += c.value || 0;
      estimate = estimate || c.estimate;
    }
    return { value, estimate, period: maybeMeasure('county-members')?.period };
  }
  return STATE_GROUPS.all;
}

// ---- County facts ---------------------------------------------------------

const COUNTY_FACT_SOURCES = [
  { id: 'hpsa-primary-care-counties', label: 'Primary care shortage area', kind: 'hpsa' },
  { id: 'hpsa-dental-counties', label: 'Dental shortage area', kind: 'hpsa' },
  { id: 'hpsa-mental-health-counties', label: 'Mental health shortage area', kind: 'hpsa' },
  { id: 'pcp-per-10k-county', label: 'Primary care doctors per 10,000 people' },
  { id: 'dentists-per-10k-county', label: 'Dentists per 10,000 people' },
  { id: 'mental-health-providers-per-10k-county', label: 'Mental health providers per 10,000 people' },
  { id: 'members-per-medicaid-pcp-county-est', label: 'Members per Medicaid primary care doctor' },
  { id: 'health-center-sites-county', label: 'Community health center sites' },
  { id: 'drive-time-health-center-county-est', label: 'Drive to nearest health center' },
  { id: 'drive-time-otp-county-est', label: 'Drive to nearest methadone clinic' },
];

const FACT_INDEX = COUNTY_FACT_SOURCES.map((f) => ({ ...f, measure: maybeMeasure(f.id), rows: byFips(f.id) })).filter((f) => f.measure);
const COUNTY_RELEASE1 = new Map(KY_COUNTY_ROWS.map((c) => [c.fips, c]));

function hpsaText(row) {
  if (!row) return 'Not designated';
  return `${row.designationType || 'Designated'}${row.coverage ? `, ${row.coverage}` : ''}`;
}

export function countyFacts(fips, extra = []) {
  const facts = [];
  for (const f of FACT_INDEX) {
    const row = f.rows.get(fips);
    const estimate = f.measure.method === 'estimate';
    if (f.kind === 'hpsa') facts.push({ label: f.label, display: hpsaText(row) });
    else if (row && f.measure.unit === 'hours') facts.push({ label: f.label, display: `${Math.round(row.value * 60)} min`, estimate });
    else if (row) facts.push({ label: f.label, display: formatNumber(row.value, f.measure.unit), estimate });
  }
  const r1 = COUNTY_RELEASE1.get(fips);
  if (r1) {
    facts.push({ label: 'Nursing facilities', display: Number.isFinite(r1.snfFacilityCount) ? r1.snfFacilityCount.toLocaleString('en-US') : '0' });
    facts.push({ label: 'Nursing facility beds', display: Number.isFinite(r1.certifiedSnfBeds) ? r1.certifiedSnfBeds.toLocaleString('en-US') : '0' });
  }
  for (const e of extra) {
    const row = byFips(e.id).get(fips);
    if (row) facts.push({ label: e.label, display: e.format ? e.format(row) : formatNumber(row.value, maybeMeasure(e.id)?.unit), estimate: maybeMeasure(e.id)?.method === 'estimate' });
  }
  return facts;
}
