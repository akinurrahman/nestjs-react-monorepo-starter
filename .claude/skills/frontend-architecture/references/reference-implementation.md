# Reference implementation

A multi-entity feature: `academic`, owning class and subject. Four pages, two
entities, one cross-entity read. Paths are relative to `apps/web/src`.

**Structure and imports are exact. Bodies are complete enough to copy.** The
reasoning sits in prose between the code blocks, not inside them. Generated code
follows the code blocks.

Read the class entity end to end first. Subject is the same shape and only its
differences are listed.

```
features/academic/
├── routes.tsx
├── index.ts
├── definitions/
│   ├── class.lookup.ts
│   ├── class.types.ts
│   ├── class.constants.ts
│   ├── class.schema.ts
│   ├── subject.lookup.ts
│   ├── subject.types.ts
│   ├── subject.constants.ts
│   └── subject.schema.ts
├── api/
│   ├── class.api.ts
│   ├── class.queries.ts
│   ├── class.mutations.ts
│   ├── subject.api.ts
│   ├── subject.queries.ts
│   └── subject.mutations.ts
├── components/
│   ├── classes/class-form.tsx
│   └── subjects/subject-form.tsx
└── pages/
    ├── classes/
    │   ├── class-list-page.tsx
    │   └── class-form-page.tsx
    └── subjects/
        ├── subject-list-page.tsx
        └── subject-form-page.tsx
```

No `hooks/`, no table wrappers, no column files, no query option factories, no
detail pages. The last section lists what would make each of those earn a file.

---

## Class: definitions

### `definitions/class.lookup.ts`

```ts
import { createLookup } from '@/lib/lookup/create-lookup';

export const classStatusLookup = createLookup(
  {
    active: { label: 'Active', badgeVariant: 'success' },
    archived: { label: 'Archived', badgeVariant: 'secondary' },
  },
  'ClassStatus',
);

export type ClassStatus = (typeof classStatusLookup.values)[number];
```

The second argument names the lookup in the dev warning `resolve()` prints for
a value the API sent but the lookup does not know yet.

### `definitions/class.types.ts`

```ts
import type { ClassStatus } from './class.lookup';

export type { ClassStatus };

export type ClassListItem = {
  id: string;
  name: string;
  numericLevel: number;
  status: ClassStatus;
  sectionCount: number;
  studentCount: number;
  // Minor units, as the API sends money.
  monthlyFee: number;
};

export type ClassDetail = ClassListItem & {
  subjectIds: string[];
  subjects: { id: string; name: string }[];
  remarks: string | null;
};

export type ClassFilters = {
  search?: string;
  status?: ClassStatus;
  page: number;
  limit: number;
};
```

### `definitions/class.constants.ts`

Two things live here: the query keys and the filter spec.

`defineUrlFilters` needs an entry for every key of `ClassFilters`, so adding a
filter to the type fails to compile until it says how it is read. `values` takes
the lookup's `.values`, which is what stops a hand-edited `?status=BANANA` from
reaching the API wearing the type of a real enum member. `pagingSpec` covers
`page` and `limit`, clamped to the API's `MAX_PAGE_LIMIT`.

```ts
import { defineUrlFilters, pagingSpec } from '@/systems/filters';
import { classStatusLookup } from './class.lookup';
import type { ClassFilters } from './class.types';

export const CLASS_KEYS = {
  all: ['academic', 'classes'] as const,
  lists: () => [...CLASS_KEYS.all, 'list'] as const,
  list: (filters: ClassFilters) => [...CLASS_KEYS.lists(), filters] as const,
  details: () => [...CLASS_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CLASS_KEYS.details(), id] as const,
};

export const CLASS_FILTER_SPEC = defineUrlFilters<ClassFilters>({
  search: {},
  status: { values: classStatusLookup.values },
  ...pagingSpec(20),
});
```

The spec is a module-level constant. Declaring it inline in the page would
build a new object every render, and it flows into the query key.

Subjects get their own `SUBJECT_KEYS`. One shared `ACADEMIC_KEYS` object with
entities nested under it means invalidating a class refetches every subject.

### `definitions/class.schema.ts`

