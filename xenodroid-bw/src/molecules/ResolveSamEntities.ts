import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { RedactCredentialedUri } from '../atoms/GovernedHttpClient.js';
import { NormalizeAddressLine, NormalizeOrgName, TokenSetSimilarity } from '../atoms/OrgNameMatching.js';

/**
 * Business Action: ResolveSamEntities
 *
 * Persisted, resumable SAM.gov Entity Management lookups for every UEI in
 * the OFR award grain. The public key tier answers a short burst and then
 * returns HTTP 429 for the rest of its window, which is why the crosswalk's
 * one-shot SAM stage resolved zero entities. This action:
 *  - reads the UEIs still unresolved (or last seen rate-limited) from
 *    bw_ctl.sam_entity_resolution,
 *  - queries SAM serially, honoring Retry-After and backing off
 *    exponentially, and stops for the run after a bounded number of
 *    consecutive rate-limit responses (the remainder resumes next run),
 *  - persists every outcome (resolved / not_found / rate_limited / failed),
 *  - writes SAM_ENTITY identity records for newly resolved UEIs, recomputes
 *    the SAM-vs-USAspending disagreement queue for them, and refreshes the
 *    two SAM crosswalk metrics.
 * The key comes from the runtime environment only; it is never stored,
 * logged, or included in any error text (RedactCredentialedUri).
 */

type UeiRow = { uei: string; state_code: string; recipient_name: string; outcome: string | null; attempts: number | null };
type SamEntity = {
  entityRegistration?: { ueiSAM?: string; legalBusinessName?: string; registrationStatus?: string };
  coreData?: { physicalAddress?: { addressLine1?: string; city?: string; zipCode?: string } };
};

