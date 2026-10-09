# Quality

## 1. Accessibility

WCAG 2.2 AA: colour contrast, focus visible, keyboard navigation for every action, labelled controls, `aria-live` for async results and verification steps, reduced motion respected.

## 2. Performance budgets

| Metric | Budget |
|---|---|
| First load JS per route | ≤ 180 KB gzip |
| LCP (desktop, local) | ≤ 1.5 s |
| CLS | ≤ 0.02 |
| Interaction to next paint | ≤ 150 ms |

Heavy illustration code loads only on the screens that use it.

## 3. Testing

| Kind | Tool | Covers |
|---|---|---|
| Component | Vitest + Testing Library | OTP input, phone input, API client refresh logic |
| End to end | Playwright | Login, setup overview, Connect Meta (mock Meta), account selection, sign-out, in light and dark themes |

## 4. CI

`.github/workflows/web.yml`: install, lint, typecheck, unit tests, build. End-to-end tests run with the backend and its Postgres and Redis services.
