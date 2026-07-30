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
- Marketing site (separate repo): https://github.com/kg-modus-novus/decisionpro-web

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

## Git and environments

Wireframe V1 static build publishes to GitHub Pages (`gh-pages`) and is intended
for the custom domain `demo.DecisionPro.io`. The project Pages URL
`https://kg-modus-novus.github.io/DecisionPro/` remains available.

Ask Sam live LLM calls require a local `.env` and the Vite dev server; the
Pages build runs the offline wireframe assistant only.

Do not commit secrets, credentials, PHI, person-level Medicaid records, generated
build output, or local environment files.
