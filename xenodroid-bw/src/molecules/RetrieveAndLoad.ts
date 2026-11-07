import type pg from 'pg';
import { psaStore } from '../psa/filesystemPsa.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { readFixtureJson } from './SeedWarehouseCatalog.js';
import {
  ComputeYoYChangePercent,
  ParseAllStateEnrollmentFromPiCsv,
  ParseKentuckyEnrollmentFromPiCsv,
  PiPeriodId,
  SelectAllEnrollmentPeriods,
  SelectLatestEnrollment,
  type KyEnrollmentRow,
} from '../atoms/ParsePiEnrollmentCsv.js';
import { config } from '../config.js';
import { Sha256 } from '../adapters/operationalPublicSources.js';

type LoadClass = 'TEST' | 'REAL';

/** Canonical ids of the all-state enrollment load, defined once for every reader. */
export const ALL_STATE_ENROLLMENT_DATA_REQUEST_ID = 'DR-REAL-PI-ENROLLMENT-ALL-STATES';
export const PI_ENROLLMENT_FROM_SYS_ID = 'CMS_DATA_MEDICAID_ENR';

type McoFixture = {
  as_of_date: string;
  source_uri?: string;
  attribution?: string;
  mcos: Array<{
    mco_key: string;
    mco_label: string;
    status: string;
    effective_date: string;
  }>;
};

/**
 * Business Action: RetrieveAndLoadEnrollment
 * Lands PSA bytes, cleanses into Detail DSO, refreshes exec-landing cube measures M-001/M-002.
 */
export class RetrieveAndLoadEnrollment {
  DataRequestID = '';
  FromSysID = '';
  LoadClass: LoadClass = 'TEST';
  SourceURI = '';
  SourceBytes: Buffer = Buffer.alloc(0);
  PSAObjectKey = '';
  ContentHash = '';
  LoadHistoryID = '';
  RowCount = 0;
  ParsedRows: KyEnrollmentRow[] = [];
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  // All-state molecule fields (share-and-surge screen denominator).
  RetainedExtractKeys: string[] = [];
  RetainedExtractKey = '';
  AllStateRows: KyEnrollmentRow[] = [];
  StatesParsed = 0;
  PeriodsParsed = 0;
  CompleteStatesParsed = 0;
  EnrollmentCoverageIsSufficient = false;
  AllStateRowsInserted = 0;

  constructor(private client: pg.PoolClient) {}

  /**
   * Business Action: LoadAllStateEnrollmentFromRetainedExtract
   *
   * Loads every state's monthly Medicaid and CHIP enrollment from the latest
   * PI extract already retained in PSA (no fetch), under its own load history,
   * so the share-and-surge screen has an enrollment-share denominator for all
   * states. The Kentucky exec-landing cubes are untouched. Plan:
   * docs/planning/share-and-surge-screen-codexen-plan.md.
   */
  async LoadAllStateEnrollmentFromRetainedExtract() {
    if (this.Status !== 'INITIAL') return;
    this.InitializeAllStateRunState();
    try {
      await this.ListRetainedPiExtracts();
      this.SelectLatestRetainedPiExtract();
      await this.ReadLatestRetainedPiExtract();
      await this.OpenAllStateLoadHistory();
      this.ParseAllStateEnrollment();
      this.IsEnrollmentCoverageSufficient();
      await this.InsertAllStateEnrollmentRows();
      await this.CompleteAllStateLoad();
      this.MarkAllStateLoadSucceeded();
      await this.FailAllStateLoad();
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
      await this.FailAllStateLoad();
    }
  }

  /** PASSIVE: stage the all-state run's identity and INITIAL values. */
  private InitializeAllStateRunState() {
    this.Status = 'RUNNING';
    this.ErrorMessage = '';
    this.DataRequestID = ALL_STATE_ENROLLMENT_DATA_REQUEST_ID;
    this.FromSysID = PI_ENROLLMENT_FROM_SYS_ID;
    this.LoadClass = 'REAL';
    this.LoadHistoryID = '';
    this.RetainedExtractKeys = [];
    this.RetainedExtractKey = '';
    this.SourceBytes = Buffer.alloc(0);
    this.AllStateRows = [];
    this.StatesParsed = 0;
    this.PeriodsParsed = 0;
    this.CompleteStatesParsed = 0;
    this.EnrollmentCoverageIsSufficient = false;
    this.RowCount = 0;
    this.AllStateRowsInserted = 0;
  }

