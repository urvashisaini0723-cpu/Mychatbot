# DAV Pundri Assistant

An editable, bilingual AI assistant that helps DAV Public School, Pundri visitors find confirmed school information.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/dav-pundri-assistant run dev` — run the assistant web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `GROQ_API_KEY` — server-only Groq credential
- Optional env: `GROQ_MODEL` — preferred Groq model; the API can fall back to an available model

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/dav-pundri-assistant/src/App.tsx` — full-page and widget chat UI
- `artifacts/dav-pundri-assistant/src/index.css` — maroon, saffron, and parchment visual system
- `artifacts/api-server/src/routes/chat.ts` — streaming chat endpoint, rate limiting, and Groq model resolution
- `artifacts/api-server/src/lib/schoolData.ts` — owner-editable school knowledge base
- `artifacts/api-server/src/lib/systemPrompt.ts` — assistant behavior and truthfulness rules
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- School facts stay in one typed server-side object; `[FILL]` values are intentionally treated as unknown.
- The browser receives only streamed response chunks; the Groq key remains server-side.
- The chat route keeps the most recent ten messages, limits each message to 500 characters, and applies a lightweight per-IP window limit.
- When the requested Groq model is unavailable, the server asks Groq for accessible models and selects a preferred fallback.

## Product

- Full-page school assistant at `/` and floating widget presentation at `/widget`.
- English, Hindi, and Hinglish replies based on the user's language.
- Quick questions for admissions, fees, timings, contact, facilities, and transport.
- Streaming replies with typing state, markdown, auto-scroll, retry, copy, and new chat.

## User preferences

_None recorded._

## Gotchas

- The artifact build requires workflow-provided `PORT` and `BASE_PATH`; use the managed workflow or set both for a manual Vite build.
- Update `artifacts/api-server/src/lib/schoolData.ts` when the school confirms any `[FILL]` item; do not put unverified details into the prompt.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
