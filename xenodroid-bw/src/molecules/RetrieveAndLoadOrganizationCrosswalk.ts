import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { ParseCsvRecords, SafeObjectSegment, Sha256 } from '../adapters/operationalPublicSources.js';
import { BlockingKey, NormalizeAddressLine, NormalizeOrgName, TokenSetSimilarity } from '../atoms/OrgNameMatching.js';

type IdentityType = 'UEI' | 'EIN' | 'NPI' | 'CCN';
type IdentityRecord = {
  sourceRowId: string;
  identifierType: IdentityType;
  identifierValue: string;
  orgName: string;
  addressLine1: string;
  city: string;
  zip: string;
  extra: Record<string, unknown>;
  fromSysId: string;
};

const EXACT_CONFIDENCE = 0.95;
const INFERRED_MIN_SIMILARITY = 0.55;
const NPPES_CANDIDATE_CAP = 40;

const shown = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });

/**
 * Business Action: RetrieveAndLoadOrganizationCrosswalk
 * OFR-02. State-neutral identity crosswalk spine for Kentucky and Florida.
 *
 * Grounding correction (verified live 2026-08-31): neither the SAM.gov
 * Entity Management API (even with the Director-provisioned key) nor
 * USAspending exposes EIN. No accessible source publishes a cross-identifier
 * pair directly except NPPES (NPI + embedded state Medicaid ID). Every other
 * link here is computed from name/address matching between independently
 * published single-source identity records, and is classified
 * 'exact-derived' or 'inferred' accordingly — never 'exact-published' unless
 * the two identifiers come from the very same source record.
 */
export class RetrieveAndLoadOrganizationCrosswalk {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  StateCount = 0;
  IdentityRecordCount = 0;
  ExactAssertionCount = 0;
  InferredAssertionCount = 0;
  DisagreementCount = 0;
  Gaps: Array<{ state: string; gapId: string; reason: string }> = [];
  SamKeyAvailable = false;
  private client_ = new GovernedHttpClient({ requestCeiling: 700 });
  // SAM.gov's public-tier rate limit is stricter than the general default —
  // observed live 2026-08-31: repeated HTTP 429 even at 3s pacing across two
  // separate runs within the same session, including on the very first call
  // of a fresh run, which points to a short-window burst quota rather than a
  // pure per-request rate. A slower pace reduces (but cannot guarantee
  // avoiding) 429s; the degrade-to-USAspending-seeded-path fallback is the
  // actual correctness guarantee, not this pacing value.
  private samClient_ = new GovernedHttpClient({ requestCeiling: 200, minDelayMs: 5000, maxAttempts: 3 });

  constructor(private client: pg.PoolClient) {}

