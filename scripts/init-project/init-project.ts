// `pnpm init:project`: turns a fresh copy of the template into a named,
// working project, once. See HELP in init-project.lib.ts for the flags.
//
// Run by Node's type stripping before `pnpm install`, so this file imports
// only node: modules and the lib, and uses erasable syntax only.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import {
  adminSummary,
  API_ENV_EXISTS_MESSAGE,
  API_ENV_FILE,
  apiEnvAction,
  choosePort,
  DEFAULT_ADMIN_NAME,
  DEFAULT_DB_PORT,
  DELETE_FILES,
  DIRTY_TREE_MESSAGE,
  HELP,
  INIT_PACKAGE_DIR,
  TEMPLATE,
  deriveNames,
  displayNameGiven,
  finishCommands,
  initState,
  lineDiff,
  parseCli,
  parseGitHubRemote,
  parsePort,
  removeInitScript,
  renderApiEnv,
  renderRootEnv,
  rewriteFile,
  stopHint,
  validateAdminEmail,
  validateAdminName,
  validateAdminPassword,
  validateDisplayName,
  validateName,
  type Admin,
  type CliOptions,
  type GitHubRepo,
  type InitStage,
  type Names,
} from './init-project.lib.ts';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

// The files the self-removal edits, besides deleting the package.
const SELF_REMOVAL_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  '.oxlintrc.json',
];

class StepError extends Error {}

// 'changing' once the first file changes: from then on, a failure leaves a
// half-initialized repo that a rerun finishes. 'removed' once the script
// has deleted itself: the rest is by hand, from `finish`.
let stage: InitStage = 'none';
let finish: string[] = [];

// ----------------------------------------------------------------------------
// Processes and files

function quoteArg(arg: string): string {
  return /^[\w@/.:=,-]+$/.test(arg) ? arg : `"${arg.replaceAll('"', '\\"')}"`;
}

// Through the shell, so pnpm.cmd resolves on Windows. One command string,
// not args with shell: true, which Node 24 deprecates. Every argument here
// is the script's own or a validated name.
function run(command: string, args: string[], opts: { quiet?: boolean } = {}) {
  const line = [command, ...args].map(quoteArg).join(' ');
  if (!opts.quiet) console.log(`\n$ ${line}`);
  const result = spawnSync(line, {
    cwd: ROOT,
    shell: true,
    stdio: opts.quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').trim(),
  };
}

function mustRun(command: string, args: string[]): void {
  if (!run(command, args).ok) {
    throw new StepError(`\`${[command, ...args].join(' ')}\` failed`);
  }
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function write(path: string, content: string): void {
  writeFileSync(join(ROOT, path), content);
}

function trackedFiles(): string[] {
  const result = run('git', ['ls-files', '-z'], { quiet: true });
  if (!result.ok) throw new StepError('`git ls-files` failed');
  return result.stdout.split('\0').filter(Boolean);
}

function isText(content: Buffer): boolean {
  return !content.subarray(0, 8000).includes(0);
}

function portIsFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const server = createServer();
    server.once('error', () => done(false));
    server.listen(port, '127.0.0.1', () => server.close(() => done(true)));
  });
}

// ----------------------------------------------------------------------------
// Prompts

async function ask(question: string, fallback?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const hint = fallback !== undefined ? ` (${fallback})` : '';
    const answer = (await rl.question(`${question}${hint}: `)).trim();
    return answer === '' && fallback !== undefined ? fallback : answer;
  } finally {
    rl.close();
  }
}

// Reads a line without echoing it.
function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    throw new StepError(
      'No terminal to prompt for the admin password: set INIT_ADMIN_PASSWORD',
    );
  }
  stdout.write(`${question}: `);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((done, fail) => {
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          finish();
          done(value);
          return;
        }
        if (char === '\u0003') {
          finish();
          fail(new StepError('Cancelled'));
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    const finish = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    stdin.on('data', onData);
  });
}

async function value(
  given: string | undefined,
  opts: CliOptions,
  prompt: () => Promise<string>,
  validate: (value: string) => string | undefined,
  flag: string,
): Promise<string> {
  if (given !== undefined) {
    const error = validate(given);
    if (error) throw new StepError(`${flag}: ${error}`);
    return given;
  }
  if (opts.yes) throw new StepError(`${flag} is required with --yes`);
  for (;;) {
    const answer = await prompt();
    const error = validate(answer);
    if (!error) return answer;
    console.log(`  ${error}`);
  }
}

// ----------------------------------------------------------------------------
// Inputs