```ts
import { z } from 'zod';
import { classStatusLookup } from './class.lookup';

export const classFormSchema = z.object({
  name: z.string().min(1, 'Enter a class name'),
  numericLevel: z.number({ error: 'Enter a level' }).int().min(1).max(20),
  status: classStatusLookup.toZodEnum('Pick a status'),
  subjectIds: z.array(z.string()).min(1, 'Pick at least one subject'),
  remarks: z.string(),
});

export type ClassFormInput = z.input<typeof classFormSchema>;
export type ClassFormValues = z.output<typeof classFormSchema>;
```

`Field.Input type="number"` hands the form a number, or `undefined` when empty,
so the schema takes `z.number()` and the required message fires instead of a
coerced 0. `Form` seeds strings, enums and arrays with their empty value, so
`remarks` needs no `.optional()` to start blank.

---

## Class: API layer

### `api/class.api.ts`

```ts
import type { PaginatedResponse } from '@starter/shared';
import { apiCall, apiCallEmpty, apiCallPaginated } from '@/lib/api/api-call';
import type { ClassFormValues } from '../definitions/class.schema';
import type {
  ClassDetail,
  ClassFilters,
  ClassListItem,
} from '../definitions/class.types';

export const classApi = {
  getList: (
    filters: ClassFilters,
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<ClassListItem>> =>
    apiCallPaginated<ClassListItem>('/academic/classes', {
      params: filters,
      signal,
    }),

  getById: (id: string, signal?: AbortSignal) =>
    apiCall<ClassDetail>(`/academic/classes/${id}`, { signal }),

  create: (payload: ClassFormValues) =>
    apiCall<ClassDetail>('/academic/classes', {
      method: 'POST',
      body: payload,
    }),

  update: (id: string, payload: ClassFormValues) =>
    apiCall<ClassDetail>(`/academic/classes/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  remove: (id: string) =>
    apiCallEmpty(`/academic/classes/${id}`, { method: 'DELETE' }),
};
```

`apiCall` strips the `{ data }` envelope, so `getById` resolves to a
`ClassDetail`, never `{ data: ClassDetail }`. A list keeps its
`{ data, pagination }` shape as a `PaginatedResponse`, which `DataTable` reads
directly. A 204 resolves to `undefined`.

### `api/class.queries.ts`

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CLASS_KEYS } from '../definitions/class.constants';
import type { ClassFilters } from '../definitions/class.types';
import { classApi } from './class.api';

export function useClassList(filters: ClassFilters) {
  return useQuery({
    queryKey: CLASS_KEYS.list(filters),
    queryFn: ({ signal }) => classApi.getList(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useClass(id: string) {
  return useQuery({
    queryKey: CLASS_KEYS.detail(id),
    queryFn: ({ signal }) => classApi.getById(id, signal),
    enabled: Boolean(id),
  });
}
```

`keepPreviousData` keeps the previous page on screen, dimmed by `DataTable`'s
`isFetching`, while the next one loads, so the table does not empty out on every
page change. `staleTime` comes from `createQueryClient` (30 seconds).

The options object sits inside the hook. Lift it into a `classQueries.detail(id)`
factory the day you need `prefetchQuery`, `ensureQueryData`, or a typed
`getQueryData`. Until then the factory is a layer with one caller.

### `api/class.mutations.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CLASS_KEYS } from '../definitions/class.constants';
import type { ClassFormValues } from '../definitions/class.schema';
import { classApi } from './class.api';

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ClassFormValues) => classApi.create(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLASS_KEYS.lists() });
      toast.success('Class created');
    },
  });
}

