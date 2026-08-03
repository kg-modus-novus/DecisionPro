/**
 * URI resolution attempt log → admin Load Monitor alerts.
 * Unresolved 404s = error; resolved after failed attempts = warning (questionable/fallback).
 */

export type UriAttempt = {
  url: string;
  status: number;
  method?: string;
  error?: string;
};

export type UriResolutionAlert = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  kind: 'unresolved-404' | 'fallback-resolution' | 'archive-404';
  title: string;
  explanation: string;
  fromSysId: string;
  dataRequestId?: string | null;
  periodId?: string | null;
  failedUrls: string[];
  resolvedUrl?: string | null;
  httpStatuses: number[];
  observedAt: string;
  logs: string[];
  loadHistoryId?: string | null;
};

export type UriResolutionEvent = {
  id: string;
  fromSysId: string;
  dataRequestId?: string | null;
  periodId?: string | null;
  subject: string;
  ok: boolean;
  resolvedUrl?: string | null;
  attempts: UriAttempt[];
  observedAt: string;
  notes?: string[];
};

export type UriResolutionLog = {
  schema: 'decisionpro/uri-resolution-log/v1';
  generatedAt: string;
  events: UriResolutionEvent[];
};

function failedAttempts(attempts: UriAttempt[]): UriAttempt[] {
  return attempts.filter((a) => !(a.status >= 200 && a.status < 300));
}

export function ClassifyUriResolutionEvent(event: UriResolutionEvent): UriResolutionAlert | null {
  const fails = failedAttempts(event.attempts || []);
  const logs = (event.attempts || []).map((a) => {
    const err = a.error ? ` error=${a.error}` : '';
    return `${a.method || 'HEAD'} ${a.status} ${a.url}${err}`;
  });
  for (const n of event.notes || []) logs.push(n);

  if (!event.ok || !event.resolvedUrl) {
    if (!fails.length && !(event.attempts || []).length) return null;
    const isArchiveInventory = String(event.id || '').startsWith('archive-');
    return {
      id: event.id,
      severity: isArchiveInventory ? 'info' : 'error',
      kind: isArchiveInventory ? 'archive-404' : 'unresolved-404',
      title: isArchiveInventory
        ? `Archive inventory miss for ${event.subject}`
        : `Unresolved download for ${event.subject}`,
      explanation: isArchiveInventory
        ? 'Day-sweep / archive probe found no HTTP 200 file for this period on the public path. Timeline marks it Not published. Re-probe on refresh; do not invent the month.'
        : 'No authoritative URI returned HTTP 200 after probing known hosts and metastore candidates. Treat as unpublished until an alternate authoritative URL is confirmed — do not invent the series.',
      fromSysId: event.fromSysId,
      dataRequestId: event.dataRequestId || null,
      periodId: event.periodId || null,
      failedUrls: fails.map((a) => a.url),
      resolvedUrl: null,
      httpStatuses: (event.attempts || []).map((a) => a.status),
      observedAt: event.observedAt,
      logs,
    };
  }

  // Successful first attempt with no failures — not an alert.
  if (!fails.length) return null;

  // Resolved after failures (often 404 on legacy path) — questionable / fallback resolution.
  return {
    id: event.id,
    severity: 'warning',
    kind: 'fallback-resolution',
    title: `Fallback URI used for ${event.subject}`,
    explanation:
      'At least one candidate URI failed (often HTTP 404 on a legacy path) before an alternate authoritative URL succeeded. Confirm the resolved host/path remains the publisher SoT and keep both failed and resolved URIs in Spectrum / load notes.',
    fromSysId: event.fromSysId,
    dataRequestId: event.dataRequestId || null,
    periodId: event.periodId || null,
    failedUrls: fails.map((a) => a.url),
    resolvedUrl: event.resolvedUrl,
    httpStatuses: (event.attempts || []).map((a) => a.status),
    observedAt: event.observedAt,
    logs,
  };
}

export function AlertsFromUriResolutionLog(log: UriResolutionLog | null | undefined): UriResolutionAlert[] {
  if (!log?.events?.length) return [];
  return log.events.map(ClassifyUriResolutionEvent).filter((a): a is UriResolutionAlert => a != null);
}

export function AlertsFromArchiveProbes(
  fromSysId: string,
  probes: Array<{
    periodId?: string;
    uri?: string;
    httpStatus?: number;
    parseStatus?: string;
  }>,
  observedAt: string,
  dataRequestId?: string | null,
): UriResolutionAlert[] {
  const out: UriResolutionAlert[] = [];
  for (const p of probes || []) {
    const status = Number(p.httpStatus) || 0;
    const notFound = p.parseStatus === 'NOT_FOUND' || status === 404;
    if (!notFound) continue;
    const uri = p.uri || '(missing uri)';
    const periodId = p.periodId || 'unknown';
    out.push({
      id: `archive-${fromSysId}-${periodId}`,
      severity: 'info',
      kind: 'archive-404',
      title: `Archive inventory miss (${periodId})`,
      explanation:
        'Publisher archive path returned HTTP 404 / NOT_FOUND on the day-sweep inventory. Timeline marks Not published. Re-probe on refresh; do not invent the period.',
      fromSysId,
      dataRequestId: dataRequestId || null,
      periodId,
      failedUrls: [uri],
      resolvedUrl: null,
      httpStatuses: [status || 404],
      observedAt,
      logs: [`GET ${status || 404} ${uri}`, `parseStatus=${p.parseStatus || 'NOT_FOUND'}`],
    });
  }
  return out;
}

export function SortUriResolutionAlerts(alerts: UriResolutionAlert[]): UriResolutionAlert[] {
  const rank = { error: 0, warning: 1, info: 2 };
  return [...alerts].sort((a, b) => {
    const s = rank[a.severity] - rank[b.severity];
    if (s !== 0) return s;
    return String(b.observedAt).localeCompare(String(a.observedAt));
  });
}
