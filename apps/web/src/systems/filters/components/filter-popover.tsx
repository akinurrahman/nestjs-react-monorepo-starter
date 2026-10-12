import { useId, useState } from 'react';
import { ListFilterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { isEmptyValue } from '@/lib/is-empty-value';
import { cn } from '@/lib/utils';
import { gatedText } from '@/systems/form';
import {
  differsFromDefault,
  useUrlFilters,
  type UrlFilterSpec,
  type UrlFilterValue,
} from '../hooks/use-url-filters';
import {
  dependentsOf,
  type FilterPopoverField,
  type PopoverFieldShape,
} from '../lib/popover-fields';
import { PopoverFieldControl } from './popover-field-control';

type Values = Record<string, UrlFilterValue>;

type FilterPopoverProps<T extends object, C> = {
  spec: UrlFilterSpec<T, C>;
  fields: readonly FilterPopoverField<T>[];
  label?: string;
  className?: string;
};

/**
 * The filters that do not earn a place in the bar, edited as a draft.
 *
 * Opening seeds the draft from the URL, Apply writes every one of these
 * fields in a single setFilters call, and closing any other way drops the
 * draft. Clear touches only these fields, never the search or anything else
 * the spec or the URL holds.
 */
export function FilterPopover<T extends object, C>({
  spec,
  fields: typedFields,
  label = 'Filters',
  className,
}: FilterPopoverProps<T, C>) {
  const fields = typedFields as readonly PopoverFieldShape[];
  const { filters, defaults, setFilters } = useUrlFilters(spec);
  const current = filters as Values;
  const fallbacks = defaults as Values;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Values>({});
  const baseId = useId();

  const activeCount = fields.filter((field) =>
    differsFromDefault(current[field.key], fallbacks[field.key]),
  ).length;

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(
        Object.fromEntries(
          fields.map((field) => [field.key, current[field.key]]),
        ),
      );
    }
    setOpen(next);
  };

  const change = (key: string, value: UrlFilterValue) => {
    setDraft((previous) => {
      const next = { ...previous, [key]: value };
      dependentsOf(fields, key).forEach((dependent) => {
        next[dependent] = undefined;
      });
      return next;
    });
  };

  const writeAll = (valueOf: (field: PopoverFieldShape) => UrlFilterValue) => {
    setFilters(
      Object.fromEntries(
        fields.map((field) => [field.key, valueOf(field)]),
      ) as Partial<Record<keyof T, UrlFilterValue>>,
    );
    setOpen(false);
  };

  // A value on its default leaves the URL, which reads back the same.
  const apply = () =>
    writeAll((field) =>
      differsFromDefault(draft[field.key], fallbacks[field.key])
        ? draft[field.key]
        : undefined,
    );

  const clear = () => writeAll(() => undefined);

  const labelOf = (key: string) =>
    fields.find((field) => field.key === key)?.label ?? key;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={activeCount ? `${label}, ${activeCount} applied` : label}
        render={
          <Button
            type="button"
            variant="outline"
            className={cn('h-10 gap-1.5 self-start sm:h-9', className)}
          />
        }
      >
        <ListFilterIcon aria-hidden />
        {label}
        {activeCount ? (
          <span
            aria-hidden
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-none text-primary-foreground"
          >
            {activeCount}
          </span>
        ) : null}
      </PopoverTrigger>

      {/* Never wider than the viewport, or a phone scrolls sideways. */}
      <PopoverContent
        aria-label={label}
        align="start"
        className="w-[min(26rem,calc(100vw-2rem))] gap-4 p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field, index) => {
            const parent = field.dependsOn;
            const parentValue = parent
              ? parent in draft
                ? draft[parent]
                : current[parent]
              : undefined;
            const gated = Boolean(parent) && isEmptyValue(parentValue);
            if (gated && !field.alwaysVisible) return null;

            const id = `${baseId}-${index}`;
            const labelId = `${id}-label`;
            const isSwitch = field.type === 'switch';

            return (
              <div
                key={field.key}
                className={cn(
                  'grid content-start gap-1.5',
                  (field.span === 'full' || isSwitch) && 'sm:col-span-2',
                  isSwitch &&
                    'flex min-h-10 items-center justify-between gap-4 sm:min-h-9',
                )}
              >
                <label
                  id={labelId}
                  htmlFor={id}
                  className="text-sm leading-snug font-medium text-foreground"
                >
                  {field.label}
                </label>
                <PopoverFieldControl
                  field={field}
                  id={id}
                  labelId={labelId}
                  value={draft[field.key]}
                  onChange={(value) => change(field.key, value)}
                  placeholder={
                    gated && parent
                      ? gatedText([labelOf(parent)])
                      : field.placeholder
                  }
                  disabled={Boolean(field.disabled) || gated}
                  parentValues={parent ? { [parent]: parentValue } : undefined}
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={clear}
            className="h-10 sm:h-9"
          >
            Clear
          </Button>
          <Button type="button" onClick={apply} className="h-10 sm:h-9">
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
