"""Stage the HHS Open Data "Medicaid Provider Spending by HCPCS" file (T-MSIS, 2018-2024)
at the grains the warehouse loads: state x HCPCS x year and state x month.

Usage (from the data-cache venv, which has duckdb):
    python stage_tmsis_aggregates.py <cache_dir> [<out_dir>]

Inputs under <cache_dir> (built 2026-10-28 by data-cache/_scripts/tmsis/pdl.py):
    hhs_2026-02-09/medicaid-provider-spending.parquet        publisher file (v2026-02-09)
    hf_cfahlgren1_13f104e/billing-providers.parquet          NPPES practice state by NPI (mirror rev 13f104e)
    hf_cfahlgren1_13f104e/servicing-providers.parquet

Set-aside rule: publisher rows with HCPCS '20' and no billing NPI (implausible amounts, not a
code) are excluded and totalled in the manifest; the loader reconciles to keptTotalPaid.

Attribution rule (the published methodology, also used by Empower Oversight's 2026-10-29 screen):
a row's state is the billing provider's NPPES practice state; when the billing NPI is not in
NPPES, the servicing provider's; otherwise the row is kept under the state value UNMATCHED so the
national total still reconciles.

Outputs under <out_dir> (default <cache_dir>/stage):
    state_code_year.csv   yr, hcpcs, state, attribution, lines, paid, patient_cells, cells,
                          billing_npis, new_billing_npis, top10_paid, zero_paid_lines
    state_month.csv       month, state, lines, paid
    manifest.json         publisher totals, row counts, sha256 of the parquet, generated_at

This is data staging, not business logic: it serialises the publisher file at a declared grain.
"""
import duckdb
import hashlib
import json
import os
import sys
import time

cache = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(cache, 'stage')
os.makedirs(out, exist_ok=True)


def p(*parts):
    return os.path.join(*parts).replace('\\', '/')


spend = p(cache, 'hhs_2026-02-09', 'medicaid-provider-spending.parquet')
prov = p(cache, 'hf_cfahlgren1_13f104e', 'billing-providers.parquet')
sprov = p(cache, 'hf_cfahlgren1_13f104e', 'servicing-providers.parquet')
t0 = time.time()

sha = hashlib.sha256()
with open(spend, 'rb') as fh:
    for chunk in iter(lambda: fh.read(1 << 24), b''):
        sha.update(chunk)
parquet_sha256 = sha.hexdigest()
print('parquet sha256', parquet_sha256, round(time.time() - t0, 1))

c = duckdb.connect(p(out, 'stage.duckdb'))
c.sql("SET memory_limit='10GB'; SET threads=8; SET preserve_insertion_order=false;")
# Publisher rows set aside (the rule recorded with the 2026-10-28 research): HCPCS '20' with no
# billing NPI carries implausible amounts (about $20 trillion in 2018 alone) and is not a HCPCS
# code. Everything else, including rows with no NPPES match, is kept. The set-aside total is in
# the manifest so the loader reconciles to the publisher total less the set-aside.
set_aside_rule = "HCPCS_CODE = '20' AND (BILLING_PROVIDER_NPI_NUM IS NULL OR BILLING_PROVIDER_NPI_NUM = '')"
c.sql(f"""
CREATE OR REPLACE VIEW kept AS
SELECT * FROM '{spend}' WHERE NOT ({set_aside_rule})
""")
c.sql(f"CREATE OR REPLACE TABLE prov AS SELECT npi, upper(trim(state)) AS state FROM '{prov}' WHERE npi IS NOT NULL")
c.sql(f"CREATE OR REPLACE TABLE sprov AS SELECT npi, upper(trim(state)) AS state FROM '{sprov}' WHERE npi IS NOT NULL")

# Attributed rows at the provider grain the derived counts need (billing NPI x code x state x year).
c.sql(f"""
CREATE OR REPLACE TABLE npi_year AS
SELECT substr(s.CLAIM_FROM_MONTH, 1, 4) AS yr,
       s.HCPCS_CODE AS hcpcs,
       coalesce(p.state, q.state, 'UNMATCHED') AS state,
       CASE WHEN p.state IS NOT NULL THEN 'billing' WHEN q.state IS NOT NULL THEN 'servicing' ELSE 'none' END AS attribution,
       coalesce(s.BILLING_PROVIDER_NPI_NUM, '') AS billing_npi,
       sum(s.TOTAL_CLAIM_LINES)::BIGINT AS lines,
       sum(s.TOTAL_PAID)::DOUBLE AS paid,
       sum(s.TOTAL_PATIENTS)::BIGINT AS patient_cells,
       count(*)::BIGINT AS cells,
       sum(CASE WHEN s.TOTAL_PAID <= 0 THEN s.TOTAL_CLAIM_LINES ELSE 0 END)::BIGINT AS zero_paid_lines
FROM kept s
LEFT JOIN prov p ON s.BILLING_PROVIDER_NPI_NUM = p.npi
LEFT JOIN sprov q ON s.SERVICING_PROVIDER_NPI_NUM = q.npi
GROUP BY ALL
""")
print('npi_year rows', c.sql("select count(*) from npi_year").fetchall(), round(time.time() - t0, 1))

