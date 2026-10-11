import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const SIDEBAR_STORAGE_KEY = 'ui-sidebar';

// Replaces the stock cookie. Only the desktop expanded state persists; the
// mobile sheet always starts closed. Its own file, so code that needs only
// the state, like test setup, does not load the sidebar's components.
type SidebarState = { open: boolean };

export const useSidebarStore = create<SidebarState>()(
  persist((): SidebarState => ({ open: true }), { name: SIDEBAR_STORAGE_KEY }),
);
