# Ask Sam — grounded live LLM for the wireframe chat dock

## What we built

1. **Same-port API** on `5040`: Vite middleware serves `/api/ask-sam` and `/api/ask-sam/status`.
2. **Keys stay server-side** — Infisical injection preferred; optional gitignored `.env` for offline (never `VITE_*`).
3. **Providers (auto-detect):** Anthropic → OpenAI → Cursor SDK. **OpenAI** is the DecisionPro Infisical credential and supports **tool calling**.
4. **Evidence pack:** client sends on-screen tiles, Gaps, blender state, and provenance pointers with each question.
5. **Allowlisted tools:** server reads export modules under `src/data/alp/`; optional live BW Postgres for load-history digests when `DECISIONPRO_BW_DATABASE_URL` is set.
6. **Safety net:** provider failures fall back to the wireframe reply engine.

## Enable live Sam (Infisical — preferred)

Prerequisites: [Infisical CLI](https://infisical.com/docs/cli/overview) installed and logged in (`infisical login`).

```powershell
cd "wireframe V1/app"
npm run dev:sam
```

That runs:

```text
infisical run --env=dev --path=/application/openai --projectId=d44a0f65-87cf-43b7-81c9-d4848193a90a -- npm run dev
```

Infisical project slug: `decision-pro-s-ly6`. Secret path `/application/openai` → `OPENAI_API_KEY` (registry id `decisionpro-openai-api-key`). Do not reuse other apps’ OpenAI keys.

Open [http://localhost:5040](http://localhost:5040) → **Ask Sam**. Header should show **Live · openai**.

### Offline / local `.env` fallback

```powershell
cd "wireframe V1/app"
copy .env.example .env
# Edit .env — set OPENAI_API_KEY (or ANTHROPIC_API_KEY / CURSOR_API_KEY)
npm run dev
```

### Cursor provider

```powershell
npm install @cursor/sdk --save-optional
```

Set `CURSOR_API_KEY` and optionally `ASK_SAM_PROVIDER=cursor`. Cursor Agent is heavier (no Ask Sam tools); prefer OpenAI for grounded demos.

## Evidence pack

Each `POST /api/ask-sam` includes `context.evidencePack` built from the current session:

- `ui` — view, evidence room, role, spine/trust/path
- `landing` — Accurate Landing / role-home tiles (values, short series, provenance pointers)
- `gaps` — Explicit Gap ids/titles for the session
- `blender` — focuses, findings, pack
- `sourcesIndex` — short authoritative-source catalogue

Sam answers from the pack first, then calls tools when lineage or catalogue detail is missing.

## Tools (server-side, OpenAI)

| Tool | Source |
|------|--------|
| `get_measure_detail` | `accurateLanding.js`, room cubes |
| `list_gaps` / `get_gap_detail` | `gapObjects.js`, `gapBriefings.js` |
| `get_authoritative_source` | `authoritativeSources.js`, `primarySources.js` |
| `summarize_load_history` | Export provenance; optional Postgres `bw_ctl.load_history` |
| `get_ui_guidance` | Static product map for current view/role |
| `get_blender_finding` | `blenderFindings.real.js` |

No model-authored SQL. No browser tool execution. No PHI / person-level Medicaid data.

### Optional live Postgres

```powershell
$env:DECISIONPRO_BW_DATABASE_URL = "postgres://decisionpro:decisionpro_poc_local@127.0.0.1:5042/xenodroid_bw"
# ensure optional dep: npm install pg
npm run dev:sam
```

When unset or unreachable, `summarize_load_history` returns export provenance only (`available: false` for live DB).

## API

- `GET /api/ask-sam/status` → `{ live, provider, model, fallback }`
- `POST /api/ask-sam` body `{ message, context, history }` → `{ mode, provider, reply, ... }`

## Constraints

- Aggregate / de-identified legislative decision-support only; no PHI.
- Never invent REAL magnitudes; Gaps are first-class.
- Options to examine, not prescriptions or legal advice.
- Production would add auth, audit logging, and rate limits (out of scope for this wireframe pass).
