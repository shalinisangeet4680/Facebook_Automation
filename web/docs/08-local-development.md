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

## 4. End-to-end tests

Playwright drives the real app in Google Chrome against the running backend with `META_MOCK=true`.

- The backend must accept these test numbers (code `123456`): `9000000007` (API sign-in for accessibility scans), `9000000008` (mobile journey), `9000000009` (desktop journey). Add them to `OTP_TEST_NUMBERS` in `backend/.env`.
- Locally, global setup clears rate-limit counters and pending codes for those numbers so runs can repeat.
- `E2E_BASE_URL` points the suite at another server, for example a production build on port 3201.

| Suite | Covers |
|---|---|
| `e2e/journey.spec.ts` | Sign-in with a wrong then right code, missing-permission and valid Meta connections, account selection, disconnect, sign-out — on desktop and a phone viewport |
| `e2e/accessibility.spec.ts` | axe WCAG 2.1 AA scans of login, setup, connect-meta (connected and disconnected) and accounts, in light and dark themes |
