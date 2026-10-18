// The pure parts of `pnpm init:project`: no file system, processes or
// prompts, so the tests import this freely. init-project.ts does the I/O.
//
// Run by Node's type stripping before `pnpm install`, so this file imports
// only node: modules and uses erasable syntax only.

import { parseArgs } from 'node:util';

// What the template calls itself. Every rewrite below starts from these.
export const TEMPLATE = {
  rootName: 'nestjs-react-monorepo-starter',
  scope: 'starter',
  db: 'starter',
  displayName: 'Starter',
  repoUrl: 'https://github.com/akinurrahman/nestjs-react-monorepo-starter.git',
} as const;

// Tracked files that keep "starter" on purpose. The smoke test allows these
// and nothing else.
export const LEAVE_ALONE = [
  // Arbitrary fixture names for the _test guard.
  'apps/api/test/test-db.spec.ts',
  // Prisma's own docs ("a starter model").
  '.claude/skills/prisma-cli/',
] as const;

// Template-only files, deleted by the rename. The license is the project's
// decision, not the template's.
export const DELETE_FILES = ['LICENSE', '.git-blame-ignore-revs'] as const;

// The init script itself, removed once the project is set up.
export const INIT_PACKAGE_DIR = 'scripts/init-project';

// ----------------------------------------------------------------------------
// Names

export type Names = {
  // Kebab case: the root package name and the docker compose project.
  name: string;
  // The package scope, without the @.
  scope: string;
  // Snake case: the dev database; the tests use <db>_test and <db>_browser.
  db: string;
  // What people read: the app's title, the browser tab, the api docs.
  displayName: string;
};

const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// <db>_browser, the longest database name, must fit Postgres's 63 bytes.
export const NAME_MAX_LENGTH = 55;

const DISPLAY_NAME_MAX_LENGTH = 60;

// The template's own name, and databases every Postgres already has.
const RESERVED_NAMES = new Set([
  TEMPLATE.db,
  'postgres',
  'template0',
  'template1',
]);

export function validateName(name: string): string | undefined {
  if (!NAME_PATTERN.test(name)) {
    return `"${name}" is not kebab case: lowercase letters and digits in words joined by single dashes, starting with a letter (e.g. acme-crm)`;
  }
  if (name.length > NAME_MAX_LENGTH) {
    return `"${name}" is longer than ${NAME_MAX_LENGTH} characters`;
  }
  if (RESERVED_NAMES.has(name.replaceAll('-', '_'))) {
    return `"${name}" is reserved`;
  }
  return undefined;
}

export function validateDisplayName(displayName: string): string | undefined {
  if (displayName.trim() !== displayName || displayName === '') {
    return 'The display name must not be empty or start or end with a space';
  }
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return `The display name is longer than ${DISPLAY_NAME_MAX_LENGTH} characters`;
  }
  // oxlint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(displayName)) {
    return 'The display name must not contain control characters';
  }
  return undefined;
}

// acme-crm -> Acme Crm. Acronyms come out wrong (Acme Crm, not Acme CRM),
// which is what --display-name is for.
export function toDisplayName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function deriveNames(name: string, displayName?: string): Names {
  return {
    name,
    scope: name,
    db: name.replaceAll('-', '_'),
    displayName: displayName ?? toDisplayName(name),
  };
}

// ----------------------------------------------------------------------------
// Admin and env values

export type Admin = { email: string; name: string; password: string };

// A rough copy of createUserSchema's rules from the shared package, which
// cannot be imported before `pnpm install`. The seed checks again with the
// real schema.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 256;
const ADMIN_NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;

export function validateAdminEmail(email: string): string | undefined {
  if (
    email.length > EMAIL_MAX_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return `"${email}" is not a valid email`;
  }
  return envValueError(email);
}

export function validateAdminName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > ADMIN_NAME_MAX_LENGTH) {
    return `The admin name must be 1 to ${ADMIN_NAME_MAX_LENGTH} characters`;
  }
  return envValueError(name);
}

export function validateAdminPassword(password: string): string | undefined {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return `The admin password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`;
  }
  return envValueError(password);
}

