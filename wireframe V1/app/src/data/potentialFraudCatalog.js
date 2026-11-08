/**
 * Reference content for the Potential Fraud Detection module: plain labels for
 * services, the analyses the 2026-11-07 assessment listed with what each needs
 * and whether it runs today, dated events for program blow-ups, state names and
 * the tile-map layout, and the documented needs the reallocation what-if pairs
 * freed dollars with.
 *
 * Labels are DecisionPro's plain wording, not the AMA or ADA code descriptors.
 * Need gaps, unit costs and people-reached figures are ILLUSTRATIVE until each
 * need's owner confirms them; the page says so wherever they appear.
 */

export const SERVICE_LABELS = Object.freeze({
  // Behavioral health and substance use
  H0002: 'Behavioral health screening for admission', H0010: 'Sub-acute detox, residential', H0016: 'Medical services in outpatient substance use treatment',
  H0018: 'Short-term behavioral health residential, per day', H0025: 'Behavioral health prevention education', H0033: 'Directly observed oral medication',
  H0046: 'Mental health services, not otherwise specified', H2010: 'Comprehensive medication services, per 15 minutes', H2021: 'Community wraparound services, per 15 minutes',
  H2025: 'Supported employment, per 15 minutes', H2032: 'Activity therapy, per 15 minutes', S0201: 'Partial hospitalization, per day',
  S9480: 'Intensive outpatient psychiatric services, per day', T1007: 'Substance use treatment plan development', T1040: 'Certified community behavioral health clinic, per day',
  T1041: 'Certified community behavioral health clinic, per month', T2048: 'Behavioral health long-term residence, per day', 90836: 'Psychotherapy, 45 minutes, with a medical visit',
  90868: 'Transcranial magnetic stimulation, later session', G2067: 'Methadone treatment, weekly bundle', Q9991: 'Long-acting buprenorphine injection, up to 100 mg',
  Q9992: 'Long-acting buprenorphine injection, over 100 mg', G0481: 'Definitive drug test, 8 to 14 classes', G0482: 'Definitive drug test, 15 to 21 classes',
  G0483: 'Definitive drug test, 22 or more classes', 80305: 'Presumptive drug test, read by eye', 82075: 'Alcohol breath test',
  // Home and community based services
  T1001: 'Nursing assessment', T1002: 'Registered nurse services, per 15 minutes', T1013: 'Sign language or interpreter, per 15 minutes',
  T1016: 'Case management, per 15 minutes', T1017: 'Targeted case management, per 15 minutes', T1024: 'Integrated specialty team for children with disabilities',
  T1026: 'Intensive services for medically complex children, per hour', T1030: 'Home nursing by a registered nurse, per day', T2001: 'Non-emergency transport attendant',
  T2015: 'Prevocational habilitation (waiver), per hour', T2017: 'Residential habilitation (waiver), per 15 minutes', S5170: 'Home-delivered meals',
  S9445: 'Patient education, individual', S9129: 'Home occupational therapy, per day', S9131: 'Home physical therapy, per day',
  G0152: 'Home health occupational therapy, per 15 minutes', G0153: 'Home health speech therapy, per 15 minutes', G0156: 'Home health aide, per 15 minutes',
  G0299: 'Home health skilled nursing by an RN, per 15 minutes', G9002: 'Coordinated care fee', Q5001: 'Hospice care at home',
  97533: 'Sensory integration therapy, each 15 minutes', 97014: 'Electrical stimulation, unattended', 97012: 'Mechanical traction',
  97116: 'Gait training, each 15 minutes', 98940: 'Chiropractic manipulation, 1 or 2 regions',
  // Dental
  D0340: 'Dental head X-ray (cephalometric)', D0350: 'Dental photographs', D1330: 'Oral hygiene instruction', D1354: 'Cavity-arresting medicine (silver diamine fluoride)',
  D2740: 'Porcelain or ceramic crown', D2750: 'Porcelain fused to metal crown', D2950: 'Core buildup for a crown', D7250: 'Surgical removal of remaining tooth roots',
  D8090: 'Comprehensive orthodontics, adult', D9920: 'Behavior management during dental care', D9999: 'Unspecified dental procedure', 99188: 'Fluoride varnish',
  // Drugs and supplies
  J0887: 'Epoetin beta injection for dialysis', J1756: 'Iron sucrose injection', J3490: 'Unclassified drugs', J7030: 'Saline infusion, 1,000 cc',
  J0696: 'Ceftriaxone injection', J2785: 'Regadenoson injection (cardiac stress)', J9299: 'Nivolumab injection', Q5107: 'Bevacizumab biosimilar injection',
  Q9967: 'Low-osmolar contrast, per ml', A4657: 'Syringe, per syringe', A9274: 'Disposable insulin delivery system', A9999: 'Miscellaneous equipment supply',
  B4105: 'Digestive enzyme cartridge for tube feeding', V5261: 'Digital hearing aids, both ears', V2784: 'Polycarbonate lens',
  C1713: 'Bone or tissue anchor implant', C1776: 'Implantable joint device', 90677: 'Pneumococcal vaccine, 20-valent', 90471: 'Vaccine administration, first',
  // Transport
  A0430: 'Fixed-wing air ambulance', A0434: 'Specialty care ground transport', A0435: 'Fixed-wing air ambulance mileage',
  // Office, hospital and other services
  99199: 'Unlisted special service', 99499: 'Unlisted evaluation and management service', 99211: 'Office visit, minimal',
  99212: 'Office visit, straightforward', 99221: 'First hospital inpatient visit', 99344: 'Home visit, new patient',
  99350: 'Home visit, established patient, complex', 99354: 'Prolonged office service, first hour', 90999: 'Unlisted dialysis procedure',
  95165: 'Allergy shot antigen preparation', 59400: 'Routine obstetric care with vaginal delivery', 47562: 'Laparoscopic gallbladder removal',
  58661: 'Laparoscopic removal of ovary or tube', 62323: 'Lumbar epidural injection with imaging', 64635: 'Lumbar facet nerve ablation',
  77386: 'Intensity-modulated radiation therapy', 93458: 'Heart catheterization with coronary imaging', 93017: 'Cardiac stress test, tracing only',
  96375: 'IV push, each added drug', 96376: 'IV push, each added new drug', 94640: 'Nebulizer treatment', 94060: 'Spirometry before and after a bronchodilator',
  95806: 'Home sleep study', Q3014: 'Telehealth originating site fee',
  // Imaging
  70486: 'CT of face and sinuses', 70491: 'CT of neck with contrast', 70496: 'CT angiography of head', 70498: 'CT angiography of neck',
  71250: 'CT of chest', 71260: 'CT of chest with contrast', 72131: 'CT of lower spine', 72141: 'MRI of neck spine', 72148: 'MRI of lower spine',
  74174: 'CT angiography of abdomen and pelvis', 74176: 'CT of abdomen and pelvis', 74178: 'CT of abdomen and pelvis, with and without contrast',
  78452: 'Heart perfusion imaging (SPECT)', 72100: 'Lower spine X-ray', 73030: 'Shoulder X-ray', 73110: 'Wrist X-ray', 73130: 'Hand X-ray',
  73562: 'Knee X-ray, 3 views', 73610: 'Ankle X-ray', 73630: 'Foot X-ray', 74018: 'Abdominal X-ray, one view',
  // Laboratory
  80053: 'Comprehensive metabolic panel', 80069: 'Kidney function panel', 81001: 'Urinalysis with microscopy', 81479: 'Unlisted molecular pathology test',
  82565: 'Creatinine test', 82728: 'Ferritin test', 83540: 'Iron test', 83550: 'Iron binding capacity test', 83970: 'Parathyroid hormone test',
  84100: 'Phosphorus test', 84466: 'Transferrin test', 84703: 'Pregnancy test', 85018: 'Hemoglobin test', 87070: 'Bacterial culture',
  87340: 'Hepatitis B surface antigen test', 87631: 'Respiratory virus panel, 3 to 5 targets', 87633: 'Respiratory virus panel, 12 to 25 targets', 87651: 'Strep A test',
});

