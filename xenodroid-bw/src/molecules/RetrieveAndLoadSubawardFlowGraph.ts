import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';
import { NormalizeOrgName } from '../atoms/OrgNameMatching.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { SafeObjectSegment } from '../adapters/operationalPublicSources.js';

type SubawardRow = {
  subawardId: string;
  primeAwardKey: string;
  state: string;
  assistanceListing: string;
  primeRecipientName: string;
  subRecipientName: string;
  subAwardNumber: string;
  description: string;
  actionDate: string | null;
  amount: number | null;
};

const shown = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/**
 * Business Action: RetrieveAndLoadSubawardFlowGraph
 * OFR-06. State-neutral (KY+FL) sub-award flow graph built from the OFR-01
 * prime-award universe. Every funding_edge carries an explicit
 * identity_confidence: 'exact-derived' only when the sub-recipient name
 * exactly matches an OFR-02 crosswalk identity record, 'unresolved'
 * otherwise — never silently treated as resolved.
 */
export class RetrieveAndLoadSubawardFlowGraph {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  PrimeAwardsQueried = 0;
  SubawardCount = 0;
  EdgeCount = 0;
  ResolvedEdgeCount = 0;
  MetricCount = 0;
  private client_ = new GovernedHttpClient({ requestCeiling: 500, minDelayMs: 800 });

  constructor(private client: pg.PoolClient) {}

