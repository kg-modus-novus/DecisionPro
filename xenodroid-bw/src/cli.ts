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
import { RetrieveAndLoadSubawardFlowGraph } from './molecules/RetrieveAndLoadSubawardFlowGraph.js';
import { CheckSubawardFlowGraphNumbers } from './molecules/CheckSubawardFlowGraphNumbers.js';
import { ExportSubawardFlowGraphForUi } from './molecules/ExportSubawardFlowGraphForUi.js';
import { RetrieveAndLoadProgramHorizonEvents } from './molecules/RetrieveAndLoadProgramHorizonEvents.js';
import { CheckProgramHorizonEventsNumbers } from './molecules/CheckProgramHorizonEventsNumbers.js';
import { ExportProgramHorizonEventsForUi } from './molecules/ExportProgramHorizonEventsForUi.js';
import { LoadFundingRunwayGovernance } from './molecules/LoadFundingRunwayGovernance.js';
import { ExportMcparPlanPeriodForUi } from './molecules/ExportMcparPlanPeriodForUi.js';
import { RetrieveAndLoadProviderFacilities } from './molecules/RetrieveAndLoadProviderFacilities.js';
import { ResolveSamEntities } from './molecules/ResolveSamEntities.js';
import { ExportContractSectionIndexForUi, IndexContractSections } from './molecules/IndexContractSections.js';
import { RunChainLabelAtomTests } from './atoms/ChainLabelAtoms.test.js';
import { BuildCountyAccessContext, ExportCountyAccessContextForUi } from './molecules/BuildCountyAccessContext.js';
import fsPromises from 'node:fs/promises';
import nodePath from 'node:path';
import { AssessFundingRunwayContinuation } from './molecules/AssessFundingRunwayContinuation.js';
import { ParseUsaSpendingTransaction, RetrieveAwardContinuationEvidence } from './molecules/RetrieveAwardContinuationEvidence.js';
import { config, REPO_ROOT } from './config.js';
import { ParseKentuckyEnrollmentFromPiCsv, SelectLatestEnrollment } from './atoms/ParsePiEnrollmentCsv.js';
import { readFixtureJson } from './molecules/SeedWarehouseCatalog.js';
import { ExtractDocumentLinks, ParseCsvRecords } from './adapters/operationalPublicSources.js';
import { RedactCredentialedUri } from './atoms/GovernedHttpClient.js';
import { AssessPotentialFundingGap, EstimatedRunoutDate, ResolveContinuationDispositionFromEvidence } from './atoms/FundingRunwayGovernanceAtoms.js';
import { ResolveOrganizationDisplayLabel, SourceIdentityId } from './atoms/OrganizationDisplayLabelAtoms.js';

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

    const subaward = new RetrieveAndLoadSubawardFlowGraph(c);
    await subaward.Run();
    if (subaward.Status !== 'SUCCEEDED') throw new Error(subaward.ErrorMessage);
    log(
      `ofr-06 subaward-flow-graph OK primeAwardsQueried=${subaward.PrimeAwardsQueried} subawards=${subaward.SubawardCount} edges=${subaward.EdgeCount} resolvedEdges=${subaward.ResolvedEdgeCount} metrics=${subaward.MetricCount}`,
    );

    const horizon = new RetrieveAndLoadProgramHorizonEvents(c);
    await horizon.Run();
    if (horizon.Status !== 'SUCCEEDED') throw new Error(horizon.ErrorMessage);
    log(
      `ofr-07 program-horizon-events OK waiverPagesFetched=${horizon.WaiverPagesFetched} waiverEvents=${horizon.WaiverEventCount} nofoQueriesRun=${horizon.NofoQueriesRun} nofoEvents=${horizon.NofoEventCount} metrics=${horizon.MetricCount}`,
    );

    const continuationEvidence = new RetrieveAwardContinuationEvidence(c);
    await continuationEvidence.Run();
    if (continuationEvidence.Status !== 'SUCCEEDED') throw new Error(continuationEvidence.ErrorMessage);
    log(`fri release-b source plane OK awards=${continuationEvidence.AwardCount} pages=${continuationEvidence.PageCount} evidence=${continuationEvidence.EvidenceCount} gaps=${continuationEvidence.GapCount} normalizedAssessments=incomplete`);

    const runwayGovernance = new LoadFundingRunwayGovernance(c);
    await runwayGovernance.Run();
    if (runwayGovernance.Status !== 'SUCCEEDED') throw new Error(runwayGovernance.ErrorMessage);
    log(`fri release-a OK labels=${runwayGovernance.LabelCount} assessments=${runwayGovernance.AssessmentCount} releasesBAndC=incomplete`);

    const continuationAssessment = new AssessFundingRunwayContinuation(c);
    await continuationAssessment.Run();
    if (continuationAssessment.Status !== 'SUCCEEDED') throw new Error(continuationAssessment.ErrorMessage);
    log(`fri release-b assessments OK reconciled=${continuationAssessment.ReconciledSearchCount} assessments=${continuationAssessment.AssessmentCount}`);
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

    const subawardCheck = new CheckSubawardFlowGraphNumbers(c);
    await subawardCheck.Run();
    for (const r of subawardCheck.Results) {
      log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    }
    if (subawardCheck.Status !== 'SUCCEEDED') throw new Error(`OFR-06 subaward flow graph reconciliation failed: ${subawardCheck.ErrorMessage}`);

    const horizonCheck = new CheckProgramHorizonEventsNumbers(c);
    await horizonCheck.Run();
    for (const r of horizonCheck.Results) {
      log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    }
    if (horizonCheck.Status !== 'SUCCEEDED') throw new Error(`OFR-07 program horizon events reconciliation failed: ${horizonCheck.ErrorMessage}`);

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

    const subawardExport = new ExportSubawardFlowGraphForUi(c);
    await subawardExport.Run();
    if (subawardExport.Status !== 'SUCCEEDED') throw new Error(subawardExport.ErrorMessage);
    log(`export subaward-flow-graph OK states=${subawardExport.StateCount} reconciliation=${subawardExport.ReconciliationStatus} path=${subawardExport.ExportPath}`);

    const horizonExport = new ExportProgramHorizonEventsForUi(c);
    await horizonExport.Run();
    if (horizonExport.Status !== 'SUCCEEDED') throw new Error(horizonExport.ErrorMessage);
    log(`export program-horizon-events OK states=${horizonExport.StateCount} reconciliation=${horizonExport.ReconciliationStatus} path=${horizonExport.ExportPath}`);
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
  const sourceIdentity = SourceIdentityId({ awardKey: 'A-1', recipientUei: 'UEI-1' });
  const reviewedLabel = ResolveOrganizationDisplayLabel('HEALTH SERVICES KENTUCKY CABINET FOR', sourceIdentity);
  if (reviewedLabel.displayText !== 'Kentucky Cabinet for Health and Family Services' || reviewedLabel.rawText !== 'HEALTH SERVICES KENTUCKY CABINET FOR') {
    throw new Error('governed organization display label failed');
  }
  const incompleteGap = AssessPotentialFundingGap({
    daysRemaining: 30, continuationStatus: 'not_assessed', dependencyStatus: 'not_assessed',
    replacementStatus: 'not_assessed', serviceImpactStatus: 'not_assessed',
    publicSearchReconciled: false, evidenceFresh: false,
  });
  if (incompleteGap.status !== 'not_assessable' || incompleteGap.missingInputs.length < 1) {
    throw new Error('incomplete evidence must remain not assessable');
  }
  const potentialGap = AssessPotentialFundingGap({
    daysRemaining: 30, continuationStatus: 'no_public_continuation_found', dependencyStatus: 'recipient_confirmed',
    replacementStatus: 'none_publicly_identified', serviceImpactStatus: 'documented',
    publicSearchReconciled: true, evidenceFresh: true,
  });
  if (potentialGap.status !== 'potential_gap') throw new Error('complete FRI-GAP-v1 predicates should produce potential gap');
  const parsedTransaction = ParseUsaSpendingTransaction({
    id: 'TX-1', action_date: '2026-08-01', action_type: 'A', action_type_description: 'New award',
    description: 'Published transaction', federal_action_obligation: '2500', modification_number: '000',
  });
  if (!parsedTransaction || parsedTransaction.federal_action_obligation !== 2500) throw new Error('USAspending transaction parser failed');
  if (ParseUsaSpendingTransaction({ id: '', action_date: 'not-a-date' })) throw new Error('invalid USAspending transaction was accepted');
  if (EstimatedRunoutDate('2026-09-01', 1000, 100) !== '2026-09-11') throw new Error('estimated runout date failed');
  const reconciledContinuation = ResolveContinuationDispositionFromEvidence({
    publicSearchReconciled: true, evidenceFresh: true, evidenceIds: ['FRI-TXN-1'], evidenceTypes: ['award-transaction'],
  });
  if (reconciledContinuation.status !== 'no_public_continuation_found') {
    throw new Error('reconciled transaction-only evidence must not claim continuation');
  }
  log('test-offline OK (parsers + fixture + credential redaction + funding runway governance)');
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

