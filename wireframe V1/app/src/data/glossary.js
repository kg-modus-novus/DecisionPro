/**
 * Legislator-facing glossary for DecisionPro / XenoDroid BW terms.
 * Keep definitions plain-language; include one concrete usage example each.
 */
export const GLOSSARY_TERMS = [
  {
    id: 'psa',
    term: 'PSA',
    aliases: ['Persistent Staging Area'],
    definition:
      'The Persistent Staging Area — where DecisionPro first stores the raw files it retrieves from a publisher (for example a CMS CSV or a DMS PDF), unchanged, with a timestamp and source identity.',
    example:
      'In Authoritative sources, Loaded (PSA) counts how many records from that publisher file are currently sitting in the PSA.',
  },
  {
    id: 'cube',
    term: 'Cube',
    aliases: ['Cubes', 'Evidence Room cube', 'Evidence Room cubes'],
    definition:
      'A prepared table of numbers shaped for a specific screen or question (an Evidence Room). Cubes are built from cleansed warehouse data so the UI can show aggregates quickly without re-reading every raw file.',
    example:
      'Resultant (cubes) for Scorecard may show outcomes: 11 and benchmarks: 11 — eleven REAL rows in each of those Evidence Room cubes.',
  },
  {
    id: 'dso',
    term: 'Detail DSO',
    aliases: ['DSO', 'Detail DSOs'],
    definition:
      'Detail DataStore Object — the cleansed, structured layer after PSA. Raw files are checked and typed here (for example Kentucky enrollment by month) before cubes are built.',
    example:
      'A CMS enrollment CSV lands in the PSA, then Kentucky rows are written into a Detail DSO that cubes and measures read from.',
  },
  {
    id: 'data-request',
    term: 'Data Request',
    aliases: ['Data Requests'],
    definition:
      'A controlled retrieval job that pulls an authorized public source into the PSA, records what was fetched, and starts the cleanse → Detail DSO → cube path.',
    example:
      'A Data Request for the CMS Performance Indicator CSV downloads the publisher file, lands it in the PSA, and logs the load for audit.',
  },
  {
    id: 'from-sys-id',
    term: 'FromSysID',
    aliases: ['FromSysId', 'source system ID'],
    definition:
      'The stable identifier for a publisher source system in DecisionPro (for example CMS_DATA_MEDICAID_ENR). Every landed file and measure row carries this so users can see which source a number came from.',
    example:
      'The Authoritative sources catalogue lists each FromSysID so enrollment numbers can be traced back to CMS, not mixed with a different publisher.',
  },
  {
    id: 'sot',
    term: 'Source of Truth',
    aliases: ['SoT', 'source of truth', 'publisher SoT'],
    definition:
      'The owning published source DecisionPro cites for a number — usually a government open-data file, report, or official page — not an invented estimate.',
    example:
      'Source scale describes how large that Source of Truth is (CSVs, years, PDFs), before DecisionPro loads a smaller curated slice.',
  },
  {
    id: 'load-class',
    term: 'LoadClass',
    aliases: ['Load Class', 'REAL', 'TEST'],
    definition:
      'A label on warehouse data: REAL means public-source values allowed on the demo path; TEST means synthetic fixtures used only inside the controlled Accuracy Gate harness and then purged.',
    example:
      'After the Accuracy Gate purges TEST data, Evidence Rooms show only REAL numbers or labeled Gaps.',
  },
  {
    id: 'xenodroid-bw',
    term: 'XenoDroid BW',
    aliases: ['BW', 'business warehouse'],
    definition:
      'DecisionPro’s warehouse spine (inspired by SAP BW layering in name only — not licensed SAP software). It stages publisher files, cleanses them, and builds cubes the product can query.',
    example:
      'When you see Loaded (PSA) and Resultant (cubes), you are looking at two layers of the XenoDroid BW path from raw file to screen-ready aggregates.',
  },
  {
    id: 'accuracy-gate',
    term: 'Accuracy Gate',
    aliases: ['Gate', 'bw:gate'],
    definition:
      'The controlled pipeline that proves the warehouse path with TEST fixtures, empties them, then loads REAL public sources before DecisionPro claims accuracy on the demo.',
    example:
      'Operators run the Accuracy Gate before a REAL refresh so synthetic test numbers never appear as Kentucky Medicaid fact.',
  },
  {
    id: 'source-reconciliation',
    term: 'Source Reconciliation',
    aliases: ['reconciliation'],
    definition:
      'An independent check that DecisionPro’s displayed numbers still match the owning published sources — separate from the Accuracy Gate pipeline control.',
    example:
      'On the Source Reconciliation tab, each check shows the warehouse value next to the publisher value it should match.',
  },
  {
    id: 'as-of',
    term: 'As-of',
    aliases: ['as-of date', 'as-of window'],
    definition:
      'The publisher’s “true as of” date for a number (when the source says the fact applies), not merely the day DecisionPro downloaded the file.',
    example:
      'An enrollment as-of of 2026-03-31 means the CMS series reports that month’s membership, even if DecisionPro loaded the file later.',
  },
  {
    id: 'explicit-gap',
    term: 'Explicit Gap',
    aliases: ['Gap', 'Gaps'],
    definition:
      'A labeled hole where DecisionPro deliberately does not invent a number because no authorized continuous public series exists. Gaps stay visible so absence is not mistaken for zero.',
    example:
      'Claim-grain dollar impact by service may appear as an Explicit Gap until Kentucky authorizes the needed data feed.',
  },
  {
    id: 'landing',
    term: 'Landing',
    aliases: ['executive landing', 'landing binds', 'landing measures'],
    definition:
      'Compact measure×as-of rows used for executive tiles and accuracy checks. Distinct from Evidence Room cube rows, which power room screens.',
    example:
      'Enrollment may have many landing binds across months while Resultant shows one command-center cube row that the room screen reads.',
  },
  {
    id: 'source-scale',
    term: 'Source scale',
    aliases: [],
    definition:
      'How the publisher packages the Source of Truth — files, periods, years, documents — and how many records that package contains. It is not the same as how many rows DecisionPro loaded.',
    example:
      'Pharmacy Source scale may read “1 CSV · 5 years · 18,511 rows” while Loaded (PSA) shows only the curated KY bind DecisionPro staged.',
  },
];

const byId = new Map(GLOSSARY_TERMS.map((t) => [t.id, t]));

export function getGlossaryTerm(id) {
  return byId.get(id) || null;
}

export function listGlossaryTerms() {
  return GLOSSARY_TERMS.slice().sort((a, b) => a.term.localeCompare(b.term));
}

/** Short / ambiguous labels stay searchable but are not auto-hyperlinked in prose. */
const NO_AUTO_LINK = new Set([
  'gate',
  'bw',
  'real',
  'test',
  'gap',
  'gaps',
  'dso',
  'reconciliation',
  'landing',
  'business warehouse',
]);

/** Match patterns longest-first for safe inline linking. */
export function glossaryMatchPatterns() {
  const items = [];
  for (const entry of GLOSSARY_TERMS) {
    for (const label of [entry.term, ...(entry.aliases || [])]) {
      if (!label) continue;
      if (NO_AUTO_LINK.has(label.toLowerCase())) continue;
      items.push({ label, id: entry.id });
    }
  }
  items.sort((a, b) => b.label.length - a.label.length);
  return items;
}
