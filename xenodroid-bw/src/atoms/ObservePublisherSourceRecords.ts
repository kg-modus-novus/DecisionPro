/**
 * Observe publisher SoT scale (batches + record totals) — not PSA land size.
 */

export type SourceScaleBatch = {
  kind: string;
  count: number;
  label?: string;
};

export type PublisherSourceScale = {
  label: string;
  batches: SourceScaleBatch[];
  recordCount: number | null;
  recordUnit: string;
  note: string;
  scope: 'publisher_fetch' | 'research';
};

/** @deprecated Prefer PublisherSourceScale — kept for call sites that only need a count. */
export type PublisherSourceObservation = {
  recordCount: number;
  unit: string;
  scope: 'publisher_fetch' | 'research';
  note: string;
  scale: PublisherSourceScale;
};

export type PublisherSourceMeta = {
  sourceRecordCount?: number | null;
  sourceRecordUnit?: string;
  sourceRecordNote?: string;
  sourceCountUri?: string;
  sourceCountUris?: string[];
  /** JSON API that returns a top-level numeric count (e.g. data.medicaid.gov datastore query). */
  sourceCountApiUrl?: string;
  sourceCountApiField?: string;
  /** Optional research-declared batches when live fetch cannot invent them. */
  sourceScaleBatches?: SourceScaleBatch[];
  /** Extra phrase appended to label (e.g. "~120 counties each"). */
  sourceScaleRecordHint?: string;
  /** Column name for distinct period counting in a single publisher CSV. */
  sourcePeriodColumn?: string;
  sourcePeriodBatchKind?: string;
  sourcePeriodBatchLabel?: string;
};

function countCsvDataRows(text: string): number {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function countDistinctCsvColumn(text: string, columnName: string): number | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return 0;
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = headers.findIndex((h) => h.toLowerCase() === columnName.toLowerCase());
  if (idx < 0) return null;
  const values = new Set<string>();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const v = (cols[idx] || '').trim();
    if (v) values.add(v);
  }
  return values.size;
}

