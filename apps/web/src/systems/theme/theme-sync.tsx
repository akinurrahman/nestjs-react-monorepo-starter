import { useEffect } from 'react';
import { themeLookup } from './theme.lookup';
import { useResolvedTheme } from './theme-store';

// Keeps the .dark class on <html> in step with the store after the inline
// script in index.html has set the first one.
export function ThemeSync() {
  const resolved = useResolvedTheme();

  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      resolved === themeLookup.keys.dark,
    );
  }, [resolved]);

  return null;
}
