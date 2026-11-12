"""Stage the oversight aggregates (Potential Fraud Detection: early warning, follow the billers,
provider patterns) from the HHS Open Data "Medicaid Provider Spending by HCPCS" file (T-MSIS,
2018-2024) joined to NPPES, at the grains the warehouse loads. Counts and dollars only: no
provider identifier, name or address is written.

Usage (from the data-cache venv, which has duckdb):
    python stage_oversight_aggregates.py <cache_dir> [<out_dir>]

Inputs:
    <cache_dir>/hhs_2026-02-09/medicaid-provider-spending.parquet   publisher file (v2026-02-09)
    <cache_dir>/hf_cfahlgren1_13f104e/billing-providers.parquet      NPPES mirror (rev 13f104e)
    <cache_dir>/hf_cfahlgren1_13f104e/servicing-providers.parquet
    <cache_dir>/stage/stage.duckdb     the share-and-surge stage (npi_year, first_year), read only
    <out_dir>/groups.csv               state, hcpcs, year, screen_load_history_id: the biller
                                       groups to follow (written by `cli.ts oversight-groups`)
    <out_dir>/monthly_keys.csv         state, hcpcs, screen_load_history_id: the state x code
                                       series to stage by month (same command)

The state rule is the share-and-surge stage's: a row's state is the billing provider's NPPES
practice state, else the servicing provider's, else UNMATCHED (not staged here).

Outputs under <out_dir> (default <cache_dir>/stage-oversight):
    state_code_month.csv      month, state, hcpcs, paid, billing_npis      (monthly_keys only)
    code_month.csv            month, hcpcs, paid: every state and UNMATCHED (the codes of monthly_keys)
    biller_group_year.csv     group_state, group_hcpcs, group_year, yr, members, members_billing,
                              members_paid, members_code_paid
    biller_group_service.csv  group_state, group_hcpcs, group_year, hcpcs, yr, members_billing, paid
                              (the group's own code, and the GROUP_OTHER_SERVICES other codes the
                              group was paid most for in any one year; each in every state)
    biller_profile.csv        state, hcpcs, yr, and the profile counts below (latest year only)
    biller_profile_area.csv   state, hcpcs, yr, zip3, city, billers, paid
    code_labels.csv           hcpcs, label: the short description of each code these files carry
    manifest.json             parameters, inputs, row counts and totals

Profile (latest year, every state x code with at least PROFILE_MIN_BILLERS billers and
PROFILE_MIN_PAID paid): billers grouped by the year they first billed the code in the state
(before the year before, the year before, the year itself) and by whether they depend on the code
(it is at least DEPENDENCE_SHARE of their payments for every service that year); billers with no
payment of any kind before the year before; billers enumerated in NPPES within RECENT_NPPES_YEARS
before the year; million-dollar billers (paid MILLION for the code that year) and how many reached
MILLION paid for the code within FAST_MONTHS months of their first month billing it, with the median
months; billers sharing an NPPES practice address (line 1 and five-digit ZIP) with another biller
of the code; the ten largest billers' paid; NPPES entity types.

This is data staging, not business logic: it serialises the publisher file at declared grains.
Which differences matter, and how they are worded, is decided in the app's program containers.
"""
import csv
import duckdb
import hashlib
import json
import os
import sys
import time

cache = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(cache, 'stage-oversight')
os.makedirs(out, exist_ok=True)


def p(*parts):
    return os.path.join(*parts).replace('\\', '/')


spend = p(cache, 'hhs_2026-02-09', 'medicaid-provider-spending.parquet')
prov_file = p(cache, 'hf_cfahlgren1_13f104e', 'billing-providers.parquet')
sprov_file = p(cache, 'hf_cfahlgren1_13f104e', 'servicing-providers.parquet')
share_stage = p(cache, 'stage', 'stage.duckdb')
groups_file = p(out, 'groups.csv')
keys_file = p(out, 'monthly_keys.csv')

