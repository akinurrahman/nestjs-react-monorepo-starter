import { z } from 'zod';

// Express's simple query parser gives a string for ?k=a and an array for
// ?k=a&k=b, so a lone value is wrapped before the array schema sees it.
export function queryArray<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (value) => (value === undefined || Array.isArray(value) ? value : [value]),
    z.array(item),
  );
}
