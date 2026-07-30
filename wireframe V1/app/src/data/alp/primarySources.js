/**
 * Curated primary government / official data sources for wireframe provenance.
 * Links enrich veracity; warehouse values remain synthetic examination fixtures.
 */

export const SOURCE = {
  cmsDataSearch: {
    id: 'cms-data-search',
    label: 'CMS Data — search portal',
    href: 'https://data.cms.gov/search',
    publisher: 'Centers for Medicare & Medicaid Services',
    kind: 'government-stats',
  },
  cmsPartCDPerformance: {
    id: 'cms-part-c-d-performance',
    label: 'CMS Part C & D Performance Data',
    href: 'https://www.cms.gov/medicare/health-drug-plans/part-c-d-performance-data',
    publisher: 'CMS',
    kind: 'performance-data',
  },
  cmsStarRatingsFactSheet2026: {
    id: 'cms-star-ratings-2026',
    label: 'CMS Star Ratings & Part C/D performance (HTML)',
    href: 'https://www.cms.gov/medicare/health-drug-plans/part-c-d-performance-data',
    publisher: 'CMS',
    kind: 'performance-data',
  },
  cmsStarRatingsFactSheet2026Pdf: {
    id: 'cms-star-ratings-2026-pdf',
    label: '2026 Star Ratings Fact Sheet (PDF download)',
    href: 'https://www.cms.gov/files/document/2026-star-ratings-fact-sheet.pdf',
    publisher: 'CMS',
    kind: 'fact-sheet',
  },
  cmsStatsTrends: {
    id: 'cms-stats-trends',
    label: 'CMS Statistics, Trends & Reports',
    href: 'https://www.cms.gov/data-research',
    publisher: 'CMS',
    kind: 'government-stats',
  },
  medicaidScorecard: {
    id: 'medicaid-chip-scorecard',
    label: 'Medicaid & CHIP Scorecard',
    href: 'https://www.medicaid.gov/state-overviews/scorecard/welcome',
    publisher: 'CMS / Medicaid.gov',
    kind: 'performance-data',
  },
  medicaidManagedCare: {
    id: 'medicaid-managed-care',
    label: 'Medicaid managed care guidance',
    href: 'https://www.medicaid.gov/medicaid/managed-care',
    publisher: 'CMS / Medicaid.gov',
    kind: 'government-guidance',
  },
  medicaidPharmacy: {
    id: 'medicaid-pharmacy',
    label: 'Medicaid prescription drugs',
    href: 'https://www.medicaid.gov/medicaid/prescription-drugs',
    publisher: 'CMS / Medicaid.gov',
    kind: 'government-stats',
  },
  medicaidData: {
    id: 'data-medicaid',
    label: 'data.medicaid.gov',
    href: 'https://data.medicaid.gov/',
    publisher: 'CMS / Medicaid.gov',
    kind: 'government-stats',
  },
  cmsNetworkAdequacy: {
    id: 'cms-network-adequacy',
    label: 'Medicaid managed care — network adequacy',
    href: 'https://www.medicaid.gov/medicaid/managed-care/guidance/network-adequacy',
    publisher: 'CMS / Medicaid.gov',
    kind: 'government-guidance',
  },
  cmsMaternalQuality: {
    id: 'cms-maternal-quality',
    label: 'CMS maternal & infant health quality',
    href: 'https://www.medicaid.gov/medicaid/quality-of-care/quality-improvement-initiatives/maternal-infant-health-care-quality',
    publisher: 'CMS / Medicaid.gov',
    kind: 'performance-data',
  },
  ahrqHcup: {
    id: 'ahrq-hcup',
    label: 'AHRQ HCUP — hospital / ED utilization data',
    href: 'https://www.ahrq.gov/data/hcup/index.html',
    publisher: 'Agency for Healthcare Research and Quality',
    kind: 'government-survey',
  },
  ahrqQi: {
    id: 'ahrq-qi',
    label: 'AHRQ Quality Indicators',
    href: 'https://qualityindicators.ahrq.gov/',
    publisher: 'AHRQ',
    kind: 'performance-data',
  },
  hrsaRural: {
    id: 'hrsa-rural',
    label: 'HRSA Rural Health',
    href: 'https://www.hrsa.gov/rural-health',
    publisher: 'Health Resources and Services Administration',
    kind: 'government-stats',
  },
  hrsaAreaHealth: {
    id: 'hrsa-ahrf',
    label: 'HRSA Area Health Resources Files',
    href: 'https://data.hrsa.gov/topics/health-workforce/ahrf',
    publisher: 'HRSA',
    kind: 'government-stats',
  },
  censusAcs: {
    id: 'census-acs',
    label: 'U.S. Census ACS data',
    href: 'https://www.census.gov/programs-surveys/acs',
    publisher: 'U.S. Census Bureau',
    kind: 'government-survey',
  },
  kyDms: {
    id: 'ky-dms',
    label: 'KY DMS — Department for Medicaid Services',
    href: 'https://www.chfs.ky.gov/agencies/dms/Pages/default.aspx',
    publisher: 'Kentucky CHFS / DMS',
    kind: 'facility-reporting',
  },
  kyDmsManagedCare: {
    id: 'ky-dms-mco',
    label: 'KY DMS — Managed Care',
    href: 'https://chfs.ky.gov/agencies/dms/dhpo/Pages/mco-options.aspx',
    publisher: 'Kentucky CHFS / DMS',
    kind: 'facility-reporting',
  },
  kyRuralHealth: {
    id: 'ky-rural-health',
    label: 'KY CHFS — Health Professional Shortage / MUA',
    href: 'https://chfs.ky.gov/agencies/dph/dpqi/hcab/Pages/hpsamua.aspx',
    publisher: 'Kentucky CHFS',
    kind: 'government-stats',
  },
  kyOpenData: {
    id: 'ky-open-data',
    label: 'KyGovMaps Open Data Portal',
    href: 'https://opengisdata.ky.gov/',
    publisher: 'Commonwealth of Kentucky',
    kind: 'government-stats',
  },
  kyLegislatureRecord: {
    id: 'ky-leg-record',
    label: 'Kentucky Legislative Record',
    href: 'https://apps.legislature.ky.gov/record/',
    publisher: 'Kentucky General Assembly / LRC',
    kind: 'government-stats',
  },
  macpac: {
    id: 'macpac',
    label: 'MACPAC — Medicaid & CHIP Payment and Access Commission',
    href: 'https://www.macpac.gov/',
    publisher: 'MACPAC',
    kind: 'government-stats',
  },
  ncqaHedish: {
    id: 'ncqa-hedis',
    label: 'NCQA HEDIS measures (quality specification reference)',
    href: 'https://www.ncqa.org/hedis/',
    publisher: 'NCQA',
    kind: 'performance-data',
  },
};

