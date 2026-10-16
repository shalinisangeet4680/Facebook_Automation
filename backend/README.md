# Backend

The backend is the single source of truth for the product. It owns authentication, business rules, data, Meta (Facebook and Instagram) integration, AI, and background automation. Every client (the Next.js web app today, a mobile app later) is a thin UI that calls this API.

## Quick start

```bash
brew services start postgresql@17
brew services start redis
cp .env.example .env
npm install
npm run db:migrate
npm run start:dev
npm run worker:dev
```

API: `http://localhost:4000/api/v1` · OpenAPI docs (development only): `http://localhost:4000/api/docs` · Health: `http://localhost:4000/health`

## Documentation

| Document | Contents |
|---|---|
| [Architecture](docs/01-architecture.md) | System overview, processes, layers, request lifecycle, scalability |
| [Tech stack](docs/02-tech-stack.md) | Every library and why it is used |
| [Project structure and conventions](docs/03-project-structure-and-conventions.md) | Folder layout, layering rules, naming, coding rules |
| [API guidelines](docs/04-api-guidelines.md) | Versioning, error format, pagination, idempotency, MVP endpoints |
| [Authentication](docs/05-authentication.md) | Phone OTP, JWT access tokens, rotating refresh tokens, web and mobile clients |
| [Database](docs/06-database.md) | PostgreSQL, Drizzle, schema conventions, migrations, MVP tables |
| [Meta integration](docs/07-meta-integration.md) | System User token, permissions, validation, Graph client, rate limits |
| [Background jobs](docs/08-background-jobs.md) | Redis, BullMQ, worker process, schedules, retries |
| [Security](docs/09-security.md) | Secrets, encryption, tenancy isolation, auditing, checklist |
| [Local development](docs/10-local-development.md) | Setup, environment variables, commands, testing |
| [Roadmap](docs/11-roadmap.md) | MVP scope, build order, later phases |
| [Play Store creatives](docs/15-store-creatives.md) | Store listing projects, plugin uploads, style choice, MCP tools |
