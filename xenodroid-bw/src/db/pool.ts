import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { config, BW_ROOT } from '../config.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl });
  }
  return pool;
}

export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function migrate() {
  const files = [
    '001_schemas.sql',
    '002_hydration.sql',
    '003_multi_period_landing.sql',
    '004_kentucky_operational_sources.sql',
    '005_ofr_federal_award_grain.sql',
    '006_ofr_identity_crosswalk.sql',
    '007_ofr_nonprofit_financials.sql',
    '008_ofr_facility_financial_distress.sql',
    '009_ofr_ownership_network.sql',
  ];
  await withClient(async (c) => {
    for (const name of files) {
      const sql = await fs.readFile(path.join(BW_ROOT, 'sql', name), 'utf8');
      await c.query(sql);
    }
  });
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
