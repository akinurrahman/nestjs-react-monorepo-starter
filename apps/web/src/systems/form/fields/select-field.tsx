import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelectCombobox } from '../controls/multi-select-combobox';
import type { BaseFieldProps, Option, OptionsFn } from '../types';
import { FieldShell } from './field-shell';
import { useFieldShell } from './use-field-shell';

type OptionsProps = {
  options?: readonly Option[];
  // Narrows the list from the form's live values, without a round trip.
  optionsFn?: OptionsFn;
};

export type SelectFieldProps = BaseFieldProps &
  OptionsProps & {
    multi?: boolean;
  };

export function SelectField({ multi, ...props }: SelectFieldProps) {
  return multi ? (
    <MultiSelectField {...props} />
  ) : (
    <SingleSelectField {...props} />
  );
}

// Subscribing to every value re-renders the field on each keystroke anywhere
// in the form, so only a field that derives its options pays for it.
function useResolvedOptions({ options, optionsFn }: OptionsProps): Option[] {
  const { control } = useFormContext();
  const values = useWatch({ control, disabled: !optionsFn });

  return useMemo(
    () =>
      optionsFn
        ? optionsFn((values ?? {}) as Record<string, unknown>)
        : [...(options ?? [])],
    [optionsFn, options, values],
  );
}

type FieldProps = BaseFieldProps & OptionsProps;

function SingleSelectField({
  placeholder = 'Select...',
  options,
  optionsFn,
  ...base
}: FieldProps) {
  const field = useFieldShell({ ...base, placeholder });
  const resolved = useResolvedOptions({ options, optionsFn });

  return (
    <FieldShell<string> {...field.shell}>
      {(control) => (
        <Select
          name={control.name}
          value={control.value || null}
          onValueChange={(next) => control.onChange(next ?? '')}
          items={resolved}
          disabled={field.disabled}
        >
          <SelectTrigger
            id={control.id}
            ref={control.ref}
            onBlur={control.onBlur}
            aria-labelledby={control.labelId}
            aria-invalid={control.invalid}
            aria-required={control.required || undefined}
            aria-describedby={control.describedBy}
            className="w-full"
          >
            <SelectValue placeholder={field.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {resolved.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FieldShell>
  );
}

function MultiSelectField({
  placeholder = 'Select...',
  options,
  optionsFn,
  ...base
}: FieldProps) {
  const field = useFieldShell({ ...base, placeholder }, []);
  const resolved = useResolvedOptions({ options, optionsFn });

  return (
    <FieldShell<string[]> {...field.shell}>
      {(control) => (
        <MultiSelectCombobox
          id={control.id}
          ref={control.ref}
          onBlur={control.onBlur}
          aria-labelledby={control.labelId}
          aria-invalid={control.invalid}
          aria-required={control.required || undefined}
          aria-describedby={control.describedBy}
          value={control.value ?? []}
          onChange={control.onChange}
          options={resolved}
          placeholder={field.placeholder}
          alwaysShowPlaceholder={field.gated}
          disabled={field.disabled}
        />
      )}
    </FieldShell>
  );
}
