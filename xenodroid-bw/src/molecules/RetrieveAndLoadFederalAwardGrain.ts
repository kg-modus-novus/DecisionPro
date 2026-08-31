import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { NumberOrNull, IsoDateOrNull, SafeObjectSegment, Sha256 } from '../adapters/operationalPublicSources.js';

type LocationFilter = 'place_of_performance' | 'recipient_location';

type AwardRow = {
  awardKey: string;
  state: string;
  listing: string;
  awardIdDisplay: string;
  recipientName: string;
  recipientUei: string;
  recipientId: string;
  awardAmount: number | null;
  totalOutlays: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  awardingAgency: string;
  awardingSubAgency: string;
  fundingAgency: string;
  locationFilter: LocationFilter;
};

const shown = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
const compactUsd = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
const today = () => new Date().toISOString().slice(0, 10);
const monthsFromNow = (isoDate: string, now: Date) => {
  const end = new Date(`${isoDate}T00:00:00Z`);
  return (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
};

const AWARD_FIELDS = [
  'Award ID', 'Recipient Name', 'recipient_id', 'Award Amount', 'Total Outlays',
  'Start Date', 'End Date', 'Awarding Agency', 'Awarding Sub Agency', 'Funding Agency',
  'recipient_uei', 'generated_internal_id',
];

/**
 * Business Action: RetrieveAndLoadFederalAwardGrain
 * OFR-01. State-neutral USAspending award/recipient-grain retrieval for
 * Kentucky and Florida across the OFR assistance-listing inventory. Never
 * forks logic by state — both states pass through the same loop and the
 * `state` dimension carries the distinction into DSO and cube rows.
 */
export class RetrieveAndLoadFederalAwardGrain {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  StateCount = 0;
  AwardCount = 0;
  MetricCount = 0;
  EmptyCombinations: Array<{ state: string; listing: string }> = [];
  private client_ = new GovernedHttpClient();
  private clearedAwardStates = new Set<string>();
  private clearedMetricStates = new Set<string>();

  constructor(private client: pg.PoolClient) {}

  private async fetchAwardPage(state: string, listing: string, filter: LocationFilter, page: number) {
    const locationKey = filter === 'place_of_performance' ? 'place_of_performance_locations' : 'recipient_locations';
    const body = {
      filters: {
        award_type_codes: ['02', '03', '04', '05'],
        program_numbers: [listing],
        [locationKey]: [{ country: 'USA', state }],
        time_period: [{ start_date: config.ofrAwardGrainWindowStart, end_date: today() }],
      },
      fields: AWARD_FIELDS,
      sort: 'Award Amount',
      order: 'desc',
      limit: 100,
      page,
    };
    const { json } = await this.client_.FetchJson<{
      results: Array<Record<string, unknown>>;
      page_metadata: { hasNext: boolean };
    }>(config.usaSpendingAwardSearchUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return json;
  }

  private async fetchAllAwards(state: string, listing: string): Promise<AwardRow[]> {
    const byKey = new Map<string, AwardRow>();
    for (const filter of ['place_of_performance', 'recipient_location'] as LocationFilter[]) {
      for (let page = 1; page <= 25; page += 1) {
        const json = await this.fetchAwardPage(state, listing, filter, page);
        for (const row of json.results || []) {
          const key = String(row.generated_internal_id || row['Award ID'] || '');
          if (!key || byKey.has(key)) continue;
          byKey.set(key, {
            awardKey: key,
            state,
            listing,
            awardIdDisplay: String(row['Award ID'] ?? ''),
            recipientName: String(row['Recipient Name'] ?? ''),
            recipientUei: String(row.recipient_uei ?? ''),
            recipientId: String(row.recipient_id ?? ''),
            awardAmount: NumberOrNull(row['Award Amount']),
            totalOutlays: NumberOrNull(row['Total Outlays']),
            periodStart: IsoDateOrNull(row['Start Date']),
            periodEnd: IsoDateOrNull(row['End Date']),
            awardingAgency: String(row['Awarding Agency'] ?? ''),
            awardingSubAgency: String(row['Awarding Sub Agency'] ?? ''),
            fundingAgency: String(row['Funding Agency'] ?? ''),
            locationFilter: filter,
          });
        }
        if (!json.page_metadata?.hasNext) break;
      }
    }
    return [...byKey.values()];
  }

  private async loadState(state: string) {
    const spec = {
      requestId: 'DR-REAL-USASPENDING-AWARD-GRAIN',
      fromSysId: 'USA_SPENDING',
      sourceUri: config.usaSpendingAwardSearchUri,
    };
    const stateAwards: AwardRow[] = [];
    for (const listing of config.ofrAssistanceListings) {
      const id = newId('LH-AWARD');
      await InsertLoadHistory(this.client, {
        load_history_id: id,
        data_request_id: spec.requestId,
        started_at: new Date(),
        source_uri: `${spec.sourceUri} (program_numbers=${listing.code}, state=${state})`,
        load_class: 'REAL',
      });
      try {
        const awards = await this.fetchAllAwards(state, listing.code);
        const raw = Buffer.from(JSON.stringify(awards, null, 2));
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const key = `psa/USA_SPENDING/REAL/${stamp}/award-grain-${SafeObjectSegment(state)}-${SafeObjectSegment(listing.code)}.json`;
        await psaStore.EnsureRootReady();
        const object = await psaStore.PutObject(key, raw);
        await this.client.query(
          `INSERT INTO bw_psa_meta.object_index
           (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length)
           VALUES ($1,$2,$3,'REAL',$4,$5)`,
          [key, spec.fromSysId, id, object.contentHash, object.byteLength],
        );
        if (!awards.length) this.EmptyCombinations.push({ state, listing: listing.code });
        stateAwards.push(...awards);
        await CompleteLoadHistory(this.client, id, {
          status: 'SUCCEEDED',
          row_count: awards.length,
          content_hash: object.contentHash,
          as_of_date: today(),
          notes: awards.length
            ? `${awards.length} award-grain rows merged from place-of-performance and recipient-location USAspending queries.`
            : 'USAspending returned no award-grain records for this state/listing/window via either location filter (recorded, not fabricated).',
        });
      } catch (error) {
        await CompleteLoadHistory(this.client, id, {
          status: 'FAILED',
          notes: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    if (!this.clearedAwardStates.has(state)) {
      await this.client.query(`DELETE FROM bw_dso.dso_federal_award WHERE state_code=$1 AND load_class='REAL'`, [state]);
      this.clearedAwardStates.add(state);
    }
    const latestLoadHistoryId = newId('LH-AWARD-DSO');
    await InsertLoadHistory(this.client, {
      load_history_id: latestLoadHistoryId,
      data_request_id: spec.requestId,
      started_at: new Date(),
      source_uri: `${spec.sourceUri} (state=${state}, dso-write)`,
      load_class: 'REAL',
    });
    for (const award of stateAwards) {
      await this.client.query(
        `INSERT INTO bw_dso.dso_federal_award
         (award_key,state_code,assistance_listing,award_id_display,recipient_name,recipient_uei,recipient_id,
          award_amount,total_outlays,period_of_performance_start,period_of_performance_end,
          awarding_agency,awarding_sub_agency,funding_agency,location_filter,from_sys_id,load_class,load_history_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,$12,$13,$14,$15,$16,'REAL',$17)
         ON CONFLICT (award_key, load_class, load_history_id) DO NOTHING`,
        [award.awardKey, award.state, award.listing, award.awardIdDisplay, award.recipientName,
          award.recipientUei, award.recipientId, award.awardAmount, award.totalOutlays,
          award.periodStart, award.periodEnd, award.awardingAgency, award.awardingSubAgency,
          award.fundingAgency, award.locationFilter, spec.fromSysId, latestLoadHistoryId],
      );
    }
    await CompleteLoadHistory(this.client, latestLoadHistoryId, {
      status: 'SUCCEEDED', row_count: stateAwards.length, as_of_date: today(),
      notes: `${stateAwards.length} deduplicated award-grain rows across ${config.ofrAssistanceListings.length} assistance listings.`,
    });
    this.AwardCount += stateAwards.length;
    await this.computeMetrics(state, stateAwards, spec.fromSysId, latestLoadHistoryId);
    this.StateCount += 1;
  }

  private async addMetric(
    state: string, fromSysId: string, loadHistoryId: string,
    metricId: string, label: string, value: number, display: string, unit: string,
    provenance: Record<string, unknown>,
  ) {
    if (!this.clearedMetricStates.has(state)) {
      await this.client.query(
        `DELETE FROM bw_cube.cube_federal_award_metric WHERE state_code=$1 AND load_class='REAL'`, [state],
      );
      this.clearedMetricStates.add(state);
    }
    await this.client.query(
      `INSERT INTO bw_cube.cube_federal_award_metric
       (metric_id,state_code,metric_label,numeric_value,display_value,unit,source_status,
        from_sys_id,as_of_date,load_class,load_history_id,provenance_json)
       VALUES ($1,$2,$3,$4,$5,$6,'API_LOADED',$7,$8::date,'REAL',$9,$10::jsonb)`,
      [metricId, state, label, value, display, unit, fromSysId, today(), loadHistoryId, JSON.stringify(provenance)],
    );
    this.MetricCount += 1;
  }

  private async computeMetrics(state: string, awards: AwardRow[], fromSysId: string, loadHistoryId: string) {
    const totalAmount = awards.reduce((sum, a) => sum + (a.awardAmount || 0), 0);
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-award-count', 'Federal award-grain records loaded', awards.length, shown(awards.length), 'awards', { listings: config.ofrAssistanceListings.map((l) => l.code) });
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-award-total-amount', 'Federal award-grain obligated amount (cumulative, tracked listings)', totalAmount, compactUsd(totalAmount), 'USD', {});

    const now = new Date();
    const buckets: Array<[string, string, number, number]> = [
      ['0-6mo', '0–6 months', 0, 6],
      ['6-12mo', '6–12 months', 6, 12],
      ['12-24mo', '12–24 months', 12, 24],
    ];
    for (const [bucketId, bucketLabel, lo, hi] of buckets) {
      const inBucket = awards.filter((a) => {
        if (!a.periodEnd) return false;
        const m = monthsFromNow(a.periodEnd, now);
        return m >= 0 && m >= lo && m < hi;
      });
      const amount = inBucket.reduce((sum, a) => sum + (a.awardAmount || 0), 0);
      await this.addMetric(state, fromSysId, loadHistoryId, `ofr-award-cliff-${bucketId}-count`, `Awards with period of performance ending in ${bucketLabel}`, inBucket.length, shown(inBucket.length), 'awards', { bucket: bucketLabel, note: 'Federal funding cliff calendar review window, not a lapse prediction.' });
      await this.addMetric(state, fromSysId, loadHistoryId, `ofr-award-cliff-${bucketId}-amount`, `Award amount ending in ${bucketLabel}`, amount, compactUsd(amount), 'USD', { bucket: bucketLabel });
    }

    const byRecipient = new Map<string, { listings: Set<string>; total: number }>();
    for (const a of awards) {
      const key = a.recipientName.trim().toUpperCase() || 'UNKNOWN RECIPIENT';
      const entry = byRecipient.get(key) || { listings: new Set<string>(), total: 0 };
      entry.listings.add(a.listing);
      entry.total += a.awardAmount || 0;
      byRecipient.set(key, entry);
    }
    const singleStream = [...byRecipient.entries()].filter(([, v]) => v.listings.size === 1);
    const singleStreamAmount = singleStream.reduce((sum, [, v]) => sum + v.total, 0);
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-award-single-stream-recipients', 'Recipients funded by exactly one tracked assistance listing', singleStream.length, shown(singleStream.length), 'organizations', {
      note: 'Review candidate only: a single tracked listing does not establish that this is a recipient\'s only funding source overall.',
    });
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-award-single-stream-amount', 'Award amount concentrated in single-listing recipients', singleStreamAmount, compactUsd(singleStreamAmount), 'USD', {});
  }

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    try {
      for (const state of config.ofrStates) {
        await this.loadState(state);
      }
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
