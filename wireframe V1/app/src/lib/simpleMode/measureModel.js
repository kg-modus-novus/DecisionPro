// CodeXen: v1 not-applicable
// Presentation model for simple-mode measures: number formatting and the
// mapping from a sourced measure (see sourced/RESEARCH_BRIEF.md) to a smart
// tile visual. No business rules live here.

const UNIT_SUFFIX = {
  per_1000: ' per 1,000',
  days: ' days',
  hours: ' hours',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-09" → "September 2026"; "2026-08-17" → "August 17, 2026" anywhere in a label. */
export function prettyPeriod(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\b(\d{4})-(0[1-9]|1[0-2])-(\d{2})\b/g, (_, y, m, d) => `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`)
    .replace(/\b(\d{4})-(0[1-9]|1[0-2])\b(?!-\d)/g, (_, y, m) => `${MONTHS[Number(m) - 1]} ${y}`);
}

export function formatNumber(value, unit, { compact = false } = {}) {
  if (!Number.isFinite(value)) return '—';
  switch (unit) {
    case 'year':
      return String(Math.round(value));
    case 'days':
      return `${roundTo(value, 1).toLocaleString('en-US')} ${value === 1 ? 'day' : 'days'}`;
    case 'hours':
      return `${roundTo(value, 1).toLocaleString('en-US')} ${value === 1 ? 'hour' : 'hours'}`;
    case 'usd':
    case 'usd_pmpm':
      return formatDollars(value, { compact }) + (unit === 'usd_pmpm' ? ' PMPM' : '');
    case 'percent':
      return `${roundTo(value, Math.abs(value) < 10 ? 1 : 1)}%`;
    case 'count':
      return compact ? compactCount(value) : Math.round(value).toLocaleString('en-US');
    case 'ratio':
    case 'index':
      return roundTo(value, 2).toLocaleString('en-US');
    default:
      return `${roundTo(value, 1).toLocaleString('en-US')}${UNIT_SUFFIX[unit] || ''}`;
  }
}

export function formatDollars(value, { compact = false } = {}) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (compact || abs >= 1e7) {
    if (abs >= 1e9) return `${sign}$${trim(abs / 1e9, 2)} billion`;
    if (abs >= 1e6) return `${sign}$${trim(abs / 1e6, 1)} million`;
    if (abs >= 1e4) return `${sign}$${trim(abs / 1e3, 0)}K`;
  }
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: abs < 100 ? 2 : 0 });
}

