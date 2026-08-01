import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { BW_ROOT } from '../config.js';
import { DATA_REQUESTS, MEASURES, SOURCE_SYSTEMS } from '../catalog/seedCatalog.js';

/**
 * Business Action: SeedWarehouseCatalog
 * Molecule loads SourceSystem, Measure, and DataRequest reference data.
 */
export class SeedWarehouseCatalog {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  SourceCount = 0;
  MeasureCount = 0;
  DataRequestCount = 0;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      for (const s of SOURCE_SYSTEMS) {
        await this.client.query(
          `INSERT INTO bw_ctl.source_system
            (from_sys_id, publisher, tos_grade, base_uri, attribution_notes, paid_follow_on_todo)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (from_sys_id) DO UPDATE SET
             publisher = EXCLUDED.publisher,
             tos_grade = EXCLUDED.tos_grade,
             base_uri = EXCLUDED.base_uri,
             attribution_notes = EXCLUDED.attribution_notes,
             paid_follow_on_todo = EXCLUDED.paid_follow_on_todo`,
          [
            s.from_sys_id,
            s.publisher,
            s.tos_grade,
            s.base_uri,
            s.attribution_notes,
            s.paid_follow_on_todo,
          ],
        );
        this.SourceCount += 1;
      }
      for (const m of MEASURES) {
        await this.client.query(
          `INSERT INTO bw_ctl.measure
            (measure_id, name, definition, unit, grain, provisional_flag)
           VALUES ($1,$2,$3,$4,$5,TRUE)
           ON CONFLICT (measure_id) DO UPDATE SET
             name = EXCLUDED.name,
             definition = EXCLUDED.definition,
             unit = EXCLUDED.unit,
             grain = EXCLUDED.grain`,
          [m.measure_id, m.name, m.definition, m.unit, m.grain],
        );
        for (const fromSys of m.sources) {
          await this.client.query(
            `INSERT INTO bw_ctl.measure_source (measure_id, from_sys_id)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [m.measure_id, fromSys],
          );
        }
        this.MeasureCount += 1;
      }
      for (const d of DATA_REQUESTS) {
        await this.client.query(
          `INSERT INTO bw_ctl.data_request
            (data_request_id, from_sys_id, target_psa_prefix, load_class, active)
           VALUES ($1,$2,$3,$4,TRUE)
           ON CONFLICT (data_request_id) DO UPDATE SET
             from_sys_id = EXCLUDED.from_sys_id,
             target_psa_prefix = EXCLUDED.target_psa_prefix,
             load_class = EXCLUDED.load_class,
             active = TRUE`,
          [d.data_request_id, d.from_sys_id, d.target_psa_prefix, d.load_class],
        );
        this.DataRequestCount += 1;
      }
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }
}

export async function readFixtureJson<T>(relativeName: string): Promise<T> {
  const full = path.join(BW_ROOT, 'src', 'fixtures', relativeName);
  return JSON.parse(await fs.readFile(full, 'utf8')) as T;
}