  /** ACTIVE: the REAL PI extracts retained in PSA (object keys are timestamped). */
  private async ListRetainedPiExtracts() {
    if (this.RetainedExtractKeys.length > 0) return;
    this.RetainedExtractKeys = await psaStore.ListKeys(`psa/${this.FromSysID}/REAL/`);
    if (this.RetainedExtractKeys.filter((k) => k.endsWith('.csv')).length === 0) {
      throw new Error('No retained REAL PI enrollment extract in PSA; run real-etl first');
    }
  }

  /** PASSIVE: the newest retained CSV by key order. */
  private SelectLatestRetainedPiExtract() {
    const csvKeys = this.RetainedExtractKeys.filter((k) => k.endsWith('.csv')).sort();
    this.RetainedExtractKey = csvKeys[csvKeys.length - 1];
    this.SourceURI = `psa:${this.RetainedExtractKey}`;
  }

  /** ACTIVE */
  private async ReadLatestRetainedPiExtract() {
    if (this.RetainedExtractKey === '' || this.SourceBytes.length > 0) return;
    this.SourceBytes = await psaStore.GetObject(this.RetainedExtractKey);
    if (this.SourceBytes.length === 0) throw new Error(`Retained PI extract ${this.RetainedExtractKey} is empty`);
  }

  /** ACTIVE */
  private async OpenAllStateLoadHistory() {
    if (this.LoadHistoryID !== '') return;
    this.LoadHistoryID = newId('LH-PI-ALL');
    await InsertLoadHistory(this.client, {
      load_history_id: this.LoadHistoryID,
      data_request_id: this.DataRequestID,
      started_at: new Date(),
      source_uri: this.SourceURI,
      load_class: this.LoadClass,
    });
  }

  /** PASSIVE: every state's periods, final reports preferred, through the shared parse atom. */
  private ParseAllStateEnrollment() {
    this.AllStateRows = ParseAllStateEnrollmentFromPiCsv(this.SourceBytes.toString('utf8'));
    this.ContentHash = Sha256(this.SourceBytes);
    this.StatesParsed = new Set(this.AllStateRows.map((r) => r.state_code)).size;
    this.PeriodsParsed = new Set(this.AllStateRows.map((r) => r.period_ym)).size;
  }

  /** PASSIVE question: 51 states (50 + DC) with a total for every month of 2018 through 2024; records the failure otherwise. */
  private IsEnrollmentCoverageSufficient() {
    const required = new Set<string>();
    for (let y = 2018; y <= 2024; y += 1) for (let m = 1; m <= 12; m += 1) required.add(`${y}${String(m).padStart(2, '0')}`);
    const byState = new Map<string, Set<string>>();
    for (const r of this.AllStateRows) {
      if (r.total_enrollment == null) continue;
      if (!required.has(r.period_ym)) continue;
      if (!byState.has(r.state_code)) byState.set(r.state_code, new Set());
      byState.get(r.state_code)!.add(r.period_ym);
    }
    this.CompleteStatesParsed = [...byState.values()].filter((s) => s.size === required.size).length;
    this.EnrollmentCoverageIsSufficient = this.CompleteStatesParsed >= 51;
    if (this.EnrollmentCoverageIsSufficient) return;
    this.Status = 'FAILED';
    this.ErrorMessage = `PI extract covers ${this.StatesParsed} states (${this.CompleteStatesParsed} complete) and ${this.PeriodsParsed} periods; 51 states with every month 2018-2024 are required`;
  }

  /** ACTIVE */
  private async CompleteAllStateLoad() {
    if (this.LoadHistoryID === '' || this.Status !== 'RUNNING') return;
    await CompleteLoadHistory(this.client, this.LoadHistoryID, {
      status: 'SUCCEEDED',
      row_count: this.RowCount,
      content_hash: this.ContentHash,
      as_of_date: this.AllStateRows.at(-1)?.as_of_date ?? null,
      notes: `all-state PI enrollment from retained extract ${this.RetainedExtractKey}`,
    });
  }

  /** PASSIVE */
  private MarkAllStateLoadSucceeded() {
    if (this.Status !== 'RUNNING') return;
    this.Status = 'SUCCEEDED';
  }

