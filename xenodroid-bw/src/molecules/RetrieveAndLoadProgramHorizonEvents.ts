import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';
import { StripHtmlToLines, ParseWaiverDates, ParseSupportingDocuments } from '../atoms/ParseCmsDemonstrationPage.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { SafeObjectSegment } from '../adapters/operationalPublicSources.js';

type HorizonEventRow = {
  eventId: string;
  state: string;
  eventType: 'waiver_expiration' | 'waiver_milestone' | 'nofo_opportunity';
  scope: 'state' | 'national';
  program: string;
  eventDate: string;
  eventDateKind: 'approval' | 'effective' | 'expiration' | 'document_posted' | 'open_date' | 'close_date';
  status: string;
  detail: string;
  sourceDocumentUri: string;
  retrievedAt: string;
};

type GrantsOppHit = {
  id: string;
  number: string;
  title: string;
  agency: string;
  openDate: string;
  closeDate: string;
  oppStatus: string;
  cfdaList?: string[];
};

const shown = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });

function mmddyyyyToIso(value: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

/**
 * Business Action: RetrieveAndLoadProgramHorizonEvents
 * OFR-07. State-neutral (KY+FL) waiver & grant horizon watch. Two source
 * lanes: CMS_1115_DEMO (the two named 1115 demonstration pages — expiration
 * date plus recently posted milestone documents, cited by page URI, since
 * CMS publishes no structured API for this) and GRANTS_GOV (the live
 * search2 API, filtered to the OFR-01 assistance-listing set, national in
 * scope). Every event carries its published status and source citation —
 * never a predicted renewal outcome.
 */
export class RetrieveAndLoadProgramHorizonEvents {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  WaiverPagesFetched = 0;
  WaiverEventCount = 0;
  NofoQueriesRun = 0;
  NofoEventCount = 0;
  MetricCount = 0;
  private client_ = new GovernedHttpClient({ requestCeiling: 60, minDelayMs: 1000 });

  constructor(private client: pg.PoolClient) {}

  private async fetchWaiverEvents(): Promise<{ rows: HorizonEventRow[]; rawByProgram: Record<string, unknown> }> {
    const rows: HorizonEventRow[] = [];
    const rawByProgram: Record<string, unknown> = {};
    for (const demo of config.cms1115DemonstrationPages) {
      const { text } = await this.client_.FetchText(demo.uri);
      this.WaiverPagesFetched += 1;
      const lines = StripHtmlToLines(text);
      const dates = ParseWaiverDates(lines);
      const documents = ParseSupportingDocuments(lines, 6);
      const retrievedAt = new Date().toISOString();
      rawByProgram[demo.program] = { waiverDates: dates, supportingDocuments: documents, retrievedAt, sourceUri: demo.uri };

      rows.push({
        eventId: `WHE-${demo.state}-EXPIRATION`,
        state: demo.state,
        eventType: 'waiver_expiration',
        scope: 'state',
        program: demo.program,
        eventDate: dates.expiration,
        eventDateKind: 'expiration',
        status: 'approved-through-expiration',
        detail: `Approval ${dates.approval} · Effective ${dates.effective}`,
        sourceDocumentUri: demo.uri,
        retrievedAt,
      });
      documents.forEach((doc, index) => {
        rows.push({
          eventId: `WHE-${demo.state}-MILESTONE-${doc.date}-${index}`,
          state: demo.state,
          eventType: 'waiver_milestone',
          scope: 'state',
          program: demo.program,
          eventDate: doc.date,
          eventDateKind: 'document_posted',
          status: 'published',
          detail: doc.title,
          sourceDocumentUri: demo.uri,
          retrievedAt,
        });
      });
    }
    return { rows, rawByProgram };
  }

  private async fetchNofoEvents(): Promise<{ rows: HorizonEventRow[]; rawByListing: Record<string, unknown> }> {
    const rows: HorizonEventRow[] = [];
    const rawByListing: Record<string, unknown> = {};
    for (const listing of config.ofrAssistanceListings) {
      this.NofoQueriesRun += 1;
      const { json } = await this.client_.FetchJson<{ data: { hitCount: number; oppHits: GrantsOppHit[] } }>(
        config.grantsGovSearch2Uri,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cfda: listing.code, rows: 25, oppStatuses: 'forecasted|posted' }),
        },
      );
      const hits = json.data?.oppHits || [];
      if (hits.length) rawByListing[listing.code] = hits;
      const retrievedAt = new Date().toISOString();
      for (const hit of hits) {
        const detail = `${hit.number} — ${hit.title} (${hit.agency})`;
        const openIso = mmddyyyyToIso(hit.openDate);
        const closeIso = mmddyyyyToIso(hit.closeDate);
        for (const state of config.ofrStates) {
          if (openIso) {
            rows.push({
              eventId: `WHE-${state}-NOFO-${hit.id}-OPEN`,
              state, eventType: 'nofo_opportunity', scope: 'national', program: listing.title,
              eventDate: openIso, eventDateKind: 'open_date', status: hit.oppStatus, detail,
              sourceDocumentUri: `https://grants.gov/search-results-detail/${hit.id}`, retrievedAt,
            });
          }
          if (closeIso) {
            rows.push({
              eventId: `WHE-${state}-NOFO-${hit.id}-CLOSE`,
              state, eventType: 'nofo_opportunity', scope: 'national', program: listing.title,
              eventDate: closeIso, eventDateKind: 'close_date', status: hit.oppStatus, detail,
              sourceDocumentUri: `https://grants.gov/search-results-detail/${hit.id}`, retrievedAt,
            });
          }
        }
      }
    }
    return { rows, rawByListing };
  }

  private async writeEvents(rows: HorizonEventRow[], fromSysId: string, loadHistoryId: string) {
    if (!rows.length) return;
    const BATCH = 300;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values: unknown[] = [];
      const placeholders = batch.map((r, position) => {
        const base = position * 11;
        values.push(r.eventId, r.state, r.eventType, r.scope, r.program, r.eventDate, r.eventDateKind, r.status, r.detail, r.sourceDocumentUri, r.retrievedAt);
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6}::date,$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11}::timestamptz,'${fromSysId}','REAL','${loadHistoryId}')`;
      });
      await this.client.query(
        `INSERT INTO bw_dso.dso_program_horizon_event
         (event_id,state_code,event_type,scope,program,event_date,event_date_kind,status,detail,source_document_uri,retrieved_at,from_sys_id,load_class,load_history_id)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (event_id, load_class, load_history_id) DO NOTHING`,
        values,
      );
    }
  }

  private async addMetric(state: string, fromSysId: string, loadHistoryId: string, metricId: string, label: string, value: number, display: string, unit: string) {
    await this.client.query(
      `INSERT INTO bw_cube.cube_program_horizon_metric
       (metric_id,state_code,metric_label,numeric_value,display_value,unit,as_of_date,from_sys_id,load_class,load_history_id)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,'REAL',$8)`,
      [metricId, state, label, value, display, unit, fromSysId, loadHistoryId],
    );
    this.MetricCount += 1;
  }

  private async computeStateMetrics(state: string, fromSysId: string, loadHistoryId: string) {
    const events = await this.client.query<{ event_type: string; event_date: string; event_date_kind: string }>(
      `SELECT event_type, event_date::text, event_date_kind FROM bw_dso.dso_program_horizon_event WHERE load_class='REAL' AND state_code=$1`,
      [state],
    );
    const today = new Date();
    const monthsUntil = (isoDate: string) => (new Date(isoDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

    const expirations = events.rows.filter((e) => e.event_type === 'waiver_expiration');
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-horizon-waiver-expiration-count', 'Waiver/demonstration expirations tracked', expirations.length, shown(expirations.length), 'events');

    const expiring24mo = expirations.filter((e) => { const m = monthsUntil(e.event_date); return m >= 0 && m <= 24; });
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-horizon-waiver-expiring-24mo-count', 'Waiver/demonstration authorities expiring within 24 months', expiring24mo.length, shown(expiring24mo.length), 'events');

    const milestones = events.rows.filter((e) => e.event_type === 'waiver_milestone');
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-horizon-waiver-milestone-count', 'Recently posted waiver milestone documents', milestones.length, shown(milestones.length), 'documents');

    const openNofos = events.rows.filter((e) => e.event_type === 'nofo_opportunity' && e.event_date_kind === 'open_date');
    await this.addMetric(state, fromSysId, loadHistoryId, 'ofr-horizon-open-nofo-count', 'Open or forecasted NOFO opportunities under tracked assistance listings', openNofos.length, shown(openNofos.length), 'opportunities');
  }

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    try {
      await this.client.query(`DELETE FROM bw_dso.dso_program_horizon_event WHERE load_class='REAL'`);
      await this.client.query(`DELETE FROM bw_cube.cube_program_horizon_metric WHERE load_class='REAL'`);

      await psaStore.EnsureRootReady();

      const waiverLoadHistoryId = newId('LH-HORIZON-WAIVER');
      await InsertLoadHistory(this.client, {
        load_history_id: waiverLoadHistoryId, data_request_id: 'DR-REAL-CMS-1115-DEMO', started_at: new Date(),
        source_uri: config.cms1115DemonstrationPages.map((d) => d.uri).join(' | '), load_class: 'REAL',
      });
      try {
        const { rows: waiverRows, rawByProgram } = await this.fetchWaiverEvents();
        const bytes = Buffer.from(JSON.stringify(rawByProgram));
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const key = `psa/CMS_1115_DEMO/REAL/${stamp}/${SafeObjectSegment('waiver-horizon-events')}.json`;
        const object = await psaStore.PutObject(key, bytes);
        await this.client.query(
          `INSERT INTO bw_psa_meta.object_index (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length)
           VALUES ($1,'CMS_1115_DEMO',$2,'REAL',$3,$4)`,
          [key, waiverLoadHistoryId, object.contentHash, object.byteLength],
        );
        await this.writeEvents(waiverRows, 'CMS_1115_DEMO', waiverLoadHistoryId);
        this.WaiverEventCount = waiverRows.length;
        await CompleteLoadHistory(this.client, waiverLoadHistoryId, {
          status: 'SUCCEEDED', row_count: waiverRows.length, content_hash: object.contentHash, as_of_date: new Date().toISOString().slice(0, 10),
          notes: `${this.WaiverPagesFetched} demonstration pages fetched; ${waiverRows.length} waiver horizon events (expiration + milestone) parsed from published "Waiver Dates" / "Supporting Documents" page content.`,
        });
      } catch (error) {
        await CompleteLoadHistory(this.client, waiverLoadHistoryId, { status: 'FAILED', notes: error instanceof Error ? error.message : String(error) });
        throw error;
      }

      const nofoLoadHistoryId = newId('LH-HORIZON-NOFO');
      await InsertLoadHistory(this.client, {
        load_history_id: nofoLoadHistoryId, data_request_id: 'DR-REAL-GRANTS-GOV', started_at: new Date(),
        source_uri: config.grantsGovSearch2Uri, load_class: 'REAL',
      });
      try {
        const { rows: nofoRows, rawByListing } = await this.fetchNofoEvents();
        const bytes = Buffer.from(JSON.stringify(rawByListing));
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const key = `psa/GRANTS_GOV/REAL/${stamp}/${SafeObjectSegment('nofo-opportunities-by-listing')}.json`;
        const object = await psaStore.PutObject(key, bytes);
        await this.client.query(
          `INSERT INTO bw_psa_meta.object_index (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length)
           VALUES ($1,'GRANTS_GOV',$2,'REAL',$3,$4)`,
          [key, nofoLoadHistoryId, object.contentHash, object.byteLength],
        );
        await this.writeEvents(nofoRows, 'GRANTS_GOV', nofoLoadHistoryId);
        this.NofoEventCount = nofoRows.length;
        await CompleteLoadHistory(this.client, nofoLoadHistoryId, {
          status: 'SUCCEEDED', row_count: nofoRows.length, content_hash: object.contentHash, as_of_date: new Date().toISOString().slice(0, 10),
          notes: `${this.NofoQueriesRun} Grants.gov search2 queries run (one per OFR-tracked assistance listing); ${nofoRows.length} open/forecasted-opportunity horizon events (open + close dates) loaded.`,
        });
      } catch (error) {
        await CompleteLoadHistory(this.client, nofoLoadHistoryId, { status: 'FAILED', notes: error instanceof Error ? error.message : String(error) });
        throw error;
      }

      const metricLoadHistoryId = newId('LH-HORIZON-METRICS');
      await InsertLoadHistory(this.client, {
        load_history_id: metricLoadHistoryId, data_request_id: 'DR-REAL-CMS-1115-DEMO', started_at: new Date(),
        source_uri: 'CMS 1115 demonstration pages + Grants.gov search2 — computed horizon metrics', load_class: 'REAL',
      });
      for (const state of config.ofrStates) {
        await this.computeStateMetrics(state, 'CMS_1115_DEMO', metricLoadHistoryId);
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
