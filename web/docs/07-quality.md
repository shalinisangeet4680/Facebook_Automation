# Quality

## 1. Accessibility

WCAG 2.2 AA: colour contrast, focus visible, keyboard navigation for every action, labelled controls, `aria-live` for async results and verification steps, reduced motion respected.

## 2. Performance budgets

| Metric | Budget | Measured (production build, local, desktop) |
|---|---|---|
| JavaScript per route, compressed | ≤ 300 KB total, of which ~150 KB is the React and Next.js runtime | login 222 KB · setup 279 KB · connect-meta 279 KB · accounts 265 KB |
| LCP | ≤ 1.5 s | 28–52 ms |
| CLS | ≤ 0.02 | 0.000 on every route |
| Interaction to next paint | ≤ 150 ms | not yet measured under throttling |

Every route is prerendered as a static shell; data streams in after hydration with skeletons in place, so the layout never shifts. Heavy illustration code stays inside the Connect Meta route.

## 3. Testing

| Kind | Tool | Covers |
|---|---|---|
| Component | Vitest + Testing Library | OTP input, phone input, API client refresh logic |
| End to end | Playwright | Login, setup overview, Connect Meta (mock Meta), account selection, sign-out, in light and dark themes |

## 4. CI

`.github/workflows/web.yml` has two jobs. **checks**: install, lint, format check, typecheck, unit tests, build. **e2e**: starts Postgres and Redis services, migrates and runs the backend API and worker in mock-Meta mode, builds and starts the web app, then runs the full Playwright suite; logs and traces are uploaded on failure.
