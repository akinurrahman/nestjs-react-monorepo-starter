import { safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it.each([
    ['/reports', '/reports'],
    ['/reports?page=2&q=a%20b', '/reports?page=2&q=a%20b'],
    ['/users/1#profile', '/users/1#profile'],
    ['/', '/'],
  ])('keeps the in-app path %s', (value, expected) => {
    expect(safeRedirect(value)).toBe(expected);
  });

  it.each([
    ['empty', ''],
    ['missing', null],
    ['protocol relative', '//evil.example'],
    ['absolute url', 'https://evil.example/x'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['relative without a slash', 'reports'],
    ['backslash host', '/\\evil.example'],
    ['tab before a second slash', '/\t/evil.example'],
    ['newline before a second slash', '/\n/evil.example'],
  ])('falls back for %s', (_name, value) => {
    expect(safeRedirect(value)).toBe('/');
  });

  it('uses the given fallback', () => {
    expect(safeRedirect('//evil.example', '/home')).toBe('/home');
  });
});
