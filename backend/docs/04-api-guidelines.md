# API guidelines

## 1. Basics

- Base path: `/api/v1`. Health and docs are unversioned: `/health`, `/api/docs` (development only).
- JSON only, UTF-8, `camelCase` fields. An empty body with `Content-Type: application/json` is treated as `{}`.
- Resources are nouns; actions that are not CRUD use a verb sub-resource: `POST /api/v1/campaigns/:id/launch`.
- The backend decides state. Clients never compute "what's next", eligibility, or permissions; they read it from the API.

## 2. Versioning

- Breaking changes create a new version (`/api/v2`). Adding optional fields or new endpoints is not breaking.
- A version stays available until every supported mobile app version has moved off it.

## 3. Status codes

| Code | Use |
|---|---|
| 200 | Successful read or update returning a body |
| 201 | Resource created |
| 202 | Accepted for background processing; body contains a job reference |
| 204 | Success with no body |
| 400 | Validation error (`VALIDATION`) |
| 401 | Missing or expired access token (`UNAUTHORIZED`) |
| 403 | Authenticated but not allowed (`FORBIDDEN`) |
| 404 | Not found within the caller's workspace (`NOT_FOUND`) |
| 409 | Conflict with current state (`CONFLICT`) |
| 422 | Business rule rejected the request (specific `code`) |
| 429 | Rate limited (`TOO_MANY_REQUESTS`) |
| 5xx | Unexpected failure (`INTERNAL`) or upstream failure (`META_UNAVAILABLE`) |

## 4. Error body

```json
{ "code": "META_TOKEN_INVALID", "message": "This token is invalid or expired. Generate a new one and paste it again.", "traceId": "b2e1…", "details": {} }
```

## 5. Pagination

Cursor-based for every list that can grow:

```
GET /api/v1/approvals?limit=20&cursor=eyJpZCI6…
→ { "data": [...], "nextCursor": "eyJpZCI6…" | null }
```

`limit` defaults to 20, maximum 100. Short fixed lists (for example connected assets) return `{ "data": [...] }` without a cursor.

## 6. Idempotency

Endpoints that spend money, launch campaigns, change budgets, or approve actions require an `Idempotency-Key` header (UUID). The first response is stored for 24 hours; a retry with the same key returns the stored response instead of repeating the action.

## 7. Clients

Every request sends `X-Client: web` or `X-Client: mobile`.

| | Web | Mobile |
|---|---|---|
| Tokens returned by login and refresh | Set as `httpOnly` cookies; body omits tokens | In the response body |
| Sending the access token | Cookie, automatically | `Authorization: Bearer <token>` |
| CSRF protection | `SameSite=Lax` cookies plus the required `X-Client` header on state-changing requests | Not applicable |

## 8. Long-running work

Operations that call Meta at scale, run AI, or render media return `202` with `{ "jobId": "…" }`. Progress is read from `GET /api/v1/jobs/:jobId` → `{ status: "queued" | "running" | "completed" | "failed", progress, result, error }`.

## 9. MVP endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | public | Liveness and dependency checks |
| POST | `/api/v1/auth/otp/request` | public | Send an OTP to a phone number |
| POST | `/api/v1/auth/otp/verify` | public | Verify the OTP, create the user and workspace if new, issue tokens |
| POST | `/api/v1/auth/refresh` | refresh token | Rotate the refresh token and issue a new access token |
| POST | `/api/v1/auth/logout` | access token | Revoke the current session |
| POST | `/api/v1/auth/logout-all` | access token | Revoke every session of the user |
| GET | `/api/v1/me` | access token | Current user and workspace |
| GET | `/api/v1/onboarding` | access token | All onboarding steps with status, the current step, and what unlocks next |
| GET | `/api/v1/meta/requirements` | access token | Guide steps, required and optional permissions with reasons, deep links |
| POST | `/api/v1/meta/connection` | access token | Validate a System User token, store it encrypted, discover assets |
| GET | `/api/v1/meta/connection` | access token | Connection status, system user, granted and missing permissions |
| DELETE | `/api/v1/meta/connection` | access token | Disconnect and delete the stored token |
| GET | `/api/v1/meta/assets` | access token | Discovered businesses, ad accounts, Pages, Instagram accounts, datasets |
| PUT | `/api/v1/meta/assets/selection` | access token | Choose the primary ad account, Page, Instagram account, and dataset |
| POST | `/api/v1/meta/assets/refresh` | access token | Re-read assets from Meta in the background; returns `202 { jobId }` |
| GET | `/api/v1/jobs/:jobId` | access token | Status, progress, and result of a background job in the caller's workspace |
| GET | `/api/v1/audit-events` | access token | The workspace audit log, newest first, cursor-paginated |
