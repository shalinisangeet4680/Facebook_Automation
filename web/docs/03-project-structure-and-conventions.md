# Project structure and conventions

## 1. Layout

```
web/
├── docs/
├── e2e/                         Playwright tests
├── public/
└── src/
    ├── proxy.ts                 auth gate
    ├── app/
    │   ├── layout.tsx           html, fonts, theme script, providers
    │   ├── (auth)/login/        sign-in screens
    │   └── (app)/               signed-in shell
    │       ├── layout.tsx
    │       └── setup/           onboarding overview, connect-meta, accounts
    ├── features/
    │   ├── auth/                phone form, OTP form, sign-out
    │   ├── onboarding/          checklist, progress
    │   └── meta/                guide animation, token form, verification, asset picker
    ├── components/
    │   ├── ui/                  button, input, card, badge, dialog, menu, skeleton, spinner…
    │   ├── brand/               logo, brand constants
    │   └── shell/               sidebar, top bar, theme toggle, user menu
    └── lib/
        ├── api/                 schema.d.ts (generated), client.ts, queries.ts, errors.ts
        ├── utils.ts
        └── config.ts
```

## 2. Rules

1. **No code comments.**
2. Pages in `src/app` stay thin: they compose feature components and nothing else.
3. Feature components may call the API only through hooks in `src/lib/api/queries.ts`.
4. UI primitives in `components/ui` know nothing about the API or features.
5. No business rules in the client. If a decision is needed ("can continue", "next step"), the backend provides it.
6. Every data view handles loading, empty, error, and success.
7. Tailwind classes are written literally; variants are composed with a `cva`-style map, never string-built.
8. Accessible by default: labelled inputs, visible focus, keyboard reachable, `aria-live` for async results, reduced-motion support.
9. Files kebab-case; components PascalCase; hooks `useX`.
10. Prettier formatting; ESLint must pass with zero warnings.
