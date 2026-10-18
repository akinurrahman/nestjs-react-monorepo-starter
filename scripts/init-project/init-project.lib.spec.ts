import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  adminSummary,
  API_ENV_EXISTS_MESSAGE,
  apiEnvAction,
  choosePort,
  deriveNames,
  DIRTY_TREE_MESSAGE,
  displayNameGiven,
  finishCommands,
  firstFreePort,
  initState,
  isLeftAlone,
  lineDiff,
  NAME_MAX_LENGTH,
  parseCli,
  parseGitHubRemote,
  parsePort,
  quoteEnvValue,
  removeInitScript,
  removeTemplateBlocks,
  renderApiEnv,
  renderRootEnv,
  replaceOnce,
  rewriteFile,
  shouldRewrite,
  stopHint,
  TEMPLATE,
  toDisplayName,
  validateAdminEmail,
  validateAdminName,
  validateAdminPassword,
  validateDisplayName,
  validateName,
  type RewriteContext,
} from './init-project.lib.ts';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const ctx: RewriteContext = {
  names: deriveNames('acme-crm', 'Acme CRM'),
  repo: { owner: 'acme', repo: 'crm' },
};

describe('validateName', () => {
  it.each(['acme', 'acme-crm', 'a1-b2', 'x'])('accepts %j', (name) => {
    expect(validateName(name)).toBeUndefined();
  });

  it.each([
    'Acme',
    'acme_crm',
    'acme--crm',
    '-acme',
    'acme-',
    '1acme',
    'acme crm',
    '',
  ])('refuses %j as not kebab case', (name) => {
    expect(validateName(name)).toMatch(/not kebab case/);
  });

  it('refuses a name too long for <db>_browser', () => {
    // 55 + "_browser" is Postgres's 63.
    expect(NAME_MAX_LENGTH + '_browser'.length).toBe(63);
    expect(validateName('a'.repeat(55))).toBeUndefined();
    expect(validateName('a'.repeat(56))).toMatch(/longer/);
  });

  it.each(['starter', 'postgres', 'template0', 'template1'])(
    'refuses the reserved %j',
    (name) => {
      expect(validateName(name)).toMatch(/reserved/);
    },
  );

  // x-test gives the dev database x_test, which the e2e reset guard takes
  // for a test database; x-browser likewise for the browser tests.
  it.each(['x-test', 'x-browser', 'acme-crm-test'])(
    'refuses %j, whose dev database passes a test database guard',
    (name) => {
      expect(validateName(name)).toMatch(/-test or -browser/);
    },
  );

  it.each(['test', 'browser', 'x-testing', 'test-x', 'x-browsers'])(
    'accepts %j',
    (name) => {
      expect(validateName(name)).toBeUndefined();
    },
  );
});

describe('deriveNames', () => {
  it('derives the scope, the database and the display name', () => {
    expect(deriveNames('acme-crm')).toEqual({
      name: 'acme-crm',
      scope: 'acme-crm',
      db: 'acme_crm',
      displayName: 'Acme Crm',
    });
  });

  it('takes a display name instead of deriving one', () => {
    expect(deriveNames('acme-crm', 'Acme CRM').displayName).toBe('Acme CRM');
  });

  it('title-cases every word', () => {
    expect(toDisplayName('my-big-app2')).toBe('My Big App2');
  });
});

describe('validateDisplayName', () => {
  it.each(['Acme CRM', "Bob's & Co <Beta>", 'Ünïcode'])('accepts %j', (n) => {
    expect(validateDisplayName(n)).toBeUndefined();
  });

  it.each(['', ' Acme', 'Acme ', 'a\nb', 'x'.repeat(61)])('refuses %j', (n) => {
    expect(validateDisplayName(n)).toBeDefined();
  });
});

