import { parseEnv } from './env';

describe('parseEnv', () => {
  it('defaults VITE_API_BASE_URL to same origin', () => {
    expect(parseEnv({}).VITE_API_BASE_URL).toBe('');
  });

  it('accepts an http(s) URL', () => {
    expect(
      parseEnv({ VITE_API_BASE_URL: 'https://api.example.com' })
        .VITE_API_BASE_URL,
    ).toBe('https://api.example.com');
  });

  // The api client appends /api, so a trailing slash would give //api.
  it.each([
    ['https://api.example.com/', 'https://api.example.com'],
    ['https://api.example.com//', 'https://api.example.com'],
    ['https://example.com/backend/', 'https://example.com/backend'],
  ])('strips the trailing slash from %s', (value, expected) => {
    expect(parseEnv({ VITE_API_BASE_URL: value }).VITE_API_BASE_URL).toBe(
      expected,
    );
  });

  it.each(['not a url', 'ftp://api.example.com'])(
    'rejects %s with a readable message',
    (value) => {
      expect(() => parseEnv({ VITE_API_BASE_URL: value })).toThrow(
        /Invalid environment variables:[\s\S]*VITE_API_BASE_URL/,
      );
    },
  );
});