async function cmdFundingRunwayReleaseA() {
  await cmdMigrate();
  await withClient(async (c) => {
    const runwayGovernance = new LoadFundingRunwayGovernance(c);
    await runwayGovernance.Run();
    if (runwayGovernance.Status !== 'SUCCEEDED') throw new Error(runwayGovernance.ErrorMessage);
    const awardExport = new ExportFederalAwardGrainForUi(c);
    await awardExport.Run();
    if (awardExport.Status !== 'SUCCEEDED') throw new Error(awardExport.ErrorMessage);
    log(`fri release-a refresh OK labels=${runwayGovernance.LabelCount} assessments=${runwayGovernance.AssessmentCount} export=${awardExport.ExportPath} releasesBAndC=incomplete`);
  });
}

async function cmdFundingRunwayAssessExport() {
  await cmdMigrate();
  await withClient(async (c) => {
    const continuationAssessment = new AssessFundingRunwayContinuation(c);
    await continuationAssessment.Run();
    if (continuationAssessment.Status !== 'SUCCEEDED') throw new Error(continuationAssessment.ErrorMessage);
    const awardExport = new ExportFederalAwardGrainForUi(c);
    await awardExport.Run();
    if (awardExport.Status !== 'SUCCEEDED') throw new Error(awardExport.ErrorMessage);
    log(`fri assess+export OK reconciled=${continuationAssessment.ReconciledSearchCount} assessments=${continuationAssessment.AssessmentCount} export=${awardExport.ExportPath}`);
  });
}

