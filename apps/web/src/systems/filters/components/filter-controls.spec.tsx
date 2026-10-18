import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { peopleSource, servePeople } from '@/test/people-source';
import { renderWithRouter } from '@/test/render-with-router';
import {
  defineUrlFilters,
  pagingSpec,
  useUrlFilters,
} from '../hooks/use-url-filters';
import { FilterAsyncSelect } from './filter-async-select';
import { FilterBar } from './filter-bar';
import { FilterSelect } from './filter-select';
import { SearchInput } from './search-input';

const DEBOUNCE_MS = 20;

type Filters = {
  search?: string;
  status?: 'open' | 'closed';
  owner?: string;
  page: number;
  limit: number;
};

const SPEC = defineUrlFilters<Filters>({
  search: {},
  status: { values: ['open', 'closed'] },
  owner: {},
  ...pagingSpec(20),
});

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

function Toolbar() {
  const { filters, setFilter, isFiltered, resetFilters } = useUrlFilters(SPEC);

  return (
    <FilterBar
      isFiltered={isFiltered}
      onReset={resetFilters}
      actions={<button type="button">New ticket</button>}
    >
      <SearchInput
        value={filters.search}
        onChange={(value) => setFilter('search', value)}
        placeholder="Search tickets"
        debounceMs={DEBOUNCE_MS}
      />
      <FilterSelect
        value={filters.status}
        onChange={(value) => setFilter('status', value)}
        options={STATUS_OPTIONS}
        placeholder="Status"
      />
      <FilterAsyncSelect
        value={filters.owner}
        onChange={(value) => setFilter('owner', value)}
        source={peopleSource}
        placeholder="Owner"
        allLabel="All owners"
        debounceMs={DEBOUNCE_MS}
      />
    </FilterBar>
  );
}

function renderToolbar(url = '/') {
  return {
    ...renderWithRouter(<Toolbar />, { url, withQuery: true }),
    user: userEvent.setup(),
  };
}

const searchBox = () =>
  screen.getByRole('searchbox', { name: 'Search tickets' });

describe('filter controls', () => {
  it('name every control after its placeholder', () => {
    renderToolbar();

    expect(searchBox()).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Owner' })).toBeVisible();
  });
});

