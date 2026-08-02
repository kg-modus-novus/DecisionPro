/**
 * Column-header explain copy for the Data Spectrum table.
 * Shape matches TileInfoButton explain props. Prefer full sentences.
 */
export const DATA_SPECTRUM_COLUMN_EXPLAIN = {
  id: {
    title: 'Source / Gap',
    about:
      'This column names either an authoritative publisher source (its FromSysID) or an Explicit Gap when no continuous public series exists.',
    source:
      'These identifiers come from the XenoDroid BW catalogue of source systems and gap objects, exported with the Data Spectrum.',
    useTile:
      'Click a row ID to open publisher details, links, and the full Data Spectrum inventory for that source or gap.',
  },
  status: {
    title: 'Status',
    about:
      'LOADED means DecisionPro already has REAL data from this source in the warehouse. CATALOGUED means the source is known but not yet bound. BLOCKED means the source is restricted for this public proof-of-concept. GAP means this row is an Explicit Gap, not unlabeled missing history.',
    source:
      'Status is computed at Accuracy Gate export from terms-of-use grade, PSA and cube presence, and the gap registry.',
    useTile:
      'Use Status with the filters above to focus on sources that are already usable versus those that still need authorization.',
  },
  sourceRecords: {
    title: 'Source scale',
    about:
      'Source scale describes how large the publisher Source of Truth is — for example how many CSVs, years, PDFs, directories, bills, or rows the publisher packages. It is not the number of records DecisionPro has loaded.',
    source:
      'These counts are observed at export from publisher files or APIs and from the versioned Source of Truth research inventory.',
    useTile:
      'Read each stacked tile line as one unit of publisher packaging. Open the tile info control when a short label needs its full name.',
  },
  loadedRows: {
    title: 'Loaded (PSA)',
    about:
      'Loaded (PSA) counts how many records from this source currently sit in the Persistent Staging Area after DecisionPro retrieved them.',
    source:
      'Counts come from the PSA object index and landed file or record totals at export time, including any slice of a shared public hydration pack for this source.',
    useTile:
      'Compare Source scale with Loaded to see how much of the publisher corpus DecisionPro actually staged. Open the tile info control for why a smaller PSA count is expected.',
  },
  resultantRows: {
    title: 'Resultant (cubes)',
    about:
      'Resultant lists the Evidence Room cubes this source feeds. These are screen-shaped warehouse cubes, not measure IDs. Each line shows how many REAL rows from this source are in that cube, then the full size of the cube fact table across all sources.',
    source:
      'Row counts come from the Evidence Room cube fact store (REAL rows, latest load per row), grouped by room or cube.',
    useTile:
      'Read each line as “this source’s rows, then the full fact-table size.” Sorting uses this source’s REAL rows across those cubes.',
  },
  asOf: {
    title: 'As-of',
    about:
      'As-of shows the earliest and latest publisher “true as of” dates currently loaded in DecisionPro for this source’s REAL data.',
    source:
      'These dates come from distinct as-of values on executive landing binds and related REAL loads at export.',
    useTile:
      'Use the date range to judge freshness. Open the tile info control for what the publisher makes available, how often it publishes, and any known source gaps.',
  },
  series: {
    title: 'Series',
    about:
      'Series describes the publisher’s publishing shape — for example continuous, annual, periodic, snapshot, or event. That shape tells you whether dates should form a dense timeline or only discrete publications.',
    source:
      'Series kind comes from the Source of Truth research inventory for each FromSysID.',
    useTile:
      'Read Series together with As-of. Snapshot or event sources often show a single date even when the publisher has a long archive of separate documents.',
  },
};