PROFILE_MIN_BILLERS = 11
PROFILE_MIN_PAID = 1_000_000
DEPENDENCE_SHARE = 0.5
RECENT_NPPES_YEARS = 2          # enumerated in the year two before the profile year, or later
MILLION = 1_000_000
FAST_MONTHS = 6
GROUP_OTHER_SERVICES = 8

t0 = time.time()


def log(*a):
    print(*a, round(time.time() - t0, 1), flush=True)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 24), b''):
            h.update(chunk)
    return h.hexdigest()


def screen_load_ids(path):
    with open(path, newline='', encoding='utf-8') as fh:
        return sorted({r['screen_load_history_id'] for r in csv.DictReader(fh)})


group_screen = screen_load_ids(groups_file)
key_screen = screen_load_ids(keys_file)
if len(group_screen) != 1 or group_screen != key_screen:
    raise SystemExit(f'groups.csv and monthly_keys.csv must come from one screen load: {group_screen} {key_screen}')

c = duckdb.connect(p(out, 'oversight.duckdb'))
c.sql("SET memory_limit='10GB'; SET threads=8; SET preserve_insertion_order=false;")
c.sql(f"ATTACH '{share_stage}' AS share (READ_ONLY)")
set_aside_rule = "HCPCS_CODE = '20' AND (BILLING_PROVIDER_NPI_NUM IS NULL OR BILLING_PROVIDER_NPI_NUM = '')"
c.sql(f"CREATE OR REPLACE VIEW kept AS SELECT * FROM '{spend}' WHERE NOT ({set_aside_rule})")
c.sql(f"CREATE OR REPLACE TABLE prov AS SELECT npi, upper(trim(state)) AS state FROM '{prov_file}' WHERE npi IS NOT NULL")
c.sql(f"CREATE OR REPLACE TABLE sprov AS SELECT npi, upper(trim(state)) AS state FROM '{sprov_file}' WHERE npi IS NOT NULL")
c.sql(f"""
CREATE OR REPLACE TABLE nppes AS
SELECT npi, entity_type, enumeration_date,
       nullif(upper(trim(address_line1)), '') AS address_line1,
       nullif(substr(trim(zip), 1, 5), '') AS zip5,
       nullif(substr(trim(zip), 1, 3), '') AS zip3,
       nullif(upper(trim(city)), '') AS city
FROM '{prov_file}' WHERE npi IS NOT NULL
""")
c.sql(f"CREATE OR REPLACE TABLE groups AS SELECT state, hcpcs, CAST(year AS VARCHAR) AS yr FROM read_csv('{groups_file}', header=true, all_varchar=true)")
c.sql(f"CREATE OR REPLACE TABLE monthly_keys AS SELECT state, hcpcs FROM read_csv('{keys_file}', header=true, all_varchar=true)")
c.sql("""
CREATE OR REPLACE TABLE npi_year AS
SELECT yr, hcpcs, state, billing_npi, sum(paid) AS paid
FROM share.npi_year WHERE billing_npi <> '' AND state <> 'UNMATCHED' GROUP BY ALL
""")
c.sql("CREATE OR REPLACE TABLE first_year AS SELECT state, hcpcs, billing_npi, first_yr FROM share.first_year WHERE billing_npi <> ''")
latest = c.execute("SELECT max(yr) FROM npi_year").fetchall()[0][0]
year_before = str(int(latest) - 1)
log('npi_year', c.execute('select count(*) from npi_year').fetchall()[0][0], 'latest', latest)

