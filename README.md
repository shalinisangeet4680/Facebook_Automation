# TreeVook AI

One platform for a small business's automations, run from one dashboard at [treevook.com](https://treevook.com). AI does the work and the owner approves anything that matters.

| Product | Path | Standalone host |
|---|---|---|
| Meta Ads: plans and runs Facebook and Instagram ads | `/setup` | `ads.treevook.com` |
| Play Reviews: Google Play review replies and store listing images | `/reviews` | `playreview.treevook.com` |
| Google Business: reviews, posts, insights and business info | `/business` | `googlebusiness.treevook.com` |

| Folder | What it is | Docs |
|---|---|---|
| `backend/` | NestJS API and worker: auth, data, Meta integration, background jobs | [backend/README.md](backend/README.md) |
| `web/` | Next.js web app: every screen, no business logic | [web/README.md](web/README.md) |
| `plugin/` | Claude Code plugin, run on the developer's machine: Google Play screenshots and feature graphics from their app | [plugin/README.md](plugin/README.md) |

## Run locally

```bash
brew services start postgresql@17 && brew services start redis
cd backend && npm install && npm run db:migrate && npm run start:dev
cd backend && npm run worker:dev
cd web && npm install && npm run dev
```

Open `http://localhost:3200` and sign in with `8434230999`, code `963101`.

## Hosting products on their own subdomain

Every product also runs on its own subdomain from the same deployment. The web app reads the first label of the host (see `web/src/lib/products.ts`), sends `/` to that product's home and sends paths of other products to `ROOT_URL`.

1. Point `treevook.com` and each product subdomain at the web app.
2. Web: `ROOT_URL=https://treevook.com`.
3. Backend: `COOKIE_DOMAIN=.treevook.com` so one sign-in works on every subdomain, and list every host in `WEB_ORIGINS`.

Locally, `http://playreview.localhost:3200` and `http://googlebusiness.localhost:3200` work without any DNS setup.
