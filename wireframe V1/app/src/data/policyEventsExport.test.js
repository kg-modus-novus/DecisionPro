import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listGlossaryTerms } from './glossary.js';
import { POLICY_EVENTS } from './alp/policyEvents.js';

/**
 * The app reads the policy events from the warehouse export (alp/policyEvents.js), not from the
 * curated files. These tests fail when that export has fallen out of step with the curated files
 * the warehouse loads (xenodroid-bw/policy-events), so an edit to a file, or a confirmation, cannot
 * reach the repository without the export that carries it.
 * To regenerate, from xenodroid-bw: npx tsx src/cli.ts policy-events-load, then policy-events-export.
 */
const REGENERATE = 'regenerate alp/policyEvents.js: policy-events-load, then policy-events-export';
const eventsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../xenodroid-bw/policy-events');
const files = fs.readdirSync(eventsDirectory).filter((name) => name.endsWith('.json')).sort();
const curatedFiles = files.map((name) => ({ name, ...JSON.parse(fs.readFileSync(path.join(eventsDirectory, name), 'utf8')) }));
const curatedEvents = curatedFiles.flatMap((file) => file.events.map((event) => ({ ...event, file: file.name })));
const curatedSearches = curatedFiles.flatMap((file) => file.searches.map((search) => ({ ...search, state: file.state, file: file.name })));
// The load trims stated text and upper-cases a state and a code; compare the curated values the same way.
const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const list = (value) => (value ?? []).map(upper);

