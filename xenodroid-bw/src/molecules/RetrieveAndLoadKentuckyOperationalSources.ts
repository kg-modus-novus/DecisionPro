import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { psaStore } from '../psa/filesystemPsa.js';
import {
  ExtractDocumentLinks,
  FetchPublicBytes,
  IsoDateOrNull,
  NumberOrNull,
  ParseCsvRecords,
  SafeObjectSegment,
  Sha256,
} from '../adapters/operationalPublicSources.js';

type SourceStatus = 'API_LOADED' | 'FILE_LOADED' | 'DOCUMENTS_LOADED' | 'SOURCE_VERIFIED';
type Spec = { requestId: string; fromSysId: string; sourceUri: string };
type Metric = {
  id: string;
  label: string;
  value: number | null;
  display: string;
  unit: string;
  asOf: string;
  status: SourceStatus;
  limitation: string;
  action: string;
  provenance?: Record<string, unknown>;
};

const today = () => new Date().toISOString().slice(0, 10);
const shown = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
const compactUsd = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
}).format(value);

function field(row: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    const value = row[name] ?? row[name.toLowerCase()];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function n(row: Record<string, unknown>, ...names: string[]) {
  return NumberOrNull(field(row, ...names)) || 0;
}

function arcDate(value: unknown) {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? new Date(milliseconds).toISOString()
    : null;
}

/**
 * Business Action: RetrieveAndLoadKentuckyOperationalSources
 * Lands authoritative bytes, normalizes source-grain facts, publishes guarded
 * operational metrics, and records a content-hashed REAL load for each source.
 */
export class RetrieveAndLoadKentuckyOperationalSources {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  SourceCount = 0;
  RecordCount = 0;
  MetricCount = 0;
  private clearedMetricSources = new Set<string>();

  constructor(private client: pg.PoolClient) {}

  private async begin(spec: Spec) {
    const id = newId('LH-OPS');
    await InsertLoadHistory(this.client, {
      load_history_id: id,
      data_request_id: spec.requestId,
      started_at: new Date(),
      source_uri: spec.sourceUri,
      load_class: 'REAL',
    });
    return id;
  }

  private async land(spec: Spec, id: string, bytes: Buffer, extension: string, suffix: string) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `psa/${spec.fromSysId}/REAL/${stamp}/${SafeObjectSegment(suffix)}.${extension}`;
    await psaStore.EnsureRootReady();
    const object = await psaStore.PutObject(key, bytes);
    await this.client.query(
      `INSERT INTO bw_psa_meta.object_index
       (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length)
       VALUES ($1,$2,$3,'REAL',$4,$5)`,
      [key, spec.fromSysId, id, object.contentHash, object.byteLength],
    );
    return { ...object, key };
  }

  private async addMetric(spec: Spec, id: string, item: Metric, sourceUri = spec.sourceUri) {
    if (!this.clearedMetricSources.has(spec.fromSysId)) {
      await this.client.query(
        `DELETE FROM bw_cube.cube_operational_source_metric WHERE from_sys_id=$1 AND load_class='REAL'`,
        [spec.fromSysId],
      );
      this.clearedMetricSources.add(spec.fromSysId);
    }
    await this.client.query(
      `INSERT INTO bw_cube.cube_operational_source_metric
       (metric_id,metric_label,numeric_value,display_value,unit,source_status,
        from_sys_id,as_of_date,load_class,load_history_id,provenance_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,'REAL',$9,$10::jsonb)`,
      [item.id, item.label, item.value, item.display, item.unit, item.status,
        spec.fromSysId, item.asOf, id, JSON.stringify({
          sourceUri, fromSysId: spec.fromSysId, loadHistoryId: id, loadClass: 'REAL',
          limitation: item.limitation, action: item.action, ...item.provenance,
        })],
    );
    this.MetricCount += 1;
  }

  private async finish(spec: Spec, id: string, rows: number, hash: string, asOf: string, notes: string) {
    await CompleteLoadHistory(this.client, id, {
      status: 'SUCCEEDED', row_count: rows, content_hash: hash, as_of_date: asOf, notes,
    });
    this.SourceCount += 1;
    this.RecordCount += rows;
  }

  private async fail(id: string, error: unknown) {
    await CompleteLoadHistory(this.client, id, {
      status: 'FAILED', notes: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  private async loadMcpar() {
    const spec = { requestId: 'DR-REAL-MCPAR-KY', fromSysId: 'CMS_MCPAR', sourceUri: config.mcparCsvUri };
    const id = await this.begin(spec);
    try {
      const fetched = await FetchPublicBytes(spec.sourceUri, {}, 180_000);
      const landed = await this.land(spec, id, fetched.bytes, 'csv', 'mcpar-2024');
      const all = ParseCsvRecords(fetched.bytes.toString('utf8'));
      const rows = all.filter((row) => ['KY', 'KENTUCKY'].includes(field(row, 'state').toUpperCase()));
      if (rows.length < 500) throw new Error(`MCPAR quality gate expected at least 500 Kentucky rows; received ${rows.length}`);
      await this.client.query(`DELETE FROM bw_dso.dso_mcpar_response WHERE load_class='REAL'`);
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        await this.client.query(
          `INSERT INTO bw_dso.dso_mcpar_response
           (row_number,state_name,program_name,reporting_period_start,reporting_period_end,
            current_question_number,question_id,measure_number,reporting_entity,response_text,
            from_sys_id,load_class,load_history_id)
           VALUES ($1,$2,$3,$4::date,$5::date,$6,$7,$8,$9,$10,$11,'REAL',$12)`,
          [index + 1, field(row, 'state'), field(row, 'program'),
            IsoDateOrNull(field(row, 'reporting_period_start_date')),
            IsoDateOrNull(field(row, 'reporting_period_end_date')),
            field(row, 'current_question_number'), field(row, 'question_id'),
            field(row, 'measure_number'), field(row, 'plan_or_bss'), field(row, 'response'),
            spec.fromSysId, id],
        );
      }
      const asOf = rows.map((row) => IsoDateOrNull(field(row, 'reporting_period_end_date')) || '').sort().at(-1) || today();
      const items: Array<[string, string, number, string]> = [
        ['ky-mcpar-rows', 'Kentucky MCPAR response rows', rows.length, 'rows'],
        ['ky-mcpar-questions', 'Kentucky MCPAR question IDs', new Set(rows.map((r) => field(r, 'question_id')).filter(Boolean)).size, 'questions'],
        ['ky-mcpar-programs', 'Kentucky MCPAR programs', new Set(rows.map((r) => field(r, 'program')).filter(Boolean)).size, 'programs'],
        ['ky-mcpar-entities', 'Kentucky MCPAR reporting entities', new Set(rows.map((r) => field(r, 'plan_or_bss')).filter(Boolean)).size, 'entities'],
      ];
      for (const [metricId, label, value, unit] of items) await this.addMetric(spec, id, {
        id: metricId, label, value, display: shown(value), unit, asOf, status: 'FILE_LOADED',
        limitation: 'Annual state-reported responses; response counts and values are not findings.',
        action: 'Align question, entity, program and effective contract period before case creation.',
        provenance: { psaObjectKey: landed.key },
      }, fetched.finalUri);
      const values = (questionId: string) => rows
        .filter((row) => field(row, 'question_id') === questionId)
        .map((row) => NumberOrNull(field(row, 'response')))
        .filter((value): value is number => value != null);
      const sum = (valuesToSum: number[]) => valuesToSum.reduce((total, value) => total + value, 0);
      const reportedOverpayments = sum(values('plan_overpaymentReportingToStateDollarAmount'));
      const reportedPremium = sum(values('plan_overpaymentReportingToStateCorrespondingYearPremiumRevenue'));
      const encounterTimeliness = values('plan_encounterDataSubmissionTimelinessCompliancePercentage');
      const activeAppeals = sum(values('plan_activeAppeals'));
      const deniedAppeals = sum(values('plan_appealsDenied'));
      const remediationQueue = rows.filter((row) =>
        /sanction/i.test(field(row, 'question_id')) &&
        /remediation in progress|no, no remediation/i.test(field(row, 'response')),
      ).length;
      const operationalItems: Array<[string, string, number, string, string]> = [
        ['ky-mcpar-reported-overpayments', 'Plan-reported overpayments', reportedOverpayments, compactUsd(reportedOverpayments), 'USD'],
        ['ky-mcpar-active-appeals', 'Active appeals at reporting-period end', activeAppeals, shown(activeAppeals), 'appeals'],
        ['ky-mcpar-denied-appeals', 'Denied appeals reported', deniedAppeals, shown(deniedAppeals), 'appeals'],
        ['ky-mcpar-sanction-remediation-queue', 'Sanction responses needing remediation review', remediationQueue, shown(remediationQueue), 'responses'],
      ];
      if (reportedPremium > 0) operationalItems.push([
        'ky-mcpar-overpayment-premium-ratio',
        'Reported overpayments as share of reported premium revenue',
        reportedOverpayments / reportedPremium * 100,
        `${(reportedOverpayments / reportedPremium * 100).toFixed(2)}%`,
        'percent',
      ]);
      if (encounterTimeliness.length) operationalItems.push([
        'ky-mcpar-min-encounter-timeliness',
        'Lowest reported encounter-data timeliness',
        Math.min(...encounterTimeliness),
        `${Math.min(...encounterTimeliness).toFixed(1)}%`,
        'percent',
      ]);
      for (const [metricId, label, value, display, unit] of operationalItems) await this.addMetric(spec, id, {
        id: metricId, label, value, display, unit, asOf, status: 'FILE_LOADED',
        limitation: 'Annual state-reported values are investigation leads, not proof of waste, breach, or misconduct.',
        action: 'Validate entity, denominator, contract authority, and recovery/remediation status before action.',
        provenance: { psaObjectKey: landed.key, reportingPeriod: '2024' },
      }, fetched.finalUri);
      await this.finish(spec, id, rows.length, landed.contentHash, asOf, 'Kentucky rows parsed from the official MCPAR PUF.');
    } catch (error) { await this.fail(id, error); }
  }

  private async loadProviders() {
    const spec = { requestId: 'DR-REAL-CMS-PROVIDER-KY', fromSysId: 'CMS_PROVIDER_DATA', sourceUri: config.providerDataKyUri };
    const id = await this.begin(spec);
    try {
      const fetched = await FetchPublicBytes(spec.sourceUri, { headers: { Accept: 'application/json' } });
      const landed = await this.land(spec, id, fetched.bytes, 'json', 'ky-nursing-facilities');
      const json = JSON.parse(fetched.bytes.toString('utf8')) as { results?: Array<Record<string, unknown>> };
      const rows = json.results || [];
      if (rows.length < 200) throw new Error(`Provider Data quality gate expected at least 200 KY rows; received ${rows.length}`);
      await this.client.query(`DELETE FROM bw_dso.dso_provider_facility WHERE load_class='REAL'`);
      let beds = 0; let lowRated = 0; let fines = 0; let enforcementEvents = 0;
      for (const row of rows) {
        const rating = n(row, 'overall_rating');
        beds += n(row, 'number_of_certified_beds');
        fines += n(row, 'total_amount_of_fines_in_dollars');
        enforcementEvents += n(row, 'number_of_fines') + n(row, 'number_of_payment_denials');
        if (rating > 0 && rating <= 2) lowRated += 1;
        await this.client.query(
          `INSERT INTO bw_dso.dso_provider_facility
           (ccn,provider_name,county_name,ownership_type,certified_beds,residents_per_day,
            overall_rating,staffing_rating,special_focus_status,number_of_fines,total_fines,
            payment_denials,latitude,longitude,processing_date,from_sys_id,load_class,load_history_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::date,$16,'REAL',$17)`,
          [field(row, 'cms_certification_number_ccn'), field(row, 'provider_name'),
            field(row, 'countyparish', 'county_parish'), field(row, 'ownership_type'),
            n(row, 'number_of_certified_beds'), n(row, 'average_number_of_residents_per_day'),
            rating, n(row, 'staffing_rating'), field(row, 'special_focus_status'),
            n(row, 'number_of_fines'), n(row, 'total_amount_of_fines_in_dollars'),
            n(row, 'number_of_payment_denials'), n(row, 'latitude'), n(row, 'longitude'),
            IsoDateOrNull(field(row, 'processing_date')), spec.fromSysId, id],
        );
      }
      const asOf = rows.map((row) => IsoDateOrNull(field(row, 'processing_date')) || '').sort().at(-1) || today();
      const items: Array<[string, string, number, string, string]> = [
        ['ky-provider-facilities', 'Kentucky nursing facilities', rows.length, shown(rows.length), 'facilities'],
        ['ky-provider-beds', 'Certified nursing-facility beds', beds, shown(beds), 'beds'],
        ['ky-provider-low-rating', 'Nursing facilities with 1–2 overall stars', lowRated, shown(lowRated), 'facilities'],
        ['ky-provider-enforcement-events', 'Published fine/payment-denial events', enforcementEvents, shown(enforcementEvents), 'events'],
        ['ky-provider-fines', 'Published facility fine amount', fines, compactUsd(fines), 'USD'],
      ];
      for (const [metricId, label, value, display, unit] of items) await this.addMetric(spec, id, {
        id: metricId, label, value, display, unit, asOf, status: 'API_LOADED',
        limitation: 'Medicare certification, rating and enforcement context is not Medicaid claims or network truth.',
        action: 'Validate facility identity, DMS participation and county capacity before intervention.',
        provenance: { psaObjectKey: landed.key, datasetId: config.providerDataDatasetId },
      }, fetched.finalUri);
      await this.finish(spec, id, rows.length, landed.contentHash, asOf, 'Official CMS Provider Data API Kentucky nursing-home slice.');
    } catch (error) { await this.fail(id, error); }
  }

  private async loadLeie() {
    const spec = { requestId: 'DR-REAL-LEIE', fromSysId: 'HHS_OIG_LEIE', sourceUri: config.leieCsvUri };
    const id = await this.begin(spec);
    try {
      const fetched = await FetchPublicBytes(spec.sourceUri, {}, 180_000);
      const rows = ParseCsvRecords(fetched.bytes.toString('utf8')).filter((row) => field(row, 'state').toUpperCase() === 'KY');
      if (!rows.length) throw new Error('LEIE quality gate found no Kentucky-address rows');
      const groups = new Map<string, { individuals: number; entities: number; npi: number; records: number }>();
      for (const row of rows) {
        const type = field(row, 'general') || 'UNCLASSIFIED';
        const group = groups.get(type) || { individuals: 0, entities: 0, npi: 0, records: 0 };
        group.records += 1;
        if (field(row, 'busname')) group.entities += 1; else group.individuals += 1;
        const npi = field(row, 'npi');
        if (npi && npi !== '0000000000') group.npi += 1;
        groups.set(type, group);
      }
      const aggregate = Buffer.from(JSON.stringify([...groups.entries()].map(([exclusionType, value]) => ({ exclusionType, ...value })), null, 2));
      const landed = await this.land(spec, id, aggregate, 'json', 'ky-aggregate-exclusion-summary');
      await this.client.query(`DELETE FROM bw_dso.dso_exclusion_summary WHERE load_class='REAL'`);
      for (const [type, group] of groups) await this.client.query(
        `INSERT INTO bw_dso.dso_exclusion_summary
         (state_code,exclusion_type,individual_count,entity_count,npi_count,source_record_count,
          from_sys_id,as_of_date,load_class,load_history_id)
         VALUES ('KY',$1,$2,$3,$4,$5,$6,$7::date,'REAL',$8)`,
        [type, group.individuals, group.entities, group.npi, group.records, spec.fromSysId, today(), id],
      );
      const entities = [...groups.values()].reduce((sum, group) => sum + group.entities, 0);
      const withNpi = [...groups.values()].reduce((sum, group) => sum + group.npi, 0);
      for (const [metricId, label, value] of [
        ['ky-leie-records', 'LEIE rows with Kentucky address', rows.length],
        ['ky-leie-entities', 'Kentucky-address business-name rows', entities],
        ['ky-leie-npi', 'Kentucky-address rows with published NPI', withNpi],
      ] as const) await this.addMetric(spec, id, {
        id: metricId, label, value, display: shown(value), unit: 'records', asOf: today(), status: 'FILE_LOADED',
        limitation: 'Address-state filtering is not an identity match or proof of Medicaid participation.',
        action: 'Use exact identifiers where authorized and require official OIG verification before action.',
        provenance: { psaObjectKey: landed.key, rawSourceHash: Sha256(fetched.bytes), privacyTransform: 'Official raw public file retained in governed PSA; only aggregate exclusion-type rows enter the DSO and legislative UI.' },
      }, fetched.finalUri);
      await this.finish(spec, id, groups.size, Sha256(fetched.bytes), today(), 'Official raw public file retained in governed PSA; person names, DOBs and addresses were not normalized or exported to the legislative UI.');
    } catch (error) { await this.fail(id, error); }
  }

  private async loadUsaSpending() {
    const spec = { requestId: 'DR-REAL-USASPENDING-KY-MEDICAID', fromSysId: 'USA_SPENDING', sourceUri: config.usaSpendingApiUri };
    const id = await this.begin(spec);
    try {
      const now = new Date();
      const fiscalYear = now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
      const start = '2022-10-01';
      const end = today();
      const body = {
        group: 'fiscal_year',
        filters: { time_period: [{ start_date: start, end_date: end }], recipient_locations: [{ country: 'USA', state: 'KY' }], program_numbers: ['93.778'], award_type_codes: ['02', '03', '04', '05', 'F001', 'F002'] },
      };
      const fetched = await FetchPublicBytes(spec.sourceUri, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const landed = await this.land(spec, id, fetched.bytes, 'json', 'ky-93778-obligations-by-fiscal-year');
      const json = JSON.parse(fetched.bytes.toString('utf8')) as { results?: Array<{ aggregated_amount?: number; time_period?: { fiscal_year?: string } }> };
      const rows = json.results || [];
      if (!rows.length) throw new Error('USAspending quality gate returned no Assistance Listing 93.778 fiscal-year rows');
      await this.client.query(`DELETE FROM bw_dso.dso_federal_award_context WHERE load_class='REAL'`);
      for (const row of rows) {
        const fy = Number(row.time_period?.fiscal_year);
        const partial = fy === fiscalYear;
        await this.client.query(
          `INSERT INTO bw_dso.dso_federal_award_context
           (fiscal_year,program_number,obligation_amount,period_end_date,period_status,from_sys_id,load_class,load_history_id)
           VALUES ($1,'93.778',$2,$3::date,$4,$5,'REAL',$6)`,
          [fy, NumberOrNull(row.aggregated_amount) || 0, partial ? end : `${fy}-09-30`, partial ? 'PARTIAL' : 'COMPLETE', spec.fromSysId, id],
        );
      }
      const complete = [...rows].filter((row) => Number(row.time_period?.fiscal_year) < fiscalYear).sort((a,b) => Number(b.time_period?.fiscal_year) - Number(a.time_period?.fiscal_year))[0];
      const partial = rows.find((row) => Number(row.time_period?.fiscal_year) === fiscalYear);
      for (const [metricId, label, row, periodStatus] of [
        ['ky-usaspending-latest-complete-fy', `FY${complete?.time_period?.fiscal_year} 93.778 obligations`, complete, 'COMPLETE'],
        ['ky-usaspending-current-partial-fy', `FY${fiscalYear} 93.778 obligations to date`, partial, 'PARTIAL'],
      ] as const) {
        if (!row) continue;
        const value = NumberOrNull(row.aggregated_amount) || 0;
        await this.addMetric(spec, id, {
          id: metricId, label, value, display: compactUsd(value), unit: 'USD', asOf: periodStatus === 'PARTIAL' ? end : `${row.time_period?.fiscal_year}-09-30`, status: 'API_LOADED',
          limitation: 'Federal award obligations are context, not Kentucky state-accounting payment or expenditure truth.',
          action: 'Reconcile fiscal periods and award obligations to official state accounting before variance analysis.',
          provenance: { psaObjectKey: landed.key, programNumber: '93.778', queryWindow: { start, end }, periodStatus },
        }, fetched.finalUri);
      }
      await this.finish(spec, id, rows.length, landed.contentHash, end, `Official USAspending API; ${rows.length} fiscal-year rows for Kentucky and Assistance Listing 93.778; current fiscal year labeled partial.`);
    } catch (error) { await this.fail(id, error); }
  }

  private async loadHospitals() {
    const query = `${config.kyHospitalServiceUri}/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`;
    const spec = { requestId: 'DR-REAL-KY-HOSPITALS', fromSysId: 'KY_OPEN_GIS', sourceUri: query };
    const id = await this.begin(spec);
    try {
      const fetched = await FetchPublicBytes(query, { headers: { Accept: 'application/json' } });
      const landed = await this.land(spec, id, fetched.bytes, 'json', 'licensed-hospitals');
      const json = JSON.parse(fetched.bytes.toString('utf8')) as { features?: Array<{ attributes?: Record<string, unknown> }> };
      const rows = (json.features || []).map((feature) => feature.attributes || {});
      if (rows.length < 100) throw new Error(`Kentucky hospital layer quality gate expected at least 100 rows; received ${rows.length}`);
      await this.client.query(`DELETE FROM bw_dso.dso_hospital_facility WHERE load_class='REAL'`);
      let beds = 0; let critical = 0; let latest = 0;
      const counties = new Set<string>();
      for (const row of rows) {
        const psych = n(row, 'PSYCH_GENERAL') + n(row, 'PSYCH_GERIATRIC') + n(row, 'PSYCH_ADULT') + n(row, 'PSYCH_ADOLESCENT') + n(row, 'PSYCH_CHILD');
        const acute = n(row, 'ACUTE'); const ca = n(row, 'CRITICAL_ACCESS');
        const rehab = n(row, 'ACUTE_REHAB') + n(row, 'REHAB');
        beds += acute + ca + psych + rehab + n(row, 'CHEM_DEPEND') + n(row, 'TB');
        if (ca > 0) critical += 1;
        const county = field(row, 'COUNTY'); if (county) counties.add(county);
        latest = Math.max(latest, n(row, 'DATEMODIFIED'), n(row, 'LAST_UPDT'));
        await this.client.query(
          `INSERT INTO bw_dso.dso_hospital_facility
           (facility_id,facility_name,county_name,license_type,acute_beds,critical_access_beds,
            psychiatric_beds,rehabilitation_beds,license_expiration,source_updated_at,
            from_sys_id,load_class,load_history_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::timestamptz,$11,'REAL',$12)`,
          [`${field(row, 'FACILITYID') || 'facility'}-${field(row, 'OBJECTID') || 'row'}`, field(row, 'FACILITY', 'NAME'), county,
            field(row, 'LIC_TYPE'), acute, ca, psych, rehab,
            latest ? IsoDateOrNull(arcDate(n(row, 'LICENSE_EXP'))) : null,
            arcDate(Math.max(n(row, 'DATEMODIFIED'), n(row, 'LAST_UPDT'))), spec.fromSysId, id],
        );
      }
      const asOf = latest ? new Date(latest).toISOString().slice(0, 10) : today();
      for (const [metricId, label, value, unit] of [
        ['ky-hospital-facilities', 'Kentucky licensed hospital facilities', rows.length, 'facilities'],
        ['ky-hospital-counties', 'Counties represented in hospital layer', counties.size, 'counties'],
        ['ky-hospital-beds', 'Published licensed hospital beds', beds, 'beds'],
        ['ky-hospital-critical-access', 'Facilities with critical-access beds', critical, 'facilities'],
      ] as const) await this.addMetric(spec, id, {
        id: metricId, label, value, display: shown(value), unit, asOf, status: 'API_LOADED',
        limitation: 'Licensed facility and bed context does not establish staffed capacity or Medicaid network adequacy.',
        action: 'Reconcile facilities, service lines, staffed capacity and travel time with DMS network records.',
        provenance: { psaObjectKey: landed.key },
      }, fetched.finalUri);
      await this.finish(spec, id, rows.length, landed.contentHash, asOf, 'Official Kentucky ArcGIS licensed-hospital layer; institutional records only.');
    } catch (error) { await this.fail(id, error); }
  }

  private async loadDocumentPage(spec: Spec, kind: 'budget' | 'contract' | 'transparency', download: boolean) {
    const id = await this.begin(spec);
    try {
      const page = await FetchPublicBytes(spec.sourceUri, { headers: { Accept: 'text/html' } });
      const pageObject = await this.land(spec, id, page.bytes, 'html', `${kind}-index`);
      let links = ExtractDocumentLinks(page.bytes.toString('utf8'), spec.sourceUri);
      if (kind === 'budget') links = links.filter((link) => /2026.?2028|budget in brief|operating budget|capital budget/i.test(`${link.title} ${link.uri}`));
      if (kind === 'contract') links = links.filter((link) => /^CY2026(?!MidYear)/i.test(path.basename(new URL(link.uri).pathname)));
      if (kind === 'transparency') links = [];
      await this.client.query(`DELETE FROM bw_dso.dso_public_document WHERE load_class='REAL' AND from_sys_id=$1`, [spec.fromSysId]);
      let downloaded = 0;
      if (!links.length) await this.client.query(
        `INSERT INTO bw_dso.dso_public_document
         (document_id,title,document_uri,media_type,byte_length,content_hash,publication_period,
          document_status,from_sys_id,as_of_date,load_class,load_history_id)
         VALUES ($1,$2,$3,$4,$5,$6,'','PAGE_MANIFEST',$7,$8::date,'REAL',$9)`,
        [`${kind}-page`, `${kind} official source page`, page.finalUri, page.mediaType,
          pageObject.byteLength, pageObject.contentHash, spec.fromSysId, today(), id],
      );
      for (const [index, link] of links.entries()) {
        let status: 'DOWNLOADED' | 'FAILED' = 'FAILED'; let mediaType = ''; let size = 0; let hash = '';
        if (download) try {
          const file = await FetchPublicBytes(link.uri, {}, 180_000);
          const ext = path.extname(new URL(link.uri).pathname).slice(1) || 'bin';
          const object = await this.land(spec, id, file.bytes, ext, `${kind}-${index + 1}-${link.title}`);
          status = 'DOWNLOADED'; mediaType = file.mediaType; size = object.byteLength; hash = object.contentHash; downloaded += 1;
        } catch { status = 'FAILED'; }
        await this.client.query(
          `INSERT INTO bw_dso.dso_public_document
           (document_id,title,document_uri,media_type,byte_length,content_hash,publication_period,
            document_status,from_sys_id,as_of_date,load_class,load_history_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,'REAL',$11)`,
          [`${kind}-${index + 1}`, link.title, link.uri, mediaType, size, hash,
            kind === 'contract' ? '2026-2027' : '2026-2028', status, spec.fromSysId, today(), id],
        );
      }
      const count = links.length || 1;
      await this.addMetric(spec, id, {
        id: `ky-${kind}-documents`,
        label: kind === 'transparency' ? 'Kentucky Transparency source manifest verified' : `${kind === 'budget' ? 'Budget' : 'Current MCO contract'} documents indexed`,
        value: count, display: kind === 'transparency' ? 'Verified' : shown(count),
        unit: kind === 'transparency' ? 'source' : 'documents', asOf: today(),
        status: kind === 'transparency' ? 'SOURCE_VERIFIED' : 'DOCUMENTS_LOADED',
        limitation: kind === 'transparency'
          ? 'No documented supported bulk analytical API/export is claimed; transaction-grain facts are not fabricated.'
          : 'Document indexing and hashing do not establish extracted dollar or performance facts.',
        action: kind === 'transparency'
          ? 'Obtain a supported export or governed operator extract before vendor/payment analytics.'
          : 'Extract page-cited provisions/tables and reconcile effective versions before analysis.',
        provenance: { psaObjectKey: pageObject.key, indexedLinks: links.length, downloadedDocuments: downloaded },
      }, page.finalUri);
      await this.finish(spec, id, count, pageObject.contentHash, today(), `${links.length} links indexed; ${downloaded} documents downloaded and hashed.`);
    } catch (error) { await this.fail(id, error); }
  }

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    try {
      await this.loadMcpar();
      await this.loadProviders();
      await this.loadLeie();
      await this.loadUsaSpending();
      await this.loadHospitals();
      await this.loadDocumentPage({ requestId: 'DR-REAL-KY-OSBD-DOCS', fromSysId: 'KY_OSBD_BUDGET', sourceUri: config.kyOsbdBudgetDocumentsUri }, 'budget', true);
      await this.loadDocumentPage({ requestId: 'DR-REAL-KY-DMS-CONTRACT-DOCS', fromSysId: 'KY_DMS_MCO_CONTRACTS', sourceUri: config.mcoContractsPageUri }, 'contract', true);
      await this.loadDocumentPage({ requestId: 'DR-REAL-KY-TRANSPARENCY-MANIFEST', fromSysId: 'KY_TRANSPARENCY_SPEND', sourceUri: config.kyTransparencyContractsUri }, 'transparency', false);
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