const RATE_LIMIT_STOP_STREAK = 3;
const MIN_DELAY_MS = 2500;
const MAX_LOOKUPS_PER_RUN = 150;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class ResolveSamEntities {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Candidates = 0;
  Attempted = 0;
  Resolved = 0;
  NotFound = 0;
  RateLimited = 0;
  Failed = 0;
  DisagreementsWritten = 0;
  StoppedReason = '';

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    const key = process.env.SAM_GOV_API_KEY;
    if (!key) {
      this.Status = 'FAILED';
      this.ErrorMessage = 'SAM_GOV_API_KEY not present in the runtime environment; nothing attempted (no account creation, no key registration).';
      return;
    }
    const loadHistoryId = newId('LH-SAM');
    await InsertLoadHistory(this.client, {
      load_history_id: loadHistoryId, data_request_id: 'DR-REAL-SAM-RESOLVE', started_at: new Date(),
      source_uri: RedactCredentialedUri(config.samEntityApiUri), load_class: 'REAL',
    });
    try {
      // UEI universe: the award grain (where the search API returned a UEI)
      // plus the USAspending recipient identity records the crosswalk loaded
      // (the search API omits recipient_uei on most award rows, so the
      // identity table is the fuller list).
      const candidates = await this.client.query<UeiRow>(
        `WITH universe AS (
           SELECT recipient_uei AS uei, state_code, recipient_name FROM bw_dso.dso_federal_award WHERE load_class='REAL' AND recipient_uei <> ''
           UNION
           SELECT identifier_value AS uei, state_code, org_name AS recipient_name FROM bw_dso.dso_identity_record
           WHERE load_class='REAL' AND from_sys_id='USA_SPENDING' AND identifier_type='UEI' AND identifier_value <> ''
         )
         SELECT DISTINCT ON (u.uei, u.state_code) u.uei, u.state_code, u.recipient_name, r.outcome, r.attempts
         FROM universe u
         LEFT JOIN bw_ctl.sam_entity_resolution r ON r.uei=u.uei AND r.state_code=u.state_code
         WHERE r.outcome IS NULL OR r.outcome IN ('rate_limited','failed')
         ORDER BY u.uei, u.state_code`,
      );
      this.Candidates = candidates.rows.length;
      let streak = 0;
      let delay = MIN_DELAY_MS;
      const resolvedNow: Array<{ uei: string; state: string; entity: SamEntity }> = [];
      for (const row of candidates.rows) {
        if (this.Attempted >= MAX_LOOKUPS_PER_RUN) { this.StoppedReason = `per-run lookup ceiling (${MAX_LOOKUPS_PER_RUN}) reached`; break; }
        if (streak >= RATE_LIMIT_STOP_STREAK) { this.StoppedReason = `${RATE_LIMIT_STOP_STREAK} consecutive HTTP 429 responses; remaining UEIs resume next run`; break; }
        await sleep(delay);
        this.Attempted += 1;
        const attempts = (row.attempts || 0) + 1;
        const uri = `${config.samEntityApiUri}?ueiSAM=${encodeURIComponent(row.uei)}&api_key=${encodeURIComponent(key)}`;
        let status = 0;
        let detail = '';
        let outcome: 'resolved' | 'not_found' | 'rate_limited' | 'failed' = 'failed';
        let entity: SamEntity | null = null;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30_000);
          const response = await fetch(uri, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'DecisionPro-XenoDroid-BW/1.0 (+https://decisionpro.io/research)' } });
          clearTimeout(timer);
          status = response.status;
          if (response.status === 429) {
            outcome = 'rate_limited';
            const retryAfter = Number(response.headers.get('retry-after') || 0);
            detail = `HTTP 429${retryAfter ? `; Retry-After ${retryAfter}s` : ''}`;
            streak += 1;
            delay = Math.min(60_000, Math.max(delay * 2, retryAfter * 1000));
          } else if (!response.ok) {
            outcome = 'failed';
            detail = `HTTP ${response.status}`;
            streak = 0;
          } else {
            const json = await response.json() as { totalRecords?: number; entityData?: SamEntity[] };
            entity = json.entityData?.[0] || null;
            if (entity?.entityRegistration?.ueiSAM) {
              outcome = 'resolved';
              detail = 'entity registration returned';
              resolvedNow.push({ uei: row.uei, state: row.state_code, entity });
            } else {
              outcome = 'not_found';
              detail = `no entity registration for this UEI (totalRecords=${json.totalRecords ?? 0})`;
            }
            streak = 0;
            delay = MIN_DELAY_MS;
          }
        } catch (error) {
          outcome = 'failed';
          detail = RedactCredentialedUri(error instanceof Error ? error.message : String(error));
          streak = 0;
        }
        if (outcome === 'resolved') this.Resolved += 1;
        else if (outcome === 'not_found') this.NotFound += 1;
        else if (outcome === 'rate_limited') this.RateLimited += 1;
        else this.Failed += 1;
        await this.client.query(
          `INSERT INTO bw_ctl.sam_entity_resolution
           (uei,state_code,outcome,legal_business_name,registration_status,address_line1,city,zip,http_status,attempts,detail,attempted_at,resolved_at,load_history_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12,$13)
           ON CONFLICT (uei, state_code) DO UPDATE SET
             outcome=EXCLUDED.outcome, legal_business_name=EXCLUDED.legal_business_name, registration_status=EXCLUDED.registration_status,
             address_line1=EXCLUDED.address_line1, city=EXCLUDED.city, zip=EXCLUDED.zip, http_status=EXCLUDED.http_status,
             attempts=EXCLUDED.attempts, detail=EXCLUDED.detail, attempted_at=NOW(), resolved_at=EXCLUDED.resolved_at, load_history_id=EXCLUDED.load_history_id`,
          [row.uei, row.state_code, outcome,
            entity?.entityRegistration?.legalBusinessName || null, entity?.entityRegistration?.registrationStatus || null,
            entity?.coreData?.physicalAddress?.addressLine1 || null, entity?.coreData?.physicalAddress?.city || null, entity?.coreData?.physicalAddress?.zipCode || null,
            status || null, attempts, detail, outcome === 'resolved' ? new Date() : null, loadHistoryId],
        );
      }

      await this.publishResolvedIdentities(loadHistoryId);

      await CompleteLoadHistory(this.client, loadHistoryId, {
        status: 'SUCCEEDED', row_count: this.Attempted, content_hash: '', as_of_date: new Date().toISOString().slice(0, 10),
        notes: `SAM resolve: candidates=${this.Candidates} attempted=${this.Attempted} resolved=${this.Resolved} notFound=${this.NotFound} rateLimited=${this.RateLimited} failed=${this.Failed}${this.StoppedReason ? `; stopped: ${this.StoppedReason}` : ''}`,
      });
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = RedactCredentialedUri(error instanceof Error ? error.message : String(error));
      await CompleteLoadHistory(this.client, loadHistoryId, { status: 'FAILED', notes: this.ErrorMessage });
    }
  }

  /**
   * Every resolved UEI (this run or earlier) becomes a SAM_ENTITY identity
   * record if one is not already present, and its SAM-vs-USAspending name
   * comparison is (re)computed. Existing crosswalk assertions are untouched:
   * SAM supplies the registrar's legal name, not a new match method.
   */
  private async publishResolvedIdentities(loadHistoryId: string) {
    const resolved = await this.client.query<{ uei: string; state_code: string; legal_business_name: string; registration_status: string | null; address_line1: string | null; city: string | null; zip: string | null }>(
      `SELECT r.uei, r.state_code, r.legal_business_name, r.registration_status, r.address_line1, r.city, r.zip
       FROM bw_ctl.sam_entity_resolution r
       WHERE r.outcome='resolved' AND r.legal_business_name IS NOT NULL`,
    );
    for (const state of config.ofrStates) {
      const rows = resolved.rows.filter((r) => r.state_code === state);
      const existing = await this.client.query<{ identifier_value: string }>(
        `SELECT identifier_value FROM bw_dso.dso_identity_record WHERE load_class='REAL' AND state_code=$1 AND from_sys_id='SAM_ENTITY'`, [state],
      );
      const have = new Set(existing.rows.map((r) => r.identifier_value));
      for (const r of rows) {
        if (have.has(r.uei)) continue;
        await this.client.query(
          `INSERT INTO bw_dso.dso_identity_record
           (source_row_id,state_code,identifier_type,identifier_value,org_name,normalized_name,address_line1,city,zip,extra_json,from_sys_id,load_class,load_history_id)
           VALUES ($1,$2,'UEI',$3,$4,$5,$6,$7,$8,$9::jsonb,'SAM_ENTITY','REAL',$10)
           ON CONFLICT (source_row_id, load_class, load_history_id) DO NOTHING`,
          [`SAM_ENTITY-${state}-${r.uei}`, state, r.uei, r.legal_business_name, NormalizeOrgName(r.legal_business_name),
            NormalizeAddressLine(r.address_line1 || ''), r.city || '', r.zip || '', JSON.stringify({ registrationStatus: r.registration_status || '' }), loadHistoryId],
        );
      }
      // Disagreement queue for every resolved UEI in this state, recomputed
      // against the USAspending recipient name already in the identity table.
      const usa = await this.client.query<{ identifier_value: string; org_name: string }>(
        `SELECT DISTINCT ON (identifier_value) identifier_value, org_name FROM bw_dso.dso_identity_record
         WHERE load_class='REAL' AND state_code=$1 AND from_sys_id='USA_SPENDING' AND identifier_type='UEI'
         ORDER BY identifier_value, load_history_id DESC`, [state],
      );
      const usaByUei = new Map(usa.rows.map((r) => [r.identifier_value, r.org_name]));
      await this.client.query(`DELETE FROM bw_ctl.organization_crosswalk_disagreement WHERE load_class='REAL' AND state_code=$1 AND uei = ANY($2::text[])`, [state, rows.map((r) => r.uei)]);
      let seq = 0;
      for (const r of rows) {
        const usaName = usaByUei.get(r.uei);
        if (!usaName) continue;
        const similarity = TokenSetSimilarity(NormalizeOrgName(r.legal_business_name), NormalizeOrgName(usaName));
        if (similarity >= 0.9) continue;
        seq += 1;
        await this.client.query(
          `INSERT INTO bw_ctl.organization_crosswalk_disagreement
           (disagreement_id,state_code,uei,sam_name,usaspending_name,similarity_score,from_sys_ids,load_class,load_history_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'REAL',$8)`,
          [`XW-DIS-SAM-${state}-${r.uei}`, state, r.uei, r.legal_business_name, usaName, similarity, ['SAM_ENTITY', 'USA_SPENDING'], loadHistoryId],
        );
        this.DisagreementsWritten += 1;
      }
      const openDisagreements = await this.client.query<{ n: string }>(
        `SELECT COUNT(DISTINCT uei)::text AS n FROM bw_ctl.organization_crosswalk_disagreement WHERE load_class='REAL' AND state_code=$1`, [state],
      );
      for (const [metricId, label, value, unit] of [
        ['ofr-crosswalk-sam-coverage', 'UEIs resolved via SAM.gov (primary authority)', rows.length, 'entities'],
        ['ofr-crosswalk-disagreements', 'SAM vs USAspending name disagreements (open review queue)', Number(openDisagreements.rows[0]?.n || 0), 'disagreements'],
      ] as Array<[string, string, number, string]>) {
        await this.client.query(`DELETE FROM bw_cube.cube_crosswalk_metric WHERE load_class='REAL' AND state_code=$1 AND metric_id=$2`, [state, metricId]);
        await this.client.query(
          `INSERT INTO bw_cube.cube_crosswalk_metric
           (metric_id,state_code,metric_label,numeric_value,display_value,unit,as_of_date,from_sys_id,load_class,load_history_id)
           VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,'SAM_ENTITY','REAL',$7)`,
          [metricId, state, label, value, value.toLocaleString('en-US'), unit, loadHistoryId],
        );
      }
    }
  }
}
