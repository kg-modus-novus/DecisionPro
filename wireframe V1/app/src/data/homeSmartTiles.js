/**
 * Role-home insight tiles — REAL public values or labeled Gaps only.
 * Presentation `visual` varies by role/context. No synthetic % / $ magnitudes.
 */

import { FINDINGS } from './fixtures.js';
import { ACCURATE_LANDING } from './alp/accurateLanding.js';
import { AUTHORITATIVE_SOURCES } from './alp/authoritativeSources.js';
import { GAP_OBJECTS } from './alp/gapObjects.js';
import { measureSeriesPoints } from './roleTileProfiles.js';
import { formatMeasurePeriodLabel } from '../lib/measurePeriodLabel.js';

function landing(measureId) {
  return (ACCURATE_LANDING.measures || []).find((m) => m.measureId === measureId);
}

function finding(id) {
  return FINDINGS.find((f) => f.id === id);
}

const m001 = landing('M-001');
const m002 = landing('M-002');
const m004 = landing('M-004');
const m010 = landing('M-010');
const m012 = landing('M-012');
const m017 = landing('M-017');
const m007 = landing('M-007');
const fPost = finding('f-postpartum');
const fPharm = finding('f-pharmacy');
const fGapEd = finding('f-avoidable-ed');
const fGapHd = finding('f-hd67');
const fPend = finding('f-pending-maternal');
const fMco = finding('f-mco-withholding');

const sourceCount = (AUTHORITATIVE_SOURCES.sources || []).length;
const gapCount = (GAP_OBJECTS.gaps || []).length;
const loadedCount = (AUTHORITATIVE_SOURCES.sources || []).filter((s) => s.loadStatus === 'LOADED').length;

/** REAL PI enrollment history for tiles (capped in measureSeriesPoints). */
function enrollmentSeries() {
  return measureSeriesPoints('M-001');
}