export const STATE_NAMES = Object.freeze({
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
});

/** Tile-map grid positions [row, column] for the national map. */
export const STATE_TILES = Object.freeze({
  AK: [0, 0], ME: [0, 10], VT: [1, 9], NH: [1, 10],
  WA: [2, 0], ID: [2, 1], MT: [2, 2], ND: [2, 3], MN: [2, 4], IL: [2, 5], WI: [2, 6], MI: [2, 7], NY: [2, 8], MA: [2, 9],
  OR: [3, 0], NV: [3, 1], WY: [3, 2], SD: [3, 3], IA: [3, 4], IN: [3, 5], OH: [3, 6], PA: [3, 7], NJ: [3, 8], CT: [3, 9], RI: [3, 10],
  CA: [4, 0], UT: [4, 1], CO: [4, 2], NE: [4, 3], MO: [4, 4], KY: [4, 5], WV: [4, 6], VA: [4, 7], MD: [4, 8], DE: [4, 9],
  AZ: [5, 1], NM: [5, 2], KS: [5, 3], AR: [5, 4], TN: [5, 5], NC: [5, 6], SC: [5, 7], DC: [5, 8],
  OK: [6, 3], LA: [6, 4], MS: [6, 5], AL: [6, 6], GA: [6, 7],
  HI: [7, 0], TX: [7, 3], FL: [7, 8],
});