export function useUpdateClass(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ClassFormValues) => classApi.update(id, values),
    onSuccess: (updated) => {
      queryClient.setQueryData(CLASS_KEYS.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: CLASS_KEYS.lists() });
      toast.success('Class updated');
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => classApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: CLASS_KEYS.detail(id) });
      void queryClient.invalidateQueries({ queryKey: CLASS_KEYS.lists() });
      toast.success('Class deleted');
    },
  });
}
```

Update patches the detail cache and marks lists stale, so every component
reading `useClass(id)` updates at once without a refetch. No `onError` anywhere:
the global `MutationCache` toast covers it, and stays quiet for errors a `Form`
already put on screen. `void` marks the invalidation as deliberately not
awaited, which Oxlint's `no-floating-promises` requires.

---

## Class: form component

Fields come from `@/systems/form`. The cross-entity read is
`subjectOptionsSource`, imported relatively from the sibling entity in this same
feature. No `index.ts` involved, and the picker shares the cache with every
other subject picker.

`initialData` being present is the only create versus edit branch. The page
decides where success goes, so the same component works in a `FormSheet`.

### `components/classes/class-form.tsx`

```tsx
import { Form, FormActions, FormError, formFields } from '@/systems/form';
import { useCreateClass, useUpdateClass } from '../../api/class.mutations';
import { subjectOptionsSource } from '../../api/subject.queries';
import { classStatusLookup } from '../../definitions/class.lookup';
import {
  classFormSchema,
  type ClassFormInput,
} from '../../definitions/class.schema';
import type { ClassDetail } from '../../definitions/class.types';

// Typed to the schema: a name or dependsOn it does not have fails tsc.
const Field = formFields(classFormSchema);

