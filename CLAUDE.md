# Project rules

- Never write code comments. No inline comments, no block comments, no JSDoc/TSDoc, no commented-out code.
- Monorepo: `web/` is the Next.js app (UI only), `backend/` is the NestJS API. The web app talks to the backend only through `/api/*`.
- Backend layout: `src/shared/{config,database,security,errors}` for cross-cutting code and `src/modules/<feature>/{domain,application,infrastructure,interface}` per feature. Import with `@shared/*` and `@modules/*`.
- Database access, secrets, Meta API calls and encryption live only in the backend.
- Read the relevant guide in `web/node_modules/next/dist/docs/` before writing Next.js code; this Next.js version has breaking changes.
