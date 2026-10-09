# Web build plan

Each task ends with typecheck, lint, tests where relevant, a visual check in light and dark themes, and a commit.

- [x] 1. Backend contract: response schemas in OpenAPI for every endpoint, `has_session` cookie on sign-in, refresh, and logout
- [x] 2. Foundation: dependencies, Next config with `/api` rewrite, fonts, design tokens, light and dark themes without flash, providers (TanStack Query, toasts), generated API types and typed client with refresh handling
- [ ] 3. UI kit: button, input, OTP input, phone input, card, badge, check row, radio card, skeleton, spinner, dialog, menu, tooltip, progress ring, empty and error states, copy button
- [ ] 4. Auth gate and login: `proxy.ts`, login layout with animated brand panel, phone step, code step, errors, redirect
- [ ] 5. App shell: sidebar, top bar, theme toggle, user menu with sign-out, responsive drawer
- [ ] 6. Setup overview: progress ring, step list, current-step card
- [ ] 7. Connect Meta: animated guide, instructions, permissions card, token form, verification sequence, success and failure states
- [ ] 8. Choose accounts: radio cards per asset kind, save, refresh-from-Meta job progress
- [ ] 9. Quality: component tests, Playwright end-to-end tests, accessibility pass, performance check, CI workflow
- [ ] 10. Verification: full walkthrough in the browser at desktop and mobile sizes, light and dark, docs updated
