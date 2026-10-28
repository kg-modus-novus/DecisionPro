// CodeXen: v1 not-applicable
// Large simple-mode areas (cross-state tables, zip-code data) are generated as
// separate modules (scripts/build-simple-sourced.mjs, LAZY_AREAS) and loaded
// only by the page that shows them, so the opening page stays light.
import { useEffect, useState } from 'react';
import { normalizeMeasure } from './sourcedData.js';

const LOADERS = {
  coresetStates: () => import('./lazy/coresetStates.generated.js'),
  contracts: () => import('./lazy/contracts.generated.js'),
  local: () => import('./lazy/local.generated.js'),
  hospitals: () => import('./lazy/hospitals.generated.js'),
  rural: () => import('./lazy/rural.generated.js'),
  fees: () => import('./lazy/fees.generated.js'),
};

const cache = new Map();

export function loadArea(area) {
  if (!LOADERS[area]) return Promise.reject(new Error(`Unknown lazy area: ${area}`));
  if (!cache.has(area)) {
    cache.set(area, LOADERS[area]().then(({ AREA }) => {
      const measures = new Map();
      for (const m of AREA.measures || []) measures.set(m.id, normalizeMeasure(m, area));
      return measures;
    }));
  }
  return cache.get(area);
}

/** The measures of a lazy area once loaded (a Map by id), or null while loading. */
export function useLazyArea(area) {
  const [measures, setMeasures] = useState(null);
  useEffect(() => {
    let live = true;
    loadArea(area).then((m) => { if (live) setMeasures(m); });
    return () => { live = false; };
  }, [area]);
  return measures;
}