function compactCount(value) {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${trim(value / 1e6, 2)} million`;
  if (abs >= 1e4) return `${trim(value / 1e3, 1)}K`;
  return Math.round(value).toLocaleString('en-US');
}

function trim(n, digits) {
  return Number(n.toFixed(digits)).toLocaleString('en-US', { maximumFractionDigits: digits });
}

function roundTo(n, digits) {
  return Number(n.toFixed(digits));
}

export function measureValue(measure) {
  if (Number.isFinite(measure?.value)) return measure.value;
  if (measure?.series?.length) return measure.series[measure.series.length - 1].value;
  return null;
}

export function formatMeasureValue(measure, opts) {
  const v = measureValue(measure);
  if (!Number.isFinite(v)) {
    // Breakdown-only measures (e.g. one figure per plan): show the range.
    const vals = (measure?.rows || []).map((r) => r.value).filter(Number.isFinite);
    if (vals.length >= 2) {
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      return lo === hi ? formatNumber(lo, measure.unit, opts) : `${formatNumber(lo, measure.unit, opts)}–${formatNumber(hi, measure.unit, opts)}`;
    }
    if (vals.length === 1) return formatNumber(vals[0], measure.unit, opts);
  }
  return formatNumber(v, measure?.unit, opts);
}

/** Direction of the latest change in a series, read against betterDirection. */
export function trendOf(measure) {
  const s = measure?.series;
  if (!s || s.length < 2) return null;
  const prev = s[s.length - 2].value;
  const last = s[s.length - 1].value;
  if (!Number.isFinite(prev) || !Number.isFinite(last) || prev === last) return { direction: 'flat', change: 0, from: prettyPeriod(s[s.length - 2].period) };
  const direction = last > prev ? 'up' : 'down';
  // A change across a method break is not read as improving or worsening.
  const crossesBreak = Boolean(measure.methodBreak) && yearOf(s[s.length - 2].period) < yearOf(measure.methodBreak);
  const improving = measure.betterDirection && !crossesBreak
    ? (measure.betterDirection === 'higher') === (direction === 'up')
    : null;
  return { direction, change: last - prev, from: prettyPeriod(s[s.length - 2].period), improving, crossesBreak };
}

function yearOf(period) {
  const m = String(period || '').match(/(\d{4})/);
  return m ? Number(m[1]) : NaN;
}

/** Comparison tone: green when Kentucky is on the better side, amber when not, neutral when there is no direction. */
function comparisonTone(value, reference, betterDirection) {
  if (!betterDirection || !Number.isFinite(value) || !Number.isFinite(reference) || value === reference) return 'positive';
  return (betterDirection === 'higher') === (value > reference) ? 'positive' : 'warning';
}

/**
 * Smart-tile visual props for a measure. Series → area trend; percent with a
 * comparison → bullet; a short breakdown → hero + comparison pills; percent →
 * radial; otherwise a metric with its comparison as a pill.
 */
export function visualFor(measure, { maxRows = 6 } = {}) {
  const value = formatMeasureValue(measure, { compact: true });
  const base = { value, unit: null };
  if (measure.series?.length >= 2) {
    return {
      ...base,
      visual: 'areaTrend',
      series: measure.series.map((p) => p.value),
      seriesLabels: measure.series.map((p) => shortPeriod(p.period)),
      unit: measure.unit === 'percent' ? 'percent' : (measure.unit === 'usd' || measure.unit === 'usd_pmpm') ? 'usd' : null,
      direction: trendOf(measure)?.direction,
    };
  }
  const v = measureValue(measure);
  if (measure.unit === 'percent' && measure.comparison && Number.isFinite(measure.comparison.value) && Number.isFinite(v)) {
    const target = measure.target && Number.isFinite(measure.target.value) ? measure.target : measure.comparison;
    return {
      ...base,
      visual: 'bullet',
      bullet: {
        current: v,
        target: target.value,
        min: 0,
        max: Math.max(100, v, target.value),
        minLabel: '0%',
        maxLabel: '100%',
        targetLabel: `${target.label} ${formatNumber(target.value, 'percent')}`,
        label: `Kentucky vs ${target.label.toLowerCase()}`,
      },
    };
  }
  const distinctRowValues = new Set((measure.rows || []).map((r) => r.value)).size;
  if (measure.rows?.length >= 2 && measure.rows.length <= 12 && distinctRowValues > 1 && measure.dimension !== 'county' && measure.dimension !== 'district') {
    const top = [...measure.rows].filter((r) => Number.isFinite(r.value)).sort((a, b) => b.value - a.value).slice(0, maxRows);
    return {
      ...base,
      visual: 'heroBreakdown',
      breakdown: top.map((r) => ({ label: r.label, value: r.value, display: formatNumber(r.value, r.unit || measure.unit, { compact: true }), tone: 'positive' })),
    };
  }
  if (measure.unit === 'percent' && Number.isFinite(v) && v >= 0 && v <= 100) {
    return { ...base, visual: 'radial', radial: { percent: v, caption: measure.comparison ? `${measure.comparison.label}: ${formatNumber(measure.comparison.value, measure.unit)}` : null } };
  }
  const pills = [];
  if (measure.comparison && Number.isFinite(measure.comparison.value)) {
    pills.push({ label: 'Kentucky', value: v, display: value, tone: comparisonTone(v, measure.comparison.value, measure.betterDirection) });
    pills.push({ label: measure.comparison.label, value: measure.comparison.value, display: formatNumber(measure.comparison.value, measure.unit, { compact: true }), tone: 'positive' });
  }
  if (!pills.length && (measure.dimension === 'county' || measure.dimension === 'district')) {
    // County measures: show the three highest places.
    const top = (measure.rows || []).filter((r) => Number.isFinite(r.value)).sort((a, b) => b.value - a.value).slice(0, 3);
    for (const r of top) {
      const place = String(r.label).replace(/\s*\(.*\)$/, '').split(':')[0];
      pills.push({ label: place, value: r.value, display: measure.unit === 'hours' ? `${Math.round(r.value * 60)} min` : formatNumber(r.value, r.unit || measure.unit, { compact: true }), tone: 'positive' });
    }
  }
  if (!pills.length) pills.push({ label: measure.method === 'estimate' ? 'Kentucky (estimate)' : 'Kentucky', value: 1, display: value, tone: 'positive', bar: false });
  return { ...base, visual: 'metric', compareRows: pills };
}

export function shortPeriod(period = '') {
  const p = String(period);
  const m = p.match(/(FFY|SFY|FY|CY)\s*(\d{4})/i);
  if (m) return `${m[1].toUpperCase()}${m[2].slice(2)}`;
  const ym = p.match(/^(\d{4})-(\d{2})/);
  if (ym) return `${ym[2]}/${ym[1].slice(2)}`;
  return p.length > 8 ? p.slice(0, 8) : p;
}

export function sourceLabel(source) {
  if (!source) return '';
  return [source.publisher, source.title].filter(Boolean).join(', ');
}
