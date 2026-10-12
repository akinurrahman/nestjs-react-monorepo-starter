import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { MAX_PAGE_LIMIT } from '@starter/shared';
import { isEmptyValue } from '@/lib/is-empty-value';

// null as well as undefined, because a cleared Base UI select hands back null
// and String(null) would put a literal "null" in the URL. Both drop the param.
export type UrlFilterValue = string | string[] | number | null | undefined;

type UrlFilterFieldBase = {
  // The search param name, when it differs from the key.
  param?: string;
  // A view preference like sort order. Never counts toward isFiltered, and
  // writing it keeps the current page.
  view?: boolean;
  // Left out of criteria, which is what a saved preset stores.
  transient?: boolean;
  // The page cursor. Any write that narrows the results clears it, so a new
  // filter never lands on an empty page 7.
  pager?: boolean;
};

// A thunk resolves once per mount, for a default like "today" that must not
// drift mid-session.
type Defaultable<V> = V | (() => V);

type ListFieldInput<V extends readonly unknown[]> = UrlFilterFieldBase & {
  kind: 'list';
  defaultValue?: Defaultable<V>;
  // Entries outside these are dropped. If none survive, the default applies.
  values?: readonly V[number][];
};

type NumberFieldInput = UrlFilterFieldBase & {
  kind: 'number';
  defaultValue?: Defaultable<number>;
  // Clamped, not rejected, so ?page=-4 reads as page 1.
  min?: number;
  max?: number;
};

type StringFieldInput<V extends string> = UrlFilterFieldBase & {
  kind?: 'string';
  defaultValue?: Defaultable<V>;
  // Anything else falls back to the default, so a hand-edited ?status=BANANA
  // never reaches the API typed as an enum member. Pass a lookup's .values.
  values?: readonly V[];
};

// The tuples stop the conditional distributing over a union, which would turn
// a status field into one shape per literal and reject a lookup's .values.
export type UrlFilterFieldInput<V> = [NonNullable<V>] extends [
  readonly unknown[],
]
  ? ListFieldInput<NonNullable<V> & readonly unknown[]>
  : [NonNullable<V>] extends [number]
    ? NumberFieldInput
    : [NonNullable<V>] extends [string]
      ? StringFieldInput<NonNullable<V> & string>
      : UrlFilterFieldBase;

export type UrlFilterField = UrlFilterFieldBase & {
  param: string;
  kind?: 'string' | 'number' | 'list';
  defaultValue?: Defaultable<string | number | string[]>;
  values?: readonly string[];
  min?: number;
  max?: number;
};

// Every key of the filter type needs an entry, so adding a filter fails to
// compile until it says how it is read.
export type UrlFilterSpecInput<T> = {
  [K in keyof Required<T>]: UrlFilterFieldInput<Required<T>[K]>;
};

type UrlFilterFields<T> = { [K in keyof Required<T>]: UrlFilterField };

export type UrlFilterSpec<
  T,
  C = Omit<T, 'page' | 'limit'>,
> = UrlFilterFields<T> & {
  // Type-only, never set at runtime. It carries the filter and criteria types
  // so useUrlFilters(SPEC) infers both and no call site restates them.
  readonly __types?: { filters: T; criteria: C };
};

export function defineUrlFilters<
  T extends object,
  C = Omit<T, 'page' | 'limit'>,
>(spec: UrlFilterSpecInput<T>): UrlFilterSpec<T, C> {
  const resolved = {} as UrlFilterFields<T>;

  (Object.keys(spec) as (keyof T & string)[]).forEach((key) => {
    // The input type is conditional on a key TypeScript cannot resolve here,
    // so this is where it widens to the one runtime shape the hook reads.
    const input = spec[key] as UrlFilterFieldBase;
    resolved[key] = { ...input, param: input.param ?? key } as UrlFilterField;
  });

  return resolved;
}

export function pagingSpec(
  defaultLimit: number,
  maxLimit: number = MAX_PAGE_LIMIT,
): UrlFilterSpecInput<{ page: number; limit: number }> {
  return {
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
      max: maxLimit,
      defaultValue: defaultLimit,
      transient: true,
    },
  };
}

// List defaults compare by membership, since a list default is a fresh array
// every mount and param order means nothing.
export function differsFromDefault(
  value: UrlFilterValue,
  fallback: UrlFilterValue,
): boolean {
  if (isEmptyValue(value)) return false;

  if (Array.isArray(value)) {
    if (!Array.isArray(fallback)) return true;
    return (
      value.length !== fallback.length ||
      value.some((entry) => !fallback.includes(entry))
    );
  }

  return value !== fallback;
}

type Patch<T> = Partial<Record<keyof T, UrlFilterValue>>;

// Only what the spec owns. A tab, a drawer or a tracking tag can share the URL.
function clearOwnParams(
  params: URLSearchParams,
  fields: [string, UrlFilterField][],
) {
  fields.forEach(([, field]) => params.delete(field.param));
}

