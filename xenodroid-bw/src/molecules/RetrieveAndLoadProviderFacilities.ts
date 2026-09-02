import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { ResolveChainLabel } from '../atoms/ChainLabelAtoms.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { FetchPublicBytes, IsoDateOrNull, NumberOrNull, SafeObjectSegment } from '../adapters/operationalPublicSources.js';

function field(row: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    const value = row[name] ?? row[name.toLowerCase()];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}
const n = (row: Record<string, unknown>, ...names: string[]) => NumberOrNull(field(row, ...names)) || 0;

/**
 * Business Action: RetrieveAndLoadProviderFacilities
 * State-neutral CMS Care Compare nursing-facility slice (KY or FL) into
 * bw_dso.dso_provider_facility. Replaces only the given state's rows. The
 * publisher's chain_name is passed through the organization-label rule; an
 * individual owner's name is never written (person-level gate).
 */
export class RetrieveAndLoadProviderFacilities {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  RowCount = 0;
  ChainCount = 0;
  WithheldLabelCount = 0;

  constructor(private client: pg.PoolClient, private state: string) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    const state = this.state.toUpperCase();
    const sourceUri = config.cmsProviderDataStateUri(state);
    const id = newId('LH-PROV');
    await InsertLoadHistory(this.client, {
      load_history_id: id, data_request_id: `DR-REAL-CMS-PROVIDER-${state}`, started_at: new Date(),
      source_uri: sourceUri, load_class: 'REAL',
    });
    try {
      const fetched = await FetchPublicBytes(sourceUri, { headers: { Accept: 'application/json' } });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const key = `psa/CMS_PROVIDER_DATA/REAL/${stamp}/${SafeObjectSegment(`${state.toLowerCase()}-nursing-facilities`)}.json`;
      await psaStore.EnsureRootReady();
      const landed = await psaStore.PutObject(key, fetched.bytes);
      await this.client.query(
        `INSERT INTO bw_psa_meta.object_index (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length) VALUES ($1,'CMS_PROVIDER_DATA',$2,'REAL',$3,$4)`,
        [key, id, landed.contentHash, landed.byteLength],
      );
      const json = JSON.parse(fetched.bytes.toString('utf8')) as { results?: Array<Record<string, unknown>> };
      const rows = json.results || [];
      if (rows.length < 200) throw new Error(`Provider Data quality gate expected at least 200 ${state} rows; received ${rows.length}`);
      await this.client.query(`DELETE FROM bw_dso.dso_provider_facility WHERE load_class='REAL' AND state_code=$1`, [state]);
      const chains = new Set<string>();
      for (const row of rows) {
        const chain = ResolveChainLabel(field(row, 'chain_id'), field(row, 'chain_name'));
        if (chain.chainId) chains.add(chain.chainId);
        if (chain.status === 'withheld_not_organization') this.WithheldLabelCount += 1;
        await this.client.query(
          `INSERT INTO bw_dso.dso_provider_facility
           (ccn,provider_name,county_name,ownership_type,certified_beds,residents_per_day,
            overall_rating,staffing_rating,special_focus_status,number_of_fines,total_fines,
            payment_denials,latitude,longitude,processing_date,from_sys_id,load_class,load_history_id,
            state_code,chain_id,chain_label,chain_label_status,chain_facility_count,changed_ownership_12mo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::date,'CMS_PROVIDER_DATA','REAL',$16,$17,$18,$19,$20,$21,$22)`,
          [field(row, 'cms_certification_number_ccn'), field(row, 'provider_name'),
            field(row, 'countyparish', 'county_parish'), field(row, 'ownership_type'),
            n(row, 'number_of_certified_beds'), n(row, 'average_number_of_residents_per_day'),
            n(row, 'overall_rating'), n(row, 'staffing_rating'), field(row, 'special_focus_status'),
            n(row, 'number_of_fines'), n(row, 'total_amount_of_fines_in_dollars'),
            n(row, 'number_of_payment_denials'), n(row, 'latitude'), n(row, 'longitude'),
            IsoDateOrNull(field(row, 'processing_date')), id,
            state, chain.chainId, chain.label, chain.status, NumberOrNull(field(row, 'number_of_facilities_in_chain')),
            field(row, 'provider_changed_ownership_in_last_12_months').toUpperCase() === 'Y'],
        );
      }
      this.RowCount = rows.length;
      this.ChainCount = chains.size;
      const asOf = rows.map((row) => IsoDateOrNull(field(row, 'processing_date')) || '').sort().at(-1) || new Date().toISOString().slice(0, 10);
      await CompleteLoadHistory(this.client, id, {
        status: 'SUCCEEDED', row_count: rows.length, content_hash: landed.contentHash, as_of_date: asOf,
        notes: `Official CMS Provider Data API ${state} nursing-home slice; ${chains.size} CMS chain ids; ${this.WithheldLabelCount} chain labels withheld (not organization names).`,
      });
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
      await CompleteLoadHistory(this.client, id, { status: 'FAILED', notes: this.ErrorMessage });
    }
  }
}