  /** ACTIVE (failed runs only) */
  private async FailAllStateLoad() {
    if (this.LoadHistoryID === '' || this.Status !== 'FAILED') return;
    await CompleteLoadHistory(this.client, this.LoadHistoryID, { status: 'FAILED', notes: this.ErrorMessage });
  }

  /** ACTIVE: one multi-row insert per batch of states' periods. */
  private async InsertAllStateEnrollmentRows() {
    if (!this.EnrollmentCoverageIsSufficient) return;
    const batch = 500;
    for (let i = 0; i < this.AllStateRows.length; i += batch) {
      const rows = this.AllStateRows.slice(i, i + batch);
      const values: unknown[] = [];
      const tuples = rows.map((r, j) => {
        const b = j * 9;
        values.push(r.state_code, r.period_ym, r.medicaid_enrollment, r.chip_enrollment, r.total_enrollment, this.FromSysID, r.as_of_date, this.LoadClass, this.LoadHistoryID);
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7}::date,$${b + 8},$${b + 9})`;
      });
      const result = await this.client.query(
        `INSERT INTO bw_dso.dso_enrollment_state
          (state_code, period_ym, medicaid_enrollment, chip_enrollment, total_enrollment,
           from_sys_id, as_of_date, load_class, load_history_id)
         VALUES ${tuples.join(',')}`,
        values,
      );
      this.AllStateRowsInserted += result.rowCount ?? 0;
    }
    this.RowCount = this.AllStateRowsInserted;
    if (this.AllStateRowsInserted < this.AllStateRows.length) throw new Error(`inserted ${this.AllStateRowsInserted} of ${this.AllStateRows.length} all-state enrollment rows`);
  }

  async Run() {
    if (this.Status !== 'INITIAL') return;
    if (!this.DataRequestID || !this.FromSysID) {
      this.Status = 'FAILED';
      this.ErrorMessage = 'DataRequestID and FromSysID are required';
      return;
    }
    this.Status = 'RUNNING';
    this.LoadHistoryID = newId('LH');
    const started = new Date();
    try {
      await InsertLoadHistory(this.client, {
        load_history_id: this.LoadHistoryID,
        data_request_id: this.DataRequestID,
        started_at: started,
        source_uri: this.SourceURI,
        load_class: this.LoadClass,
      });

      await this.ObtainSourceBytes();
      if ((this.Status as string) === 'FAILED') return;

      await this.LandSourceBytesInPSA();
      if ((this.Status as string) === 'FAILED') return;

      await this.CleanseIntoDetailDSO();
      if ((this.Status as string) === 'FAILED') return;

      await this.RefreshEnrollmentCubes();
      if ((this.Status as string) === 'FAILED') return;

      await CompleteLoadHistory(this.client, this.LoadHistoryID, {
        status: 'SUCCEEDED',
        row_count: this.RowCount,
        content_hash: this.ContentHash,
        as_of_date: this.ParsedRows.at(-1)?.as_of_date ?? null,
      });
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
      await CompleteLoadHistory(this.client, this.LoadHistoryID, {
        status: 'FAILED',
        notes: this.ErrorMessage,
      });
    }
  }

  private async ObtainSourceBytes() {
    if (this.LoadClass === 'TEST') {
      const fixture = await readFixtureJson<Record<string, unknown>>('testEnrollment.json');
      this.SourceBytes = Buffer.from(JSON.stringify(fixture, null, 2), 'utf8');
      this.SourceURI = 'fixture:testEnrollment.json';
      return;
    }
    const res = await fetch(this.SourceURI || config.piDatasetCsvUrl);
    if (!res.ok) {
      this.Status = 'FAILED';
      this.ErrorMessage = `Fetch failed HTTP ${res.status}`;
      return;
    }
    this.SourceBytes = Buffer.from(await res.arrayBuffer());
    this.SourceURI = this.SourceURI || config.piDatasetCsvUrl;
  }

  private async LandSourceBytesInPSA() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = this.LoadClass === 'TEST' ? 'json' : 'csv';
    this.PSAObjectKey = `psa/${this.FromSysID}/${this.LoadClass}/${stamp}/${this.LoadHistoryID}.${ext}`;
    await psaStore.EnsureRootReady();
    const landed = await psaStore.PutObject(this.PSAObjectKey, this.SourceBytes);
    this.ContentHash = landed.contentHash;
    await this.client.query(
      `INSERT INTO bw_psa_meta.object_index
        (object_key, from_sys_id, load_history_id, load_class, content_hash, byte_length)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        this.PSAObjectKey,
        this.FromSysID,
        this.LoadHistoryID,
        this.LoadClass,
        this.ContentHash,
        landed.byteLength,
      ],
    );
  }

  private async CleanseIntoDetailDSO() {
    if (this.LoadClass === 'TEST') {
      const j = JSON.parse(this.SourceBytes.toString('utf8')) as {
        state_code: string;
        period_ym: string;
        medicaid_enrollment: number;
        chip_enrollment: number;
        total_enrollment: number;
        as_of_date: string;
      };
      this.ParsedRows = [
        {
          state_code: j.state_code,
          period_ym: j.period_ym,
          medicaid_enrollment: j.medicaid_enrollment,
          chip_enrollment: j.chip_enrollment,
          total_enrollment: j.total_enrollment,
          as_of_date: j.as_of_date,
          preliminary_or_updated: 'U',
          final_report: 'Y',
        },
      ];
    } else {
      this.ParsedRows = ParseKentuckyEnrollmentFromPiCsv(this.SourceBytes.toString('utf8'));
      if (!this.ParsedRows.length) {
        this.Status = 'FAILED';
        this.ErrorMessage = 'No Kentucky enrollment rows parsed from PI CSV';
        return;
      }
    }

    for (const r of this.ParsedRows) {
      await this.client.query(
        `INSERT INTO bw_dso.dso_enrollment_state
          (state_code, period_ym, medicaid_enrollment, chip_enrollment, total_enrollment,
           from_sys_id, as_of_date, load_class, load_history_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9)`,
        [
          r.state_code,
          r.period_ym,
          r.medicaid_enrollment,
          r.chip_enrollment,
          r.total_enrollment,
          this.FromSysID,
          r.as_of_date,
          this.LoadClass,
          this.LoadHistoryID,
        ],
      );
    }
    this.RowCount = this.ParsedRows.length;
  }

  private async RefreshEnrollmentCubes() {
    // Load every KY period present in the PI extract (modern monthly series), not a 3-period window.
    const periods = SelectAllEnrollmentPeriods(this.ParsedRows);
    const latest = SelectLatestEnrollment(this.ParsedRows);
    if (!latest || latest.total_enrollment == null || !periods.length) {
      this.Status = 'FAILED';
      this.ErrorMessage = 'Latest enrollment missing total';
      return;
    }

    await this.client.query(
      `DELETE FROM bw_cube.cube_exec_landing
       WHERE load_class = $1 AND measure_id IN ('M-001','M-002')`,
      [this.LoadClass],
    );

    for (const row of periods) {
      if (row.total_enrollment == null) continue;
      const yoy = ComputeYoYChangePercent(this.ParsedRows, row);
      const provenance = {
        measureFlow: ['PSA', 'Cleanse', 'DetailDSO', 'Cube'],
        psaObjectKey: this.PSAObjectKey,
        loadHistoryId: this.LoadHistoryID,
        fromSysId: this.FromSysID,
        sourceUri: this.SourceURI,
        sourcePageUri: config.piDatasetMetaUri,
        asOfDate: row.as_of_date,
        loadClass: this.LoadClass,
        periodYm: row.period_ym,
        periodId: PiPeriodId(row.period_ym),
      };

      await this.client.query(
        `INSERT INTO bw_cube.cube_exec_landing
          (measure_id, display_value, numeric_value, unit, as_of_date, from_sys_id,
           load_class, load_history_id, provenance_json)
         VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9::jsonb)`,
        [
          'M-001',
          row.total_enrollment.toLocaleString('en-US'),
          row.total_enrollment,
          'persons',
          row.as_of_date,
          this.FromSysID,
          this.LoadClass,
          this.LoadHistoryID,
          JSON.stringify(provenance),
        ],
      );

      if (yoy != null) {
        await this.client.query(
          `INSERT INTO bw_cube.cube_exec_landing
            (measure_id, display_value, numeric_value, unit, as_of_date, from_sys_id,
             load_class, load_history_id, provenance_json)
           VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9::jsonb)`,
          [
            'M-002',
            `${yoy}%`,
            yoy,
            'percent',
            row.as_of_date,
            this.FromSysID,
            this.LoadClass,
            this.LoadHistoryID,
            JSON.stringify({ ...provenance, derivedFrom: 'M-001 YoY' }),
          ],
        );
      }
    }
  }
}

