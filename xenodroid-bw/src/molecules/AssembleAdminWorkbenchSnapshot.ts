import type pg from 'pg';
import {
  DTP_TO_DATA_REQUEST,
  FLOW_GRAPH_TEMPLATES,
  INFO_OBJECT_TEMPLATES,
  INFO_PROVIDER_STRUCTURES,
  PLANNED_FLOWS,
  POC_INVENTORY_NOTE,
  TRANSFORMATION_MAPPINGS,
} from '../admin/modelingCatalog.js';
import { LoadPersistedUriResolutionAlerts } from './ExportUriResolutionLog.js';

type LoadRow = {
  load_history_id: string;
  data_request_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  load_class: string;
  row_count: number | null;
  as_of_date: string | null;
  source_uri: string | null;
  notes: string | null;
};

function statusFromLoad(load: LoadRow | undefined): 'completed' | 'active' | 'upcoming' | 'error' {
  if (!load) return 'upcoming';
  if (load.status === 'FAILED') return 'error';
  if (load.status === 'RUNNING') return 'active';
  if (load.status === 'SUCCEEDED' || load.status === 'PURGED') return 'completed';
  return 'upcoming';
}

/**
 * Business Action: AssembleAdminWorkbenchSnapshot
 * Read-only assembly of admin list/canvas payloads from warehouse + modeling overlay.
 */
export class AssembleAdminWorkbenchSnapshot {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Snapshot: Record<string, unknown> | null = null;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const sourceSystems = await this.client.query<{
        from_sys_id: string;
        publisher: string;
        tos_grade: string;
        base_uri: string;
        attribution_notes: string;
      }>(
        `SELECT from_sys_id, publisher, tos_grade, base_uri, attribution_notes
         FROM bw_ctl.source_system
         ORDER BY from_sys_id`,
      );

      const dataRequests = await this.client.query<{
        data_request_id: string;
        from_sys_id: string;
        target_psa_prefix: string;
        load_class: string;
        active: boolean;
      }>(
        `SELECT data_request_id, from_sys_id, target_psa_prefix, load_class, active
         FROM bw_ctl.data_request
         ORDER BY data_request_id`,
      );

      const loads = await this.client.query<LoadRow>(
        `SELECT load_history_id, data_request_id,
                started_at::text, completed_at::text, status, load_class,
                row_count, as_of_date::text, source_uri, notes
         FROM bw_ctl.load_history
         ORDER BY started_at DESC`,
      );

      const latestByRequest = new Map<string, LoadRow>();
      for (const row of loads.rows) {
        if (!latestByRequest.has(row.data_request_id)) {
          latestByRequest.set(row.data_request_id, row);
        }
      }

      const psaLatest = await this.client.query<{
        object_key: string;
        from_sys_id: string;
        load_history_id: string;
        load_class: string;
        byte_length: string;
        landed_at: string;
      }>(
        `SELECT DISTINCT ON (from_sys_id, load_class)
            object_key, from_sys_id, load_history_id, load_class,
            byte_length::text, landed_at::text
         FROM bw_psa_meta.object_index
         ORDER BY from_sys_id, load_class, landed_at DESC`,
      );

