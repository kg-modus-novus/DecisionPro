import type pg from 'pg';

export type OwnershipAccuracyResult = {
  check_id: string;
  ok: boolean;
  expected: string;
  actual: string;
  detail: string;
};

/**
 * Business Action: CheckOwnershipNetworkNumbers
 * OFR-05 Source Reconciliation: row-count floor, and a structural
 * person-level guardrail — zero rows where owner_type='individual' carry a
 * non-empty owner_organization_name (which would indicate a name leaked
 * into the wrong column), and zero rows exist with a name/DOB/address
 * column on the schema at all.
 */
export class CheckOwnershipNetworkNumbers {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Results: OwnershipAccuracyResult[] = [];

  constructor(private client: pg.PoolClient) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const floor = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_ownership_interest WHERE load_class='REAL'`,
      );
      this.Results.push({
        check_id: 'OFR-OWNERSHIP-ROW-FLOOR', ok: Number(floor.rows[0]?.c || 0) >= 5,
        expected: '>=5 REAL ownership-interest rows (KY+FL, hospital+SNF)', actual: String(floor.rows[0]?.c ?? 'null'),
        detail: 'Row-count floor across both facility types and states.',
      });

      const columns = await this.client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='bw_dso' AND table_name='dso_ownership_interest'`,
      );
      const forbidden = columns.rows.filter((r) => /first.?name|last.?name|middle.?name|\bdob\b|birth|\bssn\b|address.?line|\bcity\b|owner.?zip/i.test(r.column_name));
      this.Results.push({
        check_id: 'OFR-OWNERSHIP-NO-PERSON-LEVEL-COLUMNS', ok: forbidden.length === 0,
        expected: '0 person-level columns', actual: String(forbidden.length),
        detail: 'Structural check that no individual-owner name/address/DOB column exists on dso_ownership_interest.',
      });

      const mislabeled = await this.client.query<{ c: string }>(
        `SELECT COUNT(*)::int AS c FROM bw_dso.dso_ownership_interest
         WHERE load_class='REAL' AND owner_type='individual' AND owner_organization_name <> ''`,
      );
      this.Results.push({
        check_id: 'OFR-OWNERSHIP-INDIVIDUAL-ROWS-CARRY-NO-ORG-NAME', ok: Number(mislabeled.rows[0]?.c || 0) === 0,
        expected: '0 individual-owner rows with a non-empty owner_organization_name', actual: String(mislabeled.rows[0]?.c ?? 'null'),
        detail: 'Individual-owner rows must never carry any name field; this is the closest structural proxy check for that guarantee given owner_organization_name is the only free-text identity column on this table.',
      });

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
