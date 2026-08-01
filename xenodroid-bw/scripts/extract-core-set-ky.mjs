import https from 'node:https';

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
      def: (cols[iDef] || '').slice(0, 100),
    });
  }
  return rows;
}

const urls = {
  2020: 'https://data.medicaid.gov/sites/default/files/uploaded_resources/2020-child-and-adult-health-care-quality-measures.csv',
  2022: 'https://data.medicaid.gov/sites/default/files/uploaded_resources/2022-child-and-adult-health-care-quality-measures_0.csv',
  2023: 'https://data.medicaid.gov/sites/default/files/uploaded_resources/2023-child-and-adult-health-care-quality-measures.csv',
};

const picks = {
  'M-010': { abbr: 'WCV-CH', preferPop: /Ages 3 to 21|3-21|Ages 3–21/i },
  'M-011': { abbr: 'BCS-AD', preferPop: /Ages 50|50 to 74|50–74/i },
  'M-012': { abbr: 'PPC-AD', preferPop: /Postpartum|Live Birth/i },
};

const out = {};
for (const [year, url] of Object.entries(urls)) {
  const rows = parseCsv(await get(url));
  out[year] = {};
  for (const [measureId, spec] of Object.entries(picks)) {
    const cands = rows
      .filter((r) => r.abbr === spec.abbr)
      .map((r) => ({ ...r, n: Number(String(r.rate).replace('%', '').trim()) }))
      .filter((r) => Number.isFinite(r.n));
    const preferred = cands.find((r) => spec.preferPop.test(`${r.pop} ${r.def} ${r.name}`)) || cands[0];
    out[year][measureId] = preferred || null;
  }
}
console.log(JSON.stringify(out, null, 2));
