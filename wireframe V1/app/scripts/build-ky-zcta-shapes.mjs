// Generates src/data/alp/kyZctaShapes.js: SVG path data for Kentucky ZIP Code
// Tabulation Areas (ZCTAs), keyed by 5-digit ZCTA, clipped to Kentucky, in the
// SAME projection and viewBox as scripts/build-ky-county-shapes.mjs so the ZCTA
// paths overlay the county map exactly.
//
// Sources (download into the data cache first; nothing is fetched here):
//   <cache>/cb2020/cb_2020_us_zcta520_500k.zip  US Census Bureau 2020 cartographic
//       boundary file, ZCTAs, 1:500,000
//       https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip
//   <cache>/cb2020/cb_2020_us_state_500k.zip    2020 cartographic boundary, states
//       https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_state_500k.zip
//   <cache>/rel2020/tab20_zcta520_county20_natl.txt  2020 ZCTA-to-county relationship
//       https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
//
// mapshaper is NOT an app dependency. Install it once in the cache tools folder:
//   cd <cache>/_tools && npm install mapshaper@0.6.102
// Run (from wireframe V1/app):
//   node scripts/build-ky-zcta-shapes.mjs
// Cache root defaults to D:\non-dbx-dev\DecisionPro\data-cache\local; override
// with the DP_LOCAL_CACHE environment variable.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const CACHE = process.env.DP_LOCAL_CACHE || 'D:/non-dbx-dev/DecisionPro/data-cache/local';
const ZCTA_ZIP = join(CACHE, 'cb2020', 'cb_2020_us_zcta520_500k.zip');
const STATE_ZIP = join(CACHE, 'cb2020', 'cb_2020_us_state_500k.zip');
const REL_FILE = join(CACHE, 'rel2020', 'tab20_zcta520_county20_natl.txt');
const TOOLS_PKG = join(CACHE, '_tools', 'package.json');
const MAX_BYTES = 1.45 * 1024 * 1024; // keep the module at or under ~1.5 MB
const SIMPLIFY_STEPS = [50, 40, 30, 25, 20, 15, 12, 10, 8, 6, 5, 4, 3, 2.5, 2, 1.5, 1];

for (const p of [ZCTA_ZIP, STATE_ZIP, REL_FILE, TOOLS_PKG]) {
  if (!existsSync(p)) throw new Error(`Missing ${p} (see header for download/install steps)`);
}

// ---- Projection: copied verbatim from build-ky-county-shapes.mjs ---------------
const require = createRequire(import.meta.url);
const atlasPath = require.resolve('us-atlas/counties-10m.json');
const atlasVersion = JSON.parse(readFileSync(require.resolve('us-atlas/package.json'), 'utf8')).version;
const topology = JSON.parse(readFileSync(atlasPath, 'utf8'));

const KY_STATE_FIPS = '21';
const VIEW_WIDTH = 1000;
const PADDING = 8;

const counties = feature(topology, topology.objects.counties).features
  .filter((f) => String(f.id).padStart(5, '0').startsWith(KY_STATE_FIPS));
if (counties.length !== 120) {
  throw new Error(`Expected 120 Kentucky counties, found ${counties.length}`);
}

function ringsOf(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  throw new Error(`Unsupported geometry ${geometry.type}`);
}

let minLon = Infinity; let maxLon = -Infinity; let minLat = Infinity; let maxLat = -Infinity;
for (const county of counties) {
  for (const ring of ringsOf(county.geometry)) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
  }
}
const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
const scale = (VIEW_WIDTH - 2 * PADDING) / ((maxLon - minLon) * kx);
const viewHeight = Math.ceil((maxLat - minLat) * scale + 2 * PADDING);
const project = ([lon, lat]) => [
  +(PADDING + (lon - minLon) * kx * scale).toFixed(1),
  +(PADDING + (maxLat - lat) * scale).toFixed(1),
];
// -------------------------------------------------------------------------------

