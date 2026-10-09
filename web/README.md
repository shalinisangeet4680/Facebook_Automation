# Web

The web app is the browser client for the product. It renders screens and calls the backend API; it holds no business rules, no database access, and no secrets. A future mobile app uses the same API.

## Quick start

```bash
cd ../backend && npm run start:dev
cd ../backend && npm run worker:dev
npm install
npm run dev
```

Open `http://localhost:3200`. Test login: phone `8434230999`, code `963101`.

## Documentation

| Document | Contents |
|---|---|
| [Architecture](docs/01-architecture.md) | Thin-client model, routing, data flow, auth, rendering |
| [Tech stack](docs/02-tech-stack.md) | Libraries and why each is used |
| [Project structure and conventions](docs/03-project-structure-and-conventions.md) | Folders, naming, component rules |
| [Design system](docs/04-design-system.md) | Tokens, typography, colour, spacing, motion, components, themes |
| [API client and auth](docs/05-api-client-and-auth.md) | Generated types, fetch client, refresh, errors |
| [Screens and flows](docs/06-screens-and-flows.md) | Login, app shell, setup, Connect Meta guide, account selection |
| [Quality](docs/07-quality.md) | Accessibility, performance budgets, testing, CI |
| [Local development](docs/08-local-development.md) | Setup, environment, commands |
