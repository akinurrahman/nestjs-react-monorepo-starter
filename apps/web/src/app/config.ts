// The init script renames this, along with the <title> in index.html.
export const APP_NAME = 'Starter';

export function formatDocumentTitle(title: string | undefined): string {
  return title ? `${title} | ${APP_NAME}` : APP_NAME;
}
