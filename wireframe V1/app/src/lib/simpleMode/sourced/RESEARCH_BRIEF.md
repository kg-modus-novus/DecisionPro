# Simple-mode sourced data — research brief (shared by all research agents)

Context: DecisionPro Kentucky is a legislative dashboard for Kentucky Medicaid. The "simple view"
must show real, sourced Kentucky numbers on every tile. The Director (Ken Greenwood) has ruled that
for simple mode, figures researched from published documents may appear without passing through the
BW warehouse, but EVERY figure must be traceable to a document you actually retrieved this session.

## Hard rules
1. Never write a number from memory. Every `value` must come from a page/file you fetched with
   WebFetch/WebSearch/curl in this session, or be computed from such values (method "derived"/"estimate").
2. Prefer the most recent period available (2024–2026). Prefer primary sources: CMS/Medicaid.gov,
   CHFS/DMS, LRC committee documents (apps.legislature.ky.gov/CommitteeDocuments), KY budget office,
   IPRO EQR reports, CMS Care Compare/PBJ, HRSA, Census, MACPAC.
3. Aggregate data only. No person-level data, no names of individuals.
4. When the ideal Kentucky measure is not published anywhere, deliver BOTH:
   (a) the nearest real published measure, with `method: "published"` and `proxyFor` naming the ideal
       measure; AND
   (b) a modeled estimate of the ideal measure, `method: "estimate"`, with `methodNote` giving the
       formula and inputs (each input itself sourced in `inputs`).
5. Never label anything waste, fraud, abuse, violation or savings. Describe; don't judge.
6. If a value cannot be found after a genuine search, put it in `unresolved` with what you tried.
   Do not fabricate.
7. Do not edit any app source files other than your one output JSON. Do not commit.

## Output: one JSON file at the path given in your task, exactly this shape
{
  "area": "<area id>",
  "researchedAt": "2026-10-01",
  "measures": [
    {
      "id": "kebab-case-unique",
      "label": "Plain-language label a legislator understands",
      "value": 123.4,                     // headline number (number, not string); null only if rows carry it
      "unit": "usd" | "usd_pmpm" | "count" | "percent" | "per_1000" | "days" | "hours" | "ratio" | "index",
      "period": "SFY 2024" | "FFY 2024" | "CY 2023" | "2026-08" ...,
      "asOf": "YYYY-MM-DD",               // publication/data-as-of date
      "dimension": null | "plan" | "county" | "waiver" | "population" | "category" | "district",
      "rows": [ { "key": "...", "label": "...", "value": 1, "fips": "21111" } ],   // optional breakdown
      "series": [ { "period": "FFY 2021", "value": 1 } ],                           // optional trend
      "comparison": { "label": "US median", "value": 1 } | null,
      "target": { "label": "...", "value": 1, "basis": "statute|contract|CMS benchmark" } | null,
      "betterDirection": "higher" | "lower" | null,
      "responsible": "DMS" | "MCOs" | "CHFS" | "Providers" | "...",
      "method": "published" | "derived" | "estimate",
      "methodNote": "how derived/estimated (required unless published)",
      "proxyFor": null | "the ideal measure this stands in for",
      "inputs": [ { "label": "...", "value": 1, "source": { ... } } ],             // for derived/estimate
      "source": { "title": "...", "publisher": "...", "url": "https://...", "page": "p. 12 / table 3", "accessed": "2026-10-01" },
      "loadNote": "INTERNAL: what the BW warehouse must load to supply this properly (source system, file, refresh cadence)"
    }
  ],
  "unresolved": [ { "need": "...", "tried": ["..."] } ],
  "notes": "anything the builder must know (definitions, caveats, conflicting sources)"
}
Keep labels plain and short. Include as many well-sourced measures for your area as you can,
covering every item in your task list.
