// End-to-end check of `pnpm init:project`, run by hand:
//
//   pnpm --filter @starter/init-project smoke [--dir <folder>] [--down]
//
// Clones this repo, with the working tree's uncommitted changes, into a temp
// folder, as a repo made from the template would be. There it runs a dry
// run, then the real init as init-smoke on port 5439 with its commit made
// to fail and finished by hand, then the full gate, and checks what is left
// of the template.
//
// The init starts its own Postgres container, init-smoke-postgres-1, with
// its own volume and port, so it never touches the dev database. It stays
// up afterwards; --down removes it and its volume. The clone is kept for a
// look around.

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { INIT_PACKAGE_DIR, isLeftAlone } from './init-project.lib.ts';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const NAME = 'init-smoke';
const PORT = 5439;
const ADMIN_PASSWORD = 'smoke-admin-password';

const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    down: { type: 'boolean', default: false },
  },
});

type Result = { ok: boolean; stdout: string; stderr: string };

// One command string through the shell, like the init script (pnpm.cmd on
// Windows). Arguments are all this file's own.
function run(
  cwd: string,
  line: string,
  opts: { quiet?: boolean; env?: Record<string, string> } = {},
): Result {
  if (!opts.quiet) console.log(`\n[smoke] $ ${line}`);
  const env: NodeJS.ProcessEnv = { ...process.env, ...opts.env };
  // The clone must behave like a developer's machine, not CI, and must not
  // inherit a DB_PORT meant for this repo.
  delete env['CI'];
  delete env['DB_PORT'];
  const result = spawnSync(line, {
    cwd,
    shell: true,
    env,
    stdio: opts.quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  };
}

function git(cwd: string, args: string): string {
  const result = run(cwd, `git ${args}`, { quiet: true });
  if (!result.ok) throw new Error(`git ${args} failed in ${cwd}`);
  return result.stdout;
}

function portIsFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const server = createServer();
    server.once('error', () => done(false));
    server.listen(port, '127.0.0.1', () => server.close(() => done(true)));
  });
}

const checks: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string): void {
  checks.push({ name, ok, detail });
  console.log(
    `[smoke] ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `\n${detail}` : ''}`,
  );
}

