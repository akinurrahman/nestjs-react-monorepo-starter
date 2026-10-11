import * as React from 'react';

// Tailwind's md breakpoint. Keep the two in sync, or the sidebar switches to
// the sheet at a different width than md: classes change.
const MOBILE_BREAKPOINT = 768;

const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot);
}