export const PATTERN_LABELS = Object.freeze({
  'share-surge': 'share surge',
  'tripled-and-growing': 'tripled & growing',
  'share-collapse': 'share collapse',
  'persistent-excess': 'persistent excess',
});

/**
 * Dated events to test a rise against, by state|code. Only events with a public
 * source are listed; the page adds the screen's own dated facts (first-time
 * billers, known cases) for every program.
 */
export const PROGRAM_EVENTS = Object.freeze({
  'KY|H2027': [
    { date: '2023-05', event: 'Arizona AHCCCS suspends payments to behavioral-health billers under its sober-living fraud response', source: 'AHCCCS public notices, 2023', fit: 'precedes the Kentucky rise' },
    { date: '2023–24', event: 'Kentucky fee schedule, prior-authorization or state plan change on psychoeducation', source: 'Kentucky DMS (not yet confirmed)', fit: 'unknown' },
    { date: '2026-10-29', event: 'Empower Oversight letter to CMS names Kentucky psychoeducation', source: 'Empower Oversight', fit: 'external flag' },
  ],
  'AZ|H2027': [
    { date: '2023-05', event: 'AHCCCS payment suspensions and the sober-living enforcement begin', source: 'AHCCCS public notices, 2023', fit: 'matches the collapse' },
  ],
  'DC|H0036': [
    { date: '2022–24', event: 'Federal prosecutions of District community-support billers', source: 'U.S. Department of Justice press releases', fit: 'known case' },
  ],
});

/**
 * The year enforcement began on a known case's state and code, drawn as a dashed
 * line on the backtests page. Taken from PROGRAM_EVENTS: Arizona's AHCCCS
 * suspensions began 2023-05. The District's prosecutions span 2022–24 with no
 * single start, so it has none.
 */
export const KNOWN_CASE_ENFORCEMENT_YEARS = Object.freeze({ 'AZ|H2027': 2023 });

/** Short service names for the backtest cards (the conventions' codes have no plain label in the export). */
export const BACKTEST_SERVICE_TITLES = Object.freeze({ H2027: 'psychoeducation', H0036: 'psychiatric support', S5108: 'home-care training', G2087: 'opioid treatment bundle' });

/**
 * Every analysis the 2026-11-07 assessment listed. status: running (computed in
 * this module today), ready (its data is in the warehouse or the staged
 * publisher file, the analysis is not built), needs (its data is not loaded).
 * short: the tile name. sources: the DETECTION_SOURCES keys it uses today;
 * waitingOn: sources not on hand that would extend a running or ready analysis.
 */