      const enrCount = await this.countLatestDso(
        'bw_dso.dso_enrollment_state',
        'DR-REAL-PI-ENROLLMENT',
        latestByRequest,
      );
      const mcoCount = await this.countLatestDso(
        'bw_dso.dso_mco_roster',
        'DR-REAL-MCO-ROSTER',
        latestByRequest,
      );
      const cubeDistinct = (
        await this.client.query<{ n: number }>(
          `SELECT count(DISTINCT measure_id)::int AS n
           FROM bw_cube.cube_exec_landing
           WHERE load_class = 'REAL'`,
        )
      ).rows[0].n;
      const roomCount = (
        await this.client.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM bw_cube.cube_room_row WHERE load_class = 'REAL'`,
        )
      ).rows[0].n;

      const measureLinks = await this.client.query<{ measure_id: string; from_sys_id: string }>(
        `SELECT measure_id, from_sys_id FROM bw_ctl.measure_source ORDER BY measure_id`,
      );
      const measuresBySys = new Map<string, string[]>();
      for (const m of measureLinks.rows) {
        const list = measuresBySys.get(m.from_sys_id) || [];
        list.push(m.measure_id);
        measuresBySys.set(m.from_sys_id, list);
      }

      const cubeLatest = await this.client.query<{
        measure_id: string;
        display_value: string;
        as_of_date: string;
      }>(
        `SELECT DISTINCT ON (measure_id)
            measure_id, display_value, as_of_date::text
         FROM bw_cube.cube_exec_landing
         WHERE load_class = 'REAL'
         ORDER BY measure_id, as_of_date DESC, load_history_id DESC`,
      );

      const sourceSystemRows = sourceSystems.rows.map((s) => {
        const relatedLoads = loads.rows.filter((l) => {
          const dr = dataRequests.rows.find((d) => d.data_request_id === l.data_request_id);
          return dr?.from_sys_id === s.from_sys_id;
        });
        const latest = relatedLoads[0];
        return {
          id: s.from_sys_id,
          technicalName: s.from_sys_id,
          publisher: s.publisher,
          tosGrade: s.tos_grade,
          baseUri: s.base_uri,
          status: s.from_sys_id === 'TEST_FIXTURE_PACK' ? 'test-only' : latest ? 'active' : 'catalogued',
          attributionNotes: s.attribution_notes,
          lastLoadStatus: latest?.status ?? null,
          lastLoadAt: latest?.completed_at || latest?.started_at || null,
        };
      });

      const dataSourceRows = dataRequests.rows.map((dr) => {
        const ss = sourceSystems.rows.find((s) => s.from_sys_id === dr.from_sys_id);
        const latest = latestByRequest.get(dr.data_request_id);
        const psa = psaLatest.rows.find(
          (p) => p.from_sys_id === dr.from_sys_id && p.load_class === dr.load_class,
        );
        const flow = Object.values(FLOW_GRAPH_TEMPLATES).find(
          (f) => f.dataRequestId === dr.data_request_id,
        );
        return {
          id: dr.data_request_id.replace(/^DR-/, 'DS-'),
          technicalName: `DS_${dr.from_sys_id}`,
          sourceSystemId: dr.from_sys_id,
          psa: psa?.object_key || dr.target_psa_prefix,
          description: `${dr.data_request_id} → ${dr.target_psa_prefix}`,
          tosGrade: ss?.tos_grade || 'UNKNOWN',
          status: dr.load_class === 'TEST' ? 'test-only' : dr.active ? 'active' : 'inactive',
          loadClass: dr.load_class,
          dataRequestId: dr.data_request_id,
          dataFlowId: flow?.canvasId || null,
          lastLoadStatus: latest?.status ?? null,
          lastLoadAt: latest?.completed_at || latest?.started_at || null,
          rowCount: latest?.row_count ?? null,
        };
      });

      const infoProviders = [
        {
          id: 'DSO_ENROLLMENT_STATE',
          technicalName: 'DSO_ENROLLMENT_STATE',
          type: 'detailDso',
          typeLabel: 'Detail DSO',
          description: 'KY Medicaid & CHIP enrollment by period (live)',
          measures: ['M-001', 'M-002'],
          dataFlowId: 'enrollment',
          status: enrCount > 0 ? 'active' : 'empty',
          rowCount: enrCount,
          loadClass: 'REAL',
        },
        {
          id: 'DSO_MCO_ROSTER',
          technicalName: 'DSO_MCO_ROSTER',
          type: 'detailDso',
          typeLabel: 'Detail DSO',
          description: 'KY DMS MCO contract roster (live)',
          measures: ['M-007'],
          dataFlowId: 'mco',
          status: mcoCount > 0 ? 'active' : 'empty',
          rowCount: mcoCount,
          loadClass: 'REAL',
        },
        {
          id: 'CUBE_ROOM_ROW',
          technicalName: 'CUBE_ROOM_ROW',
          type: 'detailDso',
          typeLabel: 'Room facts',
          description: 'Public hydration room-oriented rows (live)',
          measures: measureLinks.rows.map((m) => m.measure_id).filter((id, i, a) => a.indexOf(id) === i).slice(0, 8),
          dataFlowId: 'public-hydration',
          status: roomCount > 0 ? 'active' : 'empty',
          rowCount: roomCount,
          loadClass: 'REAL',
        },
        {
          id: 'CUBE_EXEC_LANDING',
          technicalName: 'CUBE_EXEC_LANDING',
          type: 'cube',
          typeLabel: 'Cube',
          description: 'Executive accurate-path aggregate (live)',
          measures: cubeLatest.rows.map((m) => m.measure_id),
          dataFlowId: 'enrollment',
          status: cubeDistinct > 0 ? 'active' : 'empty',
          rowCount: cubeDistinct,
          loadClass: 'REAL',
        },
        {
          id: 'Q_LANDING_ACCURATE',
          technicalName: 'Q_LANDING_ACCURATE',
          type: 'report',
          typeLabel: 'Query',
          description: 'Accurate Path query / export surface → DecisionPro UI',
          measures: cubeLatest.rows.map((m) => m.measure_id),
          dataFlowId: 'enrollment',
          status: cubeDistinct > 0 ? 'active' : 'empty',
          rowCount: null,
          loadClass: 'REAL',
        },
      ];

      const infoObjects = INFO_OBJECT_TEMPLATES.map((t) => ({
        ...t,
        status: 'active',
        liveValue:
          t.measureId != null
            ? cubeLatest.rows.find((m) => m.measure_id === t.measureId)?.display_value || null
            : null,
      }));

      const dataFlowCatalog = [
        ...Object.values(FLOW_GRAPH_TEMPLATES).map((flow) => {
          const latest = latestByRequest.get(flow.dataRequestId);
          return {
            id: flow.id,
            technicalName: flow.technicalName,
            title: flow.title,
            description: flow.subtitle,
            status: latest?.status === 'SUCCEEDED' ? 'active' : latest ? 'loaded' : 'empty',
            loadClass: latest?.load_class || 'REAL',
            lastLoadStatus: latest?.status ?? null,
            lastLoadAt: latest?.completed_at || latest?.started_at || null,
            asOfDate: latest?.as_of_date ?? null,
            measures: flow.measures,
            sourceSystem: flow.sourceSystem,
            targetCube: flow.targetCube,
            targetReport: flow.targetReport,
            dataRequestId: flow.dataRequestId,
            canvasId: flow.canvasId,
            note: null as string | null,
            rowCount: latest?.row_count ?? null,
          };
        }),
        ...PLANNED_FLOWS.map((p) => ({
          ...p,
          loadClass: null,
          lastLoadStatus: null,
          lastLoadAt: null,
          asOfDate: null,
          dataRequestId: null,
          rowCount: null,
        })),
      ];

      const dataFlows: Record<string, unknown> = {};
      for (const flow of Object.values(FLOW_GRAPH_TEMPLATES)) {
        const latest = latestByRequest.get(flow.dataRequestId);
        const psa = psaLatest.rows.find((p) =>
          flow.sourceSystem === 'MULTI'
            ? p.object_key.includes('PUBLIC_HYDRATION')
            : p.from_sys_id === flow.sourceSystem && p.load_class === 'REAL',
        );
        dataFlows[flow.id] = {
          id: flow.id,
          title: flow.title,
          subtitle: flow.subtitle,
          nodes: flow.nodes.map((node) => {
            let meta = node.meta || '';
            let detail: Record<string, unknown> = { layer: node.type };
            let nodeStatus = statusFromLoad(latest);
            if (node.type === 'psa') {
              meta = psa
                ? `${psa.object_key.split('/').slice(-2).join('/')} · ${psa.load_class}`
                : 'No PSA object yet';
              detail = {
                layer: 'PSA',
                fromSysId: flow.sourceSystem,
                loadClass: psa?.load_class || 'REAL',
                objectKey: psa?.object_key || null,
                bytes: psa?.byte_length || null,
              };
              nodeStatus = psa ? 'completed' : 'upcoming';
            } else if (node.type === 'detailDso') {
              const count =
                node.technicalName === 'DSO_ENROLLMENT_STATE'
                  ? enrCount
                  : node.technicalName === 'DSO_MCO_ROSTER'
                    ? mcoCount
                    : node.technicalName === 'CUBE_ROOM_ROW'
                      ? roomCount
                      : null;
              meta = count != null ? `${count} rows · latest REAL load` : meta;
              detail = {
                layer: 'Detail DSO',
                table:
                  node.technicalName === 'CUBE_ROOM_ROW'
                    ? 'bw_cube.cube_room_row'
                    : `bw_dso.${node.technicalName.toLowerCase()}`,
                rowCount: count,
                loadClass: 'REAL',
                loadHistoryId: latest?.load_history_id || null,
              };
              nodeStatus = count && count > 0 ? 'completed' : 'upcoming';
            } else if (node.type === 'dtp') {
              meta = latest ? `Last ${latest.status} · ${latest.row_count ?? 0} rows` : 'No runs';
              detail = {
                layer: 'DTP',
                source: flow.nodes.find((n) => n.type === 'detailDso')?.technicalName,
                target: 'CUBE_EXEC_LANDING',
                filter: 'load_class = REAL',
                status: latest?.status || null,
                loadHistoryId: latest?.load_history_id || null,
              };
              // SUCCEEDED → completed; Active only while RUNNING
              nodeStatus = statusFromLoad(latest);
            } else if (node.type === 'cube') {
              meta = `${cubeDistinct} measures · REAL`;
              detail = {
                layer: 'Cube',
                measures: flow.measures,
                loadClass: 'REAL',
                table: 'bw_cube.cube_exec_landing',
              };
              nodeStatus = cubeDistinct > 0 ? 'completed' : 'upcoming';
            } else if (node.type === 'report') {
              meta = 'ExportAccurateLandingForUi → 5040';
              detail = {
                layer: 'Query / Report',
                export: 'accurateLanding.js',
                ui: 'http://localhost:5040/',
              };
              nodeStatus = cubeDistinct > 0 ? 'completed' : 'upcoming';
            } else if (node.type === 'transformation') {
              detail = {
                layer: 'Transformation',
                rules: node.meta || 'Runner cleanse / normalize',
                loadClass: 'REAL',
              };
              nodeStatus = latest?.status === 'SUCCEEDED' ? 'completed' : statusFromLoad(latest);
            }
            return {
              ...node,
              meta,
              status: nodeStatus,
              detail,
            };
          }),
        };
      }

      const loadMonitor = loads.rows.map((h) => ({
        id: h.load_history_id,
        dataRequestId: h.data_request_id,
        status: h.status,
        loadClass: h.load_class,
        rowCount: h.row_count,
        asOfDate: h.as_of_date,
        completedAt: h.completed_at || h.started_at,
        sourceUri: h.source_uri,
        notes: h.notes,
      }));

      const loadAlerts = await LoadPersistedUriResolutionAlerts();
      // Attach latest matching load history id when data request is known.
      for (const alert of loadAlerts) {
        if (!alert.dataRequestId) continue;
        const latest = latestByRequest.get(alert.dataRequestId);
        if (latest) alert.loadHistoryId = latest.load_history_id;
      }

      const processChain = {
        id: 'PC_POC_ACCURACY_GATE',
        title: 'POC Accuracy Gate',
        steps: [
          { id: 's1', title: 'Start', status: 'completed', meta: 'Operator' },
          {
            id: 's2',
            title: 'Load TEST fixtures',
            status: loads.rows.some((l) => l.load_class === 'TEST') ? 'completed' : 'upcoming',
            meta: 'DR-TEST-*',
          },
          { id: 's3', title: 'Thorough tests', status: 'completed', meta: 'parser + DB assert' },
          {
            id: 's4',
            title: 'Purge TEST',
            status: loads.rows.some((l) => l.status === 'PURGED') ? 'completed' : 'upcoming',
            meta: 'PurgeTestLoads',
          },
          {
            id: 's5',
            title: 'Empty check',
            status: 'completed',
            meta: 'VerifyWarehouseEmptyOfTest',
          },
          {
            id: 's6',
            title: 'REAL ETL',
            status: latestByRequest.get('DR-REAL-PI-ENROLLMENT')?.status === 'SUCCEEDED'
              ? 'completed'
              : 'active',
            meta: 'DR-REAL-*',
          },
          {
            id: 's7',
            title: 'Refresh cubes',
            status: cubeDistinct > 0 ? 'completed' : 'upcoming',
            meta: 'CUBE_EXEC_LANDING',
          },
          {
            id: 's8',
            title: 'Export UI',
            status: cubeDistinct > 0 ? 'completed' : 'upcoming',
            meta: 'accurateLanding.js',
          },
          {
            id: 's9',
            title: 'End',
            status: cubeDistinct > 0 ? 'completed' : 'upcoming',
            meta: 'Gate complete',
          },
        ],
      };

      this.Snapshot = {
        schema: 'decisionpro/xbw-admin-workbench/v1',
        generatedAt: new Date().toISOString(),
        mode: 'live',
        inventoryNote: POC_INVENTORY_NOTE,
        inventory: {
          detailDsos: 2,
          cubes: 1,
          roomStores: 1,
          queries: 1,
          realDataFlows: 3,
          plannedDataFlows: PLANNED_FLOWS.length,
        },
        transformationMappings: TRANSFORMATION_MAPPINGS,
        providerStructures: INFO_PROVIDER_STRUCTURES,
        stats: {
          sourceSystems: sourceSystemRows.length,
          enrollmentRowsLatest: enrCount,
          mcoRowsLatest: mcoCount,
          cubeMeasures: cubeDistinct,
          roomRows: roomCount,
          loadHistory: loadMonitor.length,
          psaObjects: psaLatest.rows.length,
          loadAlerts: loadAlerts.length,
          loadAlertErrors: loadAlerts.filter((a) => a.severity === 'error').length,
          loadAlertWarnings: loadAlerts.filter((a) => a.severity === 'warning').length,
        },
        accurateHighlights: Object.fromEntries(
          cubeLatest.rows
            .filter((m) => ['M-001', 'M-002', 'M-007'].includes(m.measure_id))
            .map((m) => [m.measure_id, { displayValue: m.display_value, asOfDate: m.as_of_date }]),
        ),
        sourceSystems: sourceSystemRows,
        dataSources: dataSourceRows,
        infoProviders,
        infoObjects,
        dataFlowCatalog,
        dataFlows,
        loadMonitor,
        loadAlerts,
        processChain,
        dtpDataRequestMap: DTP_TO_DATA_REQUEST,
      };
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
    }
  }

  private async countLatestDso(
    table: string,
    dataRequestId: string,
    latestByRequest: Map<string, LoadRow>,
  ) {
    const latest = latestByRequest.get(dataRequestId);
    if (!latest || latest.status !== 'SUCCEEDED') {
      const r = await this.client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${table} WHERE load_class = 'REAL'`,
      );
      return r.rows[0].n;
    }
    const r = await this.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${table}
       WHERE load_class = 'REAL' AND load_history_id = $1`,
      [latest.load_history_id],
    );
    // If historical loads didn't keep matching LH on all rows, fall back to all REAL
    if (r.rows[0].n === 0) {
      const all = await this.client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${table} WHERE load_class = 'REAL'`,
      );
      return all.rows[0].n;
    }
    return r.rows[0].n;
  }
}
