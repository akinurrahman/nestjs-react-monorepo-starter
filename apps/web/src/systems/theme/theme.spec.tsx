import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import indexHtml from '../../../index.html?raw';
import { setPrefersDark } from '@/test/match-media';
import {
  THEME_STORAGE_KEY,
  resolveTheme,
  setTheme,
  useThemeStore,
} from './theme-store';
import { ThemeSync } from './theme-sync';
import { ThemeToggle } from './theme-toggle';

const isDark = () => document.documentElement.classList.contains('dark');

function storedTheme(): unknown {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return raw ? JSON.parse(raw).state.theme : undefined;
}

describe('theme', () => {
  beforeEach(() => {
    useThemeStore.setState(useThemeStore.getInitialState(), true);
  });

  it('sets the class and persists the choice from the toggle', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ThemeSync />
        <ThemeToggle />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Theme' }));
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Dark' }),
    );

    expect(isDark()).toBe(true);
    expect(storedTheme()).toBe('dark');
  });

  it('follows a live change of the system setting', () => {
    render(<ThemeSync />);
    expect(isDark()).toBe(false);

    act(() => setPrefersDark(true));
    expect(isDark()).toBe(true);

    act(() => setPrefersDark(false));
    expect(isDark()).toBe(false);
  });

  it('ignores the system setting once a theme is chosen', () => {
    render(<ThemeSync />);
    act(() => setTheme('light'));

    act(() => setPrefersDark(true));

    expect(isDark()).toBe(false);
  });

  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
  ] as const)(
    'resolves %s with system dark %s to %s',
    (theme, dark, expected) => {
      expect(resolveTheme(theme, dark)).toBe(expected);
    },
  );
});

describe('index.html theme script', () => {
  const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1] ?? '';
  // Runs the real inline script, not a copy of it.
  // oxlint-disable-next-line typescript/no-implied-eval
  const run = () => new Function(script)();

  it('reads the store key', () => {
    expect(script).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it('applies a stored dark theme', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { theme: 'dark' }, version: 0 }),
    );
    run();
    expect(isDark()).toBe(true);
  });

  it('reads what the store writes', () => {
    act(() => setTheme('dark'));
    document.documentElement.classList.remove('dark');

    run();

    expect(isDark()).toBe(true);
  });

  it('follows the system setting for system or nothing stored', () => {
    setPrefersDark(true);
    run();
    expect(isDark()).toBe(true);

    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { theme: 'system' }, version: 0 }),
    );
    setPrefersDark(false);
    run();
    expect(isDark()).toBe(false);
  });

  it.each(['{not json', '"dark"', '{"state":{"theme":"purple"}}'])(
    'survives a bad stored value %j',
    (raw) => {
      localStorage.setItem(THEME_STORAGE_KEY, raw);
      setPrefersDark(true);

      expect(run).not.toThrow();
      expect(isDark()).toBe(true);
    },
  );
});
