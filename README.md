# LLM Council

LLM Council is a multi-agent answer engine that runs a question through four stages:

1. Multiple personas generate independent drafts
2. A critic scores and critiques those drafts
3. An architect produces a structured blueprint
4. A finalizer writes the polished final answer

The project is split into:

- `llm_council/`: FastAPI backend, council workflow, OpenRouter client, prompts, and CLI
- `web/`: Next.js frontend with live session streaming, local history, config overrides, and metrics

## What Changed In This Upgrade

- The backend workflow now lives in a reusable service instead of being duplicated between API and CLI
- Package-safe imports and project metadata were cleaned up for Python 3.13
- Frontend streaming is now parsed and reduced through typed event/session helpers
- The UI was tightened across summon, history, config, and timeline flows
- Basic backend and frontend tests were added alongside clean lint/build gates

## Requirements

- Python `3.13+`
- Node.js `25+` recommended for the built-in TypeScript test runner
- An OpenRouter API key for live runs

## Environment

Copy `.env.example` to `.env` at the repo root or `llm_council/.env`.

Important variables:

- `OPENROUTER_API_KEY`: required for live model calls
- `USE_MOCK_MODE=true|false`: run fake responses instead of real API calls
- `ENABLE_TRACE_LOGS=true|false`: write markdown traces to `llm_council/logs/`
- `CORS_ALLOW_ORIGINS`: comma-separated allowed frontend origins

## Backend Setup

```bash
uv venv .venv
source .venv/bin/activate
uv pip install -e .
```

Run the API:

```bash
python -m llm_council.server
```

Run the CLI:

```bash
python -m llm_council.main
```

## Frontend Setup

```bash
cd web
npm install
npm run dev
```

By default the frontend expects the backend at `http://localhost:8000`. Override with `NEXT_PUBLIC_API_URL`.

## Quality Gates

Backend:

```bash
python3 -m compileall llm_council
python3 -m unittest discover -s tests
```

Frontend:

```bash
cd web
npm run lint
npm run test
npm run build
```

## Deployment Posture

This repo is currently best suited for:

- local development
- portfolio/demo use
- a simple hosted beta with separate frontend and backend services

The config page stores custom API keys in browser storage, so that override is intended for local or single-user usage rather than shared public deployments.