async function cmdFundingRunwayPublicEvidence() {
  await cmdMigrate();
  await withClient(async (c) => {
    const evidence = new RetrieveAwardContinuationEvidence(c);
    await evidence.Run();
    if (evidence.Status !== 'SUCCEEDED') throw new Error(evidence.ErrorMessage);
    const runwayGovernance = new LoadFundingRunwayGovernance(c);
    await runwayGovernance.Run();
    if (runwayGovernance.Status !== 'SUCCEEDED') throw new Error(runwayGovernance.ErrorMessage);
    const continuationAssessment = new AssessFundingRunwayContinuation(c);
    await continuationAssessment.Run();
    if (continuationAssessment.Status !== 'SUCCEEDED') throw new Error(continuationAssessment.ErrorMessage);
    const awardExport = new ExportFederalAwardGrainForUi(c);
    await awardExport.Run();
    if (awardExport.Status !== 'SUCCEEDED') throw new Error(awardExport.ErrorMessage);
    log(`fri public-evidence refresh OK awards=${evidence.AwardCount} pages=${evidence.PageCount} observations=${evidence.EvidenceCount} gaps=${evidence.GapCount} reconciled=${continuationAssessment.ReconciledSearchCount} assessments=${continuationAssessment.AssessmentCount}`);
  });
}

