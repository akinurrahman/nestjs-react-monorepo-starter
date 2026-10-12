import { DatePicker } from '@/components/ui/date-picker';
import type { BaseFieldProps } from '../types';
import { FieldShell } from './field-shell';
import { useFieldShell } from './use-field-shell';

export type DateFieldProps = BaseFieldProps & {
  // yyyy-MM-dd bounds. Days outside them cannot be picked at all.
  min?: string;
  max?: string;
};

// A calendar day as yyyy-MM-dd, the shape every date-only API field takes.
// Never an instant, never an offset.
export function DateField({ min, max, ...base }: DateFieldProps) {
  const field = useFieldShell(base);

  return (
    <FieldShell<string> {...field.shell}>
      {(control) => (
        <DatePicker
          id={control.id}
          ref={control.ref}
          value={control.value || undefined}
          onValueChange={(next) => {
            control.onChange(next ?? '');
            control.onBlur();
          }}
          min={min}
          max={max}
          placeholder={field.placeholder}
          disabled={field.disabled}
          aria-invalid={control.invalid}
          aria-describedby={control.describedBy}
        />
      )}
    </FieldShell>
  );
}
