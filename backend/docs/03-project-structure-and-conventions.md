# Project structure and conventions

## 1. Folder layout

```
backend/
├── drizzle/                         generated SQL migrations (committed, reviewed)
├── docs/                            this documentation
├── src/
│   ├── main.ts                      API process bootstrap
│   ├── worker.ts                    worker process bootstrap
│   ├── app.module.ts                API root module
│   ├── worker.module.ts             worker root module
│   ├── shared/
│   │   ├── config/                  env.validation.ts, app-config.ts, config.module.ts
│   │   ├── database/                database.module.ts, schema.ts, transaction helpers, base repository
│   │   ├── security/                token.service.ts, auth.guard.ts, crypto.service.ts, decorators
│   │   ├── tenant/                  tenant-context.ts
│   │   ├── errors/                  domain-error.ts, error-codes.ts, all-exceptions.filter.ts
│   │   ├── cache/                   cache.module.ts, cache.service.ts
│   │   ├── queue/                   queue.module.ts, queue names, job helpers
│   │   ├── logging/                 logger.module.ts
│   │   ├── http/                    http client with retry and backoff
│   │   └── util/                    small pure helpers
│   └── modules/
│       └── <feature>/
│           ├── <feature>.module.ts
│           ├── domain/              types, rules, value objects, ports/
│           ├── application/         *.service.ts (use cases)
│           ├── infrastructure/      *.tables.ts, *.repository.ts, external clients, *.processor.ts
│           └── interface/           *.controller.ts, dto/*.dto.ts, module guards
└── test/                            *.e2e-spec.ts
```

## 2. Layering rules

| Layer | May import | Must not import |
|---|---|---|
| `interface` | its module's `application`, `domain`, `shared` | repositories, Drizzle, external clients |
| `application` | its module's `domain`, `infrastructure` repositories and ports, other modules' exported services, `shared` | controllers, DTO classes |
| `domain` | nothing outside `domain` and `shared/errors` | Nest, Drizzle, HTTP, any I/O |
| `infrastructure` | `domain`, `shared` | `application`, `interface` |

- A module exposes only what it lists in `exports` of its Nest module. Other modules use those services, never its repositories or tables.
- Cross-module side effects use domain events (`@nestjs/event-emitter`) or queue jobs.

## 3. Naming

| Item | Convention | Example |
|---|---|---|
| Files | kebab-case with role suffix | `meta-connection.service.ts`, `connect-meta.dto.ts` |
| Classes | PascalCase with role suffix | `MetaConnectionService`, `ConnectMetaDto` |
| Drizzle tables file | `<module>.tables.ts` | `auth.tables.ts` |
| Repositories | `<entity>.repository.ts` | `refresh-token.repository.ts` |
| Ports | `domain/ports/<name>.ts` with an injection token constant | `OTP_SENDER`, `OtpSender` |
| Job processors | `<queue>.processor.ts` | `meta-sync.processor.ts` |
| DB tables and columns | snake_case, plural tables | `meta_assets.workspace_id` |
| Env vars | SCREAMING_SNAKE_CASE | `TOKEN_ENCRYPTION_KEY` |
| Routes | kebab-case nouns, plural resources | `/api/v1/meta/assets` |

## 4. Coding rules

1. **No code comments.** No inline, block, JSDoc, or commented-out code. Names and small functions carry the meaning.
2. Strict TypeScript; no `any`. Use `unknown` and narrow.
3. Imports use path aliases `@shared/*` and `@modules/*`; relative imports only within the same module. Exception: `*.tables.ts`, `shared/database/columns.ts`, and `shared/database/schema.ts` use relative imports because `drizzle-kit` loads them outside the Nest build.
4. Validate every input at the edge with a DTO. Validate every external response (Meta, AI) before trusting it.
5. Throw `DomainError` subclasses or `CodedError` with an `ErrorCode`. Never throw plain strings; never leak stack traces to clients.
6. All times are stored and returned in UTC ISO 8601. All money is stored as integer minor units (paise) with a currency code.
7. Every query on business data includes `workspace_id` from `TenantContext`.
8. Keep functions small and single-purpose. Prefer pure functions in `domain/` for anything testable without I/O.
9. Configuration is read through typed helpers in `shared/config/app-config.ts`, never `process.env` directly.
10. Formatting is Prettier: double quotes, trailing commas, 80 columns, semicolons.

## 5. DTOs and responses

- Request DTOs live in `interface/dto`, suffix `.dto.ts`, and use `class-validator` decorators. The Swagger plugin reads them automatically.
- Responses are plain typed objects returned by services. Controllers do not reshape data beyond choosing what to return.
- Never return database rows directly when they contain internal fields (hashes, ciphertexts, internal flags). Map to a response type.

## 6. Errors

```json
{ "code": "OTP_INVALID", "message": "That code is incorrect. 3 attempts left.", "traceId": "6f1c…", "details": { "attemptsLeft": 3 } }
```

- `code` is stable and machine-readable (see `shared/errors/error-codes.ts`). Clients branch on `code`, display `message`.
- `message` is written for end users: clear, specific, and actionable.
- 5xx errors are logged with `traceId`; the client receives a generic message and the same `traceId`.

## 7. Testing

| Kind | Location | Tooling | Covers |
|---|---|---|---|
| Unit | next to the file, `*.spec.ts` | Vitest | domain rules, services with mocked ports |
| API / integration | `test/*.e2e-spec.ts` | Vitest + Supertest + Testcontainers | full HTTP flows against real Postgres and Redis |

Every new endpoint gets at least one e2e test for the success path and one for its most likely failure.

## 8. Git and delivery

- Branches: `feature/<name>`, `fix/<name>`; `main` is always deployable.
- Commits follow Conventional Commits: `feat(auth): rotate refresh tokens`.
- Migrations are generated, read, and committed with the code that needs them.
- CI must pass lint, typecheck, unit and e2e tests, and build before merge.
