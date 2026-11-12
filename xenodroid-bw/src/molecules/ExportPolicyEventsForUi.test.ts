import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type pg from 'pg';
import { ExportPolicyEventsForUi, POLICY_EVENTS_EXPORT_SCHEMA } from './ExportPolicyEventsForUi.js';
import { fileURLToPath } from 'node:url';
import {
  POLICY_DATA_REQUEST_ID, POLICY_EVENT_DIRECTIONS, POLICY_EVENT_KINDS, POLICY_EVENT_LOOKBACK_MONTHS, POLICY_EVENT_STANDINGS,
  POLICY_FROM_SYS_ID, POLICY_RULE_NOTE_PREFIX, POLICY_SCOPE_BASES, POLICY_SEARCH_COMPLETENESS,
} from './PolicyEventOwner.js';

// The export writes the events, the searches and the rule as the load recorded them, and
// refuses a load it cannot stand behind. It matches nothing and names no explanation.
// A stub client answers the three reads and records what was asked.
// Run: node --import tsx --test src/molecules/ExportPolicyEventsForUi.test.ts

// A lookback that is not the owner's constant today, so the tests tell the recorded rule from the current one.
const RULE = { lookbackMonths: 36, kinds: ['enforcement'], directions: ['restricts'], standings: ['suggested', 'confirmed'], scopeBases: ['named-in-document'], searchCompleteness: ['partial', 'full'] };
const NOTES = `3 files | 1 confirmed, 1 suggested | ${POLICY_RULE_NOTE_PREFIX}${JSON.stringify(RULE)}`;

const CONFIRMED = {
  event_id: 'ky-limits-2025-01', state_code: 'KY', kind: 'authorization-or-limit', direction: 'restricts', summary: 'Limits set.',
  effective_date: '2025-01-01', effective_precision: 'day', end_date: '2025-04-08', end_precision: 'day', ended_by_event_id: 'ky-rescinded-2025-04',
  scope_hcpcs: ['H2027', 'H0038'], scope_hcpcs_prefixes: [], scope_all_services: false, scope_basis: 'named-in-document', scope_note: '',
  source_publisher: 'Kentucky Department for Medicaid Services', source_title: 'Provider letter', source_url: 'https://example.org/letter.pdf',
  source_document_date: '2024-11-08', source_document_precision: 'day', source_quote: 'effective January 1, 2025',
  standing: 'confirmed', confirmed_by: 'A Person', confirmed_on: '2026-11-11', source_file: 'KY.json',
};
// A permanent, unconfirmed event: the read hands its absent end and confirmation day over as ''.
const SUGGESTED = {
  ...CONFIRMED, event_id: 'az-suspensions-2023-05', state_code: 'AZ', kind: 'enforcement', summary: 'Suspensions announced.',
  effective_date: '2023-05-16', end_date: '', end_precision: '', ended_by_event_id: '',
  scope_hcpcs: [], scope_hcpcs_prefixes: ['H'], scope_basis: 'stands-in-for-service-family', scope_note: 'Codes beginning with H stand in.',
  source_document_date: '2024-05-01', source_document_precision: 'month',
  standing: 'suggested', confirmed_by: '', confirmed_on: '', source_file: 'AZ.json',
};
const SEARCH = { state_code: 'KY', source_name: 'Kentucky provider letters', source_url: 'https://example.org/letters', topic: 'behavioral health limits', searched_through: '2026-04-24', completeness: 'partial', source_file: 'KY.json' };

type Asked = { sql: string; args: unknown[] };

