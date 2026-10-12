import { Info, Loader2, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { ComponentProps, ComponentType } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  cancelConfirmation,
  runConfirmation,
  useConfirmationStore,
  type ConfirmVariant,
} from './confirmation-store';

type VariantConfig = {
  icon: ComponentType<{ className?: string }>;
  mediaClassName: string;
  buttonVariant: ComponentProps<typeof Button>['variant'];
  buttonClassName?: string;
  confirmText: string;
  pendingText: string;
};

const VARIANTS: Record<ConfirmVariant, VariantConfig> = {
  default: {
    icon: Info,
    mediaClassName: 'bg-muted text-foreground',
    buttonVariant: 'default',
    confirmText: 'Confirm',
    pendingText: 'Confirming',
  },
  destructive: {
    icon: OctagonAlert,
    mediaClassName: 'bg-destructive/10 text-destructive',
    buttonVariant: 'destructive',
    confirmText: 'Delete',
    pendingText: 'Deleting',
  },
  warning: {
    icon: TriangleAlert,
    mediaClassName: 'bg-warning/15 text-warning',
    // No warning button variant exists, so it is tinted from the token.
    buttonVariant: 'default',
    buttonClassName:
      'bg-warning text-warning-foreground hover:bg-warning/80 focus-visible:border-warning/40 focus-visible:ring-warning/20',
    confirmText: 'Continue',
    pendingText: 'Working',
  },
};

export function ConfirmationHost() {
  const open = useConfirmationStore((state) => state.open);
  const options = useConfirmationStore((state) => state.options);
  const isPending = useConfirmationStore((state) => state.isPending);

  if (!options) return null;

  const variant = VARIANTS[options.variant ?? 'default'];
  const Icon = variant.icon;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) cancelConfirmation();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className={variant.mediaClassName}>
            <Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description ? (
            <AlertDialogDescription>
              {options.description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {options.cancelText ?? 'Cancel'}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={variant.buttonVariant}
            className={variant.buttonClassName}
            disabled={isPending}
            onClick={() => void runConfirmation()}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                {options.pendingText ?? variant.pendingText}
              </>
            ) : (
              (options.confirmText ?? variant.confirmText)
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
