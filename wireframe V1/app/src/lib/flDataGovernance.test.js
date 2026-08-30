import { describe, expect, it } from 'vitest';
import { FL_OPERATIONAL_SOURCES } from '../data/alp/flOperationalSources.js';
import { FL_OPERATIONAL_GOALS } from '../data/flOperationalGoals.js';
import { FL_EVIDENCE_ROOMS, floridaSourceLabel } from '../components/FloridaWorkspace.jsx';
import { buildAnalyticalRows, decodeHtmlEntities, parseAgeByCountyItems, parseCsv, parseEligibilityInventory, parseFeeScheduleInventory, parseTableauConfig, permissionDisposition, WORKBOOKS } from '../../../../xenodroid-bw/scripts/refresh-florida-public-sources.mjs';

describe('Florida governed public data', () => {
  it('decodes Tableau configuration and enforces the publisher export flag', () => {
    const html = '<textarea id="tsConfigContainer">&#x7b;&quot;allow_export_data&quot;:false,&quot;visible_sheets&quot;:&quot;One|Two&quot;&#x7d;</textarea>';
    const config = parseTableauConfig(html);
    expect(config.visible_sheets).toBe('One|Two');
    expect(permissionDisposition(config, { id: 'X', blockedGap: 'GAP-X' })).toEqual({ allowed: false, status: 'GAP', gapId: 'GAP-X' });
    expect(decodeHtmlEntities('&#x41;&#66;&amp;')).toBe('AB&');
  });

  it('parses quoted CSV without truncating commas or escaped quotes', () => {
    expect(parseCsv('Name,Value\n"A, Inc.","said ""yes"""\n')).toEqual([{ Name: 'A, Inc.', Value: 'said "yes"' }]);
  });

  it('covers all eleven AHCA dashboard domains and never hydrates restricted exports', () => {
    expect(WORKBOOKS).toHaveLength(11);
    expect(FL_OPERATIONAL_SOURCES.sources).toHaveLength(13);
    const restricted = FL_OPERATIONAL_SOURCES.sources.filter((item) => item.exportAllowed === false);
    expect(restricted.map((item) => item.fromSysId).sort()).toEqual(['FL_AHCA_MALPRACTICE', 'FL_AHCA_QUALITY']);
    expect(restricted.every((item) => item.status === 'GAP')).toBe(true);
    expect(FL_OPERATIONAL_SOURCES.datasets.some((item) => restricted.some((source) => source.fromSysId === item.fromSysId))).toBe(false);
    expect(FL_OPERATIONAL_SOURCES.sources.find((item) => item.fromSysId === 'FL_ELIGIBILITY_REPORTS')?.status).toBe('REAL data hydrated');
    expect(FL_OPERATIONAL_SOURCES.sources.find((item) => item.fromSysId === 'FL_FEE_SCHEDULES')?.status).toBe('REAL data hydrated');
  });

  it('retains provenance and exports privacy-safe aggregate metrics', () => {
    expect(FL_OPERATIONAL_SOURCES.datasets.length).toBeGreaterThanOrEqual(13);
    for (const dataset of FL_OPERATIONAL_SOURCES.datasets) {
      expect(dataset.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(dataset.sourcePageUri).toMatch(/^https:\/\/((bi\.)?ahca\.myflorida\.com|data\.medicaid\.gov|data\.cms\.gov|oig\.hhs\.gov|www\.usaspending\.gov)\//);
      expect(dataset.loadClass).toBe('REAL');
    }
    expect(JSON.stringify(FL_OPERATIONAL_SOURCES.metrics)).not.toMatch(/Admin\/Owner|Street Address|Phone/);
    expect(FL_OPERATIONAL_SOURCES.publisherPolicy.contentSignal).toMatch(/ai-train=no/);
    expect(FL_OPERATIONAL_SOURCES.schema).toBe('decisionpro/fl-operational-sources/v3');
    expect(FL_OPERATIONAL_SOURCES.analytics.facilityCapacityByCounty.length).toBeGreaterThan(60);
    expect(FL_OPERATIONAL_SOURCES.analytics.hospitalMeasureSeries.length).toBeGreaterThan(40);
    expect(FL_OPERATIONAL_SOURCES.analytics.priorAuthorizationByPlan.length).toBeGreaterThan(20);
    expect(FL_OPERATIONAL_SOURCES.analytics.eligibilityByCounty).toHaveLength(67);
    expect(FL_OPERATIONAL_SOURCES.analytics.feeScheduleInventory.length).toBeGreaterThan(40);
    expect(FL_OPERATIONAL_SOURCES.federalSources.filter((item) => item.status === 'REAL data hydrated').map((item) => item.fromSysId).sort()).toEqual(['CMS_MCPAR', 'CMS_PROVIDER_DATA', 'HHS_OIG_LEIE', 'USA_SPENDING']);
    expect(JSON.stringify(FL_OPERATIONAL_SOURCES.analytics)).not.toMatch(/Admin\/Owner|Street Address|Phone/);
    expect(floridaSourceLabel(FL_OPERATIONAL_SOURCES.federalSources.find((item) => item.fromSysId === 'CMS_PROVIDER_DATA'))).toBe('Centers for Medicare & Medicaid Services');
    expect(floridaSourceLabel(FL_OPERATIONAL_SOURCES.sources.find((item) => item.fromSysId === 'FL_AHCA_BEDS'))).toBe('Florida AHCA');
  });

  it('parses ordinary public eligibility and fee-schedule publications without restricted endpoints', () => {
    const eligibility = parseEligibilityInventory('<a href="/file/medicaid/202607_Age_by_County.pdf">Age by County</a>');
    expect(eligibility).toEqual([{ period: '202607', reportType: 'Age by County', sourceUri: 'https://ahca.myflorida.com/file/medicaid/202607_Age_by_County.pdf' }]);
    const fees = parseFeeScheduleInventory('<table><tr><td>Dental General Fee Schedule</td><td><a href="/content/download/1/file/dental.xlsx">Updated XLS</a> July 1, 2026</td></tr></table>');
    expect(fees[0]).toMatchObject({ schedule: 'Dental General Fee Schedule', mediaKind: 'xlsx', effectiveDates: ['July 1, 2026'] });
    const countyItems = [];
    const counties = ['ALACHUA', 'BAKER', 'BAY', 'BRADFORD', 'BREVARD', 'BROWARD', 'CALHOUN', 'CHARLOTTE', 'CITRUS', 'CLAY', 'COLLIER', 'COLUMBIA', 'DADE', 'DESOTO', 'DIXIE', 'DUVAL', 'ESCAMBIA', 'FLAGLER', 'FRANKLIN', 'GADSDEN', 'GILCHRIST', 'GLADES', 'GULF', 'HAMILTON', 'HARDEE', 'HENDRY', 'HERNANDO', 'HIGHLANDS', 'HILLSBOROUGH', 'HOLMES', 'INDIAN RIVER', 'JACKSON', 'JEFFERSON', 'LAFAYETTE', 'LAKE', 'LEE', 'LEON', 'LEVY', 'LIBERTY', 'MADISON', 'MANATEE', 'MARION', 'MARTIN', 'MONROE', 'NASSAU', 'OKALOOSA', 'OKEECHOBEE', 'ORANGE', 'OSCEOLA', 'PALM BEACH', 'PASCO', 'PINELLAS', 'POLK', 'PUTNAM', 'SANTA ROSA', 'SARASOTA', 'SEMINOLE', 'ST JOHNS', 'ST LUCIE', 'SUMTER', 'SUWANNEE', 'TAYLOR', 'UNION', 'VOLUSIA', 'WAKULLA', 'WALTON', 'WASHINGTON'];
    for (const county of counties) countyItems.push(county, ...Array(10).fill('1'), '10');
    countyItems.push('STATE TOTAL', ...Array(10).fill('67'), '670', 'Last Month', ...Array(10).fill('68'), '680', 'Last Year', ...Array(10).fill('70'), '700');
    expect(parseAgeByCountyItems(countyItems)).toMatchObject({ stateTotal: 670, priorMonthTotal: 680, priorYearTotal: 700 });
  });

  it('aggregates institutional records without exporting owner or contact fields', () => {
    const result = buildAnalyticalRows({ id: 'F-03' }, [
      { County: 'LEON', 'Provider Type': 'Hospital', 'Day of App Approved Date': 'January 2, 2026', 'Admin/Owner': 'Hidden', Phone: '555-0100' },
      { County: 'LEON', 'Provider Type': 'Clinic', 'Day of App Approved Date': 'February 4, 2026', 'Admin/Owner': 'Hidden Two', Phone: '555-0200' },
    ]);
    expect(result.providerApplicationsByCounty).toEqual([{ county: 'LEON', applications: 2, providerTypes: 2, latestApproval: 'February 4, 2026' }]);
    expect(JSON.stringify(result)).not.toMatch(/Hidden|555/);
  });

  it('provides six quantified operational goals and all Florida evidence rooms', () => {
    expect(FL_OPERATIONAL_GOALS).toHaveLength(6);
    expect(FL_EVIDENCE_ROOMS).toHaveLength(8);
    for (const goal of FL_OPERATIONAL_GOALS) {
      expect(goal.leadValue).toBeTruthy();
      for (const decisionCase of goal.cases) {
        expect(decisionCase.actions.length).toBeGreaterThanOrEqual(2);
        expect(decisionCase.inputs.length).toBeGreaterThan(1);
        expect(decisionCase.transformations.length).toBeGreaterThan(1);
        for (const item of decisionCase.actions) {
          expect(item.owner.length).toBeGreaterThan(10);
          expect(item.timeHorizon.length).toBeGreaterThan(5);
          expect(item.estimatedCost.length).toBeGreaterThan(5);
          expect(item.opportunity.absoluteValue).toMatch(/\d/);
          expect(item.opportunity.improvementValue).toMatch(/\d/);
          expect(item.opportunity.calculationBasis.length).toBeGreaterThan(20);
        }
      }
    }
  });
});
