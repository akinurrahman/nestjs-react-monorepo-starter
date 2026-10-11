// Apple platforms label the shortcut modifier ⌘ instead of Ctrl.
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}
