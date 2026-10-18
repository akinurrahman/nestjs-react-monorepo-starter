# CLAUDE.md

Monorepo starter template: NestJS API, React web app and a shared package.
Every rule here is decided. If something seems wrong, ask before working around it.

## Stack

Node 24, pnpm 10.18, Turborepo 2.11, TypeScript 6, NestJS 12 (ESM), Prisma 7.10 with
@prisma/adapter-pg, Postgres 18.6 in Docker, Zod 4 + nestjs-zod, nestjs-pino, Vitest 4, Oxlint.

- Prisma 7 and Turbo 2 may differ from your training data. Read `.claude/skills/prisma-*`
  or the installed docs before changing Prisma code or config. Don't upgrade Prisma to 8.
- All deps are pinned exact (`save-exact=true`). New deps: pin exact, check peer ranges
  against Nest 12, ask before adding a `peerDependencyRules` override.
- pnpm enforces a 14-day minimum release age for every package, transitive deps
  included (`minimumReleaseAge` in `pnpm-workspace.yaml`). If an install fails
  because a version is too new, pick an older version. Never add
  `minimumReleaseAgeExclude` entries or lower the setting without asking.
- Temporary: the nestjs-zod overrides (`@nestjs/common`, `@nestjs/swagger`) in the root
  package.json go once nestjs-zod declares Nest 12.

## Commands

Run from the repo root. One package only: `pnpm --filter @starter/api <script>`
(or `@starter/shared`, `@starter/web`, `@starter/browser-tests`).

| Task                     | Command                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| DB up                    | `docker compose up -d`                                                                     |
| Dev                      | `pnpm dev`                                                                                 |
| Typecheck / lint         | `pnpm typecheck` / `pnpm lint`                                                             |
| Unit tests               | `pnpm test`                                                                                |
| E2E tests                | `pnpm test:e2e` (Postgres must be running, uses `starter_test` from `apps/api/.env.test`)  |
| Prepare e2e DB by hand   | `pnpm --filter @starter/api db:test:prepare`                                               |
| Browser tests            | `pnpm test:browser` (Postgres must be running, builds api and web, uses `starter_browser`) |
| Browser tests, UI mode   | `pnpm test:browser:ui` (builds api and web through Turbo, then opens Playwright UI)        |
| Install test browsers    | `pnpm --filter @starter/browser-tests exec playwright install chromium firefox`            |
| Format / check           | `pnpm format` / `pnpm format:check` (root only, one Prettier config)                       |
| Build                    | `pnpm build`                                                                               |
| Regenerate Prisma client | `pnpm --filter @starter/api db:generate`                                                   |
| Apply migrations         | `pnpm --filter @starter/api db:deploy`                                                     |
| Seed the first admin     | `pnpm db:seed` (through Turbo, so shared is built first)                                   |

New migration: `pnpm --filter @starter/api exec prisma migrate dev --create-only --name <name>`,
show the SQL and wait for approval, then `pnpm --filter @starter/api db:migrate`.
Don't pass `--name` to `db:migrate`: it lands on the chained `prisma generate`.

The dev shell may be PowerShell on Windows. Prefer commands that work in both.

<!-- template:start -->

## Init script (template only)

`pnpm init:project` (`scripts/init-project`, a workspace package so the gate covers it)
turns a fresh copy of this template into a named project, once, then deletes itself and
every `<!-- template:start/end -->` block in this file and README.md.

- Pure logic in `init-project.lib.ts`, unit-tested. I/O, prompts and steps in
  `init-project.ts`. Both run by Node's type stripping before `pnpm install`: `node:`
  imports only, `.ts` extensions on relative imports.
- `smoke.ts` (`pnpm --filter @starter/init-project smoke`) clones the repo to a temp
  folder, initializes it under its own compose name and port, runs the full gate there
  and checks for leftover "starter". It starts a Postgres container: ask first.
- A change to a template name, an env key, or a line the script rewrites or fills in
  (see `rewriteFile`, `renderApiEnv`) updates the script in the same change.

<!-- template:end -->

## Layout (apps/api)

