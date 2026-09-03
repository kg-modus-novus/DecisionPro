# DecisionPro

DecisionPro Kentucky — Legislative Modeling & Decision Support System.

A product of **XenoDroid Inc.**

DecisionPro helps legislators, legislative analysts, Medicaid leadership, and
budget and oversight staff examine where Medicaid money is going, what is
driving change, and which policy, contracting, program, or data-quality
interventions warrant examination.

## Relationship to LMDSys

DecisionPro is a new product line and repository. The earlier LMDSys wireframe
remains a separate legacy project and is not modified by DecisionPro work.

## Current status

Wireframe V1 is a fixture-driven interaction prototype on local port **5040**.
It is not a production service. Views are aggregate / de-identified only.

**XenoDroid BW** (`xenodroid-bw/`) hydrates the public-REAL path: PSA →
Detail DSO → cubes via Data Requests (Postgres on **5042**). After
`npm run bw:gate`, Role Home, Evidence Rooms, and Consideration Blender use
REAL values or labeled Gap objects (no synthetic analytical magnitudes).
Browse **Authoritative sources** in the left nav for the SoT catalogue with links.
See `docs/planning/real-data-hydration-plan.md`.

The product is state-neutral: the bare URL is a neutral landing page, and
`?state=KY` / `?state=FL` route into the Kentucky and Florida products
respectively, each from its own hydration. The **Organization Funding &
Resilience Intelligence** (OFR) work package (`docs/planning/organization-funding-resilience-intelligence-plan.md`,
completion status in `docs/planning/ofr-completion-report.md`) adds a
state-neutral **Funding & Resilience** Evidence Room covering federal award
expirations, an identity crosswalk, nonprofit and facility financial-
resilience signals, common ownership, sub-award funding flow, and a
waiver/grant funding horizon — hydrated via the same `npm run bw:gate`
sequence, from nine federal publisher sources (USAspending, SAM.gov, IRS EO
BMF, NPPES, IRS SOI Form 990, CMS HCRIS, CMS ownership PUFs, CMS Medicaid.gov
1115 demonstration pages, Grants.gov).

Each state's **Operational intelligence** page opens with an **Operational
briefing** strip: ranked cross-source inferences (plan-period accountability
concentration and comparability, state-reported sanction records, the
funding-runway composition, successor opportunities, sub-award cliff cascades,
county access exposure, compound facility review candidates, relevance-gated
nonprofit liquidity) built from the joined exports, each with a governed
headline, its sources, a validation question, an accountable owner, and a
deep-link into the goal page or the pre-filtered Evidence Room. The same
build closed the Florida Care Compare gap, added a resumable SAM.gov
resolution, a CMS-reported chain graph keyed on chain id (person-name labels
withheld), and a Kentucky MCO contract section index that resolves MCPAR
sanction citations to a section title and page. See
`docs/planning/operational-briefing-depot-inference-plan.md`.

## Project map

- `docswamp/` — requirements provenance copied at project inception
- `ports.json` — reserved local development ports (`5040–5049`)
- `wireframe V1/` — executable Vite React wireframe under `wireframe V1/app`
- `.cursor/rules/` — Scriptorium identity and project guidance

## Scriptorium registration

- App ID: `decisionpro`
- Canonical Git repository: this directory
- Reserved frontend block: `5040–5049`
- Local URL: `http://localhost:5040`
- GitHub: https://github.com/kg-modus-novus/DecisionPro
- Demo: https://demo.DecisionPro.io
- Demo fallback: https://kg-modus-novus.github.io/DecisionPro/
- Marketing: https://DecisionPro.io
- Marketing fallback: https://decisionpro-web.vercel.app
- Marketing site repo: https://github.com/kg-modus-novus/decisionpro-web
- DNS handoff: `docs/DNS.md`

## Development and verification

```powershell
npm install
npm --prefix "wireframe V1/app" install
npm run dev
```

Open http://localhost:5040

```powershell
npm run test
npm run build
npm run harness:verify
```

### XenoDroid BW (accurate public-data gate)

```powershell
npm run bw:install
npm run bw:up
npm run bw:gate
```

See `xenodroid-bw/README.md`. Sequence: TEST load → thorough checks → purge →
REAL ETL → accuracy check → UI export.

## Git and environments

Wireframe V1 static build publishes to GitHub Pages (`gh-pages`). Until GoDaddy
DNS for `demo.DecisionPro.io` is in place, use
`https://kg-modus-novus.github.io/DecisionPro/`. See `docs/DNS.md`.

Ask Sam uses same-origin middleware during local development. The documented
public demo hosts call the separately deployed Vercel API, with
`VITE_ASK_SAM_API_BASE` available as an explicit build-time override.

Do not commit secrets, credentials, PHI, person-level Medicaid records, generated
build output, or local environment files.
