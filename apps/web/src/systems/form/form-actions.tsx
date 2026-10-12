import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FormActionsProps = {
  submitLabel: string;
  // Shown while the write is in flight, e.g. "Saving".
  pendingLabel?: string;
  isPending?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  className?: string;
};

export function FormActions({
  submitLabel,
  pendingLabel = 'Saving',
  isPending = false,
  onCancel,
  cancelLabel = 'Cancel',
  className,
}: FormActionsProps) {
  return (
    <div
      data-slot="form-actions"
      className={cn('flex shrink-0 items-center justify-end gap-2', className)}
    >
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="animate-spin" />
            {pendingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  );
}
