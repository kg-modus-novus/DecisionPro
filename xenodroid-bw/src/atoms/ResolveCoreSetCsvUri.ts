import https from 'node:https';
import http from 'node:http';
import type { UriAttempt } from '../admin/uriResolutionAlerts.js';

const DATASET_IDS: Record<number, string> = {
  2024: 'a5023394-ab10-465b-bb4a-7de5ac98d90c',
};

function candidatesFor(year: number): string[] {
  const y = String(year);
  return [
    `https://download.medicaid.gov/data/${y}-child-and-adult-health-care-quality-measures.csv`,
    `https://data.medicaid.gov/sites/default/files/uploaded_resources/${y}-child-and-adult-health-care-quality-measures.csv`,
    `https://data.medicaid.gov/sites/default/files/uploaded_resources/${y}-child-and-adult-health-care-quality-measures_0.csv`,
  ];
}

function headOrGet(url: string, method: 'HEAD' | 'GET' = 'HEAD'): Promise<UriAttempt> {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        headOrGet(res.headers.location, method).then(resolve);
        return;
      }
      res.resume();
      resolve({ url, status: res.statusCode || 0, method });
    });
    req.on('error', (e) => resolve({ url, status: 0, method, error: e.message }));
    req.end();
  });
}

async function metastoreDownloadUrl(year: number): Promise<string | null> {
  const id = DATASET_IDS[year];
  if (!id) return null;
  const metaUrl = `https://data.medicaid.gov/api/1/metastore/schemas/dataset/items/${id}?show-reference-ids=true`;
  try {
    const text = await new Promise<string>((res, rej) => {
      https
        .get(metaUrl, (r) => {
          const chunks: Buffer[] = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
        })
        .on('error', rej);
    });
    const j = JSON.parse(text) as {
      distribution?: Array<{ data?: { downloadURL?: string } }>;
    };
    return j?.distribution?.[0]?.data?.downloadURL || null;
  } catch {
    return null;
  }
}

export type CoreSetResolveResult = {
  ok: boolean;
  year: number;
  resolvedUrl: string | null;
  attempts: UriAttempt[];
};

/** Probe Core Set CSV hosts; record every attempt (including post-success) for admin alerts. */
export async function ResolveCoreSetCsvUri(year: number): Promise<CoreSetResolveResult> {
  const attempts: UriAttempt[] = [];
  const meta = await metastoreDownloadUrl(year);
  const list = meta
    ? [meta, ...candidatesFor(year).filter((u) => u !== meta)]
    : candidatesFor(year);

  let resolvedUrl: string | null = null;
  for (const url of list) {
    let hit = await headOrGet(url, 'HEAD');
    if (hit.status === 405 || hit.status === 403 || hit.status === 0) {
      hit = await headOrGet(url, 'GET');
    }
    attempts.push(hit);
    if (!resolvedUrl && hit.status >= 200 && hit.status < 300) {
      resolvedUrl = url;
    }
  }
  return { ok: Boolean(resolvedUrl), year, resolvedUrl, attempts };
}