- `src/config/`: env schema, `configureApp`, http, swagger, logger, throttler
- `src/common/`: errors, filter, interceptor, pagination, swagger decorators, middleware,
  `reporting/report-error.ts` (the one hook for error monitoring, a no-op by default)
- `src/database/`: PrismaService
- `src/health/`: reference module layout (dto, repository, service, controller, module)
- `src/generated/`: Prisma client, gitignored, never edit
- `prisma/schema.prisma`: generator and datasource only. Models in `prisma/models/<domain>.prisma`
- `test/`: e2e specs

## Backend rules

- ESM: `.js` extension on every relative import.
- New modules follow `src/users/`, the golden module. `src/health/` is the minimal layout.
- Only repositories inject PrismaService.
- Services throw AppError subclasses from `src/common/errors`, never HttpException.
  Use specific codes (`new NotFoundError('USER_NOT_FOUND', 'User not found')`). Check
  conflicts yourself, don't rely on the P2002/P2025 safety net. Attach a cause with the
  options argument when there is one.
- `src/common/errors` imports nothing from Nest.
- Controllers return plain values. Never write `{ data }` by hand, the interceptor wraps.
  Paginated lists return `paginate(items, total, query, summary?)` and take `PaginationQueryDto`.
- DTOs: a Zod schema from `@starter/shared` plus `class XDto extends createZodDto(XSchema) {}`
  in the api.
- Request body schemas use `z.strictObject`: an unknown field is a 400, never silently
  dropped.
- Document every endpoint: `ApiDataResponse`, `ApiPaginatedResponse`, `ApiErrorResponses`.
- New routes land under `/api` automatically. Only probes are unprefixed and unthrottled.
- `configureApp` is the only app setup. `main.ts` and every e2e spec use it. Nothing
  registers routes or middleware after it.
- Env: add new vars to `env.schema.ts` and `.env.example`. Read config through
  ConfigService, not `process.env`.
- Never log request bodies or user data. Redaction is a safety net, not permission.
  Prisma error messages are only logged in development.

## packages/shared (@starter/shared)

Code both api and web import. Consumed as built `dist` through package `exports`, not
source: Turbo builds it first (`^build` on build, dev, typecheck, test, db:seed). If an import
fails outside Turbo, run `pnpm --filter @starter/shared build`.

- Goes in: request schemas, response types (`ApiResponse`, `PaginatedResponse`), error
  and pagination schemas, enums, constants.
- Stays in api: `createZodDto` classes, `paginate()` / `PaginatedResult`, the env schema,
  anything touching Nest, Prisma or Express.
- Imports only `zod` (peer dependency, same exact version as the api's, one copy in the
  install so `instanceof ZodError` holds). No Nest, Prisma, React or Node APIs.
- ESM, `.js` on relative imports. Everything public goes through `src/index.ts`.
  Consumers import `@starter/shared`, never deep paths.
- Schema tests live here as `*.spec.ts` next to the schema.

## Web (apps/web)

React 19, Vite 8, React Router 8 (data mode), TanStack Query 5 and Table 9, Tailwind 4,
shadcn on Base UI, react-hook-form, zustand, sonner, msw. The details live in the
`frontend-architecture` skill (`.claude/skills/`): load it before touching `src/app`,
`src/features`, `src/systems` or `src/lib`.

- Layers: `lib` (no React), `components/ui` (shadcn primitives), `systems` (shared React,
  no domain knowledge), `features/<name>` (one domain), `app` (router, shell, providers).
  Imports point down only: app → features → systems → components/ui → lib. `lib` and
  `systems` never import a feature (not lint-enforced, keep it by hand).
- Features import each other only through `@/features/<name>`. Oxlint blocks deep
  paths. Inside a feature, relative imports.
- Semantic tokens from `src/styles/theme.css` only. No raw colors (hex, rgb, oklch,
  palette classes like `bg-red-500`). Tints are opacity on a token: `bg-success/15`.
- Touch targets: 40px below `sm` (`size-10`, `h-10`), 32 to 36px from `sm` up.
- All HTTP through `apiCall<T>` / `apiCallPaginated<T>`, called only from a feature's
  `*.api.ts`. The `{ data }` envelope is unwrapped there and never leaves that file.
