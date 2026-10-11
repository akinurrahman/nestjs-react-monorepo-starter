import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_PAGE_LIMIT, type PaginationMeta } from '@starter/shared';
import { defineUrlFilters, pagingSpec, useUrlFilters } from '@/systems/filters';
import { renderWithRouter } from '@/test/render-with-router';
import { createColumnHelper } from './columns';
import { DataTable } from './data-table';
import { DataTablePagination } from './data-table-pagination';

function meta(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  const page = overrides.page ?? 1;
  const limit = overrides.limit ?? 20;
  const total = overrides.total ?? 200;
  const totalPages = overrides.totalPages ?? Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    ...overrides,
  };
}

const nav = () => screen.getByRole('navigation', { name: 'Pagination' });
const button = (name: string) => within(nav()).getByRole('button', { name });
const limitSelect = () =>
  screen.getByRole('combobox', { name: 'Rows per page' });

describe('DataTablePagination', () => {
  it('shows the row range with locale grouping', () => {
    render(
      <DataTablePagination
        pagination={meta({ page: 3, limit: 50, total: 123456 })}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/^Showing/)).toHaveTextContent(
      'Showing 101-150 of 1,23,456',
    );
    expect(button('Page 2,470')).toBeInTheDocument();
  });

  it('ends the range at the total on the last page', () => {
    render(
      <DataTablePagination
        pagination={meta({ page: 3, limit: 20, total: 45 })}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/^Showing/)).toHaveTextContent(
      'Showing 41-45 of 45',
    );
  });

  it('renders nothing when there are no rows', () => {
    const { container } = render(
      <DataTablePagination
        pagination={meta({ total: 0, totalPages: 0 })}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('disables previous on the first page and next on the last', () => {
    const { rerender } = render(
      <DataTablePagination
        pagination={meta({ page: 1 })}
        onPageChange={vi.fn()}
      />,
    );
    expect(button('Previous page')).toBeDisabled();
    expect(button('Next page')).toBeEnabled();

    rerender(
      <DataTablePagination
        pagination={meta({ page: 10 })}
        onPageChange={vi.fn()}
      />,
    );
    expect(button('Previous page')).toBeEnabled();
    expect(button('Next page')).toBeDisabled();
  });

  it('moves a page at a time and jumps to a numbered page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <DataTablePagination
        pagination={meta({ page: 5 })}
        onPageChange={onPageChange}
      />,
    );

    await user.click(button('Previous page'));
    await user.click(button('Next page'));
    await user.click(button('Page 10'));

    expect(onPageChange.mock.calls).toEqual([[4], [6], [10]]);
  });

  it('marks only the current page with aria-current', () => {
    render(
      <DataTablePagination
        pagination={meta({ page: 5 })}
        onPageChange={vi.fn()}
      />,
    );

    expect(button('Page 5')).toHaveAttribute('aria-current', 'page');
    expect(button('Page 4')).not.toHaveAttribute('aria-current');
  });

  it('gives every page control a touch-size target', () => {
    render(
      <DataTablePagination
        pagination={meta({ page: 5 })}
        onPageChange={vi.fn()}
      />,
    );

    within(nav())
      .getAllByRole('button')
      .forEach((control) =>
        expect(control).toHaveClass('size-10', 'sm:size-8'),
      );
  });
});

describe('DataTablePagination rows per page', () => {
  it('is hidden without onLimitChange', () => {
    render(<DataTablePagination pagination={meta()} onPageChange={vi.fn()} />);

    expect(
      screen.queryByRole('combobox', { name: 'Rows per page' }),
    ).not.toBeInTheDocument();
  });

  it('offers 20, 50 and 100 by default and calls onLimitChange with the pick', async () => {
    const user = userEvent.setup();
    const onLimitChange = vi.fn();
    render(
      <DataTablePagination
        pagination={meta()}
        onPageChange={vi.fn()}
        onLimitChange={onLimitChange}
      />,
    );

    expect(limitSelect()).toHaveTextContent('20');
    await user.click(limitSelect());
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      '20',
      '50',
      '100',
    ]);

    await user.click(screen.getByRole('option', { name: '50' }));

    expect(onLimitChange).toHaveBeenCalledWith(50);
  });

  it('never offers a limit above MAX_PAGE_LIMIT', async () => {
    const user = userEvent.setup();
    render(
      <DataTablePagination
        pagination={meta()}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        limitOptions={[10, MAX_PAGE_LIMIT, MAX_PAGE_LIMIT + 1, 500]}
      />,
    );

    await user.click(limitSelect());
    const options = await screen.findAllByRole('option');

    expect(options.map((option) => Number(option.textContent))).toEqual([
      10,
      20,
      MAX_PAGE_LIMIT,
    ]);
  });
});

type Row = { id: string; name: string };
type ListFilters = { page: number; limit: number };

const LIST_SPEC = defineUrlFilters<ListFilters>({ ...pagingSpec(20) });

const helper = createColumnHelper<Row>();
const COLUMNS = helper.columns([helper.accessor('name', { header: 'Name' })]);
const ROWS: Row[] = [{ id: 'r-1', name: 'One' }];

function ListPage() {
  const { filters, setFilter } = useUrlFilters(LIST_SPEC);
  return (
    <DataTable
      columns={COLUMNS}
      data={ROWS}
      label="Rows"
      pagination={meta({ page: filters.page, limit: filters.limit })}
      onPageChange={(page) => setFilter('page', page)}
      onLimitChange={(limit) => setFilter('limit', limit)}
    />
  );
}

describe('DataTable pagination wiring', () => {
  it('resets to page 1 when the limit changes through a filter spec', async () => {
    const user = userEvent.setup();
    const { searchParams } = renderWithRouter(<ListPage />, {
      url: '/?page=3&limit=20',
    });

    await user.click(limitSelect());
    await user.click(await screen.findByRole('option', { name: '50' }));

    await waitFor(() => expect(searchParams().get('limit')).toBe('50'));
    expect(searchParams().has('page')).toBe(false);
  });

  it('clamps a page past the end to the last page, once', () => {
    const onPageChange = vi.fn();
    const stale = meta({ page: 7, total: 45, limit: 20 });
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        data={[]}
        label="Rows"
        pagination={stale}
        onPageChange={onPageChange}
      />,
    );

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(3);

    rerender(
      <DataTable
        columns={COLUMNS}
        data={[]}
        label="Rows"
        pagination={{ ...stale }}
        onPageChange={(page) => onPageChange(page)}
      />,
    );

    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  it('does not clamp a page in range or an empty result', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        label="Rows"
        pagination={meta({ page: 3, total: 45 })}
        onPageChange={onPageChange}
      />,
    );

    rerender(
      <DataTable
        columns={COLUMNS}
        data={[]}
        label="Rows"
        pagination={meta({ page: 2, total: 0, totalPages: 0 })}
        onPageChange={onPageChange}
      />,
    );

    expect(onPageChange).not.toHaveBeenCalled();
  });
});