// Kentucky ZCTAs = every ZCTA with a land part in a Kentucky county (2020 relationship file).
const relLines = readFileSync(REL_FILE, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
const relHeader = relLines[0].split('|');
const iZ = relHeader.indexOf('GEOID_ZCTA5_20');
const iC = relHeader.indexOf('GEOID_COUNTY_20');
const iL = relHeader.indexOf('AREALAND_PART');
const kyZctas = new Set();
for (const line of relLines.slice(1)) {
  const f = line.split('|');
  if (f[iZ] && f[iC]?.startsWith(KY_STATE_FIPS) && Number(f[iL]) > 0) kyZctas.add(f[iZ]);
}

const mapshaper = createRequire(TOOLS_PKG)('mapshaper');
const zctaList = JSON.stringify([...kyZctas]);
const clipped = await mapshaper.applyCommands([
  `-i "${ZCTA_ZIP}" name=zcta`,
  `-filter target=zcta "${zctaList.replace(/"/g, "'")}.indexOf(ZCTA5CE20) > -1"`,
  `-i "${STATE_ZIP}" name=ky`,
  `-filter target=ky "STATEFP === '${KY_STATE_FIPS}'"`,
  '-clip target=zcta ky remove-slivers',
  '-filter-fields target=zcta ZCTA5CE20',
  '-o target=zcta clipped.json format=geojson',
].join(' '));
const clippedJson = clipped['clipped.json'].toString();

function toPath(geometry) {
  let sx = 0; let sy = 0; let n = 0;
  const parts = [];
  for (const ring of ringsOf(geometry)) {
    const pts = [];
    for (const pt of ring) {
      const [x, y] = project(pt);
      const last = pts[pts.length - 1];
      if (last && last[0] === x && last[1] === y) continue;
      pts.push([x, y]);
    }
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    if (pts.length < 3) continue;
    for (const [x, y] of pts) { sx += x; sy += y; n += 1; }
    parts.push(pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join('') + 'Z');
  }
  if (!n) return null;
  return { d: parts.join(''), cx: +(sx / n).toFixed(1), cy: +(sy / n).toFixed(1) };
}

function render(pct) {
  return mapshaper.applyCommands(
    `-i clipped.json -simplify ${pct}% keep-shapes -o out.json format=geojson precision=0.00001`,
    { 'clipped.json': clippedJson },
  ).then((res) => {
    const fc = JSON.parse(res['out.json'].toString());
    const zctas = {};
    for (const f of fc.features) {
      if (!f.geometry) continue;
      const shape = toPath(f.geometry);
      if (shape) zctas[f.properties.ZCTA5CE20] = shape;
    }
    const sorted = Object.fromEntries(Object.keys(zctas).sort().map((k) => [k, zctas[k]]));
    const out = `/**
 * Generated by scripts/build-ky-zcta-shapes.mjs — do not hand-edit.
 * Kentucky ZIP Code Tabulation Area (ZCTA) outlines from the US Census Bureau
 * 2020 cartographic boundary file cb_2020_us_zcta520_500k (1:500,000), clipped to
 * the Kentucky boundary from cb_2020_us_state_500k, simplified with mapshaper
 * (Visvalingam, ${pct}% of vertices retained), and projected with the same
 * projection and viewBox as kyCountyShapes.js (bounds from us-atlas@${atlasVersion}
 * counties-10m.json) so the paths overlay the county map.
 * ZCTAs that cross a state line carry only their Kentucky part.
 * Geometry only: no Medicaid or population figures live here.
 */
export const KY_ZCTA_SHAPES = ${JSON.stringify({
  source: `US Census Bureau cb_2020_us_zcta520_500k (2020 ZCTA cartographic boundaries, 1:500,000), clipped to Kentucky (cb_2020_us_state_500k), mapshaper simplify ${pct}%`,
  projection: `same as kyCountyShapes.js (us-atlas@${atlasVersion} counties-10m.json bounds)`,
  viewBox: `0 0 ${VIEW_WIDTH} ${viewHeight}`,
  zctas: sorted,
})};
`;
    return { out, count: Object.keys(sorted).length };
  });
}

let result = null;
for (const pct of SIMPLIFY_STEPS) {
  result = await render(pct);
  result.pct = pct;
  if (Buffer.byteLength(result.out) <= MAX_BYTES) break;
}

const target = fileURLToPath(new URL('../src/data/alp/kyZctaShapes.js', import.meta.url));
writeFileSync(target, result.out);
const missing = [...kyZctas].filter((z) => !result.out.includes(`"${z}":`));
console.log(`Wrote ${result.count} ZCTAs (of ${kyZctas.size} with Kentucky land), simplify ${result.pct}%, viewBox 0 0 ${VIEW_WIDTH} ${viewHeight}, ${(Buffer.byteLength(result.out) / 1024).toFixed(0)} KB`);
if (missing.length) console.log(`No Kentucky geometry after clip/simplify for: ${missing.join(', ')}`);
