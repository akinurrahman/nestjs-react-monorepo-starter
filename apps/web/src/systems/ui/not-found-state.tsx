import { SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState, type StateHeadingLevel } from './empty-state';

type NotFoundStateProps = {
  title?: string;
  description?: ReactNode;
  // A way out, e.g. a link back to the list.
  action?: ReactNode;
  level?: StateHeadingLevel;
  className?: string;
};

export function NotFoundState({
  title = 'Not found',
  description = 'This record does not exist. It may have been deleted, or the link is out of date.',
  action,
  level = 1,
  className,
}: NotFoundStateProps) {
  return (
    <EmptyState
      icon={SearchX}
      title={title}
      description={description}
      action={action}
      level={level}
      className={className}
    />
  );
}
