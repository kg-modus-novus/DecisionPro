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
import { RetrieveAndLoadKentuckyOperationalSources } from './molecules/RetrieveAndLoadKentuckyOperationalSources.js';
import { ExportKentuckyOperationalSourcesForUi } from './molecules/ExportKentuckyOperationalSourcesForUi.js';
import { RetrieveAndLoadFederalAwardGrain } from './molecules/RetrieveAndLoadFederalAwardGrain.js';
import { CheckFederalAwardGrainNumbers } from './molecules/CheckFederalAwardGrainNumbers.js';
import { ExportFederalAwardGrainForUi } from './molecules/ExportFederalAwardGrainForUi.js';
import { RetrieveAndLoadOrganizationCrosswalk } from './molecules/RetrieveAndLoadOrganizationCrosswalk.js';
import { CheckOrganizationCrosswalkNumbers } from './molecules/CheckOrganizationCrosswalkNumbers.js';
import { ExportOrganizationCrosswalkForUi } from './molecules/ExportOrganizationCrosswalkForUi.js';
import { RetrieveAndLoadNonprofitFinancials } from './molecules/RetrieveAndLoadNonprofitFinancials.js';
import { CheckNonprofitFinancialsNumbers } from './molecules/CheckNonprofitFinancialsNumbers.js';
import { ExportNonprofitFinancialsForUi } from './molecules/ExportNonprofitFinancialsForUi.js';
import { RetrieveAndLoadFacilityFinancialDistress } from './molecules/RetrieveAndLoadFacilityFinancialDistress.js';
import { CheckFacilityDistressNumbers } from './molecules/CheckFacilityDistressNumbers.js';
import { ExportFacilityDistressForUi } from './molecules/ExportFacilityDistressForUi.js';
import { RetrieveAndLoadOwnershipNetwork } from './molecules/RetrieveAndLoadOwnershipNetwork.js';
import { CheckOwnershipNetworkNumbers } from './molecules/CheckOwnershipNetworkNumbers.js';
import { ExportOwnershipNetworkForUi } from './molecules/ExportOwnershipNetworkForUi.js';
import { config } from './config.js';
import { ParseKentuckyEnrollmentFromPiCsv, SelectLatestEnrollment } from './atoms/ParsePiEnrollmentCsv.js';
import { readFixtureJson } from './molecules/SeedWarehouseCatalog.js';
import { ExtractDocumentLinks, ParseCsvRecords } from './adapters/operationalPublicSources.js';
import { RedactCredentialedUri } from './atoms/GovernedHttpClient.js';

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
    const ops = new RetrieveAndLoadKentuckyOperationalSources(c);
    await ops.Run();
    if (ops.Status !== 'SUCCEEDED') throw new Error(ops.ErrorMessage);
    const awardGrain = new RetrieveAndLoadFederalAwardGrain(c);
    await awardGrain.Run();
    if (awardGrain.Status !== 'SUCCEEDED') throw new Error(awardGrain.ErrorMessage);
    log(
      `real-etl OK enrollmentRows=${enr.RowCount} mcoRows=${mco.RowCount} hydrationMeasures=${hyd.RowCount} roomRows=${hyd.RoomRowCount} gaps=${hyd.GapCount} operationalSources=${ops.SourceCount} operationalRecords=${ops.RecordCount} operationalMetrics=${ops.MetricCount}`,
    );
    log(
      `ofr-01 award-grain OK states=${awardGrain.StateCount} awards=${awardGrain.AwardCount} metrics=${awardGrain.MetricCount} emptyCombinations=${awardGrain.EmptyCombinations.length}`,
    );

    const crosswalk = new RetrieveAndLoadOrganizationCrosswalk(c);
    await crosswalk.Run();
    if (crosswalk.Status !== 'SUCCEEDED') throw new Error(crosswalk.ErrorMessage);
    log(
      `ofr-02 crosswalk OK states=${crosswalk.StateCount} identityRecords=${crosswalk.IdentityRecordCount} exact=${crosswalk.ExactAssertionCount} inferred=${crosswalk.InferredAssertionCount} disagreements=${crosswalk.DisagreementCount} samAvailable=${crosswalk.SamKeyAvailable} gaps=${crosswalk.Gaps.length}`,
    );

    const nonprofit = new RetrieveAndLoadNonprofitFinancials(c);
    await nonprofit.Run();
    if (nonprofit.Status !== 'SUCCEEDED') throw new Error(nonprofit.ErrorMessage);
    log(
      `ofr-03 nonprofit-financials OK vintages=${nonprofit.VintageCount} filings=${nonprofit.FilingCount} metrics=${nonprofit.MetricCount}`,
    );

    const facilityDistress = new RetrieveAndLoadFacilityFinancialDistress(c);
    await facilityDistress.Run();
    if (facilityDistress.Status !== 'SUCCEEDED') throw new Error(facilityDistress.ErrorMessage);
    log(
      `ofr-04 facility-distress OK facilities=${facilityDistress.FacilityCount} metrics=${facilityDistress.MetricCount} counties=${facilityDistress.CountyCount}`,
    );

    const ownership = new RetrieveAndLoadOwnershipNetwork(c);
    await ownership.Run();
    if (ownership.Status !== 'SUCCEEDED') throw new Error(ownership.ErrorMessage);
    log(
      `ofr-05 ownership-network OK ownershipRows=${ownership.OwnershipRowCount} matchedFacilities=${ownership.MatchedFacilityCount} chains=${ownership.ChainCount} metrics=${ownership.MetricCount}`,
    );
  });
}

