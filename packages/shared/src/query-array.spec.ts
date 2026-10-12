import { z } from 'zod';
import { queryArray } from './query-array.js';

const status = queryArray(z.enum(['active', 'archived']));

describe('queryArray', () => {
  it('wraps a single value in an array', () => {
    expect(status.parse('active')).toEqual(['active']);
  });

  it('keeps multiple values', () => {
    expect(status.parse(['active', 'archived'])).toEqual([
      'active',
      'archived',
    ]);
  });

  it('keeps an empty array', () => {
    expect(status.parse([])).toEqual([]);
  });

  it('rejects an invalid item', () => {
    const result = status.safeParse(['active', 'deleted']);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([1]);
  });

  it('rejects an invalid single value', () => {
    expect(status.safeParse('deleted').success).toBe(false);
  });

  it('rejects a missing value unless the caller allows it', () => {
    expect(status.safeParse(undefined).success).toBe(false);
  });

  it('leaves a missing value out with .optional()', () => {
    const schema = z.object({ status: status.optional() });
    expect(schema.parse({})).toEqual({});
  });

  it('fills in a missing value with .default([])', () => {
    const schema = z.object({ status: status.default([]) });
    expect(schema.parse({})).toEqual({ status: [] });
  });

  it('applies the item schema to a wrapped value', () => {
    expect(queryArray(z.coerce.number().int()).parse('3')).toEqual([3]);
  });
});
