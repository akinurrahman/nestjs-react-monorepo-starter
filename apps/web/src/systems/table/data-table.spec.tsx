import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { Routes, Route } from 'react-router';
import { renderWithRouter } from '@/test/render-with-router';
import { createColumnHelper, type ColumnDef } from './columns';
import { DataTable } from './data-table';
import { RowLink } from './row-link';

type Person = { id: string; name: string; salary: number };

const PEOPLE: Person[] = [
  { id: 'p-1', name: 'Ada', salary: 100 },
  { id: 'p-2', name: 'Grace', salary: 200 },
];

const helper = createColumnHelper<Person>();

const COLUMNS = helper.columns([
  helper.accessor('name', { header: 'Name' }),
  helper.accessor('salary', { header: 'Salary', meta: { align: 'right' } }),
]);

const LABEL = 'People';

const table = () => screen.getByRole('table', { name: LABEL });
const bodyRows = () => within(table()).getAllByRole('row').slice(1);
const skeletons = () =>
  table().querySelectorAll('tbody [data-slot="skeleton"]');

describe('DataTable loading', () => {
  it('shows skeleton rows on the first load', () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={[]}
        label={LABEL}
        isLoading
        skeletonRows={3}
      />,
    );

    expect(bodyRows()).toHaveLength(3);
    expect(skeletons()).toHaveLength(6);
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
  });

  it('does not dim the skeleton, though a first load is also fetching', () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={[]}
        label={LABEL}
        isLoading
        isFetching
      />,
    );

    expect(skeletons().length).toBeGreaterThan(0);
    expect(table().querySelector('tbody')).not.toHaveClass('opacity-60');
  });

  it('keeps the rows, dimmed, while fetching with data', () => {
    render(
      <DataTable columns={COLUMNS} data={PEOPLE} label={LABEL} isFetching />,
    );

    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument();
    expect(skeletons()).toHaveLength(0);
    expect(table().querySelector('tbody')).toHaveClass('opacity-60');
  });

  it('does not dim settled rows', () => {
    render(<DataTable columns={COLUMNS} data={PEOPLE} label={LABEL} />);

    expect(table().querySelector('tbody')).not.toHaveClass('opacity-60');
  });

  it('is busy while fetching and not after', () => {
    const { rerender } = render(
      <DataTable columns={COLUMNS} data={PEOPLE} label={LABEL} isFetching />,
    );
    expect(table()).toHaveAttribute('aria-busy', 'true');

    rerender(<DataTable columns={COLUMNS} data={PEOPLE} label={LABEL} />);
    expect(table()).toHaveAttribute('aria-busy', 'false');
  });
});

describe('DataTable empty state', () => {
  it('says "No results" by default', () => {
    render(<DataTable columns={COLUMNS} data={[]} label={LABEL} />);

    const cell = screen.getByRole('cell', { name: 'No results' });
    expect(cell).toHaveAttribute('colspan', '2');
  });

  it('renders a custom empty state', () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={[]}
        label={LABEL}
        emptyState={<p>Nobody hired yet</p>}
      />,
    );

    expect(screen.getByText('Nobody hired yet')).toBeInTheDocument();
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
  });

  it('is not shown while loading', () => {
    render(<DataTable columns={COLUMNS} data={[]} label={LABEL} isLoading />);

    expect(screen.queryByText('No results')).not.toBeInTheDocument();
  });
});

