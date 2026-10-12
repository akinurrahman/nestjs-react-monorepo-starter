import { useMutation, useQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { apiCall, apiCallPaginated } from '@/lib/api/api-call';
import { conflict, notFound, validationFailed } from '@/test/error-fixtures';
import { server } from '@/test/msw-server';
import { renderWithQuery } from '@/test/render-with-query';
import { Form, FormError, formFields } from '@/systems/form';
import { createColumnHelper, DataTable } from '@/systems/table';
import { ErrorState } from '@/systems/ui';

function countRequests(status: number, body: object) {
  const count = { value: 0 };
  server.use(
    http.all('/api/thing', () => {
      count.value += 1;
      return HttpResponse.json(body, { status });
    }),
  );
  return count;
}

const unavailable = {
  statusCode: 503,
  code: 'SERVICE_UNAVAILABLE',
  message: 'Service unavailable',
};

function Thing() {
  const query = useQuery({
    queryKey: ['thing'],
    queryFn: ({ signal }) => apiCall<string>('/thing', { signal }),
  });
  if (query.isError) return <p>failed</p>;
  return <p>{query.isSuccess ? 'loaded' : 'loading'}</p>;
}

type Person = { id: string; name: string };

const helper = createColumnHelper<Person>();
const COLUMNS = helper.columns([helper.accessor('name', { header: 'Name' })]);

// The reference list page's query states: ErrorState only when nothing
// loaded, the table otherwise.
function PeoplePage() {
  const { data, error, isLoadingError, isLoading, isFetching, refetch } =
    useQuery({
      queryKey: ['people', 'list'],
      queryFn: ({ signal }) => apiCallPaginated<Person>('/people', { signal }),
    });

  if (isLoadingError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <DataTable
      label="People"
      columns={COLUMNS}
      data={data?.data ?? []}
      isLoading={isLoading}
      isFetching={isFetching}
    />
  );
}

function servePeopleList() {
  server.use(
    http.get('/api/people', () =>
      HttpResponse.json({
        data: [{ id: 'p-1', name: 'Ada' }],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
        },
      }),
    ),
  );
}

function failPeopleList() {
  server.use(
    http.get('/api/people', () =>
      HttpResponse.json(unavailable, { status: 503 }),
    ),
  );
}

function SaveButton({
  onError,
  callOnError,
  handledError,
}: {
  onError?: () => void;
  // Passed to mutate() for this call only, not to useMutation.
  callOnError?: () => void;
  handledError?: boolean;
}) {
  const mutation = useMutation({
    mutationFn: () => apiCall<void>('/thing', { method: 'POST' }),
    onError,
    meta: handledError ? { handledError } : undefined,
  });
  return (
    <>
      <button
        type="button"
        onClick={() => mutation.mutate(undefined, { onError: callOnError })}
      >
        Save
      </button>
      {mutation.isError ? <p>save failed</p> : null}
    </>
  );
}

function CaughtSaveButton({ onCaught }: { onCaught: () => void }) {
  const mutation = useMutation({
    mutationFn: () => apiCall<void>('/thing', { method: 'POST' }),
  });
  return (
    <button
      type="button"
      onClick={() => void mutation.mutateAsync().catch(onCaught)}
    >
      Save
    </button>
  );
}

const userSchema = z.object({ email: z.string(), name: z.string() });
const UserField = formFields(userSchema);

function SaveForm() {
  const mutation = useMutation({
    mutationFn: (values: z.output<typeof userSchema>) =>
      apiCall<void>('/thing', { method: 'POST', body: values }),
  });
  return (
    <Form
      schema={userSchema}
      onSubmit={(values) => mutation.mutateAsync(values)}
    >
      <UserField.Input name="email" label="Email" />
      <UserField.Input name="name" label="Name" />
      <FormError />
      <button type="submit">Save</button>
    </Form>
  );
}

const toasts = () => document.querySelectorAll('[data-sonner-toast]');

