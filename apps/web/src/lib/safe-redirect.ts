const PROBE_ORIGIN = 'http://redirect.invalid';

/**
 * A path inside this app taken from untrusted input (a ?redirect= param), or
 * the fallback. Only a relative path starting with a single "/" passes: no
 * scheme, no "//host". The value is also resolved the way a browser would,
 * which catches "/\host" and "/\t/host" (backslashes count as slashes, and
 * tabs and newlines are dropped). Returns the normalized path, search and
 * hash.
 */
export function safeRedirect(
  value: string | null | undefined,
  fallback = '/',
): string {
  if (!value?.startsWith('/') || value.startsWith('//')) return fallback;

  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE_ORIGIN) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
