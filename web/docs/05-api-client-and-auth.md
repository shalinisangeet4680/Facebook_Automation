# API client and auth

## 1. Contract

- The backend publishes OpenAPI at `/api/docs-json` (development).
- `npm run api:types` generates `src/lib/api/schema.d.ts` with `openapi-typescript`. The file is committed and regenerated whenever the backend contract changes.
- `src/lib/api/client.ts` creates an `openapi-fetch` client, so every path, parameter, body, and response is typed from the contract.

## 2. Client behaviour

| Concern | Behaviour |
|---|---|
| Base URL | `/api` on the same origin |
| Headers | `X-Client: web` and `Content-Type: application/json` on every request |
| Credentials | `same-origin` so cookies flow |
| 401 | One shared refresh call (`POST /api/v1/auth/refresh`); concurrent 401s wait for it; the original request is retried once |
| 409 `SESSION_REFRESHED` | Another tab already refreshed: retry the original request without refreshing |
| Refresh failure | Clear the query cache and navigate to `/login` |
| Errors | Parsed into `ApiError { status, code, message, details, traceId }`; screens show `message` and branch on `code` |
| Idempotent actions | `Idempotency-Key` generated per user action and reused on retry |

## 3. Queries

All server data goes through TanStack Query hooks in `src/lib/api/queries.ts`:

| Hook | Endpoint |
|---|---|
| `useMe` | `GET /api/v1/me` |
| `useOnboarding` | `GET /api/v1/onboarding` |
| `useMetaRequirements` | `GET /api/v1/meta/requirements` |
| `useMetaConnection` | `GET /api/v1/meta/connection` |
| `useMetaAssets` | `GET /api/v1/meta/assets` |
| `useJob(jobId)` | `GET /api/v1/jobs/:jobId`, polling until finished |
| `useRequestOtp`, `useVerifyOtp`, `useSignOut` | auth mutations |
| `useConnectMeta`, `useSelectAssets`, `useDisconnectMeta`, `useRefreshAssets` | Meta mutations |

Mutations invalidate exactly the queries whose data they change.

## 4. Sign-in flow

1. Phone step → `POST /auth/otp/request`.
2. OTP step → `POST /auth/otp/verify`. The backend sets `access_token`, `refresh_token`, and `has_session` cookies.
3. Redirect to the onboarding step returned by `GET /onboarding` (`/setup`).

Sign-out calls `POST /auth/logout`, clears the query cache, and navigates to `/login`.