async function cmdRefreshFacilityOwnership() {
  await migrate();
  await withClient(async (c) => {
    const facility = new RetrieveAndLoadFacilityFinancialDistress(c);
    await facility.Run();
    if (facility.Status !== 'SUCCEEDED') throw new Error(facility.ErrorMessage);
    const facilityCheck = new CheckFacilityDistressNumbers(c);
    await facilityCheck.Run();
    if (facilityCheck.Status !== 'SUCCEEDED') throw new Error(facilityCheck.ErrorMessage);
    const ownership = new RetrieveAndLoadOwnershipNetwork(c);
    await ownership.Run();
    if (ownership.Status !== 'SUCCEEDED') throw new Error(ownership.ErrorMessage);
    const ownershipCheck = new CheckOwnershipNetworkNumbers(c);
    await ownershipCheck.Run();
    if (ownershipCheck.Status !== 'SUCCEEDED') throw new Error(ownershipCheck.ErrorMessage);
    const facilityExport = new ExportFacilityDistressForUi(c);
    await facilityExport.Run();
    if (facilityExport.Status !== 'SUCCEEDED') throw new Error(facilityExport.ErrorMessage);
    const ownershipExport = new ExportOwnershipNetworkForUi(c);
    await ownershipExport.Run();
    if (ownershipExport.Status !== 'SUCCEEDED') throw new Error(ownershipExport.ErrorMessage);
    log(`ofr facility/ownership refresh OK facilities=${facility.FacilityCount} chains=${ownership.ChainCount} facilityExport=${facilityExport.ExportPath} ownershipExport=${ownershipExport.ExportPath}`);
  });
}

async function cmdRefreshOwnershipOnly() {
  await migrate();
  await withClient(async (c) => {
    const ownership = new RetrieveAndLoadOwnershipNetwork(c);
    await ownership.Run();
    if (ownership.Status !== 'SUCCEEDED') throw new Error(ownership.ErrorMessage);
    const ownershipCheck = new CheckOwnershipNetworkNumbers(c);
    await ownershipCheck.Run();
    if (ownershipCheck.Status !== 'SUCCEEDED') throw new Error(ownershipCheck.ErrorMessage);
    const ownershipExport = new ExportOwnershipNetworkForUi(c);
    await ownershipExport.Run();
    if (ownershipExport.Status !== 'SUCCEEDED') throw new Error(ownershipExport.ErrorMessage);
    log(`ofr ownership refresh OK chains=${ownership.ChainCount} ownershipExport=${ownershipExport.ExportPath}`);
  });
}

async function cmdReplayOwnership() {
  const hospitalPath = process.argv[3];
  const snfPath = process.argv[4];
  if (!hospitalPath || !snfPath) throw new Error('ofr-ownership-replay requires hospital and SNF governed PSA paths');
  await migrate();
  await withClient(async (c) => {
    const ownership = new RetrieveAndLoadOwnershipNetwork(c);
    await ownership.Run({ hospital: hospitalPath, snf: snfPath });
    if (ownership.Status !== 'SUCCEEDED') throw new Error(ownership.ErrorMessage);
    const ownershipCheck = new CheckOwnershipNetworkNumbers(c);
    await ownershipCheck.Run();
    if (ownershipCheck.Status !== 'SUCCEEDED') throw new Error(ownershipCheck.ErrorMessage);
    const ownershipExport = new ExportOwnershipNetworkForUi(c);
    await ownershipExport.Run();
    if (ownershipExport.Status !== 'SUCCEEDED') throw new Error(ownershipExport.ErrorMessage);
    log(`ofr ownership PSA replay OK chains=${ownership.ChainCount} ownershipExport=${ownershipExport.ExportPath}`);
  });
}

/**
 * Depot inference exports (2026-09-02): re-run Release A label backfill (so
 * the reviewed Florida agency aliases land), then regenerate the OFR bundles
 * whose caps were lifted or join keys added, plus the new MCPAR plan-period
 * accountability record. No source is re-fetched; every export reads the
 * warehouse or the byte-faithful PSA file already on disk.
 */
