import { useEffect, useMemo, useState } from 'react';
import {
  hashKey,
  useInfiniteQuery,
  type QueryKey,
} from '@tanstack/react-query';
import type { AsyncOptionsSource, Option } from '../types';

export const ASYNC_PAGE_SIZE = 20;
const DEFAULT_DEBOUNCE_MS = 300;
const NO_PARENTS: Record<string, unknown> = {};

type Options = {
  source: AsyncOptionsSource;
  // Open and not gated by a cascade parent.
  enabled: boolean;
  parentValues?: Record<string, unknown>;
  // The current value, so its labels outlive a search that drops them.
  selected?: readonly string[];
  // Labels for values the form starts with, shown before any fetch.
  initialOptions?: readonly Option[];
  debounceMs?: number;
};

type SearchKey = { search: string; parentValues: Record<string, unknown> };

// The key without its search, so results can carry over while a new search
// loads but never across a source or a parent change.
function scopeOf(queryKey: QueryKey): string {
  const { parentValues } = queryKey.at(-1) as SearchKey;
  return hashKey([...queryKey.slice(0, -1), parentValues]);
}

export function useAsyncOptions({
  source,
  enabled,
  parentValues = NO_PARENTS,
  selected = [],
  initialOptions,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: Options) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const queryKey = [
    ...source.queryKey,
    { search: debouncedSearch, parentValues } satisfies SearchKey,
  ];
  const scope = scopeOf(queryKey);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      source.fetch({
        search: debouncedSearch,
        page: pageParam,
        limit: ASYNC_PAGE_SIZE,
        parentValues,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length + 1 : undefined,
    enabled,
    placeholderData: (previous, previousQuery) =>
      previousQuery && scopeOf(previousQuery.queryKey) === scope
        ? previous
        : undefined,
  });

  // Offset pages can repeat a row when the data shifts between requests.
  const options = useMemo(() => {
    const byValue = new Map<string, Option>();
    query.data?.pages.forEach((page) =>
      page.options.forEach((option) => byValue.set(option.value, option)),
    );
    return [...byValue.values()];
  }, [query.data]);

  const known = useMemo(
    () =>
      new Map(
        [...(initialOptions ?? []), ...options].map((option) => [
          option.value,
          option.label,
        ]),
      ),
    [initialOptions, options],
  );

  // Labels of selected values, copied while a loaded page still has them.
  // Set during render, so the trigger never paints the raw value in between.
  const [kept, setKept] = useState<Readonly<Record<string, string>>>({});
  const fresh: Record<string, string> = {};
  for (const value of selected) {
    const label = known.get(value);
    if (label !== undefined && kept[value] !== label) fresh[value] = label;
  }
  if (Object.keys(fresh).length > 0) {
    setKept((previous) => ({ ...previous, ...fresh }));
  }

  const getLabel = (value: string) => known.get(value) ?? kept[value] ?? value;

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetching) void query.fetchNextPage();
  };

  return {
    search,
    setSearch,
    options,
    hasMore: query.hasNextPage,
    isLoading:
      enabled &&
      (query.isPending || query.isPlaceholderData || query.isFetchingNextPage),
    isError: query.isError,
    refetch: () => void query.refetch(),
    loadMore,
    getLabel,
  };
}
