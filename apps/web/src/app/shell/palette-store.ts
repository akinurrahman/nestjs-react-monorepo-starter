import { create } from 'zustand';

export const usePaletteStore = create<{ open: boolean }>()(() => ({
  open: false,
}));

export function setPaletteOpen(open: boolean): void {
  usePaletteStore.setState({ open });
}
