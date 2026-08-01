/**
 * Shared dimensions for Fiori ALP evidence rooms.
 * Period catalog prefers REAL export from XenoDroid BW gate.
 */

import { PERIODS_REAL } from './periods.real.js';

export const POPULATIONS = [
  { id: 'all', label: 'All Medicaid' },
  { id: 'children', label: 'Children / CHIP' },
  { id: 'expansion', label: 'Expansion adults' },
  { id: 'aged', label: 'Aged' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'pregnant', label: 'Pregnant / postpartum' },
];

export const REGIONS = [
  { id: 'statewide', label: 'Statewide' },
  { id: 'east', label: 'Eastern KY' },
  { id: 'central', label: 'Central KY' },
  { id: 'west', label: 'Western KY' },
  { id: 'north', label: 'Northern KY' },
];

const PERIODS_FALLBACK = [
  { id: 'cy2020', label: 'Core Set CY2020', shortLabel: 'CY20', sort: 1 },
  { id: 'cy2021', label: 'Core Set CY2021', shortLabel: 'CY21', sort: 2 },
  { id: 'cy2022', label: 'Core Set CY2022', shortLabel: 'CY22', sort: 3 },
  { id: 'cy2023', label: 'Core Set CY2023', shortLabel: 'CY23', sort: 4 },
  { id: 'ky202401', label: 'DMS county 2024-01', shortLabel: 'KY 2024-01', sort: 5 },
  { id: 'ky202501', label: 'DMS county 2025-01', shortLabel: 'KY 2025-01', sort: 6 },
  { id: 'latest', label: 'Latest available', shortLabel: 'Latest', sort: 7 },
  { id: 'fy', label: 'Fiscal year (published)', shortLabel: 'FY', sort: 8 },
  { id: 'cy', label: 'Calendar year (generic)', shortLabel: 'CY', sort: 9 },
];

/** Prefer gate-exported REAL period catalog when present. */
export const PERIODS =
  Array.isArray(PERIODS_REAL?.periods) && PERIODS_REAL.periods.length > 0
    ? PERIODS_REAL.periods
    : PERIODS_FALLBACK;

export const MCOS = [
  { id: 'all', label: 'All MCOs' },
  { id: 'mco-a', label: 'Aetna Better Health' },
  { id: 'mco-b', label: 'Humana Healthy Horizons' },
  { id: 'mco-c', label: 'Passport Health Plan' },
  { id: 'mco-d', label: 'WellCare of Kentucky' },
];

export const SERVICE_CATEGORIES = [
  { id: 'inpatient', label: 'Inpatient' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'ed', label: 'Emergency department' },
  { id: 'outpatient', label: 'Outpatient' },
  { id: 'bh', label: 'Behavioral health' },
  { id: 'ltc', label: 'Long-term care' },
  { id: 'primary', label: 'Primary / preventive' },
  { id: 'maternal', label: 'Maternal / child' },
];

export const FRESHNESS = [
  {
    id: 'near',
    label: 'Near current',
    description: 'Operational claims/encounters close to the latest available cut (~1–2 refresh cycles).',
  },
  {
    id: 'recent',
    label: 'Recent',
    description: 'Settled enough for trend reading; values may still revise with claim run-out.',
  },
  {
    id: 'lagged',
    label: 'Lagged',
    description: 'Peer/national or HEDIS-style measures that trail KY operational data by design.',
  },
  {
    id: 'provisional',
    label: 'Provisional',
    description: 'Early or incomplete cuts — useful for scanning, not for firm conclusions.',
  },
];

export const MEASURE_TYPES = [
  { id: 'cost', label: 'Cost' },
  { id: 'utilization', label: 'Utilization' },
  { id: 'outcome', label: 'Outcome' },
  { id: 'process', label: 'Process' },
  { id: 'access', label: 'Access' },
  { id: 'equity', label: 'Equity' },
];

export const ATTENTION = [
  { id: 'on-target', label: 'On target' },
  { id: 'watch', label: 'Watch' },
  { id: 'intervene', label: 'Intervention indicated' },
  { id: 'incomplete', label: 'Data incomplete' },
];

export const CONTRACT_CLASSES = [
  { id: 'contracted', label: 'Existing contractual' },
  { id: 'monitored', label: 'Monitored not contracted' },
  { id: 'candidate', label: 'Candidate future' },
];

export const COUNTIES = [
  { id: 'fayette', label: 'Fayette', region: 'central', district: 'HD-56' },
  { id: 'jefferson', label: 'Jefferson', region: 'central', district: 'HD-34' },
  { id: 'kenton', label: 'Kenton', region: 'north', district: 'HD-67' },
  { id: 'boone', label: 'Boone', region: 'north', district: 'HD-61' },
  { id: 'warren', label: 'Warren', region: 'west', district: 'HD-20' },
  { id: 'pike', label: 'Pike', region: 'east', district: 'HD-92' },
  { id: 'hopkins', label: 'Hopkins', region: 'west', district: 'HD-9' },
];

export const PROVIDER_GROUPS = [
  { id: 'pg-a', label: 'Bluegrass Regional Health' },
  { id: 'pg-b', label: 'River Cities Hospital Group' },
  { id: 'pg-c', label: 'Appalachian Care Network' },
  { id: 'pg-d', label: 'Central Kentucky Partners' },
  { id: 'pg-e', label: 'Western Corridor Health' },
];

export function labelOf(list, id) {
  return list.find((x) => x.id === id)?.label || id;
}

export function shortLabelOf(list, id) {
  const row = list.find((x) => x.id === id);
  return row?.shortLabel || row?.label || id;
}

export function descriptionOf(list, id) {
  return list.find((x) => x.id === id)?.description || '';
}
