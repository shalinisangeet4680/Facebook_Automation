# Backend build plan

Phase 0 builds the foundation described in `docs/`. Tasks run in order; each ends with typecheck, lint, tests, and a commit.

## Phase 0 — Foundation

- [x] 1. Platform: Fastify adapter, helmet, cookies, CORS, pino logging with request IDs, global exception filter, validation pipe, Swagger at `/api/docs`, `/api/v1` prefix, env validation for all variables
- [x] 2. Database: shared database module, UUID v7 ids, per-module tables, schema index, fresh initial migration, base repository helpers, transactions
- [x] 3. Redis: Redis module, cache service, BullMQ queue registration, worker process (`worker.ts`), Redis-backed throttler
- [x] 4. Health: Terminus checks for Postgres and Redis at `/health`
- [ ] 5. Security: JWT `TokenService`, global `AuthGuard` (Bearer or cookie), `@Public`, `@CurrentUser`, `TenantContext`, `X-Client` CSRF guard, crypto service
- [ ] 6. IAM: users, workspaces, workspace members, repositories, identity service, `GET /api/v1/me`
- [ ] 7. Auth: OTP challenges, `OtpSender` port with test-number sender, OTP request and verify, refresh token families with rotation and reuse detection, refresh, logout, logout-all, web cookies and mobile body tokens, rate limits
- [ ] 8. Audit and idempotency: `audit_events` writer, `idempotency_keys` interceptor
- [ ] 9. Meta: requirements endpoint, `MetaGraph` port, Graph client with retry, backoff and usage headers, mock client, connection service (validate, encrypt, discover assets), connection and asset endpoints, primary asset selection, `meta.connected` event
- [ ] 10. Onboarding: step catalogue, `onboarding_progress`, state machine, `GET /api/v1/onboarding`, event listeners
- [ ] 11. Jobs: `maintenance` queue with token health check and cleanup schedules, `meta-sync` asset refresh job, `GET /api/v1/jobs/:jobId`
- [ ] 12. Quality: unit tests for crypto, phone, OTP, token rotation; e2e tests for auth and Meta flows; oxlint, Prettier, typecheck scripts; GitHub Actions CI; Dockerfile
- [ ] 13. Verification: run API and worker locally, exercise every MVP endpoint end to end, update docs where reality differs