type ClassFormProps = {
  initialData?: ClassDetail;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ClassForm({
  initialData,
  onSuccess,
  onCancel,
}: ClassFormProps) {
  const createClass = useCreateClass();
  const updateClass = useUpdateClass(initialData?.id ?? '');
  const mutation = initialData ? updateClass : createClass;

  const defaultValues: Partial<ClassFormInput> = initialData
    ? {
        name: initialData.name,
        numericLevel: initialData.numericLevel,
        status: initialData.status,
        subjectIds: initialData.subjectIds,
        remarks: initialData.remarks ?? '',
      }
    : { status: classStatusLookup.keys.active };

  return (
    <Form
      schema={classFormSchema}
      defaultValues={defaultValues}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
        onSuccess();
      }}
      className="grid gap-5"
    >
      <Field.Input
        name="name"
        label="Class name"
        placeholder="Class 10"
        required
      />
      <Field.Input name="numericLevel" label="Level" type="number" required />
      <Field.Select
        name="status"
        label="Status"
        options={classStatusLookup.options}
        required
      />
      <Field.AsyncSelect
        name="subjectIds"
        label="Subjects"
        source={subjectOptionsSource}
        initialOptions={initialData?.subjects.map((subject) => ({
          value: subject.id,
          label: subject.name,
        }))}
        multi
        required
      />
      <Field.Textarea name="remarks" label="Remarks" />

      <FormError />
      <FormActions
        submitLabel={initialData ? 'Save changes' : 'Create class'}
        isPending={mutation.isPending}
        onCancel={onCancel}
      />
    </Form>
  );
}
```

`onSubmit` awaits `mutateAsync` and lets it throw. On a rejection `Form` maps
the `ApiError`'s field errors onto the fields and the rest into `<FormError />`,
and `onSuccess` never runs, so the typed values stay on screen. `mutate` instead
of `mutateAsync` would resolve straight away, lose the field mapping, and fall
back to a toast.

Mapping the API shape to the form shape happens here, not in the page.
`initialOptions` gives the picker the names of the subjects already chosen, so
the chips do not show raw ids before the first fetch.

---

## Class: pages

### `pages/classes/class-list-page.tsx`

Filter state comes from `useUrlFilters(CLASS_FILTER_SPEC)`. The page never
parses a search param, never casts one to an enum, and never resets paging by
hand: a write that narrows the result set clears the page cursor inside the
hook, so a new search cannot land the user on an empty page 7.

`isFiltered` is false while every field sits on its default, which is what keeps
"Clear filters" hidden on a pristine screen.

Columns are inline. Split them into `components/classes/class-columns.tsx` once
the array outgrows the page, roughly eight columns or a page over 150 lines.

```tsx
import { Plus, School, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { useConfirm } from '@/systems/confirmation';
import {
  FilterBar,
  FilterSelect,
  SearchInput,
  useUrlFilters,
} from '@/systems/filters';
import { createColumnHelper, DataTable, RowLink } from '@/systems/table';
import {
  EmptyState,
  ErrorState,
  LookupBadge,
  PageHeader,
  RowActions,
} from '@/systems/ui';
import { useDeleteClass } from '../../api/class.mutations';
import { useClassList } from '../../api/class.queries';
import { CLASS_FILTER_SPEC } from '../../definitions/class.constants';
import { classStatusLookup } from '../../definitions/class.lookup';
import type { ClassListItem } from '../../definitions/class.types';

const helper = createColumnHelper<ClassListItem>();

export default function ClassListPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { filters, setFilter, isFiltered, resetFilters } =
    useUrlFilters(CLASS_FILTER_SPEC);
  const { data, error, isLoadingError, isLoading, isFetching, refetch } =
    useClassList(filters);
  const deleteClass = useDeleteClass();

  const columns = helper.columns([
    helper.accessor('name', {
      header: 'Class',
      meta: { sticky: 'left', size: 200 },
      cell: (info) => (
        <RowLink to={`/academic/classes/${info.row.original.id}/edit`}>
          {info.getValue()}
        </RowLink>
      ),
    }),
    helper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <LookupBadge lookup={classStatusLookup} value={info.getValue()} />
      ),
    }),
    helper.accessor('sectionCount', {
      header: 'Sections',
      meta: { align: 'right', hideBelow: 'md' },
    }),
    helper.accessor('monthlyFee', {
      header: 'Monthly fee',
      meta: { align: 'right' },
      cell: (info) => formatMoney(info.getValue()),
    }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          subject={row.original.name}
          onEdit={() =>
            void navigate(`/academic/classes/${row.original.id}/edit`)
          }
          onDelete={() =>
            confirm({
              title: `Delete ${row.original.name}?`,
              description: 'Its sections and timetable go with it.',
              variant: 'destructive',
              onConfirm: () => deleteClass.mutateAsync(row.original.id),
            })
          }
        />
      ),
    }),
  ]);

  if (isLoadingError)
    return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader title="Classes" description="Every class this year." />

      <FilterBar
        isFiltered={isFiltered}
        onReset={resetFilters}
        actions={
          <Button onClick={() => void navigate('/academic/classes/new')}>
            <Plus />
            New class
          </Button>
        }
      >
        <SearchInput
          value={filters.search}
          onChange={(value) => setFilter('search', value)}
          placeholder="Search classes"
        />
        <FilterSelect
          value={filters.status}
          onChange={(value) => setFilter('status', value)}
          options={classStatusLookup.options}
          placeholder="Status"
          allLabel="All statuses"
        />
      </FilterBar>

      <DataTable
        label="Classes"
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        pagination={data?.pagination}
        onPageChange={(page) => setFilter('page', page)}
        onLimitChange={(limit) => setFilter('limit', limit)}
        emptyState={
          isFiltered ? (
            <EmptyState
              icon={School}
              title="No classes match"
              description="Nothing fits these filters."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  <X />
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={School}
              title="No classes yet"
              description="Create the first one."
            />
          )
        }
      />
    </>
  );
}
```

`SearchInput` owns its own debounce, so every list page in the app gets the same
behaviour. Changing several filters at once goes through `setFilters({ ... })`,
which is one navigation rather than three. Every filter write replaces the
current history entry, so filters never add history: Back leaves the list
rather than stepping through earlier searches.

A filtered list that comes back empty offers "Clear filters" right in the
empty state, which calls `resetFilters` and so clears paging too. An empty
list with nothing filtered offers the next step instead, never a clear.

The page owns the error state, and only for a load that never succeeded:
`isLoadingError`, not `isError`, so a failed refetch leaves the rows on screen
and the global query toast reports it. Loading and empty belong to
`DataTable`, so do not render an empty state above a table that already has
one. `onConfirm`
returns the delete's promise, so the confirm dialog shows its pending state and
stays open if the delete fails while the global toast reports why.

### `pages/classes/class-form-page.tsx`

One route file serving `/new` and `/:id/edit`. Splitting into two small
components inside the file keeps the create path free of loading checks and
avoids narrowing gymnastics on a possibly undefined record.

```tsx
import { useNavigate, useParams } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, NotFoundState, PageHeader } from '@/systems/ui';
import { useClass } from '../../api/class.queries';
import { ClassForm } from '../../components/classes/class-form';

export default function ClassFormPage() {
  const { id } = useParams();
  return id ? <EditClass id={id} /> : <CreateClass />;
}

function CreateClass() {
  const navigate = useNavigate();
  const back = () => void navigate('/academic/classes');

  return (
    <>
      <PageHeader title="New class" />
      <ClassForm onSuccess={back} onCancel={back} />
    </>
  );
}

