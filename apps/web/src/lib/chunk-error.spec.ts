import { isChunkLoadError } from './chunk-error';

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://app.test/assets/home-page-abc123.js',
    'error loading dynamically imported module: https://app.test/assets/home-page-abc123.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/home-page-abc123.css',
  ])('recognises %j', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of null'))).toBe(
      false,
    );
  });

  it('ignores non-errors', () => {
    expect(
      isChunkLoadError('Failed to fetch dynamically imported module'),
    ).toBe(false);
  });
});