describe('FilterSelect', () => {
  it('writes the picked value and sends no param for "All"', async () => {
    const { user, searchParams } = renderToolbar('/?page=3');
    const status = screen.getByRole('combobox', { name: 'Status' });

    expect(status).toHaveTextContent('All');
    await user.click(status);
    await user.click(await screen.findByRole('option', { name: 'Closed' }));
    await waitFor(() => expect(searchParams().get('status')).toBe('closed'));
    expect(searchParams().has('page')).toBe(false);

    await user.click(status);
    await user.click(await screen.findByRole('option', { name: 'All' }));

    await waitFor(() => expect(searchParams().has('status')).toBe(false));
    expect(searchParams().toString()).not.toContain('__all');
  });

  it('has no "All" entry when not clearable', async () => {
    const user = userEvent.setup();
    render(
      <FilterSelect
        value="open"
        onChange={vi.fn()}
        options={STATUS_OPTIONS}
        placeholder="Status"
        clearable={false}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Status' }));

    expect(
      (await screen.findAllByRole('option')).map((o) => o.textContent),
    ).toEqual(['Open', 'Closed']);
  });
});

describe('FilterAsyncSelect', () => {
  it('writes the picked value and sends no param for "All"', async () => {
    const requests = servePeople();
    const { user, searchParams } = renderToolbar();
    const owner = screen.getByRole('combobox', { name: 'Owner' });

    expect(owner).toHaveTextContent('All owners');
    await user.click(owner);
    await user.click(await screen.findByRole('option', { name: 'Alice' }));
    await waitFor(() => expect(searchParams().get('owner')).toBe('alice'));

    await user.click(owner);
    await user.click(await screen.findByRole('option', { name: 'All owners' }));

    await waitFor(() => expect(searchParams().has('owner')).toBe(false));
    expect(searchParams().toString()).not.toContain('__all');
    expect(requests.every((params) => !params.has('owner'))).toBe(true);
  });
});

// The debounce runs on the fake clock, so a slow run cannot let it fire
// between keystrokes or before the "not yet" assertion. Keystrokes go
// through fireEvent: user-event waits on a real setTimeout that only a
// global jest would advance.
function typeEachKey(box: HTMLElement, text: string, from = '') {
  for (let end = 1; end <= text.length; end += 1) {
    fireEvent.change(box, { target: { value: from + text.slice(0, end) } });
  }
}

describe('SearchInput', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes once, after the person stops typing', async () => {
    const { searchParams, navigations } = renderToolbar();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    typeEachKey(searchBox(), 'printer');
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1));
    expect(searchParams().has('search')).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(searchParams().get('search')).toBe('printer');
    expect(navigations()).toBe(1);
  });

  it('stops at maxLength', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput onChange={onChange} maxLength={5} />);

    await user.type(screen.getByRole('searchbox'), 'printers');

    expect(screen.getByRole('searchbox')).toHaveValue('print');
  });

  it('starts a new search on page 1', async () => {
    const { user, searchParams } = renderToolbar('/?page=4&status=open');

    await user.type(searchBox(), 'printer');

    await waitFor(() => expect(searchParams().get('search')).toBe('printer'));
    expect(searchParams().has('page')).toBe(false);
    expect(searchParams().get('status')).toBe('open');
  });

  it('shows a value that changes from outside', async () => {
    const { navigate } = renderToolbar('/?search=printer');
    expect(searchBox()).toHaveValue('printer');

    await navigate('/?search=scanner');
    expect(searchBox()).toHaveValue('scanner');

    await navigate(-1);
    expect(searchBox()).toHaveValue('printer');

    await navigate('/');
    expect(searchBox()).toHaveValue('');
  });

  it('keeps typing that its own late write would overwrite', async () => {
    const onChange = vi.fn();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const search = (value?: string) => (
      <SearchInput
        value={value}
        onChange={onChange}
        placeholder="Search"
        debounceMs={DEBOUNCE_MS}
      />
    );
    const { rerender } = render(search());
    const box = screen.getByRole('searchbox', { name: 'Search' });

    typeEachKey(box, 'pr');
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    expect(onChange).toHaveBeenLastCalledWith('pr');
    typeEachKey(box, 'int', 'pr');
    // The write of "pr" lands only now, mid-debounce of "print".
    rerender(search('pr'));

    expect(box).toHaveValue('print');
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
    expect(onChange).toHaveBeenLastCalledWith('print');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('clears at once from the clear button and from Escape', async () => {
    const { user, searchParams, navigations } =
      renderToolbar('/?search=printer');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(searchBox()).toHaveValue('');
    expect(searchParams().has('search')).toBe(false);
    expect(navigations()).toBe(1);

    await user.type(searchBox(), 'scanner');
    await waitFor(() => expect(searchParams().get('search')).toBe('scanner'));
    await user.keyboard('{Escape}');

    expect(searchBox()).toHaveValue('');
    expect(searchParams().has('search')).toBe(false);
  });
});

describe('FilterBar', () => {
  it('offers to clear only once something is filtered', async () => {
    const { user, searchParams } = renderToolbar('/?page=2&tab=notes');
    expect(
      screen.queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New ticket' })).toBeVisible();

    const status = screen.getByRole('combobox', { name: 'Status' });
    await user.click(status);
    await user.click(await screen.findByRole('option', { name: 'Open' }));
    await user.click(
      await screen.findByRole('button', { name: 'Clear filters' }),
    );

    await waitFor(() => expect(searchParams().toString()).toBe('tab=notes'));
    expect(
      screen.queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeInTheDocument();
  });
});