export const HOME_SMART_TILES = {
  legislator: [
    {
      id: 'county-enroll-signal',
      kind: 'District-adjacent REAL',
      title: 'County membership is the public district substitute',
      value: fGapHd?.magnitude || 'Gap — HD spend',
      comparison: 'Kenton County · no public HD expenditure SoT',
      why: 'House-district spend is a labeled Gap; county DMS membership is the honest public substitute.',
      semantic: 'critical',
      direction: 'stable',
      visual: 'gap',
      gap: {
        gapId: 'GAP-HD-EXPENDITURE',
        accessPath: 'Geographic claims aggregates under DMS authority',
      },
      destination: { view: 'evidence', roomId: 'county', filters: { county: 'kenton' } },
      destinationLabel: 'Open County & District (REAL + Gap)',
    },
    {
      id: 'rural-distance-gap',
      kind: 'Access Gap',
      title: 'Rural miles-to-care needs claims geo',
      value: 'Gap',
      comparison: 'GAP-RURAL-DISTANCE',
      why: 'Distance-to-care is not inventable from public web sources — shown as Gap, not a fake mileage.',
      semantic: 'critical',
      direction: 'stable',
      visual: 'gap',
      gap: {
        gapId: 'GAP-RURAL-DISTANCE',
        accessPath: 'Claims geo + network adequacy feeds (paid / DUA)',
      },
      destination: { view: 'sources' },
      destinationLabel: 'Browse authoritative sources & gaps',
    },
    {
      id: 'postpartum-real',
      kind: 'Care REAL',
      title: 'Maternal / postpartum published indicator',
      value: fPost?.magnitude || (m012 ? `${m012.displayValue}%` : '—'),
      comparison: 'Scorecard / Core Set curated extract',
      why: 'Published maternal indicator from the accurate path — open provenance before hearing use.',
      semantic: 'negative',
      direction: 'down',
      visual: 'areaTrend',
      unit: m012 ? '' : undefined,
      ...(measureSeriesPoints('M-012') || {}),
      destination: { view: 'evidence', roomId: 'outcomes', filters: { population: 'maternal', measureType: 'quality' } },
      destinationLabel: 'Review outcomes REAL rows',
    },
  ],
  'legislative-staff': [
    {
      id: 'maternal-lrc',
      kind: 'Bill REAL',
      title: 'LRC maternal / postpartum touchpoints',
      value: fPend?.magnitude || 'LRC',
      comparison: 'Legislative Record — verify committee status',
      why: 'Fixture HB 412 is retired; use live LRC bill references from the hydration pack.',
      semantic: 'critical',
      direction: 'stable',
      visual: 'status',
      status: {
        tone: 'critical',
        detail: 'Verify bill page status before hearing packets',
        chips: ['KY_LRC_RECORD', 'ATTRIBUTABLE'],
      },
      destination: { view: 'legislation' },
      destinationLabel: 'Open Law ↔ blender analysis',
    },
    {
      id: 'postpartum-brief',
      kind: 'Hearing cue',
      title: 'Maternal indicator is brief-ready (lagged)',
      value: m012 ? `${m012.displayValue}%` : '—',
      comparison: formatMeasurePeriodLabel(m012) || `as of ${m012?.asOfDate || 'n/a'}`,
      why: 'Bounded published rate with measure id and source URI for a precise chair question.',
      semantic: 'negative',
      direction: 'down',
      visual: 'radial',
      radial: m012
        ? { percent: Number(m012.numericValue), caption: 'published rate' }
        : undefined,
      destination: { view: 'evidence', roomId: 'outcomes', filters: { population: 'maternal' } },
      destinationLabel: 'Open the hearing-evidence slice',
    },
    {
      id: 'sources-ready',
      kind: 'Trust cue',
      title: 'Authoritative sources catalogue is ready',
      value: `${loadedCount}/${sourceCount}`,
      comparison: 'CMS · KY DMS · LRC · Scorecard',
      why: 'Source ownership and TOS grades should be checked before evidence enters a hearing packet.',
      semantic: 'info',
      direction: 'up',
      visual: 'status',
      status: {
        tone: 'info',
        detail: `${loadedCount} loaded · ${gapCount} explicit gaps`,
        chips: ['SAFE', 'ATTRIBUTABLE', 'RESTRICTED'],
      },
      destination: { view: 'sources' },
      destinationLabel: 'Browse all authoritative sources',
    },
  ],
  'budget-analyst': [
    {
      id: 'pharmacy-real',
      kind: 'Cost REAL',
      title: 'Pharmacy — federal published KY drug spend',
      value: fPharm?.magnitude || (m017 ? `$${m017.displayValue}M` : '—'),
      comparison: 'CMS Spending by Drug curated slice',
      why: 'Contribution $M by service×population remains Gap; federal drug spend is the public pressure signal.',
      semantic: 'negative',
      direction: 'up',
      visual: 'heroBreakdown',
      breakdown: [
        {
          label: 'Pharmacy pub.',
          display: m017 ? `$${m017.displayValue}M` : '—',
          value: Number(m017?.numericValue),
          tone: 'negative',
        },
        m004
          ? {
              label: 'Fed KY total',
              display: `${m004.displayValue}M`,
              value: Number(m004.numericValue),
              tone: 'warning',
            }
          : { label: 'Fed KY total', display: '—', bar: false },
        { label: 'Claim-grain $', display: 'Gap', isGap: true },
      ],
      destination: { view: 'evidence', roomId: 'cost-drivers', filters: { service: 'pharmacy' } },
      destinationLabel: 'Drill into pharmacy REAL / Gap rows',
    },
    {
      id: 'inpatient-gap',
      kind: 'Utilization Gap',
      title: 'Inpatient days (disabled) need encounters',
      value: 'Gap',
      comparison: 'GAP-CLAIMS-COST-DRIVERS',
      why: 'Claim-grain utilization growth is not filled from public web alone.',
      semantic: 'critical',
      direction: 'stable',
      visual: 'gap',
      gap: {
        gapId: 'GAP-CLAIMS-COST-DRIVERS',
        accessPath: 'DMS/MCO authorized feeds + DUA',
      },
      destination: { view: 'sources' },
      destinationLabel: 'See paid / DUA follow-on gaps',
    },
    {
      id: 'enroll-yoy',
      kind: 'Enrollment REAL',
      title: 'KY enrollment YoY (CMS PI)',
      value: m002?.displayValue || '—',
      comparison: m001 ? `${m001.displayValue} persons` : 'M-001',
      why: 'Accurate-path enrollment scale and change from Performance Indicator dataset.',
      semantic: Number(m002?.numericValue) < 0 ? 'negative' : 'info',
      direction: Number(m002?.numericValue) < 0 ? 'down' : 'up',
      visual: 'areaTrend',
      unit: m001 ? 'persons' : undefined,
      ...(enrollmentSeries() || {}),
      bullet: {
        current: Number(m002?.numericValue) || 0,
        target: 0,
        min: Math.min(Number(m002?.numericValue) || 0, -10),
        max: Math.max(Number(m002?.numericValue) || 0, 10),
        label: 'YoY vs 0%',
        targetLabel: 'Flat enrollment',
      },
      destination: { view: 'evidence', roomId: 'command-center' },
      destinationLabel: 'Open Command Center PI periods',
    },
  ],
  'medicaid-leadership': [
    {
      id: 'mco-eval-themes',
      kind: 'Accountability REAL',
      title: 'EQRO / evaluation themes published',
      value: fMco?.magnitude || 'Themes',
      comparison: `${m007?.displayValue || '5'} active MCOs · withholding $ is Gap`,
      why: 'Public evaluation PDF is REAL meta; inventing withholding dollars is forbidden.',
      semantic: 'negative',
      direction: 'stable',
      visual: 'status',
      status: {
        tone: 'negative',
        detail: 'Withholding dollars remain Explicit Gap',
        chips: ['KY_DMS_MCO_EVAL', 'ATTRIBUTABLE'],
      },
      destination: { view: 'evidence', roomId: 'mco' },
      destinationLabel: 'Open MCO Accountability (REAL + Gap)',
    },
    {
      id: 'avoidable-ed-gap',
      kind: 'Operations Gap',
      title: 'Avoidable ED is not public-fillable yet',
      value: fGapEd?.magnitude || 'Gap',
      comparison: 'HCUP microdata RESTRICTED / encounters needed',
      why: 'Shown as Gap rather than a synthetic percentage.',
      semantic: 'critical',
      direction: 'stable',
      visual: 'gap',
      gap: {
        gapId: 'GAP-AVOIDABLE-ED',
        accessPath: 'Encounter algorithm or licensed KY HCUP aggregates',
      },
      destination: { view: 'sources' },
      destinationLabel: 'Review Gap catalogue',
    },
    {
      id: 'active-mco-count',
      kind: 'Roster REAL',
      title: 'Active contracted MCO count',
      value: m007?.displayValue || '5',
      comparison: 'DMS contracts page curated roster',
      why: 'Anthem exit reflected; roster is ATTRIBUTABLE public extract.',
      semantic: 'info',
      direction: 'stable',
      visual: 'bullet',
      unit: 'MCOs',
      bullet: {
        current: Number(m007?.numericValue) || 5,
        target: Number(m007?.numericValue) || 5,
        min: 0,
        max: 8,
        label: 'Active MCO roster',
        targetLabel: 'current',
        minLabel: '0',
        maxLabel: '8',
      },
      destination: { view: 'evidence', roomId: 'mco' },
      destinationLabel: 'Inspect MCO roster row',
    },
  ],
  'policy-analyst': [
    {
      id: 'cross-domain-opportunity',
      kind: 'Synthesis opportunity',
      title: 'Blend REAL pharmacy + maternal + Gaps',
      value: '3 focuses',
      comparison: 'budget · care · access',
      why: 'Packages can be weighed with honest Gap caveats — no fake avoidable-ED %.',
      semantic: 'positive',
      direction: 'up',
      visual: 'barCompare',
      bars: [
        { label: 'budget', value: 60, display: '60%', tone: 'negative' },
        { label: 'care', value: 65, display: '65%', tone: 'warning' },
        { label: 'access', value: 70, display: '70%', tone: 'critical' },
      ],
      destination: {
        view: 'blender',
        focuses: ['budget', 'care', 'access'],
        findings: ['f-pharmacy', 'f-postpartum', 'f-avoidable-ed', 'f-rural-distance'],
        weights: { budget: 60, care: 65, access: 70, mco: 40, district: 35, bill: 45 },
      },
      destinationLabel: 'Open a preweighted cross-domain blend',
    },
    {
      id: 'peer-scorecard',
      kind: 'Benchmark REAL',
      title: 'Scorecard / Core Set KY rates loaded',
      value: m010?.displayValue ? `${m010.displayValue}%` : 'Scorecard',
      comparison: 'Child Core Set curated extract',
      why: 'Cross-state peer gaps need Scorecard vintage — open Benchmarks room.',
      semantic: 'critical',
      direction: 'stable',
      visual: 'radial',
      radial: m010
        ? { percent: Number(m010.numericValue), caption: 'Child Core Set' }
        : undefined,
      destination: { view: 'evidence', roomId: 'benchmarks' },
      destinationLabel: 'Open Benchmarks REAL rows',
    },
    {
      id: 'law-opening',
      kind: 'Policy opening',
      title: 'LRC maternal bills link to published indicator',
      value: fPend?.magnitude || 'LRC',
      comparison: 'REAL legislation touchpoints',
      why: 'Law↔blender uses Legislative Record URLs, not synthetic bill numbers.',
      semantic: 'info',
      direction: 'up',
      visual: 'status',
      status: {
        tone: 'info',
        detail: m012 ? `Maternal indicator ${m012.displayValue}%` : 'Link to published indicator',
        chips: ['Law ↔ blender', 'LRC'],
      },
      destination: { view: 'legislation', focuses: ['access', 'care', 'bill'] },
      destinationLabel: 'Trace the Law ↔ blender relationship',
    },
  ],
  'oversight-auditor': [
    {
      id: 'lagged-definition-risk',
      kind: 'Audit exception',
      title: 'Lagged Scorecard measures need reconciliation',
      value: 'Lagged',
      comparison: 'Core Set / Scorecard vintage',
      why: 'A quoted rate is not audit-ready until owner, source, cadence, and limitation reconcile.',
      semantic: 'critical',
      direction: 'stable',
      visual: 'status',
      status: {
        tone: 'critical',
        detail: m010
          ? `${m010.displayValue}% · ${formatMeasurePeriodLabel(m010) || m010.asOfDate}`
          : 'Reconcile before citation',
        chips: ['Owner', 'Source', 'Limitation'],
      },
      destination: { view: 'evidence', roomId: 'measure-definitions' },
      destinationLabel: 'Inspect measure definitions',
    },
    {
      id: 'mco-contract-roster',
      kind: 'Contract REAL',
      title: 'MCO roster matches DMS contracts page',
      value: m007?.displayValue || '5',
      comparison: 'ATTRIBUTABLE curated extract',
      why: 'Withholding dollar variance remains Gap — do not treat themes as financial facts.',
      semantic: 'negative',
      direction: 'stable',
      visual: 'bullet',
      unit: 'MCOs',
      bullet: {
        current: Number(m007?.numericValue) || 5,
        target: Number(m007?.numericValue) || 5,
        min: 0,
        max: 8,
        label: 'Roster vs contract page',
        targetLabel: 'current',
        minLabel: '0',
        maxLabel: '8',
      },
      destination: { view: 'evidence', roomId: 'mco' },
      destinationLabel: 'Reconcile roster with evaluation themes',
    },
    {
      id: 'sources-catalogue',
      kind: 'Reporting exception',
      title: 'Incomplete claim-grain signals are Gaps',
      value: `${gapCount} gaps`,
      comparison: 'Authoritative sources catalogue',
      why: 'Missing operational feeds are sold as paid follow-on, not faked in cubes.',
      semantic: 'critical',
      direction: 'stable',
      visual: 'gap',
      gap: {
        gapId: 'GAP-CLAIMS-COST-DRIVERS',
        accessPath: `${gapCount} explicit gaps · ${loadedCount} sources loaded`,
      },
      destination: { view: 'sources' },
      destinationLabel: 'Open authoritative sources',
    },
  ],
  'data-steward': [
    {
      id: 'gap-labels',
      kind: 'Freshness exception',
      title: 'Gap rows must stay unlabeled as REAL',
      value: 'Review',
      comparison: 'rowKind REAL vs GAP',
      why: 'Downstream users must not see synthetic magnitudes when a Data Request cannot fill the grain.',
      semantic: 'critical',
      direction: 'stable',
      visual: 'status',
      status: {
        tone: 'critical',
        detail: 'Enforce rowKind before role-facing export',
        chips: ['REAL', 'GAP'],
      },
      destination: { view: 'evidence', roomId: 'command-center', filters: { attention: 'data-incomplete' } },
      destinationLabel: 'Preview Gap attention rows',
    },
    {
      id: 'measure-catalog',
      kind: 'Governance cue',
      title: 'Measure definitions mirror BW catalogue',
      value: 'Catalog',
      comparison: 'M-001…M-028 subset loaded',
      why: 'Definition and suppression context should be checked before role-facing views.',
      semantic: 'info',
      direction: 'up',
      visual: 'status',
      status: {
        tone: 'info',
        detail: `${(ACCURATE_LANDING.measures || []).length} landing measures exported`,
        chips: ['Definitions', 'Suppression'],
      },
      destination: { view: 'evidence', roomId: 'measure-definitions' },
      destinationLabel: 'Review governed definitions',
    },
    {
      id: 'primary-source-maintenance',
      kind: 'Lineage cue',
      title: 'Authoritative source links are the SoT browser',
      value: `${loadedCount}/${sourceCount}`,
      comparison: 'TOS · FromSysID · load status',
      why: 'A current-looking measure still needs a working path back to the authoritative source.',
      semantic: 'positive',
      direction: 'up',
      visual: 'barCompare',
      bars: [
        {
          label: 'LOADED',
          value: loadedCount,
          display: String(loadedCount),
          tone: 'positive',
        },
        {
          label: 'Gaps',
          value: gapCount,
          display: String(gapCount),
          tone: 'critical',
        },
      ],
      destination: { view: 'sources' },
      destinationLabel: 'Verify source ownership and links',
    },
  ],
};

export function getHomeSmartTiles(roleId) {
  return HOME_SMART_TILES[roleId] || [];
}
