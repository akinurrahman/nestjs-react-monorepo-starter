import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useTable, type RowData } from '@tanstack/react-table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  dataTableFeatures,
  type ColumnDef,
  type DataTableColumnMeta,
} from './columns';

type DataTableProps<TData extends RowData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  // The table's accessible name, read out when a screen reader enters it.
  label: string;
  // query.isLoading: the first load, with nothing cached. Shows skeleton rows.
  isLoading?: boolean;
  // query.isFetching: any fetch in flight. With placeholderData keeping the
  // previous page, the old rows stay on screen dimmed until the new ones land.
  isFetching?: boolean;
  emptyState?: ReactNode;
  // Mouse only. Give the record's own column a RowLink for the keyboard and
  // screen reader path.
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData, index: number) => string;
  skeletonRows?: number;
  className?: string;
};

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

const SKELETON_ALIGN = {
  left: '',
  right: 'ml-auto',
  center: 'mx-auto',
} as const;

const HIDE_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const;

// Its own background so rows scrolling under it do not show through, matched
// to the row's hover and focus tint.
const STICKY_CELL =
  'sticky z-10 bg-background group-has-focus-visible/row:bg-[color-mix(in_oklab,var(--color-muted)_50%,var(--color-background))] group-data-interactive/row:group-hover/row:bg-[color-mix(in_oklab,var(--color-muted)_50%,var(--color-background))]';

const STICKY_EDGE =
  'after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border';

// A click on a control in the row belongs to that control.
const ROW_CONTROLS =
  'a, button, input, select, textarea, [role="button"], [role="link"], [role="menuitem"]';

const DEFAULT_SKELETON_ROWS = 8;

function defaultRowId(row: unknown, index: number): string {
  if (typeof row === 'object' && row !== null && 'id' in row) {
    const { id } = row;
    if (typeof id === 'string' || typeof id === 'number') return String(id);
  }
  return String(index);
}

type Pin = { left: number; edge: boolean };

// unsized lists sticky columns with no size that another sticky column
// follows: with no width to add, the next one's offset lands on top of them.
function resolvePins(columns: { id: string; meta?: DataTableColumnMeta }[]): {
  pins: Map<string, Pin>;
  misplaced: string[];
  unsized: string[];
} {
  const pins = new Map<string, Pin>();
  const misplaced: string[] = [];
  const unsized: string[] = [];
  let left = 0;
  let leading = true;
  let last: Pin | undefined;
  let previousUnsized: string | undefined;

  columns.forEach(({ id, meta }) => {
    if (meta?.sticky !== 'left') {
      leading = false;
      return;
    }
    if (!leading) {
      misplaced.push(id);
      return;
    }
    if (previousUnsized) unsized.push(previousUnsized);
    last = { left, edge: false };
    pins.set(id, last);
    left += meta.size ?? 0;
    previousUnsized = meta.size === undefined ? id : undefined;
  });

  if (last) last.edge = true;
  return { pins, misplaced, unsized };
}

function startsInControl(event: MouseEvent<HTMLTableRowElement>): boolean {
  const target = event.target;
  // Outside the row's own DOM is a portal: a menu or dialog the row opened.
  if (!(target instanceof Element) || !event.currentTarget.contains(target)) {
    return true;
  }
  const control = target.closest(ROW_CONTROLS);
  return control !== null && event.currentTarget.contains(control);
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  label,
  isLoading = false,
  isFetching = false,
  emptyState,
  onRowClick,
  getRowId = defaultRowId,
  skeletonRows = DEFAULT_SKELETON_ROWS,
  className,
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
  });

  const leafColumns = table.getAllLeafColumns();
  const { pins, misplaced, unsized } = useMemo(
    () =>
      resolvePins(
        leafColumns.map((column) => ({
          id: column.id,
          meta: column.columnDef.meta,
        })),
      ),
    [leafColumns],
  );

  const misplacedKey = misplaced.join(', ');
  useEffect(() => {
    if (!import.meta.env.DEV || !misplacedKey) return;
    console.warn(
      `DataTable "${label}": sticky only pins leading columns, so ${misplacedKey} will scroll.`,
    );
  }, [label, misplacedKey]);

  const unsizedKey = unsized.join(', ');
  useEffect(() => {
    if (!import.meta.env.DEV || !unsizedKey) return;
    console.warn(
      `DataTable "${label}": sticky ${unsizedKey} has no meta.size, so the sticky column after it overlaps it.`,
    );
  }, [label, unsizedKey]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledX, setScrolledX] = useState(false);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const update = () => setScrolledX(container.scrollLeft > 0);
    update();
    container.addEventListener('scroll', update, { passive: true });
    return () => container.removeEventListener('scroll', update);
  }, []);

  function columnClasses(columnId: string, meta?: DataTableColumnMeta) {
    const pin = pins.get(columnId);
    return cn(
      meta?.hideBelow && HIDE_BELOW[meta.hideBelow],
      pin && STICKY_CELL,
      pin?.edge && scrolledX && STICKY_EDGE,
    );
  }

  function columnStyle(columnId: string, meta?: DataTableColumnMeta) {
    const pin = pins.get(columnId);
    return { width: meta?.size, left: pin?.left };
  }

  const showSkeleton = isLoading && data.length === 0;
  const showEmpty = !isLoading && data.length === 0;
  const dimmed = isFetching && data.length > 0;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-background',
        className,
      )}
    >
      <Table
        ref={scrollRef}
        aria-label={label}
        aria-busy={isLoading || isFetching}
        containerClassName="max-h-[calc(100dvh-var(--table-offset,16rem))] overflow-auto"
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      'sticky top-0 z-20',
                      ALIGN[meta?.align ?? 'left'],
                      columnClasses(header.column.id, meta),
                      pins.has(header.column.id) && 'z-30 bg-muted',
                    )}
                    style={columnStyle(header.column.id, meta)}
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody className={cn('transition-opacity', dimmed && 'opacity-60')}>
          {showSkeleton
            ? Array.from({ length: skeletonRows }, (_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className="group/row">
                  {leafColumns.map((column) => {
                    const meta = column.columnDef.meta;
                    return (
                      <TableCell
                        key={column.id}
                        className={columnClasses(column.id, meta)}
                        style={columnStyle(column.id, meta)}
                      >
                        <Skeleton
                          className={cn(
                            'h-4 w-full max-w-28',
                            SKELETON_ALIGN[meta?.align ?? 'left'],
                          )}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                // Mouse only by design: a focusable row with role="button"
                // would hide the row and cell semantics. RowLink in the
                // record's column is the keyboard path.
                <TableRow
                  key={row.id}
                  className="group/row"
                  data-interactive={onRowClick ? '' : undefined}
                  onClick={
                    onRowClick
                      ? (event) => {
                          if (startsInControl(event)) return;
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          ALIGN[meta?.align ?? 'left'],
                          columnClasses(cell.column.id, meta),
                        )}
                        style={columnStyle(cell.column.id, meta)}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}

          {showEmpty ? (
            <TableRow>
              <TableCell colSpan={leafColumns.length} className="p-0">
                {emptyState ?? (
                  <p className="px-6 py-14 text-center text-sm text-muted-foreground">
                    No results
                  </p>
                )}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
