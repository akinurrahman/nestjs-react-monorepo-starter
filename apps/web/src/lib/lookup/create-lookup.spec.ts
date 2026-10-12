import { createLookup, type LookupEntry } from './create-lookup';

const statusLookup = createLookup(
  {
    active: { label: 'Active', badgeVariant: 'success' },
    archived: { label: 'Archived', badgeVariant: 'secondary' },
    draft: { label: 'Draft' },
  },
  'Status',
);

describe('createLookup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('lists values in config order', () => {
    expect(statusLookup.values).toEqual(['active', 'archived', 'draft']);
  });

  it('maps every key to itself', () => {
    expect(statusLookup.keys).toEqual({
      active: 'active',
      archived: 'archived',
      draft: 'draft',
    });
  });

  it('builds options from labels', () => {
    expect(statusLookup.options).toEqual([
      { value: 'active', label: 'Active' },
      { value: 'archived', label: 'Archived' },
      { value: 'draft', label: 'Draft' },
    ]);
  });

  describe('resolve', () => {
    it('returns the entry for a known value', () => {
      expect(statusLookup.resolve('active')).toEqual({
        label: 'Active',
        badgeVariant: 'success',
      });
    });

    it('leaves badgeVariant unset when the config omits it', () => {
      expect(statusLookup.resolve('draft')?.badgeVariant).toBeUndefined();
    });

    it.each([null, undefined, ''])(
      'returns null for %o without warning',
      (value) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(statusLookup.resolve(value)).toBeNull();
        expect(warn).not.toHaveBeenCalled();
      },
    );

    it('does not resolve inherited object keys', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(statusLookup.resolve('toString')).toBeNull();
    });

    it('warns in dev for an unknown value', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(statusLookup.resolve('deleted')).toBeNull();
      expect(warn).toHaveBeenCalledWith(
        '[lookup:Status] Unknown value "deleted". Expected one of: active, archived, draft',
      );
    });

    it('stays quiet outside dev', () => {
      vi.stubEnv('DEV', false);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(statusLookup.resolve('deleted')).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('toZodEnum', () => {
    it('accepts every value', () => {
      const schema = statusLookup.toZodEnum();

      for (const value of statusLookup.values) {
        expect(schema.parse(value)).toBe(value);
      }
    });

    it('rejects anything else', () => {
      expect(statusLookup.toZodEnum().safeParse('deleted').success).toBe(false);
    });

    it('uses the given message', () => {
      const result = statusLookup.toZodEnum('Pick a status').safeParse('');

      expect(result.error?.issues[0]?.message).toBe('Pick a status');
    });
  });
});

describe('createLookup types', () => {
  it('infers the value union from the config', () => {
    type Status = (typeof statusLookup.values)[number];

    expectTypeOf<Status>().toEqualTypeOf<'active' | 'archived' | 'draft'>();
    expectTypeOf(statusLookup.keys.active).toEqualTypeOf<'active'>();
    expectTypeOf(statusLookup.options[0]!.value).toEqualTypeOf<Status>();
    // The return type, not a call: resolve('x') would warn about an unknown
    // value on every run.
    expectTypeOf(
      statusLookup.resolve,
    ).returns.toEqualTypeOf<LookupEntry | null>();
    expectTypeOf(
      statusLookup.toZodEnum().parse('active'),
    ).toEqualTypeOf<Status>();
  });

  it('enforces an external union when annotated', () => {
    type Role = 'USER' | 'ADMIN';

    createLookup<Role>({
      USER: { label: 'User' },
      ADMIN: { label: 'Admin' },
    });

    // @ts-expect-error ADMIN is missing
    createLookup<Role>({ USER: { label: 'User' } });

    createLookup<Role>({
      USER: { label: 'User' },
      ADMIN: { label: 'Admin' },
      // @ts-expect-error GUEST is not a Role
      GUEST: { label: 'Guest' },
    });
  });

  it('only allows known badge variants', () => {
    createLookup({
      // @ts-expect-error not a BadgeVariant
      active: { label: 'Active', badgeVariant: 'sparkly' },
    });
  });
});
