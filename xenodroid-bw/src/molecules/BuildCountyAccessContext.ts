import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import AdmZip from 'adm-zip';
import { config, REPO_ROOT } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { psaStore } from '../psa/filesystemPsa.js';
import { ParseCsvRecords, Sha256 } from '../adapters/operationalPublicSources.js';

/**
 * Business Action: BuildCountyAccessContext
 *
 * Joins, per state and county, the public denominators the county access
 * review needs beside the HCRIS negative-margin rollup:
 *  - Medicaid members (KY DMS "Monthly Membership Counts by County" PDF, all
 *    counties; the retained hydration pack bound six) or eligibles (FL AHCA
 *    "Age by County" eligibility PDF, 67 counties);
 *  - HRSA AHRF primary-care HPSA designation (county file, both states);
 *  - CMS Care Compare certified nursing-facility beds and 1–2 star counts;
 *  - the HCRIS county rollup already in the warehouse.
 * Every source is a publisher file already retained locally; the Kentucky
 * PDF is landed into PSA with its hash on first use. Nothing is imputed: a
 * county absent from a source carries null for that source.
 */

type Row = {
  state: string; countyKey: string; countyName: string; fips: string | null;
  members: number | null; membersPeriod: string | null; membersSource: string | null;
  hpsaCode: string | null; hpsaLabel: string | null; hpsaVintage: string | null;
  snfBeds: number | null; snfFacilities: number | null; lowRatedSnf: number | null;
  hcrisFacilities: number | null; hcrisNegative: number | null; hcrisBeds: number | null; hcrisMedicaidShare: number | null;
  sources: string[];
};

const HPSA_LABELS: Record<string, string> = { '0': 'No primary-care HPSA designation', '1': 'Whole-county primary-care HPSA', '2': 'Part-county primary-care HPSA' };

// Publisher spelling variants reconciled to one key: AHCA prints Miami-Dade
// as DADE, and one HCRIS row spells Hillsborough as HILLSBOURGH. City names
// that appear in the HCRIS county field (e.g. JACKSONVILLE, OCALA) are left
// unmatched rather than guessed.
const COUNTY_ALIASES: Record<string, string> = { DADE: 'MIAMIDADE', HILLSBOURGH: 'HILLSBOROUGH' };
export const countyKey = (name: string) => {
  const key = String(name || '').toUpperCase().replace(/\bCOUNTY\b/g, '').replace(/[^A-Z]/g, '');
  return COUNTY_ALIASES[key] || key;
};
const toNumber = (text: string) => Number(String(text).replace(/,/g, ''));

async function pdfLines(bytes: Buffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const lines: string[] = [];
  for (let index = 1; index <= doc.numPages; index += 1) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    let current = '';
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (item.str) current += item.str;
      if (item.hasEOL) { lines.push(current.replace(/\s+/g, ' ').trim()); current = ''; } else if (item.str && !item.str.endsWith(' ')) current += ' ';
    }
    if (current.trim()) lines.push(current.replace(/\s+/g, ' ').trim());
    page.cleanup();
  }
  await task.destroy();
  return lines;
}

