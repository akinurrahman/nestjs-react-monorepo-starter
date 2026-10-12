import { z } from 'zod';

// A boolean query param. Only "true" and "false" are accepted (any case);
// z.coerce.boolean() would turn "false" into true, and anything else is a
// 400 rather than a guess.
export function queryBoolean() {
  return z.stringbool({ truthy: ['true'], falsy: ['false'] });
}
