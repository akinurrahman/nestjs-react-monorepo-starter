// What each engine says when a dynamic import or Vite's CSS preload for it
// fails, which after a deploy means the old chunk names are gone.
const CHUNK_ERROR_PATTERNS = [
  // Chromium
  /Failed to fetch dynamically imported module/i,
  // Firefox
  /error loading dynamically imported module/i,
  // Safari
  /Importing a module script failed/i,
  // Vite, when a chunk's stylesheet fails to load
  /Unable to preload CSS/i,
];

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}
