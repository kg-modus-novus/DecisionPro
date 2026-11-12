import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { POLICY_DATA_REQUEST_ID, POLICY_FROM_SYS_ID, POLICY_RULE_NOTE_PREFIX } from './PolicyEventOwner.js';

/**
 * ExportPolicyEventsForUi: a read-only projection of the latest SUCCEEDED load of
 * the curated policy events for the app's Potential Fraud Detection module
 * (plan: docs/planning/law-and-policy-layer-codexen-plan.md, item 3).
 *
 * Serialization only. Every event, confirmed or suggested, and every search is
 * written as PolicyEventOwner loaded it, with the rule that load recorded (never
 * the owner's current constants). Nothing is matched to a rise, no explanation is
 * named and no rating is touched here: the app's PotentialFraudSignalReview
 * program does that, and decides from confirmed events only.
 *
 * Refuses when there is no SUCCEEDED load, when the load does not record a
 * readable rule with its lookback months, or when the tables do not hold the
 * rows the load recorded.
 *
 * Writes alp/policyEvents.js.
 */

export const POLICY_EVENTS_EXPORT_SCHEMA = 'decisionpro/policy-events-export/v1';

/** PolicyEventOwner joins its load notes with this separator when it records a load. */
const LOAD_NOTE_SEPARATOR = ' | ';

type LoadRead = {
  load_history_id: string; started_at: string; completed_at: string; as_of_date: string | null;
  notes: string | null; row_count: number; content_hash: string;
};

type EventRead = {
  event_id: string; state_code: string; kind: string; direction: string; summary: string;
  effective_date: string; effective_precision: string; end_date: string; end_precision: string; ended_by_event_id: string;
  scope_hcpcs: string[]; scope_hcpcs_prefixes: string[]; scope_all_services: boolean; scope_basis: string; scope_note: string;
  source_publisher: string; source_title: string; source_url: string; source_document_date: string; source_document_precision: string;
  source_quote: string; standing: string; confirmed_by: string; confirmed_on: string; source_file: string;
};

type SearchRead = {
  state_code: string; source_name: string; source_url: string; topic: string; searched_through: string; completeness: string; source_file: string;
};

export class ExportPolicyEventsForUi {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  ExportPath = config.policyEventsExportPath;
  LoadHistoryID = '';
  EventCount = 0;
  ConfirmedEventCount = 0;
  SuggestedEventCount = 0;
  SearchCount = 0;
  StateCount = 0;
  ExportBytes = 0;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const q = <T extends pg.QueryResultRow>(sql: string, args: unknown[] = []) => this.client.query<T>(sql, args).then((r) => r.rows);
      const loads = await q<LoadRead>(
        `SELECT load_history_id, started_at, completed_at, to_char(as_of_date, 'YYYY-MM-DD') AS as_of_date, notes, row_count, content_hash
           FROM bw_ctl.load_history WHERE data_request_id = $1 AND status = 'SUCCEEDED' AND load_class = 'REAL' ORDER BY completed_at DESC LIMIT 1`,
        [POLICY_DATA_REQUEST_ID],
      );
      if (loads.length === 0) throw new Error('no SUCCEEDED policy events load to export; run policy-events-load');
      const load = loads[0];
      this.LoadHistoryID = load.load_history_id;

      // The rule as the load recorded it (never the owner's current constants).
      const noteParts = String(load.notes ?? '').split(LOAD_NOTE_SEPARATOR);
      const ruleNote = noteParts.find((n) => n.startsWith(POLICY_RULE_NOTE_PREFIX));
      if (!ruleNote) throw new Error('the policy events load does not record its rule; rerun policy-events-load');
      let recorded: unknown = null;
      try { recorded = JSON.parse(ruleNote.slice(POLICY_RULE_NOTE_PREFIX.length)); } catch { recorded = null; }
      if (recorded === null || typeof recorded !== 'object' || Array.isArray(recorded)) {
        throw new Error('the policy events load does not record its rule in a readable form; rerun policy-events-load');
      }
      const rule = recorded as { lookbackMonths?: unknown };
      if (typeof rule.lookbackMonths !== 'number' || !(rule.lookbackMonths > 0)) {
        throw new Error('the policy events load records a rule without its lookback months; rerun policy-events-load');
      }

