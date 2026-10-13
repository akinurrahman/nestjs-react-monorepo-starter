import { setPaletteOpen, usePaletteStore } from '@/app/shell/palette-store';
import { useSidebarStore } from '@/components/ui/sidebar-store';
import { getAccessToken } from '@/lib/api/access-token';
import {
  confirm,
  useConfirmationStore,
} from '@/systems/confirmation/confirmation-store';
import { useSessionStore } from '@/systems/session/session-store';
import { setTheme, useThemeStore } from '@/systems/theme/theme-store';
import { signIn, testUser } from './auth-fixtures';

// The two tests run in order: the first leaves every store dirty, the second
// proves setup put each one back.
describe('per-test store reset', () => {
  it('starts from dirty stores', () => {
    signIn(testUser('USER'));
    setTheme('dark');
    useSidebarStore.setState({ open: false });
    setPaletteOpen(true);
    confirm({ title: 'Leftover', onConfirm: () => {} });

    expect(useSessionStore.getState().user?.role).toBe('USER');
    expect(getAccessToken()).toBe('test-token');
  });

  it('gives the next test fresh stores', () => {
    expect(useSessionStore.getState()).toEqual(
      useSessionStore.getInitialState(),
    );
    expect(getAccessToken()).toBeNull();
    expect(useThemeStore.getState().theme).toBe('system');
    expect(useSidebarStore.getState().open).toBe(true);
    expect(usePaletteStore.getState().open).toBe(false);
    expect(useConfirmationStore.getState().options).toBeNull();
  });
});
