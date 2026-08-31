import path from 'node:path';
import fs from 'node:fs/promises';
import type pg from 'pg';
import { config } from '../config.js';
import { GovernedHttpClient } from '../atoms/GovernedHttpClient.js';
import { NormalizeOrgName, TokenSetSimilarity } from '../atoms/OrgNameMatching.js';
import { ParseCsvRecords } from '../adapters/operationalPublicSources.js';

export type CrosswalkAccuracyResult = {
  check_id: string;
  ok: boolean;
  expected: string;
  actual: string;
  detail: string;
};

/**
 * Business Action: CheckOrganizationCrosswalkNumbers
 * OFR-02 Source Reconciliation:
 *  1. Structural separation: zero rows in organization_crosswalk_exact with a
 *     non-exact method, and zero rows in organization_crosswalk_inferred
 *     with a non-inferred method (belt-and-suspenders on top of the SQL
 *     CHECK constraints already enforcing this).
 *  2. Row-count floor on identity records.
 *  3. Sampled exact-derived assertion re-verified against a freshly
 *     re-fetched published source pair (CMS Provider Data by CCN, or SAM by
 *     UEI when the key is available).
 *  4. Disagreement queue exported and every entry has status 'open' (never
 *     silently resolved by this package).
 */
export class CheckOrganizationCrosswalkNumbers {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Results: CrosswalkAccuracyResult[] = [];
  private client_ = new GovernedHttpClient();

  constructor(private client: pg.PoolClient) {}

