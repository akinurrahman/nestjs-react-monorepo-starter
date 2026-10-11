import type { PaginatedResponse } from '@starter/shared';

// A paginated body exactly as the api builds it: apps/api/src/common/
// pagination/paginate.ts gets one page of rows and the total, and an empty
// result has 0 pages, not 1. This takes the whole list and slices the page
// the way the api's skip and take would.
export function paginateFixture<T>(
  items: readonly T[],
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    data: items.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPrevious: page > 1 && totalPages > 0,
      hasNext: page < totalPages,
    },
  };
}
