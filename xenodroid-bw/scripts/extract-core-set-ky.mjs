import https from 'node:https';
import { ResolveCoreSetCsvUri } from './resolve-core-set-csv.mjs';

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

function parseCsv(t) {
  const lines = t.split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]);
  const idx = (n) => header.indexOf(n);
  const iState = idx('State');
  const iAbbr = idx('Measure Abbreviation');
  const iYear = idx('Core Set Year') >= 0 ? idx('Core Set Year') : idx('FFY');
  const iRate = idx('State Rate');
  const iMed = idx('Median');
  const iPop = idx('Population');
  const iDef = idx('Rate Definition');
  const iName = idx('Measure Name');
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    if (cols[iState] !== 'Kentucky') continue;
    rows.push({
      abbr: cols[iAbbr],
      year: cols[iYear],
      rate: cols[iRate],
      median: cols[iMed],
      pop: cols[iPop],
      name: cols[iName],
      def: (cols[iDef] || '').slice(0, 160),
    });
  }
  return rows;
}

const years = [2020, 2021, 2022, 2023, 2024];
const picks = {
  'M-010': { abbrs: ['WCV-CH'], prefer: /Ages 3(?: to |–)21(?:\s|$)/i },
  'M-011': { abbrs: ['BCS-AD'], prefer: /Ages 50(?: to |–)74(?:\s|$)|Ages 50(?: to |–)64(?:\s|$)/i },
  'M-012': { abbrs: ['PPC-AD', 'PPC2-AD'], prefer: /Postpartum Care Visit on or Between 7 and 84 Days/i },
};

const out = {};
for (const year of years) {
  const resolved = await ResolveCoreSetCsvUri(year);
  if (!resolved.ok) {
    out[year] = { error: 'unresolved', attempts: resolved.attempts };
    continue;
  }
  const rows = parseCsv(await get(resolved.resolvedUrl));
  out[year] = { sourceUri: resolved.resolvedUrl };
  for (const [measureId, spec] of Object.entries(picks)) {
    const cands = rows
      .filter((r) => spec.abbrs.includes(r.abbr))
      .map((r) => ({ ...r, n: Number(String(r.rate).replace('%', '').trim()) }))
      .filter((r) => Number.isFinite(r.n));
    const preferred =
      cands.find((r) => spec.prefer.test(String(r.def || ''))) ||
      cands.find((r) => spec.prefer.test(`${r.pop} ${r.def} ${r.name}`)) ||
      cands[0];
    out[year][measureId] = preferred || null;
  }
}
console.log(JSON.stringify(out, null, 2));
