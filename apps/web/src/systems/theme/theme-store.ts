import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { themeLookup, type ResolvedTheme, type Theme } from './theme.lookup';

// index.html reads this key before React loads, so a rename or a change to
// the stored shape ({ state: { theme } }) has to happen there too.
export const THEME_STORAGE_KEY = 'ui-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

type ThemeState = { theme: Theme };

export const useThemeStore = create<ThemeState>()(
  persist((): ThemeState => ({ theme: themeLookup.keys.system }), {
    name: THEME_STORAGE_KEY,
  }),
);

export function setTheme(theme: Theme): void {
  useThemeStore.setState({ theme });
}

export function resolveTheme(
  theme: Theme,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (theme !== themeLookup.keys.system) return theme;
  return systemPrefersDark ? themeLookup.keys.dark : themeLookup.keys.light;
}

function subscribeToSystem(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function useTheme(): Theme {
  return useThemeStore((state) => state.theme);
}

// Follows the OS setting live while the theme is system.
export function useResolvedTheme(): ResolvedTheme {
  const theme = useTheme();
  const prefersDark = useSyncExternalStore(
    subscribeToSystem,
    systemPrefersDark,
  );
  return resolveTheme(theme, prefersDark);
}