async function cmdOfrDepotExport() {
  await migrate();
  await withClient(async (c) => {
    const runwayGovernance = new LoadFundingRunwayGovernance(c);
    await runwayGovernance.Run();
    if (runwayGovernance.Status !== 'SUCCEEDED') throw new Error(runwayGovernance.ErrorMessage);
    log(`depot release-a labels OK labels=${runwayGovernance.LabelCount} assessments=${runwayGovernance.AssessmentCount}`);
    // Release A writes default assessments; re-derive continuation status
    // from the retained public evidence so the label refresh never regresses
    // an award from no_public_continuation_found back to not_assessed.
    const continuationAssessment = new AssessFundingRunwayContinuation(c);
    await continuationAssessment.Run();
    if (continuationAssessment.Status !== 'SUCCEEDED') throw new Error(continuationAssessment.ErrorMessage);
    log(`depot continuation assessment OK reconciled=${continuationAssessment.ReconciledSearchCount} assessments=${continuationAssessment.AssessmentCount}`);

    const steps: Array<[string, { Run(): Promise<void>; Status: string; ErrorMessage: string; ExportPath: string; ReconciliationStatus?: string }]> = [
      ['federal-award-grain', new ExportFederalAwardGrainForUi(c)],
      ['nonprofit-financials', new ExportNonprofitFinancialsForUi(c)],
      ['facility-distress', new ExportFacilityDistressForUi(c)],
      ['subaward-flow-graph', new ExportSubawardFlowGraphForUi(c)],
      ['program-horizon-events', new ExportProgramHorizonEventsForUi(c)],
      ['ownership-network', new ExportOwnershipNetworkForUi(c)],
      ['organization-crosswalk', new ExportOrganizationCrosswalkForUi(c)],
    ];
    for (const [name, exporter] of steps) {
      await exporter.Run();
      if (exporter.Status !== 'SUCCEEDED') throw new Error(`${name}: ${exporter.ErrorMessage}`);
      log(`depot export ${name} OK reconciliation=${exporter.ReconciliationStatus ?? 'n/a'} path=${exporter.ExportPath}`);
    }

    const mcpar = new ExportMcparPlanPeriodForUi(c);
    await mcpar.Run();
    if (mcpar.Status !== 'SUCCEEDED') throw new Error(`mcpar-plan-period: ${mcpar.ErrorMessage}`);
    for (const r of mcpar.Checks) log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    log(`depot export mcpar-plan-period OK states=${mcpar.StateCount} plans=${mcpar.PlanCount} sanctions=${mcpar.SanctionCount} reconciliation=${mcpar.ReconciliationStatus} path=${mcpar.ExportPath}`);
    if (mcpar.ReconciliationStatus !== 'PASS') throw new Error('mcpar-plan-period reconciliation FAILED — see accuracy lines above');

    const county = new ExportCountyAccessContextForUi(c);
    await county.Run();
    if (county.Status !== 'SUCCEEDED') throw new Error(`county-access-context export: ${county.ErrorMessage}`);
    log(`depot export county-access-context OK counties=${county.CountyCount} path=${county.ExportPath}`);
  });
}

/** CMS Care Compare nursing-facility slice for both OFR states (gap closure 2026-09-02). */
async function cmdProviderFacilities() {
  await migrate();
  const states = (process.argv[3] ? [process.argv[3].toUpperCase()] : [...config.ofrStates]);
  await withClient(async (c) => {
    for (const state of states) {
      const loader = new RetrieveAndLoadProviderFacilities(c, state);
      await loader.Run();
      if (loader.Status !== 'SUCCEEDED') throw new Error(`provider-facilities ${state}: ${loader.ErrorMessage}`);
      log(`provider-facilities ${state} OK rows=${loader.RowCount} cmsChains=${loader.ChainCount} withheldLabels=${loader.WithheldLabelCount}`);
    }
  });
}

/**
 * Loads the Director-provisioned SAM.gov key from the runtime environment or
 * its provided file (sibling of the repo, outside git) — into process.env
 * only, never logged, printed, or exported.
 */