async function latestMatching(dir: string, pattern: RegExp) {
  let files: string[] = [];
  try { files = (await fs.readdir(dir)).filter((f) => pattern.test(f)).sort(); } catch { return null; }
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

async function latestUnderStamps(root: string, pattern: RegExp) {
  let stamps: string[] = [];
  try { stamps = (await fs.readdir(root)).sort().reverse(); } catch { return null; }
  for (const stamp of stamps) {
    const hit = await latestMatching(path.join(root, stamp), pattern);
    if (hit) return hit;
  }
  return null;
}

/** "001 - Adair 1,465 1,156 1,305 1,066 1,051 2,444 8,487" → county + total members. */
export function ParseKentuckyCountyMembership(lines: string[]) {
  const counties: Array<{ county: string; members: number }> = [];
  let period: string | null = null;
  let statewide: number | null = null;
  for (const line of lines) {
    const coverage = line.match(/^(\d{1,2})\/1\/(\d{4}) \d{1,2}\/\d{1,2}\/\d{4}\s*$/);
    if (coverage) period = `${coverage[2]}-${coverage[1].padStart(2, '0')}`;
    const county = line.match(/^(\d{3}) - (.+?) ((?:[\d,]+ ){6})([\d,]+)\s*$/);
    if (county && county[1] !== '000') counties.push({ county: county[2].trim(), members: toNumber(county[4]) });
    const total = line.match(/^Unduplicated Member Count.*$/);
    if (total) { /* value is on the next line; handled below */ }
    const totalValue = line.match(/^([\d,]{7,}) ([\d,]+)\s*$/);
    if (totalValue && statewide == null) statewide = toNumber(totalValue[1]);
  }
  return { counties, period, statewide };
}

/** "BAY 6,799 5,172 7,457 1,048 4,699 4,649 1,059 2,434 968 313 34,598" → county + total eligibles. */
export function ParseFloridaCountyEligibles(lines: string[]) {
  const counties: Array<{ county: string; eligible: number }> = [];
  let statewide: number | null = null;
  for (const line of lines) {
    const county = line.match(/^([A-Z][A-Z .'-]*?)\s+((?:[\d,]+\s+){10})([\d,]+)\s*$/);
    if (!county) continue;
    const name = county[1].trim();
    if (/^STATE TOTAL/i.test(name)) { statewide = toNumber(county[3]); continue; }
    // "OTHER STATES" and "UNKNOWN" are residual rows in the state total, not counties.
    if (/LAST (MONTH|YEAR)|CHANGE|TOTAL|OTHER STATES|UNKNOWN/i.test(name)) continue;
    // AHCA prints Miami-Dade as "DADE"; Care Compare and HCRIS use "Miami-Dade".
    counties.push({ county: name === 'DADE' ? 'MIAMI-DADE' : name, eligible: toNumber(county[3]) });
  }
  return { counties, statewide };
}

export class BuildCountyAccessContext {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Rows: Row[] = [];
  Checks: Array<{ check_id: string; ok: boolean; expected: string; actual: string; detail: string }> = [];
  Notes: string[] = [];

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    const loadHistoryId = newId('LH-COUNTY-CTX');
    await InsertLoadHistory(this.client, {
      load_history_id: loadHistoryId, data_request_id: 'DR-REAL-COUNTY-ACCESS-CONTEXT', started_at: new Date(),
      source_uri: 'county access context (KY DMS county PDF · FL AHCA eligibility PDF · HRSA AHRF · CMS Care Compare · CMS HCRIS)', load_class: 'REAL',
    });
    try {
      const byKey = new Map<string, Row>();
      const row = (state: string, name: string) => {
        const key = `${state}|${countyKey(name)}`;
        const current = byKey.get(key) || {
          state, countyKey: countyKey(name), countyName: name.toUpperCase(), fips: null,
          members: null, membersPeriod: null, membersSource: null, hpsaCode: null, hpsaLabel: null, hpsaVintage: null,
          snfBeds: null, snfFacilities: null, lowRatedSnf: null, hcrisFacilities: null, hcrisNegative: null, hcrisBeds: null, hcrisMedicaidShare: null,
          sources: [],
        };
        byKey.set(key, current);
        return current;
      };

      // Kentucky members: latest DMS county PDF, landed into PSA with its hash.
      const kyPdf = await latestMatching(path.join(config.psaRoot, '..', 'tmp-county-pdfs'), /^KYDWMMCC\d{8}\.pdf$/i);
      if (kyPdf) {
        const bytes = await fs.readFile(kyPdf);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const key = `psa/KY_DMS_COUNTY_COUNTS/REAL/${stamp}/${path.basename(kyPdf)}`;
        await psaStore.EnsureRootReady();
        const landed = await psaStore.PutObject(key, bytes);
        await this.client.query(
          `INSERT INTO bw_psa_meta.object_index (object_key,from_sys_id,load_history_id,load_class,content_hash,byte_length) VALUES ($1,'KY_DMS_COUNTY_COUNTS',$2,'REAL',$3,$4)`,
          [key, loadHistoryId, landed.contentHash, landed.byteLength],
        );
        const parsed = ParseKentuckyCountyMembership(await pdfLines(bytes));
        const sum = parsed.counties.reduce((s, c) => s + c.members, 0);
        this.Checks.push({ check_id: 'COUNTY-KY-PDF-COUNTIES', ok: parsed.counties.length >= 118, expected: '>=118 Kentucky counties parsed', actual: String(parsed.counties.length), detail: `${path.basename(kyPdf)} coverage month ${parsed.period}` });
        this.Checks.push({ check_id: 'COUNTY-KY-PDF-SUM', ok: parsed.statewide == null || Math.abs(sum - parsed.statewide) <= parsed.statewide * 0.001, expected: parsed.statewide == null ? 'no statewide total on page' : String(parsed.statewide), actual: String(sum), detail: 'Sum of county totals vs the PDF\'s unduplicated statewide count (the "No County" row is excluded, so a small residual is expected).' });
        for (const c of parsed.counties) { const r = row('KY', c.county); r.members = c.members; r.membersPeriod = parsed.period; r.membersSource = 'KY_DMS_COUNTY_COUNTS'; r.sources.push('KY_DMS_COUNTY_COUNTS'); }
        this.Notes.push(`Kentucky members from ${path.basename(kyPdf)} (coverage month ${parsed.period}), ${parsed.counties.length} counties, sha256 ${landed.contentHash.slice(0, 12)}…`);
      } else {
        this.Checks.push({ check_id: 'COUNTY-KY-PDF-COUNTIES', ok: false, expected: 'a retained KYDWMMCC*.pdf', actual: 'none', detail: 'No Kentucky county membership PDF available locally.' });
      }

      // Florida eligibles: latest AHCA age-by-county PDF already in the FL PSA.
      const flPdf = await latestUnderStamps(path.join(config.floridaPsaRoot, 'FL_ELIGIBILITY_REPORTS', 'REAL'), /^age-by-county-\d{6}\.pdf$/i);
      if (flPdf) {
        const bytes = await fs.readFile(flPdf);
        const parsed = ParseFloridaCountyEligibles(await pdfLines(bytes));
        const period = path.basename(flPdf).match(/(\d{4})(\d{2})/);
        const periodLabel = period ? `${period[1]}-${period[2]}` : null;
        const sum = parsed.counties.reduce((s, c) => s + c.eligible, 0);
        this.Checks.push({ check_id: 'COUNTY-FL-PDF-COUNTIES', ok: parsed.counties.length === 67, expected: '67 Florida counties parsed', actual: String(parsed.counties.length), detail: `${path.basename(flPdf)}` });
        this.Checks.push({ check_id: 'COUNTY-FL-PDF-SUM', ok: parsed.statewide == null || Math.abs(sum - parsed.statewide) <= parsed.statewide * 0.01, expected: parsed.statewide == null ? 'no statewide total on page' : String(parsed.statewide), actual: String(sum), detail: 'Sum of the 67 county rows vs the PDF STATE TOTAL row (the total also includes the OTHER STATES and UNKNOWN residual rows, so a small residual is expected).' });
        for (const c of parsed.counties) { const r = row('FL', c.county); r.members = c.eligible; r.membersPeriod = periodLabel; r.membersSource = 'FL_ELIGIBILITY_REPORTS'; r.sources.push('FL_ELIGIBILITY_REPORTS'); }
        this.Notes.push(`Florida eligibles from ${path.basename(flPdf)} (sha256 ${Sha256(bytes).slice(0, 12)}…), ${parsed.counties.length} counties.`);
      } else {
        this.Checks.push({ check_id: 'COUNTY-FL-PDF-COUNTIES', ok: false, expected: 'a retained age-by-county PDF', actual: 'none', detail: 'No Florida eligibility PDF in the FL PSA.' });
      }

      // HRSA AHRF county file: primary-care HPSA designation for both states.
      const ahrfZip = await latestMatching(path.join(config.psaRoot, '..', 'tmp-ahrf'), /^AHRF_\d{4}-\d{4}_CSV\.zip$/i);
      if (ahrfZip) {
        const zip = new AdmZip(ahrfZip);
        const entry = zip.getEntries().find((e) => /AHRF\d{4}\.csv$/i.test(e.entryName));
        if (!entry) throw new Error(`No AHRF county CSV inside ${path.basename(ahrfZip)}`);
        const text = entry.getData().toString('latin1');
        const records = ParseCsvRecords(text);
        const vintage = path.basename(ahrfZip).match(/(\d{4}-\d{4})/)?.[1] || null;
        const hpsaField = Object.keys(records[0] || {}).filter((k) => /^hpsa_prim_care_\d{2}$/.test(k)).sort().pop();
        if (!hpsaField) throw new Error('AHRF county CSV has no hpsa_prim_care_* column');
        let matched = 0;
        for (const rec of records) {
          const stateAbbrev = String(rec.st_name_abbrev || '').toUpperCase();
          if (stateAbbrev !== 'KY' && stateAbbrev !== 'FL') continue;
          const r = row(stateAbbrev, String(rec.cnty_name || ''));
          r.fips = String(rec.fips_st_cnty || '') || null;
          r.hpsaCode = String(rec[hpsaField] ?? '').trim() || null;
          r.hpsaLabel = r.hpsaCode == null ? null : (HPSA_LABELS[r.hpsaCode] || `AHRF code ${r.hpsaCode}`);
          r.hpsaVintage = vintage;
          r.sources.push('HRSA_AHRF');
          matched += 1;
        }
        this.Checks.push({ check_id: 'COUNTY-AHRF-ROWS', ok: matched >= 180, expected: '>=180 KY+FL county rows (120 + 67)', actual: String(matched), detail: `${path.basename(ahrfZip)} field ${hpsaField}` });
        this.Notes.push(`HRSA AHRF ${vintage} primary-care HPSA code (${hpsaField}) for ${matched} KY+FL counties.`);
      } else {
        this.Checks.push({ check_id: 'COUNTY-AHRF-ROWS', ok: false, expected: 'a retained AHRF county CSV zip', actual: 'none', detail: 'No AHRF county file available locally.' });
      }

      // CMS Care Compare nursing facilities by county (both states loaded).
      const snf = await this.client.query<{ state_code: string; county_name: string; facilities: string; beds: string | null; low_rated: string }>(
        `SELECT state_code, county_name, COUNT(*)::text AS facilities, SUM(certified_beds)::text AS beds,
           SUM(CASE WHEN overall_rating BETWEEN 1 AND 2 THEN 1 ELSE 0 END)::text AS low_rated
         FROM (SELECT DISTINCT ON (ccn) ccn, state_code, county_name, certified_beds, overall_rating FROM bw_dso.dso_provider_facility WHERE load_class='REAL' AND state_code IS NOT NULL ORDER BY ccn, processing_date DESC NULLS LAST, load_history_id DESC) f
         GROUP BY state_code, county_name`,
      );
      for (const s of snf.rows) {
        const r = row(s.state_code, s.county_name);
        r.snfFacilities = Number(s.facilities); r.snfBeds = s.beds == null ? null : Number(s.beds); r.lowRatedSnf = Number(s.low_rated);
        r.sources.push('CMS_PROVIDER_DATA');
      }

      // HCRIS county rollup (OFR-04).
      const hcris = await this.client.query<{ state_code: string; county: string; facility_count: string; low_margin_facility_count: string; total_beds: string | null; avg_medicaid_day_share: string | null }>(
        `SELECT state_code, county, facility_count::text, low_margin_facility_count::text, total_beds::text, avg_medicaid_day_share::text
         FROM bw_dso.dso_county_facility_rollup WHERE load_class='REAL'`,
      );
      for (const h of hcris.rows) {
        if (!h.county) continue;
        const r = row(h.state_code, h.county);
        r.hcrisFacilities = Number(h.facility_count); r.hcrisNegative = Number(h.low_margin_facility_count);
        r.hcrisBeds = h.total_beds == null ? null : Number(h.total_beds); r.hcrisMedicaidShare = h.avg_medicaid_day_share == null ? null : Number(h.avg_medicaid_day_share);
        r.sources.push('CMS_HCRIS');
      }

      this.Rows = [...byKey.values()].sort((a, b) => a.state.localeCompare(b.state) || a.countyName.localeCompare(b.countyName));
      await this.client.query(`DELETE FROM bw_dso.dso_county_access_context WHERE load_class='REAL'`);
      for (const r of this.Rows) {
        await this.client.query(
          `INSERT INTO bw_dso.dso_county_access_context
           (state_code,county_key,county_name,county_fips,medicaid_members,medicaid_members_period,medicaid_members_source,
            hpsa_primary_care_code,hpsa_primary_care_label,hpsa_vintage,certified_snf_beds,snf_facility_count,low_rated_snf_count,
            hcris_facility_count,hcris_negative_margin_count,hcris_total_beds,hcris_avg_medicaid_day_share,from_sys_ids,load_class,load_history_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'REAL',$19)`,
          [r.state, r.countyKey, r.countyName, r.fips, r.members, r.membersPeriod, r.membersSource, r.hpsaCode, r.hpsaLabel, r.hpsaVintage,
            r.snfBeds, r.snfFacilities, r.lowRatedSnf, r.hcrisFacilities, r.hcrisNegative, r.hcrisBeds, r.hcrisMedicaidShare, [...new Set(r.sources)], loadHistoryId],
        );
      }
      const ok = this.Checks.every((c) => c.ok);
      await CompleteLoadHistory(this.client, loadHistoryId, {
        status: ok ? 'SUCCEEDED' : 'FAILED', row_count: this.Rows.length, as_of_date: new Date().toISOString().slice(0, 10),
        notes: `${this.Rows.length} county rows; ${this.Notes.join(' ')}${ok ? '' : ' CHECKS FAILED'}`,
      });
      if (!ok) throw new Error(`county access context checks failed: ${this.Checks.filter((c) => !c.ok).map((c) => `${c.check_id} expected ${c.expected} actual ${c.actual}`).join('; ')}`);
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
      await CompleteLoadHistory(this.client, loadHistoryId, { status: 'FAILED', notes: this.ErrorMessage });
    }
  }
}

function generatedModule(payload: unknown) {
  return `/**
 * Generated by XenoDroid BW export — do not hand-edit.
 * County access context, state-neutral (KY + FL): Medicaid members or
 * eligibles, HRSA primary-care HPSA designation, CMS certified nursing beds,
 * and the HCRIS negative-margin rollup, joined by county. A denominator for
 * access review — never a closure prediction or an access finding.
 */
export const COUNTY_ACCESS_CONTEXT = ${JSON.stringify(payload, null, 2)};
`;
}

export class ExportCountyAccessContextForUi {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  ExportPath = path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'countyAccessContext.js');
  CountyCount = 0;

  constructor(private client: pg.PoolClient, private checks: BuildCountyAccessContext['Checks'] = [], private notes: string[] = []) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const rows = await this.client.query<Record<string, string | null>>(
        `SELECT DISTINCT ON (state_code, county_key) * FROM bw_dso.dso_county_access_context WHERE load_class='REAL' ORDER BY state_code, county_key, load_history_id DESC`,
      );
      const num = (v: string | null) => (v == null ? null : Number(v));
      const byState: Record<string, unknown> = {};
      for (const state of config.ofrStates) {
        const counties = rows.rows.filter((r) => r.state_code === state).map((r) => {
          const members = num(r.medicaid_members); const snfBeds = num(r.certified_snf_beds);
          return {
            county: r.county_name, countyKey: r.county_key, fips: r.county_fips,
            medicaidMembers: members, membersPeriod: r.medicaid_members_period, membersSource: r.medicaid_members_source,
            hpsaPrimaryCareCode: r.hpsa_primary_care_code, hpsaPrimaryCareLabel: r.hpsa_primary_care_label, hpsaVintage: r.hpsa_vintage,
            certifiedSnfBeds: snfBeds, snfFacilityCount: num(r.snf_facility_count), lowRatedSnfCount: num(r.low_rated_snf_count),
            hcrisFacilityCount: num(r.hcris_facility_count), hcrisNegativeMarginCount: num(r.hcris_negative_margin_count),
            hcrisTotalBeds: num(r.hcris_total_beds), hcrisAvgMedicaidDayShare: num(r.hcris_avg_medicaid_day_share),
            snfBedsPer1kMembers: members && snfBeds != null ? Number(((snfBeds / members) * 1000).toFixed(2)) : null,
            sources: r.from_sys_ids as unknown as string[],
          };
        });
        byState[state] = {
          state,
          membersLabel: state === 'FL' ? 'Medicaid eligibles (AHCA point-in-time count)' : 'Medicaid members (DMS monthly count)',
          countyCount: counties.length,
          countiesWithMembers: counties.filter((c) => c.medicaidMembers != null).length,
          countiesWithHpsa: counties.filter((c) => c.hpsaPrimaryCareCode != null).length,
          counties,
        };
        this.CountyCount += counties.length;
      }
      const payload = {
        schema: 'decisionpro/county-access-context/v1',
        generatedAt: new Date().toISOString(),
        loadClass: 'REAL',
        note: 'Each county row joins publisher facts by county name; a null means that source has no row for the county, never an imputed value. Members/eligibles are point-in-time counts, not people served or access.',
        sourceNotes: this.notes,
        reconciliation: { status: this.checks.every((c) => c.ok) ? 'PASS' : 'FAIL', claimAllowed: this.checks.every((c) => c.ok), checks: this.checks },
        byState,
      };
      await fs.mkdir(path.dirname(this.ExportPath), { recursive: true });
      await fs.writeFile(this.ExportPath, generatedModule(payload), 'utf8');
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
