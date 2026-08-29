import crypto from 'node:crypto';

export type CsvRecord = Record<string, string>;

export async function FetchPublicBytes(
  uri: string,
  init: RequestInit = {},
  timeoutMs = 90000,
): Promise<{ bytes: Buffer; mediaType: string; finalUri: string }> {
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(uri, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: '*/*',
          'User-Agent': 'DecisionPro-public-data-loader/1.0 (+https://DecisionPro.io)',
          ...(init.headers || {}),
        },
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status} ${response.statusText}`;
        if (response.status !== 429 && response.status < 500) break;
      } else {
        return {
          bytes: Buffer.from(await response.arrayBuffer()),
          mediaType: response.headers.get('content-type') || 'application/octet-stream',
          finalUri: response.url || uri,
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw new Error(`Public source fetch failed for ${uri}: ${lastError}`);
}

export function ParseCsvRecords(text: string): CsvRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift()?.map((value) => value.trim().toLowerCase()) || [];
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function DecodeHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#160;|&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ExtractDocumentLinks(html: string, pageUri: string) {
  const links: Array<{ title: string; uri: string }> = [];
  const pattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = DecodeHtml(match[1] || '');
    if (!/\.(pdf|xlsx?|docx?)(\?|$)/i.test(href)) continue;
    let uri = '';
    try {
      uri = new URL(href, pageUri).toString();
    } catch {
      continue;
    }
    const title = DecodeHtml(match[2] || '') || decodeURIComponent(new URL(uri).pathname.split('/').at(-1) || 'Document');
    links.push({ title, uri });
  }
  return links.filter(
    (link, index, all) => all.findIndex((candidate) => candidate.uri.toLowerCase() === link.uri.toLowerCase()) === index,
  );
}

export function Sha256(bytes: Buffer | string) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function SafeObjectSegment(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'document';
}

export function NumberOrNull(value: unknown): number | null {
  const normalized = String(value ?? '').replace(/[$,%\s]/g, '').trim();
  if (!normalized || /^n\/?a$/i.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function IsoDateOrNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString().slice(0, 10);
}