async function cmdOperationalEtl() {
  await cmdMigrate();
  await cmdSeed();
  await withClient(async (c) => {
    const ops = new RetrieveAndLoadKentuckyOperationalSources(c);
    await ops.Run();
    if (ops.Status !== 'SUCCEEDED') throw new Error(ops.ErrorMessage);
    const exp = new ExportKentuckyOperationalSourcesForUi(c);
    await exp.Run();
    if (exp.Status !== 'SUCCEEDED') throw new Error(exp.ErrorMessage);
    log(`operational-etl OK sources=${ops.SourceCount} records=${ops.RecordCount} metrics=${ops.MetricCount} export=${exp.ExportPath}`);
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

    const awardCheck = new CheckFederalAwardGrainNumbers(c);
    await awardCheck.Run();
    for (const r of awardCheck.Results) {
      log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    }
    if (awardCheck.Status !== 'SUCCEEDED') throw new Error(`OFR-01 award-grain reconciliation failed: ${awardCheck.ErrorMessage}`);

    const crosswalkCheck = new CheckOrganizationCrosswalkNumbers(c);
    await crosswalkCheck.Run();
    for (const r of crosswalkCheck.Results) {
      log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    }
    if (crosswalkCheck.Status !== 'SUCCEEDED') throw new Error(`OFR-02 crosswalk reconciliation failed: ${crosswalkCheck.ErrorMessage}`);

    const nonprofitCheck = new CheckNonprofitFinancialsNumbers(c);
    await nonprofitCheck.Run();
    for (const r of nonprofitCheck.Results) {
      log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    }
    if (nonprofitCheck.Status !== 'SUCCEEDED') throw new Error(`OFR-03 nonprofit financials reconciliation failed: ${nonprofitCheck.ErrorMessage}`);

    const facilityCheck = new CheckFacilityDistressNumbers(c);
    await facilityCheck.Run();
    for (const r of facilityCheck.Results) {
      log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    }
    if (facilityCheck.Status !== 'SUCCEEDED') throw new Error(`OFR-04 facility distress reconciliation failed: ${facilityCheck.ErrorMessage}`);

    const ownershipCheck = new CheckOwnershipNetworkNumbers(c);
    await ownershipCheck.Run();
    for (const r of ownershipCheck.Results) {
      log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    }
    if (ownershipCheck.Status !== 'SUCCEEDED') throw new Error(`OFR-05 ownership network reconciliation failed: ${ownershipCheck.ErrorMessage}`);

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

    const ops = new ExportKentuckyOperationalSourcesForUi(c);
    await ops.Run();
    if (ops.Status !== 'SUCCEEDED') throw new Error(ops.ErrorMessage);
    log(`export operational-sources OK sources=${ops.SourceCount} metrics=${ops.MetricCount} path=${ops.ExportPath}`);

    const awardExport = new ExportFederalAwardGrainForUi(c);
    await awardExport.Run();
    if (awardExport.Status !== 'SUCCEEDED') throw new Error(awardExport.ErrorMessage);
    log(`export federal-award-grain OK states=${awardExport.StateCount} reconciliation=${awardExport.ReconciliationStatus} path=${awardExport.ExportPath}`);

    const crosswalkExport = new ExportOrganizationCrosswalkForUi(c);
    await crosswalkExport.Run();
    if (crosswalkExport.Status !== 'SUCCEEDED') throw new Error(crosswalkExport.ErrorMessage);
    log(`export organization-crosswalk OK states=${crosswalkExport.StateCount} reconciliation=${crosswalkExport.ReconciliationStatus} path=${crosswalkExport.ExportPath}`);

    const nonprofitExport = new ExportNonprofitFinancialsForUi(c);
    await nonprofitExport.Run();
    if (nonprofitExport.Status !== 'SUCCEEDED') throw new Error(nonprofitExport.ErrorMessage);
    log(`export nonprofit-financials OK states=${nonprofitExport.StateCount} reconciliation=${nonprofitExport.ReconciliationStatus} path=${nonprofitExport.ExportPath}`);

    const facilityExport = new ExportFacilityDistressForUi(c);
    await facilityExport.Run();
    if (facilityExport.Status !== 'SUCCEEDED') throw new Error(facilityExport.ErrorMessage);
    log(`export facility-distress OK states=${facilityExport.StateCount} reconciliation=${facilityExport.ReconciliationStatus} path=${facilityExport.ExportPath}`);

    const ownershipExport = new ExportOwnershipNetworkForUi(c);
    await ownershipExport.Run();
    if (ownershipExport.Status !== 'SUCCEEDED') throw new Error(ownershipExport.ErrorMessage);
    log(`export ownership-network OK states=${ownershipExport.StateCount} reconciliation=${ownershipExport.ReconciliationStatus} path=${ownershipExport.ExportPath}`);
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
  const csv = ParseCsvRecords('name,state\n"Doe, Jane",KY\n');
  if (csv[0]?.name !== 'Doe, Jane' || csv[0]?.state !== 'KY') throw new Error('public CSV parser failed');
  const links = ExtractDocumentLinks('<a href="/docs/a.pdf"><span>Budget</span> Book</a>', 'https://example.gov/publications/');
  if (links[0]?.uri !== 'https://example.gov/docs/a.pdf' || links[0]?.title !== 'Budget Book') {
    throw new Error('public document-link parser failed');
  }
  // Credential-redaction: a key-bearing URL (e.g. SAM.gov's api_key param)
  // must never survive into an error message, Gap reason, or log line.
  // Regression test for a real incident (2026-08-31) where an unredacted
  // GovernedHttpClient error embedded the SAM.gov key in a Gap reason.
  const FAKE_KEY = 'SAM-00000000-0000-0000-0000-000000000000';
  const redactedUrl = RedactCredentialedUri(`https://api.sam.gov/entity-information/v3/entities?ueiSAM=ABC123&api_key=${FAKE_KEY}`);
  if (redactedUrl.includes(FAKE_KEY) || !redactedUrl.includes('api_key=REDACTED')) {
    throw new Error('credential redaction failed on a full URL');
  }
  const redactedEmbedded = RedactCredentialedUri(`Governed fetch failed for https://api.sam.gov/x?api_key=${FAKE_KEY}: HTTP 429`);
  if (redactedEmbedded.includes(FAKE_KEY)) {
    throw new Error('credential redaction failed on a URL embedded in error text');
  }
  log('test-offline OK (parsers + fixture + credential redaction)');
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
    'operational-etl': cmdOperationalEtl,
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
