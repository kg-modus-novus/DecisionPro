import { withClient, migrate, closePool, getPool } from './db/pool.js';
import { SeedWarehouseCatalog } from './molecules/SeedWarehouseCatalog.js';
import { RetrieveAndLoadEnrollment, RetrieveAndLoadMcoRoster } from './molecules/RetrieveAndLoad.js';
import { RetrieveAndLoadPublicHydration } from './molecules/RetrieveAndLoadPublicHydration.js';
import { PurgeTestLoads, VerifyWarehouseEmptyOfTest } from './molecules/PurgeAndVerify.js';
import { CheckAccurateLandingNumbers } from './molecules/CheckAccurateLandingNumbers.js';
import { ExportAccurateLandingForUi } from './molecules/ExportAccurateLandingForUi.js';
import { ExportHydrationBundles } from './molecules/ExportHydrationBundles.js';
import { ExportDataSpectrumForUi } from './molecules/ExportDataSpectrumForUi.js';
import { ExportSourceReconciliationForUi } from './molecules/ExportSourceReconciliationForUi.js';
import { ExportUriResolutionLog } from './molecules/ExportUriResolutionLog.js';
import { config } from './config.js';
import { ParseKentuckyEnrollmentFromPiCsv, SelectLatestEnrollment } from './atoms/ParsePiEnrollmentCsv.js';
import { readFixtureJson } from './molecules/SeedWarehouseCatalog.js';

function log(msg: string) {
  console.log(`[xenodroid-bw] ${msg}`);
}

async function cmdMigrate() {
  await migrate();
  log('migrate OK');
}

async function cmdSeed() {
  await withClient(async (c) => {
    const m = new SeedWarehouseCatalog(c);
    await m.Run();
    if (m.Status !== 'SUCCEEDED') throw new Error(m.ErrorMessage);
    log(`seed OK sources=${m.SourceCount} measures=${m.MeasureCount} requests=${m.DataRequestCount}`);
  });
}

async function cmdTestLoad() {
  await withClient(async (c) => {
    const enr = new RetrieveAndLoadEnrollment(c);
    enr.DataRequestID = 'DR-TEST-ENROLLMENT';
    enr.FromSysID = 'TEST_FIXTURE_PACK';
    enr.LoadClass = 'TEST';
    await enr.Run();
    if (enr.Status !== 'SUCCEEDED') throw new Error(enr.ErrorMessage);

    const mco = new RetrieveAndLoadMcoRoster(c);
    mco.DataRequestID = 'DR-TEST-MCO';
    mco.FromSysID = 'TEST_FIXTURE_PACK';
    mco.LoadClass = 'TEST';
    mco.FixtureName = 'testMcoRoster.json';
    await mco.Run();
    if (mco.Status !== 'SUCCEEDED') throw new Error(mco.ErrorMessage);
    log(`test-load OK enrollmentRows=${enr.RowCount} mcoRows=${mco.RowCount}`);
  });
}

async function cmdPurge() {
  await withClient(async (c) => {
    const p = new PurgeTestLoads(c);
    await p.Run();
    if (p.Status !== 'SUCCEEDED') throw new Error(p.ErrorMessage);
    log(
      `purge OK cube=${p.DeletedCubeRows} enr=${p.DeletedEnrollmentRows} mco=${p.DeletedMcoRows} psaMeta=${p.DeletedPsaMetaRows}`,
    );
  });
}

async function cmdEmptyCheck() {
  await withClient(async (c) => {
    const v = new VerifyWarehouseEmptyOfTest(c);
    await v.Run();
    if (v.Status !== 'SUCCEEDED') throw new Error(v.ErrorMessage);
    log('empty-check OK — no TEST facts remain');
  });
}

async function cmdRealEtl() {
  await withClient(async (c) => {
    const enr = new RetrieveAndLoadEnrollment(c);
    enr.DataRequestID = 'DR-REAL-PI-ENROLLMENT';
    enr.FromSysID = 'CMS_DATA_MEDICAID_ENR';
    enr.LoadClass = 'REAL';
    enr.SourceURI = config.piDatasetCsvUrl;
    await enr.Run();
    if (enr.Status !== 'SUCCEEDED') throw new Error(enr.ErrorMessage);

    const mco = new RetrieveAndLoadMcoRoster(c);
    mco.DataRequestID = 'DR-REAL-MCO-ROSTER';
    mco.FromSysID = 'KY_DMS_MCO_CONTRACTS';
    mco.LoadClass = 'REAL';
    mco.FixtureName = 'realMcoRosterCurated.json';
    await mco.Run();
    if (mco.Status !== 'SUCCEEDED') throw new Error(mco.ErrorMessage);

    const hyd = new RetrieveAndLoadPublicHydration(c);
    await hyd.Run();
    if (hyd.Status !== 'SUCCEEDED') throw new Error(hyd.ErrorMessage);
    log(
      `real-etl OK enrollmentRows=${enr.RowCount} mcoRows=${mco.RowCount} hydrationMeasures=${hyd.RowCount} roomRows=${hyd.RoomRowCount} gaps=${hyd.GapCount}`,
    );
  });
}

