# CodeXen scope — DecisionPro

Mode: `codexen` (default; no `.codexen/config.json` records otherwise).

## Architecture record

**Not yet recorded.** The four Director decisions (topology, authority, locking, recovery) are
pending. DecisionPro's wireframe app reads static, already-exported aggregate data and adds no
background operation, lock or cross-request business state. Its only storage is per-browser
localStorage for UI preferences (zoom, pinned tiles), which holds no business datum. No coordination
mechanism exists to cite. Record the decisions before adding any of those.

## Business objects and owners

| Business object | Owner | Notes |
| --- | --- | --- |
| Published aggregate county counts | XenoDroid BW export `county-access-context` | Read-only in the app |
| MCPAR plan-period record | XenoDroid BW export `mcpar-plan-period` | Read-only in the app |

## Program containers

| Container | File | Business Action | Reads |
| --- | --- | --- | --- |
| CountDisclosure | `wireframe V1/app/src/lib/simpleMode/countDisclosureProgram.js` | `DiscloseAggregateCounts` | Published aggregate counts |
| PlanComparison | `wireframe V1/app/src/lib/simpleMode/planComparisonProgram.js` | `OrderPlansOnComparableMeasure` | MCPAR plan-period record |

Existing modules predate this file and carry no container markers; they are not yet classified.
