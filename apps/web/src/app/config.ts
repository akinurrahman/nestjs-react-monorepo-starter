// The init script renames this, along with the <title> in index.html.
export const APP_NAME = 'Starter';

// Sidebar group headings, top to bottom. A route's nav.group should be one
// of these; any other group warns in dev and is listed last.
export const NAV_GROUPS = ['General'] as const;

export function formatDocumentTitle(title: string | undefined): string {
  return title ? `${title} | ${APP_NAME}` : APP_NAME;
}