type Inputs = {
  names: Names;
  // Undefined when apps/api/.env exists already and is kept.
  admin: Admin | undefined;
  generatedPassword: boolean;
  port: number;
  repo: GitHubRepo | undefined;
};

async function collectInputs(
  opts: CliOptions,
  name: string | undefined,
  port: number,
  resume: boolean,
): Promise<Inputs> {
  const projectName = await value(
    name,
    opts,
    () => ask('Project name, kebab case (e.g. acme-crm)'),
    validateName,
    '--name',
  );
  const derived = deriveNames(projectName);
  const displayName = await value(
    displayNameGiven(opts, resume, derived.displayName),
    opts,
    () => ask('Display name', derived.displayName),
    validateDisplayName,
    '--display-name',
  );
  const repo = opts.repo ?? githubOrigin();

  // A rerun keeps the apps/api/.env the first run wrote, admin included. A
  // fresh run that finds one has stopped in main already.
  if (apiEnvAction(resume, existsSync(join(ROOT, API_ENV_FILE))) === 'keep') {
    return {
      names: deriveNames(projectName, displayName),
      admin: undefined,
      generatedPassword: false,
      port,
      repo,
    };
  }

  const email = await value(
    opts.adminEmail,
    opts,
    () => ask('First admin email'),
    validateAdminEmail,
    '--admin-email',
  );
  const adminName =
    opts.adminName ?? (opts.yes ? DEFAULT_ADMIN_NAME : undefined);
  const resolvedAdminName = await value(
    adminName,
    opts,
    () => ask('First admin name', DEFAULT_ADMIN_NAME),
    validateAdminName,
    '--admin-name',
  );

  let password = opts.adminPassword;
  let generatedPassword = false;
  if (password === undefined && !opts.yes) {
    password = await askHidden('First admin password (empty generates one)');
  }
  if (!password) {
    password = randomBytes(18).toString('base64url');
    generatedPassword = true;
  }
  const passwordError = validateAdminPassword(password);
  if (passwordError) throw new StepError(passwordError);

  return {
    names: deriveNames(projectName, displayName),
    admin: { email, name: resolvedAdminName, password },
    generatedPassword,
    port,
    repo,
  };
}

function githubOrigin(): GitHubRepo | undefined {
  const origin = run('git', ['remote', 'get-url', 'origin'], { quiet: true });
  return origin.ok ? parseGitHubRemote(origin.stdout) : undefined;
}

// ----------------------------------------------------------------------------
// Plan

type FileChange = { path: string; before: string; after: string | null };

function planRename(inputs: Inputs): FileChange[] {
  const ctx = { names: inputs.names, repo: inputs.repo };
  const changes: FileChange[] = [];
  for (const path of trackedFiles()) {
    if (!existsSync(join(ROOT, path))) continue;
    const raw = readFileSync(join(ROOT, path));
    if (!isText(raw)) continue;
    const before = raw.toString('utf8');
    if ((DELETE_FILES as readonly string[]).includes(path)) {
      changes.push({ path, before, after: null });
      continue;
    }
    const after = rewriteFile(path, before, ctx);
    if (after !== before) changes.push({ path, before, after });
  }
  // The root package name marks a finished rename, so it goes last.
  changes.sort(
    (a, b) =>
      Number(a.path === 'package.json') - Number(b.path === 'package.json'),
  );
  return changes;
}

type EnvFile = { path: string; content: string; exists: boolean };

// From the examples as the rename leaves them.
function planEnvFiles(inputs: Inputs, renamed: Map<string, string>): EnvFile[] {
  const example = (path: string) => renamed.get(path) ?? read(path);
  const files: EnvFile[] = [
    {
      path: '.env',
      content: renderRootEnv(example('.env.example'), inputs.port),
      exists: existsSync(join(ROOT, '.env')),
    },
  ];
  files.push(
    inputs.admin
      ? {
          path: API_ENV_FILE,
          content: renderApiEnv(example('apps/api/.env.example'), {
            db: inputs.names.db,
            port: inputs.port,
            jwtSecret: randomBytes(48).toString('base64url'),
            admin: inputs.admin,
          }),
          exists: false,
        }
      : { path: API_ENV_FILE, content: '', exists: true },
  );
  return files;
}

function planSelfRemoval(): FileChange[] {
  const changes: FileChange[] = [];
  for (const path of SELF_REMOVAL_FILES) {
    const before = read(path);
    const after = removeInitScript(path, before);
    if (after !== before) changes.push({ path, before, after });
  }
  return changes;
}

