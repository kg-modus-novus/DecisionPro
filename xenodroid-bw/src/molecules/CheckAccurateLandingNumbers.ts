import type pg from 'pg';
import { config } from '../config.js';
import {
  ComputeYoYChangePercent,
  ParseKentuckyEnrollmentFromPiCsv,
  SelectAllEnrollmentPeriods,
  SelectLatestEnrollment,
} from '../atoms/ParsePiEnrollmentCsv.js';
import { readFixtureJson } from './SeedWarehouseCatalog.js';

export type AccuracyResult = {
  measure_id: string;
  ok: boolean;
  expected: string;
  actual: string;
  detail: string;
};

/**
 * Business Action: CheckAccurateLandingNumbers
 * Re-reads published/curated source extracts and compares to REAL cube values.
 * Multi-period measures are keyed by measure_id + as_of_date.
 */
export class CheckAccurateLandingNumbers {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Results: AccuracyResult[] = [];

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const cube = await this.client.query<{
        measure_id: string;
        display_value: string;
        numeric_value: string | null;
        as_of_date: string;
      }>(
        `SELECT DISTINCT ON (c.measure_id, c.as_of_date)
           c.measure_id, c.display_value, c.numeric_value::text, c.as_of_date::text
         FROM bw_cube.cube_exec_landing c
         JOIN bw_ctl.load_history lh ON lh.load_history_id = c.load_history_id
         WHERE c.load_class = 'REAL'
         ORDER BY c.measure_id, c.as_of_date, lh.started_at DESC NULLS LAST, c.load_history_id DESC`,
      );
      const byIdDate = new Map(cube.rows.map((r) => [`${r.measure_id}|${r.as_of_date}`, r]));
      const latestById = new Map<string, (typeof cube.rows)[number]>();
      for (const r of [...cube.rows].sort((a, b) => a.as_of_date.localeCompare(b.as_of_date))) {
        latestById.set(r.measure_id, r);
      }

      const csvRes = await fetch(config.piDatasetCsvUrl);
      if (!csvRes.ok) throw new Error(`PI CSV refetch HTTP ${csvRes.status}`);
      const csvText = await csvRes.text();
      const rows = ParseKentuckyEnrollmentFromPiCsv(csvText);
      const latest = SelectLatestEnrollment(rows);
      if (!latest || latest.total_enrollment == null) {
        throw new Error('Accuracy refitch: no KY enrollment');
      }
      const yoy = ComputeYoYChangePercent(rows, latest);

      const m001 = latestById.get('M-001');
      this.Results.push({
        measure_id: 'M-001',
        ok: m001 != null && Number(m001.numeric_value) === latest.total_enrollment,
        expected: String(latest.total_enrollment),
        actual: m001?.numeric_value ?? '(missing)',
        detail: `period ${latest.period_ym} as_of ${latest.as_of_date}`,
      });

      const allPeriods = SelectAllEnrollmentPeriods(rows);
      const cubeM001Count = cube.rows.filter((r) => r.measure_id === 'M-001').length;
      this.Results.push({
        measure_id: 'M-001-SERIES',
        ok: cubeM001Count >= allPeriods.length && allPeriods.length >= 3,
        expected: `>=${allPeriods.length} PI periods in cube`,
        actual: String(cubeM001Count),
        detail: `Full PI series hydrate (${allPeriods[0]?.period_ym || '?'}→${allPeriods.at(-1)?.period_ym || '?'})`,
      });

      const m002 = latestById.get('M-002');
      if (yoy == null) {
        this.Results.push({
          measure_id: 'M-002',
          ok: m002 == null,
          expected: '(no prior-year period)',
          actual: m002?.display_value ?? '(missing)',
          detail: 'YoY optional when prior period absent',
        });
      } else {
        this.Results.push({
          measure_id: 'M-002',
          ok: m002 != null && Number(m002.numeric_value) === yoy,
          expected: String(yoy),
          actual: m002?.numeric_value ?? '(missing)',
          detail: 'YoY vs prior year same month',
        });
      }

      // Sample a historical YoY when a mid-series period has a prior-year peer.
      const mid = allPeriods.find((r) => ComputeYoYChangePercent(rows, r) != null && r.period_ym !== latest.period_ym);
      if (mid) {
        const midYoy = ComputeYoYChangePercent(rows, mid);
        const cubeMid = byIdDate.get(`M-002|${mid.as_of_date}`);
        this.Results.push({
          measure_id: 'M-002-HIST',
          ok: midYoy != null && cubeMid != null && Number(cubeMid.numeric_value) === midYoy,
          expected: String(midYoy),
          actual: cubeMid?.numeric_value ?? '(missing)',
          detail: `Historical YoY sample period ${mid.period_ym}`,
        });
      }

      const roster = await readFixtureJson<{
        mcos: Array<{ status: string }>;
      }>('realMcoRosterCurated.json');
      const active = roster.mcos.filter((m) => m.status === 'active').length;
      const m007 = latestById.get('M-007');
      this.Results.push({
        measure_id: 'M-007',
        ok: m007 != null && Number(m007.numeric_value) === active,
        expected: String(active),
        actual: m007?.numeric_value ?? '(missing)',
        detail: 'Active MCO count from curated DMS roster extract',
      });

      const pack = await readFixtureJson<{
        landingMeasures: Array<{
          measureId: string;
          numericValue: number | null;
          displayValue: string;
          asOfDate: string;
        }>;
      }>('realPublicHydrationPack.json');
      for (const m of pack.landingMeasures) {
        const cubeRow = byIdDate.get(`${m.measureId}|${m.asOfDate}`);
        const ok =
          cubeRow != null &&
          (m.numericValue == null
            ? cubeRow.display_value === m.displayValue
            : Number(cubeRow.numeric_value) === m.numericValue);
        this.Results.push({
          measure_id: m.measureId,
          ok,
          expected: m.numericValue == null ? m.displayValue : String(m.numericValue),
          actual: cubeRow?.numeric_value ?? cubeRow?.display_value ?? '(missing)',
          detail: `Public hydration pack binding as_of ${m.asOfDate}`,
        });
      }

      const roomCount = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM bw_cube.cube_room_row WHERE load_class='REAL'`,
      );
      const roomsOk = Number(roomCount.rows[0].c) >= 20;
      this.Results.push({
        measure_id: 'ROOM-CUBES',
        ok: roomsOk,
        expected: '>=20 REAL room rows',
        actual: roomCount.rows[0].c,
        detail: 'Evidence Room hydration row count',
      });

      const failed = this.Results.filter((r) => !r.ok);
      if (failed.length) {
        this.Status = 'FAILED';
        this.ErrorMessage = failed.map((f) => `${f.measure_id}: expected ${f.expected} got ${f.actual}`).join('; ');
        return;
      }
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
    }
  }
}