function stubClient(asked: Asked[], opts: { load?: Record<string, unknown> | null; events?: unknown[]; searches?: unknown[] } = {}) {
  const events = opts.events ?? [SUGGESTED, CONFIRMED];
  const searches = opts.searches ?? [SEARCH];
  const load = opts.load === null ? null : {
    load_history_id: 'LH-POLICY-TEST', started_at: '2026-11-11T18:00:00Z', completed_at: '2026-11-11T18:00:01Z', as_of_date: '2026-04-24',
    notes: NOTES, row_count: events.length + searches.length, content_hash: 'abc123', ...(opts.load ?? {}),
  };
  return {
    async query(sql: string, args: unknown[] = []) {
      asked.push({ sql, args });
      if (/FROM bw_ctl\.load_history/.test(sql)) return { rows: load ? [load] : [] };
      if (/FROM bw_dso\.dso_policy_event/.test(sql)) return { rows: events };
      if (/FROM bw_dso\.dso_policy_search/.test(sql)) return { rows: searches };
      throw new Error(`unexpected statement: ${sql}`);
    },
  } as unknown as pg.PoolClient;
}

async function run(opts: Parameters<typeof stubClient>[1] = {}) {
  const asked: Asked[] = [];
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-export-'));
  const exporter = new ExportPolicyEventsForUi(stubClient(asked, opts));
  exporter.ExportPath = path.join(dir, 'policyEvents.js');
  await exporter.Run();
  const written = await fs.readFile(exporter.ExportPath, 'utf8').catch(() => '');
  await fs.rm(dir, { recursive: true, force: true });
  return { exporter, asked, written, payload: written ? JSON.parse(written.slice(written.indexOf('{'), written.lastIndexOf('}') + 1)) : null };
}