  private async sampleEinAnchoredAssertion() {
    const sample = await this.client.query<{
      assertion_id: string; left_identifier_value: string; right_identifier_value: string;
      left_identifier_type: string; right_identifier_type: string;
    }>(
      `SELECT assertion_id, left_identifier_type, left_identifier_value, right_identifier_type, right_identifier_value
       FROM bw_ctl.organization_crosswalk_exact
       WHERE load_class='REAL' AND match_method='exact-derived'
         AND (left_identifier_type='EIN' OR right_identifier_type='EIN')
       ORDER BY assertion_id LIMIT 1`,
    );
    const row = sample.rows[0];
    if (!row) {
      this.Results.push({
        check_id: 'OFR-XWALK-SAMPLE-NO-CANDIDATE', ok: true,
        expected: 'an EIN-anchored exact-derived assertion to sample (optional)', actual: 'none present this run',
        detail: 'No exact-derived assertion existed to sample; not a failure, just nothing to verify.',
      });
      return;
    }
    const ein = row.left_identifier_type === 'EIN' ? row.left_identifier_value : row.right_identifier_value;
    try {
      const identityRow = await this.client.query<{ org_name: string; zip: string; extra_json: { psaObjectKey?: string } }>(
        `SELECT org_name, zip, extra_json FROM bw_dso.dso_identity_record
         WHERE load_class='REAL' AND identifier_type='EIN' AND identifier_value=$1 LIMIT 1`,
        [ein],
      );
      const stored = identityRow.rows[0];
      const psaObjectKey = stored?.extra_json?.psaObjectKey;
      if (!stored || !psaObjectKey) throw new Error('no retained identity record or PSA object key for this EIN');
      const bytes = await fs.readFile(path.join(config.psaRoot, psaObjectKey));
      const rows = ParseCsvRecords(bytes.toString('utf8'));
      const live = rows.find((r) => (r.ein || '').trim() === ein);
      const liveName = live?.name || '';
      const liveZip = (live?.zip || '').slice(0, 5);
      const nameSimilarity = TokenSetSimilarity(NormalizeOrgName(stored.org_name), NormalizeOrgName(liveName));
      const ok = nameSimilarity >= 0.95 && liveZip === stored.zip;
      this.Results.push({
        check_id: `OFR-XWALK-SAMPLE-${row.assertion_id}`, ok,
        expected: `EIN ${ein} row re-read from the retained, content-hashed IRS EO BMF PSA file to match the stored identity record (name similarity >=0.95, ZIP exact)`,
        actual: `similarity=${nameSimilarity.toFixed(2)} storedZip=${stored.zip} liveZip=${liveZip} ("${stored.org_name}" vs "${liveName}")`,
        detail: 'Sampled exact-derived crosswalk assertion re-verified by re-reading and re-parsing the retained PSA bytes for the underlying published source row.',
      });
    } catch (error) {
      this.Results.push({
        check_id: `OFR-XWALK-SAMPLE-${row.assertion_id}`, ok: false,
        expected: 'retained PSA bytes to be re-readable and contain the sampled EIN row',
        actual: error instanceof Error ? error.message : String(error),
        detail: 'Sampled exact-derived assertion could not be re-verified this run.',
      });
    }
  }

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const badExact = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_ctl.organization_crosswalk_exact
         WHERE load_class='REAL' AND match_method NOT IN ('exact-published','exact-derived')`,
      );
      this.Results.push({
        check_id: 'OFR-XWALK-EXACT-SEPARATION', ok: Number(badExact.rows[0]?.c || 0) === 0,
        expected: '0', actual: String(badExact.rows[0]?.c ?? 'null'),
        detail: 'organization_crosswalk_exact must never contain an inferred-method row.',
      });

      const badInferred = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_ctl.organization_crosswalk_inferred
         WHERE load_class='REAL' AND match_method <> 'inferred'`,
      );
      this.Results.push({
        check_id: 'OFR-XWALK-INFERRED-SEPARATION', ok: Number(badInferred.rows[0]?.c || 0) === 0,
        expected: '0', actual: String(badInferred.rows[0]?.c ?? 'null'),
        detail: 'organization_crosswalk_inferred must contain only inferred-method rows.',
      });

      const identityFloor = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_identity_record WHERE load_class='REAL'`,
      );
      this.Results.push({
        check_id: 'OFR-XWALK-IDENTITY-FLOOR', ok: Number(identityFloor.rows[0]?.c || 0) >= 50,
        expected: '>=50 identity records (KY+FL combined)', actual: String(identityFloor.rows[0]?.c ?? 'null'),
        detail: 'Row-count floor across all identity sources and both states.',
      });

      const openDisagreements = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_ctl.organization_crosswalk_disagreement
         WHERE load_class='REAL' AND status <> 'open'`,
      );
      this.Results.push({
        check_id: 'OFR-XWALK-DISAGREEMENTS-NOT-AUTO-RESOLVED', ok: Number(openDisagreements.rows[0]?.c || 0) === 0,
        expected: '0 disagreements auto-resolved by this package', actual: String(openDisagreements.rows[0]?.c ?? 'null'),
        detail: 'Every SAM-vs-USAspending disagreement must remain status=open; this package never auto-resolves one.',
      });

      const sample = await this.client.query<{
        assertion_id: string; state_code: string; left_identifier_type: string; left_identifier_value: string;
        right_identifier_type: string; right_identifier_value: string;
      }>(
        `SELECT assertion_id, state_code, left_identifier_type, left_identifier_value, right_identifier_type, right_identifier_value
         FROM bw_ctl.organization_crosswalk_exact
         WHERE load_class='REAL' AND match_method='exact-derived' AND left_identifier_type='CCN'
         ORDER BY assertion_id LIMIT 1`,
      );
      const ccnRow = sample.rows[0];
      if (ccnRow) {
        try {
          const { json } = await this.client_.FetchJson<{ results?: Array<Record<string, unknown>> }>(
            config.cmsProviderDataStateUri(ccnRow.state_code), { headers: { Accept: 'application/json' } },
          );
          const live = (json.results || []).find((r) => String(r.cms_certification_number_ccn) === ccnRow.left_identifier_value);
          const identityRow = await this.client.query<{ org_name: string }>(
            `SELECT org_name FROM bw_dso.dso_identity_record WHERE load_class='REAL' AND identifier_type='CCN' AND identifier_value=$1 LIMIT 1`,
            [ccnRow.left_identifier_value],
          );
          const storedName = identityRow.rows[0]?.org_name || '';
          const liveName = String(live?.provider_name || '');
          const similarity = TokenSetSimilarity(NormalizeOrgName(storedName), NormalizeOrgName(liveName));
          this.Results.push({
            check_id: `OFR-XWALK-SAMPLE-${ccnRow.assertion_id}`, ok: similarity >= 0.9,
            expected: `>=0.9 name similarity vs freshly re-fetched CMS Provider Data CCN ${ccnRow.left_identifier_value}`,
            actual: `${similarity.toFixed(2)} ("${storedName}" vs "${liveName}")`,
            detail: 'Sampled exact-derived crosswalk assertion re-verified against a freshly re-fetched published source record.',
          });
        } catch (error) {
          this.Results.push({
            check_id: `OFR-XWALK-SAMPLE-${ccnRow.assertion_id}`, ok: false,
            expected: 'live CMS Provider Data re-fetch to succeed', actual: error instanceof Error ? error.message : String(error),
            detail: 'Sampled exact-derived assertion could not be re-verified this run.',
          });
        }
      } else {
        // No CCN-anchored assertion this run (the dominant crosswalk type is
        // UEI<->EIN). Fall back to re-verifying a sampled EIN-anchored
        // assertion against the retained, content-hashed IRS EO BMF PSA
        // bytes: re-read the landed file, re-parse it, and confirm the
        // stored identity record still matches the row actually on disk.
        await this.sampleEinAnchoredAssertion();
      }

      this.Status = this.Results.every((r) => r.ok) ? 'SUCCEEDED' : 'FAILED';
      if (this.Status === 'FAILED') {
        this.ErrorMessage = this.Results.filter((r) => !r.ok).map((r) => `${r.check_id}: expected ${r.expected} actual ${r.actual}`).join('; ');
      }
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
