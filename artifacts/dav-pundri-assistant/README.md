# DAV Pundri Assistant

A bilingual AI chat assistant for DAV Public School, Pundri. It answers from the verified school knowledge base, streams replies from Groq, and clearly sends unverified questions back to the school office.

## Source of truth

- `artifacts/api-server/src/lib/schoolData.ts` contains the editable school knowledge base.
- Values marked `[FILL]` are intentionally treated as unknown by the assistant.
- `artifacts/api-server/src/lib/systemPrompt.ts` controls the assistant's tone, language behavior, and safety boundaries.

## Run locally

1. Copy `.env.example` to the server environment and set `GROQ_API_KEY`.
2. Optionally set `GROQ_MODEL`; it defaults to `llama-3.3-70b-versatile`. If that model is not available to the key, the server checks Groq's model list and selects an available preferred model.
3. Start the API and web services:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/dav-pundri-assistant run dev
```

The web app calls `POST /api/chat`; the API key remains server-side.

## Build

```bash
pnpm --filter @workspace/dav-pundri-assistant run build
pnpm --filter @workspace/api-server run build
```

The frontend is a static Vite build, and the API is an Express service. For Vercel, deploy the API service separately first; the API project uses `artifacts/api-server/index.ts` as its serverless Express entrypoint. Then deploy the frontend as a Vite project. Set `GROQ_API_KEY` and `GROQ_MODEL` only in the API project's environment variables. Set `VITE_API_URL` in the frontend project to the API deployment origin, without `/api` at the end. Never expose `GROQ_API_KEY` through a `VITE_` variable.

## Included behavior

- Full-page chat at `/` and floating widget presentation at `/widget`
- English, Hindi, and Hinglish responses based on the user's language
- Streaming replies, typing state, retry, copy, auto-scroll, and new chat
- Six school-topic quick questions
- Last ten messages sent as context
- 500-character input limit and in-memory per-IP rate limiting