# Architecture

## 1. Principles

1. **API-first, thin clients.** All logic, validation, state, and decisions live in the backend. Web and mobile only render what the API returns and send user input back.
2. **One API for every client.** The same versioned REST API (`/api/v1`) serves the web app and future mobile apps. Clients differ only in how they hold auth tokens.
3. **Fast by default.** Fastify, Drizzle, stateless JWT checks, Redis caching, and pre-computed reporting tables keep request latency low.
4. **Slow work never blocks a request.** Anything that talks to Meta at scale, calls AI, renders media, or runs on a schedule goes to a background queue.
5. **Multi-tenant from day one.** Every business record belongs to a workspace and every query is scoped to it.
6. **Money actions are safe.** Anything that spends or changes ad budgets is explicit, idempotent, audited, and bounded by guardrails.

## 2. System overview

```
             ┌──────────────┐        ┌──────────────┐
             │  Web (Next)  │        │ Mobile (later)│
             └──────┬───────┘        └──────┬───────┘
                    │  HTTPS /api/v1  (cookies | Bearer)
                    ▼                       ▼
            ┌───────────────────────────────────────┐
            │        API process (NestJS + Fastify)  │
            │  controllers → services → repositories │
            └───────┬───────────────┬────────────────┘
                    │               │ enqueue jobs
                    ▼               ▼
            ┌─────────────┐   ┌───────────┐     ┌──────────────────────┐
            │ PostgreSQL  │◄──│  Worker   │────►│ Meta Graph/Marketing │
            │  (Drizzle)  │   │ (BullMQ)  │     │ API, Claude, SMS     │
            └─────────────┘   └─────┬─────┘     └──────────────────────┘
                    ▲               │
                    └───── Redis ───┘  (queues, cache, rate limits)
```

## 3. Processes

The codebase builds into one Docker image that runs in two roles.

| Process | Entry point | Responsibility | Scales by |
|---|---|---|---|
| API | `src/main.ts` | HTTP requests, auth, validation, quick reads and writes, enqueuing jobs | Request volume |
| Worker | `src/worker.ts` | Queue processing, scheduled jobs (daily autopilot, Meta sync, token health checks), AI and media jobs | Queue depth |

Both processes share the same modules, configuration, and database layer. The worker does not open an HTTP port.

## 4. Layers inside a module

```
interface/       controllers, DTOs, module guards        HTTP in, HTTP out
    │
application/     services (use cases)                      business logic, orchestration, transactions
    │
domain/          types, rules, ports (interfaces)          pure logic, no I/O
    ▲
infrastructure/  tables, repositories, external clients,   implements ports, talks to Postgres,
                 job processors                            Redis, Meta, AI
```

Rules:

- Controllers call application services only. They never touch repositories, Drizzle, or external clients.
- Application services hold the logic. They call repositories and ports, never raw SQL.
- Repositories are the only place SQL (Drizzle queries) exists.
- External systems (Meta, SMS, AI) are reached through **ports** defined in `domain/ports`, implemented in `infrastructure/`. This allows mock implementations for tests and development.
- Modules communicate through exported services or domain events, never by importing another module's repositories.

## 5. Request lifecycle

1. Fastify receives the request; helmet headers, CORS, and cookie parsing apply.
2. A request ID is assigned and attached to every log line (pino).
3. `ThrottlerGuard` enforces rate limits (Redis-backed).
4. `AuthGuard` verifies the JWT access token from the `Authorization` header or the `access_token` cookie. Public routes are marked `@Public()`.
5. `TenantContext` is populated with `userId` and `workspaceId` from the token claims.
6. `ValidationPipe` validates and transforms the DTO (whitelist, forbid unknown fields).
7. The controller calls the application service; the service runs logic, calls repositories and ports, and may enqueue jobs or emit events.
8. Errors of any kind are converted by `AllExceptionsFilter` into the standard error body `{ code, message, traceId, details? }`.

## 6. Scalability design

| Concern | Design |
|---|---|
| Horizontal scale | API is stateless (JWT verification needs no DB). Any instance serves any request behind a load balancer. |
| Spiky or slow work | BullMQ queues absorb load. Workers scale independently of the API. |
| Database connections | Pooled connections per process; PgBouncer in front of Postgres when instance count grows. |
| Read-heavy dashboards | Daily metrics stored as snapshots and summary tables; Redis caches hot reads with short TTLs. |
| Large metric tables | `ad_insights_daily` partitioned by month; indexes always start with `workspace_id`. |
| Reporting load | Read replica for analytics queries when needed. |
| Meta API limits | Per-ad-account rate limiting, Graph batch requests, backoff driven by Meta usage headers (`x-business-use-case-usage`, `x-ad-account-usage`). |
| Duplicate actions | Idempotency keys on money-related endpoints; idempotent job IDs. |
| Scheduled jobs on many instances | BullMQ job schedulers guarantee one run per schedule across the cluster. |
| Failure isolation | Retries with exponential backoff, dead-letter queues, circuit breaking around Meta and AI calls. |
| Latency to users | API, Postgres, and Redis deployed in the same region (Mumbai, `ap-south-1`). |

## 7. Cross-cutting concerns

| Concern | Where |
|---|---|
| Configuration and env validation | `shared/config` |
| Database client, transactions, base repository | `shared/database` |
| JWT, guards, decorators, encryption | `shared/security` |
| Workspace scoping | `shared/tenant` |
| Errors and error codes | `shared/errors` |
| Cache | `shared/cache` |
| Queue registration and job helpers | `shared/queue` |
| Logging | `shared/logging` |
| HTTP client with retry and backoff | `shared/http` |
