<!-- template:start -->

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/banner-dark.svg">
  <img alt="NestJS + React" src="docs/images/banner-light.svg" width="100%">
</picture>

<br>
<br>

**A NestJS and React monorepo starter with Prisma, Postgres, auth and tests.**<br>
Create a repo from the template, run one command, and start on features.

<br>

[![CI](https://github.com/akinurrahman/nestjs-react-monorepo-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/akinurrahman/nestjs-react-monorepo-starter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node 24](https://img.shields.io/badge/node-24-339933?logo=node.js&logoColor=white)](.nvmrc)

[Quick start](#quick-start) · [What's inside](#whats-inside) · [Why](#why-this-starter) · [Commands](#commands) · [Structure](#project-structure)

</div>

<!-- template:end -->

## What's inside

- **Auth.** Email and password sign-in. The access token lives in memory only, and the refresh token in an httpOnly cookie. Refresh tokens rotate on every use, and a reused one revokes the session. Two roles, ADMIN and USER. Routes are denied by default, in the API and in the web app.
- **Users module.** List with search, filters and pagination, create, edit, disable, set a password, and an account page for your own profile. It is the module every new one copies.
- **Shared Zod schemas.** `packages/shared` holds the request schemas, response types and error codes. The API validates with them and the web forms use them, so the two can't drift.
- **Web app.** React 19, Vite, React Router, TanStack Query and Table, react-hook-form, Tailwind 4 and shadcn on Base UI. Light and dark themes, a command palette, URL-driven list filters.
- **API.** NestJS 12 on ESM, Prisma 7 on Postgres 18, one error format, Swagger docs, structured logs with pino, rate limits on sign-in.
- **Tests.** Unit tests with Vitest, API e2e tests against a real Postgres, and Playwright browser tests in Chromium and Firefox against production builds.
- **CI.** GitHub Actions runs format, lint, typecheck, unit and e2e tests, and the browser tests on every pull request.

<!-- template:start -->

- **One-command init.** `pnpm init:project` renames everything, writes the env files, sets up the database and seeds the first admin.

<!-- template:end -->

## Quick start

**You'll need:** Node 24 (see `.nvmrc`), pnpm 10, and Docker Desktop running.

On Windows, keep the clone's path under about 150 characters: `pnpm lint` runs a tool from deep inside `node_modules`, and it fails to start past Windows' 260-character path limit.

<!-- template:start -->

### New project from the template

Click **Use this template** on GitHub, clone your new repo, then:

```bash
pnpm install
pnpm init:project
pnpm dev
```

`pnpm init:project` asks for a project name and the first admin. It renames the packages (`@starter/*` becomes `@<name>/*`), the databases and the Docker Compose project, writes `.env` and `apps/api/.env` with a fresh `JWT_SECRET`, starts Postgres, applies the migrations, seeds the admin, and commits the result as `chore: initialize <name>`. Then it deletes itself and the template-only parts of this README.

It runs once. `pnpm init:project --help` lists a flag for every value, and `--dry-run` prints every change without making any. If a step fails, the script tells you how to finish.

### Without the init script

The steps below are what the script automates, and what anyone who clones the new project runs.

<!-- template:end -->

```bash
# 1. Clone and install
git clone https://github.com/akinurrahman/nestjs-react-monorepo-starter.git
cd nestjs-react-monorepo-starter
pnpm install

# 2. Create your local env file, then set JWT_SECRET in it (the file shows
#    how to generate one) and the SEED_ADMIN_* values for your first admin
cp apps/api/.env.example apps/api/.env

# 3. Start Postgres
docker compose up -d

# 4. Create the database tables
pnpm --filter @starter/api db:deploy

# 5. Create the first admin user
pnpm db:seed

# 6. Start everything
pnpm dev
```

The web app runs at **http://localhost:5173** and the API at **http://localhost:8000**, with its docs at **http://localhost:8000/docs**. Sign in with the admin from step 2.

<details>
<summary><b>Port 5432 already in use?</b></summary>

<br>

If a local Postgres or another project's database is already on 5432, move this one to a different port:

1. Create a `.env` in the repo root with `DB_PORT=5433`
2. In `apps/api/.env`, change the port in `DATABASE_URL` to `5433`
3. Run `docker compose up -d` again

The e2e and browser tests read `DB_PORT` from the root `.env` too, so they follow without any change to the committed `apps/api/.env.test` or `apps/browser-tests/browser-env.ts`.

</details>

<!-- template:start -->

## Why this starter

Each choice below is made once, so a new project doesn't make it again.

- **The access token never touches storage.** A script injected into the page can't read a token that isn't there. A reload gets a new one from the httpOnly refresh cookie.
- **One schema per request, shared.** The API validates a body with the same Zod schema the web form uses. An unknown field is a 400, never silently dropped.
- **Real databases in tests.** E2E and browser tests run against Postgres, each in its own database, never your dev data.
- **Exact versions and a 14-day release age.** Every dependency is pinned, and pnpm refuses any version less than 14 days old, transitive ones included. A compromised release has time to get caught before it lands in an install.
- **One pattern to copy.** `src/users` in the API and `features/users` in the web app are the reference modules. The rules are written down in `CLAUDE.md` and `.claude/skills/`, so people and coding agents follow the same pattern.

<!-- template:end -->

## Stack

| Layer        | Choice                                                                          |
| ------------ | ------------------------------------------------------------------------------- |
| Monorepo     | pnpm 10 workspaces, Turborepo 2, TypeScript 6                                   |
| API          | NestJS 12 on ESM, Zod 4 with nestjs-zod, nestjs-pino, Swagger                   |
| Database     | Prisma 7 with a multi-file schema, Postgres 18 in Docker                        |
| Web          | React 19, Vite 8, React Router 8, TanStack Query 5 and Table 9, react-hook-form |
| UI           | Tailwind 4, shadcn on Base UI, lucide icons, sonner toasts                      |
| Client state | zustand                                                                         |
| Tests        | Vitest 4, Testing Library, msw, Playwright (Chromium and Firefox)               |
| Tooling      | Oxlint (type-aware), Prettier, GitHub Actions                                   |

## Commands

Run everything from the repo root. Turbo runs each task in every app that has it, in the right order, and skips work that hasn't changed.

<details>
<summary><b>All commands</b></summary>

<br>

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `pnpm dev`             | Start all apps in watch mode                                     |
| `pnpm build`           | Build all apps for production                                    |
| `pnpm typecheck`       | Check types across the repo                                      |
| `pnpm lint`            | Lint with Oxlint                                                 |
| `pnpm format`          | Format the whole repo with Prettier                              |
| `pnpm format:check`    | Check formatting without writing                                 |
| `pnpm test`            | Run unit tests                                                   |
| `pnpm test:e2e`        | Run the API end-to-end tests _(needs the database running)_      |
| `pnpm test:browser`    | Build, then run the browser tests _(needs the database running)_ |
| `pnpm test:browser:ui` | Build, then open the browser tests in Playwright's UI mode       |

**Database**

| Command                                      | What it does                                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @starter/api db:migrate`      | Create and apply a migration after a schema change                                                                                                  |
| `pnpm --filter @starter/api db:deploy`       | Apply existing migrations, without creating new ones                                                                                                |
| `pnpm db:seed`                               | Create the admin from the `SEED_ADMIN_*` values in `apps/api/.env`. Never changes an existing user with that email; fails if no active admin exists |
| `pnpm --filter @starter/api db:studio`       | Browse and edit data in your browser                                                                                                                |
| `pnpm --filter @starter/api db:test:prepare` | Create the e2e database if missing and apply migrations to it                                                                                       |

</details>

<details>
<summary><b>How the tests use the database</b></summary>

<br>

Tests never touch your dev database. Each kind gets its own database in the same Postgres container.

- **E2E** (`pnpm test:e2e`) uses `starter_test`, set in `apps/api/.env.test`. Each run creates and migrates it, and empties the app tables before each test file. A name that does not end in `_test` stops the run before it connects. A drift check fails the run when the Prisma schema and the migrations differ.
- **Browser** (`pnpm test:browser`, in `apps/browser-tests`) uses `starter_browser`, dropped and recreated on every run. The tests cover what only a real browser can: the refresh cookie, reloads, several tabs and redirects. They also open every page to check it renders, and run the main admin flow. The access token lasts 5 seconds there, so a test can watch it expire.

Install the browsers once with `pnpm --filter @starter/browser-tests exec playwright install chromium firefox`. A failed run keeps a trace and a screenshot in `apps/browser-tests/test-results`.

</details>

## Project structure

<details>
<summary><b>Folder layout</b></summary>

<br>

```
nestjs-react-monorepo-starter/
├── apps/
│   ├── api/                  NestJS API
│   │   ├── prisma/
│   │   │   ├── schema.prisma     generator and datasource only
│   │   │   ├── models/           one .prisma file per domain
│   │   │   └── migrations/       committed, applied in order
│   │   ├── src/
│   │   │   ├── auth/             sign-in, refresh, sessions, guards
│   │   │   ├── users/            the reference module
│   │   │   ├── health/           liveness and readiness probes
│   │   │   ├── common/           errors, response envelope, pagination
│   │   │   ├── config/           env validation, http, logger, swagger
│   │   │   ├── database/         Prisma service
│   │   │   └── seed.ts           creates the first admin
│   │   └── test/                 e2e tests
│   ├── web/                  React app
│   │   └── src/
│   │       ├── app/              router, shell, providers, dev pages
│   │       ├── features/         one folder per domain (auth, users, ...)
│   │       ├── systems/          shared React: forms, tables, filters
│   │       ├── components/ui/    shadcn primitives
│   │       └── lib/              plain TypeScript helpers
│   └── browser-tests/        Playwright tests
├── packages/
│   └── shared/               Zod schemas and types for api and web
├── .github/workflows/        CI
├── docker-compose.yml        local Postgres
└── turbo.json                task pipeline
```

</details>

## Conventions

The full rules live in `CLAUDE.md`. The ones you'll meet first:

- **Naming.** Prisma models and fields are camelCase, mapped to snake_case tables and columns.
- **One schema file per domain.** `user.prisma`, `invoice.prisma`, each holding its related models.
- **Migrations are permanent.** Committed, never edited once they've run outside your machine. Need a change? Make a new migration.
- **Config is validated.** The API refuses to start if an env variable is missing or wrong, and says which one.
- **Secrets stay out of git.** Only `.env.example` files are committed, plus `apps/api/.env.test`, which holds the local Docker credentials for the test database and a fake JWT secret.
- **Rate limits are per instance.** The throttler keeps its counts in memory. Running several API instances needs shared storage for it.

<!-- template:start -->

## License

[MIT](LICENSE) © Akinur Rahman

<!-- template:end -->
