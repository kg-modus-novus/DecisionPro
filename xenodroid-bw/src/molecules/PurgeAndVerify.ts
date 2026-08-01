import type pg from 'pg';
import { psaStore } from '../psa/filesystemPsa.js';
import { CompleteLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';

/**
 * Business Action: PurgeTestLoads
 * Removes LoadClass=TEST from cubes, Detail DSOs, PSA meta/objects; records purge history.
 */
export class PurgeTestLoads {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  DeletedCubeRows = 0;
  DeletedRoomRows = 0;
  DeletedEnrollmentRows = 0;
  DeletedMcoRows = 0;
  DeletedPsaMetaRows = 0;
  LoadHistoryID = '';

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.LoadHistoryID = newId('LH-PURGE');
    try {
      await this.client.query(
        `INSERT INTO bw_ctl.data_request
          (data_request_id, from_sys_id, target_psa_prefix, load_class, active)
         VALUES ('DR-PURGE-TEST', 'TEST_FIXTURE_PACK', 'psa/TEST_FIXTURE_PACK/', 'TEST', TRUE)
         ON CONFLICT DO NOTHING`,
      );
      await this.client.query(
        `INSERT INTO bw_ctl.load_history
          (load_history_id, data_request_id, started_at, source_uri, status, load_class, notes)
         VALUES ($1,'DR-PURGE-TEST',NOW(),'purge:TEST','RUNNING','TEST','Purge all TEST facts')`,
        [this.LoadHistoryID],
      );

      const cube = await this.client.query(`DELETE FROM bw_cube.cube_exec_landing WHERE load_class = 'TEST'`);
      this.DeletedCubeRows = cube.rowCount ?? 0;
      const room = await this.client.query(`DELETE FROM bw_cube.cube_room_row WHERE load_class = 'TEST'`);
      this.DeletedRoomRows = room.rowCount ?? 0;
      const enr = await this.client.query(`DELETE FROM bw_dso.dso_enrollment_state WHERE load_class = 'TEST'`);
      this.DeletedEnrollmentRows = enr.rowCount ?? 0;
      const mco = await this.client.query(`DELETE FROM bw_dso.dso_mco_roster WHERE load_class = 'TEST'`);
      this.DeletedMcoRows = mco.rowCount ?? 0;

      const keys = await this.client.query<{ object_key: string }>(
        `SELECT object_key FROM bw_psa_meta.object_index WHERE load_class = 'TEST'`,
      );
      for (const row of keys.rows) {
        const prefix = row.object_key.includes('/')
          ? row.object_key.split('/').slice(0, -1).join('/')
          : row.object_key;
        await psaStore.DeletePrefix(prefix);
      }
      const meta = await this.client.query(`DELETE FROM bw_psa_meta.object_index WHERE load_class = 'TEST'`);
      this.DeletedPsaMetaRows = meta.rowCount ?? 0;

      await CompleteLoadHistory(this.client, this.LoadHistoryID, {
        status: 'PURGED',
        row_count:
          this.DeletedCubeRows +
          this.DeletedRoomRows +
          this.DeletedEnrollmentRows +
          this.DeletedMcoRows +
          this.DeletedPsaMetaRows,
        notes: 'TEST facts purged',
      });
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }
}

/**
 * Business Action: VerifyWarehouseEmptyOfTest
 */
export class VerifyWarehouseEmptyOfTest {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  CubeTestCount = -1;
  RoomTestCount = -1;
  EnrollmentTestCount = -1;
  McoTestCount = -1;
  PsaMetaTestCount = -1;
  IsEmpty = false;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    const q = async (sql: string) => {
      const r = await this.client.query<{ c: string }>(sql);
      return Number(r.rows[0].c);
    };
    this.CubeTestCount = await q(`SELECT COUNT(*)::text AS c FROM bw_cube.cube_exec_landing WHERE load_class='TEST'`);
    this.RoomTestCount = await q(`SELECT COUNT(*)::text AS c FROM bw_cube.cube_room_row WHERE load_class='TEST'`);
    this.EnrollmentTestCount = await q(
      `SELECT COUNT(*)::text AS c FROM bw_dso.dso_enrollment_state WHERE load_class='TEST'`,
    );
    this.McoTestCount = await q(`SELECT COUNT(*)::text AS c FROM bw_dso.dso_mco_roster WHERE load_class='TEST'`);
    this.PsaMetaTestCount = await q(
      `SELECT COUNT(*)::text AS c FROM bw_psa_meta.object_index WHERE load_class='TEST'`,
    );
    this.IsEmpty =
      this.CubeTestCount === 0 &&
      this.RoomTestCount === 0 &&
      this.EnrollmentTestCount === 0 &&
      this.McoTestCount === 0 &&
      this.PsaMetaTestCount === 0;
    if (!this.IsEmpty) {
      this.Status = 'FAILED';
      this.ErrorMessage = `TEST rows remain cube=${this.CubeTestCount} room=${this.RoomTestCount} enr=${this.EnrollmentTestCount} mco=${this.McoTestCount} psa=${this.PsaMetaTestCount}`;
      return;
    }
    this.Status = 'SUCCEEDED';
  }
}
