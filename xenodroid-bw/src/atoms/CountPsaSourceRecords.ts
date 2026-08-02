import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export type PsaRecordCount = {
  recordCount: number;
  scope: 'full_psa_file';
  objectKey: string;
};

function countCsvDataRows(text: string): number {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

function countJsonRecords(parsed: unknown): number | null {
  if (Array.isArray(parsed)) return parsed.length;
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  // Domain-shaped curated extracts
  for (const key of ['mcos', 'landingMeasures', 'rows', 'records', 'items', 'counties']) {
    if (Array.isArray(obj[key])) return (obj[key] as unknown[]).length;
  }
  return null;
}

/**
 * Count records contained in a landed PSA object (full file grain).
 * CSV → data rows (excluding header). JSON → primary array length when recognizable.
 */
export async function CountRecordsInPsaObject(objectKey: string): Promise<PsaRecordCount | null> {
  const full = path.isAbsolute(objectKey) ? objectKey : path.join(config.psaRoot, objectKey);
  try {
    const buf = await fs.readFile(full);
    const lower = objectKey.toLowerCase();
    if (lower.endsWith('.csv') || (!lower.endsWith('.json') && !lower.endsWith('.pdf'))) {
      const text = buf.toString('utf8');
      // Prefer CSV when content looks tabular
      if (lower.endsWith('.csv') || (text.includes('\n') && text.includes(','))) {
        return { recordCount: countCsvDataRows(text), scope: 'full_psa_file', objectKey };
      }
    }
    if (lower.endsWith('.json')) {
      const parsed = JSON.parse(buf.toString('utf8')) as unknown;
      const n = countJsonRecords(parsed);
      if (n != null) return { recordCount: n, scope: 'full_psa_file', objectKey };
    }
  } catch {
    return null;
  }
  return null;
}

/** True when the PSA object key is owned by this FromSysID (not a shared multi-source pack). */
export function PsaObjectBelongsToFromSysId(objectKey: string, fromSysId: string): boolean {
  const norm = objectKey.replace(/\\/g, '/');
  return (
    norm.includes(`/psa/${fromSysId}/`) ||
    norm.includes(`psa/${fromSysId}/`) ||
    norm.startsWith(`${fromSysId}/`)
  );
}

export function IsPublicHydrationPsaObject(objectKey: string): boolean {
  const norm = objectKey.replace(/\\/g, '/');
  return norm.includes('/PUBLIC_HYDRATION/') || norm.includes('psa/PUBLIC_HYDRATION/');
}

/**
 * Count PSA-landed curated records in a PUBLIC_HYDRATION pack, grouped by FromSysID.
 * Shared pack lands many sources under one object key.
 */
export async function CountPublicHydrationPsaByFromSysId(
  objectKey: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const full = path.isAbsolute(objectKey) ? objectKey : path.join(config.psaRoot, objectKey);
  try {
    const parsed = JSON.parse(await fs.readFile(full, 'utf8')) as {
      landingMeasures?: Array<{ fromSysId?: string }>;
    };
    for (const m of parsed.landingMeasures || []) {
      const id = m.fromSysId;
      if (!id) continue;
      out.set(id, (out.get(id) || 0) + 1);
    }
  } catch {
    return out;
  }
  return out;
}