async function loadSamKeyIntoEnv() {
  if (process.env.SAM_GOV_API_KEY) return 'env';
  const candidate = process.env.SAM_GOV_API_KEY_FILE || nodePath.join(REPO_ROOT, '..', 'SAM.gov API Key Expires 11-30-2026.txt');
  try {
    const text = (await fsPromises.readFile(candidate, 'utf8')).trim();
    if (text) { process.env.SAM_GOV_API_KEY = text; return 'file'; }
  } catch { /* absent */ }
  return 'absent';
}

/** Persisted, resumable SAM.gov UEI resolution (gap closure 2026-09-02). */
async function cmdSamResolve() {
  await migrate();
  const keySource = await loadSamKeyIntoEnv();
  log(`sam-resolve key source=${keySource}`);
  await withClient(async (c) => {
    const resolver = new ResolveSamEntities(c);
    await resolver.Run();
    if (resolver.Status !== 'SUCCEEDED') throw new Error(`sam-resolve: ${resolver.ErrorMessage}`);
    log(`sam-resolve OK candidates=${resolver.Candidates} attempted=${resolver.Attempted} resolved=${resolver.Resolved} notFound=${resolver.NotFound} rateLimited=${resolver.RateLimited} failed=${resolver.Failed} disagreements=${resolver.DisagreementsWritten}${resolver.StoppedReason ? ` stopped=${resolver.StoppedReason}` : ''}`);
    const crosswalkExport = new ExportOrganizationCrosswalkForUi(c);
    await crosswalkExport.Run();
    if (crosswalkExport.Status !== 'SUCCEEDED') throw new Error(crosswalkExport.ErrorMessage);
    log(`export organization-crosswalk OK reconciliation=${crosswalkExport.ReconciliationStatus} path=${crosswalkExport.ExportPath}`);
  });
}

/** Kentucky MCO contract section index from retained PSA PDFs (gap closure 2026-09-02). */
async function cmdContractIndex() {
  RunChainLabelAtomTests();
  await migrate();
  await withClient(async (c) => {
    const index = new IndexContractSections(c);
    await index.Run();
    if (index.Status !== 'SUCCEEDED') throw new Error(`contract-index: ${index.ErrorMessage}`);
    for (const d of index.Documents) log(`contract-index ${d.plan}: ${d.file ?? 'no document'} pages=${d.pages} sections=${d.sections}${d.gap ? ` gap="${d.gap}"` : ''}`);
    const exporter = new ExportContractSectionIndexForUi(index);
    await exporter.Run();
    if (exporter.Status !== 'SUCCEEDED') throw new Error(exporter.ErrorMessage);
    log(`export contract-section-index OK sections=${exporter.SectionCount} path=${exporter.ExportPath}`);
  });
}

/** County access denominators: members/eligibles, HPSA, SNF beds, HCRIS rollup (follow-on 2026-09-02). */
async function cmdCountyAccessContext() {
  await migrate();
  await withClient(async (c) => {
    const build = new BuildCountyAccessContext(c);
    await build.Run();
    for (const r of build.Checks) log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    if (build.Status !== 'SUCCEEDED') throw new Error(`county-access-context: ${build.ErrorMessage}`);
    const exporter = new ExportCountyAccessContextForUi(c, build.Checks, build.Notes);
    await exporter.Run();
    if (exporter.Status !== 'SUCCEEDED') throw new Error(exporter.ErrorMessage);
    log(`export county-access-context OK counties=${exporter.CountyCount} path=${exporter.ExportPath}`);
  });
}