async function main(): Promise<void> {
  if (!(await portIsFree(PORT))) {
    throw new Error(`Port ${PORT} is taken. Is a previous ${NAME} still up?`);
  }
  if (run(ROOT, `docker compose -p ${NAME} ps -a -q`, { quiet: true }).stdout) {
    throw new Error(
      `A ${NAME} compose project exists. Remove it first: docker compose -p ${NAME} down -v`,
    );
  }

  const base = values.dir ? resolve(values.dir) : tmpdir();
  mkdirSync(base, { recursive: true });
  const repo = join(mkdtempSync(join(base, `${NAME}-`)), NAME);
  // pnpm's node_modules/.pnpm paths add over 100 characters, and oxlint's
  // tsgolint.exe fails to start past Windows' 260.
  if (process.platform === 'win32' && repo.length > 100) {
    throw new Error(
      `${repo} is too deep for Windows path limits. Pass a shorter --dir.`,
    );
  }

  // A clone of HEAD, plus the working tree's changes as one commit, so the
  // init starts from a clean tree with exactly what is here.
  console.log(`[smoke] Cloning into ${repo}`);
  git(ROOT, `clone --quiet "${ROOT}" "${repo}"`);
  const changed = git(
    ROOT,
    'ls-files -z --modified --others --exclude-standard',
  )
    .split('\0')
    .filter(Boolean);
  for (const path of changed) {
    if (!existsSync(join(ROOT, path))) continue;
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    copyFileSync(join(ROOT, path), join(repo, path));
  }
  for (const path of git(ROOT, 'ls-files -z --deleted')
    .split('\0')
    .filter(Boolean)) {
    rmSync(join(repo, path), { force: true });
  }
  git(repo, 'config user.name "Init Smoke"');
  git(repo, 'config user.email smoke@example.invalid');
  git(repo, 'add -A');
  git(repo, 'commit --quiet --allow-empty -m "smoke: working tree"');
  git(repo, `remote set-url origin https://github.com/example/${NAME}.git`);

  // No --display-name: --yes derives "Init Smoke" from the name.
  const flags = `--name ${NAME} --admin-email admin@smoke.test --admin-name "Smoke Admin" --db-port ${PORT} --yes`;
  const env = { INIT_ADMIN_PASSWORD: ADMIN_PASSWORD };

  const dry = run(repo, `pnpm init:project ${flags} --dry-run`, { env });
  check('dry run succeeds', dry.ok);
  check(
    'dry run changes nothing',
    git(repo, 'status --porcelain') === '' && !existsSync(join(repo, '.env')),
  );

  // A rename that stopped partway: one file renamed as the init would, the
  // root package name still the template's. The run refuses with the undo
  // hint.
  const compose = join(repo, 'docker-compose.yml');
  writeFileSync(
    compose,
    readFileSync(compose, 'utf8').replace('name: starter\n', `name: ${NAME}\n`),
  );
  const dirty = run(repo, `pnpm init:project ${flags}`, { env, quiet: true });
  check(
    'a half-renamed tree is refused with the git restore hint',
    !dirty.ok && /^\s+git restore \.$/m.test(dirty.stderr),
    dirty.ok ? undefined : dirty.stderr,
  );
  git(repo, 'restore .');

  // A taken port fails before the first prompt, so no answer is lost. No
  // --name and no --yes: a prompt would come first if the order were wrong.
  const blocker = createServer();
  await new Promise<void>((done) =>
    blocker.listen(PORT + 1, '127.0.0.1', () => done()),
  );
  const taken = run(repo, `pnpm init:project --db-port ${PORT + 1}`, {
    env,
    quiet: true,
  });
  await new Promise<void>((done) => blocker.close(() => done()));
  check(
    'a taken --db-port fails before any prompt',
    !taken.ok &&
      taken.stderr.includes(`Port ${PORT + 1} is already in use`) &&
      !taken.stdout.includes('Project name'),
    `${taken.stdout}\n${taken.stderr}`,
  );

  // An apps/api/.env from the README's manual steps, found by a fresh run:
  // refused before anything changes, not kept with the template's values.
  const apiEnv = join(repo, 'apps/api/.env');
  copyFileSync(join(repo, 'apps/api/.env.example'), apiEnv);
  const ownEnv = run(repo, `pnpm init:project ${flags}`, {
    env,
    quiet: true,
  });
  check(
    'a fresh run refuses an existing apps/api/.env and changes nothing',
    !ownEnv.ok &&
      ownEnv.stderr.includes('apps/api/.env exists') &&
      git(repo, 'status --porcelain') === '' &&
      !existsSync(join(repo, '.env')),
    `${ownEnv.stdout}\n${ownEnv.stderr}`,
  );
  rmSync(apiEnv);

  // A failure after the self-removal: a pre-commit hook fails the commit.
  // The script is gone by then, so the hint gives the steps left by hand
  // instead of a rerun, and those steps finish the init.
  const hook = join(repo, '.git/hooks/pre-commit');
  writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const init = run(repo, `pnpm init:project ${flags}`, { env, quiet: true });
  rmSync(hook);
  console.log(init.stdout);
  console.error(init.stderr);
  const lines = init.stderr.split('\n');
  const from = lines.findIndex((line) => line.includes('finish by hand:'));
  const left: string[] = [];
  for (const line of from === -1 ? [] : lines.slice(from + 1)) {
    if (!line.startsWith('  ')) break;
    left.push(line.trim());
  }
  check(
    'a failed commit after the self-removal gives the steps left',
    !init.ok &&
      !/run it again/.test(init.stderr) &&
      !existsSync(join(repo, INIT_PACKAGE_DIR)) &&
      left.at(-1) === `git commit -m "chore: initialize ${NAME}"`,
    left.join('\n'),
  );
  const finished = left.length > 0 && left.every((line) => run(repo, line).ok);
  check('the steps left finish the init', finished);
  if (!finished) return;

  check('tree is clean after init', git(repo, 'status --porcelain') === '');
  check(
    'init commit',
    git(repo, 'log -1 --format=%s') === `chore: initialize ${NAME}`,
  );
  const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  check(
    'init script removed',
    !existsSync(join(repo, 'scripts')) &&
      pkg.scripts['init:project'] === undefined &&
      !readFileSync(join(repo, 'pnpm-workspace.yaml'), 'utf8').includes(
        'scripts/',
      ),
  );
  check(
    'LICENSE, the README images, author and license gone',
    !existsSync(join(repo, 'LICENSE')) &&
      !existsSync(join(repo, 'docs/images')) &&
      !('author' in pkg) &&
      !('license' in pkg),
  );
  check(
    'env files written',
    readFileSync(join(repo, '.env'), 'utf8').includes(`DB_PORT=${PORT}`) &&
      readFileSync(join(repo, 'apps/api/.env'), 'utf8').includes(
        `localhost:${PORT}/init_smoke"`,
      ),
  );
  check(
    'a second run is refused',
    !run(repo, `pnpm init:project ${flags}`, { env, quiet: true }).ok,
  );

  const leftovers = git(repo, 'ls-files -z')
    .split('\0')
    .filter((path) => path && !isLeftAlone(path))
    .flatMap((path) =>
      readFileSync(join(repo, path), 'utf8')
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => /starter/i.test(line))
        .map(({ line, i }) => `  ${path}:${i + 1}: ${line.trim()}`),
    );
  check(
    'no "starter" outside the allowlist',
    leftovers.length === 0,
    leftovers.join('\n'),
  );

  const lockDiff = git(repo, 'diff HEAD~1 HEAD -- pnpm-lock.yaml');
  console.log(`[smoke] pnpm-lock.yaml diff:\n${lockDiff}`);
  // The init package's importer, as the lockfile had it before the init.
  const lockBefore = git(repo, 'show HEAD~1:pnpm-lock.yaml').split('\n');
  const start = lockBefore.indexOf('  scripts/init-project:');
  const end = lockBefore.findIndex(
    (line, i) => i > start && /^ {0,2}\S/.test(line),
  );
  // Expected: the same lines minus that importer, with the shared link
  // renamed. pnpm sorts each importer's keys, so the renamed link and its
  // specifier and version lines may move: compare the lines as a multiset.
  const expected = [...lockBefore.slice(0, start), ...lockBefore.slice(end)]
    .map((line) => line.replace(`'@starter/shared':`, `'@${NAME}/shared':`))
    .sort();
  // trim: git() trims the old one.
  const actual = readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf8')
    .trim()
    .split('\n')
    .sort();
  check(
    'lockfile changes only the workspace links and drops the init package',
    start !== -1 &&
      end > start &&
      JSON.stringify(expected) === JSON.stringify(actual),
  );

  for (const task of [
    'format:check',
    'lint',
    'typecheck',
    'test',
    'test:e2e',
    'test:browser',
  ]) {
    check(`pnpm ${task}`, run(repo, `pnpm ${task}`).ok);
  }

  console.log(`\n[smoke] Clone kept at ${repo}`);
}

try {
  await main();
} catch (error) {
  check(
    'smoke run',
    false,
    error instanceof Error ? error.message : String(error),
  );
} finally {
  if (values.down) {
    run(ROOT, `docker compose -p ${NAME} down -v`);
  } else {
    console.log(
      `[smoke] The ${NAME} container is still up. Remove it with: docker compose -p ${NAME} down -v`,
    );
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n[smoke] ${checks.length - failed.length}/${checks.length} checks passed${failed.length ? `. Failed: ${failed.map((c) => c.name).join(', ')}` : ''}`,
  );
  process.exitCode = failed.length ? 1 : 0;
}
