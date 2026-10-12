import type { ComponentProps } from 'react';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import type { Option } from '../types';

export type MultiSelectComboboxProps = {
  value: readonly string[];
  onChange: (value: string[]) => void;
  options: readonly Option[];
  placeholder?: string;
  // The placeholder normally clears once a chip is picked. A gated field
  // keeps its "Select X first" even then.
  alwaysShowPlaceholder?: boolean;
  disabled?: boolean;
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

// A static multi-select over a short option list, controlled by plain props,
// so a form field and a filter popover can both sit on it.
export function MultiSelectCombobox({
  value,
  onChange,
  options,
  placeholder,
  alwaysShowPlaceholder = false,
  disabled,
  ...inputProps
}: MultiSelectComboboxProps) {
  const anchor = useComboboxAnchor();
  // A value the options no longer list still shows, by its raw value, so it
  // can be seen and removed.
  const selected = value.map(
    (entry) =>
      options.find((option) => option.value === entry) ?? {
        value: entry,
        label: entry,
      },
  );

  return (
    <Combobox
      multiple
      items={[...options]}
      value={selected}
      onValueChange={(next: Option[]) =>
        onChange(next.map((option) => option.value))
      }
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(chips: Option[]) =>
            chips.map((option) => (
              <ComboboxChip key={option.value}>{option.label}</ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxChipsInput
          {...inputProps}
          placeholder={
            selected.length && !alwaysShowPlaceholder ? undefined : placeholder
          }
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No results.</ComboboxEmpty>
        <ComboboxList>
          {(option: Option) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
