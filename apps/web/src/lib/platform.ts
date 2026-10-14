// Apple platforms label the shortcut modifier ⌘ instead of Ctrl.
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

// An object, not a bare function, so a test can spy on it: jsdom makes
// window.location and its methods non-configurable.
export const pageLocation = {
  replace(path: string): void {
    window.location.replace(path);
  },
};
