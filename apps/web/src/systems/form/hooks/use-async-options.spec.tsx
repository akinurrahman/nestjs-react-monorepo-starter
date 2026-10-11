import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { peopleSource, servePeople } from '@/test/people-source';
import { createTestQueryClient } from '@/test/render-with-query';
import { fromPaginated } from '../lib/from-paginated';
import { useAsyncOptions } from './use-async-options';

type Props = Parameters<typeof useAsyncOptions>[0];

function renderOptions(initialProps: Partial<Props> = {}) {
  const client: QueryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    (props: Partial<Props>) =>
      useAsyncOptions({
        source: peopleSource,
        enabled: true,
        debounceMs: 20,
        ...props,
      }),
    { wrapper, initialProps },
  );
  return { ...hook, client };
}

const labels = (options: { label: string }[]) =>
  options.map((option) => option.label);

describe('fromPaginated', () => {
  it('maps items and reads hasMore from pagination.hasNext', () => {
    const page = fromPaginated(
      {
        data: [{ id: 'a', name: 'Ada' }],
        pagination: {
          page: 1,
          limit: 1,
          total: 2,
          totalPages: 2,
          hasPrevious: false,
          hasNext: true,
        },
      },
      (item) => ({ value: item.id, label: item.name }),
    );

    expect(page).toEqual({
      options: [{ value: 'a', label: 'Ada' }],
      hasMore: true,
    });
  });
});

describe('useAsyncOptions', () => {
  it('does not fetch until enabled', async () => {
    const requests = servePeople();
    const { result, rerender } = renderOptions({ enabled: false });

    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(requests).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.options).toHaveLength(20));
  });

  it('sends only the settled search', async () => {
    const requests = servePeople();
    const { result } = renderOptions();
    await waitFor(() => expect(requests).toHaveLength(1));

    act(() => result.current.setSearch('a'));
    act(() => result.current.setSearch('al'));
    act(() => result.current.setSearch('ali'));

    await waitFor(() =>
      expect(labels(result.current.options)).toEqual(['Alice']),
    );
    expect(requests.map((params) => params.get('search'))).toEqual([
      null,
      'ali',
    ]);
  });

  it('keeps the previous results while a new search loads', async () => {
    servePeople({ laterDelayMs: 200 });
    const { result } = renderOptions();
    await waitFor(() => expect(result.current.options).toHaveLength(20));

    act(() => result.current.setSearch('bob'));

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.options).toHaveLength(20);
    await waitFor(() =>
      expect(labels(result.current.options)).toEqual(['Bob']),
    );
  });

  it('appends the next page on loadMore', async () => {
    const requests = servePeople();
    const { result } = renderOptions();
    await waitFor(() => expect(result.current.options).toHaveLength(20));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.options).toHaveLength(33));
    expect(result.current.hasMore).toBe(false);
    expect(requests.map((params) => params.get('page'))).toEqual(['1', '2']);
    expect(requests[1]!.get('limit')).toBe('20');
  });

  it('ends paging on a search with no matches', async () => {
    const requests = servePeople();
    const { result } = renderOptions();
    await waitFor(() => expect(result.current.options).toHaveLength(20));

    act(() => result.current.setSearch('nobody'));

    await waitFor(() => expect(requests).toHaveLength(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.options).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it('shares one request between two pickers on the same source', async () => {
    const requests = servePeople();
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => [
        useAsyncOptions({ source: peopleSource, enabled: true }),
        useAsyncOptions({ source: peopleSource, enabled: true }),
      ],
      { wrapper },
    );

    await waitFor(() => expect(result.current[1]!.options).toHaveLength(20));
    expect(result.current[0]!.options).toHaveLength(20);
    expect(requests).toHaveLength(1);
  });

  it('reports a failed request and recovers on refetch', async () => {
    // The first request and both of its retries fail.
    servePeople({ failOn: [1, 2, 3] });
    const { result } = renderOptions();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.options).toEqual([]);

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.options).toHaveLength(20));
    expect(result.current.isError).toBe(false);
  });

  it('refetches when the source key is invalidated', async () => {
    const requests = servePeople();
    const { result, client } = renderOptions();
    await waitFor(() => expect(result.current.options).toHaveLength(20));

    await act(() =>
      client.invalidateQueries({ queryKey: peopleSource.queryKey }),
    );

    expect(requests).toHaveLength(2);
  });

  it('labels a value from initialOptions before any fetch', () => {
    const requests = servePeople();
    const { result } = renderOptions({
      enabled: false,
      selected: ['xavier'],
      initialOptions: [{ value: 'xavier', label: 'Xavier' }],
    });

    expect(result.current.getLabel('xavier')).toBe('Xavier');
    expect(requests).toHaveLength(0);
  });

  it('keeps a selected label after a search that excludes it', async () => {
    servePeople();
    const { result } = renderOptions({ selected: ['alice'] });
    await waitFor(() => expect(result.current.getLabel('alice')).toBe('Alice'));

    act(() => result.current.setSearch('bob'));
    await waitFor(() =>
      expect(labels(result.current.options)).toEqual(['Bob']),
    );

    expect(result.current.getLabel('alice')).toBe('Alice');
    expect(result.current.getLabel('carol')).toBe('carol');
  });

  it('refetches for a new parent without showing the old parent results', async () => {
    const requests = servePeople({ laterDelayMs: 200 });
    const { result, rerender } = renderOptions({
      parentValues: { team: 'red' },
    });
    await waitFor(() => expect(result.current.options).toHaveLength(20));

    rerender({ parentValues: { team: 'blue' } });

    expect(result.current.options).toEqual([]);
    await waitFor(() =>
      expect(labels(result.current.options)).toEqual(['Carol']),
    );
    expect(requests.map((params) => params.get('team'))).toEqual([
      'red',
      'blue',
    ]);
  });
});