export const DETECTION_ANALYSES = Object.freeze([
  { tier: 'A', short: 'Share vs enrollment', name: 'Share of national payments vs share of enrollment', status: 'running', needs: 'T-MSIS spending, CMS enrollment', sources: ['tmsis', 'enrollment', 'screen'], waitingOn: [] },
  { tier: 'A', short: 'Four patterns', name: 'Four patterns: surge, tripled, collapse, persistent', status: 'running', needs: 'T-MSIS spending, CMS enrollment', sources: ['tmsis', 'enrollment', 'screen'], waitingOn: [] },
  { tier: 'A', short: 'Peer-state line', name: 'Peer-state line: paid vs the median state', status: 'running', needs: 'latest year only', sources: ['tmsis', 'enrollment'], waitingOn: [] },
  { tier: 'A', short: 'Expected vs prevalence', name: 'Expected vs actual by prevalence, county residual', status: 'needs', needs: 'NSDUH, CDC PLACES, county claims', sources: ['prevalence', 'non-public'], waitingOn: [] },
  { tier: 'A', short: 'Policy-event overlay', name: 'Policy-event overlay: rate, prior-authorization, unbundling dates', status: 'needs', needs: 'state fee schedule and plan amendment dates', sources: ['policy-dates', 'tmsis'], waitingOn: [] },
  { tier: 'A', short: 'Cross-state displacement', name: 'Cross-state displacement after enforcement', status: 'running', needs: 'T-MSIS spending', sources: ['tmsis', 'screen'], waitingOn: [] },
  { tier: 'B', short: 'Share of new billers', name: 'Share of billers new to the code', status: 'running', needs: 'T-MSIS spending', sources: ['tmsis', 'screen'], waitingOn: [] },
  { tier: 'B', short: 'Top-10 concentration', name: 'Concentration in the ten largest billers', status: 'running', needs: 'T-MSIS spending (Herfindahl needs NPI rows)', sources: ['tmsis', 'screen'], waitingOn: [] },
  { tier: 'B', short: 'Paid per beneficiary', name: 'Paid per beneficiary, outliers within a code', status: 'ready', needs: 'beneficiary cells are in the file', sources: ['tmsis'], waitingOn: [] },
  { tier: 'B', short: 'Month-over-month spike', name: 'Month-over-month spike above five times the base', status: 'ready', needs: 'NPI-month rows in the staged file', sources: ['tmsis'], waitingOn: [] },
  { tier: 'B', short: 'Billing-mill ratio', name: 'Billing-mill ratio: servicing NPIs per billing NPI', status: 'ready', needs: 'NPI rows in the staged file', sources: ['tmsis'], waitingOn: [] },
  { tier: 'B', short: 'Code migration', name: 'Code migration after a policy date', status: 'ready', needs: 'sibling-code series are in the file; the policy dates are not loaded', sources: ['tmsis'], waitingOn: ['policy-dates'] },
  { tier: 'B', short: 'Collapse after enforcement', name: 'Billing collapse after an enforcement date', status: 'running', needs: 'the share-collapse pattern', sources: ['tmsis', 'screen'], waitingOn: [] },
  { tier: 'C', short: 'Exclusion list vs billers', name: 'Exclusion and termination lists vs billers', status: 'ready', needs: 'LEIE loaded as a state summary; NPI rows staged', sources: ['leie', 'tmsis'], waitingOn: [] },
  { tier: 'C', short: 'Billing outside enrollment', name: 'Billing outside enrollment dates', status: 'needs', needs: 'CMS T-MSIS enrollment segments', sources: ['segments'], waitingOn: [] },
  { tier: 'C', short: 'NPPES: new, taxonomy', name: 'NPPES: new billers recently enumerated, billers outside the code\'s taxonomies', status: 'running', needs: 'NPPES enumeration date and primary taxonomy, counted per state, code and year in staging', sources: ['nppes', 'tmsis'], waitingOn: [] },
  { tier: 'C', short: 'NPPES: shared address', name: 'NPPES: practice addresses shared across billers', status: 'ready', needs: 'NPPES practice addresses are in the staged copy; not compared across billers yet', sources: ['nppes', 'tmsis'], waitingOn: [] },
  { tier: 'C', short: 'Medicare revocations, SAM', name: 'Medicare revocations and SAM exclusions', status: 'needs', needs: 'CMS revocation list (SAM resolver only)', sources: ['revocations', 'sam'], waitingOn: [] },
  { tier: 'C', short: 'IRS 990 vs Medicaid paid', name: 'IRS 990 revenue vs Medicaid paid', status: 'ready', needs: '990 extract and organization crosswalk loaded', sources: ['irs990', 'crosswalk'], waitingOn: [] },
  { tier: 'C', short: 'Officers shared across billers', name: 'Secretary of State: officers shared across billers', status: 'needs', needs: 'state business filings', sources: ['filings'], waitingOn: [] },
  { tier: 'C', short: 'Federal grants, same service', name: 'Federal grants paid for the same service', status: 'ready', needs: 'USAspending award grain loaded', sources: ['usaspending', 'crosswalk'], waitingOn: [] },
  { tier: 'C', short: 'Managed care plan reports', name: 'Managed care plan program-integrity reports', status: 'ready', needs: 'MCPAR loaded (Kentucky, plan level)', sources: ['mcpar'], waitingOn: [] },
  { tier: 'C', short: 'Known-case backtest', name: 'Known cases: fraud control unit, OIG, DOJ (backtest)', status: 'running', needs: 'seven known cases', sources: ['known-cases', 'screen'], waitingOn: [] },
  { tier: 'C', short: 'Reporting quality gate', name: 'Data-quality gate on state reporting', status: 'running', needs: 'publisher-month completeness (DQ Atlas not loaded)', sources: ['tmsis', 'screen'], waitingOn: [] },
  { tier: 'D', short: 'Can health explain it', name: '"Can health explain it" denominators', status: 'running', needs: 'enrollment loaded; NSDUH and CDC overdose data not loaded', sources: ['enrollment'], waitingOn: ['prevalence'] },
]);

