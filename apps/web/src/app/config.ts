// The init script renames this, along with the <title> in index.html.
export const APP_NAME = 'Starter';

// Sidebar group headings, top to bottom. A route's nav.group should be one
// of these; any other group warns in dev and is listed last. "Dev" holds the
// routes in app/dev and exists only in development.
export const NAV_GROUPS: readonly string[] = import.meta.env.DEV
  ? ['General', 'Admin', 'Dev']
  : ['General', 'Admin'];

export function formatDocumentTitle(title: string | undefined): string {
  return title ? `${title} | ${APP_NAME}` : APP_NAME;
}
