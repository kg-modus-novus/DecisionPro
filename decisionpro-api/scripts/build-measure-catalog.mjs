// CodeXen: v1 not-applicable
// Build-time serialization: copies the published simple-mode measure list into the API bundle.
//
// Reads  wireframe V1/app/src/lib/simpleMode/sourcedDisplay.generated.js
// Writes decisionpro-api/src/data/measureCatalog.json  ([{ id, unit, betterDirection, label }])
//
// Run from anywhere: node decisionpro-api/scripts/build-measure-catalog.mjs
// Missing fields are normalized here, at the boundary: an absent betterDirection becomes ''.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(apiRoot, '..', 'wireframe V1', 'app', 'src', 'lib', 'simpleMode', 'sourcedDisplay.generated.js');
const outputPath = resolve(apiRoot, 'src', 'data', 'measureCatalog.json');

const KNOWN_DIRECTIONS = new Set(['higher', 'lower']);

const { SOURCED_DISPLAY: sourced } = await import(pathToFileURL(sourcePath).href);

const entries = [];
const seen = new Set();
for (const area of Object.keys(sourced).sort()) {
  const measures = Array.isArray(sourced[area]?.measures) ? sourced[area].measures : [];
  for (const measure of measures) {
    if (typeof measure?.id !== 'string' || measure.id === '') throw new Error(`measure without id in area ${area}`);
    if (seen.has(measure.id)) throw new Error(`duplicate measure id ${measure.id}`);
    if (typeof measure.unit !== 'string' || measure.unit === '') throw new Error(`measure ${measure.id} has no unit`);
    seen.add(measure.id);
    entries.push({
      id: measure.id,
      unit: measure.unit,
      betterDirection: KNOWN_DIRECTIONS.has(measure.betterDirection) ? measure.betterDirection : '',
      label: typeof measure.label === 'string' ? measure.label : '',
    });
  }
}
entries.sort((a, b) => a.id.localeCompare(b.id));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
console.log(`measureCatalog.json: ${entries.length} measures from ${Object.keys(sourced).length} areas`);