# ---- Monthly series for the screen's state x code keys
c.sql("""
CREATE OR REPLACE TABLE attributed_month AS
SELECT s.CLAIM_FROM_MONTH AS month, s.HCPCS_CODE AS hcpcs,
       coalesce(p.state, q.state, 'UNMATCHED') AS state,
       coalesce(s.BILLING_PROVIDER_NPI_NUM, '') AS billing_npi,
       s.TOTAL_PAID AS paid
FROM kept s
LEFT JOIN prov p ON s.BILLING_PROVIDER_NPI_NUM = p.npi
LEFT JOIN sprov q ON s.SERVICING_PROVIDER_NPI_NUM = q.npi
WHERE s.HCPCS_CODE IN (SELECT DISTINCT hcpcs FROM monthly_keys)
""")
log('attributed_month', c.execute('select count(*) from attributed_month').fetchall()[0][0])
c.sql(f"""
COPY (
  SELECT a.month, a.state, a.hcpcs, round(sum(a.paid), 2) AS paid,
         count(DISTINCT nullif(a.billing_npi, ''))::BIGINT AS billing_npis
  FROM attributed_month a JOIN monthly_keys k USING (state, hcpcs)
  GROUP BY ALL ORDER BY a.state, a.hcpcs, a.month
) TO '{p(out, 'state_code_month.csv')}' (HEADER, DELIMITER ',')
""")
log('state_code_month written')
c.sql(f"""
COPY (
  SELECT month, hcpcs, round(sum(paid), 2) AS paid FROM attributed_month GROUP BY ALL ORDER BY hcpcs, month
) TO '{p(out, 'code_month.csv')}' (HEADER, DELIMITER ',')
""")
log('code_month written')

# ---- Biller groups: the billers of a code in a state in a year, followed across every service
c.sql("""
CREATE OR REPLACE TABLE members AS
SELECT DISTINCT g.state AS group_state, g.hcpcs AS group_hcpcs, g.yr AS group_year, n.billing_npi
FROM groups g JOIN npi_year n ON n.state = g.state AND n.hcpcs = g.hcpcs AND n.yr = g.yr
""")
c.sql("CREATE OR REPLACE TABLE member_count AS SELECT group_state, group_hcpcs, group_year, count(*)::BIGINT AS members FROM members GROUP BY ALL")
c.sql("CREATE OR REPLACE TABLE npi_any_year AS SELECT billing_npi, yr, hcpcs, state, sum(paid) AS paid FROM npi_year GROUP BY ALL")
c.sql("""
CREATE OR REPLACE TABLE member_rows AS
SELECT m.group_state, m.group_hcpcs, m.group_year, m.billing_npi, n.yr, n.hcpcs, n.state, n.paid
FROM members m JOIN npi_any_year n USING (billing_npi)
""")
years = [r[0] for r in c.sql('SELECT DISTINCT yr FROM npi_year ORDER BY 1').fetchall()]
c.sql("CREATE OR REPLACE TABLE years AS SELECT DISTINCT yr FROM npi_year")
c.sql(f"""
COPY (
  SELECT k.group_state, k.group_hcpcs, k.group_year, y.yr, k.members,
         count(DISTINCT r.billing_npi)::BIGINT AS members_billing,
         round(coalesce(sum(r.paid), 0), 2) AS members_paid,
         round(coalesce(sum(CASE WHEN r.hcpcs = k.group_hcpcs AND r.state = k.group_state THEN r.paid END), 0), 2) AS members_code_paid
  FROM member_count k CROSS JOIN years y
  LEFT JOIN member_rows r ON r.group_state = k.group_state AND r.group_hcpcs = k.group_hcpcs AND r.group_year = k.group_year AND r.yr = y.yr
  GROUP BY ALL ORDER BY 1, 2, 3, 4
) TO '{p(out, 'biller_group_year.csv')}' (HEADER, DELIMITER ',')
""")
c.sql(f"""
CREATE OR REPLACE TABLE group_service AS
SELECT group_state, group_hcpcs, group_year, hcpcs, yr,
       count(DISTINCT billing_npi)::BIGINT AS members_billing, sum(paid) AS paid
FROM member_rows GROUP BY ALL
""")
c.sql(f"""
CREATE OR REPLACE TABLE group_top_service AS
SELECT group_state, group_hcpcs, group_year, hcpcs FROM (
  SELECT group_state, group_hcpcs, group_year, hcpcs,
         row_number() OVER (PARTITION BY group_state, group_hcpcs, group_year ORDER BY peak_paid DESC, hcpcs) AS rank
  FROM (SELECT group_state, group_hcpcs, group_year, hcpcs, max(paid) AS peak_paid FROM group_service WHERE hcpcs <> group_hcpcs GROUP BY ALL)
) WHERE rank <= {GROUP_OTHER_SERVICES}
UNION ALL
SELECT DISTINCT group_state, group_hcpcs, group_year, group_hcpcs AS hcpcs FROM members
""")
c.sql(f"""
COPY (
  SELECT t.group_state, t.group_hcpcs, t.group_year, t.hcpcs, y.yr,
         coalesce(s.members_billing, 0)::BIGINT AS members_billing, round(coalesce(s.paid, 0), 2) AS paid
  FROM group_top_service t CROSS JOIN years y
  LEFT JOIN group_service s ON s.group_state = t.group_state AND s.group_hcpcs = t.group_hcpcs AND s.group_year = t.group_year AND s.hcpcs = t.hcpcs AND s.yr = y.yr
  ORDER BY 1, 2, 3, 4, 5
) TO '{p(out, 'biller_group_service.csv')}' (HEADER, DELIMITER ',')
""")
log('biller groups written', c.execute('select count(*), sum(members) from member_count').fetchall()[0])

