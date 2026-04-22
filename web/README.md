# LLM Council Frontend

This Next.js app is the Mission Control UI for LLM Council.

## Features

- Launch council sessions with selected personas
- Watch live phase-by-phase streaming from the backend
- View per-phase timing, token usage, and model routing
- Review previous sessions from local storage
- Override API keys and model assignments from the config screen

## Development

```bash
npm install
npm run dev
```

The app expects the backend at `http://localhost:8000` unless `NEXT_PUBLIC_API_URL` is set.

For Vercel deploys, create a project that points at the `web/` directory and set:

```bash
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
```

## Checks

```bash
npm run lint
npm run test
npm run build
```

## Test Coverage

The frontend tests focus on:

- SSE parsing and malformed event recovery
- typed session state reduction
- config save/verification gating
- mocked streaming integration across parser + reducer