function applyChanges(changes: FileChange[]): void {
  for (const change of changes) {
    if (change.after === null) rmSync(join(ROOT, change.path), { force: true });
    else write(change.path, change.after);
  }
}

// ----------------------------------------------------------------------------
// Steps

function preflight(opts: CliOptions): void {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 24) {
    throw new StepError(
      `Node 24 or newer is required, this is ${process.versions.node}`,
    );
  }
  if (!run('pnpm', ['--version'], { quiet: true }).ok) {
    throw new StepError('pnpm is not on the PATH');
  }
  if (!run('git', ['rev-parse', '--git-dir'], { quiet: true }).ok) {
    throw new StepError('Not a git repository');
  }
  if (opts.commit) {
    for (const key of ['user.name', 'user.email']) {
      if (!run('git', ['config', key], { quiet: true }).stdout) {
        throw new StepError(
          `git ${key} is not set, so the init commit would fail. Set it, or pass --no-commit.`,
        );
      }
    }
  }
  if (!run('docker', ['info'], { quiet: true }).ok) {
    throw new StepError(
      'Docker is not running. Start Docker Desktop (or the daemon) and run again.',
    );
  }
  if (!run('docker', ['compose', 'version'], { quiet: true }).ok) {
    throw new StepError('`docker compose` is not available');
  }
}

async function checkPort(
  port: number,
  resume: boolean,
  fix: string,
): Promise<void> {
  if (await portIsFree(port)) return;
  // On a rerun, this project's own Postgres may hold it already.
  if (resume) {
    const own = run(
      'docker',
      ['compose', 'ps', '--status', 'running', '-q', 'postgres'],
      {
        quiet: true,
      },
    );
    if (own.ok && own.stdout !== '') return;
  }
  throw new StepError(`Port ${port} is already in use on this machine. ${fix}`);
}

// The local Postgres port: the kept root .env's, --db-port, DEFAULT_DB_PORT
// with --yes, or a prompt. Checked before any other prompt.
async function resolvePort(opts: CliOptions, resume: boolean): Promise<number> {
  const rootEnv = join(ROOT, '.env');
  if (existsSync(rootEnv)) {
    const kept = parseEnv(readFileSync(rootEnv, 'utf8'))['DB_PORT'];
    const port = kept ? parsePort(kept) : DEFAULT_DB_PORT;
    if (port === undefined) {
      throw new StepError(`DB_PORT in .env is not a port number: "${kept}"`);
    }
    if (opts.dbPort !== undefined && opts.dbPort !== port) {
      console.log(`Keeping port ${port} from the existing .env.`);
    }
    await checkPort(
      port,
      resume,
      'It comes from the existing .env: change DB_PORT there, or free the port.',
    );
    return port;
  }
  if (opts.dbPort !== undefined || opts.yes) {
    const port = opts.dbPort ?? DEFAULT_DB_PORT;
    await checkPort(
      port,
      resume,
      `Pass --db-port with a free one (e.g. ${port + 1}).`,
    );
    return port;
  }
  return choosePort({
    ask,
    isFree: portIsFree,
    say: (line) => console.log(line),
  });
}

function printPlan(
  rename: FileChange[],
  env: EnvFile[],
  commands: string[],
  inputs: Inputs,
): void {
  console.log('\nDry run: nothing is changed.\n');
  console.log(
    `Name ${inputs.names.name}, scope @${inputs.names.scope}, display name "${inputs.names.displayName}"`,
  );
  console.log(
    `Databases ${inputs.names.db}, ${inputs.names.db}_test, ${inputs.names.db}_browser on port ${inputs.port}`,
  );
  console.log(
    `README repo: ${inputs.repo ? `${inputs.repo.owner}/${inputs.repo.repo}` : '(none, a placeholder)'}`,
  );
  for (const change of rename) {
    if (change.after === null) {
      console.log(`\n--- delete ${change.path}`);
      continue;
    }
    console.log(`\n--- ${change.path}`);
    for (const line of lineDiff(change.before, change.after)) console.log(line);
  }
  for (const file of env) {
    console.log(
      `\n--- ${file.exists ? 'keep (exists)' : 'create'} ${file.path}`,
    );
    if (!file.exists) {
      for (const line of file.content.split('\n')) {
        if (/^(JWT_SECRET|SEED_ADMIN_PASSWORD)=/.test(line)) {
          console.log(`  ${line.split('=')[0]}=<hidden>`);
        } else if (line && !line.startsWith('#')) {
          console.log(`  ${line}`);
        }
      }
    }
  }
  console.log('\nThen:');
  for (const command of commands) console.log(`  ${command}`);
}

