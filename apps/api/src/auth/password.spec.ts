import {
  DEFAULT_ARGON2_PARAMS,
  hashPassword,
  verifyPassword,
} from './password.js';
import { PasswordService } from './password.service.js';

// Cheap parameters keep the suite fast where cost is not what is tested.
const FAST = { memory: 64, passes: 1, parallelism: 1 };

describe('hashPassword', () => {
  it('writes an argon2id PHC string with the default parameters', async () => {
    const hash = await hashPassword('correct horse');
    const { memory, passes, parallelism } = DEFAULT_ARGON2_PARAMS;

    expect(hash).toMatch(
      new RegExp(
        `^\\$argon2id\\$v=19\\$m=${memory},t=${passes},p=${parallelism}\\$[A-Za-z0-9+/]{22}\\$[A-Za-z0-9+/]{43}$`,
      ),
    );
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same', FAST)).not.toBe(
      await hashPassword('same', FAST),
    );
  });
});

describe('verifyPassword', () => {
  it('accepts the right password', async () => {
    const hash = await hashPassword('correct horse', FAST);
    expect(await verifyPassword(hash, 'correct horse')).toBe(true);
  });

  it.each(['wrong', 'Correct horse', 'correct horse ', ''])(
    'rejects %j',
    async (attempt) => {
      const hash = await hashPassword('correct horse', FAST);
      expect(await verifyPassword(hash, attempt)).toBe(false);
    },
  );

  // Parameters are read from each stored hash, so they can be raised later
  // and existing hashes keep verifying.
  it('verifies hashes made with other parameters', async () => {
    const params = [
      { memory: 128, passes: 3, parallelism: 2 },
      { memory: 256, passes: 1, parallelism: 4 },
      DEFAULT_ARGON2_PARAMS,
    ];
    for (const p of params) {
      const hash = await hashPassword('correct horse', p);
      expect(hash).toContain(`m=${p.memory},t=${p.passes},p=${p.parallelism}`);
      expect(await verifyPassword(hash, 'correct horse')).toBe(true);
      expect(await verifyPassword(hash, 'wrong')).toBe(false);
    }
  });

  it('rejects a hash whose parameters were tampered with', async () => {
    const hash = await hashPassword('correct horse', FAST);
    expect(
      await verifyPassword(hash.replace('t=1', 't=2'), 'correct horse'),
    ).toBe(false);
  });

  it.each([
    ['an empty string', ''],
    ['plain text', 'correct horse'],
    ['argon2i', '$argon2i$v=19$m=64,t=1,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNo'],
    [
      'another version',
      '$argon2id$v=16$m=64,t=1,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2g',
    ],
    [
      'parameters argon2 refuses',
      '$argon2id$v=19$m=1,t=1,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNo',
    ],
  ])('returns false for %s without throwing', async (_, stored) => {
    expect(await verifyPassword(stored, 'correct horse')).toBe(false);
  });
});

describe('PasswordService', () => {
  it('hashes and verifies', async () => {
    const service = new PasswordService();
    const hash = await service.hash('correct horse');

    expect(await service.verify(hash, 'correct horse')).toBe(true);
    expect(await service.verify(hash, 'wrong')).toBe(false);
  });

  it('verifies against a dummy hash, with or without onModuleInit', async () => {
    const service = new PasswordService();
    await expect(service.verifyDummy('anything')).resolves.toBeUndefined();
    await service.onModuleInit();
    await expect(service.verifyDummy('anything')).resolves.toBeUndefined();
  });
});