/** The analysis statuses in the order the coverage bar shows them. */
export const ANALYSIS_STATUSES = Object.freeze(['running', 'ready', 'needs']);
export const ANALYSIS_STATUS_LABELS = Object.freeze({ running: 'Running', ready: 'Ready', needs: 'Needs data' });
/** The coverage legend's words for each status. */
export const ANALYSIS_STATUS_LEGEND = Object.freeze({ running: 'Running', ready: 'Ready to build', needs: 'Needs a data load' });
/** A tile's detail line for each status. */
export const ANALYSIS_STATUS_DETAIL = Object.freeze({ running: 'running', ready: 'data on hand, not built', needs: 'needs a data load' });
/** The analysis tiers, in order, with their row labels. */
export const ANALYSIS_TIERS = Object.freeze([
  { key: 'A', label: 'A · state × service' },
  { key: 'B', label: 'B · provider screens' },
  { key: 'C', label: 'C · joins' },
  { key: 'D', label: 'D · health' },
]);

/**
 * Sources the coverage page lists. A source is loaded when its warehouse data
 * request appears in the radar export's coverage; partial when it is reached only
 * through another load (partialVia, whose row count is not this source's); bundled
 * when it ships with this module. short: the chip name. usedBy: a source that feeds
 * another page, not a detection analysis.
 */
export const DETECTION_SOURCES = Object.freeze([
  { key: 'tmsis', short: 'T-MSIS spending', name: 'HHS T-MSIS provider spending by HCPCS', dataRequestId: 'DR-REAL-TMSIS-STATE-CODE-SPENDING' },
  { key: 'enrollment', short: 'CMS enrollment', name: 'CMS monthly Medicaid and CHIP enrollment, all states', dataRequestId: 'DR-REAL-PI-ENROLLMENT-ALL-STATES' },
  { key: 'screen', short: 'Share-and-surge screen', name: 'Share-and-surge screen', dataRequestId: 'DR-REAL-SHARE-SURGE-SCREEN' },
  { key: 'nppes', short: 'NPPES', name: 'NPPES NPI registry', dataRequestId: null, partialVia: 'DR-REAL-TMSIS-STATE-CODE-SPENDING', note: 'the Feb 2026 file through a third-party mirror (Hugging Face cfahlgren1), joined in staging: practice state, enumeration date and primary taxonomy, counted per state, code and year; no provider is named' },
  { key: 'leie', short: 'LEIE', name: 'HHS-OIG exclusion list (LEIE), state summary', dataRequestId: 'DR-REAL-LEIE' },
  { key: 'mcpar', short: 'MCPAR', name: 'MCPAR managed care plan reports, Kentucky', dataRequestId: 'DR-REAL-MCPAR-KY' },
  { key: 'irs990', short: 'IRS 990', name: 'IRS Form 990 extract', dataRequestId: 'DR-REAL-IRS-990-EXTRACT' },
  { key: 'usaspending', short: 'USAspending', name: 'USAspending federal awards', dataRequestId: 'DR-REAL-USASPENDING-AWARD-GRAIN' },
  { key: 'sam', short: 'SAM.gov', name: 'SAM.gov entity resolution', dataRequestId: 'DR-REAL-SAM-RESOLVE' },
  { key: 'crosswalk', short: 'Org crosswalk', name: 'Organization crosswalk (NPI, EIN, CCN, UEI)', dataRequestId: 'DR-REAL-ORG-CROSSWALK' },
  { key: 'known-cases', short: 'Known cases', name: 'Known cases: fraud control unit, OIG and DOJ (the backtest set)', dataRequestId: null, bundled: 'the radar export backtest' },
  { key: 'fmap', short: 'KFF FMAP', name: 'KFF FY2024 regular FMAP by state', dataRequestId: null, bundled: 'federalMatchingRate.js', usedBy: 'the reallocation what-if' },
  { key: 'segments', short: 'Enrollment segments', name: 'CMS T-MSIS enrollment segments', dataRequestId: null },
  { key: 'filings', short: 'Business filings', name: 'State Secretary of State business filings', dataRequestId: null },
  { key: 'prevalence', short: 'NSDUH / PLACES', name: 'NSDUH prevalence, CDC PLACES and overdose deaths', dataRequestId: null },
  { key: 'policy-dates', short: 'Policy dates', name: 'State fee schedule and plan amendment dates', dataRequestId: null },
  { key: 'revocations', short: 'Revocations', name: 'CMS Medicare revocation list', dataRequestId: null },
  { key: 'non-public', short: 'Non-public claims', name: 'Non-public: state claims, prior authorization, plan encounters', dataRequestId: null, note: 'data use agreement' },
]);

