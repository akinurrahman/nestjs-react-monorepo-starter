export type PageWindowEntry = number | 'gap';

const MAX_UNWINDOWED = 7;

// The current page and its neighbours, with the first and last always shown
// and a gap wherever pages are skipped, so 63 pages are not 63 buttons.
export function pageWindow(
  current: number,
  totalPages: number,
): PageWindowEntry[] {
  if (totalPages <= MAX_UNWINDOWED) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visible = [
    ...new Set([1, totalPages, current - 1, current, current + 1]),
  ]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  return visible.flatMap((page, index): PageWindowEntry[] => {
    const previous = visible[index - 1];
    return previous !== undefined && page - previous > 1
      ? ['gap', page]
      : [page];
  });
}
