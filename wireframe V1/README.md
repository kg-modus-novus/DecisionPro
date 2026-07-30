# DecisionPro Wireframe V1

First wireframe workspace for the Medicaid Legislative Decision Support System.

## Documents

- [FINDINGS_AND_GOOD_STUFF.md](FINDINGS_AND_GOOD_STUFF.md) — consolidated keep-list, image roles, defects, truth classes  
- [CONSIDERATION_BLENDER_V1.md](CONSIDERATION_BLENDER_V1.md) — Focus Tabs + Blender interaction contract  
- [images/](images/) — directional UI mockup PNGs (reference ideation)  
- [ALP_FIXTURES.md](ALP_FIXTURES.md) — procedural cube seeds + session expansion  
- [ASK_SAM.md](ASK_SAM.md) — Ask Sam chat + live LLM setup (server-side keys)
- [app/](app/) — executable Vite React wireframe (Evidence Rooms = Fiori ALP + cube; Legislative Analysis = bi-directional law ↔ blender; Ask Sam)

## Constraints

Use fictional, aggregate, or controlled synthetic data only.  
Do not include PHI or person-level Medicaid records.  
`docswamp/Requirements Assessment.txt` is interpretation/provenance, not an approved policy specification.

## Run the executable wireframe

From the repository root:

```powershell
npm install
npm run dev
```

Open [http://localhost:5020](http://localhost:5020).

```powershell
npm run test
npm run build
npm run harness:verify
```
