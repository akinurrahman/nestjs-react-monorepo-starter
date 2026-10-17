import { ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState, type StateHeadingLevel } from './empty-state';

type AccessDeniedStateProps = {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  level?: StateHeadingLevel;
  className?: string;
};

export function AccessDeniedState({
  title = 'Access denied',
  description = 'You do not have permission to view this page.',
  action,
  level = 1,
  className,
}: AccessDeniedStateProps) {
  return (
    <EmptyState
      icon={ShieldX}
      title={title}
      description={description}
      action={action}
      level={level}
      className={className}
    />
  );
}
