import { z } from 'zod';
import { queryBoolean } from './query-boolean.js';

const flag = queryBoolean();

describe('queryBoolean', () => {
  it('parses "true" and "false"', () => {
    expect(flag.parse('true')).toBe(true);
    expect(flag.parse('false')).toBe(false);
  });

  it('ignores case', () => {
    expect(flag.parse('FALSE')).toBe(false);
  });

  it.each(['1', '0', 'yes', 'no', 'on', ''])('rejects %j', (value) => {
    expect(flag.safeParse(value).success).toBe(false);
  });

  it('leaves a missing value out with .optional()', () => {
    expect(z.object({ flag: flag.optional() }).parse({})).toEqual({});
  });
});
