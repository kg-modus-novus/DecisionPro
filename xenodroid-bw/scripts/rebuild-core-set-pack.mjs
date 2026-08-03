/**
 * Rebuild CMS Core Set rows in realPublicHydrationPack.json with:
 * - FFY / MY labeling (asOfDate = MY end)
 * - 2024 vintage from download.medicaid.gov (PPC2-AD postpartum)
 * Prefer Ages 3-21 for WCV-CH and postpartum rate for PPC-AD / PPC2-AD.
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { ResolveCoreSetCsvUri } from './resolve-core-set-csv.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packPath = path.join(root, 'src/fixtures/realPublicHydrationPack.json');

function get(url) {
  return new Promise((res, rej) => {
    https
      .get(url, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          get(r.headers.location).then(res, rej);
          return;
        }
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', rej);
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const MEASURE_SPECS = {
  'M-010': {
    abbrs: ['WCV-CH'],
    prefer: /Ages 3(?: to |–)21(?:\s|$)/i,
  },
  'M-011': {
    abbrs: ['BCS-AD'],
    prefer: /Ages 50(?: to |–)74(?:\s|$)|Ages 50(?: to |–)64(?:\s|$)/i,
  },
  'M-012': {
    abbrs: ['PPC-AD', 'PPC2-AD'],
    prefer: /Postpartum Care Visit on or Between 7 and 84 Days/i,
  },
};

function pickRow(cands, prefer) {
  if (!cands.length) return null;
  return (
    cands.find((r) => prefer.test(String(r.def || ''))) ||
    cands.find((r) => prefer.test(`${r.pop} ${r.def} ${r.name}`)) ||
    cands[0]
  );
}

function periodFields(coreSetYear) {
  const measurementYear = coreSetYear - 1;
  return {
    asOfDate: `${measurementYear}-12-31`,
    coreSetYear,
    measurementYear,
    periodId: `ffy${coreSetYear}`,
    periodLabel: `FFY ${coreSetYear} reporting · MY ${measurementYear}`,
  };
}

const years = [2020, 2021, 2022, 2023, 2024];
const resolved = {};
for (const y of years) {
  const r = await ResolveCoreSetCsvUri(y);
  if (!r.ok) {
    console.error('Unresolved Core Set CSV', y, r.attempts);
    process.exit(1);
  }
  resolved[y] = r.resolvedUrl;
  console.log('Resolved', y, '→', r.resolvedUrl);
}

const extracted = {};
for (const [year, url] of Object.entries(resolved)) {
  const y = Number(year);
  const text = await get(url);
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const ky = lines
    .slice(1)
    .map(splitCsvLine)
    .filter((cols) => cols[idx.State] === 'Kentucky');

  extracted[y] = {};
  for (const [measureId, spec] of Object.entries(MEASURE_SPECS)) {
    const cands = [];
    for (const abbr of spec.abbrs) {
      for (const cols of ky.filter((c) => c[idx['Measure Abbreviation']] === abbr)) {
        const rate = Number(String(cols[idx['State Rate']]).replace('%', '').trim());
        if (!Number.isFinite(rate)) continue;
        cands.push({
          abbr,
          rate,
          median: Number(String(cols[idx.Median] || '').replace('%', '').trim()) || null,
          pop: cols[idx.Population] || '',
          def: cols[idx['Rate Definition']] || '',
          name: cols[idx['Measure Name']] || '',
        });
      }
    }
    const hit = pickRow(cands, spec.prefer);
    extracted[y][measureId] = hit;
    console.log(y, measureId, hit ? `${hit.abbr}=${hit.rate}` : 'MISSING');
  }
}

const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const kept = pack.landingMeasures.filter(
  (m) => !['M-010', 'M-011', 'M-012'].includes(m.measureId),
);

const coreRows = [];
for (const y of years) {
  const url = resolved[y];
  const periods = periodFields(y);
  for (const measureId of ['M-010', 'M-011', 'M-012']) {
    const hit = extracted[y][measureId];
    if (!hit) continue;
    const noteBits = [
      `KY ${hit.abbr} from CMS ${y} Child/Adult Core Set quality measures CSV.`,
      `${periods.periodLabel}.`,
      'HEDIS-style Core Set: FFY reporting year maps to prior measurement year.',
    ];
    if (hit.abbr === 'PPC2-AD') {
      noteBits.push(
        'Definition break: PPC-AD renamed to PPC2-AD in FFY 2024; postpartum visit rate (7–84 days) retained for M-012.',
      );
    }
    if (measureId === 'M-011' && y === 2024) {
      noteBits.push(
        'Definition/age-band break: FFY 2024 BCS-AD row used Ages 50–64 (prior vintages Ages 50–74).',
      );
    }
    if (measureId === 'M-012' && y === 2024) {
      noteBits.push(
        'Cross-source: KY DMS FY2025 Comprehensive Evaluation reports HEDIS PPC Postpartum Care MY 2023 = 82.21% and MY 2022 = 78.16% (MCO EQRO path) — not substituted into this CMS Core Set bind.',
      );
    }
    coreRows.push({
      measureId,
      displayValue: String(hit.rate),
      numericValue: hit.rate,
      unit: 'percent',
      asOfDate: periods.asOfDate,
      fromSysId: 'CMS_MEDICAID_SCORECARD',
      sourceUri: url,
      sourcePageUri: 'https://www.medicaid.gov/state-overviews/scorecard',
      peerMedian: hit.median,
      coreSetAbbr: hit.abbr,
      coreSetYear: periods.coreSetYear,
      measurementYear: periods.measurementYear,
      periodId: periods.periodId,
      periodLabel: periods.periodLabel,
      note: noteBits.join(' '),
    });
  }
}

pack.landingMeasures = [...kept, ...coreRows].sort((a, b) => {
  const mid = String(a.measureId).localeCompare(String(b.measureId));
  if (mid !== 0) return mid;
  return String(a.asOfDate).localeCompare(String(b.asOfDate));
});

fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
console.log('Wrote', packPath, 'core rows', coreRows.length);
