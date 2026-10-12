import type { FieldValues } from 'react-hook-form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import type { BaseFieldProps } from '../types';
import { FieldShell } from './field-shell';
import { useFieldShell } from './use-field-shell';

export type ChoiceOption = {
  value: string;
  label: string;
  // One line on what picking this means, worth it when the choice changes
  // what else the form asks for.
  description?: string;
};

export type ChoiceFieldProps<T extends FieldValues = FieldValues> = Omit<
  BaseFieldProps<T>,
  'placeholder'
> & {
  options: readonly ChoiceOption[];
  // Two per row from sm up.
  columns?: 1 | 2;
};

/**
 * A few mutually exclusive options laid out as cards, for a decision that
 * steers the rest of the form. A long list still belongs in a select.
 */
export function ChoiceField<T extends FieldValues = FieldValues>({
  options,
  columns = 2,
  ...base
}: ChoiceFieldProps<T>) {
  const field = useFieldShell(base);
  const isDisabled = field.disabled;

  return (
    <FieldShell<string> {...field.shell}>
      {(control) => {
        // Focus goes to the radio a keyboard user would land on: the checked
        // one, else the first.
        const focusTarget = options.some((o) => o.value === control.value)
          ? control.value
          : options[0]?.value;

        return (
          <RadioGroup
            name={control.name}
            value={control.value ?? ''}
            onValueChange={(next) => control.onChange(String(next))}
            disabled={isDisabled}
            aria-labelledby={control.labelId}
            aria-invalid={control.invalid}
            aria-required={control.required || undefined}
            aria-describedby={control.describedBy}
            className={cn('gap-2', columns === 2 && 'sm:grid-cols-2')}
          >
            {options.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3.5 py-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-primary/5',
                  isDisabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <RadioGroupItem
                  value={option.value}
                  ref={option.value === focusTarget ? control.ref : undefined}
                  onBlur={control.onBlur}
                  className="mt-0.5"
                />
                <span className="grid min-w-0 gap-1">
                  <span className="text-sm leading-none font-medium">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="text-xs leading-normal text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </RadioGroup>
        );
      }}
    </FieldShell>
  );
}
