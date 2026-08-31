import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { SafeObjectSegment, IsoDateOrNull } from '../adapters/operationalPublicSources.js';
import { NormalizeOrgName } from '../atoms/OrgNameMatching.js';

type FacilityType = 'hospital' | 'snf';
type OwnershipRow = {
  facilityNameRaw: string;
  ownerType: 'individual' | 'organization';
  ownerOrganizationName: string;
  roleText: string;
  percentageOwnership: string;
  associationDate: string | null;
  entityTypeFlags: Record<string, boolean>;
};

const shown = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** Case-insensitive field lookup, matching the pattern proven in OFR-04. */
function field(row: Record<string, unknown>, ...names: string[]): string {
  const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const name of names) {
    const value = lower.get(name.toLowerCase());
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

const YES_FLAGS = [
  ['CORPORATION - OWNER', 'corporation'], ['LLC - OWNER', 'llc'],
  ['HOLDING COMPANY - OWNER', 'holdingCompany'], ['INVESTMENT FIRM - OWNER', 'investmentFirm'],
  ['FOR PROFIT - OWNER', 'forProfit'], ['NON PROFIT - OWNER', 'nonProfit'],
  ['PRIVATE EQUITY COMPANY - OWNER', 'privateEquity'], ['REIT - OWNER', 'reit'],
  ['CHAIN HOME OFFICE - OWNER', 'chainHomeOffice'],
] as const;

/**
 * Business Action: RetrieveAndLoadOwnershipNetwork
 * OFR-05. State-neutral (KY+FL) CMS ownership network for Hospital + SNF
 * facilities already known from OFR-04. Never reads an individual owner's
 * name or personal address into any table — only organization-level owner
 * facts and an owner_type flag. The full raw publisher file is retained in
 * PSA with a content hash for audit.
 */
export class RetrieveAndLoadOwnershipNetwork {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  OwnershipRowCount = 0;
  ChainCount = 0;
  MetricCount = 0;
  MatchedFacilityCount = 0;
  private client_ = new GovernedHttpClient({ requestCeiling: 60 });

  constructor(private client: pg.PoolClient) {}

  private async fetchAllPages(uri: string): Promise<Array<Record<string, unknown>>> {
    const pageSize = 6500;
    const out: Array<Record<string, unknown>> = [];
    for (let offset = 0, page = 1; page <= 20; offset += pageSize, page += 1) {
      const params = new URLSearchParams({ size: String(pageSize), offset: String(offset) });
      const { json } = await this.client_.FetchJson<Array<Record<string, unknown>>>(`${uri}?${params.toString()}`);
      out.push(...json);
      if (json.length < pageSize) break;
    }
    return out;
  }

  private async loadFacilityUniverse(): Promise<Map<string, { ccn: string; state: string; facilityType: FacilityType; facilityName: string }>> {
    const rows = await this.client.query<{ ccn: string; facility_type: FacilityType; state_code: string; facility_name: string }>(
      `SELECT DISTINCT ccn, facility_type, state_code, facility_name FROM bw_dso.dso_facility_cost_report WHERE load_class='REAL'`,
    );
    const map = new Map<string, { ccn: string; state: string; facilityType: FacilityType; facilityName: string }>();
    for (const row of rows.rows) {
      const key = `${row.facility_type}|${NormalizeOrgName(row.facility_name)}`;
      if (!map.has(key)) map.set(key, { ccn: row.ccn, state: row.state_code, facilityType: row.facility_type, facilityName: row.facility_name });
    }
    return map;
  }

  private parseRow(raw: Record<string, unknown>): OwnershipRow {
    const isIndividual = /^i/i.test(field(raw, 'TYPE - OWNER'));
    const flags: Record<string, boolean> = {};
    for (const [column, key] of YES_FLAGS) flags[key] = /^y/i.test(field(raw, column));
    return {
      facilityNameRaw: field(raw, 'ORGANIZATION NAME'),
      ownerType: isIndividual ? 'individual' : 'organization',
      ownerOrganizationName: isIndividual ? '' : field(raw, 'ORGANIZATION NAME - OWNER'),
      roleText: field(raw, 'ROLE TEXT - OWNER'),
      percentageOwnership: field(raw, 'PERCENTAGE OWNERSHIP'),
      associationDate: IsoDateOrNull(field(raw, 'ASSOCIATION DATE - OWNER')),
      entityTypeFlags: flags,
    };
  }

  private async writeOwnershipRows(facilityType: FacilityType, matched: Array<{ ccn: string; state: string; facilityName: string; row: OwnershipRow }>, fromSysId: string, loadHistoryId: string) {
    const BATCH = 300;
    const COLUMNS_PER_ROW = 10;
    for (let i = 0; i < matched.length; i += BATCH) {
      const batch = matched.slice(i, i + BATCH);
      const values: unknown[] = [];
      const placeholders = batch.map((m, position) => {
        const base = position * COLUMNS_PER_ROW;
        values.push(
          m.ccn, facilityType, m.state, m.facilityName, m.row.ownerType, m.row.ownerOrganizationName,
          m.row.roleText, m.row.percentageOwnership, m.row.associationDate, JSON.stringify(m.row.entityTypeFlags),
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9}::date,$${base + 10}::jsonb,'${fromSysId}','REAL','${loadHistoryId}')`;
      });
      await this.client.query(
        `INSERT INTO bw_dso.dso_ownership_interest
         (ccn,facility_type,state_code,facility_name,owner_type,owner_organization_name,role_text,percentage_ownership,association_date,entity_type_flags,from_sys_id,load_class,load_history_id)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (ccn, facility_type, owner_organization_name, role_text, association_date, load_class, load_history_id) DO NOTHING`,
        values,
      );
    }
    this.OwnershipRowCount += matched.length;
  }

  private async addMetric(state: string, fromSysId: string, loadHistoryId: string, metricId: string, label: string, value: number, display: string, unit: string) {
    await this.client.query(
      `INSERT INTO bw_cube.cube_ownership_metric
       (metric_id,state_code,metric_label,numeric_value,display_value,unit,as_of_date,from_sys_id,load_class,load_history_id)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,'REAL',$8)`,
      [metricId, state, label, value, display, unit, fromSysId, loadHistoryId],
    );
    this.MetricCount += 1;
  }

  private async computeChainsAndMetrics(state: string, fromSysId: string, loadHistoryId: string) {
    const orgRows = await this.client.query<{ owner_organization_name: string; ccn: string }>(
      `SELECT DISTINCT owner_organization_name, ccn FROM bw_dso.dso_ownership_interest
       WHERE load_class='REAL' AND state_code=$1 AND owner_type='organization' AND owner_organization_name <> ''`,
      [state],
    );
    const byOwner = new Map<string, Set<string>>();
    for (const row of orgRows.rows) {
      const set = byOwner.get(row.owner_organization_name) || new Set<string>();
      set.add(row.ccn);
      byOwner.set(row.owner_organization_name, set);
    }
    const chains = [...byOwner.entries()].filter(([, ccns]) => ccns.size > 1);
    for (const [ownerName, ccns] of chains) {
      const facilityStats = await this.client.query<{ beds: string | null; margin: string | null }>(
        `SELECT SUM(number_of_beds)::text AS beds, AVG(CASE WHEN total_income<>0 THEN net_income/total_income END)::text AS margin
         FROM bw_dso.dso_facility_cost_report WHERE load_class='REAL' AND state_code=$1 AND ccn = ANY($2::text[])`,
        [state, [...ccns]],
      );
      await this.client.query(
        `INSERT INTO bw_dso.dso_ownership_chain_rollup
         (state_code,owner_organization_name,facility_count,total_beds,avg_total_margin,from_sys_id,load_class,load_history_id)
         VALUES ($1,$2,$3,$4,$5,$6,'REAL',$7)`,
        [state, ownerName, ccns.size, facilityStats.rows[0]?.beds ?? null, facilityStats.rows[0]?.margin ?? null, fromSysId, loadHistoryId],
      );
      this.ChainCount += 1;
    }
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-ownership-chain-count', 'Owner organizations controlling more than one loaded facility', chains.length, shown(chains.length), 'chains');

    const recentCutoff = new Date();
    recentCutoff.setMonth(recentCutoff.getMonth() - 12);
    const churn = await this.client.query<{ c: string }>(
      `SELECT COUNT(DISTINCT ccn)::int AS c FROM bw_dso.dso_ownership_interest
       WHERE load_class='REAL' AND state_code=$1 AND association_date >= $2`,
      [state, recentCutoff.toISOString().slice(0, 10)],
    );
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-ownership-recent-churn-count', 'Facilities with an owner association recorded in the last 12 months (review candidates)', Number(churn.rows[0]?.c || 0), shown(Number(churn.rows[0]?.c || 0)), 'facilities');
  }

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    const spec = { requestId: 'DR-REAL-CMS-OWNERSHIP', fromSysId: 'CMS_OWNERSHIP' };
    try {
      const universe = await this.loadFacilityUniverse();
      if (!universe.size) throw new Error('OFR-05 requires OFR-04 dso_facility_cost_report to be loaded first');

      await this.client.query(`DELETE FROM bw_dso.dso_ownership_interest WHERE load_class='REAL'`);
      await this.client.query(`DELETE FROM bw_dso.dso_ownership_chain_rollup WHERE load_class='REAL'`);
      await this.client.query(`DELETE FROM bw_cube.cube_ownership_metric WHERE load_class='REAL'`);

      for (const [facilityType, uri] of [['hospital', config.cmsOwnershipHospitalUri], ['snf', config.cmsOwnershipSnfUri]] as const) {
        const id = newId('LH-OWNERSHIP');
        await InsertLoadHistory(this.client, {
          load_history_id: id, data_request_id: spec.requestId, started_at: new Date(),
          source_uri: `${uri} (facilityType=${facilityType})`, load_class: 'REAL',
        });
        try {
          const raw = await this.fetchAllPages(uri);
          const bytes = Buffer.from(JSON.stringify(raw));
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const key = `psa/CMS_OWNERSHIP/REAL/${stamp}/${SafeObjectSegment(facilityType)}-all-owners.json`;
          await psaStore.EnsureRootReady();
          const object = await psaStore.PutObject(key, bytes);
          await this.client.query(
            `INSERT INTO bw_psa_meta.object_index (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length)
             VALUES ($1,$2,$3,'REAL',$4,$5)`,
            [key, spec.fromSysId, id, object.contentHash, object.byteLength],
          );

          const matched: Array<{ ccn: string; state: string; facilityName: string; row: OwnershipRow }> = [];
          const matchedFacilities = new Set<string>();
          for (const rawRow of raw) {
            const parsed = this.parseRow(rawRow);
            if (!parsed.facilityNameRaw) continue;
            const key2 = `${facilityType}|${NormalizeOrgName(parsed.facilityNameRaw)}`;
            const facility = universe.get(key2);
            if (!facility) continue;
            matched.push({ ccn: facility.ccn, state: facility.state, facilityName: facility.facilityName, row: parsed });
            matchedFacilities.add(facility.ccn);
          }
          this.MatchedFacilityCount += matchedFacilities.size;
          await this.writeOwnershipRows(facilityType, matched, spec.fromSysId, id);
          await CompleteLoadHistory(this.client, id, {
            status: 'SUCCEEDED', row_count: matched.length, content_hash: object.contentHash,
            as_of_date: new Date().toISOString().slice(0, 10),
            notes: `${raw.length} national ${facilityType} ownership rows fetched; ${matched.length} matched to ${matchedFacilities.size} KY/FL facilities by exact normalized facility name.`,
          });
        } catch (error) {
          await CompleteLoadHistory(this.client, id, { status: 'FAILED', notes: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      }

      const metricLoadHistoryId = newId('LH-OWNERSHIP-METRICS');
      await InsertLoadHistory(this.client, {
        load_history_id: metricLoadHistoryId, data_request_id: spec.requestId, started_at: new Date(),
        source_uri: 'CMS ownership PUFs — computed chain rollups and metrics', load_class: 'REAL',
      });
      for (const state of config.ofrStates) {
        await this.computeChainsAndMetrics(state, spec.fromSysId, metricLoadHistoryId);
      }
      await CompleteLoadHistory(this.client, metricLoadHistoryId, {
        status: 'SUCCEEDED', row_count: this.MetricCount, as_of_date: new Date().toISOString().slice(0, 10),
        notes: `${this.ChainCount} multi-facility ownership chains and ${this.MetricCount} metrics computed.`,
      });

      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
