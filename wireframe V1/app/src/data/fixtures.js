import { primarySourcesForFinding, sources as resolveSourceKeys } from './alp/primarySources.js';
import { BLENDER_REAL } from './alp/blenderFindings.real.js';

export const FOCUS_TABS = [
  { id: 'budget', label: 'Budget Pressure', color: '#b08d57' },
  { id: 'care', label: 'Constituent Care Results', color: '#7ddeb4' },
  { id: 'access', label: 'Access & Rural Care', color: '#6ec8ff' },
  { id: 'mco', label: 'MCO Accountability', color: '#9fd8ff' },
  { id: 'district', label: 'District Story', color: '#e2c16b' },
  { id: 'bill', label: 'Bill Readiness', color: '#c7a46d' },
];

export const SPINE_STEPS = [
  'Results',
  'Path',
  'Trajectory',
  'Law & Pending',
  'Trust',
  'Action',
];

/** Public-REAL / Gap findings from XenoDroid BW export (no synthetic magnitudes). */
export const FINDINGS = (BLENDER_REAL.findings || []).map((f) => ({
  ...f,
  primarySources:
    f.primarySourceKeys?.length > 0
      ? resolveSourceKeys(...f.primarySourceKeys)
      : primarySourcesForFinding(f.id),
}));

/** Option packs regenerated from REAL+Gap finding set. */
export const OPTION_PACKS = BLENDER_REAL.optionPacks || [];

/** LRC-curated legislation touchpoints from hydration pack. */
export const REAL_LEGISLATION = BLENDER_REAL.legislation || [];

export const EVIDENCE_ROOMS = [
  {
    id: 'command-center',
    title: 'Legislative Command Center',
    blurb: 'Attention signals, top changes, explain-this-change',
  },
  {
    id: 'cost-drivers',
    title: 'Cost Drivers',
    blurb: 'Spend, growth, dollar contribution, population PMPM',
  },
  {
    id: 'utilization',
    title: 'Utilization & Access',
    blurb: 'ED, inpatient, distance, regional patterns',
  },
  {
    id: 'outcomes',
    title: 'Outcomes & Quality',
    blurb: 'Typed measures, freshness, peer position',
  },
  {
    id: 'mco',
    title: 'MCO Accountability',
    blurb: 'Withholding, missed measures, contract classes',
  },
  {
    id: 'provider',
    title: 'Provider & Delivery-System',
    blurb: 'Unadjusted vs risk-adjusted performance',
  },
  {
    id: 'county',
    title: 'County & District View',
    blurb: 'Legislative district and peer comparison',
  },
  {
    id: 'benchmarks',
    title: 'Benchmarks',
    blurb: 'Historical, target, peer, CMS, HEDIS, contract',
  },
  {
    id: 'measure-definitions',
    title: 'Measure Definitions & Data Quality',
    blurb: 'Owners, sources, freshness, limitations',
  },
];
