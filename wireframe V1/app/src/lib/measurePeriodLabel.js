/**
 * Period / as-of labels for Accurate tiles and trust copy.
 * Prefer Core Set periodLabel (FFY reporting · MY) over a bare date.
 */

export function formatMeasurePeriodLabel(measure) {
  if (!measure) return '';
  const p = measure.provenance && typeof measure.provenance === 'object' ? measure.provenance : {};
  if (p.periodLabel) return String(p.periodLabel);
  if (measure.periodLabel) return String(measure.periodLabel);
  if (p.coreSetYear != null && p.measurementYear != null) {
    return `FFY ${p.coreSetYear} reporting · MY ${p.measurementYear}`;
  }
  if (measure.asOfDate) return `As of ${measure.asOfDate}`;
  return '';
}

export function formatMeasureComparison(measure) {
  const period = formatMeasurePeriodLabel(measure);
  const sys = measure?.fromSysId || '';
  if (period && sys) return `${period} · ${sys}`;
  return period || sys || '';
}
