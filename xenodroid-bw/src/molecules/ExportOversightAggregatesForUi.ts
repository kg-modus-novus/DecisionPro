import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { OVERSIGHT_DATA_REQUEST_ID, PROFILE_COHORTS, PROFILE_MEASURE_COLUMNS } from './BillerOversightAggregateOwner.js';
import { PLAIN_CODE_LABELS } from './ExportPotentialFraudRadarForUi.js';

/**
 * ExportOversightAggregatesForUi: a read-only projection of the latest SUCCEEDED
 * biller oversight aggregate for the five oversight pages of Potential Fraud
 * Detection (early warning, follow the billers, provider patterns; the ledger
 * and the state brief read the radar and the policy events).
 * Plan: docs/planning/oversight-pages-codexen-plan.md, section 1.1.
 *
 * Serialization plus one disclosure rule applied at this boundary to every
 * figure a page shows: none describes fewer than SMALL_CELL_MINIMUM billers. A
 * count from 1 to 10 is written as null and the dollars it describes as null;
 * practice areas with fewer billers are merged into "all other areas"; the ten
 * largest billers' paid is withheld when 1 to 10 billers remain beyond them
 * (total paid less the top 10 would describe those). The ranking inputs (each
 * profile's billers and six cohorts, counts and dollars) are carried as loaded
 * and shown by no page for one service, so the program's medians and ranks are
 * exact. The rule is a display rule, not a file rule: the ranking inputs hold
 * small counts, and a withheld cell that is the only one withheld in a set
 * adding up to a shown total can be worked out by subtraction. Whether the published
 * file must meet the rule as well is open for the Director (plan section 1.1).
 * No alert, rank, reading or sum of cohorts is computed here: the app's
 * OversightReview program does that.
 *
 * Writes alp/oversightAggregates.js (loaded on demand).
 */

export const SMALL_CELL_MINIMUM = 11;

/** A count shown only from SMALL_CELL_MINIMUM up; 0 stays 0. */
export function WithheldCount(count: number): number | null {
  return count > 0 && count < SMALL_CELL_MINIMUM ? null : count;
}

/** Dollars shown only when the billers they describe are shown. */
export function WithheldPaid(count: number, paid: number): number | null {
  return WithheldCount(count) === null ? null : Math.round(paid);
}

/** The measures of a full profile, in PROFILE_MEASURE_COLUMNS order, with the count each one's small-cell rule reads. */
const MEASURES = Object.keys(PROFILE_MEASURE_COLUMNS);
const MEASURE_RULE_COUNT: Record<string, string> = {
  top10: 'billers-beyond-top10', // the rest of the billers: total paid less the top 10 describes them
  'million-median-months': 'million',
  'shared-addresses': 'shared-address',
};

/** Areas with fewer billers than SMALL_CELL_MINIMUM (and areas with no ZIP) merged into one "all other areas" row. */
export function MergeSmallAreas(areas: Array<{ zip3: string; city: string; billers: number; paid: number }>): Array<[string, string, number | null, number | null]> {
  const shown = areas.filter((a) => a.zip3 !== '' && a.billers >= SMALL_CELL_MINIMUM).sort((a, b) => b.paid - a.paid);
  const rest = areas.filter((a) => !(a.zip3 !== '' && a.billers >= SMALL_CELL_MINIMUM));
  const rows: Array<[string, string, number | null, number | null]> = shown.map((a) => [a.zip3, a.city, a.billers, Math.round(a.paid)]);
  if (rest.length > 0) {
    const billers = rest.reduce((s, a) => s + a.billers, 0);
    const paid = rest.reduce((s, a) => s + a.paid, 0);
    rows.push(['', 'all other areas', WithheldCount(billers), WithheldPaid(billers, paid)]);
  }
  return rows;
}