describe('DataTable rows', () => {
  it('is named by its label', () => {
    render(<DataTable columns={COLUMNS} data={PEOPLE} label={LABEL} />);

    expect(table()).toBeInTheDocument();
  });

  // Identity of the DOM row is what a key controls: keyed by id, the node
  // follows its record when the order changes. Keyed by index, it stays put.
  it('keys rows by the id field by default', () => {
    const { rerender } = render(
      <DataTable columns={COLUMNS} data={PEOPLE} label={LABEL} />,
    );
    const adaRow = screen.getByRole('cell', { name: 'Ada' }).closest('tr');

    rerender(
      <DataTable
        columns={COLUMNS}
        data={[...PEOPLE].reverse()}
        label={LABEL}
      />,
    );

    expect(screen.getByRole('cell', { name: 'Ada' }).closest('tr')).toBe(
      adaRow,
    );
    expect(bodyRows()[1]).toBe(adaRow);
  });

  it('keys rows by a custom getRowId', () => {
    type Unkeyed = { code: string };
    const unkeyedColumns: ColumnDef<Unkeyed>[] = [
      { accessorKey: 'code', header: 'Code' },
    ];
    const rows: Unkeyed[] = [{ code: 'A' }, { code: 'B' }];
    const getRowId = (row: Unkeyed) => row.code;

    const { rerender } = render(
      <DataTable
        columns={unkeyedColumns}
        data={rows}
        label={LABEL}
        getRowId={getRowId}
      />,
    );
    const rowA = screen.getByRole('cell', { name: 'A' }).closest('tr');

    rerender(
      <DataTable
        columns={unkeyedColumns}
        data={[...rows].reverse()}
        label={LABEL}
        getRowId={getRowId}
      />,
    );

    expect(screen.getByRole('cell', { name: 'A' }).closest('tr')).toBe(rowA);
  });

  it('keys rows by index when they have no id', () => {
    type Unkeyed = { code: string };
    const unkeyedColumns: ColumnDef<Unkeyed>[] = [
      { accessorKey: 'code', header: 'Code' },
    ];
    const rows: Unkeyed[] = [{ code: 'A' }, { code: 'B' }];

    const { rerender } = render(
      <DataTable columns={unkeyedColumns} data={rows} label={LABEL} />,
    );
    const firstRow = bodyRows()[0];

    rerender(
      <DataTable
        columns={unkeyedColumns}
        data={[...rows].reverse()}
        label={LABEL}
      />,
    );

    expect(bodyRows()[0]).toBe(firstRow);
    expect(firstRow).toHaveTextContent('B');
  });
});

