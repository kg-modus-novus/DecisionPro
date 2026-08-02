/**
 * Compact Source-scale tile labels + full-name expansions for the * control.
 * Longer phrases first so replacements do not leave redundant tails.
 */
const PHRASE_ABBREVS = [
  [/Financial Management open-data table/gi, 'Fi-Mgt'],
  [/Financial Management/gi, 'Fi-Mgt'],
  [/quality\/eval PDFs \(13 on page \+ FY2025 summary\)/gi, 'Q/E PDFs'],
  [/quality\/eval PDFs/gi, 'Q/E PDFs'],
  [/monthly county PDFs/gi, 'county PDFs'],
  [/state directories \(Waiver \+ Medicaid\)/gi, 'state dirs (Wvr+Mcd)'],
  [/MCO find-a-provider directories/gi, 'MCO FAP dirs'],
  [/Medicaid\/maternal bill touchpoints/gi, 'Mcd/mat. bills'],
  [/DMS Quality Branch page/gi, 'DMS QB page'],
  [/DMS Fee Schedules page/gi, 'DMS Fee page'],
  [/fee\/rate PDFs linked on page/gi, 'fee/rate PDFs'],
  [/DMS Provider Directory portal page/gi, 'DMS ProvDir page'],
  [/DMS MCO contracts page/gi, 'DMS MCO page'],
  [/Legislative Record session surface/gi, 'LRC session'],
  [/KFF total-population indicator/gi, 'KFF tot-pop'],
  [/years 2008–2019 and 2021–2024/gi, 'yrs 2008–24'],
  [/years 2008-2019 and 2021-2024/gi, 'yrs 2008–24'],
  [/Reporting Period values in publisher CSV/gi, 'Reporting Periods'],
  [/Medicaid Spending by Drug CSV/gi, 'Rx spend CSV'],
  [/year currently published in API \(2016\)/gi, 'yr 2016'],
  [/year columns in CSV/gi, 'year cols'],
  [/year columns 2020–2024/gi, 'yrs 2020–24'],
  [/4 fetched vintages/gi, 'vintages'],
  [/publisher CSVs/gi, 'CSVs'],
  [/publisher CSV/gi, 'CSV'],
];

const MAX_SHORT_CHARS = 26;

function compactForCompare(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

/** Drop probe/status noise that belongs in research notes, not legislator tiles. */
export function sanitizeSourceScaleLabel(label) {
  return String(label || '')
    .replace(/\s*\(\s*HTTP\s*200(?:\s+on\s+[^)]+)?\s*\)/gi, '')
    .replace(/\s+HTTP\s*200\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

/**
 * Abbreviate a single Source-scale display line for the compact tile.
 * @returns {{ short: string, full: string, abbreviated: boolean }}
 */
export function abbreviateSourceScaleLine(fullLine) {
  const full = sanitizeSourceScaleLabel(fullLine);
  if (!full) return { short: '', full: '', abbreviated: false };

  let short = full;
  for (const [pattern, replacement] of PHRASE_ABBREVS) {
    short = short.replace(pattern, replacement);
  }
  short = short.replace(/\s+/g, ' ').trim();

  // Space-only differences (e.g. "states + DC" vs "states+DC") are not real abbreviations.
  if (compactForCompare(short) === compactForCompare(full)) {
    return { short: full, full, abbreviated: false };
  }

  if (short.length > MAX_SHORT_CHARS) {
    short = `${short.slice(0, MAX_SHORT_CHARS - 1).trimEnd()}…`;
  }

  return {
    short,
    full,
    abbreviated: short !== full,
  };
}

/**
 * Map structured scale batches (+ optional record total) to short/full line pairs.
 */
export function buildSourceScaleDisplayLines(scale, fallbackUnit) {
  if (!scale || scale.label === '—') {
    if (scale?.recordCount != null) {
      const full = `${Number(scale.recordCount).toLocaleString()} ${
        scale.recordUnit || fallbackUnit || 'records'
      }`;
      return [abbreviateSourceScaleLine(full)];
    }
    return [];
  }

  const fullLines = (scale.batches || [])
    .filter((b) => Number(b.count) > 0)
    .map((batch) => batchLineLabel(batch));

  if (scale.recordCount != null && Number.isFinite(scale.recordCount)) {
    fullLines.push(
      `${Number(scale.recordCount).toLocaleString()} ${
        scale.recordUnit || fallbackUnit || 'records'
      }`,
    );
  }

  if (scale.recordCount == null && scale.label && scale.label.includes('(')) {
    const hint = scale.label.match(/\(([^)]+)\)/);
    if (hint?.[1] && !fullLines.some((l) => l.includes(hint[1]))) {
      fullLines.push(hint[1]);
    }
  }

  if (!fullLines.length && scale.label && scale.label !== '—') {
    return scale.label
      .split(/\s*·\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(abbreviateSourceScaleLine);
  }

  return fullLines.map(abbreviateSourceScaleLine);
}

export function batchLineLabel(batch) {
  const kind = String(batch.kind || '').toLowerCase();
  const n = Number(batch.count) || 0;
  const count = n.toLocaleString();
  if (kind === 'csv') return `${count} ${n === 1 ? 'CSV' : 'CSVs'}`;
  if (kind === 'pdf') {
    if (batch.label) return `${count} ${batch.label}`;
    return `${count} ${n === 1 ? 'PDF' : 'PDFs'}`;
  }
  if (kind === 'page') return `${count} ${n === 1 ? 'page' : 'pages'}`;
  if (kind === 'vintage') return `${count} ${n === 1 ? 'vintage' : 'vintages'}`;
  if (kind === 'period') return `${count} ${n === 1 ? 'period' : 'periods'}`;
  if (kind === 'year' || kind === 'years') return `${count} ${n === 1 ? 'year' : 'years'}`;
  if (kind === 'directory' || kind === 'directories') {
    if (batch.label) return `${count} ${batch.label}`;
    return `${count} ${n === 1 ? 'directory' : 'directories'}`;
  }
  if (kind === 'state' || kind === 'states' || kind === 'geography' || kind === 'geographies') {
    if (batch.label) return `${count} ${batch.label}`;
    return `${count} ${n === 1 ? 'state' : 'states'}`;
  }
  if (kind === 'bill' || kind === 'bills') {
    if (batch.label) return `${count} ${batch.label}`;
    return `${count} ${n === 1 ? 'bill' : 'bills'}`;
  }
  if (kind === 'dataset') {
    if (batch.label) return `${count} ${batch.label}`;
    return `${count} ${n === 1 ? 'dataset' : 'datasets'}`;
  }
  if (kind === 'document' || kind === 'documents') {
    return `${count} ${n === 1 ? 'document' : 'documents'}`;
  }
  if (kind === 'plan' || kind === 'plans') return `${count} ${n === 1 ? 'plan' : 'plans'}`;
  if (batch.label) return `${count} ${batch.label}`;
  return `${count} ${batch.kind || 'items'}`;
}