function EditClass({ id }: { id: string }) {
  const navigate = useNavigate();
  const back = () => void navigate('/academic/classes');
  const {
    data: classItem,
    error,
    isLoadingError,
    isLoading,
    refetch,
  } = useClass(id);

  if (isLoadingError)
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading) {
    return (
      <output aria-label="Loading class" className="block">
        <Skeleton className="h-96 w-full max-w-2xl" />
      </output>
    );
  }
  if (!classItem) return <NotFoundState />;

  return (
    <>
      <PageHeader title={`Edit ${classItem.name}`} />
      <ClassForm initialData={classItem} onSuccess={back} onCancel={back} />
    </>
  );
}
```

A 404 from `getById` arrives as an `ApiError` with `status` 404. Show it as
`NotFoundState` by checking `error.status` before `ErrorState` when the screen
needs that distinction.

---

## Subject: the second entity

Same shape. Only the parts that differ from class are worth reading.

### `definitions/subject.types.ts`

```ts
import type { SubjectType } from './subject.lookup';

export type { SubjectType };

export type SubjectListItem = {
  id: string;
  name: string;
  code: string;
  type: SubjectType;
};

export type SubjectDetail = SubjectListItem & {
  description: string | null;
};

export type SubjectFilters = {
  search?: string;
  type?: SubjectType;
  page: number;
  limit: number;
};

export type SubjectOptionsQuery = {
  search?: string;
  page: number;
  limit: number;
};
```

### `definitions/subject.constants.ts`

```ts
import { defineUrlFilters, pagingSpec } from '@/systems/filters';
import { subjectTypeLookup } from './subject.lookup';
import type { SubjectFilters } from './subject.types';

export const SUBJECT_KEYS = {
  all: ['academic', 'subjects'] as const,
  lists: () => [...SUBJECT_KEYS.all, 'list'] as const,
  list: (filters: SubjectFilters) =>
    [...SUBJECT_KEYS.lists(), filters] as const,
  details: () => [...SUBJECT_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...SUBJECT_KEYS.details(), id] as const,
  options: () => [...SUBJECT_KEYS.all, 'options'] as const,
};

export const SUBJECT_FILTER_SPEC = defineUrlFilters<SubjectFilters>({
  search: {},
  type: { values: subjectTypeLookup.values },
  ...pagingSpec(20),
});
```

### `api/subject.api.ts`

```ts
import { apiCall, apiCallEmpty, apiCallPaginated } from '@/lib/api/api-call';
import type { SubjectFormValues } from '../definitions/subject.schema';
import type {
  SubjectDetail,
  SubjectFilters,
  SubjectListItem,
  SubjectOptionsQuery,
} from '../definitions/subject.types';

