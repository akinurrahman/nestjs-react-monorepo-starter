import { ROLES, roleSchema } from './roles.js';

describe('roleSchema', () => {
  it.each(ROLES)('accepts %s', (role) => {
    expect(roleSchema.parse(role)).toBe(role);
  });

  it.each(['admin', 'OWNER', ''])('rejects %j', (value) => {
    expect(roleSchema.safeParse(value).success).toBe(false);
  });
});
