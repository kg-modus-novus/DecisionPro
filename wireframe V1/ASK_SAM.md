# Ask Sam — grounded live LLM for the wireframe chat dock

## What we built

1. **Same-port API** on `5040`: Vite middleware serves `/api/ask-sam` and `/api/ask-sam/status`.
2. **Demo (GitHub Pages):** browser calls a Vercel serverless API via `VITE_ASK_SAM_API_BASE` (CORS allowlisted for `demo.decisionpro.io`). Keys stay on Vercel — never in the static bundle.
3. **Keys stay server-side** — Infisical injection preferred locally; Vercel env for demo; optional gitignored `.env` for offline (never put secrets in `VITE_*`).
4. **Providers (auto-detect):** Anthropic → OpenAI → Cursor SDK. **OpenAI** is the DecisionPro Infisical credential and supports **tool calling**. Default model: **`gpt-5.6-sol`**.
5. **Evidence pack:** client sends on-screen tiles, Gaps, blender state, and provenance pointers with each question.
6. **Tools:** OpenAI hosted **web search** (Responses API) plus allowlisted DecisionPro tools over `src/data/alp/`; optional live BW Postgres for load-history digests when `DECISIONPRO_BW_DATABASE_URL` is set. Disable web search with `ASK_SAM_WEB_SEARCH=false`.
7. **Safety net:** provider failures fall back to the wireframe reply engine.

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

## Demo host (live Sam on https://demo.decisionpro.io)

Static Pages cannot keep API keys. Deploy the Ask Sam handlers under `wireframe V1/app/api/` to Vercel, set `OPENAI_API_KEY` (from Infisical), then rebuild Pages with the API origin:

```powershell
cd "wireframe V1/app"
# Deploy API (once / when handlers change)
vercel --prod --yes
# Set OPENAI_API_KEY + ASK_SAM_PROVIDER=openai in the Vercel project env (dashboard or CLI)

# Rebuild demo pointing at the deployed API
$env:GITHUB_PAGES = "true"
$env:VITE_ASK_SAM_API_BASE = "https://decisionpro-ask-sam.vercel.app"
npm run build
# publish dist/ to gh-pages as usual
```

Current demo API: `https://decisionpro-ask-sam.vercel.app` (Vercel project `modus-novus/decisionpro-ask-sam`). Optional custom domain later (e.g. `ask.decisionpro.io`).

CORS defaults allow `https://demo.decisionpro.io` and the GitHub Pages fallback origin. Override with `ASK_SAM_CORS_ORIGINS` (comma-separated) on Vercel if needed.

## Guidance (not hard gates)

- Prefer session evidence pack + tools for DecisionPro figures; use broader public Medicaid knowledge for “why” / background, labeled as context to examine.
- Stay aggregate / de-identified; no PHI.
- Options to examine, not prescriptions or legal advice.
- Production would add auth, audit logging, and rate limits (out of scope for this wireframe pass).