export const subjectApi = {
  getList: (filters: SubjectFilters, signal?: AbortSignal) =>
    apiCallPaginated<SubjectListItem>('/academic/subjects', {
      params: filters,
      signal,
    }),

  getOptions: (query: SubjectOptionsQuery, signal?: AbortSignal) =>
    apiCallPaginated<SubjectListItem>('/academic/subjects/options', {
      params: query,
      signal,
    }),

  getById: (id: string, signal?: AbortSignal) =>
    apiCall<SubjectDetail>(`/academic/subjects/${id}`, { signal }),

  create: (payload: SubjectFormValues) =>
    apiCall<SubjectDetail>('/academic/subjects', {
      method: 'POST',
      body: payload,
    }),

  update: (id: string, payload: SubjectFormValues) =>
    apiCall<SubjectDetail>(`/academic/subjects/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  remove: (id: string) =>
    apiCallEmpty(`/academic/subjects/${id}`, { method: 'DELETE' }),
};
```

### `api/subject.queries.ts`

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fromPaginated, type AsyncOptionsSource } from '@/systems/form';
import { SUBJECT_KEYS } from '../definitions/subject.constants';
import type { SubjectFilters } from '../definitions/subject.types';
import { subjectApi } from './subject.api';

export function useSubjectList(filters: SubjectFilters) {
  return useQuery({
    queryKey: SUBJECT_KEYS.list(filters),
    queryFn: ({ signal }) => subjectApi.getList(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSubject(id: string) {
  return useQuery({
    queryKey: SUBJECT_KEYS.detail(id),
    queryFn: ({ signal }) => subjectApi.getById(id, signal),
    enabled: Boolean(id),
  });
}

export const subjectOptionsSource: AsyncOptionsSource = {
  queryKey: SUBJECT_KEYS.options(),
  fetch: async ({ search, page, limit, signal }) =>
    fromPaginated(
      await subjectApi.getOptions(
        { search: search || undefined, page, limit },
        signal,
      ),
      (subject) => ({ value: subject.id, label: subject.name }),
    ),
};
```

`getOptions` is its own endpoint and its own key. Do not feed a picker from the
paginated list query or it will only ever show page one. The source is a plain
object, not a hook: `Field.AsyncSelect`, `FilterAsyncSelect` and a popover
`asyncSelect` each run it through `useInfiniteQuery`, searched and paged on the
server, keyed under `SUBJECT_KEYS.options()`. A cascade child reads its parents
from `parentValues` and passes them as params.

`subjectOptionsSource` is consumed by `class-form.tsx` and by any subject
filter. Same key prefix, one cache.

### `api/subject.mutations.ts`

Identical to class, with one addition. Creating or renaming a subject changes
what the class form picker shows, so the options key gets invalidated too.

```ts
export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SubjectFormValues) => subjectApi.create(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUBJECT_KEYS.lists() });
      void queryClient.invalidateQueries({ queryKey: SUBJECT_KEYS.options() });
      toast.success('Subject created');
    },
  });
}
```

`components/subjects/subject-form.tsx`, `pages/subjects/subject-list-page.tsx`
and `subject-form-page.tsx` follow the class files exactly, swapping the hooks,
lookup, spec, keys and paths. A subject form small enough for a side panel can
open in a `FormSheet` from the list page instead of its own route.

---

## Feature entry points

### `routes.tsx`

Grouped by entity, blank line between groups. Split into
`routes/class.routes.tsx` once this passes roughly five entities.

```tsx
import { BookOpen, School } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';

export const academicRoutes: AppRouteObject[] = [
  {
    path: 'academic/classes',
    handle: {
      title: 'Classes',
      icon: School,
      nav: { group: 'Academic', order: 0 },
      keywords: ['grades', 'sections'],
    },
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('./pages/classes/class-list-page')).default,
        }),
      },
      {
        path: 'new',
        handle: { title: 'New class', icon: School, roles: ['ADMIN'] },
        lazy: async () => ({
          Component: (await import('./pages/classes/class-form-page')).default,
        }),
      },
      {
        path: ':id/edit',
        handle: { title: 'Edit class', icon: School, roles: ['ADMIN'] },
        lazy: async () => ({
          Component: (await import('./pages/classes/class-form-page')).default,
        }),
      },
    ],
  },

  {
    path: 'academic/subjects',
    handle: {
      title: 'Subjects',
      icon: BookOpen,
      nav: { group: 'Academic', order: 1 },
    },
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('./pages/subjects/subject-list-page'))
            .default,
        }),
      },
    ],
  },
];
```

The parent route carries the list's handle and nav entry, so the breadcrumb on
the edit page reads "Classes > Edit class" and links back. `roles` on a child
narrows only that child; on a parent it binds every child. `'Academic'` must be
added to `NAV_GROUPS` in `app/config.ts`.

### `index.ts`

Only what actually leaves the feature. Right now that is the route array for
the app router. Add an export when a second feature needs it, not before.

```ts
export { academicRoutes } from './routes';
```

Later, when the students feature needs a class picker:

```ts
export { classOptionsSource } from './api/class.queries';
export type { ClassListItem, ClassStatus } from './definitions/class.types';
```

### `app/router.ts`

Composition only. Every feature contributes an array to `pages`, or to
`barePages` for a screen outside the shell (login); `buildRoutes` wraps them
in the root, layout and page levels.

```ts
import { createBrowserRouter } from 'react-router';
import { academicRoutes } from '@/features/academic';
import { authRoutes } from '@/features/auth';
import { homeRoutes } from '@/features/home';
import type { AppRouteObject } from '@/systems/router';
import { devRoutes } from './dev/dev-routes';
import { buildRoutes } from './routes';