describe('the policy events export the app reads', () => {
  const exported = new Map(POLICY_EVENTS.events.map((event) => [event.id, event]));

  it('is the export the program expects, with the rule its load ran under', () => {
    expect(POLICY_EVENTS.schema).toBe('decisionpro/policy-events-export/v1');
    expect(POLICY_EVENTS.loadClass).toBe('REAL');
    expect(POLICY_EVENTS.loadHistoryId).not.toBe('');
    expect(POLICY_EVENTS.contentHash).toMatch(/^[0-9a-f]{64}$/);
    // Director decision 2 of 2026-11-11: a permanent change counts for 24 months before the first flagged year.
    expect(POLICY_EVENTS.rule.lookbackMonths).toBe(24);
    expect(POLICY_EVENTS.rule.standings).toEqual(['suggested', 'confirmed']);
    expect(POLICY_EVENTS.load.rowCount).toBe(POLICY_EVENTS.events.length + POLICY_EVENTS.searches.length);
  });

  it('was made from the curated files as they are now, byte for byte', () => {
    // The load hashes the file names and texts it read, in name order; the export carries that hash.
    const retained = JSON.stringify(files.map((name) => ({ name, text: fs.readFileSync(path.join(eventsDirectory, name), 'utf8') })));
    expect(POLICY_EVENTS.contentHash, REGENERATE).toBe(crypto.createHash('sha256').update(Buffer.from(retained, 'utf8')).digest('hex'));
  });

  it('holds the events of the curated files, no more and no fewer', () => {
    expect([...exported.keys()].sort(), REGENERATE).toEqual(curatedEvents.map((event) => event.id).sort());
  });

  it('carries each event as its curated file states it: wording, scope, source, standing and confirmation', () => {
    for (const curated of curatedEvents) {
      const event = exported.get(curated.id);
      const where = `${curated.file} ${curated.id}: ${REGENERATE}`;
      expect(event, where).toBeTruthy();
      expect({
        state: event.state, kind: event.kind, direction: event.direction, summary: event.summary, endedBy: event.endedBy,
        scope: event.scope,
        source: { publisher: event.source.publisher, title: event.source.title, url: event.source.url, quote: event.source.quote },
        standing: event.standing, confirmedOn: event.confirmedOn, sourceFile: event.sourceFile,
      }, where).toEqual({
        state: upper(curated.state), kind: text(curated.kind), direction: text(curated.direction), summary: text(curated.summary), endedBy: text(curated.endedBy),
        scope: {
          hcpcs: list(curated.scope.hcpcs), hcpcsPrefixes: list(curated.scope.hcpcsPrefixes), allServices: Boolean(curated.scope.allServices),
          basis: text(curated.scope.basis), note: text(curated.scope.note),
        },
        source: { publisher: text(curated.source.publisher), title: text(curated.source.title), url: text(curated.source.url), quote: text(curated.source.quote) },
        standing: text(curated.standing), confirmedOn: text(curated.confirmedOn), sourceFile: curated.file,
      });
    }
  });

  it('names no person: the export carries that an event is confirmed and when, never by whom', () => {
    const exportText = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'alp/policyEvents.js'), 'utf8');
    expect(exportText).not.toMatch(/confirmedBy/);
    const confirmers = [...new Set(curatedEvents.map((event) => text(event.confirmedBy)).filter((name) => name !== ''))];
    expect(confirmers.length).toBeGreaterThan(0);
    for (const name of confirmers) expect(exportText.includes(name), `${REGENERATE}: the export names a confirmer`).toBe(false);
    for (const event of POLICY_EVENTS.events) expect(event.confirmedOn, event.id).toMatch(event.standing === 'confirmed' ? /^\d{4}-\d{2}-\d{2}$/ : /^$/);
  });

  it('dates each event as its curated file states it, a stated year or month becoming a day with its precision', () => {
    const precisionOf = (stated) => ({ 4: 'year', 7: 'month', 10: 'day' })[stated.length];
    for (const curated of curatedEvents) {
      const event = exported.get(curated.id);
      const where = `${curated.file} ${curated.id}: ${REGENERATE}`;
      expect(event.effectiveDate, where).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.effectiveDate.startsWith(curated.effectiveDate), where).toBe(true);
      expect(event.effectivePrecision, where).toBe(precisionOf(curated.effectiveDate));
      expect(event.source.documentDate.startsWith(curated.source.documentDate), where).toBe(true);
      expect(event.source.documentPrecision, where).toBe(precisionOf(curated.source.documentDate));
      if (text(curated.endDate) !== '') {
        // A stated end is its own date.
        expect(event.endDate.startsWith(curated.endDate), where).toBe(true);
        expect(event.endPrecision, where).toBe(precisionOf(curated.endDate));
      } else if (text(curated.endedBy) !== '') {
        // An event ended by another ends on the day that event takes effect.
        const ender = exported.get(curated.endedBy);
        expect(ender, where).toBeTruthy();
        expect([event.endDate, event.endPrecision], where).toEqual([ender.effectiveDate, ender.effectivePrecision]);
      } else {
        // A permanent event has no end.
        expect([event.endDate, event.endPrecision], where).toEqual(['', '']);
      }
    }
  });

  it('holds the searches of the curated files, each with its searched-through day and whether it was partial', () => {
    const identity = (search) => [upper(search.state), text(search.source), text(search.url), text(search.topic), text(search.searchedThrough), text(search.completeness), search.sourceFile ?? search.file].join(' | ');
    expect(POLICY_EVENTS.searches.map(identity).sort(), REGENERATE).toEqual(curatedSearches.map(identity).sort());
  });

  it('is searched through the latest day any search on file records', () => {
    expect(POLICY_EVENTS.latestSearchedThrough).toBe(POLICY_EVENTS.searches.map((search) => search.searchedThrough).sort().at(-1));
  });

  it('names no code the glossary does not describe', () => {
    const terms = listGlossaryTerms();
    for (const event of POLICY_EVENTS.events) {
      for (const code of event.scope.hcpcs) expect(terms.some((t) => t.billingCode === code), `${event.id}: no glossary entry describes ${code}`).toBe(true);
      for (const prefix of event.scope.hcpcsPrefixes) expect(terms.some((t) => t.billingCodePrefix === prefix), `${event.id}: no glossary entry describes codes beginning with ${prefix}`).toBe(true);
    }
  });
});
