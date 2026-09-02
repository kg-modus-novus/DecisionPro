import type pg from 'pg';
import { config } from '../config.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { NumberOrNull, SafeObjectSegment, Sha256 } from '../adapters/operationalPublicSources.js';

type AwardRow = { award_key: string; state_code: string; award_id_display: string };
export type UsaSpendingTransaction = {
  id: string; action_date: string; action_type: string | null; action_type_description: string | null;
  description: string | null; federal_action_obligation: number | null; modification_number: string;
};
type TransactionPage = {
  results: UsaSpendingTransaction[];
  page_metadata: { page: number; hasNext: boolean; next: number | null };
};

export function ParseUsaSpendingTransaction(value: Record<string, unknown>): UsaSpendingTransaction | null {
  const id = String(value.id ?? '');
  const actionDate = String(value.action_date ?? '');
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(actionDate)) return null;
  return {
    id,
    action_date: actionDate,
    action_type: value.action_type == null ? null : String(value.action_type),
    action_type_description: value.action_type_description == null ? null : String(value.action_type_description),
    description: value.description == null ? null : String(value.description),
    federal_action_obligation: NumberOrNull(value.federal_action_obligation),
    modification_number: String(value.modification_number ?? ''),
  };
}

/**
 * Business Action: RetrieveAwardContinuationEvidence (Release B source plane)
 * Captures byte-faithful USAspending transaction pages and normalized action
 * observations. Transaction silence or wording never becomes a continuation
 * decision; assessment remains a separate governed action.
 */
export class RetrieveAwardContinuationEvidence {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  AwardCount = 0;
  PageCount = 0;
  EvidenceCount = 0;
  GapCount = 0;
  private http = new GovernedHttpClient({ requestCeiling: 500 });

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    const loadHistoryId = newId('LH-FRI-TXN');
    const started = new Date();
    try {
      await InsertLoadHistory(this.client, {
        load_history_id: loadHistoryId, data_request_id: 'DR-REAL-USASPENDING-TRANSACTIONS',
        started_at: started, source_uri: config.usaSpendingTransactionsUri, load_class: 'REAL',
      });
      const awards = await this.client.query<AwardRow>(
        `SELECT DISTINCT ON (award_key,state_code) award_key,state_code,award_id_display
         FROM bw_dso.dso_federal_award
         WHERE load_class='REAL' AND period_of_performance_end BETWEEN CURRENT_DATE - INTERVAL '90 days' AND CURRENT_DATE + INTERVAL '365 days'
         ORDER BY award_key,state_code,period_of_performance_end DESC`,
      );
      for (const award of awards.rows) {
        this.AwardCount += 1;
        let page = 1;
        try {
          while (page <= 25) {
            const requestBody = { award_id: award.award_key, page, limit: 5000, sort: 'action_date', order: 'desc' };
            const response = await this.http.FetchJson<TransactionPage>(config.usaSpendingTransactionsUri, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody),
            });
            const contentHash = Sha256(response.bytes);
            const objectKey = `psa/USA_SPENDING/REAL/transactions/${SafeObjectSegment(award.state_code)}/${SafeObjectSegment(award.award_key)}/page-${page}-${contentHash}.json`;
            await psaStore.EnsureRootReady();
            const object = await psaStore.PutObject(objectKey, response.bytes);
            await this.client.query(
              `INSERT INTO bw_psa_meta.object_index (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length)
               VALUES ($1,'USA_SPENDING',$2,'REAL',$3,$4) ON CONFLICT (object_key) DO NOTHING`,
              [objectKey, loadHistoryId, object.contentHash, object.byteLength],
            );
            this.PageCount += 1;
            const rows = Array.isArray(response.json.results) ? response.json.results : [];
            for (let index = 0; index < rows.length; index += 1) {
              const transaction = ParseUsaSpendingTransaction(rows[index] as unknown as Record<string, unknown>);
              if (!transaction) continue;
              const evidenceId = `FRI-TXN-${Sha256(Buffer.from(`${award.award_key}|${transaction.id}|${contentHash}`)).slice(0, 24)}`;
              await this.client.query(
                `INSERT INTO bw_dso.dso_award_continuation_evidence
                 (evidence_id,state_code,award_key,award_id_display,evidence_type,published_status,action_date,amount,
                  source_uri,source_record_ref,psa_object_key,source_field_path,retrieval_metadata,content_hash,
                  reconciliation_status,first_observed_at,last_observed_at,load_class,load_history_id)
                 VALUES ($1,$2,$3,$4,'award-transaction',$5,$6::date,$7,$8,$9,$10,$11,$12::jsonb,$13,'reconciled',$14,$14,'REAL',$15)`,
                [evidenceId, award.state_code, award.award_key, award.award_id_display,
                  transaction.action_type_description || transaction.action_type || 'USAspending transaction action',
                  transaction.action_date, transaction.federal_action_obligation, response.finalUri, transaction.id,
                  objectKey, `results[${index}]`, JSON.stringify({
                    request: { ...requestBody }, pageMetadata: response.json.page_metadata,
                    response: { status: response.status, contentType: response.contentType, etag: response.etag, lastModified: response.lastModified },
                    retrievedAt: started.toISOString(),
                  }),
                  contentHash, started, loadHistoryId],
              );
              this.EvidenceCount += 1;
            }
            if (!response.json.page_metadata?.hasNext) break;
            page = response.json.page_metadata.next || page + 1;
          }
        } catch (error) {
          this.GapCount += 1;
          await this.client.query(
            `INSERT INTO bw_ctl.gap_object (gap_id,title,need,rooms,paid_follow_on,load_history_id)
             VALUES ('GAP-FRI-USASPENDING-TRANSACTIONS','USAspending transaction retrieval incomplete',$1,ARRAY['funding-resilience'],'Retry the governed public-source refresh',$2)
             ON CONFLICT (gap_id) DO UPDATE SET need=EXCLUDED.need,load_history_id=EXCLUDED.load_history_id`,
            [`At least one tracked award transaction page failed. Last valid append-only evidence is preserved. ${error instanceof Error ? error.message : String(error)}`, loadHistoryId],
          );
        }
      }
      await CompleteLoadHistory(this.client, loadHistoryId, {
        status: 'SUCCEEDED', row_count: this.EvidenceCount, as_of_date: started.toISOString().slice(0, 10),
        notes: `${this.AwardCount} deadline awards checked; ${this.PageCount} byte-faithful pages; ${this.EvidenceCount} transaction observations; ${this.GapCount} retrieval gaps. Transactions are evidence, not continuation decisions.`,
      });
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
      try { await CompleteLoadHistory(this.client, loadHistoryId, { status: 'FAILED', notes: this.ErrorMessage }); } catch { /* retain original */ }
    }
  }
}
