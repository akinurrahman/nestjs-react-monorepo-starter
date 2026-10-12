import { Input } from '@/components/ui/input';
import type { BaseFieldProps } from '../types';
import { FieldShell } from './field-shell';
import { useFieldShell } from './use-field-shell';

export type TimeFieldProps = Omit<BaseFieldProps, 'placeholder'>;

// Wall-clock time as HH:mm. The native control brings each platform's own
// picker and its 12h or 24h preference, which no custom dropdown matches.
export function TimeField(props: TimeFieldProps) {
  const field = useFieldShell(props);

  return (
    <FieldShell<string> {...field.shell}>
      {(control) => (
        <Input
          id={control.id}
          ref={control.ref}
          name={control.name}
          type="time"
          value={control.value ?? ''}
          onChange={(event) => control.onChange(event.target.value)}
          onBlur={control.onBlur}
          disabled={field.disabled}
          aria-invalid={control.invalid}
          aria-required={control.required || undefined}
          aria-describedby={control.describedBy}
          className="tabular-nums"
        />
      )}
    </FieldShell>
  );
}
