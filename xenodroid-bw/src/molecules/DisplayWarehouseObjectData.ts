import type pg from 'pg';
import { DTP_TO_DATA_REQUEST } from '../admin/modelingCatalog.js';

/**
 * Business Action: DisplayWarehouseObjectData
 * Read-only Display Data for PSA / DSO / Cube objects (latest REAL preferred).
 */
export class DisplayWarehouseObjectData {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  ObjectName = '';
  Limit = 100;
  Result: Record<string, unknown> | null = null;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const name = this.ObjectName;
      if (!name) {
        this.Status = 'FAILED';
        this.ErrorMessage = 'ObjectName is required';
        return;
      }

      if (name.startsWith('PSA_') || name.includes('/psa/') || name.startsWith('psa/')) {
        await this.displayPsa(name);
      } else if (name === 'DSO_ENROLLMENT_STATE') {
        await this.displayEnrollment();
      } else if (name === 'DSO_MCO_ROSTER') {
        await this.displayMco();
      } else if (name === 'CUBE_EXEC_LANDING' || name === 'Q_LANDING_ACCURATE') {
        await this.displayCube();
      } else if (name === 'CUBE_ROOM_ROW') {
        await this.displayRoomRows();
      } else if (name.startsWith('DTP_')) {
        await this.displayDtpPeek(name);
      } else if (name.startsWith('TRFN_')) {
        this.Result = {
          objectName: name,
          kind: 'Transformation preview',
          hitCount: 0,
          filters: [],
          columns: ['note'],
          rows: [['Transformation rules live in runner molecules — no TRFN table yet']],
        };
      } else {
        this.Status = 'FAILED';
        this.ErrorMessage = `No Display Data mapping for ${name}`;
        return;
      }
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
    }
  }

  private async latestLoad(dataRequestId: string) {
    const r = await this.client.query<{ load_history_id: string }>(
      `SELECT load_history_id FROM bw_ctl.load_history
       WHERE data_request_id = $1 AND status = 'SUCCEEDED' AND load_class = 'REAL'
       ORDER BY started_at DESC LIMIT 1`,
      [dataRequestId],
    );
    return r.rows[0]?.load_history_id || null;
  }

  private async displayPsa(name: string) {
    const fromSys =
      name === 'PSA_CMS_DATA_MEDICAID_ENR'
        ? 'CMS_DATA_MEDICAID_ENR'
        : name === 'PSA_KY_DMS_MCO_CONTRACTS'
          ? 'KY_DMS_MCO_CONTRACTS'
          : name === 'PSA_PUBLIC_HYDRATION'
            ? null
            : name.replace(/^PSA_/, '');
    const r = await this.client.query(
      fromSys
        ? `SELECT object_key, from_sys_id, load_class, load_history_id,
                  byte_length::text, landed_at::text, content_hash
           FROM bw_psa_meta.object_index
           WHERE from_sys_id = $1
           ORDER BY landed_at DESC
           LIMIT $2`
        : `SELECT object_key, from_sys_id, load_class, load_history_id,
                  byte_length::text, landed_at::text, content_hash
           FROM bw_psa_meta.object_index
           WHERE object_key ILIKE '%PUBLIC_HYDRATION%'
           ORDER BY landed_at DESC
           LIMIT $1`,
      fromSys ? [fromSys, this.Limit] : [this.Limit],
    );
    this.Result = {
      objectName: name,
      kind: 'PSA',
      hitCount: r.rowCount,
      filters: [{ key: 'load_class', value: 'REAL preferred' }],
      columns: ['object_key', 'from_sys_id', 'load_class', 'load_history_id', 'byte_length', 'landed_at'],
      rows: r.rows.map((row) => [
        row.object_key,
        row.from_sys_id,
        row.load_class,
        row.load_history_id,
        row.byte_length,
        row.landed_at,
      ]),
    };
  }

  private async displayEnrollment() {
    const lh = await this.latestLoad('DR-REAL-PI-ENROLLMENT');
    let r;
    if (lh) {
      r = await this.client.query(
        `SELECT state_code, period_ym, total_enrollment, medicaid_enrollment, chip_enrollment,
                from_sys_id, as_of_date::text, load_class, load_history_id
         FROM bw_dso.dso_enrollment_state
         WHERE load_class = 'REAL' AND load_history_id = $1
         ORDER BY period_ym DESC
         LIMIT $2`,
        [lh, this.Limit],
      );
    }
    if (!r || r.rowCount === 0) {
      r = await this.client.query(
        `SELECT DISTINCT ON (state_code, period_ym)
            state_code, period_ym, total_enrollment, medicaid_enrollment, chip_enrollment,
            from_sys_id, as_of_date::text, load_class, load_history_id
         FROM bw_dso.dso_enrollment_state
         WHERE load_class = 'REAL'
         ORDER BY state_code, period_ym DESC, load_history_id DESC
         LIMIT $1`,
        [this.Limit],
      );
    }
    const total = await this.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM bw_dso.dso_enrollment_state WHERE load_class = 'REAL'`,
    );
    this.Result = {
      objectName: 'DSO_ENROLLMENT_STATE',
      kind: 'Detail DSO',
      hitCount: total.rows[0].n,
      filters: [
        { key: 'state_code', value: 'KY' },
        { key: 'load_class', value: 'REAL' },
        { key: 'load_history_id', value: lh || 'latest per period' },
      ],
      columns: [
        'state_code',
        'period_ym',
        'total_enrollment',
        'medicaid_enrollment',
        'chip_enrollment',
        'from_sys_id',
        'as_of_date',
        'load_class',
      ],
      rows: r.rows.map((row) => [
        row.state_code,
        row.period_ym,
        Number(row.total_enrollment).toLocaleString('en-US'),
        Number(row.medicaid_enrollment).toLocaleString('en-US'),
        Number(row.chip_enrollment).toLocaleString('en-US'),
        row.from_sys_id,
        row.as_of_date,
        row.load_class,
      ]),
    };
  }

  private async displayMco() {
    const lh = await this.latestLoad('DR-REAL-MCO-ROSTER');
    let r;
    if (lh) {
      r = await this.client.query(
        `SELECT mco_key, mco_label, status, effective_date::text, from_sys_id,
                as_of_date::text, load_class
         FROM bw_dso.dso_mco_roster
         WHERE load_class = 'REAL' AND load_history_id = $1
         ORDER BY mco_label
         LIMIT $2`,
        [lh, this.Limit],
      );
    }
    if (!r || r.rowCount === 0) {
      r = await this.client.query(
        `SELECT DISTINCT ON (mco_key)
            mco_key, mco_label, status, effective_date::text, from_sys_id,
            as_of_date::text, load_class
         FROM bw_dso.dso_mco_roster
         WHERE load_class = 'REAL'
         ORDER BY mco_key, load_history_id DESC
         LIMIT $1`,
        [this.Limit],
      );
    }
    this.Result = {
      objectName: 'DSO_MCO_ROSTER',
      kind: 'Detail DSO',
      hitCount: r.rowCount,
      filters: [
        { key: 'load_class', value: 'REAL' },
        { key: 'load_history_id', value: lh || 'latest per MCO' },
      ],
      columns: ['mco_key', 'mco_label', 'status', 'effective_date', 'from_sys_id', 'as_of_date', 'load_class'],
      rows: r.rows.map((row) => [
        row.mco_key,
        row.mco_label,
        row.status,
        row.effective_date,
        row.from_sys_id,
        row.as_of_date,
        row.load_class,
      ]),
    };
  }

  private async displayCube() {
    const r = await this.client.query(
      `SELECT DISTINCT ON (measure_id)
          measure_id, display_value, numeric_value::text, unit,
          as_of_date::text, from_sys_id, load_class, load_history_id
       FROM bw_cube.cube_exec_landing
       WHERE load_class = 'REAL'
       ORDER BY measure_id, as_of_date DESC, load_history_id DESC
       LIMIT $1`,
      [this.Limit],
    );
    this.Result = {
      objectName: 'CUBE_EXEC_LANDING',
      kind: 'Cube',
      hitCount: r.rowCount,
      filters: [{ key: 'load_class', value: 'REAL' }],
      columns: [
        'measure_id',
        'display_value',
        'numeric_value',
        'unit',
        'as_of_date',
        'from_sys_id',
        'load_class',
      ],
      rows: r.rows.map((row) => [
        row.measure_id,
        row.display_value,
        row.numeric_value,
        row.unit,
        row.as_of_date,
        row.from_sys_id,
        row.load_class,
      ]),
    };
  }

  private async displayRoomRows() {
    const r = await this.client.query(
      `SELECT row_id, room_id, title, metric_key, display_value, row_kind,
              from_sys_id, as_of_date::text, load_class
       FROM bw_cube.cube_room_row
       WHERE load_class = 'REAL'
       ORDER BY room_id, row_id
       LIMIT $1`,
      [this.Limit],
    );
    const total = await this.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM bw_cube.cube_room_row WHERE load_class = 'REAL'`,
    );
    this.Result = {
      objectName: 'CUBE_ROOM_ROW',
      kind: 'Room facts',
      hitCount: total.rows[0].n,
      filters: [{ key: 'load_class', value: 'REAL' }],
      columns: [
        'row_id',
        'room_id',
        'title',
        'metric_key',
        'display_value',
        'row_kind',
        'from_sys_id',
        'as_of_date',
      ],
      rows: r.rows.map((row) => [
        row.row_id,
        row.room_id,
        row.title,
        row.metric_key,
        row.display_value,
        row.row_kind,
        row.from_sys_id,
        row.as_of_date,
      ]),
    };
  }

  private async displayDtpPeek(name: string) {
    const dr = DTP_TO_DATA_REQUEST[name];
    if (!dr) {
      this.Result = {
        objectName: name,
        kind: 'DTP staging peek',
        hitCount: 0,
        filters: [],
        columns: ['note'],
        rows: [['No data request mapping']],
      };
      return;
    }
    const loads = await this.client.query(
      `SELECT load_history_id, status, row_count, as_of_date::text,
              started_at::text, completed_at::text
       FROM bw_ctl.load_history
       WHERE data_request_id = $1
       ORDER BY started_at DESC
       LIMIT 10`,
      [dr],
    );
    this.Result = {
      objectName: name,
      kind: 'DTP staging peek',
      hitCount: loads.rowCount,
      filters: [{ key: 'data_request_id', value: dr }],
      columns: ['load_history_id', 'status', 'row_count', 'as_of_date', 'started_at', 'completed_at'],
      rows: loads.rows.map((row) => [
        row.load_history_id,
        row.status,
        row.row_count,
        row.as_of_date,
        row.started_at,
        row.completed_at,
      ]),
    };
  }
}