# ---- Biller profile, latest year
c.sql(f"""
CREATE OR REPLACE TABLE profile_keys AS
SELECT state, hcpcs FROM npi_year WHERE yr = '{latest}'
GROUP BY ALL HAVING count(DISTINCT billing_npi) >= {PROFILE_MIN_BILLERS} AND sum(paid) >= {PROFILE_MIN_PAID}
""")
c.sql(f"CREATE OR REPLACE TABLE biller_total AS SELECT billing_npi, sum(paid) AS paid FROM npi_year WHERE yr = '{latest}' GROUP BY ALL")
c.sql(f"CREATE OR REPLACE TABLE biller_paid_before AS SELECT DISTINCT billing_npi FROM npi_year WHERE yr < '{year_before}'")
c.sql(f"""
CREATE OR REPLACE TABLE profile_billers AS
SELECT n.state, n.hcpcs, n.billing_npi, n.paid,
       CASE WHEN f.first_yr < '{year_before}' THEN 'established' WHEN f.first_yr = '{year_before}' THEN 'year-before' ELSE 'year' END AS cohort,
       t.paid > 0 AND n.paid >= {DEPENDENCE_SHARE} * t.paid AS depends,
       b.billing_npi IS NULL AS no_payment_before_year_before,
       x.enumeration_date IS NOT NULL AND year(x.enumeration_date) >= {int(latest) - RECENT_NPPES_YEARS} AS recently_enumerated,
       x.entity_type, x.address_line1, x.zip5, x.zip3, x.city,
       row_number() OVER (PARTITION BY n.state, n.hcpcs ORDER BY n.paid DESC, n.billing_npi) AS paid_rank
FROM (SELECT state, hcpcs, billing_npi, sum(paid) AS paid FROM npi_year WHERE yr = '{latest}' GROUP BY ALL) n
JOIN profile_keys k USING (state, hcpcs)
JOIN first_year f USING (state, hcpcs, billing_npi)
JOIN biller_total t USING (billing_npi)
LEFT JOIN biller_paid_before b USING (billing_npi)
LEFT JOIN nppes x ON x.npi = n.billing_npi
""")
# Months from a million-dollar biller's first month billing the code to the month its cumulative paid for it reached the million.
c.sql(f"""
CREATE OR REPLACE TABLE million_billers AS
SELECT state, hcpcs, billing_npi FROM profile_billers WHERE paid >= {MILLION}
""")
c.sql(f"""
CREATE OR REPLACE TABLE million_speed AS
WITH m0 AS (
  SELECT coalesce(pr.state, q.state, 'UNMATCHED') AS state, s.HCPCS_CODE AS hcpcs,
         s.BILLING_PROVIDER_NPI_NUM AS billing_npi, s.CLAIM_FROM_MONTH AS month, sum(s.TOTAL_PAID) AS paid
  FROM kept s
  JOIN (SELECT DISTINCT hcpcs, billing_npi FROM million_billers) b ON b.hcpcs = s.HCPCS_CODE AND b.billing_npi = s.BILLING_PROVIDER_NPI_NUM
  LEFT JOIN prov pr ON s.BILLING_PROVIDER_NPI_NUM = pr.npi
  LEFT JOIN sprov q ON s.SERVICING_PROVIDER_NPI_NUM = q.npi
  GROUP BY ALL
), m AS (
  SELECT x.* FROM m0 x JOIN million_billers b USING (state, hcpcs, billing_npi)
), c AS (
  SELECT *, sum(paid) OVER (PARTITION BY state, hcpcs, billing_npi ORDER BY month) AS cumulative,
         min(month) OVER (PARTITION BY state, hcpcs, billing_npi) AS first_month
  FROM m
)
SELECT state, hcpcs, billing_npi,
       min(CASE WHEN cumulative >= {MILLION} THEN
         (CAST(substr(month, 1, 4) AS INTEGER) * 12 + CAST(substr(month, 6, 2) AS INTEGER))
         - (CAST(substr(first_month, 1, 4) AS INTEGER) * 12 + CAST(substr(first_month, 6, 2) AS INTEGER)) END) AS months_to_million
FROM c GROUP BY ALL
""")
c.sql("""
CREATE OR REPLACE TABLE shared_address AS
SELECT state, hcpcs, address_line1, zip5, count(*) AS billers
FROM profile_billers WHERE address_line1 IS NOT NULL AND zip5 IS NOT NULL
GROUP BY ALL HAVING count(*) >= 2
""")
cohort_columns = []
for cohort in ('established', 'year-before', 'year'):
    for depends, label in ((True, 'depends'), (False, 'other')):
        name = f"{cohort.replace('-', '_')}_{label}"
        cond = f"cohort = '{cohort}' AND depends = {str(depends).upper()}"
        cohort_columns.append(f"count(*) FILTER (WHERE {cond})::BIGINT AS {name}_billers")
        cohort_columns.append(f"round(coalesce(sum(paid) FILTER (WHERE {cond}), 0), 2) AS {name}_paid")
