# Background jobs

## 1. Stack

- Redis 7 as the queue backend.
- BullMQ through `@nestjs/bullmq`.
- A separate worker process (`src/worker.ts`) runs processors and schedules. The API process only enqueues.

## 2. Queues

| Queue | Jobs | Concurrency |
|---|---|---|
| `meta-sync` | asset refresh, insights sync per ad account | 5, plus per-account limiter |
| `autopilot` | daily optimisation run per workspace, proposal generation | 3 |
| `ai` | business profile, campaign plan, ad copy, daily briefing | 3 |
| `media` | image and video rendering | 1 per worker |
| `notifications` | email, WhatsApp, push | 10 |
| `maintenance` | token health checks, cleanup of expired OTPs, sessions, idempotency keys | 1 |

## 3. Schedules

Defined with BullMQ job schedulers, so each runs once per interval across all workers.

| Schedule | When (IST) |
|---|---|
| Token health check | daily 03:00 |
| Insights sync | every 3 hours |
| Autopilot run and morning briefing | daily 08:30 |
| Cleanup | daily 04:00 |

## 4. Rules

1. Jobs are **idempotent**: a stable `jobId` (for example `insights:<adAccountId>:<date>`) prevents duplicates, and processors can safely re-run.
2. Payloads carry IDs, not full objects; processors load fresh data.
3. Retries: 5 attempts with exponential backoff starting at 30 s; Meta throttling errors back off using usage headers.
4. Failed jobs stay in the failed set (dead letter) with the error; alerts fire through Sentry.
5. Every job logs `jobId`, `workspaceId`, and duration.
6. Actions that spend money are never executed by a job without an approved proposal record.

## 5. Job status for clients

Jobs started by a user request are tracked in `GET /api/v1/jobs/:jobId` with `queued | running | completed | failed`, progress, and result, so web and mobile show identical progress.