      const events = await q<EventRead>(
        `SELECT event_id, state_code, kind, direction, summary,
                to_char(effective_date, 'YYYY-MM-DD') AS effective_date, effective_precision,
                COALESCE(to_char(end_date, 'YYYY-MM-DD'), '') AS end_date, end_precision, ended_by_event_id,
                scope_hcpcs, scope_hcpcs_prefixes, scope_all_services, scope_basis, scope_note,
                source_publisher, source_title, source_url,
                to_char(source_document_date, 'YYYY-MM-DD') AS source_document_date, source_document_precision, source_quote,
                standing, confirmed_by, COALESCE(to_char(confirmed_on, 'YYYY-MM-DD'), '') AS confirmed_on, source_file
           FROM bw_dso.dso_policy_event
          WHERE load_class = 'REAL' AND from_sys_id = $1 AND load_history_id = $2
          ORDER BY state_code, effective_date, event_id`,
        [POLICY_FROM_SYS_ID, load.load_history_id],
      );
      const searches = await q<SearchRead>(
        `SELECT state_code, source_name, source_url, topic, to_char(searched_through, 'YYYY-MM-DD') AS searched_through, completeness, source_file
           FROM bw_dso.dso_policy_search
          WHERE load_class = 'REAL' AND from_sys_id = $1 AND load_history_id = $2
          ORDER BY state_code, source_name, topic`,
        [POLICY_FROM_SYS_ID, load.load_history_id],
      );
      if (events.length + searches.length !== Number(load.row_count)) {
        throw new Error(`the policy tables hold ${events.length} events and ${searches.length} searches, not the ${Number(load.row_count)} rows the load recorded; rerun policy-events-load`);
      }
      this.EventCount = events.length;
      this.ConfirmedEventCount = events.filter((e) => e.standing === 'confirmed').length;
      this.SuggestedEventCount = events.filter((e) => e.standing === 'suggested').length;
      this.SearchCount = searches.length;
      this.StateCount = new Set([...events.map((e) => e.state_code), ...searches.map((s) => s.state_code)]).size;

      const payload = {
        schema: POLICY_EVENTS_EXPORT_SCHEMA,
        generatedAt: new Date().toISOString(),
        loadClass: 'REAL',
        loadHistoryId: load.load_history_id,
        // The hash of the curated files as the load retained them: it ties this export to those files' bytes.
        contentHash: load.content_hash,
        load: {
          startedAt: load.started_at,
          completedAt: load.completed_at,
          notes: noteParts.filter((n) => !n.startsWith(POLICY_RULE_NOTE_PREFIX)).join(LOAD_NOTE_SEPARATOR),
          rowCount: Number(load.row_count),
        },
        // The load's as-of date is the latest searched-through day of any search on file, not the day the curation was done.
        latestSearchedThrough: load.as_of_date ?? '',
        rule,
        events: events.map((e) => ({
          id: e.event_id,
          state: e.state_code,
          kind: e.kind,
          direction: e.direction,
          summary: e.summary,
          effectiveDate: e.effective_date,
          effectivePrecision: e.effective_precision,
          endDate: e.end_date,
          endPrecision: e.end_precision,
          endedBy: e.ended_by_event_id,
          scope: {
            hcpcs: e.scope_hcpcs,
            hcpcsPrefixes: e.scope_hcpcs_prefixes,
            allServices: Boolean(e.scope_all_services),
            basis: e.scope_basis,
            note: e.scope_note,
          },
          source: {
            publisher: e.source_publisher,
            title: e.source_title,
            url: e.source_url,
            documentDate: e.source_document_date,
            documentPrecision: e.source_document_precision,
            quote: e.source_quote,
          },
          standing: e.standing,
          confirmedBy: e.confirmed_by,
          confirmedOn: e.confirmed_on,
          sourceFile: e.source_file,
        })),
        searches: searches.map((s) => ({
          state: s.state_code,
          source: s.source_name,
          url: s.source_url,
          topic: s.topic,
          searchedThrough: s.searched_through,
          completeness: s.completeness,
          sourceFile: s.source_file,
        })),
      };
      const text = `/**\n * Generated by XenoDroid BW export — do not hand-edit.\n * Law-and-policy layer: the curated policy events and the record of what was searched, as loaded.\n * Regenerate: npx tsx src/cli.ts policy-events-export (after policy-events-load) from xenodroid-bw.\n */\nexport const POLICY_EVENTS = ${JSON.stringify(payload, null, 2)};\n`;
      await fs.mkdir(path.dirname(this.ExportPath), { recursive: true });
      await fs.writeFile(this.ExportPath, text, 'utf8');
      this.ExportBytes = Buffer.byteLength(text);
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