c.sql(f"""
COPY (
  SELECT b.state, b.hcpcs, '{latest}' AS yr,
         count(*)::BIGINT AS billers, round(sum(b.paid), 2) AS paid,
         {', '.join(cohort_columns)},
         count(*) FILTER (WHERE no_payment_before_year_before)::BIGINT AS no_payment_before_billers,
         round(coalesce(sum(b.paid) FILTER (WHERE no_payment_before_year_before), 0), 2) AS no_payment_before_paid,
         count(*) FILTER (WHERE recently_enumerated)::BIGINT AS recently_enumerated_billers,
         round(coalesce(sum(b.paid) FILTER (WHERE recently_enumerated), 0), 2) AS recently_enumerated_paid,
         count(s.billing_npi)::BIGINT AS million_billers,
         count(*) FILTER (WHERE s.months_to_million <= {FAST_MONTHS})::BIGINT AS million_billers_fast,
         median(s.months_to_million) AS million_median_months,
         count(a.billers)::BIGINT AS shared_address_billers,
         count(DISTINCT CASE WHEN a.billers IS NOT NULL THEN b.address_line1 || '|' || b.zip5 END)::BIGINT AS shared_addresses,
         round(coalesce(sum(b.paid) FILTER (WHERE a.billers IS NOT NULL), 0), 2) AS shared_address_paid,
         round(coalesce(sum(b.paid) FILTER (WHERE paid_rank <= 10), 0), 2) AS top10_paid,
         count(*) FILTER (WHERE entity_type = 2)::BIGINT AS organization_billers,
         count(*) FILTER (WHERE entity_type = 1)::BIGINT AS individual_billers
  FROM profile_billers b
  LEFT JOIN million_speed s USING (state, hcpcs, billing_npi)
  LEFT JOIN shared_address a ON a.state = b.state AND a.hcpcs = b.hcpcs AND a.address_line1 = b.address_line1 AND a.zip5 = b.zip5
  GROUP BY b.state, b.hcpcs ORDER BY 1, 2
) TO '{p(out, 'biller_profile.csv')}' (HEADER, DELIMITER ',')
""")
c.sql(f"""
COPY (
  SELECT state, hcpcs, '{latest}' AS yr, coalesce(zip3, '') AS zip3, coalesce(mode(city), '') AS city,
         count(*)::BIGINT AS billers, round(sum(paid), 2) AS paid
  FROM profile_billers GROUP BY state, hcpcs, zip3 ORDER BY 1, 2, 4
) TO '{p(out, 'biller_profile_area.csv')}' (HEADER, DELIMITER ',')
""")
log('profiles written', c.execute('select count(*) from profile_keys').fetchall()[0][0])

