# Backend build plan

Phase 0 builds the foundation described in `docs/`. Tasks run in order; each ends with typecheck, lint, tests, and a commit.

## Phase 0 — Foundation

- [x] 1. Platform: Fastify adapter, helmet, cookies, CORS, pino logging with request IDs, global exception filter, validation pipe, Swagger at `/api/docs`, `/api/v1` prefix, env validation for all variables
- [x] 2. Database: shared database module, UUID v7 ids, per-module tables, schema index, fresh initial migration, base repository helpers, transactions
- [x] 3. Redis: Redis module, cache service, BullMQ queue registration, worker process (`worker.ts`), Redis-backed throttler
- [x] 4. Health: Terminus checks for Postgres and Redis at `/health`
- [x] 5. Security: JWT `TokenService`, global `AuthGuard` (Bearer or cookie), `@Public`, `@CurrentUser`, `TenantContext`, `X-Client` CSRF guard, crypto service
- [x] 6. IAM: users, workspaces, workspace members, repositories, identity service, `GET /api/v1/me`
- [x] 7. Auth: OTP challenges, `OtpSender` port with test-number sender, OTP request and verify, refresh token families with rotation and reuse detection, refresh, logout, logout-all, web cookies and mobile body tokens, rate limits
- [x] 8. Audit and idempotency: `audit_events` writer, `idempotency_keys` interceptor
- [x] 9. Meta: requirements endpoint, `MetaGraph` port, Graph client with retry, backoff and usage headers, mock client, connection service (validate, encrypt, discover assets), connection and asset endpoints, primary asset selection, `meta.connected` event
- [x] 10. Onboarding: step catalogue, `onboarding_progress`, state machine, `GET /api/v1/onboarding`, event listeners
- [x] 11. Jobs: `maintenance` queue with token health check and cleanup schedules, `meta-sync` asset refresh job, `GET /api/v1/jobs/:jobId`
- [x] 12. Quality: unit tests for crypto, phone, OTP, token rotation; e2e tests for auth and Meta flows; oxlint, Prettier, typecheck scripts; GitHub Actions CI; Dockerfile
- [x] 13. Verification: run API and worker locally, exercise every MVP endpoint end to end, update docs where reality differs

## Phase 1A — Claude connector (MCP)

Design in `docs/12-mcp-connector.md`.

- [x] 1. Config and plumbing: `APP_URL`, `ADS_MAX_DAILY_BUDGET`, form body parser, routes outside the `/api` prefix, client guard exemptions
- [x] 2. OAuth tables and migration: `oauth_clients`, `oauth_grants`, `oauth_refresh_tokens`
- [x] 3. Authorization server: metadata, DCR, CIMD, consent context and decision, code exchange with PKCE, refresh rotation, revocation, connected apps
- [x] 4. Meta ads port: shared Graph transport with POST, real client for insights, campaigns, targeting search, pixel stats, drafts, status and budget; in-memory mock
- [x] 5. Ads application: overview, performance, campaigns, tracking, drafts, pause, confirmation tokens, guardrails, audit
- [x] 6. MCP endpoint: bearer challenge, per-request stateless server, tools by scope, rate limit
- [x] 7. Tests: unit and e2e for OAuth, MCP and tools
- [x] 8. Web: consent screen, Claude settings page, proxy and rewrites, typed client
- [x] 9. Verification: tunnel, end-to-end with a real MCP client, docs

## Phase 1B — Settings, Reports, Creatives & Publishing, Inbox

Design in `docs/14-phase-1b.md`.

- [ ] 1. Test isolation: `adpilot_test` for backend e2e; Playwright on its own backend (4100, mock) and web (3300)
- [ ] 2. Settings: `workspace_settings`, profile, workspace guardrails used by ads, `/settings` page
- [ ] 3. Reports: overview endpoint with KPIs, daily series, campaigns, top ads; `/reports` page with charts
- [ ] 4. Creatives: media storage, upload, SVG render, library API, MCP tools, `/creatives` page
- [ ] 5. Publishing: `social_posts`, publish job (Facebook, Instagram), schedule, cancel, library sync, MCP publish tool, publish screen
- [ ] 6. Ads from posts: plan creative from a Facebook or Instagram post, picker on the plan page
- [ ] 7. Inbox: rules engine, suggestions, daily job, apply/dismiss/snooze, MCP tool, `/inbox` page
- [ ] 8. Verification: all suites, screenshots, docs
