# Ask Sam — live LLM for the wireframe chat dock

## Plan (what we built)

1. **Same-port API** on `5020`: Vite middleware serves `/api/ask-sam` and `/api/ask-sam/status`.
2. **Keys stay server-side** in `wireframe V1/app/.env` (never `VITE_*`).
3. **Providers (auto-detect):** Anthropic → OpenAI → Cursor SDK.
4. **Client:** polls status; uses live model when configured; otherwise local wireframe Sam.
5. **Safety net:** provider failures fall back to the wireframe reply engine.

## Enable live Sam

```powershell
cd "wireframe V1/app"
copy .env.example .env
# Edit .env — set ANTHROPIC_API_KEY or OPENAI_API_KEY (or CURSOR_API_KEY)
npm run dev
```

Open [http://localhost:5020](http://localhost:5020) → **Ask Sam**. The header should show **Live · anthropic** (or openai/cursor).

### Cursor provider

```powershell
npm install @cursor/sdk --save-optional
```

Set `CURSOR_API_KEY` and optionally `ASK_SAM_PROVIDER=cursor`. Cursor Agent is heavier than chat APIs (local agent run); prefer Anthropic/OpenAI for snappy wireframe demos.

## API

- `GET /api/ask-sam/status` → `{ live, provider, model, fallback }`
- `POST /api/ask-sam` body `{ message, context, history }` → `{ mode, provider, reply, ... }`

## Constraints

- Synthetic / aggregate coaching only; no PHI.
- Options to examine, not prescriptions or legal advice.
- Production would add auth, audit logging, retrieval over measure definitions, and rate limits.
