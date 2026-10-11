import { useMemo, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FormProvider,
  useForm,
  useFormState,
  type DefaultValues,
  type FieldValues,
  type Mode,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';
import { isApiError } from '@/lib/api/api-error';
import { cn } from '@/lib/utils';
import { markErrorHandled } from '@/systems/api';
import { FieldRegistryContext, type FieldRegistry } from './form-context';
import { getDefaults } from './lib/schema-defaults';
import { applyServerError, ROOT_ERROR } from './lib/server-errors';

export type FormSchema = z.ZodType<FieldValues, FieldValues>;

export type FormInstance<S extends FormSchema> = UseFormReturn<
  z.input<S>,
  unknown,
  z.output<S>
>;

export type FormProps<S extends FormSchema> = {
  schema: S;
  defaultValues?: DefaultValues<z.input<S>>;
  // A rejection is mapped onto the form, so callers await their mutation
  // and let it throw rather than catching it themselves.
  onSubmit: (values: z.output<S>, form: FormInstance<S>) => unknown;
  children: ReactNode | ((form: FormInstance<S>) => ReactNode);
  mode?: Mode;
  id?: string;
  className?: string;
};

export function Form<S extends FormSchema>({
  schema,
  defaultValues,
  onSubmit,
  children,
  mode = 'onSubmit',
  id,
  className,
}: FormProps<S>) {
  const [registry] = useState<FieldRegistry>(() => new Set());

  // Caller defaults win over the seeded empties.
  const mergedDefaults = useMemo(() => {
    const callerDefaults: FieldValues | undefined = defaultValues;
    return { ...getDefaults(schema), ...callerDefaults } as DefaultValues<
      z.input<S>
    >;
  }, [schema, defaultValues]);

  const form = useForm<z.input<S>, unknown, z.output<S>>({
    // For a generic S, inference falls back to the default T and types the
    // resolver as FieldValues. Naming T as S makes the return
    // Resolver<z.input<S>, unknown, z.output<S>>. The first three only bound T.
    resolver: zodResolver<FieldValues, unknown, FieldValues, S>(schema),
    defaultValues: mergedDefaults,
    mode,
  });

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors(ROOT_ERROR);
    try {
      await onSubmit(values, form);
    } catch (error) {
      // An ApiError is an expected outcome. Anything else is a bug the
      // person still gets a message for, but a developer should see.
      if (import.meta.env.DEV && !isApiError(error)) console.error(error);
      applyServerError(form.setError, error, registry);
      markErrorHandled(error);
    }
  });

  return (
    <FormProvider {...form}>
      <FieldRegistryContext value={registry}>
        <form
          id={id}
          noValidate
          onSubmit={(event) => void submit(event)}
          className={className}
        >
          {typeof children === 'function' ? children(form) : children}
        </form>
      </FieldRegistryContext>
    </FormProvider>
  );
}

export function FormError({ className }: { className?: string }) {
  const { errors } = useFormState({ name: ROOT_ERROR });
  const message = errors.root?.server?.message;
  if (!message) return null;

  return (
    <p
      role="alert"
      data-slot="form-error"
      className={cn(
        'rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className,
      )}
    >
      {message}
    </p>
  );
}
