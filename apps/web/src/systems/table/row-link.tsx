import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/utils';

// The keyboard and screen reader way into a row, since rows themselves take
// no focus. Put it in the column that names the record.
export function RowLink({ className, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        'rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    />
  );
}
