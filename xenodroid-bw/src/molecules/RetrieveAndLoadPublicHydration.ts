import type pg from 'pg';
import { psaStore } from '../psa/filesystemPsa.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { readFixtureJson } from './SeedWarehouseCatalog.js';

type LandingMeasure = {
  measureId: string;
  displayValue: string;
  numericValue: number | null;
  unit: string;
  asOfDate: string;
  fromSysId: string;
  sourceUri: string;
  sourcePageUri?: string;
  note?: string;
  peerMedian?: number | null;
  coreSetAbbr?: string;
  periodId?: string;
};

type Gap = {
  gapId: string;
  title: string;
  need: string;
  rooms: string[];
  findingIds: string[];
  paidFollowOn: string;
};

type County = {
  countyId: string;
  label: string;
  district: string;
  enrollment: number;
  asOfDate: string;
  periodId?: string;
  sourceUri?: string;
};

type HydrationPack = {
  asOfDate: string;
  attribution: string;
  landingMeasures: LandingMeasure[];
  counties: County[];
  gaps: Gap[];
  legislation: Array<Record<string, unknown>>;
};

type RoomRow = {
  row_id: string;
  room_id: string;
  title: string;
  metric_key: string;
  metric_value: number | null;
  display_value: string;
  row_kind: 'REAL' | 'GAP';
  dimensions: Record<string, string>;
  payload: Record<string, unknown>;
  from_sys_id: string;
  as_of_date: string | null;
};

function latestByMeasure(measures: LandingMeasure[]): Record<string, LandingMeasure> {
  const sorted = [...measures].sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));
  return Object.fromEntries(sorted.map((m) => [m.measureId, m]));
}

function seriesFor(measures: LandingMeasure[], measureId: string): LandingMeasure[] {
  return measures
    .filter((m) => m.measureId === measureId)
    .sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));
}

function trendPts(series: LandingMeasure[], idx: number): number | null {
  if (idx < 1) return null;
  const cur = series[idx]?.numericValue;
  const prev = series[idx - 1]?.numericValue;
  if (cur == null || prev == null) return null;
  return Number((cur - prev).toFixed(1));
}