describe('ExportPolicyEventsForUi', () => {
  it('writes every event and search of the latest load as loaded, with the rule the load recorded', async () => {
    const { exporter, payload, written } = await run();
    assert.equal(exporter.Status, 'SUCCEEDED', exporter.ErrorMessage);
    assert.match(written, /^\/\*\*[^]*do not hand-edit[^]*\*\/\nexport const POLICY_EVENTS = \{/);
    assert.deepEqual(Object.keys(payload), ['schema', 'generatedAt', 'loadClass', 'loadHistoryId', 'contentHash', 'load', 'latestSearchedThrough', 'rule', 'events', 'searches']);
    assert.equal(payload.schema, POLICY_EVENTS_EXPORT_SCHEMA);
    assert.deepEqual([payload.loadClass, payload.loadHistoryId, payload.contentHash, payload.latestSearchedThrough], ['REAL', 'LH-POLICY-TEST', 'abc123', '2026-04-24']);
    assert.deepEqual(payload.rule, RULE);
    assert.notEqual(payload.rule.lookbackMonths, POLICY_EVENT_LOOKBACK_MONTHS);
    // The rule is the load's own record; the remaining notes travel without it.
    assert.deepEqual(payload.load, { startedAt: '2026-11-11T18:00:00Z', completedAt: '2026-11-11T18:00:01Z', notes: '3 files | 1 confirmed, 1 suggested', rowCount: 3 });
    assert.deepEqual(payload.events[1], {
      id: 'ky-limits-2025-01', state: 'KY', kind: 'authorization-or-limit', direction: 'restricts', summary: 'Limits set.',
      effectiveDate: '2025-01-01', effectivePrecision: 'day', endDate: '2025-04-08', endPrecision: 'day', endedBy: 'ky-rescinded-2025-04',
      scope: { hcpcs: ['H2027', 'H0038'], hcpcsPrefixes: [], allServices: false, basis: 'named-in-document', note: '' },
      source: { publisher: 'Kentucky Department for Medicaid Services', title: 'Provider letter', url: 'https://example.org/letter.pdf', documentDate: '2024-11-08', documentPrecision: 'day', quote: 'effective January 1, 2025' },
      standing: 'confirmed', confirmedOn: '2026-11-11', sourceFile: 'KY.json',
    });
    assert.deepEqual(payload.searches, [{ state: 'KY', source: 'Kentucky provider letters', url: 'https://example.org/letters', topic: 'behavioral health limits', searchedThrough: '2026-04-24', completeness: 'partial', sourceFile: 'KY.json' }]);
    assert.deepEqual([exporter.LoadHistoryID, exporter.EventCount, exporter.ConfirmedEventCount, exporter.SuggestedEventCount, exporter.SearchCount, exporter.StateCount], ['LH-POLICY-TEST', 2, 1, 1, 1, 2]);
    assert.equal(exporter.ExportBytes, Buffer.byteLength(written));
  });

  it('carries an unconfirmed suggestion, labeled by its standing, and a permanent event without an end', async () => {
    const { payload } = await run();
    const suggestion = payload.events[0];
    assert.deepEqual([suggestion.id, suggestion.standing, suggestion.confirmedOn], ['az-suspensions-2023-05', 'suggested', '']);
    assert.deepEqual([suggestion.endDate, suggestion.endPrecision, suggestion.endedBy], ['', '', '']);
    assert.deepEqual(suggestion.scope, { hcpcs: [], hcpcsPrefixes: ['H'], allServices: false, basis: 'stands-in-for-service-family', note: 'Codes beginning with H stand in.' });
    assert.deepEqual([suggestion.source.documentDate, suggestion.source.documentPrecision], ['2024-05-01', 'month']);
  });

  it('reads the latest SUCCEEDED real load of the policy data request, and only that load of the curated source', async () => {
    const { asked } = await run();
    assert.equal(asked.length, 3);
    assert.match(asked[0].sql, /data_request_id = \$1 AND status = 'SUCCEEDED' AND load_class = 'REAL' ORDER BY completed_at DESC LIMIT 1/);
    assert.deepEqual(asked[0].args, [POLICY_DATA_REQUEST_ID]);
    for (const read of asked.slice(1)) {
      assert.match(read.sql, /load_class = 'REAL' AND from_sys_id = \$1 AND load_history_id = \$2/);
      assert.deepEqual(read.args, [POLICY_FROM_SYS_ID, 'LH-POLICY-TEST']);
    }
    // Dates leave the database as YYYY-MM-DD text whatever the session's date style, and an absent end or confirmation day as ''.
    assert.match(asked[0].sql, /to_char\(as_of_date, 'YYYY-MM-DD'\) AS as_of_date/);
    assert.match(asked[1].sql, /to_char\(effective_date, 'YYYY-MM-DD'\) AS effective_date/);
    assert.match(asked[1].sql, /COALESCE\(to_char\(end_date, 'YYYY-MM-DD'\), ''\) AS end_date/);
    assert.match(asked[1].sql, /to_char\(source_document_date, 'YYYY-MM-DD'\) AS source_document_date/);
    assert.match(asked[1].sql, /COALESCE\(to_char\(confirmed_on, 'YYYY-MM-DD'\), ''\) AS confirmed_on/);
    assert.match(asked[2].sql, /to_char\(searched_through, 'YYYY-MM-DD'\) AS searched_through/);
    // The order of the file is the order of the reads: the export does not sort.
    assert.match(asked[1].sql, /ORDER BY state_code, effective_date, event_id\s*$/);
    assert.match(asked[2].sql, /ORDER BY state_code, source_name, topic\s*$/);
  });

  it('matches nothing and names no explanation: no key of an event speaks of a rise, a rating or an explanation', async () => {
    const { payload } = await run();
    for (const event of payload.events) {
      assert.deepEqual(Object.keys(event), ['id', 'state', 'kind', 'direction', 'summary', 'effectiveDate', 'effectivePrecision', 'endDate', 'endPrecision', 'endedBy', 'scope', 'source', 'standing', 'confirmedOn', 'sourceFile']);
    }
  });

  it('names no person: who confirmed an event stays in the warehouse', async () => {
    const { asked, written, payload } = await run();
    assert.doesNotMatch(asked[1].sql, /confirmed_by/);
    assert.doesNotMatch(written, /confirmedBy|A Person/);
    assert.deepEqual(payload.events.map((e: { standing: string; confirmedOn: string }) => [e.standing, e.confirmedOn]), [['suggested', ''], ['confirmed', '2026-11-11']]);
  });

  it('carries the lookback the owner records today when the load recorded it', async () => {
    const { payload } = await run({ load: { notes: `${POLICY_RULE_NOTE_PREFIX}${JSON.stringify({ lookbackMonths: POLICY_EVENT_LOOKBACK_MONTHS })}` } });
    assert.equal(payload.rule.lookbackMonths, POLICY_EVENT_LOOKBACK_MONTHS);
    assert.equal(payload.load.notes, '');
  });

  it('refuses, and writes nothing, when there is no SUCCEEDED load', async () => {
    const { exporter, written, asked } = await run({ load: null });
    assert.equal(exporter.Status, 'FAILED');
    assert.match(exporter.ErrorMessage, /no SUCCEEDED policy events load/);
    assert.equal(written, '');
    assert.equal(asked.length, 1);
  });

  it('refuses a load that does not record its rule, or records one without its lookback months', async () => {
    const without = await run({ load: { notes: '3 files | 1 confirmed, 1 suggested' } });
    assert.equal(without.exporter.Status, 'FAILED');
    assert.match(without.exporter.ErrorMessage, /does not record its rule/);
    assert.equal(without.written, '');
    const empty = await run({ load: { notes: null } });
    assert.match(empty.exporter.ErrorMessage, /does not record its rule/);
    // A rule that cannot be read as an object is refused in the export's own words, not the parser's.
    for (const unreadable of ['{"lookbackMonths": 24', 'null', '[24]', '24', '{"note": "a | b", "lookbackMonths": 24}']) {
      const broken = await run({ load: { notes: `1 confirmed | ${POLICY_RULE_NOTE_PREFIX}${unreadable}` } });
      assert.equal(broken.exporter.Status, 'FAILED');
      assert.match(broken.exporter.ErrorMessage, /does not record its rule in a readable form; rerun policy-events-load/, unreadable);
      assert.equal(broken.written, '');
    }
    for (const rule of [{}, { lookbackMonths: '24' }, { lookbackMonths: 0 }]) {
      const partial = await run({ load: { notes: `${POLICY_RULE_NOTE_PREFIX}${JSON.stringify(rule)}` } });
      assert.equal(partial.exporter.Status, 'FAILED');
      assert.match(partial.exporter.ErrorMessage, /without its lookback months/);
      assert.equal(partial.written, '');
    }
  });

  it('refuses when the tables do not hold the rows the load recorded', async () => {
    const { exporter, written } = await run({ load: { row_count: 9 } });
    assert.equal(exporter.Status, 'FAILED');
    assert.match(exporter.ErrorMessage, /hold 2 events and 1 searches, not the 9 rows the load recorded/);
    assert.equal(written, '');
  });

  it('left on record an export made under the rule the owner records today', async () => {
    // The app reads this file. A change to the owner's lookback or lists needs a new load and a new export.
    const onRecord = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../wireframe V1/app/src/data/alp/policyEvents.js');
    const text = await fs.readFile(onRecord, 'utf8');
    const payload = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    assert.equal(payload.schema, POLICY_EVENTS_EXPORT_SCHEMA);
    assert.deepEqual(payload.rule, {
      lookbackMonths: POLICY_EVENT_LOOKBACK_MONTHS, kinds: [...POLICY_EVENT_KINDS], directions: [...POLICY_EVENT_DIRECTIONS], standings: [...POLICY_EVENT_STANDINGS],
      scopeBases: [...POLICY_SCOPE_BASES], searchCompleteness: [...POLICY_SEARCH_COMPLETENESS],
    }, 'regenerate alp/policyEvents.js: policy-events-load, then policy-events-export');
  });

  it('runs once', async () => {
    const asked: Asked[] = [];
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-export-'));
    const exporter = new ExportPolicyEventsForUi(stubClient(asked));
    exporter.ExportPath = path.join(dir, 'policyEvents.js');
    await exporter.Run();
    await exporter.Run();
    await fs.rm(dir, { recursive: true, force: true });
    assert.equal(asked.length, 3);
  });
});