describe('DataTable column meta', () => {
  const META_COLUMNS = helper.columns([
    helper.accessor('name', {
      header: 'Name',
      meta: { sticky: 'left', size: 160 },
    }),
    helper.accessor('salary', {
      header: 'Salary',
      meta: { align: 'right', hideBelow: 'md' },
    }),
  ]);

  const headerCell = (name: string) =>
    screen.getByRole('columnheader', { name });

  function columnCells(index: number) {
    return bodyRows().map((row) => row.querySelectorAll('td')[index]);
  }

  it('aligns the header, cells and skeleton together', () => {
    const { rerender } = render(
      <DataTable columns={META_COLUMNS} data={PEOPLE} label={LABEL} />,
    );

    expect(headerCell('Salary')).toHaveClass('text-right');
    columnCells(1).forEach((cell) => expect(cell).toHaveClass('text-right'));
    expect(headerCell('Name')).toHaveClass('text-left');

    rerender(
      <DataTable columns={META_COLUMNS} data={[]} label={LABEL} isLoading />,
    );
    columnCells(1).forEach((cell) =>
      expect(cell?.querySelector('[data-slot="skeleton"]')).toHaveClass(
        'ml-auto',
      ),
    );
  });

  it('hides the header, cells and skeleton below the breakpoint', () => {
    const { rerender } = render(
      <DataTable columns={META_COLUMNS} data={PEOPLE} label={LABEL} />,
    );

    expect(headerCell('Salary')).toHaveClass('hidden', 'md:table-cell');
    columnCells(1).forEach((cell) =>
      expect(cell).toHaveClass('hidden', 'md:table-cell'),
    );
    expect(headerCell('Name')).not.toHaveClass('hidden');

    rerender(
      <DataTable columns={META_COLUMNS} data={[]} label={LABEL} isLoading />,
    );
    columnCells(1).forEach((cell) =>
      expect(cell).toHaveClass('hidden', 'md:table-cell'),
    );
  });

  it('pins a sticky column with its own background on the header, cells and skeleton', () => {
    const { rerender } = render(
      <DataTable columns={META_COLUMNS} data={PEOPLE} label={LABEL} />,
    );

    expect(headerCell('Name')).toHaveClass('sticky', 'bg-muted', 'z-30');
    expect(headerCell('Name')).toHaveStyle({ left: '0px', width: '160px' });
    columnCells(0).forEach((cell) => {
      expect(cell).toHaveClass('sticky', 'bg-background');
      expect(cell).toHaveStyle({ left: '0px' });
    });
    columnCells(1).forEach((cell) => expect(cell).not.toHaveClass('sticky'));

    rerender(
      <DataTable columns={META_COLUMNS} data={[]} label={LABEL} isLoading />,
    );
    columnCells(0).forEach((cell) =>
      expect(cell).toHaveClass('sticky', 'bg-background'),
    );
  });

  // jsdom cannot compute the colors, so this checks the shape that makes them
  // match: the row only sets --row-tint, every cell paints it the same way,
  // and a pinned cell adds nothing but an opaque bg-background under it.
  it('gives pinned and unpinned cells the same row tint', () => {
    render(
      <DataTable
        columns={META_COLUMNS}
        data={PEOPLE}
        label={LABEL}
        onRowClick={vi.fn()}
        isFetching
      />,
    );
    const tint = 'bg-[linear-gradient(var(--row-tint),var(--row-tint))]';
    const colorClasses = (element: Element) =>
      element.className.split(/\s+/).filter((name) => /(^|:)bg-/.test(name));

    bodyRows().forEach((row) => {
      expect(colorClasses(row)).toEqual([]);
      row.querySelectorAll('td').forEach((cell) => {
        expect(cell).toHaveClass(tint);
      });
    });
    columnCells(0).forEach((cell) =>
      expect(colorClasses(cell!).sort()).toEqual(
        [tint, 'bg-background'].sort(),
      ),
    );
    columnCells(1).forEach((cell) =>
      expect(colorClasses(cell!)).toEqual([tint]),
    );
  });

  it('offsets a second sticky column by the width of the first', () => {
    const columns = helper.columns([
      helper.accessor('id', {
        header: 'ID',
        meta: { sticky: 'left', size: 80 },
      }),
      helper.accessor('name', { header: 'Name', meta: { sticky: 'left' } }),
      helper.accessor('salary', { header: 'Salary' }),
    ]);
    render(<DataTable columns={columns} data={PEOPLE} label={LABEL} />);

    expect(headerCell('Name')).toHaveStyle({ left: '80px' });
    columnCells(1).forEach((cell) =>
      expect(cell).toHaveStyle({ left: '80px' }),
    );
  });

  it('shows an edge on the sticky column once content scrolls under it', () => {
    render(<DataTable columns={META_COLUMNS} data={PEOPLE} label={LABEL} />);
    const container = table().parentElement as HTMLElement;
    const edge = 'after:bg-border';

    expect(headerCell('Name')).not.toHaveClass(edge);

    container.scrollLeft = 40;
    fireEvent.scroll(container);

    expect(headerCell('Name')).toHaveClass(edge);
    columnCells(0).forEach((cell) => expect(cell).toHaveClass(edge));

    container.scrollLeft = 0;
    fireEvent.scroll(container);

    expect(headerCell('Name')).not.toHaveClass(edge);
  });

  it('warns in development about a sticky column that is not leading, and leaves it unpinned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const columns = helper.columns([
      helper.accessor('name', { header: 'Name' }),
      helper.accessor('salary', {
        header: 'Salary',
        meta: { sticky: 'left' },
      }),
    ]);

    const { rerender } = render(
      <DataTable columns={columns} data={PEOPLE} label={LABEL} />,
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('salary');
    expect(headerCell('Salary')).not.toHaveClass('sticky', 'left-0');
    expect(headerCell('Salary')).not.toHaveStyle({ left: '0px' });

    rerender(<DataTable columns={columns} data={PEOPLE} label={LABEL} />);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('warns in development about an unsized sticky column that another sticky column follows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const columns = helper.columns([
      helper.accessor('id', { header: 'ID', meta: { sticky: 'left' } }),
      helper.accessor('name', { header: 'Name', meta: { sticky: 'left' } }),
      helper.accessor('salary', { header: 'Salary' }),
    ]);

    const { rerender } = render(
      <DataTable columns={columns} data={PEOPLE} label={LABEL} />,
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('sticky id has no meta.size');

    rerender(<DataTable columns={columns} data={PEOPLE} label={LABEL} />);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('does not warn about an unsized sticky column with no sticky column after it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const columns = helper.columns([
      helper.accessor('id', {
        header: 'ID',
        meta: { sticky: 'left', size: 80 },
      }),
      helper.accessor('name', { header: 'Name', meta: { sticky: 'left' } }),
      helper.accessor('salary', { header: 'Salary' }),
    ]);

    render(<DataTable columns={columns} data={PEOPLE} label={LABEL} />);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn about leading sticky columns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<DataTable columns={META_COLUMNS} data={PEOPLE} label={LABEL} />);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('DataTable scrolling', () => {
  it('scrolls inside its own height-capped container under a sticky header', () => {
    render(<DataTable columns={COLUMNS} data={PEOPLE} label={LABEL} />);
    const container = table().parentElement as HTMLElement;

    expect(container).toHaveAttribute('data-slot', 'table-container');
    expect(container).toHaveClass(
      'overflow-auto',
      'max-h-[calc(100dvh-var(--table-offset,16rem))]',
    );
    within(table())
      .getAllByRole('columnheader')
      .forEach((header) => expect(header).toHaveClass('sticky', 'top-0'));
  });
});