labels_file = p(cache, 'hf_cfahlgren1_13f104e', 'hcpcs-codes.parquet')
c.sql(f"""
COPY (
  SELECT DISTINCT l.hcpcs_code AS hcpcs, trim(l.description) AS label
  FROM '{labels_file}' l
  WHERE l.hcpcs_code IN (SELECT hcpcs FROM monthly_keys UNION SELECT hcpcs FROM group_top_service UNION SELECT group_hcpcs FROM members UNION SELECT hcpcs FROM profile_keys)
    AND nullif(trim(l.description), '') IS NOT NULL
  ORDER BY 1
) TO '{p(out, 'code_labels.csv')}' (HEADER, DELIMITER ',')
""")
log('code labels written')


def file_stats(name, paid_column):
    f = p(out, name)
    rows, paid = c.execute(f"SELECT count(*), round(coalesce(sum({paid_column}), 0), 2) FROM read_csv_auto('{f}')").fetchall()[0]
    return {'rows': rows, 'paidTotal': paid, 'sha256': sha256(f)}


manifest = {
    'publisher': 'HHS Open Data (from CMS T-MSIS via IDR)',
    'dataset': 'Medicaid Provider Spending by HCPCS',
    'version': '2026-02-09',
    'nppes': 'NPPES Feb 2026 through a third-party mirror (Hugging Face cfahlgren1, rev 13f104e)',
    'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'parquetSha256': sha256(spend),
    'screenLoadHistoryId': group_screen[0],
    'latestYear': int(latest),
    'years': [int(y) for y in years],
    'parameters': {
        'profileMinBillers': PROFILE_MIN_BILLERS, 'profileMinPaid': PROFILE_MIN_PAID,
        'dependenceShare': DEPENDENCE_SHARE, 'recentNppesYears': RECENT_NPPES_YEARS,
        'million': MILLION, 'fastMonths': FAST_MONTHS, 'groupOtherServices': GROUP_OTHER_SERVICES,
    },
    'inputs': {'groups': c.execute('select count(*) from groups').fetchall()[0][0], 'monthlyKeys': c.execute('select count(*) from monthly_keys').fetchall()[0][0]},
    'files': {
        'state_code_month.csv': file_stats('state_code_month.csv', 'paid'),
        'code_month.csv': file_stats('code_month.csv', 'paid'),
        'biller_group_year.csv': file_stats('biller_group_year.csv', 'members_paid'),
        'biller_group_service.csv': file_stats('biller_group_service.csv', 'paid'),
        'biller_profile.csv': file_stats('biller_profile.csv', 'paid'),
        'biller_profile_area.csv': file_stats('biller_profile_area.csv', 'paid'),
    },
    'codeLabels': {'rows': c.execute(f"SELECT count(*) FROM read_csv_auto('{p(out, 'code_labels.csv')}')").fetchall()[0][0], 'sha256': sha256(p(out, 'code_labels.csv')), 'source': 'HCPCS short descriptions in the NPPES mirror (hcpcs-codes.parquet, rev 13f104e)'},
}
with open(p(out, 'manifest.json'), 'w', encoding='utf-8') as fh:
    json.dump(manifest, fh, indent=2)
log('manifest written', json.dumps(manifest['files']))
