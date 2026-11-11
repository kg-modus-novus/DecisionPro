// CodeXen-Container: v1 kind=object container=PolicyEventOwner owns=policy-event
import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { Sha256 } from '../adapters/operationalPublicSources.js';

/**
 * PolicyEventOwner: owns the dated public policy events the Potential Fraud
 * Detection module tests a rise against (a law, a rule, a billing-code or
 * reporting change, an enforcement act), and beside them the record of which
 * sources were searched for each state. Plan:
 * docs/planning/law-and-policy-layer-codexen-plan.md.
 *
 * Business Action:
 *   LoadPolicyEventsAndSearchCoverage   read the curated files, retain them in
 *       PSA, refuse the whole load when any file, event or search is outside the
 *       rules below, and replace this source's REAL events and search coverage
 *       under one load history.
 *
 * Rules the owner enforces:
 *  - One file per state, named for it (KY.json). An event belongs to the state
 *    of its file, or to 'US'.
 *  - Every event names its source: publisher, title, link, document date and a
 *    quote from the document. The document is not dated after the load day
 *    (the local day of the machine that runs the load).
 *  - Every event has an effective date and a scope: named codes, code prefixes,
 *    or all services. The scope says whether the document names the codes or
 *    the codes stand in for a service family the document names; a stand-in
 *    carries a note, so a proxy is always labeled.
 *  - A temporary event ends one of two ways: its own document states the end
 *    date, or another event of the load ends it (endedBy) and its end is that
 *    event's effective date. Never both, and never before it starts.
 *  - A confirmed event is ended only by a confirmed event, so no unconfirmed
 *    suggestion decides how long a confirmed event was in force.
 *  - standing is 'suggested' until a person confirms the event. A confirmed
 *    event names who confirmed it and on what day; a suggested event names
 *    neither. Both are loaded (Director decision 4, 2026-11-11); only confirmed
 *    events may change a rating, which the reading program enforces.
 *  - Every file records at least one search (source, link, topic, the day it
 *    was searched through, partial or full), so "none found" is never said of
 *    a state nobody searched. No search is dated after the load day.
 *  - The curated files are the authoritative copy. The load replaces this
 *    source whole, so removing an event from a file withdraws it and editing
 *    its standing demotes it; the load lists the confirmed events it withdrew
 *    or demoted in its notes.
 *  - The load records the rule it ran under as a structured note, so an export
 *    names the rule of its load.
 *
 * Run cycle: one CLI process, one load history, one transaction around the
 * replace and the success record; no lock, retry or timer.
 */

export const POLICY_EVENT_KINDS = ['coverage', 'rate', 'authorization-or-limit', 'eligibility', 'code-change', 'reporting-change', 'funding', 'enforcement', 'governance', 'external-flag'] as const;
/** expands: would raise spending or loosen a control. restricts: would lower spending or tighten one. */
export const POLICY_EVENT_DIRECTIONS = ['expands', 'restricts', 'unstated'] as const;
export const POLICY_EVENT_STANDINGS = ['suggested', 'confirmed'] as const;
/** Whether the document names the codes of the scope, or the codes stand in for a service family it names. */
export const POLICY_SCOPE_BASES = ['named-in-document', 'stands-in-for-service-family'] as const;
export const POLICY_SEARCH_COMPLETENESS = ['partial', 'full'] as const;
/** A permanent event counts when it took effect within this many months before a rise (Director decision 2, 2026-11-11). A temporary event also counts while it is in force. */
export const POLICY_EVENT_LOOKBACK_MONTHS = 24;
/** One insert statement carries every event of a load; a load with more is refused. */
export const POLICY_EVENT_INSERT_LIMIT = 2000;
export const POLICY_FROM_SYS_ID = 'DECISIONPRO_CURATED_POLICY_EVENTS';
export const POLICY_DATA_REQUEST_ID = 'DR-REAL-POLICY-EVENTS';
export const POLICY_EVENT_FILE_SCHEMA = 'decisionpro/policy-events/v1';
/** The load's notes carry the rule it was made under after this prefix (one note, JSON). */
export const POLICY_RULE_NOTE_PREFIX = 'policy-rule-json:';

export type PolicyEventRow = {
  event_id: string;
  state_code: string;
  kind: string;
  direction: string;
  summary: string;
  effective_date: string;
  effective_precision: string;
  end_date: string;
  end_precision: string;
  ended_by_event_id: string;
  scope_hcpcs: string[];
  scope_hcpcs_prefixes: string[];
  scope_all_services: boolean;
  scope_basis: string;
  scope_note: string;
  source_publisher: string;
  source_title: string;
  source_url: string;
  source_document_date: string;
  source_document_precision: string;
  source_quote: string;
  standing: string;
  confirmed_by: string;
  confirmed_on: string;
  source_file: string;
};

export type PolicySearchRow = {
  state_code: string;
  source_name: string;
  source_url: string;
  topic: string;
  searched_through: string;
  completeness: string;
  source_file: string;
};

export type ParsedPolicyEventFile = { file_name: string; state_code: string; events: PolicyEventRow[]; searches: PolicySearchRow[] };
export type AccuracyCheck = { check_id: string; ok: boolean; expected: string; actual: string; detail: string };