async function cmdAccuracy() {
  await withClient(async (c) => {
    const a = new CheckAccurateLandingNumbers(c);
    await a.Run();
    for (const r of a.Results) {
      log(`accuracy ${r.measure_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    }
    const recon = new ExportSourceReconciliationForUi(c);
    await recon.WriteFromCheck(a, 'accuracy-check');
    if (recon.Status !== 'SUCCEEDED') throw new Error(recon.ErrorMessage);
    log(`source-reconciliation export OK checks=${recon.CheckCount} path=${recon.ExportPath}`);
    if (a.Status !== 'SUCCEEDED') throw new Error(a.ErrorMessage);
    log('accuracy-check OK');
  });
}

async function cmdExport() {
  await withClient(async (c) => {
    const e = new ExportAccurateLandingForUi(c);
    await e.Run();
    if (e.Status !== 'SUCCEEDED') throw new Error(e.ErrorMessage);
    log(`export OK measures=${e.MeasureCount} path=${e.ExportPath}`);

    const h = new ExportHydrationBundles(c);
    await h.Run();
    if (h.Status !== 'SUCCEEDED') throw new Error(h.ErrorMessage);
    log(`export hydration OK files=${h.FilesWritten.join(',')}`);

    const spectrum = new ExportDataSpectrumForUi(c);
    await spectrum.Run();
    if (spectrum.Status !== 'SUCCEEDED') throw new Error(spectrum.ErrorMessage);
    log(`export data-spectrum OK rows=${spectrum.RowCount} path=${spectrum.ExportPath}`);

    const recon = new ExportSourceReconciliationForUi(c);
    await recon.Run('export-ui');
    if (recon.Status !== 'SUCCEEDED') throw new Error(recon.ErrorMessage);
    log(
      `export source-reconciliation OK checks=${recon.CheckCount} status=${recon.ReconciliationStatus} path=${recon.ExportPath}`,
    );
  });

  const uriLog = new ExportUriResolutionLog();
  await uriLog.Run();
  if (uriLog.Status !== 'SUCCEEDED') throw new Error(uriLog.ErrorMessage);
  log(
    `export uri-resolution alerts OK total=${uriLog.AlertCount} errors=${uriLog.ErrorCount} warnings=${uriLog.WarningCount}`,
  );
}

async function cmdTestOffline() {
  const fixture = await readFixtureJson<{ total_enrollment: number }>('testEnrollment.json');
  if (fixture.total_enrollment !== 1490000) throw new Error('test fixture enrollment mismatch');

  const sample =
    'State Abbreviation,State Name,Reporting Period,Total Medicaid and CHIP Enrollment,Total Medicaid Enrollment,Total CHIP Enrollment\n' +
    'KY,Kentucky,202401,100,90,10\n' +
    'KY,Kentucky,202501,110,95,15\n';
  const parsed = ParseKentuckyEnrollmentFromPiCsv(sample);
  const latest = SelectLatestEnrollment(parsed);
  if (!latest || latest.total_enrollment !== 110) throw new Error('parser latest failed');
  log('test-offline OK (parser + fixture)');
}

/** Thorough tests: offline assertions + DB TEST load path when Postgres is up. */
async function cmdTest() {
  await cmdTestOffline();
  try {
    await getPool().query('SELECT 1');
  } catch {
    log('Postgres not reachable — skipped DB TEST→purge assertions');
    return;
  }

  await cmdMigrate();
  await cmdSeed();
  await cmdTestLoad();
  await withClient(async (c) => {
    const r = await c.query(
      `SELECT COUNT(*)::int AS c FROM bw_cube.cube_exec_landing WHERE load_class='TEST' AND measure_id='M-001'`,
    );
    if (r.rows[0].c < 1) throw new Error('expected TEST cube M-001');
    const tos = await c.query(
      `SELECT tos_grade FROM bw_ctl.source_system WHERE from_sys_id='CMS_DATA_MEDICAID_ENR'`,
    );
    if (tos.rows[0]?.tos_grade !== 'SAFE') throw new Error('expected SAFE grade for CMS enrollment');
  });
  await cmdPurge();
  await cmdEmptyCheck();
  log('test OK (including DB TEST→purge→empty)');
}

async function cmdGate() {
  log('=== GATE: migrate → seed → test-load → assert → purge → empty → real-etl → accuracy → export ===');
  await cmdMigrate();
  await cmdSeed();
  await cmdTestOffline();
  await cmdTestLoad();
  await withClient(async (c) => {
    const r = await c.query(
      `SELECT COUNT(*)::int AS c FROM bw_cube.cube_exec_landing WHERE load_class='TEST'`,
    );
    if (r.rows[0].c < 1) throw new Error('gate: expected TEST cube rows after test-load');
  });
  await cmdPurge();
  await cmdEmptyCheck();
  await cmdRealEtl();
  await cmdAccuracy();
  await cmdExport();
  log('=== GATE PASSED ===');
}

async function cmdAdminApi() {
  const { runAdminApiMain } = await import('./admin-api/server.js');
  await runAdminApiMain();
}

async function main() {
  const cmd = process.argv[2] || 'gate';
  if (cmd === 'admin-api') {
    await cmdAdminApi();
    return;
  }
  const map: Record<string, () => Promise<void>> = {
    migrate: cmdMigrate,
    seed: cmdSeed,
    'test-load': cmdTestLoad,
    test: cmdTest,
    'purge-test': cmdPurge,
    'empty-check': cmdEmptyCheck,
    'real-etl': cmdRealEtl,
    'accuracy-check': cmdAccuracy,
    'export-ui': cmdExport,
    gate: cmdGate,
    'admin-api': cmdAdminApi,
  };
  const fn = map[cmd];
  if (!fn) {
    console.error(`Unknown command ${cmd}. Commands: ${Object.keys(map).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  try {
    await fn();
  } finally {
    await closePool();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  closePool().finally(() => process.exit(1));
});