describe('DataTable row click', () => {
  function ActionsCell({ person }: { person: Person }) {
    return (
      <>
        <button type="button">Archive {person.name}</button>
        <a href="#profile">
          <span>Profile of {person.name}</span>
        </a>
        <span role="menuitem" tabIndex={-1}>
          Menu for {person.name}
        </span>
        {createPortal(<p>Popup for {person.name}</p>, document.body)}
      </>
    );
  }

  const CLICK_COLUMNS = helper.columns([
    helper.accessor('name', { header: 'Name' }),
    helper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => <ActionsCell person={row.original} />,
    }),
  ]);

  function renderClickable() {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={CLICK_COLUMNS}
        data={PEOPLE}
        label={LABEL}
        onRowClick={onRowClick}
      />,
    );
    return { onRowClick, user: userEvent.setup() };
  }

  it('keeps rows as rows, with no button role or tab stop', () => {
    renderClickable();

    expect(within(table()).getAllByRole('row')).toHaveLength(3);
    bodyRows().forEach((row) => {
      expect(row).toHaveAttribute('data-interactive');
      expect(row).not.toHaveAttribute('tabindex');
      expect(row).not.toHaveAttribute('role');
    });
  });

  it('calls onRowClick with the row on a click', async () => {
    const { onRowClick, user } = renderClickable();

    await user.click(screen.getByRole('cell', { name: 'Grace' }));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(PEOPLE[1]);
  });

  it('ignores clicks that start on a button, link or menu item in the row', async () => {
    const { onRowClick, user } = renderClickable();

    await user.click(screen.getByRole('button', { name: 'Archive Ada' }));
    await user.click(screen.getByText('Profile of Ada'));
    await user.click(screen.getByRole('menuitem', { name: 'Menu for Ada' }));

    expect(onRowClick).not.toHaveBeenCalled();
  });

  // React bubbles events out of portals, so a click in a popup the row
  // opened would otherwise open the row as well.
  it('ignores clicks inside a portal rendered from the row', async () => {
    const { onRowClick, user } = renderClickable();

    await user.click(screen.getByText('Popup for Ada'));

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('has no interactive marker without onRowClick', () => {
    render(<DataTable columns={COLUMNS} data={PEOPLE} label={LABEL} />);

    bodyRows().forEach((row) =>
      expect(row).not.toHaveAttribute('data-interactive'),
    );
  });
});

describe('RowLink', () => {
  const LINK_COLUMNS = helper.columns([
    helper.accessor('name', {
      header: 'Name',
      cell: ({ row }) => (
        <RowLink to={`/people/${row.original.id}`}>{row.original.name}</RowLink>
      ),
    }),
    helper.accessor('salary', { header: 'Salary' }),
  ]);

  it('is reachable by keyboard and navigates to the record', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { router } = renderWithRouter(
      <Routes>
        <Route
          path="/people"
          element={
            <DataTable
              columns={LINK_COLUMNS}
              data={PEOPLE}
              label={LABEL}
              onRowClick={onRowClick}
            />
          }
        />
        <Route path="/people/:id" element={<h1>Person page</h1>} />
      </Routes>,
      { url: '/people' },
    );

    await user.tab();
    expect(screen.getByRole('link', { name: 'Ada' })).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(
      await screen.findByRole('heading', { name: 'Person page' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/people/p-1');
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