function buildRoomRows(pack: HydrationPack): RoomRow[] {
  const rows: RoomRow[] = [];
  const byId = latestByMeasure(pack.landingMeasures);

  const add = (row: RoomRow) => rows.push(row);

  add({
    row_id: 'cc-enroll-trend',
    room_id: 'command-center',
    title: 'KY Medicaid & CHIP enrollment (CMS PI)',
    metric_key: 'dollarImpactM',
    metric_value: byId['M-003']?.numericValue ?? null,
    display_value: 'See M-001 landing',
    row_kind: 'REAL',
    dimensions: { population: 'all', region: 'statewide', period: 'latest', attention: 'watch', freshness: 'near' },
    payload: { measureId: 'M-001', deltaPct: null, linkedMeasure: 'M-001' },
    from_sys_id: 'CMS_DATA_MEDICAID_ENR',
    as_of_date: pack.asOfDate,
  });
  add({
    row_id: 'cc-spend',
    room_id: 'command-center',
    title: 'Federal reported Medicaid expenditure (KY)',
    metric_key: 'dollarImpactM',
    metric_value: byId['M-004']?.numericValue ?? null,
    display_value: byId['M-004']?.displayValue ?? '',
    row_kind: 'REAL',
    dimensions: { population: 'all', region: 'statewide', period: 'fy', attention: 'priority', freshness: 'lagged' },
    payload: { measureId: 'M-004', spendM: byId['M-004']?.numericValue },
    from_sys_id: 'CMS_DATA_MEDICAID',
    as_of_date: byId['M-004']?.asOfDate ?? pack.asOfDate,
  });
  add({
    row_id: 'cc-gap-claims',
    room_id: 'command-center',
    title: 'Gap — claim-grain dollar impact by service',
    metric_key: 'dollarImpactM',
    metric_value: null,
    display_value: 'Requires DUA',
    row_kind: 'GAP',
    dimensions: { population: 'disabled', region: 'statewide', period: 'latest', attention: 'data-incomplete', freshness: 'provisional' },
    payload: { gapId: 'GAP-CLAIMS-COST-DRIVERS' },
    from_sys_id: '',
    as_of_date: null,
  });

  for (const m of seriesFor(pack.landingMeasures, 'M-017')) {
    const period = m.periodId || `cy${m.asOfDate.slice(0, 4)}`;
    add({
      row_id: `cd-pharmacy-${period}`,
      room_id: 'cost-drivers',
      title: 'Pharmacy — federal published drug spend (KY slice)',
      metric_key: 'contributionM',
      metric_value: m.numericValue,
      display_value: `${m.displayValue} $M`,
      row_kind: 'REAL',
      dimensions: { population: 'all', region: 'statewide', period, service: 'pharmacy', mco: 'all' },
      payload: {
        measureId: 'M-017',
        spendM: m.numericValue,
        contributionM: m.numericValue,
        growthPct: null,
        pmpm: null,
        controllable: 'medium',
      },
      from_sys_id: 'CMS_MEDICAID_PHARMACY',
      as_of_date: m.asOfDate,
    });
  }
  add({
    row_id: 'cd-total-spend',
    room_id: 'cost-drivers',
    title: 'Total program expenditure (federal financial management)',
    metric_key: 'contributionM',
    metric_value: byId['M-004']?.numericValue ?? null,
    display_value: `${byId['M-004']?.displayValue ?? ''} $M`,
    row_kind: 'REAL',
    dimensions: { population: 'all', region: 'statewide', period: 'fy', service: 'all', mco: 'all' },
    payload: {
      measureId: 'M-004',
      spendM: byId['M-004']?.numericValue,
      contributionM: byId['M-004']?.numericValue,
      growthPct: null,
      pmpm: null,
      controllable: 'low',
    },
    from_sys_id: 'CMS_DATA_MEDICAID',
    as_of_date: byId['M-004']?.asOfDate ?? pack.asOfDate,
  });
  add({
    row_id: 'cd-gap-service-pop',
    room_id: 'cost-drivers',
    title: 'Gap — service × population contribution $M',
    metric_key: 'contributionM',
    metric_value: null,
    display_value: 'Requires DUA',
    row_kind: 'GAP',
    dimensions: { population: 'disabled', region: 'statewide', period: 'latest', service: 'inpatient', mco: 'all' },
    payload: { gapId: 'GAP-CLAIMS-COST-DRIVERS' },
    from_sys_id: '',
    as_of_date: null,
  });

  for (const m of seriesFor(pack.landingMeasures, 'M-003')) {
    const period = m.periodId || 'latest';
    add({
      row_id: `util-county-enroll-${period}`,
      room_id: 'utilization',
      title: 'County enrollment pressure (DMS monthly counts)',
      metric_key: 'rate',
      metric_value: m.numericValue,
      display_value: m.displayValue,
      row_kind: 'REAL',
      dimensions: {
        population: 'all',
        region: 'urban',
        period,
        measureType: 'access',
        freshness: 'recent',
      },
      payload: { measureId: 'M-003', rate: m.numericValue, distanceMiles: null },
      from_sys_id: 'KY_DMS_COUNTY_COUNTS',
      as_of_date: m.asOfDate,
    });
  }
  add({
    row_id: 'util-gap-ed',
    room_id: 'utilization',
    title: 'Gap — potentially avoidable ED visits',
    metric_key: 'rate',
    metric_value: null,
    display_value: 'Requires encounters or licensed HCUP',
    row_kind: 'GAP',
    dimensions: { population: 'all', region: 'rural', period: 'latest', measureType: 'utilization', freshness: 'provisional' },
    payload: { gapId: 'GAP-AVOIDABLE-ED' },
    from_sys_id: 'AHRQ_HCUP',
    as_of_date: null,
  });
  add({
    row_id: 'util-gap-distance',
    room_id: 'utilization',
    title: 'Gap — average distance to care (rural)',
    metric_key: 'rate',
    metric_value: null,
    display_value: 'Requires claims geo',
    row_kind: 'GAP',
    dimensions: { population: 'expansion', region: 'rural', period: 'latest', measureType: 'access', freshness: 'provisional' },
    payload: { gapId: 'GAP-RURAL-DISTANCE' },
    from_sys_id: 'HRSA_AHRF',
    as_of_date: null,
  });

  const scorecardSpecs: Array<{
    measureId: string;
    title: string;
    population: string;
  }> = [
    { measureId: 'M-010', title: 'Child Core Set — WCV-CH well-care visits (KY)', population: 'child' },
    { measureId: 'M-011', title: 'Adult Core Set — BCS-AD breast cancer screening (KY)', population: 'adult' },
    { measureId: 'M-012', title: 'Maternal — PPC-AD postpartum care (KY)', population: 'maternal' },
  ];
  for (const spec of scorecardSpecs) {
    const series = seriesFor(pack.landingMeasures, spec.measureId);
    series.forEach((m, idx) => {
      const period = m.periodId || `cy${m.asOfDate.slice(0, 4)}`;
      add({
        row_id: `out-${spec.measureId.toLowerCase()}-${period}`,
        room_id: 'outcomes',
        title: spec.title,
        metric_key: 'rate',
        metric_value: m.numericValue,
        display_value: `${m.displayValue}%`,
        row_kind: 'REAL',
        dimensions: {
          population: spec.population,
          region: 'statewide',
          period,
          measureType: 'quality',
          freshness: 'lagged',
        },
        payload: {
          measureId: spec.measureId,
          rate: m.numericValue,
          peerRate: m.peerMedian ?? null,
          peerPct: m.peerMedian ?? null,
          trendPts: trendPts(series, idx),
          coreSetAbbr: m.coreSetAbbr || null,
        },
        from_sys_id: 'CMS_MEDICAID_SCORECARD',
        as_of_date: m.asOfDate,
      });
    });
  }
  add({
    row_id: 'out-gap-hedis',
    room_id: 'outcomes',
    title: 'Gap — proprietary HEDIS specification text',
    metric_key: 'rate',
    metric_value: null,
    display_value: 'Link NCQA only',
    row_kind: 'GAP',
    dimensions: { population: 'all', region: 'statewide', period: 'cy', measureType: 'quality', freshness: 'provisional' },
    payload: { gapId: 'GAP-HEDIS-SPEC' },
    from_sys_id: '',
    as_of_date: null,
  });

  add({
    row_id: 'mco-roster',
    room_id: 'mco',
    title: 'Active contracted MCO roster (DMS)',
    metric_key: 'withholdingM',
    metric_value: 5,
    display_value: '5 active MCOs',
    row_kind: 'REAL',
    dimensions: { population: 'all', region: 'statewide', period: 'latest', mco: 'all', contractClass: 'mmc' },
    payload: { measureId: 'M-007', withholdingM: null, earnedBack: 'n/a — roster only', missedCount: null, pmpm: null },
    from_sys_id: 'KY_DMS_MCO_CONTRACTS',
    as_of_date: '2025-01-01',
  });
  add({
    row_id: 'mco-eqro',
    room_id: 'mco',
    title: 'EQRO / comprehensive evaluation themes published',
    metric_key: 'withholdingM',
    metric_value: 1,
    display_value: 'PDF available',
    row_kind: 'REAL',
    dimensions: { population: 'all', region: 'statewide', period: 'fy', mco: 'wellcare', contractClass: 'quality' },
    payload: { measureId: 'M-014', withholdingM: null, earnedBack: 'theme only — not $', missedCount: null },
    from_sys_id: 'KY_DMS_MCO_EVAL',
    as_of_date: byId['M-014']?.asOfDate ?? pack.asOfDate,
  });
  add({
    row_id: 'mco-gap-withhold',
    room_id: 'mco',
    title: 'Gap — withholding dollars not earned back',
    metric_key: 'withholdingM',
    metric_value: null,
    display_value: 'Requires contract financials',
    row_kind: 'GAP',
    dimensions: { population: 'all', region: 'statewide', period: 'fy', mco: 'wellcare', contractClass: 'withholding' },
    payload: { gapId: 'GAP-MCO-WITHHOLDING-DOLLARS' },
    from_sys_id: '',
    as_of_date: null,
  });

  add({
    row_id: 'prov-fee',
    room_id: 'provider',
    title: 'Fee schedule update — 2025 Physician',
    metric_key: 'riskAdjPct',
    metric_value: 2025,
    display_value: byId['M-023']?.displayValue ?? '',
    row_kind: 'REAL',
    dimensions: { population: 'all', region: 'statewide', period: 'latest', providerGroup: 'physician', mco: 'all' },
    payload: { measureId: 'M-023', unadjPct: null, riskAdjPct: null, socialRisk: 'n/a', readmitPct: null },
    from_sys_id: 'KY_DMS_FEE_SCHEDULE',
    as_of_date: byId['M-023']?.asOfDate ?? pack.asOfDate,
  });
  add({
    row_id: 'prov-dir',
    room_id: 'provider',
    title: 'Provider directory freshness meta',
    metric_key: 'riskAdjPct',
    metric_value: 1,
    display_value: byId['M-022']?.displayValue ?? '',
    row_kind: 'REAL',
    dimensions: { population: 'all', region: 'statewide', period: 'latest', providerGroup: 'network', mco: 'all' },
    payload: { measureId: 'M-022' },
    from_sys_id: 'KY_DMS_PROVIDER_DIR',
    as_of_date: byId['M-022']?.asOfDate ?? pack.asOfDate,
  });
  add({
    row_id: 'prov-gap-risk',
    room_id: 'provider',
    title: 'Gap — risk-adjusted provider performance',
    metric_key: 'riskAdjPct',
    metric_value: null,
    display_value: 'Requires DUA',
    row_kind: 'GAP',
    dimensions: { population: 'disabled', region: 'statewide', period: 'latest', providerGroup: 'hospital', mco: 'all' },
    payload: { gapId: 'GAP-PROVIDER-RISK-ADJ' },
    from_sys_id: '',
    as_of_date: null,
  });

  for (const c of pack.counties) {
    const period = c.periodId || 'latest';
    add({
      row_id: `county-${c.countyId}-${period}`,
      room_id: 'county',
      title: `${c.label} County Medicaid membership`,
      metric_key: 'value',
      metric_value: c.enrollment,
      display_value: c.enrollment.toLocaleString('en-US'),
      row_kind: 'REAL',
      dimensions: {
        population: 'all',
        region: c.countyId === 'pike' ? 'rural' : 'urban',
        period,
        county: c.countyId,
        mco: 'all',
      },
      payload: { value: c.enrollment, vsStatePct: null, district: c.district, measureId: 'M-003' },
      from_sys_id: 'KY_DMS_COUNTY_COUNTS',
      as_of_date: c.asOfDate,
    });
  }
  for (const m of seriesFor(pack.landingMeasures, 'M-021')) {
    const period = m.periodId || `cy${m.asOfDate.slice(0, 4)}`;
    add({
      row_id: `county-acs-uninsured-${period}`,
      room_id: 'county',
      title: 'KY uninsured share (ACS context via KFF)',
      metric_key: 'value',
      metric_value: m.numericValue,
      display_value: `${m.displayValue}%`,
      row_kind: 'REAL',
      dimensions: {
        population: 'all',
        region: 'statewide',
        period,
        county: 'jefferson',
        mco: 'all',
      },
      payload: { value: m.numericValue, vsStatePct: null, district: null, measureId: 'M-021' },
      from_sys_id: 'CENSUS_ACS',
      as_of_date: m.asOfDate,
    });
  }
  add({
    row_id: 'county-gap-hd',
    room_id: 'county',
    title: 'Gap — House district expenditure rollup',
    metric_key: 'value',
    metric_value: null,
    display_value: 'Requires claims geo',
    row_kind: 'GAP',
    dimensions: { population: 'all', region: 'urban', period: 'latest', county: 'kenton', mco: 'all' },
    payload: { gapId: 'GAP-HD-EXPENDITURE', district: 'HD-67' },
    from_sys_id: '',
    as_of_date: null,
  });

  for (const spec of scorecardSpecs) {
    const series = seriesFor(pack.landingMeasures, spec.measureId);
    series.forEach((m, idx) => {
      const period = m.periodId || `cy${m.asOfDate.slice(0, 4)}`;
      const peer = m.peerMedian ?? null;
      const gap =
        m.numericValue != null && peer != null ? Number((m.numericValue - peer).toFixed(1)) : null;
      add({
        row_id: `bench-${spec.measureId.toLowerCase()}-${period}`,
        room_id: 'benchmarks',
        title: `KY ${m.coreSetAbbr || spec.measureId} vs Core Set median`,
        metric_key: 'gapPts',
        metric_value: gap,
        display_value: `${m.displayValue}% KY`,
        row_kind: 'REAL',
        dimensions: {
          population: spec.population,
          period,
          freshness: 'lagged',
          benchmarkType: 'cms',
        },
        payload: {
          measureId: spec.measureId,
          kyValue: m.numericValue,
          benchmarkValue: peer,
          peerRate: peer,
          gapPts: gap,
          trendPts: trendPts(series, idx),
          measure: m.coreSetAbbr || spec.measureId,
        },
        from_sys_id: 'CMS_MEDICAID_SCORECARD',
        as_of_date: m.asOfDate,
      });
    });
  }
  add({
    row_id: 'bench-gap-hedis',
    room_id: 'benchmarks',
    title: 'Gap — contract/HEDIS peer sets not public',
    metric_key: 'gapPts',
    metric_value: null,
    display_value: 'Not published',
    row_kind: 'GAP',
    dimensions: { population: 'all', period: 'cy', freshness: 'provisional', benchmarkType: 'hedis' },
    payload: { gapId: 'GAP-HEDIS-SPEC' },
    from_sys_id: '',
    as_of_date: null,
  });

  const defMeasures = [
    'M-001',
    'M-002',
    'M-003',
    'M-004',
    'M-007',
    'M-010',
    'M-011',
    'M-012',
    'M-014',
    'M-017',
    'M-021',
    'M-022',
    'M-023',
    'M-028',
  ];
  for (const mid of defMeasures) {
    const m = byId[mid];
    add({
      row_id: `def-${mid}`,
      room_id: 'measure-definitions',
      title: mid,
      metric_key: 'count',
      metric_value: 1,
      display_value: m?.displayValue ?? mid,
      row_kind: 'REAL',
      dimensions: { period: 'latest', freshness: 'recent', measureType: 'catalog' },
      payload: {
        owner: m?.fromSysId ?? 'catalog',
        source: m?.fromSysId ?? '',
        refreshCadence: 'source-publish',
        limitation: m?.note ?? '',
        measureId: mid,
      },
      from_sys_id: m?.fromSysId ?? '',
      as_of_date: m?.asOfDate ?? pack.asOfDate,
    });
  }

  return rows;
}