/** The columns of each insert and their casts, in order; the statement and its values are both built from these lists. */
export const POLICY_EVENT_INSERT_COLUMNS = [
  ['event_id', ''], ['state_code', ''], ['kind', ''], ['direction', ''], ['summary', ''],
  ['effective_date', '::date'], ['effective_precision', ''], ['end_date', '::date'], ['end_precision', ''], ['ended_by_event_id', ''],
  ['scope_hcpcs', '::text[]'], ['scope_hcpcs_prefixes', '::text[]'], ['scope_all_services', ''], ['scope_basis', ''], ['scope_note', ''],
  ['source_publisher', ''], ['source_title', ''], ['source_url', ''], ['source_document_date', '::date'], ['source_document_precision', ''], ['source_quote', ''],
  ['standing', ''], ['confirmed_by', ''], ['confirmed_on', '::date'], ['source_file', ''],
  ['from_sys_id', ''], ['as_of_date', '::date'], ['load_class', ''], ['load_history_id', ''],
] as const;
export const POLICY_SEARCH_INSERT_COLUMNS = [
  ['state_code', ''], ['source_name', ''], ['source_url', ''], ['topic', ''], ['searched_through', '::date'], ['completeness', ''], ['source_file', ''],
  ['from_sys_id', ''], ['as_of_date', '::date'], ['load_class', ''], ['load_history_id', ''],
] as const;

const FILE_KEYS = ['schema', 'state', 'searches', 'events'];
const EVENT_KEYS = ['id', 'state', 'kind', 'direction', 'summary', 'effectiveDate', 'endDate', 'endedBy', 'scope', 'source', 'standing', 'confirmedBy', 'confirmedOn'];
const SCOPE_KEYS = ['hcpcs', 'hcpcsPrefixes', 'allServices', 'basis', 'note'];
const SOURCE_KEYS = ['publisher', 'title', 'url', 'documentDate', 'quote'];
const SEARCH_KEYS = ['source', 'url', 'topic', 'searchedThrough', 'completeness'];

/**
 * Pure boundary normalization of a stated date: the text 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'.
 * A start takes the first day of the stated period and an end takes the last.
 * An absent date is '' with precision ''. Anything else that is not such text is rejected, never read as absent.
 */