/**
 * Business Action: RetrieveAndLoadMcoRoster
 */
export class RetrieveAndLoadMcoRoster {
  DataRequestID = '';
  FromSysID = 'KY_DMS_MCO_CONTRACTS';
  LoadClass: LoadClass = 'TEST';
  SourceURI = '';
  FixtureName = 'testMcoRoster.json';
  SourceBytes: Buffer = Buffer.alloc(0);
  PSAObjectKey = '';
  ContentHash = '';
  LoadHistoryID = '';
  RowCount = 0;
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    this.LoadHistoryID = newId('LH');
    try {
      await InsertLoadHistory(this.client, {
        load_history_id: this.LoadHistoryID,
        data_request_id: this.DataRequestID,
        started_at: new Date(),
        source_uri: this.SourceURI,
        load_class: this.LoadClass,
      });

      const fixture = await readFixtureJson<McoFixture>(this.FixtureName);
      this.SourceBytes = Buffer.from(JSON.stringify(fixture, null, 2), 'utf8');
      this.SourceURI = fixture.source_uri || `fixture:${this.FixtureName}`;

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.PSAObjectKey = `psa/${this.FromSysID}/${this.LoadClass}/${stamp}/${this.LoadHistoryID}.json`;
      await psaStore.EnsureRootReady();
      const landed = await psaStore.PutObject(this.PSAObjectKey, this.SourceBytes);
      this.ContentHash = landed.contentHash;
      await this.client.query(
        `INSERT INTO bw_psa_meta.object_index
          (object_key, from_sys_id, load_history_id, load_class, content_hash, byte_length)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          this.PSAObjectKey,
          this.FromSysID,
          this.LoadHistoryID,
          this.LoadClass,
          this.ContentHash,
          landed.byteLength,
        ],
      );

      for (const m of fixture.mcos) {
        await this.client.query(
          `INSERT INTO bw_dso.dso_mco_roster
            (mco_key, mco_label, status, effective_date, from_sys_id, as_of_date, load_class, load_history_id)
           VALUES ($1,$2,$3,$4::date,$5,$6::date,$7,$8)`,
          [
            m.mco_key,
            m.mco_label,
            m.status,
            m.effective_date,
            this.FromSysID,
            fixture.as_of_date,
            this.LoadClass,
            this.LoadHistoryID,
          ],
        );
      }
      this.RowCount = fixture.mcos.length;

      const activeCount = fixture.mcos.filter((m) => m.status === 'active').length;
      await this.client.query(
        `INSERT INTO bw_cube.cube_exec_landing
          (measure_id, display_value, numeric_value, unit, as_of_date, from_sys_id,
           load_class, load_history_id, provenance_json)
         VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9::jsonb)`,
        [
          'M-007',
          String(activeCount),
          activeCount,
          'count',
          fixture.as_of_date,
          this.FromSysID,
          this.LoadClass,
          this.LoadHistoryID,
          JSON.stringify({
            measureFlow: ['PSA', 'Cleanse', 'DetailDSO', 'Cube'],
            psaObjectKey: this.PSAObjectKey,
            loadHistoryId: this.LoadHistoryID,
            fromSysId: this.FromSysID,
            sourceUri: this.SourceURI,
            sourcePageUri: config.mcoContractsPageUri,
            asOfDate: fixture.as_of_date,
            loadClass: this.LoadClass,
            attribution: fixture.attribution || '',
          }),
        ],
      );

      await CompleteLoadHistory(this.client, this.LoadHistoryID, {
        status: 'SUCCEEDED',
        row_count: this.RowCount,
        content_hash: this.ContentHash,
        as_of_date: fixture.as_of_date,
      });
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
      if (this.LoadHistoryID) {
        await CompleteLoadHistory(this.client, this.LoadHistoryID, {
          status: 'FAILED',
          notes: this.ErrorMessage,
        });
      }
    }
  }
}
