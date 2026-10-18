import { act } from '@testing-library/react';
import { renderHookWithRouter } from '@/test/render-with-router';
import { defineUrlFilters, pagingSpec, useUrlFilters } from './use-url-filters';

type Filters = {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  tags?: string[];
  sort?: 'NEW' | 'OLD';
  page: number;
  limit: number;
};

const SPEC = defineUrlFilters<Filters>({
  search: {},
  status: { values: ['ACTIVE', 'INACTIVE'], defaultValue: 'ACTIVE' },
  tags: { param: 'tag', kind: 'list', values: ['a', 'b', 'c'] },
  sort: { values: ['NEW', 'OLD'], defaultValue: 'NEW', view: true },
  page: {
    kind: 'number',
    min: 1,
    defaultValue: 1,
    transient: true,
    pager: true,
  },
  limit: {
    kind: 'number',
    min: 1,
    max: 100,
    defaultValue: 25,
    transient: true,
  },
});

function setup(url = '/') {
  return renderHookWithRouter(() => useUrlFilters(SPEC), { url });
}

describe('parsing', () => {
  it('reads numbers as numbers, not strings', () => {
    const { result } = setup('/?page=3');
    expect(result.current.filters.page).toBe(3);
  });

  it('reads a repeated param as a list', () => {
    const { result } = setup('/?tag=a&tag=b');
    expect(result.current.filters.tags).toEqual(['a', 'b']);
  });

  it('falls back to the default when the param is absent', () => {
    const { result } = setup('/');
    expect(result.current.filters.status).toBe('ACTIVE');
    expect(result.current.filters.limit).toBe(25);
  });
});

describe('validation', () => {
  it('drops a string outside the accepted values', () => {
    const { result } = setup('/?status=BANANA');
    expect(result.current.filters.status).toBe('ACTIVE');
  });

  it('drops only the invalid entries of a list', () => {
    const { result } = setup('/?tag=a&tag=NOPE&tag=c');
    expect(result.current.filters.tags).toEqual(['a', 'c']);
  });

  it('falls back when no list entry survives', () => {
    const { result } = setup('/?tag=NOPE');
    expect(result.current.filters.tags).toBeUndefined();
  });

  it('clamps a number below its minimum', () => {
    const { result } = setup('/?page=-4');
    expect(result.current.filters.page).toBe(1);
  });

  it('clamps a number above its maximum', () => {
    const { result } = setup('/?limit=99999');
    expect(result.current.filters.limit).toBe(100);
  });

  // The api's pagination schema takes integers only, so ?page=1.5 would be a
  // 400 that a retry resends forever.
  it('drops the fraction of a number', () => {
    const { result } = setup('/?page=2.7&limit=10.2');
    expect(result.current.filters.page).toBe(2);
    expect(result.current.filters.limit).toBe(10);
  });

  it('falls back when a number does not parse', () => {
    const { result } = setup('/?page=abc');
    expect(result.current.filters.page).toBe(1);
  });
});

describe('writing', () => {
  it('keeps two writes made in the same tick', () => {
    const { result, searchParams } = setup('/');

    act(() => {
      result.current.setFilter('search', 'foo');
      result.current.setFilter('status', 'INACTIVE');
    });

    expect(searchParams().get('search')).toBe('foo');
    expect(searchParams().get('status')).toBe('INACTIVE');
  });

  it('treats null as clearing the param', () => {
    const { result, searchParams } = setup('/?search=foo');

    act(() => {
      result.current.setFilter('search', null);
    });

    expect(searchParams().toString()).not.toContain('null');
    expect(searchParams().has('search')).toBe(false);
  });

  it('clears the pager when a filter changes', () => {
    const { result, searchParams } = setup('/?page=7');

    act(() => {
      result.current.setFilter('search', 'foo');
    });

    expect(searchParams().has('page')).toBe(false);
  });

  it('clears the pager even when the patch also names it', () => {
    const { result, searchParams } = setup('/');

    act(() => {
      result.current.setFilters({ page: 3, search: 'foo' });
    });

    expect(searchParams().has('page')).toBe(false);
  });

  it('leaves the pager alone for a view-only write', () => {
    const { result, searchParams } = setup('/?page=7');

    act(() => {
      result.current.setFilter('sort', 'OLD');
    });

    expect(searchParams().get('page')).toBe('7');
  });

  it('pages without clearing itself', () => {
    const { result, searchParams } = setup('/?search=foo');

    act(() => {
      result.current.setFilter('page', 4);
    });

    expect(searchParams().get('page')).toBe('4');
    expect(searchParams().get('search')).toBe('foo');
  });

  it('writes the page as a replace, not a new history entry', () => {
    const { result, router } = setup('/?search=foo');

    act(() => {
      result.current.setFilter('page', 2);
    });

    expect(router.state.historyAction).toBe('REPLACE');
  });
});

