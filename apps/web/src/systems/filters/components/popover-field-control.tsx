import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { MultiSelectCombobox } from '@/systems/form';
import type { UrlFilterValue } from '../hooks/use-url-filters';
import type { PopoverFieldShape } from '../lib/popover-fields';
import { FilterAsyncSelect } from './filter-async-select';
import { FilterSelect } from './filter-select';

type PopoverFieldControlProps = {
  field: PopoverFieldShape;
  value: UrlFilterValue;
  onChange: (value: UrlFilterValue) => void;
  // The control's id, which the field's label points at.
  id: string;
  labelId: string;
  placeholder?: string;
  disabled: boolean;
  parentValues?: Record<string, unknown>;
};

const asString = (value: UrlFilterValue) =>
  typeof value === 'string' ? value : undefined;

export function PopoverFieldControl({
  field,
  value,
  onChange,
  id,
  labelId,
  placeholder,
  disabled,
  parentValues,
}: PopoverFieldControlProps) {
  switch (field.type) {
    case 'select':
      return (
        <FilterSelect
          id={id}
          label={field.label}
          value={asString(value)}
          onChange={onChange}
          options={field.options}
          placeholder={placeholder ?? 'All'}
          disabled={disabled}
          className="sm:w-full"
        />
      );

    case 'asyncSelect':
      return (
        <FilterAsyncSelect
          id={id}
          label={field.label}
          value={asString(value)}
          onChange={onChange}
          source={field.source}
          initialOptions={field.initialOptions}
          parentValues={parentValues}
          placeholder={placeholder ?? 'All'}
          disabled={disabled}
          className="sm:w-full"
        />
      );

    case 'multiSelect':
      return (
        <MultiSelectCombobox
          id={id}
          aria-labelledby={labelId}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          options={field.options}
          placeholder={placeholder ?? 'Any'}
          disabled={disabled}
        />
      );

    case 'date':
      return (
        <DatePicker
          id={id}
          aria-label={field.label}
          value={asString(value)}
          onValueChange={onChange}
          min={field.min}
          max={field.max}
          placeholder={placeholder}
          disabled={disabled}
        />
      );

    case 'switch':
      return (
        <Switch
          id={id}
          aria-labelledby={labelId}
          checked={value === 'true'}
          onCheckedChange={(checked) => onChange(checked ? 'true' : undefined)}
          disabled={disabled}
        />
      );

    case 'radio':
      return (
        <RadioGroup
          aria-labelledby={labelId}
          value={asString(value) ?? ''}
          onValueChange={(next) => onChange(String(next))}
          disabled={disabled}
          className="gap-0"
        >
          {field.options.map((option) => (
            <label
              key={option.value}
              className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm sm:min-h-9"
            >
              <RadioGroupItem value={option.value} />
              {option.label}
            </label>
          ))}
        </RadioGroup>
      );
  }
}
