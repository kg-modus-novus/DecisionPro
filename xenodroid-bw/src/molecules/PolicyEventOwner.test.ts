import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type pg from 'pg';
import { BW_ROOT } from '../config.js';
import { psaStore } from '../psa/filesystemPsa.js';
import {
  NormalizeStatedPolicyDate, ParseCuratedPolicyEventFile, POLICY_EVENT_FILE_SCHEMA, POLICY_EVENT_INSERT_COLUMNS, POLICY_EVENT_INSERT_LIMIT, POLICY_EVENT_LOOKBACK_MONTHS,
  POLICY_FROM_SYS_ID, POLICY_RULE_NOTE_PREFIX, POLICY_SEARCH_INSERT_COLUMNS, PolicyEventOwner,
} from './PolicyEventOwner.js';

// Run: node --import tsx --test src/molecules/PolicyEventOwner.test.ts

const EVENT = {
  id: 'ky-test-suspension', state: 'KY', kind: 'authorization-or-limit', direction: 'expands',
  summary: 'Prior authorization stays suspended.', effectiveDate: '2023-04-25', endDate: '2025-06', endedBy: '',
  scope: { hcpcs: [], hcpcsPrefixes: ['h'], allServices: false, basis: 'stands-in-for-service-family', note: 'H codes stand in for behavioral health.' },
  source: { publisher: 'Kentucky DMS', title: 'Tracker', url: 'https://example.gov/tracker.pdf', documentDate: '2023-04-25', quote: 'PAs remain suspended.' },
  standing: 'suggested', confirmedBy: '', confirmedOn: '',
};
const SEARCH = { source: 'Kentucky DMS provider letters', url: 'https://example.gov/dms/', topic: 'psychoeducation', searchedThrough: '2026-11-11', completeness: 'partial' };
const file = (events: unknown[], searches: unknown[] = [SEARCH], state = 'KY') => JSON.stringify({ schema: POLICY_EVENT_FILE_SCHEMA, state, searches, events });

describe('NormalizeStatedPolicyDate', () => {
  it('takes the first day of a stated start period and the last day of a stated end period', () => {
    assert.deepEqual(NormalizeStatedPolicyDate('2023-04', 'start', 't'), { date: '2023-04-01', precision: 'month' });
    assert.deepEqual(NormalizeStatedPolicyDate('2024-02', 'end', 't'), { date: '2024-02-29', precision: 'month' });
    assert.deepEqual(NormalizeStatedPolicyDate('2020', 'end', 't'), { date: '2020-12-31', precision: 'year' });
    assert.deepEqual(NormalizeStatedPolicyDate('2025-06-25', 'end', 't'), { date: '2025-06-25', precision: 'day' });
  });

  it('reads an absent date as absent and rejects anything else that is not a date in text', () => {
    assert.deepEqual(NormalizeStatedPolicyDate('', 'end', 't'), { date: '', precision: '' });
    assert.deepEqual(NormalizeStatedPolicyDate(undefined, 'end', 't'), { date: '', precision: '' });
    assert.throws(() => NormalizeStatedPolicyDate('June 2025', 'end', 't'), /not YYYY/);
    assert.throws(() => NormalizeStatedPolicyDate('2025-13', 'end', 't'), /no such month/);
    assert.throws(() => NormalizeStatedPolicyDate('2025-02-30', 'start', 't'), /no such day/);
    assert.throws(() => NormalizeStatedPolicyDate('0000', 'start', 't'), /no such year/);
    assert.throws(() => NormalizeStatedPolicyDate(2023, 'start', 't'), /date is not text/);
    assert.throws(() => NormalizeStatedPolicyDate(['2025'], 'end', 't'), /date is not text/);
  });
});