describe('admin validation', () => {
  it('checks the email', () => {
    expect(validateAdminEmail('ada@example.com')).toBeUndefined();
    expect(validateAdminEmail('nope')).toMatch(/not a valid email/);
    expect(validateAdminEmail('a b@example.com')).toMatch(/not a valid email/);
    expect(
      validateAdminEmail(`${'a'.repeat(242)}@example.com`),
    ).toBeUndefined();
    expect(validateAdminEmail(`${'a'.repeat(243)}@example.com`)).toMatch(
      /not a valid email/,
    );
  });

  it('checks the name', () => {
    expect(validateAdminName('Ada')).toBeUndefined();
    expect(validateAdminName('   ')).toMatch(/1 to 100/);
    expect(validateAdminName('x'.repeat(101))).toMatch(/1 to 100/);
  });

  it('checks the password length and that it fits in an env file', () => {
    expect(validateAdminPassword('x'.repeat(8))).toBeUndefined();
    expect(validateAdminPassword('x'.repeat(7))).toMatch(/8 to 256/);
    expect(validateAdminPassword('x'.repeat(257))).toMatch(/8 to 256/);
    expect(validateAdminPassword(`ab'cd"efgh`)).toMatch(/both/);
  });
});

describe('quoteEnvValue', () => {
  it.each([
    'plain',
    'with space',
    'hash # inside',
    '$dollar ${X}',
    "single'quote",
    'double"quote',
    'back\\slash',
  ])('round-trips %j through parseEnv', (value) => {
    expect(parseEnv(`KEY=${quoteEnvValue(value)}`)['KEY']).toBe(value);
  });

  it('refuses a line break', () => {
    expect(() => quoteEnvValue('a\nb')).toThrow(/line break/);
  });
});

describe('renderApiEnv', () => {
  const example = readFileSync(join(ROOT, 'apps/api/.env.example'), 'utf8');
  const admin = {
    email: 'ada@example.com',
    name: "Ada O'Neil",
    password: 'p@ss #word',
  };

  it('fills in the database, secret and admin from the real example', () => {
    const env = parseEnv(
      renderApiEnv(rewriteFile('apps/api/.env.example', example, ctx), {
        db: 'acme_crm',
        port: 5439,
        jwtSecret: 'secret-'.repeat(8),
        admin,
      }),
    );
    expect(env).toMatchObject({
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5439/acme_crm',
      JWT_SECRET: 'secret-'.repeat(8),
      SEED_ADMIN_EMAIL: admin.email,
      SEED_ADMIN_NAME: admin.name,
      SEED_ADMIN_PASSWORD: admin.password,
      NODE_ENV: 'development',
    });
  });

  it('fails loudly when the example lost a line it fills in', () => {
    expect(() =>
      renderApiEnv(example.replace(/^JWT_SECRET=.*$/m, ''), {
        db: 'x',
        port: 1,
        jwtSecret: 'x',
        admin,
      }),
    ).toThrow(/No JWT_SECRET line/);
  });
});

describe('renderRootEnv', () => {
  it('sets DB_PORT in the real example', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
    expect(parseEnv(renderRootEnv(example, 5439))['DB_PORT']).toBe('5439');
  });
});

describe('initState', () => {
  const pkg = (name: string) => JSON.stringify({ name });

  it('is fresh while the root package has the template name', () => {
    expect(initState(pkg(TEMPLATE.rootName), 'acme')).toEqual({
      kind: 'fresh',
    });
    expect(initState(pkg(TEMPLATE.rootName), undefined)).toEqual({
      kind: 'fresh',
    });
  });

  it('knows the template by its root package name', () => {
    expect(initState(pkg('nestjs-react-monorepo-starter'), 'acme')).toEqual({
      kind: 'fresh',
    });
    expect(
      initState(readFileSync(join(ROOT, 'package.json'), 'utf8'), 'acme'),
    ).toEqual({ kind: 'fresh' });
  });

  it('resumes when the name matches', () => {
    expect(initState(pkg('acme'), 'acme')).toEqual({ kind: 'resume' });
  });

  it('refuses any other name, or none given', () => {
    expect(initState(pkg('acme'), 'other')).toEqual({
      kind: 'initialized',
      name: 'acme',
    });
    expect(initState(pkg('acme'), undefined)).toEqual({
      kind: 'initialized',
      name: 'acme',
    });
  });
});

