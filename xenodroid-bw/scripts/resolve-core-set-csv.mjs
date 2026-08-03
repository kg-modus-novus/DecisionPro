/**
 * Resolve Child/Adult Core Set quality CSV download URIs.
 * On 404 / failure, probe alternate authoritative hosts before declaring "unpublished".
 *
 * Usage: node scripts/resolve-core-set-csv.mjs [year...]
 */
import https from 'node:https';
import http from 'node:http';

const DATASET_IDS = {
  2024: 'a5023394-ab10-465b-bb4a-7de5ac98d90c',
};

function candidatesFor(year) {
  const y = String(year);
  return [
    `https://download.medicaid.gov/data/${y}-child-and-adult-health-care-quality-measures.csv`,
    `https://data.medicaid.gov/sites/default/files/uploaded_resources/${y}-child-and-adult-health-care-quality-measures.csv`,
    `https://data.medicaid.gov/sites/default/files/uploaded_resources/${y}-child-and-adult-health-care-quality-measures_0.csv`,
  ];
}

function headOrGet(url, method = 'HEAD') {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        headOrGet(res.headers.location, method).then(resolve);
        return;
      }
      res.resume();
      resolve({ url, status: res.statusCode || 0, method });
    });
    req.on('error', (e) => resolve({ url, status: 0, method, error: e.message }));
    req.end();
  });
}

async function metastoreDownloadUrl(year) {
  const id = DATASET_IDS[year];
  if (!id) return null;
  const metaUrl = `https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/${id}?show-reference-ids=true`;
  try {
    const text = await new Promise((res, rej) => {
      https
        .get(metaUrl, (r) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
        })
        .on('error', rej);
    });
    const j = JSON.parse(text);
    const dist = j?.distribution?.[0]?.data?.downloadURL;
    return dist || null;
  } catch {
    return null;
  }
}

export async function ResolveCoreSetCsvUri(year) {
  const attempts = [];
  const meta = await metastoreDownloadUrl(year);
  const list = meta ? [meta, ...candidatesFor(year).filter((u) => u !== meta)] : candidatesFor(year);

  for (const url of list) {
    let hit = await headOrGet(url, 'HEAD');
    if (hit.status === 405 || hit.status === 403 || hit.status === 0) {
      hit = await headOrGet(url, 'GET');
    }
    attempts.push(hit);
    if (hit.status >= 200 && hit.status < 300) {
      return { ok: true, year, resolvedUrl: url, attempts };
    }
  }
  return { ok: false, year, resolvedUrl: null, attempts };
}

const years = process.argv.slice(2).map(Number).filter(Boolean);
const runYears = years.length ? years : [2020, 2021, 2022, 2023, 2024];

for (const y of runYears) {
  const r = await ResolveCoreSetCsvUri(y);
  console.log(JSON.stringify(r, null, 2));
}
