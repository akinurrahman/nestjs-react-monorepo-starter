export const PREVIEW_SECTIONS = [
  { id: 'tokens', title: 'Tokens' },
  { id: 'buttons', title: 'Buttons' },
  { id: 'badges', title: 'Badges' },
  { id: 'form', title: 'Form' },
  { id: 'filters', title: 'Filters' },
  { id: 'table', title: 'Table' },
  { id: 'states', title: 'States' },
  { id: 'overlays', title: 'Overlays' },
  { id: 'toasts', title: 'Toasts' },
  { id: 'errors', title: 'Errors and navigation' },
] as const;

export type PreviewSectionId = (typeof PREVIEW_SECTIONS)[number]['id'];

export function sectionTitle(id: PreviewSectionId): string {
  return PREVIEW_SECTIONS.find((section) => section.id === id)!.title;
}
