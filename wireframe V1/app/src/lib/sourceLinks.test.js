import { describe, expect, it } from 'vitest';
import { isDownloadableSourceUri, resolveSourceLinks } from './sourceLinks.js';

describe('sourceLinks', () => {
  it('detects downloadable file URIs', () => {
    expect(
      isDownloadableSourceUri('https://download.medicaid.gov/data/pi-dataset-june-2026-release.csv'),
    ).toBe(true);
    expect(
      isDownloadableSourceUri(
        'https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20250101.pdf',
      ),
    ).toBe(true);
    expect(
      isDownloadableSourceUri('https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360'),
    ).toBe(false);
  });

  it('pairs CMS PI CSV with containing dataset page', () => {
    const links = resolveSourceLinks({
      fromSysId: 'CMS_DATA_MEDICAID_ENR',
      provenance: {
        sourceUri: 'https://download.medicaid.gov/data/pi-dataset-june-2026-release.csv',
      },
    });
    expect(links.showFileAndPage).toBe(true);
    expect(links.sourcePageUri).toContain('data.medicaid.gov/dataset/');
  });

  it('pairs EQRO PDF with Quality Branch page when provenance page equals file', () => {
    const links = resolveSourceLinks({
      fromSysId: 'KY_DMS_MCO_EVAL',
      provenance: {
        sourceUri:
          'https://www.chfs.ky.gov/agencies/dms/DMSMCOReports/2025%20FY%20Comprehensive%20Evaluation%20Summary.pdf',
        sourcePageUri:
          'https://www.chfs.ky.gov/agencies/dms/DMSMCOReports/2025%20FY%20Comprehensive%20Evaluation%20Summary.pdf',
      },
    });
    expect(links.showFileAndPage).toBe(true);
    expect(links.sourcePageUri).toContain('mco-qb');
  });
});