async function main(): Promise<void> {
  const opts = parseCli(process.argv.slice(2), process.env);
  if (opts.help) {
    console.log(HELP);
    return;
  }

  const state = initState(read('package.json'), opts.name);
  if (state.kind === 'initialized') {
    throw new StepError(
      `This repo is already initialized as "${state.name}". To finish a run that stopped partway, pass --name ${state.name}.`,
    );
  }
  const resume = state.kind === 'resume';
  if (resume) console.log(`Resuming the init of ${opts.name}.`);

  // Before the prompts and the rename plan: planning a rename over someone's
  // own edits can fail on a line it no longer recognizes, which would hide
  // the real problem. A dry run is allowed to look at a dirty tree.
  if (
    !resume &&
    !opts.dryRun &&
    run('git', ['status', '--porcelain'], { quiet: true }).stdout !== ''
  ) {
    throw new StepError(DIRTY_TREE_MESSAGE);
  }
  // Gitignored, so the dirty-tree check never sees it. A dry run stops too:
  // the real run would.
  if (apiEnvAction(resume, existsSync(join(ROOT, API_ENV_FILE))) === 'refuse') {
    throw new StepError(API_ENV_EXISTS_MESSAGE);
  }

  // Everything that needs no answers goes before the first prompt, so a
  // missing Docker or a taken port never throws the answers away.
  if (!opts.dryRun) preflight(opts);
  const port = await resolvePort(opts, resume);

  const inputs = await collectInputs(opts, opts.name, port, resume);
  const { names } = inputs;
  const api = `@${names.scope}/api`;
  const commit = `chore: initialize ${names.name}`;
  finish = finishCommands(opts.commit ? commit : undefined);

  const rename = resume ? [] : planRename(inputs);
  const renamed = new Map(
    rename.flatMap((c) =>
      c.after === null ? [] : [[c.path, c.after] as const],
    ),
  );
  const env = planEnvFiles(inputs, renamed);

  const commands = [
    'pnpm install --no-frozen-lockfile',
    'docker compose up -d --wait --wait-timeout 120',
    `pnpm --filter ${api} db:deploy`,
    'pnpm db:seed',
    `remove ${INIT_PACKAGE_DIR}, its workspace entry, its oxlint override and the init:project script`,
    ...finish,
  ];

  if (opts.dryRun) {
    printPlan(rename, env, commands, inputs);
    return;
  }

  stage = 'changing';
  console.log(
    `\nRenaming ${TEMPLATE.rootName} to ${names.name} (${rename.length} files)`,
  );
  applyChanges(rename);

  for (const file of env) {
    if (file.exists) {
      console.log(`Keeping the existing ${file.path}`);
    } else {
      write(file.path, file.content);
      console.log(`Wrote ${file.path}`);
    }
  }

  mustRun('pnpm', ['install', '--no-frozen-lockfile']);
  mustRun('docker', ['compose', 'up', '-d', '--wait', '--wait-timeout', '120']);
  mustRun('pnpm', ['--filter', api, 'db:deploy']);
  // Through Turbo, which builds the shared package the seed compiles against.
  mustRun('pnpm', ['db:seed']);

  console.log(`\nRemoving the init script`);
  // Planned before the first edit, so a drifted file stops the run while a
  // rerun still can finish it.
  const selfRemoval = planSelfRemoval();
  stage = 'removed';
  applyChanges(selfRemoval);
  rmSync(join(ROOT, INIT_PACKAGE_DIR), { recursive: true, force: true });
  const scriptsDir = join(ROOT, INIT_PACKAGE_DIR, '..');
  if (existsSync(scriptsDir) && readdirSync(scriptsDir).length === 0) {
    rmdirSync(scriptsDir);
  }
  mustRun('pnpm', ['install', '--no-frozen-lockfile']);
  // The renames change column widths in the markdown tables, and the JSON
  // rewrites print one style; Prettier settles both.
  mustRun('pnpm', ['format']);

  if (opts.commit) {
    mustRun('git', ['add', '-A']);
    mustRun('git', ['commit', '-m', commit]);
  }

  console.log(`\n${names.displayName} is ready.`);
  for (const line of adminSummary(
    inputs.admin,
    inputs.generatedPassword,
    inputs.admin ? undefined : read(API_ENV_FILE),
  )) {
    console.log(line);
  }
  console.log('  Start it: pnpm dev');
  if (!opts.commit) console.log('  The changes are not committed.');
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\ninit:project stopped: ${message}`);
  const hint = stopHint(stage, finish);
  if (hint) console.error(hint);
  process.exitCode = 1;
}