- Every request failure is an `ApiError`. Show it with `getErrorMessage`. Thread React
  Query's `signal` into every GET.
- Unexpected errors (a bug, a response that breaks the api contract) go through
  `reportError` in `src/lib/reporting/report-error.ts`, the one hook for error monitoring.
  The route error boundaries and the query and mutation caches call it.
- Server state lives in React Query, client state in zustand. Neither copies the other.
  Mutations own invalidation and the success toast; the global MutationCache shows errors.
- `ColumnDef` and `createColumnHelper` come from `@/systems/table` only.
- List filters live in the URL: a module-level `defineUrlFilters` spec plus
  `useUrlFilters`. Never parse `useSearchParams` by hand.
- Enums are `createLookup`; schemas use `lookup.toZodEnum()`. Roles only from
  `@starter/shared` (`ROLES`, `Role`).
- Routes are `AppRouteObject` config objects. The `handle` (title, icon, roles, nav,
  keywords) sits on the config object, never in a lazy module. Pages load through
  `lazy: async () => ({ Component })`. Feature routes are listed once, in `pages` or
  `barePages` (screens outside the shell) in `src/app/router.ts`. A nav group must
  be in `NAV_GROUPS` (`src/app/config.ts`).
- Routes are denied by default. `public: true` only for pages that work with no user
  (login, forgot password, the 404), and never under a parent with `roles`.
- Dev-only routes live in `src/app/dev`, added behind `import.meta.env.DEV`.
- Modals come from `components/ui` (Dialog, Sheet, AlertDialog), which report to the
  modal registry. Never build one straight on `@base-ui/react`.
- Toast and `confirm()` content renders outside the router: no `Link` or router hooks
  in it. Navigate from the callback with `router.navigate` or a `navigate` the page holds.
- Navigate calls in deferred callbacks (toast actions, timeouts) use absolute paths,
  since a relative path resolves against wherever the user is by then.
- Ctrl/Cmd+K (command palette) and Ctrl/Cmd+B (sidebar) are reserved.
- Any new piece in `components/ui` or `systems` gets a section or specimen on the theme
  preview page (`src/app/dev/theme-preview`) in the same change.
- Tests: HTTP goes through msw (`src/test/msw-server.ts`). Anything that needs the
  real route tree renders through `renderApp`.
- Running both apps: `docker compose up -d`, then `pnpm dev`. The API exits on boot
  without the database. Web alone: `pnpm --filter @starter/web dev`.

## Database

- Prisma names are camelCase, mapped to snake_case with `@map` / `@@map`.
- IDs: `uuid(7)` stored as `@db.Uuid`.
- DateTime fields use `@db.Timestamptz(3)`.
- Never edit a migration that has run outside your machine. Make a new one.

## Tests

- Unit: `*.spec.ts` next to the code, never touch the DB (override PrismaService or the repository).
- E2E: `test/*.e2e-spec.ts`, real AppModule through `configureApp`, test-only controllers
  for anything not yet in the app.
- Migration drift: `test/migrations.e2e-spec.ts` fails `test:e2e` when the schema and the
  migrations differ. A model change always lands with its migration.
- Browser: `apps/browser-tests`, Playwright in Chromium and Firefox against production
  builds. What needs a real browser (cookies, reloads, tabs, redirects), a render check of
  every page and the main admin flow. Pages without a nav entry are listed by hand in
  `tests/routes.spec.ts`. Not part of the per-commit gate: CI runs it on every PR. Run it
  locally before committing any change to auth, the session or the token refresh, in the
  api or the web app.
- Tests go in the same commit as the code they cover.
- Mutation-check new tests: break the code, confirm a test fails, restore.

## Git

- Conventional commits, one reason per commit. Each commit must pass format:check, lint,
  typecheck and tests.
- Formatting and lint config live at the root only (`.prettierrc`, `.prettierignore`,
  `.oxlintrc.json`). Don't add per-package configs. Package-specific lint rules go in an
  `overrides` entry, and an override that changes a plugin's rules must list that plugin.
- Don't commit until told "commit". Never push unless told.
- Ask before doing anything outside the task. Report anything you did that wasn't asked for.
- LF line endings everywhere (`.editorconfig`, `.gitattributes`).
