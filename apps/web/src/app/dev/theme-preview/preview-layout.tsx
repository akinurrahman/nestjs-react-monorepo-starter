import { useId, type ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { sectionTitle, type PreviewSectionId } from './preview-sections';

type PreviewSectionProps = {
  id: PreviewSectionId;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
};

// The scroll margin keeps a jumped-to heading clear of the sticky header.
export function PreviewSection({
  id,
  description,
  className,
  children,
}: PreviewSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        'scroll-mt-[calc(var(--header-height)+var(--page-padding))] space-y-6 border-t border-border pt-8',
        className,
      )}
    >
      <div>
        <h2
          id={`${id}-heading`}
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          {sectionTitle(id)}
        </h2>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

type SpecimenProps = {
  label: string;
  className?: string;
  children: ReactNode;
};

export function Specimen({ label, className, children }: SpecimenProps) {
  return (
    <div className="grid gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </h3>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {children}
      </div>
    </div>
  );
}

type PreviewSwitchProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function PreviewSwitch({
  label,
  checked,
  onCheckedChange,
}: PreviewSwitchProps) {
  const labelId = useId();
  return (
    <span className="inline-flex min-h-10 items-center gap-2 text-sm sm:min-h-8">
      <Switch
        aria-labelledby={labelId}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
      />
      <span id={labelId}>{label}</span>
    </span>
  );
}