function envValueError(value: string): string | undefined {
  try {
    quoteEnvValue(value);
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
}

// Single quotes are literal in dotenv and Node's parseEnv, so most values go
// in those. A value with a single quote goes in double quotes, where only a
// backslash could change it.
export function quoteEnvValue(value: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error('An env value cannot hold a line break');
  }
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"') && !value.includes('\\')) return `"${value}"`;
  throw new Error(
    'An env value cannot hold both a single quote and a double quote or backslash',
  );
}

export function databaseUrl(db: string, port: number): string {
  return `postgresql://postgres:postgres@localhost:${port}/${db}`;
}

// The root .env, from .env.example: the port docker compose and the tests use.
export function renderRootEnv(example: string, port: number): string {
  return replaceLine(example, /^DB_PORT=.*$/m, `DB_PORT=${port}`, 'DB_PORT');
}

// apps/api/.env, from apps/api/.env.example (already renamed).
export function renderApiEnv(
  example: string,
  values: { db: string; port: number; jwtSecret: string; admin: Admin },
): string {
  let env = replaceLine(
    example,
    /^DATABASE_URL=.*$/m,
    `DATABASE_URL="${databaseUrl(values.db, values.port)}"`,
    'DATABASE_URL',
  );
  env = replaceLine(
    env,
    /^JWT_SECRET=.*$/m,
    `JWT_SECRET=${quoteEnvValue(values.jwtSecret)}`,
    'JWT_SECRET',
  );
  for (const [key, value] of [
    ['SEED_ADMIN_EMAIL', values.admin.email],
    ['SEED_ADMIN_PASSWORD', values.admin.password],
    ['SEED_ADMIN_NAME', values.admin.name],
  ] as const) {
    env = replaceLine(
      env,
      new RegExp(`^#? ?${key}=.*$`, 'm'),
      `${key}=${quoteEnvValue(value)}`,
      key,
    );
  }
  return env;
}

function replaceLine(
  source: string,
  pattern: RegExp,
  line: string,
  what: string,
): string {
  if (!pattern.test(source)) {
    throw new Error(`No ${what} line to fill in the env example`);
  }
  return source.replace(pattern, () => line);
}

// ----------------------------------------------------------------------------
// Repo state and remote

// A fresh run needs a clean tree, so the init commit holds only its own
// changes. The rename only edits and deletes tracked files (the env files it
// writes are gitignored), so `git restore .` undoes a rename that stopped
// partway, which is the one way the script itself leaves a dirty tree
// behind the template's name.
export const DIRTY_TREE_MESSAGE = [
  'The working tree has uncommitted changes.',
  '  Yours? Commit or stash them first, so the init commit holds only its own.',
  '  Left by an init:project run that stopped during the rename? Undo it and run again:',
  '    git restore .',
  '  (git restore . discards every uncommitted change to tracked files.)',
].join('\n');

// What is left once the init script has removed itself: the install that
// drops it from the lockfile, the format, and the commit. Each is safe to
// repeat.
export function finishCommands(commitMessage: string | undefined): string[] {
  return [
    'pnpm install --no-frozen-lockfile',
    'pnpm format',
    ...(commitMessage === undefined
      ? []
      : ['git add -A', `git commit -m "${commitMessage}"`]),
  ];
}

// How far a run got: nothing changed yet, files changed (a rerun with the
// same --name finishes), or the script removed itself (a rerun is not
// possible, the rest is by hand).
export type InitStage = 'none' | 'changing' | 'removed';

export function stopHint(
  stage: InitStage,
  finish: string[],
): string | undefined {
  switch (stage) {
    case 'none':
      return undefined;
    case 'changing':
      return 'Fix the cause and run it again with the same --name: every step is safe to repeat.';
    case 'removed':
      return [
        'The init script already removed itself, so it cannot run again. Fix the cause, then finish by hand:',
        ...finish.map((command) => `  ${command}`),
      ].join('\n');
  }
}

export type InitState =
  | { kind: 'fresh' }
  | { kind: 'resume' }
  | { kind: 'initialized'; name: string };

// The root package name is written last by the rename, so it is still the
// template's until a rename has finished.
export function initState(
  rootPackageJson: string,
  name: string | undefined,
): InitState {
  const current = (JSON.parse(rootPackageJson) as { name?: string }).name;
  if (current === TEMPLATE.rootName) return { kind: 'fresh' };
  if (current !== undefined && current === name) return { kind: 'resume' };
  return { kind: 'initialized', name: current ?? '(no name)' };
}