/** The ways a source can stand, in the order the chips explain them. */
export const SOURCE_STANDINGS = Object.freeze(['loaded', 'partial', 'bundled', 'missing']);
/** The words a source chip starts with, for each standing. */
export const SOURCE_STANDING_PREFIX = Object.freeze({ loaded: '', partial: 'partial · ', bundled: '', missing: 'not loaded · ' });
/** The words after a source's name in a tile's detail line, for each standing. */
export const SOURCE_STANDING_SUFFIX = Object.freeze({ loaded: '', partial: ' (partial)', bundled: '', missing: ' (not loaded)' });

/**
 * How a source stands against the radar export's coverage (keyed by data request id):
 * { standing, load }, where load is the coverage entry behind it or null.
 */
export function standingOfSource(source, coverageById) {
  if (source.dataRequestId && coverageById[source.dataRequestId]) return { standing: 'loaded', load: coverageById[source.dataRequestId] };
  if (source.partialVia && coverageById[source.partialVia]) return { standing: 'partial', load: coverageById[source.partialVia] };
  if (source.bundled) return { standing: 'bundled', load: null };
  return { standing: 'missing', load: null };
}

/**
 * Documented Kentucky needs the reallocation what-if can fund. Gaps, unit costs
 * and default allocations are ILLUSTRATIVE until each owner confirms them.
 */
export const DOCUMENTED_NEEDS = Object.freeze({
  KY: [
    { id: 'hcbs-waiting-lists', label: 'Michelle P. and SCL waiver waiting lists (home and community slots)', owner: 'Access goal', gap: 310e6, unitCost: 75_000, unitLabel: 'waiver slots funded for a year', defaultAllocation: 180e6 },
    { id: 'rural-hospitals', label: 'Rural hospital stabilization (closure-risk watchlist)', owner: 'Funding goal', gap: 180e6, unitCost: 15.7e6, unitLabel: 'hospitals kept open 24 months', defaultAllocation: 110e6 },
    { id: 'county-behavioral-health', label: 'County behavioral-health access gaps', owner: 'Access goal', gap: 95e6, unitCost: 7.5e6, unitLabel: 'counties with a provider restored', defaultAllocation: 60e6 },
    { id: 'sud-residential-beds', label: 'Residential substance use treatment beds, eastern Kentucky', owner: 'Quality goal', gap: 60e6, unitCost: 250_000, unitLabel: 'treatment beds added', defaultAllocation: 40e6 },
    { id: 'attendant-rates', label: 'Personal-care and attendant rate increase (workforce)', owner: 'Access goal', gap: 140e6, unitCost: 0, unitLabel: '', defaultAllocation: 48.4e6 },
    { id: 'school-clinicians', label: 'School-based mental health clinicians', owner: 'Quality goal', gap: 45e6, unitCost: 95_000, unitLabel: 'clinicians funded for a year', defaultAllocation: 0 },
  ],
});
