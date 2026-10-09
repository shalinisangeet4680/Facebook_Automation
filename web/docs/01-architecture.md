# Architecture

## 1. Principles

1. **Thin client.** The backend owns logic, validation, state, and decisions. The web app renders what the API returns and sends user input back.
2. **Same API as mobile.** The web app uses only public `/api/v1` endpoints. Nothing is web-only on the backend except cookie delivery of tokens.
3. **Launch quality from day one.** Every screen has designed loading, empty, error, and success states, works in light and dark themes, and is keyboard accessible.
4. **Web first, responsive.** Designed for desktop and laptop first; tablets and phones are fully usable.

## 2. Request flow

```
Browser ──► Next.js (localhost:3200)
              │  pages, layouts, assets
              │  /api/*  ──rewrite──►  NestJS backend (localhost:4000)
              ▼
         same origin for the browser: cookies are first-party
```

- `next.config.ts` rewrites `/api/:path*` to the backend. In production the same rule points to the backend's internal URL, or a load balancer routes `/api` directly.
- The browser always talks to one origin. Auth cookies are `httpOnly`, `SameSite=Lax`, and never readable by JavaScript.

## 3. Rendering model

| Layer | Rendering | Data |
|---|---|---|
| Route shells, layouts, static content | Server Components | none or static |
| Signed-in screens | Client Components inside the shell | TanStack Query calling `/api/v1/*` from the browser |
| Auth gate | `src/proxy.ts` | checks the `has_session` cookie only |

User data is fetched in the browser so that token refresh, retries, polling, and cache invalidation behave the same everywhere. The shell renders instantly from the server, and data streams in with skeletons.

## 4. Auth gate

- `has_session` is a non-secret cookie (`1`) the backend sets on sign-in and refresh, and clears on logout. It lives on path `/` for 30 days.
- `proxy.ts` sends visitors without `has_session` from app routes to `/login`, and signed-in visitors from `/login` to `/setup`.
- Real authorisation always happens in the backend. If an API call returns `401` and refresh fails, the client clears state and goes to `/login`.

## 5. State

| State | Where |
|---|---|
| Server data (user, onboarding, connection, assets, jobs) | TanStack Query cache, keyed by endpoint |
| Form input | Component state |
| Theme | `localStorage` + class on `<html>`, applied before paint |
| Nothing else | No global client store |

## 6. Folder roles

- `src/app` routes and layouts only.
- `src/features/<feature>` screens and feature components (auth, onboarding, meta).
- `src/components/ui` design-system primitives.
- `src/lib/api` generated schema, client, query keys, error helpers.
