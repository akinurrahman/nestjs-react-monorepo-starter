<div align="center">

# starter-react-nest

**The boring parts, done once.**

A fullstack monorepo starter with React, NestJS, Prisma and Postgres.<br>
Built so every project starts from the same solid ground, and ships faster with AI.

<br>

![Node](https://img.shields.io/badge/Node-24-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

[Quick start](#quick-start) · [Commands](#commands) · [Structure](#project-structure) · [Conventions](#conventions) · [Roadmap](#roadmap)

</div>

<br>

> [!NOTE]
> **Work in progress.** The API, shared package, web app, auth and the users module are in place. Repo-wide tooling, CI and the init script are next. See the [roadmap](#roadmap).

## Why this exists

Every new project used to start the same way: a day or two of wiring up folders, configs, database, testing and linting, slightly differently each time. This starter makes those decisions once, so a new project can go straight to building features.

It's also built for AI-driven development. A consistent structure, strict types and clear conventions give coding agents a pattern to follow instead of one to invent.

## What's inside

| Layer          | Choice                                                     |
| -------------- | ---------------------------------------------------------- |
| **Monorepo**   | pnpm workspaces + Turborepo, with cached and ordered tasks |
| **API**        | NestJS 12 on ESM, tested with Vitest                       |
| **Database**   | Prisma 7 with a multi-file schema, Postgres 18 in Docker   |
| **Validation** | Zod, for env config today and shared schemas soon          |
| **Linting**    | Oxlint, type-aware                                         |
| **Web**        | React + Vite _(coming)_                                    |

## Quick start

**You'll need:** Node 24 (see `.nvmrc`), pnpm 10, and Docker Desktop running.

```bash
# 1. Clone and install
git clone https://github.com/akinurrahman/starter-react-nest.git
cd starter-react-nest
pnpm install

# 2. Create your local env file, then set JWT_SECRET in it (the file shows
#    how to generate one) and the SEED_ADMIN_* values for your first admin
cp apps/api/.env.example apps/api/.env

# 3. Start Postgres
docker compose up -d

# 4. Create the database tables
pnpm --filter @starter/api db:deploy

# 5. Create the first admin user
pnpm --filter @starter/api db:seed

# 6. Start everything
pnpm dev
```

That's it. The API is running at **http://localhost:8000**.

<details>
<summary><b>Port 5432 already in use?</b></summary>

<br>

If a local Postgres or another project's database is already on 5432, move this one to a different port:

1. Create a `.env` in the repo root with `DB_PORT=5433`
2. In `apps/api/.env`, change the port in `DATABASE_URL` to `5433`
3. Run `docker compose up -d` again

</details>

## Commands

Run everything from the repo root. Turbo runs each task in every app that has it, in the right order, and skips work that hasn't changed.

| Command             | What it does                                                               |
| ------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`          | Start all apps in watch mode                                               |
| `pnpm build`        | Build all apps for production                                              |
| `pnpm typecheck`    | Check types across the repo                                                |
| `pnpm lint`         | Lint with Oxlint                                                           |
| `pnpm format`       | Format the whole repo with Prettier                                        |
| `pnpm format:check` | Check formatting without writing                                           |
| `pnpm test`         | Run unit tests                                                             |
| `pnpm test:e2e`     | Run end-to-end tests against `starter_test` _(needs the database running)_ |

**Database**

| Command                                      | What it does                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @starter/api db:migrate`      | Create and apply a migration after a schema change                                                                                                       |
| `pnpm --filter @starter/api db:deploy`       | Apply existing migrations, without creating new ones                                                                                                     |
| `pnpm --filter @starter/api db:seed`         | Create the admin user from `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and `SEED_ADMIN_NAME` in `apps/api/.env`. Does nothing if that email already exists |
| `pnpm --filter @starter/api db:studio`       | Browse and edit data in your browser                                                                                                                     |
| `pnpm --filter @starter/api db:test:prepare` | Create the e2e database if missing and apply migrations to it                                                                                            |

The seed builds the API and runs `dist/seed.js` through `nest start --entryFile seed`, configured as the seed command in `apps/api/prisma7.config.ts`.

E2E tests never touch your dev database. They use a second database, `starter_test`, in the same Postgres container, set in `apps/api/.env.test`. `pnpm test:e2e` creates and migrates it on every run and empties the app tables before each test file. A name that does not end in `_test` stops the run before it connects.

## Project structure

```
starter-react-nest/
├── apps/
│   └── api/                   NestJS API
│       ├── prisma/
│       │   ├── schema.prisma      generator and datasource only
│       │   ├── models/            one .prisma file per domain
│       │   └── migrations/        committed, applied in order
│       └── src/
│           ├── config/            env validation
│           ├── database/          Prisma service
│           └── generated/         Prisma client (generated, not committed)
├── packages/                  shared code (coming)
├── docker-compose.yml         local Postgres
└── turbo.json                 task pipeline
```

**`apps/`** holds things you run and deploy. **`packages/`** holds code shared between them, like Zod schemas and types.

## Conventions

- **Naming.** Prisma models and fields are camelCase, mapped to snake_case tables and columns in Postgres.
- **One schema file per domain.** `user.prisma`, `leave.prisma`, `payroll.prisma`, each holding its related models.
- **Migrations are permanent.** Always committed, never edited once they've run outside your machine. Need a change? Make a new migration.
- **Config is validated.** The API refuses to start if an env variable is missing or wrong, and tells you exactly which one.
- **Secrets stay out of git.** Only `.env.example` files are committed, plus `apps/api/.env.test`, which holds nothing but the local Docker credentials for the throwaway test database and a fake JWT secret.

## Roadmap

- [x] Monorepo with pnpm and Turborepo
- [x] NestJS API on ESM with Vitest
- [x] Prisma 7 and Postgres in Docker
- [x] Validated environment config
- [x] Request validation, error handling, logging, Swagger, health check
- [x] Shared package for schemas and types
- [x] React web app
- [x] Auth and the users module
- [ ] Repo-wide tooling and CI
- [ ] Init script to set up a new project in one command

## License

[MIT](LICENSE) © Akinur Rahman