export type GitHubRepo = { owner: string; repo: string };

// https://github.com/o/r(.git), git@github.com:o/r(.git) or
// ssh://git@github.com/o/r(.git). Anything else is undefined.
export function parseGitHubRemote(url: string): GitHubRepo | undefined {
  const match =
    /^(?:https:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(
      url.trim(),
    );
  return match ? { owner: match[1]!, repo: match[2]! } : undefined;
}

export function parseRepoFlag(value: string): GitHubRepo | undefined {
  const match = /^([\w.-]+)\/([\w.-]+)$/.exec(value);
  return match ? { owner: match[1]!, repo: match[2]! } : undefined;
}

// ----------------------------------------------------------------------------
// File rewrites

export type RewriteContext = {
  names: Names;
  // Undefined when origin is not GitHub and --repo was not passed.
  repo: GitHubRepo | undefined;
};

export function isLeftAlone(path: string): boolean {
  return LEAVE_ALONE.some((entry) =>
    entry.endsWith('/') ? path.startsWith(entry) : path === entry,
  );
}

// The lockfile is left to `pnpm install`, which rewrites the two workspace
// links itself. The init script is deleted at the end, so it is not renamed.
export function shouldRewrite(path: string): boolean {
  return (
    path !== 'pnpm-lock.yaml' &&
    !path.startsWith(`${INIT_PACKAGE_DIR}/`) &&
    !isLeftAlone(path)
  );
}

// Every tracked text file goes through here. Idempotent: a file that is
// already rewritten comes back unchanged, so a rerun after a crash is safe.
export function rewriteFile(
  path: string,
  source: string,
  ctx: RewriteContext,
): string {
  if (!shouldRewrite(path)) return source;
  const { names } = ctx;

  let out = source
    .replaceAll(`@${TEMPLATE.scope}/`, `@${names.scope}/`)
    .replace(/\bstarter_(test|browser)\b/g, `${names.db}_$1`);

  if (path === 'package.json' || path.endsWith('/package.json')) {
    out = rewritePackageJson(out, path === 'package.json' ? names.name : null);
  }

  switch (path) {
    case 'docker-compose.yml':
      out = replaceOnce(out, 'name: starter\n', `name: ${names.name}\n`);
      out = replaceOnce(
        out,
        'POSTGRES_DB: starter\n',
        `POSTGRES_DB: ${names.db}\n`,
      );
      out = replaceOnce(out, "-d starter']", `-d ${names.db}']`);
      break;
    case 'apps/api/.env.example':
      out = replaceOnce(
        out,
        `@localhost:5432/${TEMPLATE.db}"`,
        `@localhost:5432/${names.db}"`,
      );
      break;
    case 'apps/web/src/app/config.ts':
      out = replaceOnce(
        out,
        `APP_NAME = '${TEMPLATE.displayName}';`,
        `APP_NAME = ${tsString(names.displayName)};`,
      );
      break;
    case 'apps/web/index.html':
      out = replaceOnce(
        out,
        `<title>${TEMPLATE.displayName}</title>`,
        `<title>${htmlText(names.displayName)}</title>`,
      );
      break;
    case 'apps/api/src/config/swagger.config.ts':
      out = replaceOnce(
        out,
        `.setTitle('${TEMPLATE.displayName} API')`,
        `.setTitle(${tsString(`${names.displayName} API`)})`,
      );
      break;
    case 'README.md':
      out = rewriteReadme(out, ctx);
      break;
    case 'CLAUDE.md':
      out = removeTemplateBlocks(out);
      out = replaceOnce(
        out,
        'Monorepo starter template: NestJS API, React web app and a shared package.',
        `${names.displayName}: a monorepo with a NestJS API, a React web app and a shared package.`,
      );
      break;
  }
  return out;
}

function rewriteReadme(source: string, ctx: RewriteContext): string {
  const { names, repo } = ctx;
  const title = `# ${names.displayName}\n`;
  let out = removeTemplateBlocks(source);
  if (!out.startsWith(title)) out = `${title}\n${out.replace(/^\n+/, '')}`;
  const repoUrl = repo
    ? `https://github.com/${repo.owner}/${repo.repo}.git`
    : 'https://github.com/<owner>/<repo>.git';
  out = replaceOnce(out, TEMPLATE.repoUrl, repoUrl);
  out = replaceOnce(
    out,
    `cd ${TEMPLATE.rootName}\n`,
    `cd ${repo?.repo ?? names.name}\n`,
  );
  out = replaceOnce(out, `${TEMPLATE.rootName}/\n`, `${names.name}/\n`);
  return out;
}

function rewritePackageJson(source: string, rootName: string | null): string {
  const pkg = JSON.parse(source) as Record<string, unknown>;
  if (rootName !== null) pkg['name'] = rootName;
  delete pkg['author'];
  delete pkg['license'];
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

// Replaces `from`, which must appear once. Already replaced (`to` present
// instead) is fine; neither means the template moved on without the script.
export function replaceOnce(source: string, from: string, to: string): string {
  const count = source.split(from).length - 1;
  if (count === 1) return source.replace(from, () => to);
  if (count === 0 && source.includes(to)) return source;
  throw new Error(
    count === 0
      ? `Expected to find ${JSON.stringify(from)}`
      : `Expected ${JSON.stringify(from)} once, found it ${count} times`,
  );
}

const TEMPLATE_BLOCK =
  /<!-- template:start -->[\s\S]*?<!-- template:end -->\n*/g;

// Drops every `<!-- template:start -->` ... `<!-- template:end -->` block:
// the parts of README.md and CLAUDE.md about the template itself.
export function removeTemplateBlocks(source: string): string {
  return source.replace(TEMPLATE_BLOCK, '');
}

function tsString(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function htmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// ----------------------------------------------------------------------------
// Self-removal

// The edits that take the init script out of the project once it is done.
// Returns the source unchanged for every other file.
export function removeInitScript(path: string, source: string): string {
  switch (path) {
    case 'package.json': {
      const pkg = JSON.parse(source) as { scripts?: Record<string, string> };
      if (!pkg.scripts?.['init:project']) return source;
      delete pkg.scripts['init:project'];
      return `${JSON.stringify(pkg, null, 2)}\n`;
    }
    case 'pnpm-workspace.yaml':
      return source.replace(`  - ${INIT_PACKAGE_DIR}\n`, '');
    case '.oxlintrc.json': {
      const config = JSON.parse(source) as {
        overrides?: { files: string[] }[];
      };
      const kept = config.overrides?.filter(
        (o) => !o.files.some((f) => f.startsWith(`${INIT_PACKAGE_DIR}/`)),
      );
      if (!kept || kept.length === config.overrides!.length) return source;
      config.overrides = kept;
      return `${JSON.stringify(config, null, 2)}\n`;
    }
    default:
      return source;
  }
}

// ----------------------------------------------------------------------------
// Diff, for --dry-run

// Changed lines only, as -/+ with line numbers, from a plain LCS. The files
// are small enough for the quadratic table.
export function lineDiff(before: string, after: string): string[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (
      i < a.length &&
      (j === b.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)
    ) {
      out.push(`-${String(i + 1).padStart(4)} ${a[i]}`);
      i++;
    } else {
      out.push(`+${String(j + 1).padStart(4)} ${b[j]}`);
      j++;
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Command line

export type CliOptions = {
  name?: string;
  displayName?: string;
  adminEmail?: string;
  adminName?: string;
  adminPassword?: string;
  // Undefined when --db-port is not passed: the script prompts, or takes
  // DEFAULT_DB_PORT with --yes.
  dbPort?: number;
  repo?: GitHubRepo;
  commit: boolean;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

export const DEFAULT_DB_PORT = 5432;
export const DEFAULT_ADMIN_NAME = 'Admin';

// How far past DEFAULT_DB_PORT the prompt looks for a free port to suggest.
export const PORT_SEARCH_LIMIT = 20;

export function parsePort(text: string): number | undefined {
  if (!/^\d{1,5}$/.test(text)) return undefined;
  const port = Number(text);
  return port >= 1 && port <= 65535 ? port : undefined;
}

// The first free port from `start` on, checking at most `limit` of them.
export async function firstFreePort(
  start: number,
  isFree: (port: number) => Promise<boolean>,
  limit: number = PORT_SEARCH_LIMIT,
): Promise<number | undefined> {
  for (let port = start; port < start + limit && port <= 65535; port++) {
    if (await isFree(port)) return port;
  }
  return undefined;
}

export type PortPromptIo = {
  // Shows the question with `fallback` as the default an empty answer takes.
  ask: (question: string, fallback?: string) => Promise<string>;
  isFree: (port: number) => Promise<boolean>;
  say: (line: string) => void;
};

// Prompts for the local Postgres port. Suggests DEFAULT_DB_PORT, or the next
// free port when that is taken (and says so), and checks each answer right
// away, asking again until it is a free port.
export async function choosePort(io: PortPromptIo): Promise<number> {
  const start = DEFAULT_DB_PORT;
  const suggested = await firstFreePort(start, io.isFree);
  const question =
    suggested === start
      ? 'Local Postgres port'
      : suggested === undefined
        ? `Local Postgres port (${start} to ${start + PORT_SEARCH_LIMIT - 1} are all taken on this machine)`
        : `Local Postgres port (${start} is taken on this machine, ${suggested} is free)`;
  for (;;) {
    const answer = await io.ask(question, suggested?.toString());
    const port = parsePort(answer);
    if (port === undefined) {
      io.say(`  "${answer}" is not a port: enter a number from 1 to 65535`);
    } else if (!(await io.isFree(port))) {
      io.say(`  Port ${port} is already in use on this machine: pick another`);
    } else {
      return port;
    }
  }
}

export const HELP = `Usage: pnpm init:project [options]

Turns a fresh copy of this template into a named project, once: renames it,
writes the env files, starts Postgres, migrates, seeds the first admin,
removes this script and commits the result. Prompts for anything not passed.

  --name <kebab-case>      Project name, e.g. acme-crm. Gives the package scope
                           (@acme-crm/*) and the databases (acme_crm,
                           acme_crm_test, acme_crm_browser)
  --display-name <text>    What people read (default: from the name, acme-crm
                           -> "Acme Crm")
  --admin-email <email>    First admin's email
  --admin-name <text>      First admin's name (default: ${DEFAULT_ADMIN_NAME})
  --admin-password <text>  First admin's password. Prefer the prompt or the
                           INIT_ADMIN_PASSWORD env var: a flag ends up in your
                           shell history. Empty at the prompt generates one
  --db-port <port>         Local Postgres port. The prompt suggests ${DEFAULT_DB_PORT}, or the
                           next free port when that is taken; --yes takes ${DEFAULT_DB_PORT}
  --repo <owner/name>      GitHub repo for the README (default: from origin)
  --no-commit              Leave the changes uncommitted
  --dry-run                Print every file change and command, change nothing
  --yes                    Never prompt: a missing value is an error
  --help                   Show this help
`;

export function parseCli(
  argv: string[],
  env: Record<string, string | undefined>,
): CliOptions {
  const { values } = parseArgs({
    args: argv,
    allowNegative: true,
    strict: true,
    options: {
      name: { type: 'string' },
      'display-name': { type: 'string' },
      'admin-email': { type: 'string' },
      'admin-name': { type: 'string' },
      'admin-password': { type: 'string' },
      'db-port': { type: 'string' },
      repo: { type: 'string' },
      commit: { type: 'boolean', default: true },
      'dry-run': { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  let dbPort: number | undefined;
  if (values['db-port'] !== undefined) {
    dbPort = parsePort(values['db-port']);
    if (dbPort === undefined) {
      throw new Error(
        `--db-port must be a port number, got "${values['db-port']}"`,
      );
    }
  }

  let repo: GitHubRepo | undefined;
  if (values.repo !== undefined) {
    repo = parseRepoFlag(values.repo);
    if (!repo)
      throw new Error(`--repo must be owner/name, got "${values.repo}"`);
  }

  return {
    name: values.name,
    displayName: values['display-name'],
    adminEmail: values['admin-email'],
    adminName: values['admin-name'],
    adminPassword:
      values['admin-password'] ?? (env['INIT_ADMIN_PASSWORD'] || undefined),
    dbPort,
    repo,
    commit: values.commit,
    dryRun: values['dry-run'],
    yes: values.yes,
    help: values.help,
  };
}