/** Re-fetch the OFR-01 award grain (now with the published award type), then labels → assessment → export. */
async function cmdAwardGrainRefresh() {
  await migrate();
  await withClient(async (c) => {
    const awardGrain = new RetrieveAndLoadFederalAwardGrain(c);
    await awardGrain.Run();
    if (awardGrain.Status !== 'SUCCEEDED') throw new Error(awardGrain.ErrorMessage);
    log(`ofr-01 award-grain OK states=${awardGrain.StateCount} awards=${awardGrain.AwardCount} metrics=${awardGrain.MetricCount} emptyCombinations=${awardGrain.EmptyCombinations.length}`);
    const check = new CheckFederalAwardGrainNumbers(c);
    await check.Run();
    for (const r of check.Results) log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    if (check.Status !== 'SUCCEEDED') throw new Error(`OFR-01 reconciliation failed: ${check.ErrorMessage}`);
    const runwayGovernance = new LoadFundingRunwayGovernance(c);
    await runwayGovernance.Run();
    if (runwayGovernance.Status !== 'SUCCEEDED') throw new Error(runwayGovernance.ErrorMessage);
    const continuationAssessment = new AssessFundingRunwayContinuation(c);
    await continuationAssessment.Run();
    if (continuationAssessment.Status !== 'SUCCEEDED') throw new Error(continuationAssessment.ErrorMessage);
    const awardExport = new ExportFederalAwardGrainForUi(c);
    await awardExport.Run();
    if (awardExport.Status !== 'SUCCEEDED') throw new Error(awardExport.ErrorMessage);
    log(`award-grain refresh OK labels=${runwayGovernance.LabelCount} reconciled=${continuationAssessment.ReconciledSearchCount} export=${awardExport.ExportPath}`);
  });
}

async function cmdMcparPlanPeriodExport() {
  await migrate();
  await withClient(async (c) => {
    const mcpar = new ExportMcparPlanPeriodForUi(c);
    await mcpar.Run();
    if (mcpar.Status !== 'SUCCEEDED') throw new Error(`mcpar-plan-period: ${mcpar.ErrorMessage}`);
    for (const r of mcpar.Checks) log(`accuracy ${r.check_id} ${r.ok ? 'PASS' : 'FAIL'} expected=${r.expected} actual=${r.actual} (${r.detail})`);
    log(`export mcpar-plan-period OK states=${mcpar.StateCount} plans=${mcpar.PlanCount} sanctions=${mcpar.SanctionCount} reconciliation=${mcpar.ReconciliationStatus} path=${mcpar.ExportPath}`);
    if (mcpar.ReconciliationStatus !== 'PASS') throw new Error('mcpar-plan-period reconciliation FAILED — see accuracy lines above');
  });
}

async function cmdExportFacilityOnly() {
  await migrate();
  await withClient(async (c) => {
    const facilityCheck = new CheckFacilityDistressNumbers(c);
    await facilityCheck.Run();
    if (facilityCheck.Status !== 'SUCCEEDED') throw new Error(facilityCheck.ErrorMessage);
    const facilityExport = new ExportFacilityDistressForUi(c);
    await facilityExport.Run();
    if (facilityExport.Status !== 'SUCCEEDED') throw new Error(facilityExport.ErrorMessage);
    log(`ofr facility check/export OK facilityExport=${facilityExport.ExportPath}`);
  });
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
    'funding-runway-release-a': cmdFundingRunwayReleaseA,
    'funding-runway-assess-export': cmdFundingRunwayAssessExport,
    'funding-runway-public-evidence': cmdFundingRunwayPublicEvidence,
    'accuracy-check': cmdAccuracy,
    'export-ui': cmdExport,
    'ofr-facility-ownership': cmdRefreshFacilityOwnership,
    'ofr-ownership-only': cmdRefreshOwnershipOnly,
    'ofr-ownership-replay': cmdReplayOwnership,
    'ofr-facility-export': cmdExportFacilityOnly,
    'ofr-depot-export': cmdOfrDepotExport,
    'mcpar-plan-period-export': cmdMcparPlanPeriodExport,
    'ofr-provider-facilities': cmdProviderFacilities,
    'ofr-sam-resolve': cmdSamResolve,
    'ky-contract-index': cmdContractIndex,
    'county-access-context': cmdCountyAccessContext,
    'ofr-award-grain-refresh': cmdAwardGrainRefresh,
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

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await closePool();
});
