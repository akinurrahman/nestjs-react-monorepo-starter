import { ROLES, roleSchema } from './roles.js';

describe('roleSchema', () => {
  it.each(ROLES)('accepts %s', (role) => {
    expect(roleSchema.parse(role)).toBe(role);
  });

  it.each(['admin', 'OWNER', ''])('rejects %j', (value) => {
    expect(roleSchema.safeParse(value).success).toBe(false);
  });

  it('says one plain thing for a missing role', () => {
    expect(roleSchema.safeParse(undefined).error?.issues).toEqual([
      expect.objectContaining({ message: 'Pick a role' }),
    ]);
  });
});
