/**
 * Format Resultant cube lines: this source's rows + full cube fact-table size.
 */

/** Aggregate full fact-table sizes from all Data Spectrum rows (fallback when export omits factRowCount). */
export function buildCubeFactRowTotals(spectrumRows) {
  const totals = new Map();
  for (const row of spectrumRows || []) {
    for (const c of row?.loadedDepth?.resultantCubes || []) {
      const id = c.cubeId || c.label;
      if (!id) continue;
      totals.set(id, (totals.get(id) || 0) + (Number(c.rowCount) || 0));
    }
  }
  return totals;
}

export function formatResultantCubeLine(cube, factTotals) {
  const label = cube.label || cube.cubeId || 'cube';
  const src = Number(cube.rowCount || 0);
  const fact =
    cube.factRowCount != null && Number.isFinite(Number(cube.factRowCount))
      ? Number(cube.factRowCount)
      : factTotals?.get(cube.cubeId || cube.label) ?? src;
  return {
    key: cube.cubeId || label,
    label,
    sourceRowCount: src,
    factRowCount: fact,
    text: `${label}: ${src.toLocaleString()} · fact ${Number(fact).toLocaleString()}`,
  };
}
