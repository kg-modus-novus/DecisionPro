import {
  ATTENTION,
  CONTRACT_CLASSES,
  COUNTIES,
  FRESHNESS,
  MCOS,
  MEASURE_TYPES,
  PERIODS,
  POPULATIONS,
  PROVIDER_GROUPS,
  REGIONS,
  SERVICE_CATEGORIES,
  labelOf,
} from './dimensions.js';
import { BENCHMARK_TYPES } from './seedCubes.js';

const sharedFilters = [
  { key: 'population', label: 'Population', options: POPULATIONS, chart: 'bar', valueKey: 'count' },
  { key: 'region', label: 'Region', options: REGIONS, chart: 'bar', valueKey: 'count' },
  { key: 'period', label: 'Period', options: PERIODS, chart: 'line', valueKey: 'metric' },
  { key: 'mco', label: 'MCO', options: MCOS, chart: 'donut', valueKey: 'count' },
];

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toLocaleString()}`;
}

function pct(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function pts(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
}

export const ROOM_CONFIGS = {
  'command-center': {
    roomId: 'command-center',
    title: 'Legislative Command Center',
    subtitle: 'Procedural cube — visual filters drive chart, list, and object pages',
    metricKey: 'dollarImpactM',
    metricLabel: 'Dollar impact ($M)',
    contentDimension: 'service',
    contentDimensionOptions: SERVICE_CATEGORIES,
    filters: [
      ...sharedFilters,
      { key: 'attention', label: 'Attention', options: ATTENTION, chart: 'donut', valueKey: 'count' },
      { key: 'freshness', label: 'Freshness', options: FRESHNESS, chart: 'bar', valueKey: 'count' },
    ],
    columns: [
      { key: 'title', label: 'Finding', link: true },
      { key: 'attention', label: 'Attention', format: (v) => labelOf(ATTENTION, v) },
      { key: 'population', label: 'Population', format: (v) => labelOf(POPULATIONS, v) },
      { key: 'region', label: 'Region', format: (v) => labelOf(REGIONS, v) },
      { key: 'dollarImpactM', label: 'Impact $M', format: (v) => fmt(v) },
      { key: 'deltaPct', label: 'Δ %', format: (v) => `${v}%` },
      { key: 'freshness', label: 'Freshness', format: (v) => labelOf(FRESHNESS, v) },
    ],
  },
  'cost-drivers': {
    roomId: 'cost-drivers',
    title: 'Cost Drivers',
    subtitle: 'Procedural cube — spend and contribution by service / population',
    metricKey: 'contributionM',
    metricLabel: 'Contribution to increase ($M)',
    contentDimension: 'service',
    contentDimensionOptions: SERVICE_CATEGORIES,
    filters: [
      ...sharedFilters,
      {
        key: 'service',
        label: 'Service',
        options: [{ id: 'all', label: 'All services' }, ...SERVICE_CATEGORIES],
        chart: 'bar',
        valueKey: 'metric',
      },
    ],
    columns: [
      { key: 'title', label: 'Slice', link: true },
      { key: 'spendM', label: 'Spend $M', format: (v) => fmt(v) },
      { key: 'growthPct', label: 'Growth %', format: (v) => `${v}%` },
      { key: 'contributionM', label: 'Contribution $M', format: (v) => fmt(v) },
      { key: 'pmpm', label: 'PMPM', format: (v) => `$${fmt(v)}` },
      { key: 'controllable', label: 'Controllability' },
    ],
  },
  utilization: {
    roomId: 'utilization',
    title: 'Utilization & Access',
    subtitle: 'Procedural cube — rates and access signals by region / population',
    metricKey: 'rate',
    metricLabel: 'Rate / value',
    contentDimension: 'region',
    contentDimensionOptions: REGIONS.filter((r) => r.id !== 'statewide'),
    filters: [
      ...sharedFilters,
      {
        key: 'measureType',
        label: 'Measure type',
        options: [{ id: 'all', label: 'All types' }, ...MEASURE_TYPES],
        chart: 'donut',
        valueKey: 'count',
      },
    ],
    columns: [
      { key: 'title', label: 'Measure', link: true },
      { key: 'region', label: 'Region', format: (v) => labelOf(REGIONS, v) },
      { key: 'rate', label: 'Rate', format: (v) => fmt(v) },
      { key: 'deltaPct', label: 'Δ %', format: (v) => `${v}%` },
      { key: 'distanceMiles', label: 'Miles', format: (v) => fmt(v) },
      { key: 'freshness', label: 'Freshness', format: (v) => labelOf(FRESHNESS, v) },
    ],
  },
  outcomes: {
    roomId: 'outcomes',
    title: 'Outcomes & Quality',
    subtitle: 'Procedural cube — typed measures with peer context',
    metricKey: 'rate',
    metricLabel: 'Performance %',
    contentDimension: 'measureType',
    contentDimensionOptions: MEASURE_TYPES,
    filters: [
      ...sharedFilters,
      {
        key: 'measureType',
        label: 'Measure type',
        options: [{ id: 'all', label: 'All types' }, ...MEASURE_TYPES],
        chart: 'donut',
        valueKey: 'count',
      },
      {
        key: 'freshness',
        label: 'Freshness',
        options: [{ id: 'all', label: 'All' }, ...FRESHNESS],
        chart: 'bar',
        valueKey: 'count',
      },
    ],
    columns: [
      { key: 'title', label: 'Measure', link: true },
      { key: 'measureType', label: 'Type', format: (v) => labelOf(MEASURE_TYPES, v) },
      { key: 'rate', label: 'KY %', format: pct },
      { key: 'peerRate', label: 'Peer %', format: pct },
      { key: 'trendPts', label: 'Trend pts', format: pts },
      { key: 'freshness', label: 'Freshness', format: (v) => labelOf(FRESHNESS, v) },
    ],
  },
  mco: {
    roomId: 'mco',
    title: 'MCO Accountability',
    subtitle: 'Procedural cube — contract classes, withholding, missed measures',
    metricKey: 'withholdingM',
    metricLabel: 'Withholding $M',
    contentDimension: 'mco',
    contentDimensionOptions: MCOS.filter((m) => m.id !== 'all'),
    filters: [
      ...sharedFilters,
      {
        key: 'contractClass',
        label: 'Contract class',
        options: [{ id: 'all', label: 'All classes' }, ...CONTRACT_CLASSES],
        chart: 'donut',
        valueKey: 'count',
      },
    ],
    columns: [
      { key: 'title', label: 'Item', link: true },
      { key: 'mco', label: 'MCO', format: (v) => labelOf(MCOS, v) },
      { key: 'contractClass', label: 'Class', format: (v) => labelOf(CONTRACT_CLASSES, v) },
      { key: 'earnedBack', label: 'Withholding' },
      { key: 'missedCount', label: 'Missed' },
      { key: 'pmpm', label: 'PMPM', format: (v) => `$${fmt(v)}` },
    ],
  },
  provider: {
    roomId: 'provider',
    title: 'Provider & Delivery-System',
    subtitle: 'Procedural cube — unadjusted vs risk-adjusted with social-risk context',
    metricKey: 'riskAdjPct',
    metricLabel: 'Risk-adjusted %',
    contentDimension: 'providerGroup',
    contentDimensionOptions: PROVIDER_GROUPS,
    filters: [
      ...sharedFilters.filter((f) => f.key !== 'mco'),
      { key: 'mco', label: 'MCO', options: MCOS, chart: 'bar', valueKey: 'count' },
    ],
    columns: [
      { key: 'title', label: 'Provider slice', link: true },
      { key: 'unadjPct', label: 'Unadj %', format: (v) => `${v}%` },
      { key: 'riskAdjPct', label: 'Risk-adj %', format: (v) => `${v}%` },
      { key: 'socialRisk', label: 'Social risk' },
      { key: 'readmitPct', label: 'Readmit %', format: (v) => `${v}%` },
    ],
  },
  county: {
    roomId: 'county',
    title: 'County & District View',
    subtitle: 'Procedural cube — county / legislative district aggregates vs state',
    metricKey: 'value',
    metricLabel: 'Metric value',
    contentDimension: 'county',
    contentDimensionOptions: COUNTIES,
    filters: [
      ...sharedFilters,
      {
        key: 'county',
        label: 'County',
        options: [{ id: 'all', label: 'All counties' }, ...COUNTIES],
        chart: 'bar',
        valueKey: 'metric',
      },
    ],
    columns: [
      { key: 'title', label: 'Slice', link: true },
      { key: 'district', label: 'District' },
      { key: 'value', label: 'Value', format: (v) => fmt(v) },
      { key: 'vsStatePct', label: 'vs State', format: (v) => `${v}%` },
      { key: 'population', label: 'Population', format: (v) => labelOf(POPULATIONS, v) },
    ],
  },
  benchmarks: {
    roomId: 'benchmarks',
    title: 'Benchmarks',
    subtitle: 'Procedural cube — KY vs multiple benchmark types',
    metricKey: 'gapPts',
    metricLabel: 'Gap vs benchmark (pts)',
    contentDimension: 'benchmarkType',
    contentDimensionOptions: BENCHMARK_TYPES,
    filters: [
      ...sharedFilters.filter((f) => f.key === 'population' || f.key === 'period'),
      {
        key: 'freshness',
        label: 'Freshness',
        options: [{ id: 'all', label: 'All' }, ...FRESHNESS],
        chart: 'bar',
        valueKey: 'count',
      },
    ],
    columns: [
      { key: 'title', label: 'Comparison', link: true },
      { key: 'kyValue', label: 'KY', format: pct },
      { key: 'benchmarkValue', label: 'Benchmark', format: pct },
      { key: 'gapPts', label: 'Gap pts', format: (v) => `${v}` },
      { key: 'freshness', label: 'Freshness', format: (v) => labelOf(FRESHNESS, v) },
    ],
  },
  'measure-definitions': {
    roomId: 'measure-definitions',
    title: 'Measure Definitions & Data Quality',
    subtitle: 'Procedural cube — governed definitions, owners, freshness, limitations',
    metricKey: 'count',
    metricLabel: 'Definitions',
    contentDimension: 'freshness',
    contentDimensionOptions: FRESHNESS,
    filters: [
      { key: 'period', label: 'Period', options: PERIODS, chart: 'line', valueKey: 'count' },
      {
        key: 'freshness',
        label: 'Freshness',
        options: [{ id: 'all', label: 'All' }, ...FRESHNESS],
        chart: 'donut',
        valueKey: 'count',
      },
      {
        key: 'measureType',
        label: 'Measure type',
        options: [{ id: 'all', label: 'All types' }, ...MEASURE_TYPES],
        chart: 'bar',
        valueKey: 'count',
      },
    ],
    columns: [
      { key: 'title', label: 'Measure', link: true },
      { key: 'owner', label: 'Owner' },
      { key: 'source', label: 'Source' },
      { key: 'freshness', label: 'Freshness', format: (v) => labelOf(FRESHNESS, v) },
      { key: 'refreshCadence', label: 'Cadence' },
      { key: 'limitation', label: 'Limitation' },
    ],
  },
};
