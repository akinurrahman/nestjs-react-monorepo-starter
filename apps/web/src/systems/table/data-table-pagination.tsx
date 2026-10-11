import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MAX_PAGE_LIMIT, type PaginationMeta } from '@starter/shared';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { pageWindow } from './lib/page-window';

type DataTablePaginationProps = {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: readonly number[];
  className?: string;
};

const DEFAULT_LIMIT_OPTIONS = [20, 50, 100] as const;

// 40px on touch, where a 32px target gets mis-tapped, 32px from sm up.
const PAGE_BUTTON = 'size-10 sm:size-8';

// The current limit stays pickable even when a hand-edited URL set one that
// is not offered, and nothing above what the api accepts is ever offered.
function limitItems(limit: number, options: readonly number[]) {
  return [...new Set([...options, limit])]
    .filter((value) => value >= 1 && value <= MAX_PAGE_LIMIT)
    .sort((a, b) => a - b)
    .map((value) => ({ value: String(value), label: formatNumber(value) }));
}

export function DataTablePagination({
  pagination,
  onPageChange,
  onLimitChange,
  limitOptions = DEFAULT_LIMIT_OPTIONS,
  className,
}: DataTablePaginationProps) {
  const limitLabelId = useId();
  const { page, limit, total, totalPages, hasPrevious, hasNext } = pagination;

  if (total === 0) return null;

  const firstRow = (page - 1) * limit + 1;
  const lastRow = Math.min(page * limit, total);
  const items = limitItems(limit, limitOptions);

  return (
    <div
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 border-t bg-muted px-4 py-3 sm:flex-row',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <p className="text-sm text-muted-foreground tabular-nums">
          Showing {formatNumber(firstRow)}-{formatNumber(lastRow)} of{' '}
          {formatNumber(total)}
        </p>

        {onLimitChange ? (
          <div className="flex items-center gap-2">
            <span
              id={limitLabelId}
              className="text-sm whitespace-nowrap text-muted-foreground"
            >
              Rows per page
            </span>
            <Select
              value={String(limit)}
              onValueChange={(next) => {
                if (next) onLimitChange(Number(next));
              }}
              items={items}
            >
              <SelectTrigger aria-labelledby={limitLabelId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous page"
          disabled={!hasPrevious}
          onClick={() => onPageChange(page - 1)}
          className={PAGE_BUTTON}
        >
          <ChevronLeft />
        </Button>

        {/* Numbered buttons need more room than a phone has, so it gets the
            position as text and the arrows. */}
        <p className="px-2 text-sm text-muted-foreground tabular-nums sm:hidden">
          Page {formatNumber(page)} of {formatNumber(totalPages)}
        </p>

        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, totalPages).map((entry, index, entries) =>
            entry === 'gap' ? (
              <span
                key={`gap-after-${String(entries[index - 1])}`}
                aria-hidden
                className="px-1 text-sm text-muted-foreground select-none"
              >
                &hellip;
              </span>
            ) : (
              <Button
                key={entry}
                type="button"
                variant={entry === page ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={`Page ${formatNumber(entry)}`}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => onPageChange(entry)}
                className={cn(PAGE_BUTTON, 'tabular-nums')}
              >
                {formatNumber(entry)}
              </Button>
            ),
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next page"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
          className={PAGE_BUTTON}
        >
          <ChevronRight />
        </Button>
      </nav>
    </div>
  );
}
