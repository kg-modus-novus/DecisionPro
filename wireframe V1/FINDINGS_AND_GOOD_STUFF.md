# Wireframe V1 — Findings and Good Stuff

Status: directional consolidation for Wireframe V1  
Provenance: `docswamp/Requirements Assessment.txt` (interpretation), Director-directed blender refinements, generated mockup images 01–13  
Authority: not a Director-approved policy specification

## Truth classes

| Class | Meaning in this folder |
|-------|------------------------|
| Observed | Present in source transcript themes or explicitly produced artifacts (images, files) |
| Inference | Reasonable synthesis from the Requirements Assessment interpretation |
| Recommendation | Design choice for the executable wireframe and product shape |

## Product north star

**Recommendation:** DecisionPro is a legislative Medicaid *decision* system, not a chart catalog.

It should help legislators and analysts answer:

1. Where is Medicaid money going?
2. What is driving the increase?
3. What policy, contracting, program, or data-quality action warrants examination?

Transparency is the mechanism. Oversight and actionable insight are the value.

## Audience (MVP)

Legislators, LRC analysts, Medicaid leadership, budget and oversight staff.  
Not a public provider-selection or consumer tool in V1.

## What we keep (good stuff)

### Interaction model

**Recommendation:** Primary path is Focus Tabs → Consideration Blender → Win-Win-Win Option Packs → Consideration Brief.  
Evidence pages (cost, utilization, outcomes, MCO, provider, county, benchmarks, definitions) are *deep rooms*, not the home screen.

Contract detail: [CONSIDERATION_BLENDER_V1.md](CONSIDERATION_BLENDER_V1.md)

### Focus tabs (parallel lenses)

- Budget pressure  
- Constituent care / outcomes  
- Access / rural care  
- MCO accountability  
- District story  
- Bill readiness  

Tabs are scanable and multi-select. Findings feed the blender.

### Consideration Blender

- Left: finding chips (focus, magnitude, freshness/confidence, constituency relevance)  
- Center: 4-quadrant (pairwise tension) + radar (multi-focus balance)  
- Visible weights the lawmaker can adjust  
- Right: Win-Win-Win packs unlock when ≥2 findings are blended  
- Question spine: Results → Path → Trajectory → Law/Pending → Trust → Action  

### Win-win-win rules

Packs are **options to examine**, never prescriptions. Each pack should show:

- Which inputs moved  
- Who may gain / bear cost (aggregate populations only)  
- Time horizon  
- Legal / contracting levers (curated/synthetic in V1)  
- Why it might fail  
- Trust caveats  

### Trust rules

- Freshness labels: Near current / Recent / Lagged / Historical / Provisional  
- Lagged or incentive-skewed sources shrink visual weight or show a trust flag  
- Brief export warns if Trust context is incomplete  

### Evidence and privacy

- Aggregate / de-identified only; no PHI; no person-level Medicaid records  
- Persistent banner: `SYNTHETIC DEMO DATA — NOT OFFICIAL`  
- Suppression, owners, definitions, and limitations are first-class  

## Image inventory

| File | Role |
|------|------|
| 01-legislative-command-center.png | Evidence room |
| 02-cost-drivers.png | Evidence room |
| 03-utilization-and-access.png | Evidence room |
| 04-outcomes-and-quality.png | Evidence room |
| 05-mco-accountability.png | Evidence room |
| 06-provider-delivery-system.png | Evidence room (see defects) |
| 07-county-legislative-district.png | Evidence room |
| 08-benchmarks.png | Evidence room |
| 09-measure-definitions-data-quality.png | Evidence room / governance |
| 10-focus-tabs-blender-entry.png | Process screen |
| 11-consideration-blender-compete.png | Process screen |
| 12-win-win-win-option-pack.png | Process screen |
| 13-consideration-brief-export.png | Process screen |

## Known defects

- Image `06-provider-delivery-system.png` incorrectly labels geography as Louisiana in places; Kentucky is the intended framing.  
- Mockup chrome/nav differs across images; the executable app standardizes on blender chrome.  

## Executable wireframe scope (this pass)

Build a runnable Vite React app under `wireframe V1/app` on port 5020 that implements the blender path with synthetic fixtures, Vitest for blend logic, and a browser smoke path.
