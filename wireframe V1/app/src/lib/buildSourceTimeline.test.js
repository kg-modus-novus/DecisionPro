import { describe, expect, it } from 'vitest';
import {
  attachSlotPreview,
  buildSourceDescription,
  buildSourceTimelines,
  enumerateTimelineSlots,
  normalizeSlotCadence,
  parseSourceDescriptionSections,
  timelineWindowEnd,
} from './buildSourceTimeline.js';

describe('buildSourceTimeline', () => {
  it('normalizes cadence families', () => {
    expect(normalizeSlotCadence('monthly PDF')).toBe('monthly');
    expect(normalizeSlotCadence('annual')).toBe('annual');
    expect(normalizeSlotCadence('event / page update')).toBe('event');
    expect(normalizeSlotCadence('n/a')).toBe('none');
  });

  it('enumerates 10 annual and 120 monthly slots ending at as-of', () => {
    const end = timelineWindowEnd(new Date('2026-08-03T12:00:00Z'));
    expect(end).toEqual({ year: 2026, month: 8 });
    const annual = enumerateTimelineSlots(end, 'annual');
    expect(annual).toHaveLength(10);
    expect(annual[0].year).toBe(2017);
    expect(annual[9].year).toBe(2026);
    const monthly = enumerateTimelineSlots(end, 'monthly');
    expect(monthly).toHaveLength(120);
    expect(monthly[0].slotId).toBe('2016-09');
    expect(monthly[119].slotId).toBe('2026-08');
  });

  it('keeps Description distinct from Why unavailable and renames bind skips', () => {
    const asOf = new Date('2026-08-03T12:00:00Z');
    const payload = buildSourceTimelines({
      asOf,
      sources: [
        {
          fromSysId: 'CMS_MEDICAID_SCORECARD',
          href: 'https://www.medicaid.gov/state-overviews/scorecard',
          attributionNotes: 'Medicaid & CHIP Scorecard / Core Set public measures',
        },
      ],
      spectrumRows: [
        {
          kind: 'source',
          fromSysId: 'CMS_MEDICAID_SCORECARD',
          publisher: 'CMS',
          disposition: 'LOADED',
          provides: { cadence: 'annual', publicUris: ['https://www.medicaid.gov/state-overviews/scorecard'] },
          loadedDepth: {
            periodIds: ['ffy2020', 'ffy2021', 'ffy2022', 'ffy2023', 'ffy2024'],
            asOfDates: ['2019-12-31', '2020-12-31', '2021-12-31', '2022-12-31', '2023-12-31'],
            measureIds: ['M-010'],
            psaBind: {
              why: 'Those Kentucky Core Set points power Outcomes and Benchmarks rooms.',
            },
          },
          availableDepth: 'FFY 2020–2024',
        },
      ],
    });
    const tl = payload.timelines.find((t) => t.fromSysId === 'CMS_MEDICAID_SCORECARD');
    const byYear = Object.fromEntries(tl.slots.map((s) => [s.year, s]));
    expect(byYear[2024].status).toBe('loaded');
    expect(byYear[2019].status).toBe('not-published');
    expect(byYear[2025].status).toBe('not-published');
    expect(byYear[2019].description).toMatch(/What it is\./);
    expect(byYear[2019].description).toMatch(/Why DecisionPro includes it\./);
    expect(byYear[2019].reason).not.toBe(byYear[2019].description);
    expect(byYear[2019].reason).toMatch(/No public Child\/Adult Core Set/);
    expect(byYear[2024].dataUri).toMatch(/2024-child-and-adult/);
  });

  it('marks incomplete current calendar year as not-published, not a bind skip', () => {
    const payload = buildSourceTimelines({
      asOf: new Date('2026-08-03T12:00:00Z'),
      sources: [
        {
          fromSysId: 'CMS_DATA_MEDICAID',
          attributionNotes: 'Medicaid Financial Management Data — state expenditure aggregates',
          href: 'https://data.medicaid.gov/dataset/5b19d1d4-ae43-5fcd-ba14-3cecd99f473f',
        },
      ],
      spectrumRows: [
        {
          kind: 'source',
          fromSysId: 'CMS_DATA_MEDICAID',
          publisher: 'CMS / data.medicaid.gov',
          disposition: 'LOADED',
          provides: {
            cadence: 'periodic release',
            grain: 'state × program × service category × year',
            publicUris: ['https://data.medicaid.gov/dataset/5b19d1d4-ae43-5fcd-ba14-3cecd99f473f'],
          },
          loadedDepth: {
            asOfDates: ['2023-09-30'],
            periodIds: [],
            latestAsOf: '2023-09-30',
            psaBind: {
              mode: 'curated-aggregate',
              why: 'The publisher table is a large multi-state expenditure matrix.',
            },
          },
          availableDepth: 'Medicaid Financial Management Data open table.',
        },
      ],
    });
    const tl = payload.timelines[0];
    const slot2024 = tl.slots.find((s) => s.year === 2024);
    const slot2026 = tl.slots.find((s) => s.year === 2026);
    expect(slot2024.status).toBe('not-published');
    expect(slot2024.reason).toMatch(/No newer attributable Kentucky expenditure/);
    expect(slot2026.status).toBe('not-published');
    expect(slot2026.reason).toMatch(/still in progress/);
    expect(slot2026.description).toMatch(/What it is\./);
    expect(slot2026.reason).not.toBe(slot2026.description);
  });

  it('marks FM years missing from the open table as not-published', () => {
    const payload = buildSourceTimelines({
      asOf: new Date('2026-08-03T12:00:00Z'),
      sources: [
        {
          fromSysId: 'CMS_DATA_MEDICAID',
          attributionNotes: 'Medicaid Financial Management Data — state expenditure aggregates',
          href: 'https://data.medicaid.gov/dataset/5b19d1d4-ae43-5fcd-ba14-3cecd99f473f',
        },
      ],
      spectrumRows: [
        {
          kind: 'source',
          fromSysId: 'CMS_DATA_MEDICAID',
          publisher: 'CMS / data.medicaid.gov',
          disposition: 'LOADED',
          provides: {
            cadence: 'periodic release',
            grain: 'state × program × service category × year',
            publicUris: ['https://data.medicaid.gov/dataset/5b19d1d4-ae43-5fcd-ba14-3cecd99f473f'],
          },
          loadedDepth: {
            asOfDates: ['2023-09-30'],
            periodIds: [],
            latestAsOf: '2023-09-30',
            psaBind: {
              mode: 'curated-aggregate',
              why: 'The publisher table is a large multi-state expenditure matrix.',
            },
          },
          availableDepth: 'Medicaid Financial Management Data open table.',
        },
      ],
    });
    const tl = payload.timelines[0];
    const slot2022 = tl.slots.find((s) => s.year === 2022);
    expect(slot2022.status).toBe('not-published');
    expect(slot2022.description).toMatch(/What it is\./);
    expect(slot2022.reason).toMatch(/year=2016 only/);
    expect(slot2022.reason).not.toBe(slot2022.description);
  });

  it('marks pharmacy national-only years as not-published (no KY invention)', () => {
    const payload = buildSourceTimelines({
      asOf: new Date('2026-08-03T12:00:00Z'),
      spectrumRows: [
        {
          kind: 'source',
          fromSysId: 'CMS_MEDICAID_PHARMACY',
          publisher: 'CMS',
          disposition: 'LOADED',
          provides: { cadence: 'annual (~5-year historical columns on Spending by Drug)' },
          loadedDepth: {
            periodIds: ['cy2024'],
            asOfDates: ['2024-12-31'],
            latestAsOf: '2024-12-31',
          },
        },
      ],
    });
    const byYear = Object.fromEntries(payload.timelines[0].slots.map((s) => [s.year, s]));
    expect(byYear[2024].status).toBe('loaded');
    expect(byYear[2022].status).toBe('not-published');
    expect(byYear[2022].reason).toMatch(/will not invent KY/);
    expect(byYear[2018].status).toBe('not-published');
    expect(byYear[2018].reason).toMatch(/no publisher year column/);
  });

  it('marks county archive 404 probes as not-published', () => {
    const payload = buildSourceTimelines({
      asOf: new Date('2026-08-03T12:00:00Z'),
      spectrumRows: [
        {
          kind: 'source',
          fromSysId: 'KY_DMS_COUNTY_COUNTS',
          publisher: 'KY DMS',
          disposition: 'LOADED',
          provides: { cadence: 'monthly PDF', publicUris: ['https://chfs.ky.gov/'] },
          loadedDepth: {
            periodIds: ['ky202401', 'ky202501', 'ky202607'],
            asOfDates: ['2024-01-01', '2025-01-01', '2026-07-01'],
          },
          archiveProbe: [
            {
              periodId: 'ky202412',
              uri: 'https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20241201.pdf',
              httpStatus: 404,
              parseStatus: 'NOT_FOUND',
            },
            {
              periodId: 'ky202607',
              uri: 'https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20260713.pdf',
              httpStatus: 200,
              parseStatus: 'LOADED',
            },
          ],
        },
      ],
    });
    const tl = payload.timelines[0];
    const dec2024 = tl.slots.find((s) => s.slotId === '2024-12');
    expect(dec2024.status).toBe('not-published');
    expect(dec2024.reason).toMatch(/404/);
    expect(dec2024.description).not.toBe(dec2024.reason);
    const jan2024 = tl.slots.find((s) => s.slotId === '2024-01');
    expect(jan2024.status).toBe('loaded');
    const jul2026 = tl.slots.find((s) => s.slotId === '2026-07');
    expect(jul2026.status).toBe('loaded');
    expect(jul2026.dataUri).toMatch(/KYDWMMCC20260713\.pdf/);
  });

  it('builds a structured source description', () => {
    const text = buildSourceDescription(
      {
        fromSysId: 'KY_DMS_MCO_CONTRACTS',
        publisher: 'Kentucky CHFS / DMS',
        provides: { cadence: 'event / page update', grain: 'state × as-of roster' },
        availableDepth: 'Active MCO contract roster on DMS contracts page.',
        loadedDepth: {
          psaBind: { why: 'DecisionPro lands the full in-scope roster.' },
          sourceRecordNote: 'Publisher unit is contracted MCO plans.',
        },
      },
      { cadence: 'event / page update' },
      { attributionNotes: 'Cite DMS managed care contracts page and effective dates' },
    );
    expect(text).toMatch(/What it is\./);
    expect(text).toMatch(/What it contains\./);
    expect(text).toMatch(/Why DecisionPro includes it\./);
    expect(text).toMatch(/Available form:/);
    expect(text).toMatch(/irregular over the 10-year look-back/);

    const sections = parseSourceDescriptionSections(text);
    expect(sections.map((s) => s.heading)).toEqual([
      'What it is',
      'What it contains',
      'Why DecisionPro includes it',
      'Available form',
      'Publishing cadence',
    ]);
    expect(sections[0].body).toMatch(/Cite DMS managed care/);
    expect(sections[4].body).toMatch(/^Event\/snapshot/i);
  });

  it('attaches filtered preview rows for a loaded Core Set slot', () => {
    const row = {
      fromSysId: 'CMS_MEDICAID_SCORECARD',
      disposition: 'LOADED',
      loadedDepth: { loadedRowCount: 14 },
    };
    const slot = attachSlotPreview(
      {
        slotId: '2024',
        year: 2024,
        periodLabel: '2024',
        asOfDate: '2024-12-31',
        status: 'loaded',
      },
      row,
    );
    expect(slot.preview.rows.length).toBeGreaterThan(0);
    expect(slot.preview.columns).toContain('measure_id');
  });

  it('marks ACS years after the inventoried publisher window as not-published', () => {
    const payload = buildSourceTimelines({
      asOf: new Date('2026-08-03T12:00:00Z'),
      spectrumRows: [
        {
          kind: 'source',
          fromSysId: 'CENSUS_ACS',
          publisher: 'Census / KFF',
          disposition: 'LOADED',
          provides: { cadence: 'annual ACS / KFF republish' },
          loadedDepth: {
            periodIds: ['cy2017', 'cy2024'],
            asOfDates: ['2017-12-31', '2024-12-31'],
            latestAsOf: '2024-12-31',
          },
          availableDepth: 'KFF years 2008–2019 and 2021–2024',
        },
      ],
    });
    const byYear = Object.fromEntries(payload.timelines[0].slots.map((s) => [s.year, s]));
    expect(byYear[2024].status).toBe('loaded');
    expect(byYear[2017].status).toBe('loaded');
    expect(byYear[2025].status).toBe('not-published');
    expect(byYear[2025].reason).toMatch(/through CY2024/);
  });

  it('marks AHRF HPSA years through CY2025 as loaded and later years not-published', () => {
    const payload = buildSourceTimelines({
      asOf: new Date('2026-08-03T12:00:00Z'),
      spectrumRows: [
        {
          kind: 'source',
          fromSysId: 'HRSA_AHRF',
          publisher: 'HRSA',
          disposition: 'LOADED',
          provides: { cadence: 'annual / periodic AHRF release' },
          loadedDepth: {
            periodIds: [
              'cy2017',
              'cy2018',
              'cy2019',
              'cy2020',
              'cy2021',
              'cy2022',
              'cy2023',
              'cy2024',
              'cy2025',
            ],
            asOfDates: [
              '2017-12-31',
              '2018-12-31',
              '2019-12-31',
              '2020-12-31',
              '2021-12-31',
              '2022-12-31',
              '2023-12-31',
              '2024-12-31',
              '2025-12-31',
            ],
            latestAsOf: '2025-12-31',
          },
          availableDepth: 'KY Primary Care HPSA designated-county counts CY2017–CY2025',
        },
      ],
      available: {
        sources: {
          HRSA_AHRF: {
            archiveProbe: [
              {
                periodId: 'cy2025',
                uri: 'https://data.hrsa.gov/DataDownload/AHRF/AHRF_2024-2025_CSV.zip',
                httpStatus: 200,
                parseStatus: 'LOADED',
              },
            ],
          },
        },
      },
    });
    const byYear = Object.fromEntries(payload.timelines[0].slots.map((s) => [s.year, s]));
    expect(byYear[2017].status).toBe('loaded');
    expect(byYear[2025].status).toBe('loaded');
    expect(byYear[2026].status).toBe('not-published');
    expect(byYear[2026].reason).toMatch(/still in progress|not yet evidenced|not published/i);
  });
});
