import { paginateFixture } from './paginate';

const items = Array.from({ length: 45 }, (_, index) => index + 1);

// The cases apps/api/src/common/pagination/paginate.spec.ts pins down.
describe('paginateFixture', () => {
  it('slices a middle page', () => {
    expect(paginateFixture(items, 2, 20)).toEqual({
      data: items.slice(20, 40),
      pagination: {
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
        hasPrevious: true,
        hasNext: true,
      },
    });
  });

  it('ends on a short last page', () => {
    const { data, pagination } = paginateFixture(items, 3, 20);
    expect(data).toEqual([41, 42, 43, 44, 45]);
    expect(pagination).toMatchObject({ hasPrevious: true, hasNext: false });
  });

  it('gives an empty result zero pages, with no way back or on', () => {
    expect(paginateFixture([], 2, 20).pagination).toEqual({
      page: 2,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasPrevious: false,
      hasNext: false,
    });
  });

  it('returns no rows past the last page, with the real totals', () => {
    const { data, pagination } = paginateFixture(items, 9, 20);
    expect(data).toEqual([]);
    expect(pagination).toMatchObject({ total: 45, totalPages: 3 });
  });
});
