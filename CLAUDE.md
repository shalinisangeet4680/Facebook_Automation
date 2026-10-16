# Project rules

- Never write code comments. No inline comments, no block comments, no JSDoc/TSDoc, no commented-out code.
- Monorepo: `web/` is the Next.js app (UI only), `backend/` is the NestJS API, `plugin/` is the Claude Code plugin that runs on developers' machines (store creatives). The web app talks to the backend only through `/api/*`.
- `plugin/` does local work only (reading the developer's repo, emulator, rendering). It never touches our database, secrets or Meta, and reaches the platform only through the public API or MCP connector.
- Backend layout: `src/shared/{config,database,security,errors}` for cross-cutting code and `src/modules/<feature>/{domain,application,infrastructure,interface}` per feature. Import with `@shared/*` and `@modules/*`.
- Database access, secrets, Meta API calls and encryption live only in the backend.
- Read the relevant guide in `web/node_modules/next/dist/docs/` before writing Next.js code; this Next.js version has breaking changes.
