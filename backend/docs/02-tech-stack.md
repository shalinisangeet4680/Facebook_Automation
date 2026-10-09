# Tech stack

## Runtime and framework

| Library | Purpose |
|---|---|
| Node.js 24 LTS | Runtime |
| TypeScript (strict) | Language; `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noUnused*` enabled |
| `@nestjs/core`, `@nestjs/common` (v12) | Application framework: modules, dependency injection, guards, pipes, filters |
| `@nestjs/platform-fastify`, `fastify` | HTTP server. Fastify is used instead of Express for higher throughput and lower latency |
| `@fastify/helmet` | Security headers |
| `@fastify/cookie` | Cookie parsing and signing for web auth cookies |
| `@fastify/cors` (via Nest `enableCors`) | Allowlisted origins |

## Data

| Library | Purpose |
|---|---|
| PostgreSQL 17 | Primary database |
| `drizzle-orm` | Type-safe SQL query builder and ORM; thin layer with near raw-SQL performance and prepared statements |
| `postgres` (postgres.js) | Postgres driver with connection pooling and pipelining |
| `drizzle-kit` | Migration generation and execution |
| `uuid` | UUID v7 primary keys (time-ordered for index locality) |

## Cache, queues, scheduling

| Library | Purpose |
|---|---|
| Redis 7 | Queue backend, cache, rate-limit storage |
| `ioredis` | Redis client |
| `bullmq`, `@nestjs/bullmq` | Job queues, retries, delayed jobs, job schedulers (cron), concurrency control |
| `@nest-lab/throttler-storage-redis` | Distributed rate-limit counters for `@nestjs/throttler` |

## Security and auth

| Library | Purpose |
|---|---|
| `@nestjs/jwt` | Sign and verify JWT access tokens |
| `@nestjs/throttler` | Rate limiting per IP, per phone, per route |
| Node `crypto` | AES-256-GCM encryption of Meta tokens, SHA-256 hashing of refresh tokens and OTP codes, timing-safe comparisons |

## Validation, config, API contract

| Library | Purpose |
|---|---|
| `class-validator`, `class-transformer` | DTO validation and transformation with the global `ValidationPipe` |
| `@nestjs/config` | Configuration module |
| `zod` | Environment validation at startup; the app refuses to boot with invalid config |
| `@nestjs/swagger` | OpenAPI document generated from controllers and DTOs; source for typed web and mobile clients |

## Observability

| Library | Purpose |
|---|---|
| `nestjs-pino`, `pino` | Structured JSON logs with request IDs; `pino-pretty` in development |
| `@sentry/nestjs` | Error tracking and alerting; enabled only when `SENTRY_DSN` is set |
| `@nestjs/terminus` | Health checks for Postgres and Redis |
| `@nestjs/event-emitter` | In-process domain events between modules |

## Integrations

| Library | Purpose |
|---|---|
| Native `fetch` (undici) | Meta Graph and Marketing API calls through a shared client with retry, backoff, and usage-header awareness |
| `@anthropic-ai/sdk` | Claude for business profiling, campaign plans, ad copy, daily analysis |
| SMS provider (MSG91, later) | Real OTP delivery behind the `OtpSender` port |

## Quality and delivery

| Tool | Purpose |
|---|---|
| Vitest | Unit tests |
| Fastify `inject` | In-process HTTP tests against the real Nest app, no network port needed |
| Postgres and Redis services | Integration tests run against real Postgres and Redis: local Homebrew services in development, service containers in CI |
| oxlint | Linting (type-aware) |
| Prettier | Formatting (double quotes, trailing commas, 80 columns) |
| GitHub Actions | CI: install, lint, typecheck, test, build |
| Docker | One image for API and worker roles |
