import type { ReactNode } from 'react';
import type { DefaultValues } from 'react-hook-form';
import type { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  Form,
  FormError,
  type FormInstance,
  type FormProps,
  type FormSchema,
} from './form';
import { FormActions } from './form-actions';

export type FormSheetProps<S extends FormSchema> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  // Reopening on another record must start from that record, not from what
  // the last edit left behind, so pass its id.
  formKey?: string;
  schema: S;
  defaultValues?: DefaultValues<z.input<S>>;
  submitLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  // Closing is the caller's call: close in the mutation's onSuccess, so a
  // rejected write keeps the typed values on screen.
  onSubmit: FormProps<S>['onSubmit'];
  children: ReactNode | ((form: FormInstance<S>) => ReactNode);
  // Width override, e.g. sm:max-w-2xl for a two-column form.
  className?: string;
};

export function FormSheet<S extends FormSchema>({
  open,
  onOpenChange,
  title,
  description,
  formKey,
  schema,
  defaultValues,
  submitLabel,
  cancelLabel,
  pendingLabel,
  isPending,
  onSubmit,
  children,
  className,
}: FormSheetProps<S>) {
  return (
    <Sheet
      open={open}
      // Escape, the overlay and the close button would drop the sheet while
      // the write is still in flight, and its result would land on nothing.
      onOpenChange={(next) => {
        if (!next && isPending) return;
        onOpenChange(next);
      }}
    >
      <SheetContent className={cn('w-full gap-0 p-0 sm:max-w-md', className)}>
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        <Form
          key={formKey}
          schema={schema}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          {(form) => (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                {typeof children === 'function' ? children(form) : children}
              </div>

              <div className="grid shrink-0 gap-3 border-t border-border bg-popover px-6 py-4">
                <FormError />
                <FormActions
                  submitLabel={submitLabel}
                  cancelLabel={cancelLabel}
                  pendingLabel={pendingLabel}
                  isPending={isPending}
                  onCancel={() => onOpenChange(false)}
                />
              </div>
            </>
          )}
        </Form>
      </SheetContent>
    </Sheet>
  );
}