/** Resolve one or more SOURCE keys into link objects. */
export function sources(...keys) {
  return keys.map((key) => {
    const s = SOURCE[key];
    if (!s) throw new Error(`Unknown primary source key: ${key}`);
    return { ...s };
  });
}

/** Default primary sources by Evidence Room. */
export const ROOM_PRIMARY_SOURCES = {
  'command-center': sources('kyDms', 'medicaidScorecard', 'cmsDataSearch', 'macpac'),
  'cost-drivers': sources('kyDms', 'medicaidPharmacy', 'medicaidData', 'cmsStatsTrends'),
  utilization: sources('kyDms', 'ahrqHcup', 'ahrqQi', 'cmsDataSearch'),
  outcomes: sources('kyDms', 'medicaidScorecard', 'ncqaHedish', 'cmsMaternalQuality'),
  mco: sources(
    'kyDmsManagedCare',
    'medicaidManagedCare',
    'cmsPartCDPerformance',
    'cmsStarRatingsFactSheet2026',
    'cmsNetworkAdequacy',
  ),
  provider: sources('kyDms', 'ahrqQi', 'cmsDataSearch', 'hrsaAreaHealth'),
  county: sources('kyDms', 'kyOpenData', 'censusAcs', 'hrsaRural'),
  benchmarks: sources(
    'medicaidScorecard',
    'cmsPartCDPerformance',
    'cmsStarRatingsFactSheet2026',
    'ncqaHedish',
    'cmsDataSearch',
  ),
  'measure-definitions': sources('kyDms', 'medicaidScorecard', 'ncqaHedish', 'cmsDataSearch', 'macpac'),
};

