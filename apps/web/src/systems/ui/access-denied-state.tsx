import { ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from './empty-state';

type AccessDeniedStateProps = {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function AccessDeniedState({
  title = 'Access denied',
  description = 'You do not have permission to view this page.',
  action,
  className,
}: AccessDeniedStateProps) {
  return (
    <EmptyState
      icon={ShieldX}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}