# First year each billing NPI billed the code in the state: a "new" biller is one whose first year is this year.
c.sql("""
CREATE OR REPLACE TABLE first_year AS
SELECT state, hcpcs, billing_npi, min(yr) AS first_yr FROM npi_year GROUP BY ALL
""")
c.sql("""
CREATE OR REPLACE TABLE ranked AS
SELECT n.*, f.first_yr,
       row_number() OVER (PARTITION BY n.state, n.hcpcs, n.yr ORDER BY n.paid DESC) AS paid_rank
FROM npi_year n JOIN first_year f USING (state, hcpcs, billing_npi)
""")
c.sql(f"""
COPY (
  SELECT yr, hcpcs, state,
         CASE WHEN state = 'UNMATCHED' THEN 'none' ELSE 'billing-or-servicing' END AS attribution,
         sum(lines)::BIGINT AS lines,
         round(sum(paid), 2) AS paid,
         sum(patient_cells)::BIGINT AS patient_cells,
         sum(cells)::BIGINT AS cells,
         count(DISTINCT billing_npi)::BIGINT AS billing_npis,
         count(DISTINCT CASE WHEN first_yr = yr THEN billing_npi END)::BIGINT AS new_billing_npis,
         round(sum(CASE WHEN paid_rank <= 10 THEN paid ELSE 0 END), 2) AS top10_paid,
         sum(zero_paid_lines)::BIGINT AS zero_paid_lines
  FROM ranked
  GROUP BY ALL
  ORDER BY yr, hcpcs, state
) TO '{p(out, 'state_code_year.csv')}' (HEADER, DELIMITER ',')
""")
print('state_code_year written', round(time.time() - t0, 1))

c.sql(f"""
COPY (
  SELECT s.CLAIM_FROM_MONTH AS month,
         coalesce(pr.state, q.state, 'UNMATCHED') AS state,
         sum(s.TOTAL_CLAIM_LINES)::BIGINT AS lines,
         round(sum(s.TOTAL_PAID), 2) AS paid
  FROM kept s
  LEFT JOIN prov pr ON s.BILLING_PROVIDER_NPI_NUM = pr.npi
  LEFT JOIN sprov q ON s.SERVICING_PROVIDER_NPI_NUM = q.npi
  GROUP BY ALL ORDER BY month, state
) TO '{p(out, 'state_month.csv')}' (HEADER, DELIMITER ',')
""")
print('state_month written', round(time.time() - t0, 1))

totals = c.sql(f"""
SELECT count(*), min(CLAIM_FROM_MONTH), max(CLAIM_FROM_MONTH), round(sum(TOTAL_PAID), 2), sum(TOTAL_CLAIM_LINES)
FROM '{spend}'
""").fetchall()[0]
set_aside = c.sql(f"""
SELECT count(*), round(coalesce(sum(TOTAL_PAID), 0), 2), coalesce(sum(TOTAL_CLAIM_LINES), 0)
FROM '{spend}' WHERE {set_aside_rule}
""").fetchall()[0]
scy = c.sql(f"SELECT count(*), round(sum(paid), 2) FROM read_csv_auto('{p(out, 'state_code_year.csv')}')").fetchall()[0]
sm = c.sql(f"SELECT count(*), round(sum(paid), 2) FROM read_csv_auto('{p(out, 'state_month.csv')}')").fetchall()[0]
manifest = {
    'publisher': 'HHS Open Data (from CMS T-MSIS via IDR)',
    'dataset': 'Medicaid Provider Spending by HCPCS',
    'version': '2026-02-09',
    'datasetUri': 'https://opendata.hhs.gov/datasets/medicaid-provider-spending',
    'parquetSha256': parquet_sha256,
    'nppesMirror': 'huggingface cfahlgren1/medicaid-provider-spending rev 13f104e (NPPES Feb 2026 practice address)',
    'attributionRule': 'billing NPI practice state, else servicing NPI practice state, else UNMATCHED',
    'publisherRows': totals[0],
    'firstMonth': totals[1],
    'lastMonth': totals[2],
    'publisherTotalPaid': totals[3],
    'publisherTotalClaimLines': totals[4],
    'setAsideRule': set_aside_rule,
    'setAsideRows': set_aside[0],
    'setAsidePaid': set_aside[1],
    'setAsideClaimLines': set_aside[2],
    'keptTotalPaid': round(totals[3] - set_aside[1], 2),
    'stateCodeYearRows': scy[0],
    'stateCodeYearPaid': scy[1],
    'stateMonthRows': sm[0],
    'stateMonthPaid': sm[1],
    'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
}
with open(p(out, 'manifest.json'), 'w', encoding='utf-8') as fh:
    json.dump(manifest, fh, indent=2)
print(json.dumps(manifest, indent=2))
print('done', round(time.time() - t0, 1))