  private async fetchSubawards(awardKey: string): Promise<Array<{ id: number; subaward_number: string; description: string; action_date: string; amount: number; recipient_name: string }>> {
    const out: Array<{ id: number; subaward_number: string; description: string; action_date: string; amount: number; recipient_name: string }> = [];
    for (let page = 1; page <= 5; page += 1) {
      const { json } = await this.client_.FetchJson<{
        page_metadata: { hasNext: boolean };
        results: Array<{ id: number; subaward_number: string; description: string; action_date: string; amount: number; recipient_name: string }>;
      }>(config.usaSpendingSubawardsUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ award_id: awardKey, limit: 100, page }),
      });
      out.push(...(json.results || []));
      if (!json.page_metadata?.hasNext) break;
    }
    return out;
  }

  private async loadIdentityIndex(): Promise<Map<string, { ein: string }>> {
    const rows = await this.client.query<{ normalized_name: string; identifier_value: string }>(
      `SELECT normalized_name, identifier_value FROM bw_dso.dso_identity_record
       WHERE load_class='REAL' AND identifier_type='EIN'`,
    );
    const map = new Map<string, { ein: string }>();
    for (const row of rows.rows) if (!map.has(row.normalized_name)) map.set(row.normalized_name, { ein: row.identifier_value });
    return map;
  }

  private async writeSubawardsAndEdges(rows: SubawardRow[], identityIndex: Map<string, { ein: string }>, fromSysId: string, loadHistoryId: string) {
    const BATCH = 300;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values: unknown[] = [];
      const placeholders = batch.map((r, position) => {
        const base = position * 10;
        values.push(r.subawardId, r.primeAwardKey, r.state, r.assistanceListing, r.primeRecipientName, r.subRecipientName, r.subAwardNumber, r.description, r.actionDate, r.amount);
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9}::date,$${base + 10},'${fromSysId}','REAL','${loadHistoryId}')`;
      });
      await this.client.query(
        `INSERT INTO bw_dso.dso_federal_subaward
         (subaward_id,prime_award_key,state_code,assistance_listing,prime_recipient_name,sub_recipient_name,sub_award_number,description,action_date,amount,from_sys_id,load_class,load_history_id)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (subaward_id, load_class, load_history_id) DO NOTHING`,
        values,
      );
    }
    this.SubawardCount += rows.length;

    const edgeValues: unknown[] = [];
    const edgePlaceholders = rows.map((r, position) => {
      const base = position * 9;
      const identity = identityIndex.get(NormalizeOrgName(r.subRecipientName));
      const confidence = identity ? 'exact-derived' : 'unresolved';
      if (identity) this.ResolvedEdgeCount += 1;
      edgeValues.push(`XW-EDGE-${r.subawardId}`, r.state, r.primeRecipientName, r.subRecipientName, r.amount, r.actionDate, r.assistanceListing, confidence, identity?.ein ?? null);
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6}::date,$${base + 7},$${base + 8},$${base + 9},'${fromSysId}','REAL','${loadHistoryId}')`;
    });
    if (edgePlaceholders.length) {
      await this.client.query(
        `INSERT INTO bw_dso.dso_funding_edge
         (edge_id,state_code,source_org,recipient_org,amount,action_date,assistance_listing,identity_confidence,recipient_ein,from_sys_id,load_class,load_history_id)
         VALUES ${edgePlaceholders.join(',')}
         ON CONFLICT (edge_id, load_class, load_history_id) DO NOTHING`,
        edgeValues,
      );
      this.EdgeCount += edgePlaceholders.length;
    }
  }

  private async addMetric(state: string, fromSysId: string, loadHistoryId: string, metricId: string, label: string, value: number, display: string, unit: string) {
    await this.client.query(
      `INSERT INTO bw_cube.cube_subaward_metric
       (metric_id,state_code,metric_label,numeric_value,display_value,unit,as_of_date,from_sys_id,load_class,load_history_id)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,'REAL',$8)`,
      [metricId, state, label, value, display, unit, fromSysId, loadHistoryId],
    );
    this.MetricCount += 1;
  }

  private async computeStateMetrics(state: string, fromSysId: string, loadHistoryId: string) {
    const edges = await this.client.query<{ recipient_org: string; amount: string | null; assistance_listing: string; identity_confidence: string }>(
      `SELECT recipient_org, amount::text, assistance_listing, identity_confidence FROM bw_dso.dso_funding_edge WHERE load_class='REAL' AND state_code=$1`,
      [state],
    );
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-subaward-edge-count', 'Sub-award funding edges loaded', edges.rows.length, shown(edges.rows.length), 'edges');

    const resolved = edges.rows.filter((e) => e.identity_confidence === 'exact-derived');
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-subaward-resolved-edge-count', 'Funding edges with a crosswalk-reconciled recipient identity', resolved.length, shown(resolved.length), 'edges');

    const totalResolvedAmount = resolved.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const byRecipient = new Map<string, number>();
    for (const e of resolved) byRecipient.set(e.recipient_org, (byRecipient.get(e.recipient_org) || 0) + (Number(e.amount) || 0));
    const topAmount = Math.max(0, ...byRecipient.values());
    const concentration = totalResolvedAmount > 0 ? topAmount / totalResolvedAmount : 0;
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-subaward-top-recipient-concentration', 'Top sub-recipient share of identity-resolved sub-award dollars', concentration, pct(concentration), 'percent');

    const listingsByRecipient = new Map<string, Set<string>>();
    for (const e of edges.rows) {
      const set = listingsByRecipient.get(e.recipient_org) || new Set<string>();
      set.add(e.assistance_listing);
      listingsByRecipient.set(e.recipient_org, set);
    }
    const overlapCount = [...listingsByRecipient.values()].filter((s) => s.size > 1).length;
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-subaward-program-overlap-count', 'Sub-recipients receiving funding under more than one OFR-tracked assistance listing', overlapCount, shown(overlapCount), 'organizations');
  }

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    const spec = { requestId: 'DR-REAL-USASPENDING-SUBAWARDS', fromSysId: 'USA_SPENDING' };
    try {
      const primeAwards = await this.client.query<{ award_key: string; state_code: string; assistance_listing: string; recipient_name: string }>(
        `SELECT award_key, state_code, assistance_listing, recipient_name FROM bw_dso.dso_federal_award WHERE load_class='REAL'`,
      );
      const identityIndex = await this.loadIdentityIndex();

      await this.client.query(`DELETE FROM bw_dso.dso_federal_subaward WHERE load_class='REAL'`);
      await this.client.query(`DELETE FROM bw_dso.dso_funding_edge WHERE load_class='REAL'`);
      await this.client.query(`DELETE FROM bw_cube.cube_subaward_metric WHERE load_class='REAL'`);

      const id = newId('LH-SUBAWARD');
      await InsertLoadHistory(this.client, {
        load_history_id: id, data_request_id: spec.requestId, started_at: new Date(),
        source_uri: config.usaSpendingSubawardsUri, load_class: 'REAL',
      });
      try {
        const allSubawards: SubawardRow[] = [];
        const rawByPrime: Record<string, unknown> = {};
        for (const prime of primeAwards.rows) {
          this.PrimeAwardsQueried += 1;
          const subs = await this.fetchSubawards(prime.award_key);
          if (subs.length) rawByPrime[prime.award_key] = subs;
          for (const sub of subs) {
            allSubawards.push({
              subawardId: String(sub.id), primeAwardKey: prime.award_key, state: prime.state_code,
              assistanceListing: prime.assistance_listing, primeRecipientName: prime.recipient_name,
              subRecipientName: sub.recipient_name || '', subAwardNumber: sub.subaward_number || '',
              description: (sub.description || '').slice(0, 500), actionDate: sub.action_date || null,
              amount: typeof sub.amount === 'number' ? sub.amount : null,
            });
          }
        }

        const bytes = Buffer.from(JSON.stringify(rawByPrime));
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const key = `psa/USA_SPENDING/REAL/${stamp}/${SafeObjectSegment('subawards-by-prime-award')}.json`;
        await psaStore.EnsureRootReady();
        const object = await psaStore.PutObject(key, bytes);
        await this.client.query(
          `INSERT INTO bw_psa_meta.object_index (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length)
           VALUES ($1,$2,$3,'REAL',$4,$5)`,
          [key, spec.fromSysId, id, object.contentHash, object.byteLength],
        );

        await this.writeSubawardsAndEdges(allSubawards, identityIndex, spec.fromSysId, id);
        await CompleteLoadHistory(this.client, id, {
          status: 'SUCCEEDED', row_count: allSubawards.length, content_hash: object.contentHash, as_of_date: new Date().toISOString().slice(0, 10),
          notes: `${this.PrimeAwardsQueried} prime awards queried; ${allSubawards.length} subawards found; ${this.ResolvedEdgeCount} of ${this.EdgeCount} funding edges identity-resolved via the OFR-02 crosswalk.`,
        });
      } catch (error) {
        await CompleteLoadHistory(this.client, id, { status: 'FAILED', notes: error instanceof Error ? error.message : String(error) });
        throw error;
      }

      const metricLoadHistoryId = newId('LH-SUBAWARD-METRICS');
      await InsertLoadHistory(this.client, {
        load_history_id: metricLoadHistoryId, data_request_id: spec.requestId, started_at: new Date(),
        source_uri: 'USAspending subawards — computed concentration/overlap metrics', load_class: 'REAL',
      });
      for (const state of config.ofrStates) {
        await this.computeStateMetrics(state, spec.fromSysId, metricLoadHistoryId);
      }
      await CompleteLoadHistory(this.client, metricLoadHistoryId, {
        status: 'SUCCEEDED', row_count: this.MetricCount, as_of_date: new Date().toISOString().slice(0, 10),
        notes: `${this.MetricCount} metrics computed.`,
      });

      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