describe('DIRTY_TREE_MESSAGE', () => {
  it('tells how to undo a rename that stopped partway', () => {
    expect(DIRTY_TREE_MESSAGE).toMatch(/^\s+git restore \.$/m);
    expect(DIRTY_TREE_MESSAGE).toMatch(/commit or stash/i);
  });
});

describe('apiEnvAction', () => {
  it('writes apps/api/.env when there is none', () => {
    expect(apiEnvAction(false, false)).toBe('write');
    expect(apiEnvAction(true, false)).toBe('write');
  });

  it('keeps the one an earlier run wrote', () => {
    expect(apiEnvAction(true, true)).toBe('keep');
  });

  it('refuses one that a fresh run finds', () => {
    expect(apiEnvAction(false, true)).toBe('refuse');
  });

  it('says what to do about it', () => {
    expect(API_ENV_EXISTS_MESSAGE).toContain('apps/api/.env');
    expect(API_ENV_EXISTS_MESSAGE).toMatch(/not initialized/);
    expect(API_ENV_EXISTS_MESSAGE).toMatch(/delete it, then run again/);
  });
});

describe('displayNameGiven', () => {
  it('takes the flag first', () => {
    expect(displayNameGiven({ displayName: 'X', yes: true }, true, 'D')).toBe(
      'X',
    );
  });

  it('defaults from the name with --yes and on a resume', () => {
    expect(displayNameGiven({ yes: true }, false, 'Acme Crm')).toBe('Acme Crm');
    expect(displayNameGiven({ yes: false }, true, 'Acme Crm')).toBe('Acme Crm');
  });

  it('leaves a fresh interactive run to the prompt', () => {
    expect(displayNameGiven({ yes: false }, false, 'Acme Crm')).toBeUndefined();
  });
});

describe('stopHint', () => {
  const finish = [
    'pnpm install --no-frozen-lockfile',
    'pnpm format',
    'git add -A',
    'git commit -m "chore: initialize acme"',
  ];

  it('lists the steps left after the self-removal', () => {
    expect(finishCommands('chore: initialize acme')).toEqual([
      'pnpm install --no-frozen-lockfile',
      'pnpm format',
      'git add -A',
      'git commit -m "chore: initialize acme"',
    ]);
    expect(finishCommands(undefined)).toEqual([
      'pnpm install --no-frozen-lockfile',
      'pnpm format',
    ]);
  });

  it('says nothing before the first change', () => {
    expect(stopHint('none', finish)).toBeUndefined();
  });

  it('says to run again while the script is still there', () => {
    expect(stopHint('changing', finish)).toMatch(/run it again/);
  });

  it('gives the steps left once the script removed itself', () => {
    const hint = stopHint('removed', finish)!;
    expect(hint).not.toMatch(/run it again/);
    expect(hint).toMatch(/removed itself/);
    expect(hint.split('\n').slice(1)).toEqual(finish.map((c) => `  ${c}`));
  });
});

describe('adminSummary', () => {
  const admin = { email: 'ada@example.com', name: 'Ada', password: 'pw123456' };

  it('shows a generated password once', () => {
    expect(adminSummary(admin, true, undefined)).toEqual([
      '  Admin: ada@example.com',
      '  Generated admin password (shown once, also in apps/api/.env): pw123456',
    ]);
  });

  it('never shows a typed password', () => {
    expect(adminSummary(admin, false, undefined)).toEqual([
      '  Admin: ada@example.com',
    ]);
  });

  it('points a resumed run at the kept apps/api/.env', () => {
    expect(
      adminSummary(
        undefined,
        false,
        "SEED_ADMIN_EMAIL='ada@example.com'\nSEED_ADMIN_PASSWORD='pw123456'\n",
      ),
    ).toEqual([
      '  Admin: ada@example.com',
      '  Admin password: SEED_ADMIN_PASSWORD in apps/api/.env',
    ]);
    expect(adminSummary(undefined, false, '')).toEqual([
      '  Admin: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in apps/api/.env',
    ]);
  });
});

