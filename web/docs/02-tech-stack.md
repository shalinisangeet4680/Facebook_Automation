# Tech stack

| Library | Purpose |
|---|---|
| Next.js 16 (App Router), React 19 | Framework and rendering |
| TypeScript (strict) | Language |
| Tailwind CSS 4 | Styling with design tokens as CSS variables |
| Motion (`motion/react`) | Animations: page transitions, the Connect Meta guide, verification sequence |
| Geist and Geist Mono (`next/font`) | Typography, self-hosted |
| Radix UI primitives (`radix-ui`) | Accessible dialogs, menus, tooltips, radio groups, tabs |
| lucide-react | Icons |
| TanStack Query | Server state: caching, retries, polling, mutations |
| openapi-typescript + openapi-fetch | Types generated from the backend OpenAPI contract and a typed fetch client |
| clsx, tailwind-merge | Class composition |
| sonner | Toasts |
| Vitest + Testing Library | Component and hook tests |
| Playwright | End-to-end browser tests against the real backend in mock-Meta mode |
| ESLint (next config) + Prettier | Lint and format |