export function NormalizeStatedPolicyDate(stated: unknown, edge: 'start' | 'end', where: string): { date: string; precision: string } {
  if (stated === undefined || stated === null) return { date: '', precision: '' };
  if (typeof stated !== 'string') throw new Error(`${where}: date is not text`);
  if (stated.trim() === '') return { date: '', precision: '' };
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(stated.trim());
  if (!m) throw new Error(`${where}: date "${stated.trim()}" is not YYYY, YYYY-MM or YYYY-MM-DD`);
  const year = Number(m[1]);
  if (year < 1900) throw new Error(`${where}: date "${stated.trim()}" has no such year`);
  const month = m[2] === undefined ? (edge === 'start' ? 1 : 12) : Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`${where}: date "${stated.trim()}" has no such month`);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = m[3] === undefined ? (edge === 'start' ? 1 : lastDay) : Number(m[3]);
  if (day < 1 || day > lastDay) throw new Error(`${where}: date "${stated.trim()}" has no such day`);
  return {
    date: `${m[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    precision: m[3] !== undefined ? 'day' : m[2] !== undefined ? 'month' : 'year',
  };
}

/**
 * Pure parse of one curated policy-event file. Absent text fields become '' and absent lists become [].
 * A key the format does not know, a field of the wrong type, a malformed date, or a confirmation or
 * searched-through date that is stated but is not a day, is rejected: nothing stated is read as absent.
 * Whether an event satisfies the owner's rules is decided by the owner, not here.
 */
export function ParseCuratedPolicyEventFile(text: string, fileName: string): ParsedPolicyEventFile {
  const known = (o: Record<string, unknown>, keys: string[], where: string) => {
    for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`${where}: unknown key "${k}"`);
  };
  const obj = (v: unknown, where: string) => {
    if (v === undefined || v === null) return {} as Record<string, unknown>;
    if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where} is not an object`);
    return v as Record<string, unknown>;
  };
  const str = (v: unknown, where: string) => {
    if (v === undefined || v === null) return '';
    if (typeof v !== 'string') throw new Error(`${where} is not text`);
    return v.trim();
  };
  const list = (v: unknown, where: string) => {
    if (v === undefined || v === null) return [] as string[];
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error(`${where} is not a list of text`);
    return (v as string[]).map((x) => x.trim().toUpperCase());
  };
  const rows = (v: unknown, where: string) => {
    if (v === undefined || v === null) return [] as Array<Record<string, unknown>>;
    if (!Array.isArray(v) || v.some((x) => x === null || typeof x !== 'object' || Array.isArray(x))) throw new Error(`${where} is not a list of objects`);
    return v as Array<Record<string, unknown>>;
  };
  const day = (v: unknown, edge: 'start' | 'end', where: string) => {
    const d = NormalizeStatedPolicyDate(v, edge, where);
    if (d.precision !== '' && d.precision !== 'day') throw new Error(`${where}: must be a day, YYYY-MM-DD`);
    return d.date;
  };
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (e) {
    throw new Error(`${fileName}: not readable JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) throw new Error(`${fileName}: not a JSON object`);
  const file = json as Record<string, unknown>;
  known(file, FILE_KEYS, fileName);
  if (file.schema !== POLICY_EVENT_FILE_SCHEMA) throw new Error(`${fileName}: schema is not ${POLICY_EVENT_FILE_SCHEMA}`);
  const state_code = str(file.state, `${fileName} state`).toUpperCase();
  const events = rows(file.events, `${fileName} events`).map((e, i) => {
    const where = `${fileName} event ${i + 1}`;
    known(e, EVENT_KEYS, where);
    const scope = obj(e.scope, `${where} scope`);
    const source = obj(e.source, `${where} source`);
    known(scope, SCOPE_KEYS, `${where} scope`);
    known(source, SOURCE_KEYS, `${where} source`);
    if (scope.allServices !== undefined && typeof scope.allServices !== 'boolean') throw new Error(`${where} scope.allServices is not true or false`);
    const effective = NormalizeStatedPolicyDate(e.effectiveDate, 'start', `${where} effectiveDate`);
    const end = NormalizeStatedPolicyDate(e.endDate, 'end', `${where} endDate`);
    const document = NormalizeStatedPolicyDate(source.documentDate, 'start', `${where} source.documentDate`);
    return {
      event_id: str(e.id, `${where} id`),
      state_code: str(e.state, `${where} state`).toUpperCase(),
      kind: str(e.kind, `${where} kind`),
      direction: str(e.direction, `${where} direction`),
      summary: str(e.summary, `${where} summary`),
      effective_date: effective.date, effective_precision: effective.precision,
      end_date: end.date, end_precision: end.precision,
      ended_by_event_id: str(e.endedBy, `${where} endedBy`),
      scope_hcpcs: list(scope.hcpcs, `${where} scope.hcpcs`),
      scope_hcpcs_prefixes: list(scope.hcpcsPrefixes, `${where} scope.hcpcsPrefixes`),
      scope_all_services: scope.allServices === true,
      scope_basis: str(scope.basis, `${where} scope.basis`),
      scope_note: str(scope.note, `${where} scope.note`),
      source_publisher: str(source.publisher, `${where} source.publisher`),
      source_title: str(source.title, `${where} source.title`),
      source_url: str(source.url, `${where} source.url`),
      source_document_date: document.date, source_document_precision: document.precision,
      source_quote: str(source.quote, `${where} source.quote`),
      standing: str(e.standing, `${where} standing`),
      confirmed_by: str(e.confirmedBy, `${where} confirmedBy`),
      confirmed_on: day(e.confirmedOn, 'start', `${where} confirmedOn`),
      source_file: fileName,
    } satisfies PolicyEventRow;
  });
  const searches = rows(file.searches, `${fileName} searches`).map((s, i) => {
    const where = `${fileName} search ${i + 1}`;
    known(s, SEARCH_KEYS, where);
    return {
      state_code,
      source_name: str(s.source, `${where} source`),
      source_url: str(s.url, `${where} url`),
      topic: str(s.topic, `${where} topic`),
      searched_through: day(s.searchedThrough, 'end', `${where} searchedThrough`),
      completeness: str(s.completeness, `${where} completeness`),
      source_file: fileName,
    } satisfies PolicySearchRow;
  });
  return { file_name: fileName, state_code, events, searches };
}

const isLink = (url: string) => /^https?:\/\/\S+$/.test(url);
const isOneOf = (listed: readonly string[], value: string) => listed.includes(value);

export class PolicyEventOwner {
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  LoadDay = '';
  LoadHistoryID = '';
  LoadHistoryIsOpen = false;
  EventsDirectory = config.policyEventsDir;
  DirectoryEntryNames: string[] = [];
  EventFileNames: string[] = [];
  EventFileTexts: string[] = [];
  RetainedBytes: Buffer = Buffer.alloc(0);
  RetainedPsaKey = '';
  RetainedByteLength = 0;
  PsaIndexRowsInserted = 0;
  ParsedFiles: ParsedPolicyEventFile[] = [];
  EventRows: PolicyEventRow[] = [];
  SearchRows: PolicySearchRow[] = [];
  PreviouslyConfirmedEventIds: string[] = [];
  ConfirmedEventIdsWithdrawn: string[] = [];
  FilesNotNamedForTheirState = 0;
  FilesWithoutSearch = 0;
  EventsOutsideTheirFileState = 0;
  EventsWithoutIdOrSummary = 0;
  EventsWithDuplicateId = 0;
  EventsOfUnknownKindOrDirection = 0;
  EventsWithoutEffectiveDate = 0;
  EventsStatingTwoEnds = 0;
  EventsEndedByNoKnownEvent = 0;
  EventsEndingBeforeTheyStart = 0;
  ConfirmedEventsEndedByUnconfirmedEvents = 0;
  EventsWithoutScope = 0;
  EventsWithMalformedScope = 0;
  EventsWithoutNamedSource = 0;
  EventsWithoutSourceQuote = 0;
  EventsOfUnknownStanding = 0;
  EventsWithMismatchedConfirmation = 0;
  EventsDatedAfterTheLoadDay = 0;
  EventsBeyondTheInsertLimit = 0;
  SearchesWithoutNamedSource = 0;
  SearchesWithoutSearchedThroughDay = 0;
  SearchesOfUnknownCompleteness = 0;
  SearchesWithDuplicateIdentity = 0;
  SearchesDatedAfterTheLoadDay = 0;
  SuggestedEvents = 0;
  ConfirmedEvents = 0;
  ReconciliationIsClean = false;
  TransactionIsOpen = false;
  EventRowsInserted = 0;
  SearchRowsInserted = 0;
  RowsInserted = 0;
  Checks: AccuracyCheck[] = [];
  Notes: string[] = [];
  PsaStamp = '';
  AsOfDate = '';

  constructor(private client: pg.PoolClient) {}

  /** A thrown error from any atom is recorded here, at the molecule's boundary, and the open transaction is rolled back. */
  async LoadPolicyEventsAndSearchCoverage() {
    if (this.Status !== 'INITIAL') return;
    this.InitializeLoadRunState();
    try {
      await this.ReadEventsDirectory();
      this.SelectCuratedEventFileNames();
      await this.ReadCuratedEventFiles();
      this.NameLoadHistoryAndRetainedCopy();
      await this.OpenLoadHistory();
      this.MarkLoadHistoryOpen();
      this.ComposeRetainedCopy();
      await this.EnsurePsaRootIsReady();
      await this.RetainEventFilesInPsa();
      await this.IndexRetainedPsaObject();
      this.ParseCuratedEventFiles();
      this.CountEventsStatingTwoEnds();
      this.DateEventsEndedByAnotherEvent();
      this.CountFilesOutsideTheirRules();
      this.CountEventsOutsideTheirRules();
      this.CountSearchesOutsideTheirRules();
      this.CountEventsByStanding();
      this.ReconcilePolicyEvents();
      this.IsReconciliationClean();
      this.RefuseUncleanLoad();
      this.DateLoadAsOfLatestSearch();
      await this.ReadPreviouslyConfirmedEventIds();
      this.ListConfirmedEventsWithdrawn();
      await this.BeginReplaceTransaction();
      await this.DeleteEventRows();
      await this.InsertEventRows();
      await this.DeleteSearchRows();
      await this.InsertSearchRows();
      this.SumRowsInserted();
      await this.CompleteLoad();
      await this.CommitReplaceTransaction();
      this.MarkLoadSucceeded();
      await this.FailLoad();
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
      await this.RollbackReplaceTransaction();
      await this.FailLoad();
    }
  }

  /** PASSIVE */
  private InitializeLoadRunState() {
    this.Status = 'RUNNING';
    this.ErrorMessage = '';
    this.PsaStamp = new Date().toISOString().replace(/[:.]/g, '-');
    // The local day, shifted from UTC by the machine's offset, so it does not depend on the runtime's locale data.
    this.LoadDay = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    this.LoadHistoryID = '';
    this.LoadHistoryIsOpen = false;
    this.DirectoryEntryNames = [];
    this.EventFileNames = [];
    this.EventFileTexts = [];
    this.RetainedBytes = Buffer.alloc(0);
    this.RetainedPsaKey = '';
    this.RetainedByteLength = 0;
    this.PsaIndexRowsInserted = 0;
    this.ParsedFiles = [];
    this.EventRows = [];
    this.SearchRows = [];
    this.PreviouslyConfirmedEventIds = [];
    this.ConfirmedEventIdsWithdrawn = [];
    this.FilesNotNamedForTheirState = 0;
    this.FilesWithoutSearch = 0;
    this.EventsOutsideTheirFileState = 0;
    this.EventsWithoutIdOrSummary = 0;
    this.EventsWithDuplicateId = 0;
    this.EventsOfUnknownKindOrDirection = 0;
    this.EventsWithoutEffectiveDate = 0;
    this.EventsStatingTwoEnds = 0;
    this.EventsEndedByNoKnownEvent = 0;
    this.EventsEndingBeforeTheyStart = 0;
    this.ConfirmedEventsEndedByUnconfirmedEvents = 0;
    this.EventsWithoutScope = 0;
    this.EventsWithMalformedScope = 0;
    this.EventsWithoutNamedSource = 0;
    this.EventsWithoutSourceQuote = 0;
    this.EventsOfUnknownStanding = 0;
    this.EventsWithMismatchedConfirmation = 0;
    this.EventsDatedAfterTheLoadDay = 0;
    this.EventsBeyondTheInsertLimit = 0;
    this.SearchesWithoutNamedSource = 0;
    this.SearchesWithoutSearchedThroughDay = 0;
    this.SearchesOfUnknownCompleteness = 0;
    this.SearchesWithDuplicateIdentity = 0;
    this.SearchesDatedAfterTheLoadDay = 0;
    this.SuggestedEvents = 0;
    this.ConfirmedEvents = 0;
    this.ReconciliationIsClean = false;
    this.TransactionIsOpen = false;
    this.EventRowsInserted = 0;
    this.SearchRowsInserted = 0;
    this.RowsInserted = 0;
    this.Checks = [];
    this.Notes = [];
    this.AsOfDate = '';
  }

  /** ACTIVE */
  private async ReadEventsDirectory() {
    if (this.DirectoryEntryNames.length > 0) return;
    this.DirectoryEntryNames = await fs.readdir(this.EventsDirectory);
    if (this.DirectoryEntryNames.length === 0) throw new Error(`no curated policy-event file in ${this.EventsDirectory}`);
  }

  /** PASSIVE: the curated files, one per state, in name order. */
  private SelectCuratedEventFileNames() {
    this.EventFileNames = this.DirectoryEntryNames.filter((n) => n.toLowerCase().endsWith('.json')).sort();
    if (this.EventFileNames.length === 0) throw new Error(`no curated policy-event file in ${this.EventsDirectory}`);
  }

  /** ACTIVE */
  private async ReadCuratedEventFiles() {
    if (this.EventFileNames.length === 0 || this.EventFileTexts.length > 0) return;
    this.EventFileTexts = await Promise.all(this.EventFileNames.map((n) => fs.readFile(path.join(this.EventsDirectory, n), 'utf8')));
    if (this.EventFileTexts.some((t) => t.trim() === '')) throw new Error(`an empty curated policy-event file in ${this.EventsDirectory}`);
  }

  /** PASSIVE: the names under which this load is recorded and its files are retained. */
  private NameLoadHistoryAndRetainedCopy() {
    this.LoadHistoryID = newId('LH-POLICY');
    this.RetainedPsaKey = `psa/${POLICY_FROM_SYS_ID}/REAL/${this.PsaStamp}/policy_event_files.json`;
  }

  /** ACTIVE */
  private async OpenLoadHistory() {
    if (this.LoadHistoryID === '' || this.LoadHistoryIsOpen) return;
    await InsertLoadHistory(this.client, {
      load_history_id: this.LoadHistoryID,
      data_request_id: POLICY_DATA_REQUEST_ID,
      started_at: new Date(),
      source_uri: `curated:${this.EventFileNames.join(',')}`,
      load_class: 'REAL',
    });
  }

  /** PASSIVE: reached only when the load history row was written, so a failure is recorded on a row that exists. */
  private MarkLoadHistoryOpen() {
    this.LoadHistoryIsOpen = true;
  }

  /** PASSIVE: the files as read, under their names, as the one object PSA retains. */
  private ComposeRetainedCopy() {
    this.RetainedBytes = Buffer.from(JSON.stringify(this.EventFileNames.map((name, i) => ({ name, text: this.EventFileTexts[i] }))), 'utf8');
  }

  /** ACTIVE */
  private async EnsurePsaRootIsReady() {
    if (this.RetainedBytes.length === 0) return;
    await psaStore.EnsureRootReady();
  }

  /** ACTIVE */
  private async RetainEventFilesInPsa() {
    if (this.RetainedBytes.length === 0 || this.RetainedByteLength > 0) return;
    this.RetainedByteLength = (await psaStore.PutObject(this.RetainedPsaKey, this.RetainedBytes)).byteLength;
    if (this.RetainedByteLength !== this.RetainedBytes.length) throw new Error('PSA retained a short policy_event_files.json');
  }

  /** ACTIVE */
  private async IndexRetainedPsaObject() {
    if (this.RetainedByteLength === 0 || this.PsaIndexRowsInserted > 0) return;
    this.PsaIndexRowsInserted = (await this.client.query(
      `INSERT INTO bw_psa_meta.object_index (object_key, from_sys_id, load_history_id, load_class, content_hash, byte_length)
       VALUES ($1,$2,$3,'REAL',$4,$5)`,
      [this.RetainedPsaKey, POLICY_FROM_SYS_ID, this.LoadHistoryID, Sha256(this.RetainedBytes), this.RetainedBytes.length],
    )).rowCount ?? 0;
    if (this.PsaIndexRowsInserted !== 1) throw new Error('the PSA object index did not record policy_event_files.json');
  }

  /** PASSIVE: every file typed into event rows and search rows; a malformed file stops the load. */
  private ParseCuratedEventFiles() {
    this.ParsedFiles = this.EventFileNames.map((name, i) => ParseCuratedPolicyEventFile(this.EventFileTexts[i], name));
    this.EventRows = this.ParsedFiles.flatMap((f) => f.events);
    this.SearchRows = this.ParsedFiles.flatMap((f) => f.searches);
    this.Notes.push(`read ${this.EventRows.length} policy events and ${this.SearchRows.length} searches from ${this.EventFileNames.length} curated files (${this.EventFileNames.join(', ')})`);
  }

  /** PASSIVE: events that both state their own end date and name an event that ends them. Counted before the ends are dated, while a stated end can still be told from a derived one. */
  private CountEventsStatingTwoEnds() {
    this.EventsStatingTwoEnds = this.EventRows.filter((e) => e.ended_by_event_id !== '' && e.end_date !== '').length;
  }

  /** PASSIVE: an event another event ends takes that event's effective date as its end. The ending event is a different event of the same state or of US, with an effective date, that this event does not itself end; an event whose ender is not found keeps no end and is counted below. */
  private DateEventsEndedByAnotherEvent() {
    for (const e of this.EventRows) {
      if (e.ended_by_event_id === '' || e.end_date !== '') continue;
      for (const ender of this.EventRows) {
        if (ender.event_id !== e.ended_by_event_id || ender.event_id === e.event_id || ender.effective_date === '') continue;
        if (ender.state_code !== e.state_code && ender.state_code !== 'US') continue;
        if (ender.ended_by_event_id === e.event_id) continue;
        e.end_date = ender.effective_date;
        e.end_precision = ender.effective_precision;
      }
    }
  }

  /** PASSIVE: files not named for the state they declare (KY.json for KY, so one file per state), and files that record no search. */
  private CountFilesOutsideTheirRules() {
    for (const f of this.ParsedFiles) {
      if (!/^[A-Z]{2}$/.test(f.state_code) || f.file_name !== `${f.state_code}.json`) this.FilesNotNamedForTheirState += 1;
      if (f.searches.length === 0) this.FilesWithoutSearch += 1;
    }
  }

  /** PASSIVE: events that break a rule of the owner, one counter per rule. */
  private CountEventsOutsideTheirRules() {
    for (const f of this.ParsedFiles) this.EventsOutsideTheirFileState += f.events.filter((e) => e.state_code !== f.state_code && e.state_code !== 'US').length;
    this.EventsWithDuplicateId = this.EventRows.filter((e, i) => e.event_id !== '' && this.EventRows.findIndex((x) => x.event_id === e.event_id) < i).length;
    this.EventsBeyondTheInsertLimit = Math.max(0, this.EventRows.length - POLICY_EVENT_INSERT_LIMIT);
    for (const e of this.EventRows) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(e.event_id) || e.summary === '') this.EventsWithoutIdOrSummary += 1;
      if (!isOneOf(POLICY_EVENT_KINDS, e.kind) || !isOneOf(POLICY_EVENT_DIRECTIONS, e.direction)) this.EventsOfUnknownKindOrDirection += 1;
      if (e.effective_date === '') this.EventsWithoutEffectiveDate += 1;
      if (e.ended_by_event_id !== '' && e.end_date === '') this.EventsEndedByNoKnownEvent += 1;
      if (e.end_date !== '' && e.effective_date !== '' && e.end_date < e.effective_date) this.EventsEndingBeforeTheyStart += 1;
      if (e.standing === 'confirmed' && e.ended_by_event_id !== '' && !this.EventRows.some((x) => x.event_id === e.ended_by_event_id && x.standing === 'confirmed')) this.ConfirmedEventsEndedByUnconfirmedEvents += 1;
      if (!e.scope_all_services && e.scope_hcpcs.length === 0 && e.scope_hcpcs_prefixes.length === 0) this.EventsWithoutScope += 1;
      if (e.scope_hcpcs.some((c) => !/^[A-Z0-9]{5}$/.test(c)) || e.scope_hcpcs_prefixes.some((p) => !/^[A-Z0-9]{1,4}$/.test(p))
        || (e.scope_all_services && e.scope_hcpcs.length + e.scope_hcpcs_prefixes.length > 0)
        || !isOneOf(POLICY_SCOPE_BASES, e.scope_basis)
        || (e.scope_basis === 'stands-in-for-service-family' && e.scope_note === '')) this.EventsWithMalformedScope += 1;
      if (!isLink(e.source_url) || e.source_publisher === '' || e.source_title === '' || e.source_document_date === '') this.EventsWithoutNamedSource += 1;
      if (e.source_quote === '') this.EventsWithoutSourceQuote += 1;
      if (!isOneOf(POLICY_EVENT_STANDINGS, e.standing)) this.EventsOfUnknownStanding += 1;
      if (e.standing === 'confirmed' && (e.confirmed_by === '' || e.confirmed_on === '')) this.EventsWithMismatchedConfirmation += 1;
      if (e.standing !== 'confirmed' && (e.confirmed_by !== '' || e.confirmed_on !== '')) this.EventsWithMismatchedConfirmation += 1;
      if (e.standing === 'confirmed' && e.confirmed_on !== '' && e.confirmed_on < e.source_document_date) this.EventsWithMismatchedConfirmation += 1;
      if (e.source_document_date > this.LoadDay || e.confirmed_on > this.LoadDay) this.EventsDatedAfterTheLoadDay += 1;
    }
  }

  /** PASSIVE: searches that break a rule of the owner, one counter per rule. */
  private CountSearchesOutsideTheirRules() {
    this.SearchesWithDuplicateIdentity = this.SearchRows.filter((s, i) => this.SearchRows.findIndex((x) => x.state_code === s.state_code && x.source_name === s.source_name && x.topic === s.topic) < i).length;
    for (const s of this.SearchRows) {
      if (s.source_name === '' || !isLink(s.source_url) || s.topic === '') this.SearchesWithoutNamedSource += 1;
      if (s.searched_through === '') this.SearchesWithoutSearchedThroughDay += 1;
      if (!isOneOf(POLICY_SEARCH_COMPLETENESS, s.completeness)) this.SearchesOfUnknownCompleteness += 1;
      if (s.searched_through > this.LoadDay) this.SearchesDatedAfterTheLoadDay += 1;
    }
  }

  /** PASSIVE */
  private CountEventsByStanding() {
    this.SuggestedEvents = this.EventRows.filter((e) => e.standing === 'suggested').length;
    this.ConfirmedEvents = this.EventRows.filter((e) => e.standing === 'confirmed').length;
  }

  /** PASSIVE: one check per counter, and the rule the load ran under as a structured note. */
  private ReconcilePolicyEvents() {
    this.Checks = ([
      ['policy-files-named-for-their-state', this.FilesNotNamedForTheirState, 'curated files not named for the two-letter state they declare (one file per state, KY.json for KY)'],
      ['policy-files-record-a-search', this.FilesWithoutSearch, 'curated files that record no search'],
      ['policy-events-belong-to-their-file-state', this.EventsOutsideTheirFileState, 'events whose state is neither the state of their file nor US'],
      ['policy-events-have-id-and-summary', this.EventsWithoutIdOrSummary, 'events without a summary or without an id of lower-case letters, digits and hyphens'],
      ['policy-events-have-one-id-each', this.EventsWithDuplicateId, 'events that repeat another event\'s id'],
      ['policy-events-of-known-kind-and-direction', this.EventsOfUnknownKindOrDirection, `events whose kind or direction is not in the owner's lists (${POLICY_EVENT_KINDS.join(', ')}; ${POLICY_EVENT_DIRECTIONS.join(', ')})`],
      ['policy-events-have-effective-date', this.EventsWithoutEffectiveDate, 'events without an effective date'],
      ['policy-events-state-one-end', this.EventsStatingTwoEnds, 'events that both state an end date and name an event that ends them'],
      ['policy-events-ended-by-a-known-event', this.EventsEndedByNoKnownEvent, 'events ended by themselves, by an event they end, by an event the load does not hold for their state or US, or by an event with no effective date'],
      ['policy-events-end-after-they-start', this.EventsEndingBeforeTheyStart, 'temporary events whose end is before their effective date'],
      ['policy-confirmed-events-ended-by-confirmed-events', this.ConfirmedEventsEndedByUnconfirmedEvents, 'confirmed events ended by an event that is not confirmed'],
      ['policy-events-have-scope', this.EventsWithoutScope, 'events that name no code, no code prefix and not all services'],
      ['policy-events-scope-well-formed', this.EventsWithMalformedScope, `events with a code that is not five letters or digits, a prefix that is not one to four, all services together with codes, a scope basis not in ${POLICY_SCOPE_BASES.join(', ')}, or a stand-in scope without its note`],
      ['policy-events-name-their-source', this.EventsWithoutNamedSource, 'events without a source publisher, title, link or document date'],
      ['policy-events-quote-their-source', this.EventsWithoutSourceQuote, 'events without a quote from the source document'],
      ['policy-events-of-known-standing', this.EventsOfUnknownStanding, `events whose standing is not one of ${POLICY_EVENT_STANDINGS.join(', ')}`],
      ['policy-events-confirmation-matches-standing', this.EventsWithMismatchedConfirmation, 'confirmed events that do not name who confirmed them and on what day or are confirmed before their document is dated, or suggested events that name either'],
      ['policy-events-not-dated-after-the-load-day', this.EventsDatedAfterTheLoadDay, `events whose source document or confirmation is dated after the load day ${this.LoadDay}`],
      ['policy-events-within-the-insert-limit', this.EventsBeyondTheInsertLimit, `events beyond the ${POLICY_EVENT_INSERT_LIMIT} one load may carry`],
      ['policy-searches-name-their-source', this.SearchesWithoutNamedSource, 'searches without a source, link or topic'],
      ['policy-searches-have-searched-through-day', this.SearchesWithoutSearchedThroughDay, 'searches without the day they were searched through'],
      ['policy-searches-of-known-completeness', this.SearchesOfUnknownCompleteness, `searches whose completeness is not one of ${POLICY_SEARCH_COMPLETENESS.join(', ')}`],
      ['policy-searches-have-one-identity-each', this.SearchesWithDuplicateIdentity, 'searches that repeat another search\'s state, source and topic'],
      ['policy-searches-not-dated-after-the-load-day', this.SearchesDatedAfterTheLoadDay, `searches dated after the load day ${this.LoadDay}`],
    ] as Array<[string, number, string]>).map(([check_id, count, detail]) => ({ check_id, ok: count === 0, expected: '0', actual: String(count), detail }));
    this.Notes.push(`${this.ConfirmedEvents} confirmed, ${this.SuggestedEvents} suggested`);
    this.Notes.push(`${POLICY_RULE_NOTE_PREFIX}${JSON.stringify({ lookbackMonths: POLICY_EVENT_LOOKBACK_MONTHS, kinds: POLICY_EVENT_KINDS, directions: POLICY_EVENT_DIRECTIONS, standings: POLICY_EVENT_STANDINGS, scopeBases: POLICY_SCOPE_BASES, searchCompleteness: POLICY_SEARCH_COMPLETENESS })}`);
  }

  /** PASSIVE question: writes ReconciliationIsClean. */
  private IsReconciliationClean() {
    this.ReconciliationIsClean = this.Checks.length > 0 && this.Checks.every((c) => c.ok);
  }

  /** PASSIVE: an unclean load is recorded as failed, so no row is replaced. */
  private RefuseUncleanLoad() {
    if (this.ReconciliationIsClean) return;
    this.Status = 'FAILED';
    this.ErrorMessage = `reconciliation failed: ${this.Checks.filter((c) => !c.ok).map((c) => c.check_id).join(', ')}`;
  }

  /** PASSIVE: the load is as of the latest day any source was searched through. */
  private DateLoadAsOfLatestSearch() {
    if (!this.ReconciliationIsClean) return;
    this.AsOfDate = this.SearchRows.map((s) => s.searched_through).sort().at(-1) ?? '';
  }

  /** ACTIVE: the confirmed events this source holds before the replace. */
  private async ReadPreviouslyConfirmedEventIds() {
    if (!this.ReconciliationIsClean) return;
    this.PreviouslyConfirmedEventIds = (await this.client.query<{ event_id: string }>(
      `SELECT event_id FROM bw_dso.dso_policy_event WHERE load_class = 'REAL' AND from_sys_id = $1 AND standing = 'confirmed' ORDER BY event_id`,
      [POLICY_FROM_SYS_ID],
    )).rows.map((r) => r.event_id);
  }

  /** PASSIVE: confirmed events this load withdraws or demotes, listed in the load's notes. The curated files are authoritative, so the load does not refuse them. */
  private ListConfirmedEventsWithdrawn() {
    if (!this.ReconciliationIsClean) return;
    this.ConfirmedEventIdsWithdrawn = this.PreviouslyConfirmedEventIds.filter((id) => !this.EventRows.some((e) => e.event_id === id && e.standing === 'confirmed'));
    this.Notes.push(`${this.ConfirmedEventIdsWithdrawn.length} confirmed events withdrawn or no longer confirmed${this.ConfirmedEventIdsWithdrawn.length > 0 ? `: ${this.ConfirmedEventIdsWithdrawn.join(', ')}` : ''}`);
  }

  /** ACTIVE */
  private async BeginReplaceTransaction() {
    if (!this.ReconciliationIsClean || this.TransactionIsOpen) return;
    await this.client.query('BEGIN');
    this.TransactionIsOpen = true;
  }

  /** ACTIVE */
  private async DeleteEventRows() {
    if (!this.TransactionIsOpen) return;
    await this.client.query(`DELETE FROM bw_dso.dso_policy_event WHERE load_class = 'REAL' AND from_sys_id = $1`, [POLICY_FROM_SYS_ID]);
  }

  /** ACTIVE: one multi-row insert built from POLICY_EVENT_INSERT_COLUMNS. A permanent event's absent end date, and a suggested event's absent confirmation day, cross the database boundary as NULL. */
  private async InsertEventRows() {
    if (!this.TransactionIsOpen || this.EventRows.length === 0) return;
    this.EventRowsInserted = (await this.client.query(
      `INSERT INTO bw_dso.dso_policy_event (${POLICY_EVENT_INSERT_COLUMNS.map(([name]) => name).join(', ')})
       VALUES ${this.EventRows.map((_, j) => `(${POLICY_EVENT_INSERT_COLUMNS.map(([, cast], k) => `$${j * POLICY_EVENT_INSERT_COLUMNS.length + k + 1}${cast}`).join(',')})`).join(',')}`,
      this.EventRows.flatMap((e) => POLICY_EVENT_INSERT_COLUMNS.map(([name]) => ({
        ...e, end_date: e.end_date === '' ? null : e.end_date, confirmed_on: e.confirmed_on === '' ? null : e.confirmed_on,
        from_sys_id: POLICY_FROM_SYS_ID, as_of_date: this.AsOfDate, load_class: 'REAL', load_history_id: this.LoadHistoryID,
      })[name])),
    )).rowCount ?? 0;
    if (this.EventRowsInserted !== this.EventRows.length) throw new Error(`inserted ${this.EventRowsInserted} of ${this.EventRows.length} policy events`);
  }

  /** ACTIVE */
  private async DeleteSearchRows() {
    if (!this.TransactionIsOpen) return;
    await this.client.query(`DELETE FROM bw_dso.dso_policy_search WHERE load_class = 'REAL' AND from_sys_id = $1`, [POLICY_FROM_SYS_ID]);
  }

  /** ACTIVE: one multi-row insert built from POLICY_SEARCH_INSERT_COLUMNS. */
  private async InsertSearchRows() {
    if (!this.TransactionIsOpen || this.SearchRows.length === 0) return;
    this.SearchRowsInserted = (await this.client.query(
      `INSERT INTO bw_dso.dso_policy_search (${POLICY_SEARCH_INSERT_COLUMNS.map(([name]) => name).join(', ')})
       VALUES ${this.SearchRows.map((_, j) => `(${POLICY_SEARCH_INSERT_COLUMNS.map(([, cast], k) => `$${j * POLICY_SEARCH_INSERT_COLUMNS.length + k + 1}${cast}`).join(',')})`).join(',')}`,
      this.SearchRows.flatMap((s) => POLICY_SEARCH_INSERT_COLUMNS.map(([name]) => ({
        ...s, from_sys_id: POLICY_FROM_SYS_ID, as_of_date: this.AsOfDate, load_class: 'REAL', load_history_id: this.LoadHistoryID,
      })[name])),
    )).rowCount ?? 0;
    if (this.SearchRowsInserted !== this.SearchRows.length) throw new Error(`inserted ${this.SearchRowsInserted} of ${this.SearchRows.length} policy searches`);
  }

  /** PASSIVE */
  private SumRowsInserted() {
    this.RowsInserted = this.EventRowsInserted + this.SearchRowsInserted;
  }

  /** ACTIVE: the success record is written inside the replace transaction, so the rows and the load that carries them commit together. */
  private async CompleteLoad() {
    if (!this.TransactionIsOpen || !this.LoadHistoryIsOpen) return;
    await CompleteLoadHistory(this.client, this.LoadHistoryID, {
      status: 'SUCCEEDED', row_count: this.RowsInserted, content_hash: Sha256(this.RetainedBytes), as_of_date: this.AsOfDate,
      notes: this.Notes.join(' | '),
    });
  }

  /** ACTIVE */
  private async CommitReplaceTransaction() {
    if (!this.TransactionIsOpen) return;
    await this.client.query('COMMIT');
    this.TransactionIsOpen = false;
  }

  /** ACTIVE (error path only) */
  private async RollbackReplaceTransaction() {
    if (!this.TransactionIsOpen) return;
    await this.client.query('ROLLBACK');
    this.TransactionIsOpen = false;
  }

  /** PASSIVE: the run reached its end with reconciliation clean and the replace committed. */
  private MarkLoadSucceeded() {
    if (this.Status !== 'RUNNING') return;
    this.Status = 'SUCCEEDED';
  }

  /** ACTIVE (failed runs only): recorded outside the rolled-back transaction, on the load history row this run opened. */
  private async FailLoad() {
    if (!this.LoadHistoryIsOpen || this.Status !== 'FAILED') return;
    await CompleteLoadHistory(this.client, this.LoadHistoryID, { status: 'FAILED', notes: this.ErrorMessage });
  }
}