/** Map measure-definition source labels → primary links. */
export const SOURCE_LABEL_PRIMARY = {
  'Claims warehouse': sources('kyDms', 'medicaidData', 'cmsDataSearch'),
  'HEDIS-style': sources('ncqaHedish', 'medicaidScorecard', 'cmsPartCDPerformance'),
  'Contract files': sources('kyDmsManagedCare', 'medicaidManagedCare', 'cmsNetworkAdequacy'),
  'Encounter feeds': sources('kyDms', 'medicaidManagedCare', 'cmsDataSearch'),
};

/** Finding-level primary sources for blender inputs. */
export const FINDING_PRIMARY_SOURCES = {
  'f-pharmacy': sources('kyDms', 'medicaidPharmacy', 'medicaidData'),
  'f-inpatient-disabled': sources('kyDms', 'ahrqHcup', 'medicaidData'),
  'f-postpartum': sources('kyDms', 'cmsMaternalQuality', 'ncqaHedish', 'medicaidScorecard'),
  'f-diabetes': sources('kyDms', 'medicaidScorecard', 'ncqaHedish', 'cmsDataSearch'),
  'f-avoidable-ed': sources('kyDms', 'ahrqHcup', 'ahrqQi'),
  'f-rural-distance': sources('kyDms', 'hrsaRural', 'kyRuralHealth', 'hrsaAreaHealth'),
  'f-mco-withholding': sources(
    'kyDmsManagedCare',
    'cmsPartCDPerformance',
    'cmsStarRatingsFactSheet2026',
    'medicaidManagedCare',
  ),
  'f-hd67': sources('kyDms', 'kyOpenData', 'censusAcs'),
  'f-pending-maternal': sources('kyLegislatureRecord', 'cmsMaternalQuality', 'kyDms'),
};

/** Filter-dimension primary sources for tile explains. */
export const FILTER_PRIMARY_SOURCES = {
  population: sources('kyDms', 'medicaidData', 'macpac'),
  region: sources('kyDms', 'kyOpenData', 'censusAcs'),
  period: sources('kyDms', 'cmsStatsTrends'),
  mco: sources('kyDmsManagedCare', 'medicaidManagedCare', 'cmsPartCDPerformance'),
  freshness: sources('kyDms', 'medicaidScorecard', 'cmsDataSearch'),
  service: sources('kyDms', 'medicaidData', 'ahrqHcup'),
  attention: sources('kyDms', 'medicaidScorecard'),
  measureType: sources('kyDms', 'ncqaHedish', 'medicaidScorecard'),
  contractClass: sources('kyDmsManagedCare', 'medicaidManagedCare'),
  providerGroup: sources('kyDms', 'cmsDataSearch', 'hrsaAreaHealth'),
  county: sources('kyDms', 'kyOpenData', 'censusAcs'),
  benchmarkType: sources(
    'medicaidScorecard',
    'cmsPartCDPerformance',
    'cmsStarRatingsFactSheet2026',
    'ncqaHedish',
  ),
};

export function primarySourcesForRoom(roomId) {
  return ROOM_PRIMARY_SOURCES[roomId] ? ROOM_PRIMARY_SOURCES[roomId].map((s) => ({ ...s })) : [];
}

export function primarySourcesForFinding(findingId) {
  return FINDING_PRIMARY_SOURCES[findingId]
    ? FINDING_PRIMARY_SOURCES[findingId].map((s) => ({ ...s }))
    : [];
}

export function primarySourcesForSourceLabel(label) {
  return SOURCE_LABEL_PRIMARY[label]
    ? SOURCE_LABEL_PRIMARY[label].map((s) => ({ ...s }))
    : sources('cmsDataSearch', 'kyDms');
}
