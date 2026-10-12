import { isEmptyValue } from './is-empty-value';

describe('isEmptyValue', () => {
  it.each([undefined, null, '', []])('treats %o as empty', (value) => {
    expect(isEmptyValue(value)).toBe(true);
  });

  it.each(['a', 0, false, ['a'], {}])('treats %o as set', (value) => {
    expect(isEmptyValue(value)).toBe(false);
  });
});
