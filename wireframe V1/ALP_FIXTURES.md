# ALP Synthetic Fixtures (Procedural Cube)

Status: controlled synthetic / procedural expansion for Wireframe V1 evidence rooms  
Authority: not official; aggregate / de-identified demo data only

## Model

Evidence rooms no longer ship pre-expanded warehouses. They use:

1. **Seed cubes** (`app/src/data/alp/seedCubes.js`) — small authored totals + dimension weights  
2. **Procedural engine** (`app/src/lib/alpCube.js`) — session-seeded hash expansion with memo cache  

```
visual filters → queryAggregates
content chart → queryAggregates
detail list → listSlice (paginated)
object page → getObject(id)
```

Session consistency: same filters/ids return the same numbers until refresh.  
Cross-run consistency is not required.

## Scale cues

List headers show virtual depth, e.g. “Showing 50 of 12,840 aggregates · ~1.2M claim lines represented.” Those claim-line counts are display-only derivatives, not stored rows.

## Files

- `dimensions.js` — shared dimension members  
- `seedCubes.js` — per-room seed cells  
- `roomConfigs.js` — ALP chrome (filters, columns, metrics)  
- `alpCube.js` — hash / split / list / object APIs  
- `components/alp/*` — Fiori ALP shell
