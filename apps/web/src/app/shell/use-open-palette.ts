import { useCallback } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { setPaletteOpen } from './palette-store';

// Closes the mobile sidebar sheet first, so two overlays never stack.
export function useOpenPalette(): () => void {
  const { setOpenMobile } = useSidebar();
  return useCallback(() => {
    setOpenMobile(false);
    setPaletteOpen(true);
  }, [setOpenMobile]);
}