/**
 * Business Action: RetrieveAndLoadPublicHydration
 * Lands curated SAFE/ATTRIBUTABLE public pack → PSA → landing cubes + room rows + gaps.
 */
export class RetrieveAndLoadPublicHydration {
  DataRequestID = 'DR-REAL-PUBLIC-HYDRATION';
  FromSysID = 'CMS_MEDICAID_SCORECARD';
  LoadClass: 'REAL' = 'REAL';
  LoadHistoryID = '';
  PSAObjectKey = '';
  ContentHash = '';
  RowCount = 0;
  RoomRowCount = 0;
  GapCount = 0;
  Status: 'INITIAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Pack: HydrationPack | null = null;

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    this.Status = 'RUNNING';
    this.LoadHistoryID = newId('LH');
    try {
      this.Pack = await readFixtureJson<HydrationPack>('realPublicHydrationPack.json');
      const sourceUri = 'fixture:realPublicHydrationPack.json';
      await InsertLoadHistory(this.client, {
        load_history_id: this.LoadHistoryID,
        data_request_id: this.DataRequestID,
        started_at: new Date(),
        source_uri: sourceUri,
        load_class: this.LoadClass,
      });

      const bytes = Buffer.from(JSON.stringify(this.Pack, null, 2), 'utf8');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.PSAObjectKey = `psa/PUBLIC_HYDRATION/${this.LoadClass}/${stamp}/${this.LoadHistoryID}.json`;
      await psaStore.EnsureRootReady();
      const landed = await psaStore.PutObject(this.PSAObjectKey, bytes);
      this.ContentHash = landed.contentHash;
      await this.client.query(
        `INSERT INTO bw_psa_meta.object_index
          (object_key, from_sys_id, load_history_id, load_class, content_hash, byte_length)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          this.PSAObjectKey,
          this.FromSysID,
          this.LoadHistoryID,
          this.LoadClass,
          this.ContentHash,
          landed.byteLength,
        ],
      );

      const packMeasureIds = [...new Set(this.Pack.landingMeasures.map((m) => m.measureId))];
      if (packMeasureIds.length) {
        await this.client.query(
          `DELETE FROM bw_cube.cube_exec_landing
           WHERE load_class = $1 AND measure_id = ANY($2::text[])`,
          [this.LoadClass, packMeasureIds],
        );
        await this.client.query(
          `DELETE FROM bw_cube.cube_room_row WHERE load_class = $1`,
          [this.LoadClass],
        );
      }

      for (const m of this.Pack.landingMeasures) {
        const provenance = {
          measureFlow: ['PSA', 'Cleanse', 'DetailDSO', 'Cube'],
          psaObjectKey: this.PSAObjectKey,
          loadHistoryId: this.LoadHistoryID,
          fromSysId: m.fromSysId,
          sourceUri: m.sourceUri,
          sourcePageUri: m.sourcePageUri || m.sourceUri,
          asOfDate: m.asOfDate,
          loadClass: this.LoadClass,
          note: m.note || '',
          packAttribution: this.Pack.attribution,
          peerMedian: m.peerMedian ?? null,
          coreSetAbbr: m.coreSetAbbr || null,
          periodId: m.periodId || null,
        };
        await this.client.query(
          `INSERT INTO bw_cube.cube_exec_landing
            (measure_id, display_value, numeric_value, unit, as_of_date, from_sys_id,
             load_class, load_history_id, provenance_json)
           VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9::jsonb)`,
          [
            m.measureId,
            m.displayValue,
            m.numericValue,
            m.unit,
            m.asOfDate,
            m.fromSysId,
            this.LoadClass,
            this.LoadHistoryID,
            JSON.stringify(provenance),
          ],
        );
        this.RowCount += 1;
      }

      const roomRows = buildRoomRows(this.Pack);
      for (const r of roomRows) {
        await this.client.query(
          `INSERT INTO bw_cube.cube_room_row
            (row_id, room_id, title, metric_key, metric_value, display_value, row_kind,
             dimensions_json, payload_json, from_sys_id, as_of_date, load_class, load_history_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::date,$12,$13)`,
          [
            r.row_id,
            r.room_id,
            r.title,
            r.metric_key,
            r.metric_value,
            r.display_value,
            r.row_kind,
            JSON.stringify(r.dimensions),
            JSON.stringify(r.payload),
            r.from_sys_id,
            r.as_of_date,
            this.LoadClass,
            this.LoadHistoryID,
          ],
        );
        this.RoomRowCount += 1;
      }

      await this.client.query(`DELETE FROM bw_ctl.gap_object`);
      for (const g of this.Pack.gaps) {
        await this.client.query(
          `INSERT INTO bw_ctl.gap_object
            (gap_id, title, need, rooms, finding_ids, paid_follow_on, load_history_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [g.gapId, g.title, g.need, g.rooms, g.findingIds, g.paidFollowOn, this.LoadHistoryID],
        );
        this.GapCount += 1;
      }

      await CompleteLoadHistory(this.client, this.LoadHistoryID, {
        status: 'SUCCEEDED',
        row_count: this.RowCount + this.RoomRowCount + this.GapCount,
        content_hash: this.ContentHash,
        as_of_date: this.Pack.asOfDate,
      });
      this.Status = 'SUCCEEDED';
    } catch (e) {
      this.Status = 'FAILED';
      this.ErrorMessage = e instanceof Error ? e.message : String(e);
      if (this.LoadHistoryID) {
        await CompleteLoadHistory(this.client, this.LoadHistoryID, {
          status: 'FAILED',
          notes: this.ErrorMessage,
        });
      }
    }
  }
}

