import { useCallback } from 'react';
import { create } from 'zustand';
import { useSidebar } from '@/components/ui/sidebar';

export const usePaletteStore = create<{ open: boolean }>()(() => ({
  open: false,
}));

export function setPaletteOpen(open: boolean): void {
  usePaletteStore.setState({ open });
}

// Closes the mobile sidebar sheet first, so two overlays never stack.
export function useOpenPalette(): () => void {
  const { setOpenMobile } = useSidebar();
  return useCallback(() => {
    setOpenMobile(false);
    setPaletteOpen(true);
  }, [setOpenMobile]);
}
