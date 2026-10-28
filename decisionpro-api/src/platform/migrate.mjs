// CodeXen: v1 not-applicable
// Boot-time schema migration (D2, framework wiring). Applies migrations/*.sql in name order, each in
// its own transaction, recording applied names in schema_migration. Migrations must contain no
// triggers, rules, or cascading foreign keys (checked here before a file is applied).

import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

const FORBIDDEN = [
  /\bCREATE\s+(OR\s+REPLACE\s+)?(CONSTRAINT\s+)?TRIGGER\b/i,
  /\bCREATE\s+(OR\s+REPLACE\s+)?RULE\b/i,
  /\bCREATE\s+EVENT\s+TRIGGER\b/i,
  /\bON\s+(DELETE|UPDATE)\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT)\b/i,
];

export function findForbiddenStatements(sql) {
  const withoutComments = sql.replace(/--[^\n]*/g, '');
  return FORBIDDEN.filter((pattern) => pattern.test(withoutComments)).map((pattern) => pattern.source);
}

export async function migrate(database, directory = MIGRATIONS_DIRECTORY) {
  const bookkeeping = await database.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migration'",
  );
  if (bookkeeping.rowCount === 0) {
    await database.query('CREATE TABLE schema_migration (migration_name text PRIMARY KEY, applied_at timestamptz NOT NULL)');
  }
  const applied = new Set((await database.query('SELECT migration_name FROM schema_migration')).rows.map((row) => row.migration_name));
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  const newlyApplied = [];
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = await readFile(resolve(directory, name), 'utf8');
    const forbidden = findForbiddenStatements(sql);
    if (forbidden.length > 0) throw new Error(`Migration ${name} contains forbidden statements: ${forbidden.join(', ')}`);
    const transaction = await database.beginTransaction();
    try {
      await transaction.query(sql);
      await transaction.query('INSERT INTO schema_migration (migration_name, applied_at) VALUES ($1, $2)', [name, new Date().toISOString()]);
      await transaction.commit();
    } catch (error) {
      if (transaction.isOpen) await transaction.rollback();
      throw new Error(`Migration ${name} failed: ${error.message}`);
    }
    newlyApplied.push(name);
  }
  return { applied: newlyApplied };
}