/**
 * Business Action: DisplayDtpMonitor
 * Derived DTP monitor from load_history (no first-class DTP table).
 */
export class DisplayDtpMonitor {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  TechnicalName = '';
  Result: Record<string, unknown> | null = null;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const dr = DTP_TO_DATA_REQUEST[this.TechnicalName];
      if (!dr) {
        this.Status = 'FAILED';
        this.ErrorMessage = `No DTP mapping for ${this.TechnicalName}`;
        return;
      }
      const meta =
        this.TechnicalName === 'DTP_DSO_TO_CUBE_ENR'
          ? { source: 'DSO_ENROLLMENT_STATE', target: 'CUBE_EXEC_LANDING' }
          : this.TechnicalName === 'DTP_MCO_TO_CUBE'
            ? { source: 'DSO_MCO_ROSTER', target: 'CUBE_EXEC_LANDING' }
            : { source: 'CUBE_ROOM_ROW', target: 'CUBE_EXEC_LANDING' };

      const loads = await this.client.query(
        `SELECT load_history_id, status, row_count, started_at::text, completed_at::text,
                notes, as_of_date::text
         FROM bw_ctl.load_history
         WHERE data_request_id = $1
         ORDER BY started_at DESC
         LIMIT 20`,
        [dr],
      );

      this.Result = {
        technicalName: this.TechnicalName,
        source: { type: 'Detail DSO', name: meta.source },
        target: { type: 'Cube', name: meta.target },
        extractionMode: 'Full',
        filter: 'load_class = REAL (Data Request)',
        dataRequestId: dr,
        requests: loads.rows.map((row) => {
          const start = row.started_at ? new Date(row.started_at).getTime() : 0;
          const end = row.completed_at ? new Date(row.completed_at).getTime() : start;
          const durationSec = end && start ? Math.max(0, Math.round((end - start) / 1000)) : 0;
          return {
            id: row.load_history_id,
            status:
              row.status === 'SUCCEEDED'
                ? 'success'
                : row.status === 'FAILED'
                  ? 'error'
                  : row.status === 'PURGED'
                    ? 'warning'
                    : 'warning',
            records: row.row_count ?? 0,
            start: row.started_at,
            end: row.completed_at,
            duration: `${durationSec}s`,
            message: row.notes || `${row.status} · as_of ${row.as_of_date || '—'}`,
          };
        }),
      };
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
    }
  }
}
