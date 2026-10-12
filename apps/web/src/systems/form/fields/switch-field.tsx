import type { FieldValues } from 'react-hook-form';
import { Switch } from '@/components/ui/switch';
import type { BaseFieldProps } from '../types';
import { FieldShell } from './field-shell';
import { useFieldShell } from './use-field-shell';

export type SwitchFieldProps<T extends FieldValues = FieldValues> = Omit<
  BaseFieldProps<T>,
  'placeholder'
>;

// Base UI puts the id on its hidden checkbox and names the visible switch
// through aria-labelledby, so a plain htmlFor alone leaves it unnamed.
export function SwitchField<T extends FieldValues = FieldValues>(
  props: SwitchFieldProps<T>,
) {
  const field = useFieldShell(props, false);

  return (
    <FieldShell<boolean> {...field.shell} layout="row">
      {(control) => (
        <Switch
          id={control.id}
          ref={control.ref}
          name={control.name}
          checked={Boolean(control.value)}
          onCheckedChange={(next) => control.onChange(next)}
          onBlur={control.onBlur}
          disabled={field.disabled}
          aria-labelledby={control.labelId}
          aria-invalid={control.invalid}
          aria-describedby={control.describedBy}
          className="mt-0.5"
        />
      )}
    </FieldShell>
  );
}