const pages: AppRouteObject[] = [...homeRoutes, ...academicRoutes];
const barePages: AppRouteObject[] = [...authRoutes];

export function createAppRouter() {
  return createBrowserRouter(
    buildRoutes(
      import.meta.env.DEV ? [...pages, ...devRoutes] : pages,
      barePages,
    ),
  );
}
```

Adding a feature is one import and one spread in `pages` or `barePages`.

---

## Shared pieces this feature leans on

Read these when something upstream needs changing. Do not reimplement any of
them inside a feature.

### `lib/api/api-call.ts`

The single HTTP entry point, on the axios instance in `lib/api/api.ts`
(`baseURL` is `VITE_API_BASE_URL` plus `/api`; the Vite dev server proxies
`/api` to the API).

```ts
export type ApiCallOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: QueryParams;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function apiCall<T>(
  endpoint: string,
  options?: ApiCallOptions,
): Promise<T>;
export async function apiCallPaginated<T, S = undefined>(
  endpoint: string,
  options?: ApiCallOptions,
): Promise<PaginatedResponse<T, S>>;
```

`apiCall` unwraps `{ data }`. `apiCallPaginated` checks for `data` as an array
and a valid `pagination`. Either one throws an `ApiError` with code
`BAD_RESPONSE` for a body that does not match.

### `lib/api/api-error.ts`

`ApiError` (`status`, `code`, `message`, `fieldErrors`), `isApiError`, and
`getErrorMessage`, which keeps a 4xx message and gives safe copy for 5xx,
network and malformed responses. `ErrorState` and `Form` both use it.

### `systems/api/query-client.ts`

`createQueryClient()` sets the defaults so features never repeat them (queries:
`staleTime` 30 seconds, up to two retries except on a 4xx, refetch on window
focus; mutations: no retry), plus one global error toast so no mutation fails
silently. That toast skips a mutation with its own `onError` or
`meta: { handledError: true }`, and any error something already showed. A
per-call `mutate(values, { onError })` does not skip it. Its `QueryCache` toasts a refetch that fails while
data is on screen, once per message; a first load that fails is left to the
page's `ErrorState`.

### `systems/ui/lookup-badge.tsx`

The one place a lookup value becomes badge JSX, so features never write a
per-enum badge component.

```tsx
<LookupBadge lookup={classStatusLookup} value={row.status} showIcon={false} />
```

### `systems/filters/`

`defineUrlFilters` builds the spec, `useUrlFilters` reads and writes it. Between
them they own param aliasing, enum whitelisting, number clamping, list params,
page reset on narrowing writes, and `isFiltered`. A page never touches
`useSearchParams` directly.

The hook returns `filters`, `defaults`, `criteria`, `isFiltered`, `setFilter`,
`setFilters`, `applyCriteria`, `resetFilters` and `searchParams`. `criteria` is
the slice a saved preset stores, which is the filters minus anything marked
`transient`.

---

## What was deliberately not built

Each of these is a real pattern with a real trigger. Adding it before the
trigger fires is what makes a codebase hard to read.

| Not built                              | Build it when                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `components/classes/class-table.tsx`   | never, if it only forwards props to `DataTable`. A wrapper with no defaults and no logic is a rename                                   |
| `components/classes/class-columns.tsx` | the column array outgrows the page, roughly eight columns or a page over 150 lines                                                     |
| `hooks/use-class-filters.ts`           | never. `useUrlFilters` covers it, and a per-entity wrapper around a shared hook adds a name and nothing else                           |
| `classQueries` options factory         | you need `prefetchQuery`, `ensureQueryData`, a route loader, or a typed `getQueryData`                                                 |
| `pages/classes/class-detail-page.tsx`  | there is something to show that the edit form does not already show                                                                    |
| `class-status-badge.tsx`               | never. `LookupBadge` plus the lookup covers every enum in the app                                                                      |
| A `sections` entity in this folder     | it has its own routes and its own cache, and something in academic imports its types. If neither is true it belongs in its own feature |

## Build order

One entity end to end, then the next. Class types, class constants, class api,
class queries, class mutations, class form, class pages, wire the routes, check
it works in the browser. Then subject.

Not layer by layer. Writing every types file first means finding out the
`ClassFilters` shape is wrong six files later, in four places at once.