export class ExportOversightAggregatesForUi {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  ExportPath = config.oversightExportPath;
  LoadHistoryID = '';
  MonthlySeriesCount = 0;
  GroupCount = 0;
  ProfileCount = 0;
  FullProfileCount = 0;
  ExportBytes = 0;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const q = <T extends pg.QueryResultRow>(sql: string, args: unknown[] = []) => this.client.query<T>(sql, args).then((r) => r.rows);
      const loads = await q<{ load_history_id: string; completed_at: string; as_of_date: string; notes: string; row_count: number }>(
        `SELECT load_history_id, completed_at, as_of_date::text AS as_of_date, notes, row_count FROM bw_ctl.load_history
          WHERE data_request_id = $1 AND status = 'SUCCEEDED' AND load_class = 'REAL' ORDER BY completed_at DESC LIMIT 1`,
        [OVERSIGHT_DATA_REQUEST_ID],
      );
      if (loads.length === 0) throw new Error('no SUCCEEDED biller oversight load to export; run oversight-load');
      const load = loads[0];
      this.LoadHistoryID = load.load_history_id;
      const id = [load.load_history_id];
      const screenLoadId = /screen load (\S+);/.exec(load.notes ?? '')?.[1] ?? '';
      const stageParameters = JSON.parse(/parameters (\{[^}]*\})/.exec(load.notes ?? '')?.[1] ?? '{}') as Record<string, number>;

      // Monthly series, aligned on one month axis.
      const months = await q<{ state_code: string; hcpcs: string; month_ym: string; paid: string; billing_npis: number }>(
        `SELECT state_code, hcpcs, month_ym, paid, billing_npis FROM bw_dso.dso_tmsis_state_code_month WHERE load_history_id = $1 ORDER BY 1, 2, 3`, id);
      const codeMonths = await q<{ hcpcs: string; month_ym: string; paid: string }>(
        `SELECT hcpcs, month_ym, paid FROM bw_dso.dso_tmsis_code_month WHERE load_history_id = $1 ORDER BY 1, 2`, id);
      const allMonths = [...new Set([...months.map((m) => m.month_ym), ...codeMonths.map((m) => m.month_ym)])].sort();
      const firstMonth = allMonths[0] ?? '';
      const lastMonth = allMonths[allMonths.length - 1] ?? '';
      const monthIndex = (ym: string) => (Number(ym.slice(0, 4)) - Number(firstMonth.slice(0, 4))) * 12 + Number(ym.slice(5, 7)) - Number(firstMonth.slice(5, 7));
      const monthCount = lastMonth === '' ? 0 : monthIndex(lastMonth) + 1;
      const monthly: Record<string, { paid: Array<number | null>; billers: Array<number | null> }> = {};
      for (const m of months) {
        const k = `${m.state_code}|${m.hcpcs}`;
        const s = (monthly[k] ??= { paid: Array(monthCount).fill(0), billers: Array(monthCount).fill(0) });
        const i = monthIndex(m.month_ym);
        s.billers[i] = WithheldCount(Number(m.billing_npis));
        s.paid[i] = WithheldPaid(Number(m.billing_npis), Number(m.paid));
      }
      this.MonthlySeriesCount = Object.keys(monthly).length;
      const nationalMonthly: Record<string, number[]> = {};
      for (const m of codeMonths) (nationalMonthly[m.hcpcs] ??= Array(monthCount).fill(0))[monthIndex(m.month_ym)] = Math.round(Number(m.paid));

      // Biller groups: members per year, and the other services they bill.
      const groupYears = await q<{ group_state: string; group_hcpcs: string; group_year: number; year: number; members: number; members_billing: number; members_paid: string; members_code_paid: string }>(
        `SELECT group_state, group_hcpcs, group_year, year, members, members_billing, members_paid, members_code_paid FROM bw_dso.dso_biller_group_year WHERE load_history_id = $1 ORDER BY 1, 2, 3, 4`, id);
      const groupServices = await q<{ group_state: string; group_hcpcs: string; group_year: number; hcpcs: string; year: number; members_billing: number; paid: string }>(
        `SELECT group_state, group_hcpcs, group_year, hcpcs, year, members_billing, paid FROM bw_dso.dso_biller_group_service_year WHERE load_history_id = $1 ORDER BY 1, 2, 3, 4, 5`, id);
      const groups: Record<string, { members: number; years: Array<[number, number | null, number | null, number | null]>; services: Record<string, Array<[number, number | null, number | null]>> }> = {};
      for (const g of groupYears) {
        const k = `${g.group_state}|${g.group_hcpcs}|${g.group_year}`;
        const grp = (groups[k] ??= { members: Number(g.members), years: [], services: {} });
        const billing = Number(g.members_billing);
        grp.years.push([Number(g.year), WithheldCount(billing), WithheldPaid(billing, Number(g.members_paid)), WithheldPaid(billing, Number(g.members_code_paid))]);
      }
      const serviceRows: Record<string, Array<[number, number, number]>> = {};
      for (const s of groupServices) (serviceRows[`${s.group_state}|${s.group_hcpcs}|${s.group_year}|${s.hcpcs}`] ??= []).push([Number(s.year), Number(s.members_billing), Number(s.paid)]);
      for (const [k, rows] of Object.entries(serviceRows)) {
        if (!rows.some((r) => r[1] >= SMALL_CELL_MINIMUM)) continue; // a service no year of which reaches the minimum is not shown
        const [st, code, yr, hcpcs] = k.split('|');
        const grp = groups[`${st}|${code}|${yr}`];
        if (grp) grp.services[hcpcs] = rows.map(([year, billing, paid]) => [year, WithheldCount(billing), WithheldPaid(billing, paid)]);
      }
      this.GroupCount = Object.keys(groups).length;

      // Profiles: ranking inputs for every profile; the full profile and areas for the state x codes the screen names.
      const measures = await q<{ state_code: string; hcpcs: string; year: number; measure: string; count_value: string; paid: string }>(
        `SELECT state_code, hcpcs, year, measure, count_value, paid FROM bw_dso.dso_biller_profile_measure WHERE load_history_id = $1`, id);
      const byProfile = new Map<string, Map<string, { count: number; paid: number }>>();
      let profileYear = 0;
      for (const m of measures) {
        const k = `${m.state_code}|${m.hcpcs}`;
        profileYear = Math.max(profileYear, Number(m.year));
        (byProfile.get(k) ?? byProfile.set(k, new Map()).get(k)!).set(m.measure, { count: Number(m.count_value), paid: Number(m.paid) });
      }
      const flagged = new Set(Object.keys(monthly));
      const profileSigns: Record<string, number[]> = {};
      const profiles: Record<string, Array<[number | null, number | null]>> = {};
      for (const [k, ms] of byProfile) {
        const v = (name: string) => ms.get(name) ?? { count: 0, paid: 0 };
        profileSigns[k] = ['billers', ...PROFILE_COHORTS].flatMap((name) => [v(name).count, Math.round(v(name).paid)]);
        if (!flagged.has(k)) continue;
        profiles[k] = MEASURES.map((name) => {
          const ruleCount = name in MEASURE_RULE_COUNT ? MEASURE_RULE_COUNT[name] : name;
          const governing = ruleCount === 'billers-beyond-top10' ? Math.max(0, v('billers').count - 10) : v(ruleCount).count;
          const shown = WithheldCount(governing) !== null;
          return [shown ? Number(v(name).count) : null, shown ? Math.round(v(name).paid) : null];
        });
      }
      this.ProfileCount = Object.keys(profileSigns).length;
      this.FullProfileCount = Object.keys(profiles).length;
      const areaRows = await q<{ state_code: string; hcpcs: string; zip3: string; city: string; billers: number; paid: string }>(
        `SELECT state_code, hcpcs, zip3, city, billers, paid FROM bw_dso.dso_biller_profile_area WHERE load_history_id = $1`, id);
      const areasByProfile: Record<string, Array<{ zip3: string; city: string; billers: number; paid: number }>> = {};
      for (const a of areaRows) {
        const k = `${a.state_code}|${a.hcpcs}`;
        if (profiles[k]) (areasByProfile[k] ??= []).push({ zip3: a.zip3, city: a.city, billers: Number(a.billers), paid: Number(a.paid) });
      }
      const areas: Record<string, Array<[string, string, number | null, number | null]>> = {};
      for (const [k, list] of Object.entries(areasByProfile)) areas[k] = MergeSmallAreas(list);

      // Code labels: the radar's plain wording first, else the HCPCS short description.
      const labels = await q<{ hcpcs: string; label: string }>(`SELECT hcpcs, label FROM bw_dso.dso_hcpcs_label WHERE load_history_id = $1`, id);
      const codeLabels: Record<string, string> = {};
      for (const l of labels) codeLabels[l.hcpcs] = PLAIN_CODE_LABELS[l.hcpcs] ?? l.label;

      const payload = {
        schema: 'decisionpro/oversight-aggregates/v1',
        generatedAt: new Date().toISOString(),
        loadClass: 'REAL',
        asOf: load.as_of_date,
        loadHistoryId: load.load_history_id,
        loadCompletedAt: load.completed_at,
        screenLoadHistoryId: screenLoadId,
        notes: load.notes,
        smallCellMinimum: SMALL_CELL_MINIMUM,
        stageParameters,
        firstMonth,
        monthCount,
        monthly,
        nationalMonthly,
        groupYearColumns: ['year', 'membersBilling', 'membersPaid', 'membersCodePaid'],
        groupServiceColumns: ['year', 'membersBilling', 'paid'],
        groups,
        profileYear,
        profileSignColumns: ['billers', ...PROFILE_COHORTS].flatMap((name) => [`${name}:count`, `${name}:paid`]),
        profileSigns,
        profileMeasures: MEASURES,
        profiles,
        areaColumns: ['zip3', 'city', 'billers', 'paid'],
        areas,
        codeLabels,
      };
      const text = `/**\n * Generated by XenoDroid BW export — do not hand-edit.\n * Oversight pages: monthly series, biller groups, biller profiles and practice areas. Pages show no figure for fewer than ${SMALL_CELL_MINIMUM} billers; this file is not held to that rule (the ranking inputs are as loaded; see the plan, section 1.1).\n * Regenerate: npx tsx src/cli.ts oversight-export (after oversight-load) from xenodroid-bw.\n */\nexport const OVERSIGHT_AGGREGATES = ${JSON.stringify(payload)};\n`;
      await fs.mkdir(path.dirname(this.ExportPath), { recursive: true });
      await fs.writeFile(this.ExportPath, text, 'utf8');
      this.ExportBytes = Buffer.byteLength(text);
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
