import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';
import type { LookupEntry } from '@/lib/lookup/create-lookup';
import { cn } from '@/lib/utils';

type LookupBadgeProps = {
  lookup: {
    resolve: (
      value: string | null | undefined,
    ) => LookupEntry<ComponentType<{ className?: string }>> | null;
  };
  value: string | null | undefined;
  showIcon?: boolean;
  className?: string;
};

export function LookupBadge({
  lookup,
  value,
  showIcon = true,
  className,
}: LookupBadgeProps) {
  const entry = lookup.resolve(value);
  if (!entry) return null;

  const Icon = entry.icon;

  return (
    <Badge
      variant={entry.badgeVariant}
      className={cn(entry.className, className)}
    >
      {showIcon && Icon ? <Icon className={entry.iconClassName} /> : null}
      {entry.label}
    </Badge>
  );
}
