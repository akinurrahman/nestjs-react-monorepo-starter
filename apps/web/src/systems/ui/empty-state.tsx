import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The title's heading level. A state that replaces the page is its only
// heading, so 1. One inside the page, such as a table's empty row, sits under
// the PageHeader h1, so 2.
export type StateHeadingLevel = 1 | 2 | 3;

type EmptyStateProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  level?: StateHeadingLevel;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  level = 2,
  className,
}: EmptyStateProps) {
  const Heading = `h${level}` as const;
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <Heading className="text-sm font-medium text-foreground">{title}</Heading>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