describe('ParseCuratedPolicyEventFile', () => {
  it('types an event: dates normalized with their precision, codes upper-cased, a permanent event with no end date', () => {
    const parsed = ParseCuratedPolicyEventFile(`\uFEFF${file([EVENT, { ...EVENT, id: 'ky-permanent', endDate: '', source: { ...EVENT.source, documentDate: '2024-05' } }])}`, 'KY.json');
    assert.equal(parsed.state_code, 'KY');
    assert.equal(parsed.file_name, 'KY.json');
    assert.equal(parsed.events[0].effective_date, '2023-04-25');
    assert.equal(parsed.events[0].end_date, '2025-06-30');
    assert.equal(parsed.events[0].end_precision, 'month');
    assert.deepEqual(parsed.events[0].scope_hcpcs_prefixes, ['H']);
    assert.equal(parsed.events[0].scope_basis, 'stands-in-for-service-family');
    assert.equal(parsed.events[1].end_date, '');
    assert.equal(parsed.events[1].end_precision, '');
    assert.deepEqual([parsed.events[1].source_document_date, parsed.events[1].source_document_precision], ['2024-05-01', 'month']);
    assert.equal(parsed.searches[0].searched_through, '2026-11-11');
    assert.equal(parsed.searches[0].state_code, 'KY');
  });

  it('rejects what it cannot read as stated: another schema, a wrong type, a malformed date, unreadable JSON', () => {
    assert.throws(() => ParseCuratedPolicyEventFile(JSON.stringify({ schema: 'other', state: 'KY' }), 'KY.json'), /schema is not/);
    assert.throws(() => ParseCuratedPolicyEventFile(file([{ ...EVENT, summary: 7 }]), 'KY.json'), /summary is not text/);
    assert.throws(() => ParseCuratedPolicyEventFile(file([{ ...EVENT, endDate: 'mid-2025' }]), 'KY.json'), /endDate: date "mid-2025"/);
    assert.throws(() => ParseCuratedPolicyEventFile(file([{ ...EVENT, effectiveDate: 2023 }]), 'KY.json'), /effectiveDate: date is not text/);
    assert.throws(() => ParseCuratedPolicyEventFile('{ "schema": ', 'KY.json'), /KY\.json: not readable JSON/);
    assert.throws(() => ParseCuratedPolicyEventFile('[]', 'KY.json'), /KY\.json: not a JSON object/);
  });

  it('rejects a key it does not know at every level, so a misspelled end date is never read as no end date', () => {
    assert.throws(() => ParseCuratedPolicyEventFile(file([{ ...EVENT, endDate: undefined, enddate: '2025-06' }]), 'KY.json'), /event 1: unknown key "enddate"/);
    assert.throws(() => ParseCuratedPolicyEventFile(JSON.stringify({ schema: POLICY_EVENT_FILE_SCHEMA, state: 'KY', searches: [SEARCH], events: [], notes: 'x' }), 'KY.json'), /unknown key "notes"/);
    assert.throws(() => ParseCuratedPolicyEventFile(file([{ ...EVENT, scope: { ...EVENT.scope, codes: ['H2027'] } }]), 'KY.json'), /scope: unknown key "codes"/);
    assert.throws(() => ParseCuratedPolicyEventFile(file([{ ...EVENT, source: { ...EVENT.source, date: '2023' } }]), 'KY.json'), /source: unknown key "date"/);
    assert.throws(() => ParseCuratedPolicyEventFile(file([EVENT], [{ ...SEARCH, through: '2026-11-11' }]), 'KY.json'), /search 1: unknown key "through"/);
  });

  it('rejects a confirmation or searched-through date that is stated but is not a day', () => {
    assert.throws(() => ParseCuratedPolicyEventFile(file([{ ...EVENT, confirmedOn: '2026-11' }]), 'KY.json'), /confirmedOn: must be a day/);
    assert.throws(() => ParseCuratedPolicyEventFile(file([EVENT], [{ ...SEARCH, searchedThrough: '2026-11' }]), 'KY.json'), /searchedThrough: must be a day/);
  });
});

