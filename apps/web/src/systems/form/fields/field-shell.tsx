import { useId, type ReactNode } from 'react';
import { useController, type RefCallBack } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { useRegisterField } from '../form-context';

export type FieldControlProps<T> = {
  // Belongs on the control itself, so the label points at it.
  id: string;
  // For controls a <label for> cannot name, like a radio group or a switch.
  labelId: string;
  name: string;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  onBlur: () => void;
  // Lets react-hook-form focus this control when it is the first invalid one.
  ref: RefCallBack;
  invalid: boolean;
  required: boolean;
  describedBy: string | undefined;
};

type FieldShellProps<T> = {
  name: string;
  label: string;
  hideLabel?: boolean;
  description?: string;
  required?: boolean;
  className?: string;
  // Beside the control instead of above it, for a switch.
  layout?: 'stack' | 'row';
  // Set while a cascade parent is empty. The field stays registered with
  // react-hook-form, so its value still submits and resets.
  hidden?: boolean;
  children: (control: FieldControlProps<T>) => ReactNode;
};

/**
 * The label, description and message frame every field shares. Fields read
 * react-hook-form through useController, so the control gets its id, ref and
 * aria wiring handed to it directly.
 */
export function FieldShell<T>({
  name,
  label,
  hideLabel,
  description,
  required = false,
  className,
  layout = 'stack',
  hidden,
  children,
}: FieldShellProps<T>) {
  const id = useId();
  const { field, fieldState } = useController({ name });
  useRegisterField(name, label, !hidden);

  if (hidden) return null;

  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const messageId = `${id}-message`;
  const error = fieldState.error?.message;
  const describedBy =
    [description && descriptionId, error && messageId]
      .filter(Boolean)
      .join(' ') || undefined;

  const labelNode = (
    <label
      id={labelId}
      htmlFor={id}
      data-slot="form-label"
      data-error={Boolean(error)}
      className={cn(
        'flex items-center gap-1 text-sm leading-snug font-medium text-foreground select-none data-[error=true]:text-destructive',
        hideLabel && 'sr-only',
      )}
    >
      {label}
      {required ? (
        <span aria-hidden className="text-destructive">
          *
        </span>
      ) : null}
    </label>
  );

  const descriptionNode = description ? (
    <p
      id={descriptionId}
      data-slot="form-description"
      className="text-xs leading-normal text-muted-foreground"
    >
      {description}
    </p>
  ) : null;

  const control = children({
    id,
    labelId,
    name: field.name,
    value: field.value as T | undefined,
    onChange: field.onChange,
    onBlur: field.onBlur,
    ref: field.ref,
    invalid: Boolean(error),
    required,
    describedBy,
  });

  return (
    <div
      data-slot="form-item"
      className={cn('grid content-start gap-1.5', className)}
    >
      {layout === 'row' ? (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
          <div className="grid min-w-0 gap-1">
            {labelNode}
            {descriptionNode}
          </div>
          {control}
        </div>
      ) : (
        <>
          {labelNode}
          {control}
          {descriptionNode}
        </>
      )}

      {error ? (
        <p
          id={messageId}
          data-slot="form-message"
          className="text-xs leading-normal text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
