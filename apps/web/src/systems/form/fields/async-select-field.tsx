import { useState, type ComponentProps } from 'react';
import type { FieldValues } from 'react-hook-form';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { AsyncCombobox, AsyncOptionsList } from '../controls/async-combobox';
import { useAsyncOptions } from '../hooks/use-async-options';
import type { AsyncOptionsSource, BaseFieldProps, Option } from '../types';
import { FieldShell } from './field-shell';
import { useFieldShell } from './use-field-shell';

type SourceProps = {
  source: AsyncOptionsSource;
  // Labels for the values an edit form starts with, so the control shows
  // names before its first fetch.
  initialOptions?: readonly Option[];
  debounceMs?: number;
  emptyMessage?: string;
};

export type AsyncSelectFieldProps<T extends FieldValues = FieldValues> =
  BaseFieldProps<T> &
    SourceProps & {
      multi?: boolean;
    };

export function AsyncSelectField<T extends FieldValues = FieldValues>({
  multi,
  ...props
}: AsyncSelectFieldProps<T>) {
  return multi ? (
    <AsyncMultiSelectField {...props} />
  ) : (
    <AsyncSingleSelectField {...props} />
  );
}

type FieldProps = Omit<AsyncSelectFieldProps, 'multi'>;

function AsyncSingleSelectField({
  placeholder = 'Select...',
  source,
  initialOptions,
  debounceMs,
  emptyMessage,
  ...base
}: FieldProps) {
  const field = useFieldShell({ ...base, placeholder });

  return (
    <FieldShell<string> {...field.shell}>
      {(control) => (
        <AsyncCombobox
          id={control.id}
          ref={control.ref}
          onBlur={control.onBlur}
          aria-labelledby={control.labelId}
          aria-invalid={control.invalid}
          aria-required={control.required || undefined}
          aria-describedby={control.describedBy}
          value={control.value}
          onChange={control.onChange}
          source={source}
          parentValues={field.parentValues}
          initialOptions={initialOptions}
          placeholder={field.placeholder}
          disabled={field.disabled}
          debounceMs={debounceMs}
          emptyMessage={emptyMessage}
        />
      )}
    </FieldShell>
  );
}

function AsyncMultiSelectField({
  placeholder = 'Select...',
  source,
  initialOptions,
  debounceMs,
  emptyMessage,
  ...base
}: FieldProps) {
  const field = useFieldShell({ ...base, placeholder }, []);

  return (
    <FieldShell<string[]> {...field.shell}>
      {(control) => (
        <AsyncMultiCombobox
          id={control.id}
          ref={control.ref}
          onBlur={control.onBlur}
          aria-labelledby={control.labelId}
          aria-invalid={control.invalid}
          aria-required={control.required || undefined}
          aria-describedby={control.describedBy}
          value={control.value}
          onChange={control.onChange}
          parentValues={field.parentValues}
          placeholder={field.placeholder}
          disabled={field.disabled}
          source={source}
          initialOptions={initialOptions}
          debounceMs={debounceMs}
          emptyMessage={emptyMessage}
        />
      )}
    </FieldShell>
  );
}

type AsyncMultiComboboxProps = SourceProps & {
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  parentValues: Record<string, unknown>;
  placeholder: string | undefined;
  disabled: boolean | undefined;
} & Pick<
    ComponentProps<'input'>,
    | 'id'
    | 'ref'
    | 'onBlur'
    | 'aria-labelledby'
    | 'aria-invalid'
    | 'aria-required'
    | 'aria-describedby'
  >;

// Its own component so the options hook can read the field value that only
// FieldShell's render prop hands out.
function AsyncMultiCombobox({
  value,
  onChange,
  parentValues,
  placeholder,
  disabled,
  source,
  initialOptions,
  debounceMs,
  emptyMessage = 'No results.',
  ...inputProps
}: AsyncMultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const anchor = useComboboxAnchor();
  const selected = value ?? [];
  const state = useAsyncOptions({
    source,
    enabled: open && !disabled,
    parentValues,
    selected,
    initialOptions,
    debounceMs,
  });

  return (
    <Combobox
      multiple
      items={state.options.map((option) => option.value)}
      itemToStringLabel={state.getLabel}
      filter={null}
      value={selected}
      onValueChange={(next: string[]) => onChange(next)}
      open={open}
      onOpenChange={setOpen}
      inputValue={state.search}
      onInputValueChange={state.setSearch}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className="w-full">
        {selected.map((item) => (
          <ComboboxChip key={item}>{state.getLabel(item)}</ComboboxChip>
        ))}
        <ComboboxChipsInput
          {...inputProps}
          placeholder={selected.length ? undefined : placeholder}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <AsyncOptionsList
          state={state}
          labelFor={state.getLabel}
          emptyMessage={emptyMessage}
        />
      </ComboboxContent>
    </Combobox>
  );
}
