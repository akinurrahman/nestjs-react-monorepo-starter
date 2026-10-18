import type { ReactNode } from 'react';
import { create } from 'zustand';

export type ConfirmVariant = 'default' | 'destructive' | 'warning';

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  variant?: ConfirmVariant;
  confirmText?: string;
  cancelText?: string;
  // Shown on the confirm button while onConfirm runs, e.g. "Archiving".
  pendingText?: string;
  onConfirm: () => void | Promise<void>;
};

type ConfirmationState = {
  open: boolean;
  // Kept after close so the dialog keeps its content while it animates out.
  options: ConfirmOptions | null;
  isPending: boolean;
};

export const useConfirmationStore = create<ConfirmationState>()(() => ({
  open: false,
  options: null,
  isPending: false,
}));

const { getState, setState } = useConfirmationStore;

export function confirm(options: ConfirmOptions): void {
  if (getState().isPending) return;
  setState({ open: true, options, isPending: false });
}

export function cancelConfirmation(): void {
  if (getState().isPending) return;
  setState({ open: false });
}

// Closes the dialog even while onConfirm runs: the page or the session it
// was asked for is gone. The app calls it on a page change and when the
// session ends, since the host sits outside the router.
export function resetConfirmation(): void {
  setState({ open: false, isPending: false });
}

export async function runConfirmation(): Promise<void> {
  const { options, isPending } = getState();
  if (!options || isPending) return;

  setState({ isPending: true });
  // After a reset, a newer dialog may be open by the time this settles, and
  // it is not this run's to close.
  const isCurrent = () => getState().options === options;
  try {
    await options.onConfirm();
  } catch {
    // The mutation's error toast reports it. Staying open lets the user
    // retry or cancel, and swallowing it keeps the rejection handled.
    if (isCurrent()) setState({ isPending: false });
    return;
  }
  if (isCurrent()) setState({ open: false, isPending: false });
}