describe('params the spec does not own', () => {
  it('survive a reset', () => {
    const { result, searchParams } = setup('/?search=foo&drawer=open');

    act(() => {
      result.current.resetFilters();
    });

    expect(searchParams().get('drawer')).toBe('open');
    expect(searchParams().has('search')).toBe(false);
  });

  it('survive a reset of every kind of field', () => {
    const { result, searchParams } = setup(
      '/?search=foo&status=INACTIVE&tag=a&tag=b&sort=OLD&page=3&limit=50&drawer=open&tab=notes',
    );

    act(() => {
      result.current.resetFilters();
    });

    expect(searchParams().toString()).toBe('drawer=open&tab=notes');
  });

  it('survive applying a preset', () => {
    const { result, searchParams } = setup('/?search=foo&drawer=open');

    act(() => {
      result.current.applyCriteria({ status: 'INACTIVE' });
    });

    expect(searchParams().get('drawer')).toBe('open');
    expect(searchParams().get('status')).toBe('INACTIVE');
    expect(searchParams().has('search')).toBe(false);
  });
});

describe('isFiltered', () => {
  it('is false on a pristine screen', () => {
    const { result } = setup('/');
    expect(result.current.isFiltered).toBe(false);
  });

  it('ignores a field sitting on its own default', () => {
    const { result } = setup('/?status=ACTIVE');
    expect(result.current.isFiltered).toBe(false);
  });

  it('ignores a view field', () => {
    const { result } = setup('/?sort=OLD');
    expect(result.current.isFiltered).toBe(false);
  });

  it('ignores transient paging', () => {
    const { result } = setup('/?page=4&limit=50');
    expect(result.current.isFiltered).toBe(false);
  });

  it('is true for an applied filter', () => {
    const { result } = setup('/?status=INACTIVE');
    expect(result.current.isFiltered).toBe(true);
  });

  it('is true for a list with entries', () => {
    const { result } = setup('/?tag=a');
    expect(result.current.isFiltered).toBe(true);
  });
});

describe('criteria', () => {
  it('excludes transient fields', () => {
    const { result } = setup('/?search=foo&page=3&limit=50');
    expect(result.current.criteria).not.toHaveProperty('page');
    expect(result.current.criteria).not.toHaveProperty('limit');
    expect(result.current.criteria.search).toBe('foo');
  });
});

