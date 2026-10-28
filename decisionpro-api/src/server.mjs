// CodeXen: v1 not-applicable
// Entry point (framework wiring). Topology T1 (ADR-001 Decision 1): exactly one process, one Railway
// replica. Boot: 1. migrate, 2. restore locks (R1), 3. resume the ledger (R1), 4. listen on PORT.

import { createServer } from 'node:http';

import { createApp } from './app.mjs';
import { parseAllowedOrigins } from './http/boundary.mjs';
import { connectDatabase } from './platform/db.mjs';

function readConfig(env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return {
    port: Number(env.PORT ?? 8080),
    databaseUrl: env.DATABASE_URL,
    databaseSsl: env.DATABASE_SSL === 'true',
    databaseSslCa: env.DATABASE_SSL_CA ?? '',
    trustProxy: env.TRUST_PROXY === 'true',
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    cookieDomain: env.COOKIE_DOMAIN ?? '',
    googleClientId: env.GOOGLE_CLIENT_ID ?? '',
    appleServicesId: env.APPLE_SERVICES_ID ?? '',
    displayTimeZone: env.DISPLAY_TIME_ZONE ?? 'America/New_York',
  };
}

const config = readConfig(process.env);
const database = connectDatabase({ connectionString: config.databaseUrl, ssl: config.databaseSsl, sslCa: config.databaseSslCa });
const app = createApp({ database, config });

const bootResult = await app.boot();
console.log('[decisionpro-api] boot', JSON.stringify({
  migrationsApplied: bootResult.migrations.applied,
  locksRestored: bootResult.locks.restored,
  locksReleased: bootResult.locks.released,
  operationsRequeued: bootResult.operations.requeued.length,
  operationsFailed: bootResult.operations.failed,
}));
if (!config.googleClientId) console.warn('[decisionpro-api] GOOGLE_CLIENT_ID is not set: Google sign-in is refused');
if (!config.appleServicesId) console.warn('[decisionpro-api] APPLE_SERVICES_ID is not set: Apple sign-in is refused');

const server = createServer((req, res) => {
  app.handleRequest(req, res);
});
server.listen(config.port, () => {
  console.log(`[decisionpro-api] listening on ${config.port}; allowed origins: ${config.allowedOrigins.join(', ') || '(none)'}`);
});

function shutdown(signal) {
  console.log(`[decisionpro-api] ${signal}: closing`);
  server.close(() => {
    database.close().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