describe('parseGitHubRemote', () => {
  it.each([
    'https://github.com/acme/crm.git',
    'https://github.com/acme/crm',
    'https://token@github.com/acme/crm.git',
    'git@github.com:acme/crm.git',
    'ssh://git@github.com/acme/crm.git',
  ])('parses %j', (url) => {
    expect(parseGitHubRemote(url)).toEqual({ owner: 'acme', repo: 'crm' });
  });

  it.each([
    'https://gitlab.com/acme/crm.git',
    'D:/work/crm',
    '/tmp/crm',
    'https://github.com/acme',
  ])('returns undefined for %j', (url) => {
    expect(parseGitHubRemote(url)).toBeUndefined();
  });
});

describe('replaceOnce', () => {
  it('replaces a single match', () => {
    expect(replaceOnce('a X b', 'X', 'Y')).toBe('a Y b');
  });

  it('keeps an already replaced source', () => {
    expect(replaceOnce('a Y b', 'X', 'Y')).toBe('a Y b');
  });

  it('throws on neither, or on several matches', () => {
    expect(() => replaceOnce('a b', 'X', 'Y')).toThrow(/Expected to find/);
    expect(() => replaceOnce('X X', 'X', 'Y')).toThrow(/found it 2 times/);
  });

  it('does not expand $ patterns in the replacement', () => {
    expect(replaceOnce('X', 'X', "$& $'")).toBe("$& $'");
  });
});

describe('removeTemplateBlocks', () => {
  it('drops every block and the blank lines after it', () => {
    const source = [
      'keep 1',
      '<!-- template:start -->',
      'drop',
      '<!-- template:end -->',
      '',
      'keep 2',
      '<!-- template:start -->drop<!-- template:end -->',
      'keep 3',
      '',
    ].join('\n');
    expect(removeTemplateBlocks(source)).toBe('keep 1\nkeep 2\nkeep 3\n');
  });
});

