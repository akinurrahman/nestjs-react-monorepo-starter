import * as React from 'react';
import { create } from 'zustand';

// Base UI has no global "is a modal open" query, so the modal primitives in
// this folder report their own open state here, through nothing but Base
// UI's public open, defaultOpen and onOpenChange. A modal built straight on
// @base-ui/react instead of these files is not tracked.
const useModalRegistry = create<{ open: ReadonlySet<symbol> }>()(() => ({
  open: new Set(),
}));

export function isAnyModalOpen(): boolean {
  return useModalRegistry.getState().open.size > 0;
}

// The entry goes when the modal closes or unmounts, whichever comes first.
function useRegisterOpen(open: boolean, track: boolean) {
  React.useEffect(() => {
    if (!open || !track) return;
    const id = Symbol('modal');
    useModalRegistry.setState((state) => ({
      open: new Set(state.open).add(id),
    }));
    return () => {
      useModalRegistry.setState((state) => {
        const next = new Set(state.open);
        next.delete(id);
        return { open: next };
      });
    };
  }, [open, track]);
}

type RootOpenProps<Details extends { isCanceled: boolean }> = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: Details) => void;
};

/**
 * For a modal Root wrapper. A controlled Root reports its open prop; an
 * uncontrolled one mirrors what Base UI passes to onOpenChange, unless the
 * caller's handler canceled the change. Returns the onOpenChange to hand to
 * the Base UI Root in place of the caller's.
 */
export function useTrackedModalOpen<Details extends { isCanceled: boolean }>(
  { open, defaultOpen = false, onOpenChange }: RootOpenProps<Details>,
  track = true,
) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  useRegisterOpen(open ?? uncontrolledOpen, track);

  return React.useCallback(
    (next: boolean, details: Details) => {
      onOpenChange?.(next, details);
      if (!details.isCanceled) setUncontrolledOpen(next);
    },
    [onOpenChange],
  );
}