  private async landRaw(fromSysId: string, state: string, suffix: string, bytes: Buffer, extension: string) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `psa/${fromSysId}/REAL/${stamp}/${SafeObjectSegment(state)}-${SafeObjectSegment(suffix)}.${extension}`;
    await psaStore.EnsureRootReady();
    return { key, object: await psaStore.PutObject(key, bytes) };
  }

  // ---- Source identity loaders --------------------------------------

  private async loadUsaSpendingIdentities(state: string): Promise<IdentityRecord[]> {
    const recipients = await this.client.query<{ recipient_id: string; recipient_name: string }>(
      `SELECT DISTINCT recipient_id, recipient_name FROM bw_dso.dso_federal_award
       WHERE load_class='REAL' AND state_code=$1 AND recipient_id <> ''`,
      [state],
    );
    const out: IdentityRecord[] = [];
    for (const row of recipients.rows) {
      try {
        const { json } = await this.client_.FetchJson<{
          uei?: string; name?: string; location?: { address_line1?: string; city_name?: string; zip?: string };
        }>(`https://api.usaspending.gov/api/v2/recipient/${encodeURIComponent(row.recipient_id)}/`);
        if (!json.uei) continue;
        out.push({
          sourceRowId: `USA_SPENDING-${state}-${json.uei}`,
          identifierType: 'UEI',
          identifierValue: json.uei,
          orgName: json.name || row.recipient_name,
          addressLine1: json.location?.address_line1 || '',
          city: json.location?.city_name || '',
          zip: json.location?.zip || '',
          extra: { recipientId: row.recipient_id },
          fromSysId: 'USA_SPENDING',
        });
      } catch {
        // A single recipient-profile lookup failure does not fail the package; the
        // award-grain identity for that recipient is simply absent from the spine.
      }
    }
    return out;
  }

  private async loadSamIdentities(state: string, ueis: string[]): Promise<IdentityRecord[]> {
    const key = process.env.SAM_GOV_API_KEY;
    if (!key) {
      this.Gaps.push({ state, gapId: `GAP-SAM-ENTITY-${state}`, reason: 'SAM_GOV_API_KEY not present in the runtime environment; degraded to the USAspending-seeded path per the hybrid seed order fallback.' });
      return [];
    }
    const out: IdentityRecord[] = [];
    for (const uei of ueis) {
      try {
        const { json } = await this.samClient_.FetchJson<{
          totalRecords?: number;
          entityData?: Array<{
            entityRegistration?: { ueiSAM?: string; legalBusinessName?: string; registrationStatus?: string };
            coreData?: { physicalAddress?: { addressLine1?: string; city?: string; zipCode?: string } };
          }>;
        }>(`${config.samEntityApiUri}?ueiSAM=${encodeURIComponent(uei)}&api_key=${encodeURIComponent(key)}`);
        const entity = json.entityData?.[0];
        if (!entity?.entityRegistration?.ueiSAM) continue;
        this.SamKeyAvailable = true;
        out.push({
          sourceRowId: `SAM_ENTITY-${state}-${entity.entityRegistration.ueiSAM}`,
          identifierType: 'UEI',
          identifierValue: entity.entityRegistration.ueiSAM,
          orgName: entity.entityRegistration.legalBusinessName || '',
          addressLine1: entity.coreData?.physicalAddress?.addressLine1 || '',
          city: entity.coreData?.physicalAddress?.city || '',
          zip: entity.coreData?.physicalAddress?.zipCode || '',
          extra: { registrationStatus: entity.entityRegistration.registrationStatus || '' },
          fromSysId: 'SAM_ENTITY',
        });
      } catch (error) {
        if (!this.Gaps.some((g) => g.gapId === `GAP-SAM-ENTITY-${state}`)) {
          this.Gaps.push({ state, gapId: `GAP-SAM-ENTITY-${state}`, reason: `SAM.gov lookup failed at runtime (${error instanceof Error ? error.message : String(error)}); remaining UEIs for this state degrade to the USAspending-seeded path for this run.` });
        }
      }
    }
    return out;
  }

  private async loadIrsEoBmfIdentities(state: string): Promise<IdentityRecord[]> {
    const uri = config.irsEoBmfStateCsvUri(state);
    // The EO BMF endpoint returns text/csv, not JSON, so this bypasses the
    // JSON-oriented GovernedHttpClient and fetches raw bytes directly, with
    // its own bounded retry.
    let bytes: Buffer | null = null;
    let lastError = '';
    for (let attempt = 1; attempt <= 3 && !bytes; attempt += 1) {
      try {
        const res = await fetch(uri, {
          headers: { 'User-Agent': 'DecisionProOFR-DataRequest/1.0 (+https://decisionpro.io/data-requests)' },
          signal: AbortSignal.timeout(180_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        bytes = Buffer.from(await res.arrayBuffer());
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
    if (!bytes) throw new Error(`IRS EO BMF fetch failed for ${state}: ${lastError}`);
    const { key: psaKey } = await this.landRaw('IRS_EO_BMF', state, 'eo-bmf', bytes, 'csv');
    const rows = ParseCsvRecords(bytes.toString('utf8'));
    return rows
      .filter((row) => (row.ein || '').trim())
      .map((row) => ({
        sourceRowId: `IRS_EO_BMF-${state}-${row.ein}`,
        identifierType: 'EIN' as const,
        identifierValue: row.ein.trim(),
        orgName: row.name || '',
        addressLine1: row.street || '',
        city: row.city || '',
        zip: (row.zip || '').slice(0, 5),
        extra: { nteeCode: row.ntee_cd || '', rulingDate: row.ruling || '', foundationCode: row.foundation || '', psaObjectKey: psaKey },
        fromSysId: 'IRS_EO_BMF',
      }));
  }

  private async loadCmsProviderIdentities(state: string): Promise<IdentityRecord[]> {
    const { json } = await this.client_.FetchJson<{ results?: Array<Record<string, unknown>> }>(
      config.cmsProviderDataStateUri(state), { headers: { Accept: 'application/json' } },
    );
    const rows = json.results || [];
    return rows
      .map((row) => ({
        ccn: String(row.cms_certification_number_ccn ?? ''),
        name: String(row.provider_name ?? ''),
        beds: Number(row.number_of_certified_beds ?? 0) || 0,
      }))
      .filter((row) => row.ccn)
      .map((row) => ({
        sourceRowId: `CMS_PROVIDER_DATA-${state}-${row.ccn}`,
        identifierType: 'CCN' as const,
        identifierValue: row.ccn,
        orgName: row.name,
        addressLine1: '',
        city: '',
        zip: '',
        extra: { certifiedBeds: row.beds },
        fromSysId: 'CMS_PROVIDER_DATA',
      }));
  }

  private async loadNppesIdentities(state: string, candidateNames: string[]): Promise<IdentityRecord[]> {
    const out: IdentityRecord[] = [];
    const seen = new Set<string>();
    for (const name of candidateNames.slice(0, NPPES_CANDIDATE_CAP)) {
      const firstToken = name.split(' ').find((w) => w.length >= 4);
      if (!firstToken) continue;
      try {
        const { json } = await this.client_.FetchJson<{
          results?: Array<{
            number: string;
            basic?: { organization_name?: string };
            addresses?: Array<{ address_1?: string; city?: string; postal_code?: string; address_purpose?: string }>;
            identifiers?: Array<{ code?: string; identifier?: string; state?: string }>;
          }>;
        }>(`${config.nppesApiUri}?version=2.1&organization_name=${encodeURIComponent(firstToken)}*&state=${state}&enumeration_type=NPI-2&limit=5`);
        for (const record of json.results || []) {
          if (!record.number || seen.has(record.number)) continue;
          seen.add(record.number);
          const address = record.addresses?.find((a) => a.address_purpose === 'LOCATION') || record.addresses?.[0];
          const stateMedicaidId = record.identifiers?.find((i) => i.code === '05')?.identifier || null;
          out.push({
            sourceRowId: `NPPES-${state}-${record.number}`,
            identifierType: 'NPI',
            identifierValue: record.number,
            orgName: record.basic?.organization_name || '',
            addressLine1: address?.address_1 || '',
            city: address?.city || '',
            zip: (address?.postal_code || '').slice(0, 5),
            extra: stateMedicaidId ? { stateMedicaidId } : {},
            fromSysId: 'NPPES',
          });
        }
      } catch {
        // A single NPPES wildcard-name lookup failing does not stop the run.
      }
    }
    return out;
  }

  // ---- Persistence -----------------------------------------------------

  private async writeIdentityRecords(state: string, fromSysId: string, records: IdentityRecord[], loadHistoryId: string) {
    if (!records.length) return;
    const BATCH = 400;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const values: unknown[] = [];
      const placeholders = batch.map((rec, idx) => {
        const base = idx * 10;
        values.push(
          rec.sourceRowId, state, rec.identifierType, rec.identifierValue, rec.orgName,
          NormalizeOrgName(rec.orgName), NormalizeAddressLine(rec.addressLine1), rec.city, rec.zip,
          JSON.stringify(rec.extra),
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10}::jsonb,'${rec.fromSysId}','REAL','${loadHistoryId}')`;
      });
      await this.client.query(
        `INSERT INTO bw_dso.dso_identity_record
         (source_row_id,state_code,identifier_type,identifier_value,org_name,normalized_name,
          address_line1,city,zip,extra_json,from_sys_id,load_class,load_history_id)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (source_row_id, load_class, load_history_id) DO NOTHING`,
        values,
      );
    }
    this.IdentityRecordCount += records.length;
    void fromSysId;
  }

  private async computeMatches(state: string, identities: IdentityRecord[], loadHistoryId: string) {
    const byBlock = new Map<string, IdentityRecord[]>();
    for (const rec of identities) {
      const key = BlockingKey(NormalizeOrgName(rec.orgName));
      const list = byBlock.get(key) || [];
      list.push(rec);
      byBlock.set(key, list);
    }
    const seenPairs = new Set<string>();
    let exactSeq = 0;
    let inferredSeq = 0;
    for (const bucket of byBlock.values()) {
      for (let i = 0; i < bucket.length; i += 1) {
        for (let j = i + 1; j < bucket.length; j += 1) {
          const a = bucket[i];
          const b = bucket[j];
          if (a.fromSysId === b.fromSysId) continue;
          if (a.identifierType === b.identifierType && a.identifierValue === b.identifierValue) continue;
          const pairKey = [a.sourceRowId, b.sourceRowId].sort().join('|');
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);
          const nameA = NormalizeOrgName(a.orgName);
          const nameB = NormalizeOrgName(b.orgName);
          if (!nameA || !nameB) continue;
          const addrA = NormalizeAddressLine(a.addressLine1);
          const addrB = NormalizeAddressLine(b.addressLine1);
          const zipMatch = a.zip && b.zip && a.zip === b.zip;
          const addrMatch = addrA && addrB && addrA === addrB;
          if (nameA === nameB && (zipMatch || addrMatch)) {
            exactSeq += 1;
            await this.client.query(
              `INSERT INTO bw_ctl.organization_crosswalk_exact
               (assertion_id,state_code,match_method,left_identifier_type,left_identifier_value,
                right_identifier_type,right_identifier_value,confidence,evidence_citation,
                from_sys_ids,load_class,load_history_id)
               VALUES ($1,$2,'exact-derived',$3,$4,$5,$6,$7,$8,$9,'REAL',$10)`,
              [`XW-EX-${state}-${exactSeq}`, state, a.identifierType, a.identifierValue, b.identifierType, b.identifierValue,
                EXACT_CONFIDENCE, `Normalized name "${nameA}" matches exactly between ${a.fromSysId} and ${b.fromSysId}, corroborated by ${zipMatch ? 'matching ZIP code' : 'matching normalized street address'}.`,
                [a.fromSysId, b.fromSysId], loadHistoryId],
            );
            this.ExactAssertionCount += 1;
            continue;
          }
          const similarity = TokenSetSimilarity(nameA, nameB);
          if (similarity >= INFERRED_MIN_SIMILARITY) {
            inferredSeq += 1;
            await this.client.query(
              `INSERT INTO bw_ctl.organization_crosswalk_inferred
               (assertion_id,state_code,match_method,left_identifier_type,left_identifier_value,
                right_identifier_type,right_identifier_value,confidence,evidence_citation,
                from_sys_ids,load_class,load_history_id)
               VALUES ($1,$2,'inferred',$3,$4,$5,$6,$7,$8,$9,'REAL',$10)`,
              [`XW-INF-${state}-${inferredSeq}`, state, a.identifierType, a.identifierValue, b.identifierType, b.identifierValue,
                similarity, `Token-set name similarity ${similarity.toFixed(2)} between "${a.orgName}" (${a.fromSysId}) and "${b.orgName}" (${b.fromSysId}); no address confirmation. Review candidate only.`,
                [a.fromSysId, b.fromSysId], loadHistoryId],
            );
            this.InferredAssertionCount += 1;
          }
        }
      }
    }
  }

  private async computeDisagreements(state: string, samRecords: IdentityRecord[], usaSpendingRecords: IdentityRecord[], loadHistoryId: string) {
    const usaByUei = new Map(usaSpendingRecords.map((r) => [r.identifierValue, r]));
    let seq = 0;
    for (const sam of samRecords) {
      const usa = usaByUei.get(sam.identifierValue);
      if (!usa) continue;
      const similarity = TokenSetSimilarity(NormalizeOrgName(sam.orgName), NormalizeOrgName(usa.orgName));
      if (similarity >= 0.9) continue;
      seq += 1;
      await this.client.query(
        `INSERT INTO bw_ctl.organization_crosswalk_disagreement
         (disagreement_id,state_code,uei,sam_name,usaspending_name,similarity_score,from_sys_ids,load_class,load_history_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'REAL',$8)`,
        [`XW-DIS-${state}-${seq}`, state, sam.identifierValue, sam.orgName, usa.orgName, similarity, ['SAM_ENTITY', 'USA_SPENDING'], loadHistoryId],
      );
      this.DisagreementCount += 1;
    }
  }

  private async addMetric(state: string, fromSysId: string, loadHistoryId: string, metricId: string, label: string, value: number, display: string, unit: string) {
    await this.client.query(
      `INSERT INTO bw_cube.cube_crosswalk_metric
       (metric_id,state_code,metric_label,numeric_value,display_value,unit,as_of_date,from_sys_id,load_class,load_history_id)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,'REAL',$8)`,
      [metricId, state, label, value, display, unit, fromSysId, loadHistoryId],
    );
  }

  private async loadState(state: string) {
    const id = newId('LH-CROSSWALK');
    await InsertLoadHistory(this.client, {
      load_history_id: id, data_request_id: 'DR-REAL-ORG-CROSSWALK', started_at: new Date(),
      source_uri: `organization crosswalk spine (${state})`, load_class: 'REAL',
    });
    try {
      await this.client.query(`DELETE FROM bw_dso.dso_identity_record WHERE state_code=$1 AND load_class='REAL'`, [state]);
      await this.client.query(`DELETE FROM bw_ctl.organization_crosswalk_exact WHERE state_code=$1 AND load_class='REAL'`, [state]);
      await this.client.query(`DELETE FROM bw_ctl.organization_crosswalk_inferred WHERE state_code=$1 AND load_class='REAL'`, [state]);
      await this.client.query(`DELETE FROM bw_ctl.organization_crosswalk_disagreement WHERE state_code=$1 AND load_class='REAL'`, [state]);
      await this.client.query(`DELETE FROM bw_cube.cube_crosswalk_metric WHERE state_code=$1 AND load_class='REAL'`, [state]);

      const usaSpendingIdentities = await this.loadUsaSpendingIdentities(state);
      await this.writeIdentityRecords(state, 'USA_SPENDING', usaSpendingIdentities, id);

      const samIdentities = await this.loadSamIdentities(state, usaSpendingIdentities.map((r) => r.identifierValue));
      await this.writeIdentityRecords(state, 'SAM_ENTITY', samIdentities, id);

      const irsIdentities = await this.loadIrsEoBmfIdentities(state);
      await this.writeIdentityRecords(state, 'IRS_EO_BMF', irsIdentities, id);

      const cmsIdentities = await this.loadCmsProviderIdentities(state);
      await this.writeIdentityRecords(state, 'CMS_PROVIDER_DATA', cmsIdentities, id);

      const nppesCandidateNames = [
        ...samIdentities.map((r) => r.orgName),
        ...cmsIdentities.slice().sort((a, b) => Number(b.extra.certifiedBeds || 0) - Number(a.extra.certifiedBeds || 0)).map((r) => r.orgName),
      ];
      const nppesIdentities = await this.loadNppesIdentities(state, [...new Set(nppesCandidateNames)]);
      await this.writeIdentityRecords(state, 'NPPES', nppesIdentities, id);

      // NPPES exact-published within-source fact: NPI + embedded state Medicaid ID.
      let publishedSeq = 0;
      for (const rec of nppesIdentities) {
        const stateMedicaidId = rec.extra.stateMedicaidId as string | undefined;
        if (!stateMedicaidId) continue;
        publishedSeq += 1;
        await this.client.query(
          `INSERT INTO bw_ctl.organization_crosswalk_exact
           (assertion_id,state_code,match_method,left_identifier_type,left_identifier_value,
            right_identifier_type,right_identifier_value,confidence,evidence_citation,from_sys_ids,load_class,load_history_id)
           VALUES ($1,$2,'exact-published','NPI',$3,'STATE_MEDICAID_ID',$4,1.0,$5,$6,'REAL',$7)`,
          [`XW-PUB-${state}-${publishedSeq}`, state, rec.identifierValue, stateMedicaidId,
            `NPPES organizational record for NPI ${rec.identifierValue} directly publishes an embedded state Medicaid provider identifier (identifiers[].code='05') in the same record.`,
            ['NPPES'], id],
        );
        this.ExactAssertionCount += 1;
      }

      const allIdentities = [...usaSpendingIdentities, ...samIdentities, ...irsIdentities, ...cmsIdentities, ...nppesIdentities];
      await this.computeMatches(state, allIdentities, id);
      await this.computeDisagreements(state, samIdentities, usaSpendingIdentities, id);

      await this.addMetric(state, 'USA_SPENDING', id, 'ofr-crosswalk-identity-records', 'Identity records loaded across all sources', allIdentities.length, shown(allIdentities.length), 'records');
      await this.addMetric(state, 'USA_SPENDING', id, 'ofr-crosswalk-exact-assertions', 'Exact crosswalk assertions (exact-published + exact-derived)', this.ExactAssertionCount, shown(this.ExactAssertionCount), 'assertions');
      await this.addMetric(state, 'USA_SPENDING', id, 'ofr-crosswalk-inferred-assertions', 'Inferred crosswalk assertions (review candidates)', this.InferredAssertionCount, shown(this.InferredAssertionCount), 'assertions');
      await this.addMetric(state, 'USA_SPENDING', id, 'ofr-crosswalk-disagreements', 'SAM vs USAspending name disagreements (open review queue)', this.DisagreementCount, shown(this.DisagreementCount), 'disagreements');
      await this.addMetric(state, 'USA_SPENDING', id, 'ofr-crosswalk-sam-coverage', 'UEIs resolved via SAM.gov (primary authority)', samIdentities.length, shown(samIdentities.length), 'entities');

      await CompleteLoadHistory(this.client, id, {
        status: 'SUCCEEDED', row_count: allIdentities.length, as_of_date: new Date().toISOString().slice(0, 10),
        notes: `${allIdentities.length} identity records (USASpending ${usaSpendingIdentities.length}, SAM ${samIdentities.length}, IRS EO BMF ${irsIdentities.length}, CMS Provider Data ${cmsIdentities.length}, NPPES ${nppesIdentities.length}); ${this.ExactAssertionCount} exact + ${this.InferredAssertionCount} inferred crosswalk assertions; ${this.DisagreementCount} SAM/USAspending disagreements.`,
      });
      this.StateCount += 1;
    } catch (error) {
      await CompleteLoadHistory(this.client, id, { status: 'FAILED', notes: error instanceof Error ? error.message : String(error) });
      throw error;
    }
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