describe('rewriteFile', () => {
  it('renames scopes and test databases in any file', () => {
    expect(
      rewriteFile(
        'some/file.ts',
        "import { x } from '@starter/shared';\n// starter_test, starter_browser, starters\n",
        ctx,
      ),
    ).toBe(
      "import { x } from '@acme-crm/shared';\n// acme_crm_test, acme_crm_browser, starters\n",
    );
  });

  it('leaves the allowlisted files, the lockfile and the init script alone', () => {
    const source = "'@starter/shared' starter_test";
    for (const path of [
      'apps/api/test/test-db.spec.ts',
      '.claude/skills/prisma-cli/references/init.md',
      'pnpm-lock.yaml',
      'scripts/init-project/package.json',
    ]) {
      expect(rewriteFile(path, source, ctx)).toBe(source);
    }
    expect(isLeftAlone('.claude/skills/prisma-cli-other.md')).toBe(false);
  });

  it('names the root package and drops author and license', () => {
    const out = JSON.parse(
      rewriteFile(
        'package.json',
        JSON.stringify({
          name: 'nestjs-react-monorepo-starter',
          author: 'X',
          license: 'MIT',
        }),
        ctx,
      ),
    );
    expect(out).toEqual({ name: 'acme-crm' });
  });

  it('keeps a nested package name but renames its scope', () => {
    const out = JSON.parse(
      rewriteFile(
        'apps/api/package.json',
        JSON.stringify({ name: '@starter/api', author: 'X' }),
        ctx,
      ),
    );
    expect(out).toEqual({ name: '@acme-crm/api' });
  });

  it('escapes the display name for TypeScript and HTML', () => {
    const names = deriveNames('bob', "Bob's <Co> & \\");
    const tricky = { names, repo: undefined };
    expect(
      rewriteFile(
        'apps/web/src/app/config.ts',
        "export const APP_NAME = 'Starter';\n",
        tricky,
      ),
    ).toBe("export const APP_NAME = 'Bob\\'s <Co> & \\\\';\n");
    expect(
      rewriteFile('apps/web/index.html', '<title>Starter</title>', tricky),
    ).toBe("<title>Bob's &lt;Co&gt; &amp; \\</title>");
  });

  it('uses a placeholder repo url without a GitHub remote', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const out = rewriteFile('README.md', readme, {
      names: ctx.names,
      repo: undefined,
    });
    expect(out).toContain('git clone https://github.com/<owner>/<repo>.git');
    expect(out).toContain('cd acme-crm\n');
  });

  // Every tracked file, as the script sees it. Catches a template change
  // the script does not know about.
  describe('on the real repo', () => {
    const files = execFileSync('git', ['ls-files', '-z'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\0')
      .filter((path) => path && existsSync(join(ROOT, path)))
      .filter((path) => !['LICENSE', '.git-blame-ignore-revs'].includes(path))
      .map((path) => ({ path, raw: readFileSync(join(ROOT, path)) }))
      .filter(({ raw }) => !raw.subarray(0, 8000).includes(0))
      .map(({ path, raw }) => ({ path, source: raw.toString('utf8') }));

    const rewritten = files.map(({ path, source }) => ({
      path,
      source,
      out: rewriteFile(path, source, ctx),
    }));

    it('leaves no "starter" outside the allowlist, the lockfile and the init script', () => {
      const leftovers = rewritten
        .filter(({ path }) => shouldRewrite(path))
        .flatMap(({ path, out }) =>
          out
            .split('\n')
            .map((line, i) => ({ line, i }))
            .filter(({ line }) => /starter/i.test(line))
            .map(({ line, i }) => `${path}:${i + 1}: ${line.trim()}`),
        );
      expect(leftovers).toEqual([]);
    });

    it('is idempotent', () => {
      for (const { path, out } of rewritten) {
        expect(rewriteFile(path, out, ctx), path).toBe(out);
      }
    });

    it('writes the project names where they belong', () => {
      const out = (path: string) =>
        rewritten.find((file) => file.path === path)!.out;
      expect(out('docker-compose.yml')).toMatch(/^name: acme-crm$/m);
      expect(out('docker-compose.yml')).toContain('POSTGRES_DB: acme_crm\n');
      expect(out('docker-compose.yml')).toContain("-d acme_crm']");
      expect(out('apps/api/.env.test')).toContain('5432/acme_crm_test"');
      expect(out('apps/browser-tests/browser-env.ts')).toContain(
        '5432/acme_crm_browser',
      );
      expect(out('apps/web/src/app/config.ts')).toContain(
        "APP_NAME = 'Acme CRM';",
      );
      expect(out('apps/web/index.html')).toContain('<title>Acme CRM</title>');
      expect(out('apps/api/src/config/swagger.config.ts')).toContain(
        ".setTitle('Acme CRM API')",
      );
      expect(out('README.md')).toMatch(/^# Acme CRM\n\n## What's inside/);
      expect(out('README.md')).toContain(
        'git clone https://github.com/acme/crm.git\ncd crm\n',
      );
      expect(out('README.md')).not.toContain('template:');
      expect(out('README.md')).not.toContain('LICENSE');
      expect(out('CLAUDE.md')).toContain(
        'Acme CRM: a monorepo with a NestJS API',
      );
      expect(out('CLAUDE.md')).not.toContain('template:');
      expect(JSON.parse(out('package.json'))).not.toHaveProperty('author');
      expect(JSON.parse(out('package.json'))).not.toHaveProperty('license');
    });
  });
});

describe('removeInitScript', () => {
  const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

  it('drops the init:project script', () => {
    const out = JSON.parse(
      removeInitScript('package.json', read('package.json')),
    );
    expect(out.scripts).not.toHaveProperty('init:project');
    expect(out.scripts).toHaveProperty('format');
  });

  it('drops the workspace entry', () => {
    const out = removeInitScript(
      'pnpm-workspace.yaml',
      read('pnpm-workspace.yaml'),
    );
    expect(out).not.toContain('scripts/init-project');
    expect(out).toContain('  - packages/*\n');
  });

  it('drops the oxlint override and keeps the rest', () => {
    const before = JSON.parse(read('.oxlintrc.json'));
    const out = JSON.parse(
      removeInitScript('.oxlintrc.json', read('.oxlintrc.json')),
    );
    expect(JSON.stringify(out)).not.toContain('scripts/init-project');
    expect(out.overrides).toHaveLength(before.overrides.length - 1);
  });

  it('is a no-op the second time and on other files', () => {
    for (const path of [
      'package.json',
      'pnpm-workspace.yaml',
      '.oxlintrc.json',
    ]) {
      const once = removeInitScript(path, read(path));
      expect(removeInitScript(path, once)).toBe(once);
    }
    expect(removeInitScript('README.md', 'x')).toBe('x');
  });
});

describe('lineDiff', () => {
  it('lists only the changed lines', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc\nd')).toEqual([
      '-   2 b',
      '+   2 B',
      '+   4 d',
    ]);
  });

  it('is empty for equal text', () => {
    expect(lineDiff('a\nb', 'a\nb')).toEqual([]);
  });
});