describe('write sequencing', () => {
  it('keeps three writes made in the same tick', () => {
    const { result, searchParams } = setup('/');

    act(() => {
      result.current.setFilter('search', 'foo');
      result.current.setFilter('status', 'INACTIVE');
      result.current.setFilter('tags', ['a', 'b']);
    });

    expect(searchParams().get('search')).toBe('foo');
    expect(searchParams().get('status')).toBe('INACTIVE');
    expect(searchParams().getAll('tag')).toEqual(['a', 'b']);
  });

  it('does not replay a queued write into a later tick', () => {
    const { result, searchParams } = setup('/');

    act(() => {
      result.current.setFilter('search', 'foo');
    });
    act(() => {
      result.current.setFilter('search', 'bar');
    });

    expect(searchParams().getAll('search')).toEqual(['bar']);
  });

  it('builds a later tick on what actually landed', () => {
    const { result, searchParams } = setup('/');

    act(() => {
      result.current.setFilter('search', 'foo');
    });
    act(() => {
      result.current.setFilter('status', 'INACTIVE');
    });

    expect(searchParams().get('search')).toBe('foo');
    expect(searchParams().get('status')).toBe('INACTIVE');
  });

  it('builds on an outside navigation that landed in between', async () => {
    const { result, searchParams, navigate } = setup('/?search=foo');

    act(() => {
      result.current.setFilter('status', 'INACTIVE');
    });
    await navigate('/?search=bar&drawer=open');
    act(() => {
      result.current.setFilter('tags', ['a']);
    });

    expect(searchParams().toString()).toBe('search=bar&drawer=open&tag=a');
  });

  it('leaves foreign params alone on a normal write', () => {
    const { result, searchParams } = setup('/?drawer=open');

    act(() => {
      result.current.setFilter('search', 'foo');
    });

    expect(searchParams().get('drawer')).toBe('open');
  });

  it('drops empty strings rather than writing a bare param', () => {
    const { result, searchParams } = setup('/?search=foo');

    act(() => {
      result.current.setFilter('search', '');
    });

    expect(searchParams().has('search')).toBe(false);
  });
});

describe('a list field that has a default', () => {
  type Listed = { tags?: string[]; page: number };

  const LIST_SPEC = defineUrlFilters<Listed>({
    tags: {
      param: 'tag',
      kind: 'list',
      values: ['a', 'b'],
      defaultValue: ['a'],
    },
    page: { kind: 'number', defaultValue: 1, transient: true, pager: true },
  });

  function setupListed(url = '/') {
    return renderHookWithRouter(() => useUrlFilters(LIST_SPEC), { url });
  }

  it('is not filtered while sitting on its default', () => {
    const { result } = setupListed('/');
    expect(result.current.filters.tags).toEqual(['a']);
    expect(result.current.isFiltered).toBe(false);
  });

  it('is not filtered when the URL restates the default', () => {
    const { result } = setupListed('/?tag=a');
    expect(result.current.isFiltered).toBe(false);
  });

  it('is filtered once the selection differs', () => {
    const { result } = setupListed('/?tag=b');
    expect(result.current.isFiltered).toBe(true);
  });
});

describe('defaults', () => {
  it('resolves a thunk default once per mount', () => {
    const today = vi.fn(() => '2026-10-10');
    const spec = defineUrlFilters<{ day?: string }>({
      day: { defaultValue: today },
    });
    const { result, rerender } = renderHookWithRouter(() =>
      useUrlFilters(spec),
    );
    rerender();

    expect(result.current.defaults.day).toBe('2026-10-10');
    expect(result.current.filters.day).toBe('2026-10-10');
    expect(today).toHaveBeenCalledOnce();
  });
});

describe('pagingSpec', () => {
  type Paged = { page: number; limit: number };
  const PAGED_SPEC = defineUrlFilters<Paged>(pagingSpec(20));

  it('caps the limit at the api maximum by default', () => {
    const { result } = renderHookWithRouter(() => useUrlFilters(PAGED_SPEC), {
      url: '/?limit=500',
    });
    expect(result.current.filters.limit).toBe(100);
  });

  it('takes its own maximum', () => {
    const spec = defineUrlFilters<Paged>(pagingSpec(10, 30));
    const { result } = renderHookWithRouter(() => useUrlFilters(spec), {
      url: '/?limit=500',
    });
    expect(result.current.filters.limit).toBe(30);
  });

  it('defaults to the given limit and page 1', () => {
    const { result } = renderHookWithRouter(() => useUrlFilters(PAGED_SPEC));
    expect(result.current.filters).toEqual({ page: 1, limit: 20 });
  });
});
