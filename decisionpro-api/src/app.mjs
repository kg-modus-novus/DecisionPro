// CodeXen: v1 not-applicable
// Composition root (framework wiring): builds the platform services and the request handler, and
// runs the boot sequence of ADR-001 Decision 4. server.mjs supplies real dependencies; tests supply
// an in-memory database, a fixed clock and local signing keys.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequestHandler } from './http/routes.mjs';
import { createEnqueue } from './platform/enqueue.mjs';
import { createIdentityTokenVerifier } from './platform/identityTokens.mjs';
import { migrate } from './platform/migrate.mjs';
import { createOperationLedger } from './platform/operationLedger.mjs';
import { createSessions } from './platform/sessions.mjs';

export const MEASURE_CATALOG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'measureCatalog.json');

export function loadMeasureCatalog(path = MEASURE_CATALOG_PATH) {
  return Object.freeze(JSON.parse(readFileSync(path, 'utf8')).map((entry) => Object.freeze({ ...entry })));
}

export const systemClock = Object.freeze({ now: () => Date.now() });

export function createApp({ database, config, clock = systemClock, measureCatalog = loadMeasureCatalog(), keySets = {} }) {
  const sessions = createSessions({ database, clock });
  const enqueue = createEnqueue({ database, clock, timeZone: config.displayTimeZone });
  const ledger = createOperationLedger({ database, clock });
  const identityTokens = createIdentityTokenVerifier({
    googleClientId: config.googleClientId,
    appleServicesId: config.appleServicesId,
    keySets,
  });
  const handleRequest = createRequestHandler({
    database, sessions, enqueue, ledger, identityTokens, measureCatalog, clock, config,
  });

  // ADR-001 Decision 4 boot sequence, run once before the server listens.
  // architecture-record: T1 L1 R1 ADR-001
  async function boot() {
    const migrations = await migrate(database);
    const locks = await enqueue.restoreAtBoot();
    const operations = await ledger.resumeAtBoot();
    // Re-queued operations run in the background; boot does not wait for them.
    const operationRuns = operations.requeued.map((operationId) => ledger.runOperation(operationId)
      .catch((error) => { console.error('[decisionpro-api] operation failed', operationId, error); return 'failed'; }));
    return { migrations, locks, operations, operationRuns };
  }

  return { boot, handleRequest, sessions, enqueue, ledger, identityTokens, measureCatalog };
}
