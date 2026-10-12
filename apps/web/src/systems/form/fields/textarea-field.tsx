import { Textarea } from '@/components/ui/textarea';
import type { BaseFieldProps } from '../types';
import { FieldShell } from './field-shell';
import { useFieldShell } from './use-field-shell';

export type TextareaFieldProps = BaseFieldProps & {
  rows?: number;
  maxLength?: number;
};

export function TextareaField({
  rows = 4,
  maxLength,
  ...base
}: TextareaFieldProps) {
  const field = useFieldShell(base);

  return (
    <FieldShell<string> {...field.shell}>
      {(control) => (
        <Textarea
          id={control.id}
          ref={control.ref}
          name={control.name}
          value={control.value ?? ''}
          onChange={(event) => control.onChange(event.target.value)}
          onBlur={control.onBlur}
          rows={rows}
          maxLength={maxLength}
          placeholder={field.placeholder}
          disabled={field.disabled}
          aria-invalid={control.invalid}
          aria-required={control.required || undefined}
          aria-describedby={control.describedBy}
        />
      )}
    </FieldShell>
  );
}
