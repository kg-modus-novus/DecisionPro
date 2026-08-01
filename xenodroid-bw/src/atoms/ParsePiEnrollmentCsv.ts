/** Parse CMS PI enrollment CSV; extract Kentucky periods with enrollment. */
export type KyEnrollmentRow = {
  state_code: string;
  period_ym: string;
  medicaid_enrollment: number | null;
  chip_enrollment: number | null;
  total_enrollment: number | null;
  as_of_date: string;
  preliminary_or_updated: string;
  final_report: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
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

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function periodToAsOf(periodYm: string): string {
  const y = periodYm.slice(0, 4);
  const m = periodYm.slice(4, 6);
  const last = new Date(Number(y), Number(m), 0).getDate();
  return `${y}-${m}-${String(last).padStart(2, '0')}`;
}

function rowQuality(row: KyEnrollmentRow): number {
  let q = 0;
  if (row.preliminary_or_updated.toUpperCase() === 'U') q += 10;
  if (row.final_report.toUpperCase() === 'Y') q += 5;
  if (row.total_enrollment != null) q += 1;
  return q;
}

export function ParseKentuckyEnrollmentFromPiCsv(csvText: string): KyEnrollmentRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);
  const iAbbrev = idx('State Abbreviation');
  const iPeriod = idx('Reporting Period');
  const iTotal = idx('Total Medicaid and CHIP Enrollment');
  const iMed = idx('Total Medicaid Enrollment');
  const iChip = idx('Total CHIP Enrollment');
  const iPU = idx('Preliminary or Updated');
  const iFinal = idx('Final Report');
  if (iAbbrev < 0 || iPeriod < 0 || iTotal < 0) {
    throw new Error('PI CSV missing required columns');
  }

  const bestByPeriod = new Map<string, KyEnrollmentRow>();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    if ((cols[iAbbrev] || '').trim() !== 'KY') continue;
    const period_ym = String(cols[iPeriod] || '').trim();
    if (!/^\d{6}$/.test(period_ym)) continue;
    const total_enrollment = numOrNull(cols[iTotal] || '');
    const medicaid_enrollment = iMed >= 0 ? numOrNull(cols[iMed] || '') : null;
    const chip_enrollment = iChip >= 0 ? numOrNull(cols[iChip] || '') : null;
    if (total_enrollment == null && medicaid_enrollment == null) continue;
    const row: KyEnrollmentRow = {
      state_code: 'KY',
      period_ym,
      medicaid_enrollment,
      chip_enrollment,
      total_enrollment,
      as_of_date: periodToAsOf(period_ym),
      preliminary_or_updated: iPU >= 0 ? String(cols[iPU] || '').trim() : '',
      final_report: iFinal >= 0 ? String(cols[iFinal] || '').trim() : '',
    };
    const prev = bestByPeriod.get(period_ym);
    if (!prev || rowQuality(row) >= rowQuality(prev)) {
      bestByPeriod.set(period_ym, row);
    }
  }
  return [...bestByPeriod.values()].sort((a, b) => a.period_ym.localeCompare(b.period_ym));
}

export function SelectLatestEnrollment(rows: KyEnrollmentRow[]): KyEnrollmentRow | null {
  if (!rows.length) return null;
  return rows[rows.length - 1];
}

/** Latest N distinct PI periods (oldest→newest within the window). */
export function SelectLatestEnrollmentPeriods(rows: KyEnrollmentRow[], count = 3): KyEnrollmentRow[] {
  if (!rows.length || count < 1) return [];
  return rows.slice(Math.max(0, rows.length - count));
}

/** All KY periods that have a total enrollment (oldest→newest). */
export function SelectAllEnrollmentPeriods(rows: KyEnrollmentRow[]): KyEnrollmentRow[] {
  return rows.filter((r) => r.total_enrollment != null);
}

export function ComputeYoYChangePercent(rows: KyEnrollmentRow[], latest: KyEnrollmentRow): number | null {
  const priorYm = String(Number(latest.period_ym) - 100);
  const prior = rows.find((r) => r.period_ym === priorYm);
  if (!prior || prior.total_enrollment == null || latest.total_enrollment == null || prior.total_enrollment === 0) {
    return null;
  }
  return Number(
    (((latest.total_enrollment - prior.total_enrollment) / prior.total_enrollment) * 100).toFixed(2),
  );
}

/** Period id for UI filters, e.g. pi202603. */
export function PiPeriodId(periodYm: string): string {
  return `pi${periodYm}`;
}
