/**
 * Shared synthetic dimensions for Fiori ALP evidence rooms.
 * Aggregate / de-identified only — not official.
 */

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

export const PERIODS = [
  { id: 'fy24q4', label: 'FY2024 Q4', shortLabel: 'FY24 Q4', sort: 1 },
  { id: 'fy25q1', label: 'FY2025 Q1', shortLabel: 'FY25 Q1', sort: 2 },
  { id: 'fy25q2', label: 'FY2025 Q2', shortLabel: 'FY25 Q2', sort: 3 },
  { id: 'fy25q3', label: 'FY2025 Q3', shortLabel: 'FY25 Q3', sort: 4 },
];

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
  { id: 'fayette', label: 'Fayette', region: 'central', district: 'HD-67' },
  { id: 'jefferson', label: 'Jefferson', region: 'central', district: 'HD-34' },
  { id: 'kenton', label: 'Kenton', region: 'north', district: 'HD-63' },
  { id: 'warren', label: 'Warren', region: 'west', district: 'HD-19' },
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