async function fetchCsvText(uri: string, timeoutMs = 20000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(uri, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pluralize(count: number, singular: string, plural?: string): string {
  const p = plural || `${singular}s`;
  return `${count.toLocaleString()} ${count === 1 ? singular : p}`;
}

function batchPhrase(batch: SourceScaleBatch): string {
  const kind = batch.kind.toLowerCase();
  if (kind === 'csv') return pluralize(batch.count, 'CSV');
  if (kind === 'pdf') {
    if (batch.label) return `${batch.count.toLocaleString()} ${batch.label}`;
    return pluralize(batch.count, 'PDF');
  }
  if (kind === 'page') return pluralize(batch.count, 'page');
  if (kind === 'vintage') return pluralize(batch.count, 'vintage');
  if (kind === 'period') return pluralize(batch.count, 'period');
  if (kind === 'year' || kind === 'years') return pluralize(batch.count, 'year');
  if (kind === 'directory' || kind === 'directories') {
    if (batch.label) return `${batch.count.toLocaleString()} ${batch.label}`;
    return pluralize(batch.count, 'directory', 'directories');
  }
  if (kind === 'state' || kind === 'states' || kind === 'geography' || kind === 'geographies') {
    if (batch.label) return `${batch.count.toLocaleString()} ${batch.label}`;
    return pluralize(batch.count, 'state');
  }
  if (kind === 'bill' || kind === 'bills') {
    if (batch.label) return `${batch.count.toLocaleString()} ${batch.label}`;
    return pluralize(batch.count, 'bill');
  }
  if (kind === 'document' || kind === 'documents') return pluralize(batch.count, 'document');
  if (kind === 'plan' || kind === 'plans') return pluralize(batch.count, 'plan');
  if (kind === 'dataset') {
    if (batch.label) return `${batch.count.toLocaleString()} ${batch.label}`;
    return pluralize(batch.count, 'dataset');
  }
  if (batch.label) return `${batch.count.toLocaleString()} ${batch.label}`;
  return `${batch.count.toLocaleString()} ${batch.kind}`;
}

export function SourceScaleIsInventoried(scale: PublisherSourceScale | null | undefined): boolean {
  if (!scale) return false;
  if (scale.recordCount != null && Number.isFinite(scale.recordCount)) return true;
  return (scale.batches || []).some((b) => Number(b.count) > 0);
}

export function FormatSourceScaleLabel(args: {
  batches: SourceScaleBatch[];
  recordCount?: number | null;
  recordUnit?: string;
  recordHint?: string;
}): string {
  const parts = args.batches.filter((b) => b.count > 0).map(batchPhrase);
  if (args.recordCount != null && Number.isFinite(args.recordCount)) {
    const unit = args.recordUnit || 'records';
    parts.push(`${args.recordCount.toLocaleString()} ${unit}`);
  }
  if (!parts.length) return args.recordHint || '—';
  if (args.recordCount == null && args.recordHint) {
    const hint = args.recordHint.replace(/^\(|\)$/g, '');
    return `${parts.join(' · ')} (${hint})`;
  }
  return parts.join(' · ');
}

function buildScale(args: {
  batches: SourceScaleBatch[];
  recordCount: number | null;
  recordUnit: string;
  note: string;
  scope: 'publisher_fetch' | 'research';
  recordHint?: string;
}): PublisherSourceScale {
  return {
    label: FormatSourceScaleLabel({
      batches: args.batches,
      recordCount: args.recordCount,
      recordUnit: args.recordUnit,
      recordHint: args.recordHint,
    }),
    batches: args.batches,
    recordCount: args.recordCount,
    recordUnit: args.recordUnit,
    note: args.note,
    scope: args.scope,
  };
}

/**
 * Resolve publisher-side source scale from research inventory and optional live CSV fetches.
 */
export async function ObservePublisherSourceScale(
  meta: PublisherSourceMeta,
): Promise<PublisherSourceScale | null> {
  const unit = meta.sourceRecordUnit || 'records';
  const uris = [
    ...(meta.sourceCountUri ? [meta.sourceCountUri] : []),
    ...(meta.sourceCountUris || []),
  ].filter(Boolean);
  const researchBatches = meta.sourceScaleBatches || [];

  if (uris.length) {
    let total = 0;
    let ok = 0;
    let periodCount: number | null = null;
    let yearColCount: number | null = null;
    for (const uri of uris) {
      const text = await fetchCsvText(uri);
      if (text == null) continue;
      total += countCsvDataRows(text);
      ok += 1;
      if (uris.length === 1 && meta.sourcePeriodColumn) {
        periodCount = countDistinctCsvColumn(text, meta.sourcePeriodColumn);
      }
      if (uris.length === 1) {
        const header = text.split(/\r?\n/).find((l) => l.trim()) || '';
        const years = [...header.matchAll(/Tot_Spndng_(\d{4})/g)].map((m) => m[1]);
        if (years.length) yearColCount = years.length;
      }
    }
    if (ok > 0) {
      const batches: SourceScaleBatch[] = [
        {
          kind: 'csv',
          count: ok,
          label: ok === 1 ? 'publisher CSV' : 'publisher CSVs',
        },
      ];
      if (periodCount != null && periodCount > 0) {
        batches.push({
          kind: meta.sourcePeriodBatchKind || 'period',
          count: periodCount,
          label: meta.sourcePeriodBatchLabel || 'Reporting Period values',
        });
      }
      if (yearColCount != null && yearColCount > 0) {
        batches.push({ kind: 'year', count: yearColCount, label: 'year columns in CSV' });
      }
      if (uris.length > 1) {
        batches.push({
          kind: 'vintage',
          count: ok,
          label: `${ok} fetched vintages`,
        });
      }
      // Preserve non-conflicting research batches (e.g. dataset/page context).
      for (const b of researchBatches) {
        if (['csv', 'vintage', 'period', 'year'].includes(b.kind.toLowerCase())) continue;
        batches.push(b);
      }
      return buildScale({
        batches,
        recordCount: total,
        recordUnit: unit,
        scope: 'publisher_fetch',
        note:
          meta.sourceRecordNote ||
          (uris.length > 1
            ? `Sum of ${ok}/${uris.length} publisher CSV extracts fetched at export time.`
            : 'Counted from publisher CSV fetched at export time.'),
      });
    }
  }

  if (meta.sourceCountApiUrl) {
    try {
      const res = await fetch(meta.sourceCountApiUrl, { redirect: 'follow' });
      if (res.ok) {
        const json = (await res.json()) as Record<string, unknown>;
        const field = meta.sourceCountApiField || 'count';
        const n = Number(json[field]);
        if (Number.isFinite(n)) {
          return buildScale({
            batches: researchBatches.length
              ? researchBatches
              : [{ kind: 'dataset', count: 1, label: 'open-data table' }],
            recordCount: n,
            recordUnit: unit,
            scope: 'publisher_fetch',
            note: meta.sourceRecordNote || `Counted from publisher API field "${field}".`,
            recordHint: meta.sourceScaleRecordHint,
          });
        }
      }
    } catch {
      // fall through to research inventory
    }
  }

  const hasResearchCount =
    typeof meta.sourceRecordCount === 'number' && Number.isFinite(meta.sourceRecordCount);
  if (hasResearchCount || researchBatches.length) {
    return buildScale({
      batches: researchBatches,
      recordCount: hasResearchCount ? (meta.sourceRecordCount as number) : null,
      recordUnit: unit,
      scope: 'research',
      note: meta.sourceRecordNote || 'From SoT research inventory (publisher-side scale).',
      recordHint: meta.sourceScaleRecordHint,
    });
  }

  return null;
}

/**
 * Backward-compatible count observer.
 */
export async function ObservePublisherSourceRecords(
  meta: PublisherSourceMeta,
): Promise<PublisherSourceObservation | null> {
  const scale = await ObservePublisherSourceScale(meta);
  if (!scale || scale.recordCount == null) {
    if (!scale) return null;
    // Scale without a numeric record total (e.g. PDF batches only) — still expose via scale.
    return {
      recordCount: scale.batches.reduce((n, b) => n + b.count, 0),
      unit: scale.recordUnit,
      scope: scale.scope,
      note: scale.note,
      scale,
    };
  }
  return {
    recordCount: scale.recordCount,
    unit: scale.recordUnit,
    scope: scale.scope,
    note: scale.note,
    scale,
  };
}
