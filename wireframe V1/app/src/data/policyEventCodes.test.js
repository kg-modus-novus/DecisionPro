import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listGlossaryTerms } from './glossary.js';

/**
 * Director requirement, 2026-11-11: every code a policy event shows is described in the glossary.
 * Until the policy events reach the app through their export, this reads the curated files the
 * warehouse loads (xenodroid-bw/policy-events), so a new event cannot name an undescribed code.
 */
const eventsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../xenodroid-bw/policy-events');
const files = fs.readdirSync(eventsDirectory).filter((name) => name.endsWith('.json')).sort();
const events = files.flatMap((name) => JSON.parse(fs.readFileSync(path.join(eventsDirectory, name), 'utf8')).events.map((event) => ({ ...event, file: name })));

describe('codes named by the policy events', () => {
  const terms = listGlossaryTerms();

  it('reads the curated event files', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
  });

  it('has a glossary entry of its own for every billing code an event names', () => {
    for (const event of events) {
      for (const code of event.scope.hcpcs ?? []) {
        expect(terms.some((t) => t.billingCode === code), `${event.file} ${event.id}: no glossary entry describes ${code}`).toBe(true);
      }
    }
  });

  it('has a glossary entry for every code family an event lets stand in for a service family', () => {
    for (const event of events) {
      for (const prefix of event.scope.hcpcsPrefixes ?? []) {
        expect(terms.some((t) => t.billingCodePrefix === prefix), `${event.file} ${event.id}: no glossary entry describes codes beginning with ${prefix}`).toBe(true);
      }
    }
  });
});
