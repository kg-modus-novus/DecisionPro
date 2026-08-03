import fs from 'node:fs/promises';
import path from 'node:path';
import { BW_ROOT, REPO_ROOT } from '../config.js';
import { ResolveCoreSetCsvUri } from '../atoms/ResolveCoreSetCsvUri.js';
import { readFixtureJson } from './SeedWarehouseCatalog.js';
import {
  AlertsFromArchiveProbes,
  AlertsFromUriResolutionLog,
  SortUriResolutionAlerts,
  type UriResolutionAlert,
  type UriResolutionEvent,
  type UriResolutionLog,
} from '../admin/uriResolutionAlerts.js';

type SpectrumAvailable = {
  sources?: Record<
    string,
    {
      archiveProbe?: Array<{
        periodId?: string;
        uri?: string;
        httpStatus?: number;
        parseStatus?: string;
      }>;
    }
  >;
};

/**
 * Business Action: ExportUriResolutionLog
 * Probe Core Set CSV hosts + fold Spectrum archive 404 probes into a persisted
 * alert log for the BW admin Load Monitor.
 */
export class ExportUriResolutionLog {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  AlertCount = 0;
  ErrorCount = 0;
  WarningCount = 0;
  ExportPath = path.join(BW_ROOT, 'data', 'exports', 'uri-resolution-log.json');
  FixturePath = path.join(BW_ROOT, 'src', 'fixtures', 'uriResolutionLog.json');
  AdminExportPath = path.join(
    REPO_ROOT,
    'xenodroid-bw',
    'admin',
    'src',
    'data',
    'uriResolutionLog.generated.js',
  );

  async Run(years: number[] = [2020, 2021, 2022, 2023, 2024]) {
    if (this.Status !== 'INITIAL') return;
    try {
      const observedAt = new Date().toISOString();
      const events: UriResolutionEvent[] = [];

      for (const year of years) {
        const r = await ResolveCoreSetCsvUri(year);
        events.push({
          id: `coreset-ffy${year}`,
          fromSysId: 'CMS_MEDICAID_SCORECARD',
          dataRequestId: 'DR-REAL-PUBLIC-HYDRATION',
          periodId: `ffy${year}`,
          subject: `CMS Child/Adult Core Set FFY ${year} CSV`,
          ok: r.ok,
          resolvedUrl: r.resolvedUrl,
          attempts: r.attempts,
          observedAt,
          notes: r.ok
            ? r.attempts.some((a) => a.status === 404)
              ? [
                  `Legacy or alternate candidate returned 404 before resolving ${r.resolvedUrl}`,
                ]
              : undefined
            : ['No candidate returned HTTP 200'],
        });
      }

      const spectrum = await readFixtureJson<SpectrumAvailable>('dataSpectrumAvailable.json');
      for (const [fromSysId, meta] of Object.entries(spectrum.sources || {})) {
        if (!meta.archiveProbe?.length) continue;
        const misses = meta.archiveProbe.filter(
          (probe) => probe.parseStatus === 'NOT_FOUND' || Number(probe.httpStatus) === 404,
        );
        if (!misses.length) continue;
        // One inventory summary per source when the day-sweep is large; avoid flooding Load Monitor.
        if (misses.length > 3) {
          const sample = misses.slice(0, 5);
          events.push({
            id: `archive-${fromSysId}-inventory`,
            fromSysId,
            dataRequestId:
              fromSysId === 'KY_DMS_COUNTY_COUNTS' ? 'DR-REAL-PUBLIC-HYDRATION' : null,
            periodId: null,
            subject: `${fromSysId} archive inventory (${misses.length} months)`,
            ok: false,
            resolvedUrl: null,
            attempts: sample.map((probe) => ({
              url: probe.uri || '',
              status: Number(probe.httpStatus) || 404,
              method: 'GET',
            })),
            observedAt,
            notes: [
              `Day-sweep NOT_FOUND count=${misses.length}`,
              `sample periods: ${sample.map((p) => p.periodId).join(', ')}`,
            ],
          });
        } else {
          for (const probe of misses) {
            events.push({
              id: `archive-${fromSysId}-${probe.periodId || 'unknown'}`,
              fromSysId,
              dataRequestId:
                fromSysId === 'KY_DMS_COUNTY_COUNTS' ? 'DR-REAL-PUBLIC-HYDRATION' : null,
              periodId: probe.periodId || null,
              subject: `${fromSysId} archive ${probe.periodId || ''}`.trim(),
              ok: false,
              resolvedUrl: null,
              attempts: [
                {
                  url: probe.uri || '',
                  status: Number(probe.httpStatus) || 404,
                  method: 'GET',
                },
              ],
              observedAt,
              notes: [`parseStatus=${probe.parseStatus || 'NOT_FOUND'}`],
            });
          }
        }
      }

      const log: UriResolutionLog = {
        schema: 'decisionpro/uri-resolution-log/v1',
        generatedAt: observedAt,
        events,
      };

      const classified = SortUriResolutionAlerts(AlertsFromUriResolutionLog(log));

      await fs.mkdir(path.dirname(this.ExportPath), { recursive: true });
      await fs.writeFile(this.ExportPath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
      await fs.writeFile(this.FixturePath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');

      const js = `/** Generated by ExportUriResolutionLog — do not hand-edit. */
export const URI_RESOLUTION_LOG = ${JSON.stringify(log, null, 2)};
export const LOAD_ALERTS = ${JSON.stringify(classified, null, 2)};
`;
      await fs.mkdir(path.dirname(this.AdminExportPath), { recursive: true });
      await fs.writeFile(this.AdminExportPath, js, 'utf8');

      this.AlertCount = classified.length;
      this.ErrorCount = classified.filter((a) => a.severity === 'error').length;
      this.WarningCount = classified.filter((a) => a.severity === 'warning').length;
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
    }
  }
}

/** Read persisted log (+ Spectrum archive probes as belt-and-suspenders). */
export async function LoadPersistedUriResolutionAlerts(): Promise<UriResolutionAlert[]> {
  const observedAt = new Date().toISOString();
  let log: UriResolutionLog | null = null;
  const paths = [
    path.join(BW_ROOT, 'data', 'exports', 'uri-resolution-log.json'),
    path.join(BW_ROOT, 'src', 'fixtures', 'uriResolutionLog.json'),
  ];
  for (const p of paths) {
    try {
      log = JSON.parse(await fs.readFile(p, 'utf8')) as UriResolutionLog;
      break;
    } catch {
      /* try next */
    }
  }

  const alerts = AlertsFromUriResolutionLog(log);
  // If log missing archive events, still surface Spectrum probes.
  if (!log?.events?.some((e) => e.id.startsWith('archive-'))) {
    try {
      const spectrum = await readFixtureJson<SpectrumAvailable>('dataSpectrumAvailable.json');
      for (const [fromSysId, meta] of Object.entries(spectrum.sources || {})) {
        alerts.push(
          ...AlertsFromArchiveProbes(
            fromSysId,
            meta.archiveProbe || [],
            log?.generatedAt || observedAt,
            fromSysId === 'KY_DMS_COUNTY_COUNTS' ? 'DR-REAL-PUBLIC-HYDRATION' : null,
          ),
        );
      }
    } catch {
      /* ignore */
    }
  }
  return SortUriResolutionAlerts(alerts);
}