describe('parsePort', () => {
  it.each([
    ['1', 1],
    ['5432', 5432],
    ['65535', 65535],
  ])('reads %j', (text, port) => {
    expect(parsePort(text)).toBe(port);
  });

  it.each(['0', '65536', '123456', 'abc', '54.3', '', ' 5432', '-1'])(
    'refuses %j',
    (text) => {
      expect(parsePort(text)).toBeUndefined();
    },
  );
});

// isFree for a machine where `taken` are in use, recording every port asked.
function machine(taken: number[]) {
  const asked: number[] = [];
  return {
    asked,
    isFree: async (port: number) => {
      asked.push(port);
      return !taken.includes(port);
    },
  };
}

describe('firstFreePort', () => {
  it('returns the start when it is free', async () => {
    expect(await firstFreePort(5432, machine([]).isFree)).toBe(5432);
  });

  it('skips taken ports', async () => {
    expect(await firstFreePort(5432, machine([5432, 5433]).isFree)).toBe(5434);
  });

  it('gives up after the limit', async () => {
    const m = machine(Array.from({ length: 30 }, (_, i) => 5432 + i));
    expect(await firstFreePort(5432, m.isFree, 20)).toBeUndefined();
    expect(m.asked).toEqual(Array.from({ length: 20 }, (_, i) => 5432 + i));
  });

  it('never goes past 65535', async () => {
    const m = machine([65534, 65535]);
    expect(await firstFreePort(65534, m.isFree, 20)).toBeUndefined();
    expect(m.asked).toEqual([65534, 65535]);
  });
});

