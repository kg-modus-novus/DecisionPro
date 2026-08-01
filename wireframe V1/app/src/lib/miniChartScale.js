/**
 * Domain + Y mapping for mini sparklines that may include negative metrics (e.g. gap pts).
 */

export function signedValueDomain(values) {
  const vals = (values || []).map((v) => Number(v) || 0);
  if (!vals.length) return { min: 0, max: 1 };
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  // Keep zero in-range so mixed-sign series sit above/below a real baseline.
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  if (min === max) max = min + 1;
  return { min, max };
}

export function valueToPlotY(value, min, max, plotTop, plotBottom) {
  const span = max - min || 1;
  const t = ((Number(value) || 0) - min) / span;
  return plotBottom - t * (plotBottom - plotTop);
}
