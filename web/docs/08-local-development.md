# Local development

## 1. Prerequisites

The backend running locally (`backend/docs/10-local-development.md`), with `META_MOCK=true` until a real System User token is available.

## 2. Environment

| Variable | Example | Notes |
|---|---|---|
| `BACKEND_URL` | `http://localhost:4000` | target of the `/api/*` rewrite |

## 3. Commands

| Command | Does |
|---|---|
| `npm run dev` | Next.js dev server on port 3200 |
| `npm run api:types` | Regenerate `src/lib/api/schema.d.ts` from the running backend |
| `npm run lint` | ESLint, zero warnings |
| `npm run typecheck` | TypeScript |
| `npm test` | Component tests |
| `npm run test:e2e` | Playwright against the running backend |
| `npm run build` | Production build |