export function useUrlFilters<T extends object, C = Omit<T, 'page' | 'limit'>>(
  spec: UrlFilterSpec<T, C>,
) {
  const [params, setParams] = useSearchParams();

  // setSearchParams hands its updater the params of the render it came from,
  // not the live ones, so two writes in one tick both start from the same
  // snapshot and the second drops the first. Each write is kept here for the
  // next one in the same tick to build on, until the navigation lands.
  const pendingRef = useRef<URLSearchParams | null>(null);

  useEffect(() => {
    pendingRef.current = null;
  }, [params]);

  const write = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(pendingRef.current ?? prev);
          mutate(next);
          pendingRef.current = next;
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // __types never exists at runtime, so the entries are exactly the fields.
  const fields = useMemo(
    () =>
      Object.entries(spec) as unknown as [keyof T & string, UrlFilterField][],
    [spec],
  );

  const defaults = useMemo(() => {
    const resolved: Record<string, UrlFilterValue> = {};
    fields.forEach(([key, field]) => {
      resolved[key] =
        typeof field.defaultValue === 'function'
          ? field.defaultValue()
          : field.defaultValue;
    });
    return resolved as Readonly<Record<keyof T, UrlFilterValue>>;
  }, [fields]);

  const filters = useMemo(() => {
    const parsed: Record<string, UrlFilterValue> = {};
    const fallbacks = defaults as Record<string, UrlFilterValue>;

    fields.forEach(([key, field]) => {
      const fallback = fallbacks[key];

      if (field.kind === 'list') {
        const entries = params.getAll(field.param);
        const accepted = field.values
          ? entries.filter((entry) => field.values?.includes(entry))
          : entries;
        parsed[key] = accepted.length
          ? accepted
          : (fallback as string[] | undefined);
        return;
      }

      const raw = params.get(field.param);

      if (field.kind === 'number') {
        const value =
          raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
        if (!Number.isFinite(value)) {
          parsed[key] = fallback as number | undefined;
          return;
        }

        const lowered =
          field.max === undefined ? value : Math.min(value, field.max);
        parsed[key] =
          field.min === undefined ? lowered : Math.max(lowered, field.min);
        return;
      }

      if (raw !== null && field.values && !field.values.includes(raw)) {
        parsed[key] = fallback as string | undefined;
        return;
      }

      parsed[key] = raw ?? (fallback as string | undefined);
    });

    return parsed as T;
  }, [params, fields, defaults]);

  // Several fields in one navigation, so a range edit is one URL write. Like
  // every write here it replaces the history entry instead of adding one.
  const setFilters = useCallback(
    (patch: Patch<T>) => {
      write((next) => {
        Object.entries(patch as Record<string, UrlFilterValue>).forEach(
          ([key, value]) => {
            const field = spec[key as keyof T];
            if (!field) return;

            next.delete(field.param);

            const values = Array.isArray(value)
              ? value
              : value === undefined || value === null
                ? []
                : [String(value)];
            values
              .filter((entry) => entry !== '')
              .forEach((entry) => next.append(field.param, entry));
          },
        );

        // Keyed off what the patch narrows, not whether it names the pager:
        // { page: 3, search: 'foo' } is a new search and starts at page 1.
        const narrows = Object.keys(patch).some((key) => {
          const field = spec[key as keyof T];
          return Boolean(field) && !field.pager && !field.view;
        });

        if (narrows) {
          fields.forEach(([, field]) => {
            if (field.pager) next.delete(field.param);
          });
        }
      });
    },
    [write, spec, fields],
  );

  const setFilter = useCallback(
    (key: keyof T, value?: UrlFilterValue) =>
      setFilters({ [key]: value } as Patch<T>),
    [setFilters],
  );

  // A whole preset in one navigation. The spec's own fields it does not name
  // are dropped.
  const applyCriteria = useCallback(
    (criteria: C) => {
      write((next) => {
        clearOwnParams(next, fields);

        Object.entries(criteria as Record<string, UrlFilterValue>).forEach(
          ([key, value]) => {
            const field = spec[key as keyof T];
            if (!field || value === undefined || value === null || value === '')
              return;

            const values = Array.isArray(value) ? value : [value];
            values.forEach((entry) => next.append(field.param, String(entry)));
          },
        );
      });
    },
    [write, spec, fields],
  );

  const resetFilters = useCallback(
    () => write((next) => clearOwnParams(next, fields)),
    [write, fields],
  );

  const criteria = useMemo(() => {
    const slice: Record<string, UrlFilterValue> = {};
    fields.forEach(([key, field]) => {
      if (field.transient) return;
      slice[key] = (filters as Record<string, UrlFilterValue>)[key];
    });
    return slice as C;
  }, [fields, filters]);

  // A field on its own default was not applied by anyone, so it must not
  // light up "Clear filters" on a pristine screen.
  const isFiltered = useMemo(
    () =>
      fields.some(
        ([key, field]) =>
          !field.transient &&
          !field.view &&
          differsFromDefault(
            (filters as Record<string, UrlFilterValue>)[key],
            defaults[key],
          ),
      ),
    [fields, filters, defaults],
  );

  return {
    filters,
    defaults,
    criteria,
    isFiltered,
    setFilter,
    setFilters,
    applyCriteria,
    resetFilters,
    searchParams: params,
  };
}
