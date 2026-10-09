# facebook_automation

An AI marketing manager for small businesses: it connects to a business's Meta account, plans and runs Facebook and Instagram ads, and asks the owner to approve every launch and budget change.

| Folder | What it is | Docs |
|---|---|---|
| `backend/` | NestJS API and worker: auth, data, Meta integration, background jobs | [backend/README.md](backend/README.md) |
| `web/` | Next.js web app: every screen, no business logic | [web/README.md](web/README.md) |

## Run locally

```bash
brew services start postgresql@17 && brew services start redis
cd backend && npm install && npm run db:migrate && npm run start:dev
cd backend && npm run worker:dev
cd web && npm install && npm run dev
```

Open `http://localhost:3200` and sign in with `8434230999`, code `963101`.