// The global mutation toast waits one macrotask after the failure, and timers
// run in the order they were set. Called once the failure is on screen, so
// that timer is already queued: this one runs after it, and an absent toast
// is absent, not late. Ordering, not a duration.
const afterDeferredToast = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe('query retries', () => {
  it('does not retry a 4xx', async () => {
    const count = countRequests(404, notFound);
    renderWithQuery(<Thing />);

    // The error shows only once retrying is over, so no request can follow.
    expect(await screen.findByText('failed')).toBeInTheDocument();
    expect(count.value).toBe(1);
  });

  it('retries a 503 twice', async () => {
    const count = countRequests(503, unavailable);
    renderWithQuery(<Thing />);

    expect(await screen.findByText('failed')).toBeInTheDocument();
    expect(count.value).toBe(3);
  });
});

describe('query errors', () => {
  it('keeps loaded rows when a refetch fails, and toasts once', async () => {
    servePeopleList();
    const { client } = renderWithQuery(<PeoplePage />);
    expect(
      await screen.findByRole('cell', { name: 'Ada' }),
    ).toBeInTheDocument();

    failPeopleList();
    await act(() => client.refetchQueries({ queryKey: ['people'] }));

    expect(
      await screen.findByText(
        'Something went wrong on our side. Please try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await afterDeferredToast();
    expect(toasts()).toHaveLength(1);
  });

  it('shows ErrorState, not a toast, when the first load fails', async () => {
    failPeopleList();
    renderWithQuery(<PeoplePage />);

    // The QueryCache reports synchronously, before the error reaches the page.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load this data",
    );
    expect(toasts()).toHaveLength(0);
  });
});

describe('mutation error toast', () => {
  it('toasts once', async () => {
    const user = userEvent.setup();
    const count = countRequests(409, conflict);
    renderWithQuery(<SaveButton />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(conflict.message)).toBeInTheDocument();
    await afterDeferredToast();
    expect(toasts()).toHaveLength(1);
    expect(count.value).toBe(1);
  });

  // Pins what afterDeferredToast relies on: a deferral longer than one
  // macrotask would let every "no toast" check below pass too early.
  it('shows the toast within one macrotask of the failure', async () => {
    const user = userEvent.setup();
    countRequests(409, conflict);
    renderWithQuery(<SaveButton />);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('save failed')).toBeInTheDocument();
    await afterDeferredToast();

    expect(toasts()).toHaveLength(1);
  });

  it('skips a mutation with its own onError', async () => {
    const user = userEvent.setup();
    countRequests(409, conflict);
    const onError = vi.fn();
    renderWithQuery(<SaveButton onError={onError} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await afterDeferredToast();
    expect(toasts()).toHaveLength(0);
  });

  it('skips a mutation that opts out with meta', async () => {
    const user = userEvent.setup();
    countRequests(409, conflict);
    renderWithQuery(<SaveButton handledError />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('save failed')).toBeInTheDocument();
    await afterDeferredToast();
    expect(toasts()).toHaveLength(0);
  });

  it('still toasts, once, beside a per-call onError', async () => {
    const user = userEvent.setup();
    countRequests(409, conflict);
    const callOnError = vi.fn();
    renderWithQuery(<SaveButton callOnError={callOnError} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(callOnError).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(conflict.message)).toBeInTheDocument();
    await afterDeferredToast();
    expect(toasts()).toHaveLength(1);
  });

  it('toasts a rejection a caller catches outside any form', async () => {
    const user = userEvent.setup();
    countRequests(409, conflict);
    const onCaught = vi.fn();
    renderWithQuery(<CaughtSaveButton onCaught={onCaught} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onCaught).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(conflict.message)).toBeInTheDocument();
    expect(toasts()).toHaveLength(1);
  });

  it('skips an error a form shows on its fields', async () => {
    const user = userEvent.setup();
    countRequests(400, validationFailed);
    renderWithQuery(<SaveForm />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Invalid email address'),
    ).toBeInTheDocument();
    await afterDeferredToast();
    expect(toasts()).toHaveLength(0);
  });

  it('skips an error a form shows as its root message', async () => {
    const user = userEvent.setup();
    countRequests(409, conflict);
    renderWithQuery(<SaveForm />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      conflict.message,
    );
    await afterDeferredToast();
    expect(toasts()).toHaveLength(0);
  });
});
