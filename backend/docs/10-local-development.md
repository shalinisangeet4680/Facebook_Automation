# Local development

## 1. Prerequisites

| Tool | Install |
|---|---|
| Node.js 24 | `brew install node@24` |
| PostgreSQL 17 | `brew install postgresql@17 && brew services start postgresql@17` |
| Redis 7 | `brew install redis && brew services start redis` |

Create the database once:

```bash
/opt/homebrew/opt/postgresql@17/bin/createdb adpilot_dev
```

## 2. Environment

Copy `.env.example` to `.env` and fill it in. Real environment variables always override values from `.env`.

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `development` | |
| `PORT` | `4000` | API port |
| `DATABASE_URL` | `postgres://<user>@localhost:5432/adpilot_dev` | |
| `REDIS_URL` | `redis://localhost:6379` | |
| `JWT_ACCESS_SECRET` | 64 random characters | `openssl rand -base64 48` |
| `TOKEN_ENCRYPTION_KEY` | 32 bytes, base64 | `openssl rand -base64 32` |
| `OTP_TEST_NUMBERS` | `8434230999:963101` | comma-separated `phone:code` pairs |
| `WEB_ORIGINS` | `http://localhost:3200` | comma-separated allowed origins |
| `META_GRAPH_VERSION` | `v23.0` | |
| `META_MOCK` | `false` | `true` uses mock Meta data |
| `ANTHROPIC_API_KEY` | | needed from the AI phase onward |
| `SENTRY_DSN` | | optional locally |

## 3. Commands

| Command | Does |
|---|---|
| `npm run start:dev` | API with watch mode |
| `npm run worker:dev` | Worker with watch mode |
| `npm run db:generate -- --name <name>` | Generate a migration from table changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Browse the database |
| `npm run lint` | Lint with zero warnings allowed |
| `npm run format` / `npm run format:check` | Format, or check formatting |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests |
| `npm run test:e2e` | Integration tests against the local Postgres and Redis |
| `npm run build` | Production build |

## 4. Working with the web app

The web app runs on `http://localhost:3200` and proxies `/api/*` to `http://localhost:4000`, so cookies are first-party and no CORS setup is needed for local work.

## 5. Test login

Phone `8434230999`, code `963101`.

## 6. Docker

```bash
docker build -t ads-autopilot-backend .
docker run --env-file .env -p 4000:4000 ads-autopilot-backend
docker run --env-file .env ads-autopilot-backend node dist/worker.js
docker run --env-file .env ads-autopilot-backend node dist/shared/database/migrate.js
```

One image runs the API (default), the worker, or the migration step.

## 7. Continuous integration

`.github/workflows/backend.yml` runs on every push and pull request touching `backend/`: install, lint, format check, typecheck, migrate a fresh Postgres, unit tests, integration tests with Postgres and Redis service containers, and build.
