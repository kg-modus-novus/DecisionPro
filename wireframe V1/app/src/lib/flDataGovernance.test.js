import { describe, expect, it } from 'vitest';
import { FL_OPERATIONAL_SOURCES } from '../data/alp/flOperationalSources.js';
import { FL_OPERATIONAL_GOALS } from '../data/flOperationalGoals.js';
import { FL_EVIDENCE_ROOMS } from '../components/FloridaWorkspace.jsx';
import { buildAnalyticalRows, decodeHtmlEntities, parseCsv, parseTableauConfig, permissionDisposition, WORKBOOKS } from '../../../../xenodroid-bw/scripts/refresh-florida-public-sources.mjs';

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
    expect(FL_OPERATIONAL_SOURCES.sources).toHaveLength(11);
    const restricted = FL_OPERATIONAL_SOURCES.sources.filter((item) => item.exportAllowed === false);
    expect(restricted.map((item) => item.fromSysId).sort()).toEqual(['FL_AHCA_MALPRACTICE', 'FL_AHCA_QUALITY']);
    expect(restricted.every((item) => item.status === 'GAP')).toBe(true);
    expect(FL_OPERATIONAL_SOURCES.datasets.some((item) => restricted.some((source) => source.fromSysId === item.fromSysId))).toBe(false);
  });

  it('retains provenance and exports privacy-safe aggregate metrics', () => {
    expect(FL_OPERATIONAL_SOURCES.datasets.length).toBeGreaterThanOrEqual(13);
    for (const dataset of FL_OPERATIONAL_SOURCES.datasets) {
      expect(dataset.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(dataset.sourcePageUri).toMatch(/^https:\/\/(bi\.ahca\.myflorida\.com|data\.medicaid\.gov)\//);
      expect(dataset.loadClass).toBe('REAL');
    }
    expect(JSON.stringify(FL_OPERATIONAL_SOURCES.metrics)).not.toMatch(/Admin\/Owner|Street Address|Phone/);
    expect(FL_OPERATIONAL_SOURCES.publisherPolicy.contentSignal).toMatch(/ai-train=no/);
    expect(FL_OPERATIONAL_SOURCES.schema).toBe('decisionpro/fl-operational-sources/v2');
    expect(FL_OPERATIONAL_SOURCES.analytics.facilityCapacityByCounty.length).toBeGreaterThan(60);
    expect(FL_OPERATIONAL_SOURCES.analytics.hospitalMeasureSeries.length).toBeGreaterThan(40);
    expect(FL_OPERATIONAL_SOURCES.analytics.priorAuthorizationByPlan.length).toBeGreaterThan(20);
    expect(JSON.stringify(FL_OPERATIONAL_SOURCES.analytics)).not.toMatch(/Admin\/Owner|Street Address|Phone/);
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