describe('choosePort', () => {
  // Answers in order; an empty answer takes the default, like the real
  // prompt.
  function prompt(taken: number[], answers: string[]) {
    const m = machine(taken);
    const questions: { question: string; fallback?: string }[] = [];
    const said: string[] = [];
    const io = {
      ask: async (question: string, fallback?: string) => {
        questions.push({ question, fallback });
        const answer = answers.shift();
        if (answer === undefined) throw new Error('asked too often');
        return answer === '' && fallback !== undefined ? fallback : answer;
      },
      isFree: m.isFree,
      say: (line: string) => said.push(line),
    };
    return { io, questions, said, asked: m.asked };
  }

  it('suggests 5432 when it is free', async () => {
    const p = prompt([], ['']);
    expect(await choosePort(p.io)).toBe(5432);
    expect(p.questions).toEqual([
      { question: 'Local Postgres port', fallback: '5432' },
    ]);
  });

  it('suggests the next free port when 5432 is taken, and says so', async () => {
    const p = prompt([5432, 5433], ['']);
    expect(await choosePort(p.io)).toBe(5434);
    expect(p.questions[0]!.fallback).toBe('5434');
    expect(p.questions[0]!.question).toMatch(/5432 is taken/);
    expect(p.questions[0]!.question).toMatch(/5434 is free/);
  });

  it('has no default when no port nearby is free', async () => {
    const taken = Array.from({ length: 20 }, (_, i) => 5432 + i);
    const p = prompt(taken, ['6000']);
    expect(await choosePort(p.io)).toBe(6000);
    expect(p.questions[0]!.fallback).toBeUndefined();
    expect(p.questions[0]!.question).toMatch(/5432 to 5451 are all taken/);
  });

  it('takes a typed port over the default', async () => {
    const p = prompt([], ['5500']);
    expect(await choosePort(p.io)).toBe(5500);
  });

  it('asks again right after an answer that is not a port', async () => {
    const p = prompt([], ['abc', '5433']);
    expect(await choosePort(p.io)).toBe(5433);
    expect(p.questions).toHaveLength(2);
    expect(p.said).toEqual([expect.stringMatching(/"abc" is not a port/)]);
  });

  it('asks again right after a port that is in use', async () => {
    const p = prompt([5500], ['5500', '5501']);
    expect(await choosePort(p.io)).toBe(5501);
    expect(p.questions).toHaveLength(2);
    expect(p.said).toEqual([
      expect.stringMatching(/Port 5500 is already in use/),
    ]);
    expect(p.asked).toContain(5500);
  });
});

describe('parseCli', () => {
  it('reads every flag', () => {
    expect(
      parseCli(
        [
          '--name=acme',
          '--display-name',
          'Acme',
          '--admin-email=a@b.co',
          '--admin-name=Ada',
          '--admin-password=secret123',
          '--db-port=5439',
          '--repo=acme/crm',
          '--no-commit',
          '--dry-run',
          '--yes',
        ],
        {},
      ),
    ).toEqual({
      name: 'acme',
      displayName: 'Acme',
      adminEmail: 'a@b.co',
      adminName: 'Ada',
      adminPassword: 'secret123',
      dbPort: 5439,
      repo: { owner: 'acme', repo: 'crm' },
      commit: false,
      dryRun: true,
      yes: true,
      help: false,
    });
  });

  it('defaults to port 5432 and a commit', () => {
    expect(parseCli([], {})).toMatchObject({ commit: true });
    // Not passed is undefined, not 5432: the script prompts for it.
    expect(parseCli([], {}).dbPort).toBeUndefined();
  });

  it('takes the password from INIT_ADMIN_PASSWORD, the flag first', () => {
    expect(
      parseCli([], { INIT_ADMIN_PASSWORD: 'fromenv1' }).adminPassword,
    ).toBe('fromenv1');
    expect(
      parseCli(['--admin-password=flag1234'], {
        INIT_ADMIN_PASSWORD: 'fromenv1',
      }).adminPassword,
    ).toBe('flag1234');
    expect(
      parseCli([], { INIT_ADMIN_PASSWORD: '' }).adminPassword,
    ).toBeUndefined();
  });

  it.each(['0', '65536', 'abc', '54.3'])('refuses --db-port=%s', (port) => {
    expect(() => parseCli([`--db-port=${port}`], {})).toThrow(/port number/);
  });

  it('refuses a malformed --repo and an unknown flag', () => {
    expect(() => parseCli(['--repo=acme'], {})).toThrow(/owner\/name/);
    expect(() => parseCli(['--nmae=acme'], {})).toThrow();
  });
});
