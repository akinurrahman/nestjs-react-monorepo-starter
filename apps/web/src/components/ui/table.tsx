import * as React from 'react';
import { cn } from '@/lib/utils';

// The ref points at the scroll container, not the <table>, so a caller can
// read or drive the scroll position without reaching past this component.
function Table({
  className,
  containerClassName,
  ref,
  ...props
}: Omit<React.ComponentProps<'table'>, 'ref'> & {
  ref?: React.Ref<HTMLDivElement>;
  containerClassName?: string;
}) {
  return (
    <div
      ref={ref}
      data-slot="table-container"
      className={cn('relative w-full overflow-x-auto', containerClassName)}
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

// The header sits on its own band so it reads as a header, not the first row.
// The closing rule is an inset shadow on the cells: a collapsed border stays
// behind when a sticky header cell moves, a shadow travels with it.
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        '[&_th]:bg-muted [&_th]:shadow-[inset_0_-1px_0_var(--color-border)]',
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

// Hover only on rows that open something, so a read-only table does not
// promise a click. A keyboard focus inside the row lights it the same way.
// The row only sets --row-tint and every cell paints it, so an opaque sticky
// cell and a see-through one blend the same tint over the same background.
const ROW_TINT =
  '[--row-tint:transparent] [--row-hover:color-mix(in_oklab,var(--color-muted)_50%,transparent)] has-focus-visible:[--row-tint:var(--row-hover)] has-aria-expanded:[--row-tint:var(--row-hover)] data-interactive:hover:[--row-tint:var(--row-hover)] data-[state=selected]:[--row-tint:var(--color-muted)]';

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b data-interactive:cursor-pointer',
        ROW_TINT,
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'bg-[linear-gradient(var(--row-tint),var(--row-tint))] p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