// The load molecule end to end: a temporary events directory and PSA root, and a stub client that
// records every statement. The stub counts the rows of an insert from the statement's own column
// list and placeholders, and fails the test when the values do not line up with them.
type Statement = { sql: string; values: unknown[] };
type StubOptions = { shortInsert?: RegExp; failOn?: RegExp; confirmedBefore?: string[] };
function stubClient(statements: Statement[], options: StubOptions = {}) {
  let refusedOnce = false;
  return {
    async query(sql: string, values: unknown[] = []) {
      statements.push({ sql, values });
      // The first statement that matches failOn is refused; later ones (the failure record) go through.
      if (options.failOn?.test(sql) && !refusedOnce) { refusedOnce = true; throw new Error('stub: statement refused'); }
      if (/^\s*SELECT event_id FROM bw_dso\.dso_policy_event/.test(sql)) return { rows: (options.confirmedBefore ?? []).map((event_id) => ({ event_id })), rowCount: (options.confirmedBefore ?? []).length };
      const insert = /INSERT INTO bw_dso\.\w+ \(([^)]*)\)/.exec(sql);
      if (!insert) return { rows: [], rowCount: 1 };
      const columns = insert[1].split(',').length;
      const placeholders = (sql.match(/\$\d+/g) ?? []).length;
      assert.equal(values.length, placeholders, 'one value per placeholder');
      assert.equal(placeholders % columns, 0, 'whole rows only');
      return { rows: [], rowCount: placeholders / columns - (options.shortInsert?.test(sql) ? 1 : 0) };
    },
  } as unknown as pg.PoolClient;
}
const tag = (s: Statement) => {
  const sql = s.sql.trim();
  if (/^INSERT INTO bw_ctl\.load_history/.test(sql)) return 'open-history';
  if (/^INSERT INTO bw_psa_meta\.object_index/.test(sql)) return 'index-psa';
  if (/^SELECT event_id FROM bw_dso\.dso_policy_event/.test(sql)) return 'read-confirmed';
  if (/^DELETE FROM bw_dso\.dso_policy_event/.test(sql)) return 'delete-events';
  if (/^INSERT INTO bw_dso\.dso_policy_event/.test(sql)) return 'insert-events';
  if (/^DELETE FROM bw_dso\.dso_policy_search/.test(sql)) return 'delete-searches';
  if (/^INSERT INTO bw_dso\.dso_policy_search/.test(sql)) return 'insert-searches';
  if (/^UPDATE bw_ctl\.load_history/.test(sql)) return `history-${String(s.values[1])}`;
  return sql;
};
const cell = (insert: Statement, columns: ReadonlyArray<readonly [string, string]>, row: number, name: string) => insert.values[row * columns.length + columns.findIndex(([n]) => n === name)];

let root = '';
const psaRootBefore = psaStore.root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-owner-')); psaStore.root = path.join(root, 'psa'); });
after(async () => { psaStore.root = psaRootBefore; await fs.rm(root, { recursive: true, force: true }); });

async function load(files: Record<string, string>, options: StubOptions = {}) {
  const dir = await fs.mkdtemp(path.join(root, 'events-'));
  for (const [name, text] of Object.entries(files)) await fs.writeFile(path.join(dir, name), text);
  const statements: Statement[] = [];
  const owner = new PolicyEventOwner(stubClient(statements, options));
  owner.EventsDirectory = dir;
  await owner.LoadPolicyEventsAndSearchCoverage();
  return { owner, statements, tags: statements.map(tag) };
}
const replaced = (tags: string[]) => tags.some((t) => /^(BEGIN|delete-|insert-)/.test(t));
async function refused(event: unknown, check: RegExp, searches: unknown[] = [SEARCH], state = 'KY', name = 'KY.json') {
  const { owner, tags } = await load({ [name]: file([event], searches, state) });
  assert.equal(owner.Status, 'FAILED');
  assert.match(owner.ErrorMessage, check);
  assert.equal(replaced(tags), false, 'nothing is replaced');
  assert.equal(tags.at(-1), 'history-FAILED', 'the failure is recorded on the load history');
  return owner;
}

