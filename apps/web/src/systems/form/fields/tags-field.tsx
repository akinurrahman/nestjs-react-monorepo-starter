import { useState } from 'react';
import { X } from 'lucide-react';
import type { FieldValues } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { BaseFieldProps } from '../types';
import { FieldShell } from './field-shell';
import { useFieldShell } from './use-field-shell';

export type TagsFieldProps<T extends FieldValues = FieldValues> =
  BaseFieldProps<T> & {
    // Stops accepting entries at the schema's limit, which beats letting
    // someone type one more and then rejecting it.
    maxItems?: number;
  };

/**
 * A free-text list, for an API that models one row as several names, where a
 * plain text field would have to invent a separator and a parser.
 */
export function TagsField<T extends FieldValues = FieldValues>({
  placeholder = 'Type and press Enter',
  maxItems,
  ...base
}: TagsFieldProps<T>) {
  const [draft, setDraft] = useState('');
  const field = useFieldShell({ ...base, placeholder }, []);
  const isDisabled = field.disabled;

  return (
    <FieldShell<string[]> {...field.shell}>
      {(control) => {
        const items = control.value ?? [];
        const isFull = maxItems !== undefined && items.length >= maxItems;

        const commit = () => {
          const entry = draft.trim();
          // A duplicate is dropped quietly, the person can see it is there.
          if (!entry || isFull || items.includes(entry)) return;
          control.onChange([...items, entry]);
          setDraft('');
        };

        return (
          <div className="grid gap-2">
            <Input
              id={control.id}
              ref={control.ref}
              value={draft}
              // Read-only rather than disabled when full: the input keeps
              // focus and still hears Backspace, so the last tag can go.
              readOnly={isFull}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  commit();
                  return;
                }
                if (event.key === 'Backspace' && !draft && items.length) {
                  control.onChange(items.slice(0, -1));
                }
              }}
              // Leaving with text still in the box would otherwise throw it
              // away without saying so.
              onBlur={() => {
                commit();
                control.onBlur();
              }}
              placeholder={
                !field.gated && isFull
                  ? `Limit of ${maxItems} reached`
                  : field.placeholder
              }
              disabled={isDisabled}
              aria-invalid={control.invalid}
              aria-required={control.required || undefined}
              aria-describedby={control.describedBy}
            />

            {items.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {items.map((entry) => (
                  <li key={entry}>
                    {/* overflow-visible lets the remove button's hit area
                        reach past the pill. */}
                    <Badge
                      variant="secondary"
                      className="h-6 gap-1 overflow-visible pr-0.5 pl-2.5"
                    >
                      {entry}
                      <button
                        type="button"
                        aria-label={`Remove ${entry}`}
                        disabled={isDisabled}
                        onClick={() =>
                          control.onChange(
                            items.filter((item) => item !== entry),
                          )
                        }
                        // A 20px mark in a 24px pill. The after: box grows
                        // the hit area to 40px below sm and 32px from sm up,
                        // mostly over the tag's own label.
                        className="relative flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none after:absolute after:-inset-y-2.5 after:-right-1 after:-left-4 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 sm:after:-inset-y-1.5 sm:after:-left-2"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      }}
    </FieldShell>
  );
}