describe('PolicyEventOwner', () => {
  it('loads a clean set, in order: history opened, files retained, both tables replaced and the success recorded inside one transaction', async () => {
    const confirmed = { ...EVENT, id: 'ky-confirmed', endDate: '', standing: 'confirmed', confirmedBy: 'Ken Greenwood', confirmedOn: '2026-11-11' };
    const national = { ...EVENT, id: 'us-code-change', state: 'US', kind: 'code-change', direction: 'unstated', endDate: '', scope: { hcpcs: ['h2027'], basis: 'named-in-document' } };
    const { owner, statements, tags } = await load({ 'KY.json': file([EVENT, confirmed, national]), 'AZ.json': file([{ ...EVENT, id: 'az-one', state: 'AZ' }], [SEARCH], 'AZ') });
    assert.equal(owner.Status, 'SUCCEEDED', owner.ErrorMessage);
    assert.deepEqual(owner.Checks.filter((c) => !c.ok), []);
    assert.deepEqual(tags, ['open-history', 'index-psa', 'read-confirmed', 'BEGIN', 'delete-events', 'insert-events', 'delete-searches', 'insert-searches', 'history-SUCCEEDED', 'COMMIT']);
    assert.equal(owner.SuggestedEvents, 3);
    assert.equal(owner.ConfirmedEvents, 1);
    assert.equal(owner.AsOfDate, '2026-11-11');
    assert.equal(owner.RowsInserted, 6);
    const insert = statements[tags.indexOf('insert-events')];
    assert.match(insert.sql, new RegExp(`\\(${POLICY_EVENT_INSERT_COLUMNS.map(([n]) => n).join(', ')}\\)`));
    assert.match(insert.sql, /\$6::date,\$7,\$8::date/);
    assert.match(insert.sql, /\$11::text\[\],\$12::text\[\]/);
    assert.equal(insert.values.length, 4 * POLICY_EVENT_INSERT_COLUMNS.length);
    const at = (row: number, name: string) => cell(insert, POLICY_EVENT_INSERT_COLUMNS, row, name);
    // File order is by name, so AZ.json loads first; then the three Kentucky-file events.
    assert.equal(at(0, 'event_id'), 'az-one');
    assert.deepEqual([at(1, 'effective_date'), at(1, 'end_date'), at(1, 'end_precision')], ['2023-04-25', '2025-06-30', 'month']);
    assert.deepEqual([at(1, 'standing'), at(1, 'confirmed_by'), at(1, 'confirmed_on')], ['suggested', '', null]);
    assert.deepEqual([at(1, 'scope_basis'), at(1, 'source_document_date'), at(1, 'source_document_precision')], ['stands-in-for-service-family', '2023-04-25', 'day']);
    assert.deepEqual([at(2, 'end_date'), at(2, 'end_precision'), at(2, 'standing'), at(2, 'confirmed_by'), at(2, 'confirmed_on')], [null, '', 'confirmed', 'Ken Greenwood', '2026-11-11']);
    assert.deepEqual([at(3, 'state_code'), at(3, 'scope_hcpcs'), at(3, 'scope_hcpcs_prefixes'), at(3, 'scope_all_services')], ['US', ['H2027'], [], false]);
    assert.deepEqual([at(3, 'from_sys_id'), at(3, 'as_of_date'), at(3, 'load_class'), at(3, 'load_history_id')], [POLICY_FROM_SYS_ID, '2026-11-11', 'REAL', owner.LoadHistoryID]);
    const searches = statements[tags.indexOf('insert-searches')];
    assert.equal(searches.values.length, 2 * POLICY_SEARCH_INSERT_COLUMNS.length);
    assert.deepEqual([cell(searches, POLICY_SEARCH_INSERT_COLUMNS, 0, 'state_code'), cell(searches, POLICY_SEARCH_INSERT_COLUMNS, 1, 'searched_through')], ['AZ', '2026-11-11']);
    for (const t of ['delete-events', 'delete-searches']) assert.deepEqual(statements[tags.indexOf(t)].values, [POLICY_FROM_SYS_ID]);
    assert.ok(owner.Notes.some((n) => n.startsWith(POLICY_RULE_NOTE_PREFIX) && JSON.parse(n.slice(POLICY_RULE_NOTE_PREFIX.length)).lookbackMonths === POLICY_EVENT_LOOKBACK_MONTHS));
    assert.ok(owner.Notes.includes('0 confirmed events withdrawn or no longer confirmed'));
  });

  it('dates an event ended by another event from that event, and refuses an unknown, foreign or doubled end', async () => {
    const ender = { ...EVENT, id: 'ky-reinstated', direction: 'restricts', effectiveDate: '2025-06-25', endDate: '' };
    const { owner, statements, tags } = await load({ 'KY.json': file([{ ...EVENT, endDate: '', endedBy: 'ky-reinstated' }, ender]) });
    assert.equal(owner.Status, 'SUCCEEDED', owner.ErrorMessage);
    const insert = statements[tags.indexOf('insert-events')];
    assert.deepEqual(['end_date', 'end_precision', 'ended_by_event_id'].map((n) => cell(insert, POLICY_EVENT_INSERT_COLUMNS, 0, n)), ['2025-06-25', 'day', 'ky-reinstated']);
    await refused({ ...EVENT, endDate: '', endedBy: 'ky-nobody' }, /policy-events-ended-by-a-known-event/);
    await refused({ ...EVENT, endDate: '', endedBy: EVENT.id }, /policy-events-ended-by-a-known-event/);
    const both = await load({ 'KY.json': file([{ ...EVENT, endedBy: 'ky-reinstated' }, ender]) });
    assert.match(both.owner.ErrorMessage, /policy-events-state-one-end/);
    const foreign = await load({ 'KY.json': file([{ ...EVENT, endDate: '', endedBy: 'az-ender' }]), 'AZ.json': file([{ ...ender, id: 'az-ender', state: 'AZ' }], [SEARCH], 'AZ') });
    assert.match(foreign.owner.ErrorMessage, /policy-events-ended-by-a-known-event/);
    assert.equal(replaced(foreign.tags), false);
    const mutual = await load({ 'KY.json': file([{ ...EVENT, endDate: '', endedBy: 'ky-reinstated' }, { ...ender, effectiveDate: '2023-04-25', endedBy: EVENT.id }]) });
    assert.match(mutual.owner.ErrorMessage, /policy-events-ended-by-a-known-event/);
  });

  it('refuses a confirmed event ended by an unconfirmed one, so no suggestion decides how long a confirmed event was in force', async () => {
    const ender = { ...EVENT, id: 'ky-reinstated', direction: 'restricts', effectiveDate: '2025-06-25', endDate: '' };
    const confirmedBy = { standing: 'confirmed', confirmedBy: 'Ken Greenwood', confirmedOn: '2026-11-11' };
    const suspended = { ...EVENT, endDate: '', endedBy: 'ky-reinstated', ...confirmedBy };
    const mixed = await load({ 'KY.json': file([suspended, ender]) });
    assert.equal(mixed.owner.Status, 'FAILED');
    assert.match(mixed.owner.ErrorMessage, /policy-confirmed-events-ended-by-confirmed-events/);
    assert.equal(mixed.owner.ConfirmedEventsEndedByUnconfirmedEvents, 1);
    assert.equal(replaced(mixed.tags), false);
    const both = await load({ 'KY.json': file([suspended, { ...ender, ...confirmedBy }]) });
    assert.equal(both.owner.Status, 'SUCCEEDED', both.owner.ErrorMessage);
  });

  it('refuses an event that does not name or quote its source, or dates it after the load day', async () => {
    await refused({ ...EVENT, source: { ...EVENT.source, url: 'the tracker' } }, /policy-events-name-their-source/);
    await refused({ ...EVENT, source: { ...EVENT.source, publisher: '' } }, /policy-events-name-their-source/);
    await refused({ ...EVENT, source: { ...EVENT.source, title: '' } }, /policy-events-name-their-source/);
    await refused({ ...EVENT, source: { ...EVENT.source, documentDate: '' } }, /policy-events-name-their-source/);
    const owner = await refused({ ...EVENT, source: { ...EVENT.source, quote: '' } }, /policy-events-quote-their-source/);
    assert.equal(owner.EventsWithoutSourceQuote, 1);
    await refused({ ...EVENT, source: { ...EVENT.source, documentDate: '2999-01-01' } }, /policy-events-not-dated-after-the-load-day/);
  });

  it('refuses an event without an id, a summary, an effective date or a scope, or that ends before it starts', async () => {
    await refused({ ...EVENT, id: '' }, /policy-events-have-id-and-summary/);
    await refused({ ...EVENT, id: 'KY Event' }, /policy-events-have-id-and-summary/);
    await refused({ ...EVENT, summary: '' }, /policy-events-have-id-and-summary/);
    await refused({ ...EVENT, effectiveDate: '' }, /policy-events-have-effective-date/);
    await refused({ ...EVENT, scope: { hcpcs: [], hcpcsPrefixes: [], allServices: false, basis: 'named-in-document' } }, /policy-events-have-scope/);
    await refused({ ...EVENT, endDate: '2023-01' }, /policy-events-end-after-they-start/);
  });

  it('refuses a malformed scope: a code that is not a code, all services with codes, no basis, a stand-in without its note', async () => {
    await refused({ ...EVENT, scope: { hcpcs: ['PSYCHOEDUCATION'], basis: 'named-in-document' } }, /policy-events-scope-well-formed/);
    await refused({ ...EVENT, scope: { hcpcs: ['H2027'], allServices: true, basis: 'named-in-document' } }, /policy-events-scope-well-formed/);
    await refused({ ...EVENT, scope: { hcpcs: ['H2027'] } }, /policy-events-scope-well-formed/);
    await refused({ ...EVENT, scope: { hcpcsPrefixes: ['H'], basis: 'stands-in-for-service-family', note: '' } }, /policy-events-scope-well-formed/);
  });

  it('refuses a kind, direction or standing outside the lists, and a confirmation that does not match the standing', async () => {
    await refused({ ...EVENT, kind: 'rumor' }, /policy-events-of-known-kind-and-direction/);
    await refused({ ...EVENT, direction: 'up' }, /policy-events-of-known-kind-and-direction/);
    await refused({ ...EVENT, standing: 'approved' }, /policy-events-of-known-standing/);
    await refused({ ...EVENT, standing: 'confirmed' }, /policy-events-confirmation-matches-standing/);
    await refused({ ...EVENT, standing: 'confirmed', confirmedBy: 'Ken Greenwood' }, /policy-events-confirmation-matches-standing/);
    await refused({ ...EVENT, confirmedBy: 'Ken Greenwood' }, /policy-events-confirmation-matches-standing/);
    await refused({ ...EVENT, confirmedOn: '2026-11-11' }, /policy-events-confirmation-matches-standing/);
    await refused({ ...EVENT, standing: 'confirmed', confirmedBy: 'Ken Greenwood', confirmedOn: '2999-01-01' }, /policy-events-not-dated-after-the-load-day/);
    await refused({ ...EVENT, standing: 'confirmed', confirmedBy: 'Ken Greenwood', confirmedOn: '2023-01-01' }, /policy-events-confirmation-matches-standing/);
  });

  it('refuses a repeated id, an event of another state, and a file not named for its state', async () => {
    const twice = await load({ 'KY.json': file([EVENT, EVENT]) });
    assert.match(twice.owner.ErrorMessage, /policy-events-have-one-id-each/);
    assert.equal(replaced(twice.tags), false);
    await refused({ ...EVENT, state: 'AZ' }, /policy-events-belong-to-their-file-state/);
    await refused({ ...EVENT, state: 'AZ' }, /policy-files-named-for-their-state/, [SEARCH], 'AZ', 'KY.json');
    await refused({ ...EVENT, state: 'KENTUCKY' }, /policy-files-named-for-their-state/, [SEARCH], 'KENTUCKY', 'KENTUCKY.json');
    await refused(EVENT, /policy-files-named-for-their-state/, [SEARCH], '');
  });

  it('refuses a file with no search, and a search that breaks a rule', async () => {
    await refused(EVENT, /policy-files-record-a-search/, []);
    await refused(EVENT, /policy-searches-name-their-source/, [{ ...SEARCH, source: '' }]);
    await refused(EVENT, /policy-searches-name-their-source/, [{ ...SEARCH, url: 'dms site' }]);
    await refused(EVENT, /policy-searches-name-their-source/, [{ ...SEARCH, topic: '' }]);
    await refused(EVENT, /policy-searches-have-searched-through-day/, [{ ...SEARCH, searchedThrough: '' }]);
    await refused(EVENT, /policy-searches-of-known-completeness/, [{ ...SEARCH, completeness: 'done' }]);
    await refused(EVENT, /policy-searches-have-one-identity-each/, [SEARCH, SEARCH]);
    await refused(EVENT, /policy-searches-not-dated-after-the-load-day/, [{ ...SEARCH, searchedThrough: '2999-01-01' }]);
  });

  it('refuses more events than one load may carry', async () => {
    const many = Array.from({ length: POLICY_EVENT_INSERT_LIMIT + 1 }, (_, i) => ({ ...EVENT, id: `ky-event-${i}` }));
    const { owner, tags } = await load({ 'KY.json': file(many) });
    assert.match(owner.ErrorMessage, /policy-events-within-the-insert-limit/);
    assert.equal(owner.EventsBeyondTheInsertLimit, 1);
    assert.equal(replaced(tags), false);
  });

  it('loads a state that was searched and has no event: its events are cleared and its search is kept', async () => {
    const { owner, tags } = await load({ 'WV.json': file([], [SEARCH], 'WV') });
    assert.equal(owner.Status, 'SUCCEEDED', owner.ErrorMessage);
    assert.deepEqual(tags.slice(3), ['BEGIN', 'delete-events', 'delete-searches', 'insert-searches', 'history-SUCCEEDED', 'COMMIT']);
    assert.equal(owner.RowsInserted, 1);
  });

  it('lists the confirmed events a load withdraws or demotes, and still loads', async () => {
    const stillConfirmed = { ...EVENT, id: 'ky-kept', endDate: '', standing: 'confirmed', confirmedBy: 'Ken Greenwood', confirmedOn: '2026-11-11' };
    const { owner } = await load({ 'KY.json': file([{ ...EVENT, id: 'ky-demoted' }, stillConfirmed]) }, { confirmedBefore: ['ky-demoted', 'ky-gone', 'ky-kept'] });
    assert.equal(owner.Status, 'SUCCEEDED', owner.ErrorMessage);
    assert.deepEqual(owner.ConfirmedEventIdsWithdrawn, ['ky-demoted', 'ky-gone']);
    assert.ok(owner.Notes.includes('2 confirmed events withdrawn or no longer confirmed: ky-demoted, ky-gone'));
  });

  it('rolls back and records the failure when an insert comes back short', async () => {
    const { owner, tags } = await load({ 'KY.json': file([EVENT]) }, { shortInsert: /dso_policy_event/ });
    assert.equal(owner.Status, 'FAILED');
    assert.match(owner.ErrorMessage, /inserted 0 of 1 policy events/);
    assert.deepEqual(tags.slice(3), ['BEGIN', 'delete-events', 'insert-events', 'ROLLBACK', 'history-FAILED']);
    const searches = await load({ 'KY.json': file([EVENT]) }, { shortInsert: /dso_policy_search/ });
    assert.match(searches.owner.ErrorMessage, /inserted 0 of 1 policy searches/);
    assert.deepEqual(searches.tags.slice(-2), ['ROLLBACK', 'history-FAILED']);
  });

  it('rolls back when the success record or the commit fails, so rows never commit under a load that is not recorded as succeeded', async () => {
    const record = await load({ 'KY.json': file([EVENT]) }, { failOn: /UPDATE bw_ctl\.load_history[\s\S]*/ });
    assert.equal(record.owner.Status, 'FAILED');
    assert.deepEqual(record.tags.slice(-3), ['history-SUCCEEDED', 'ROLLBACK', 'history-FAILED']);
    assert.equal(record.tags.includes('COMMIT'), false);
    const commit = await load({ 'KY.json': file([EVENT]) }, { failOn: /^COMMIT$/ });
    assert.equal(commit.owner.Status, 'FAILED');
    assert.deepEqual(commit.tags.slice(-3), ['COMMIT', 'ROLLBACK', 'history-FAILED']);
  });

  it('records no failure on a load history it never opened', async () => {
    const { owner, tags } = await load({ 'KY.json': file([EVENT]) }, { failOn: /INSERT INTO bw_ctl\.load_history/ });
    assert.equal(owner.Status, 'FAILED');
    assert.equal(owner.LoadHistoryIsOpen, false);
    assert.deepEqual(tags, ['open-history']);
  });

  it('stops on a file it cannot read as stated, naming the file, and records the failure', async () => {
    const { owner, tags } = await load({ 'KY.json': '{ "schema": ' });
    assert.equal(owner.Status, 'FAILED');
    assert.match(owner.ErrorMessage, /KY\.json: not readable JSON/);
    assert.deepEqual(tags, ['open-history', 'index-psa', 'history-FAILED']);
  });

  it('stops before any statement when the directory holds no curated file', async () => {
    const { owner, statements } = await load({});
    assert.equal(owner.Status, 'FAILED');
    assert.match(owner.ErrorMessage, /no curated policy-event file/);
    assert.equal(statements.length, 0);
  });
});

describe('the curated files in the repository', () => {
  it('load without a failed check, for Arizona, the District of Columbia, Kentucky and West Virginia', async () => {
    const statements: Statement[] = [];
    const owner = new PolicyEventOwner(stubClient(statements));
    owner.EventsDirectory = path.join(BW_ROOT, 'policy-events');
    await owner.LoadPolicyEventsAndSearchCoverage();
    assert.equal(owner.Status, 'SUCCEEDED', owner.ErrorMessage);
    assert.deepEqual(owner.Checks.filter((c) => !c.ok), []);
    assert.deepEqual(owner.EventFileNames, ['AZ.json', 'DC.json', 'KY.json', 'WV.json']);
    // Every event on file is confirmed, the District's one included.
    assert.deepEqual([owner.ConfirmedEvents, owner.SuggestedEvents], [9, 0]);
    const district = owner.EventRows.filter((e) => e.state_code === 'DC');
    assert.deepEqual(district.map((e) => [e.event_id, e.standing]), [['dc-community-support-worker-arraigned-2025-09', 'confirmed']]);
    assert.equal(owner.EventRows.length, owner.SuggestedEvents + owner.ConfirmedEvents);
    // Kentucky's 2020 suspension is dated to the day its reinstatement took effect.
    const suspended = owner.EventRows.find((e) => e.event_id === 'ky-prior-authorization-suspended-2020-02');
    assert.deepEqual([suspended?.effective_date, suspended?.end_date], ['2020-02-04', '2025-06-25']);
  });
});
