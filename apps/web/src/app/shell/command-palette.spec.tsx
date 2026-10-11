import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChart, House, Lock, Users } from 'lucide-react';
import type { AppRouteObject } from '@/systems/router';
import { setStubRole } from '@/systems/session';
import { useThemeStore } from '@/systems/theme/theme-store';
import { confirm } from '@/systems/confirmation/confirmation-store';
import { setViewportWidth } from '@/test/match-media';
import { renderApp } from '@/test/render-app';
import { usePaletteStore } from './palette-store';

function FormPage() {
  return <input aria-label="Name" />;
}

const pages: AppRouteObject[] = [
  {
    index: true,
    handle: { title: 'Home', icon: House, nav: { group: 'General', order: 0 } },
    Component: FormPage,
  },
  {
    path: 'reports',
    handle: {
      title: 'Reports',
      icon: BarChart,
      nav: { group: 'General', order: 1 },
      keywords: ['analytics'],
    },
    element: <p>reports page</p>,
  },
  {
    path: 'members',
    handle: {
      title: 'Members',
      icon: Users,
      roles: ['USER'],
      nav: { group: 'General', order: 2 },
    },
    element: <p>members page</p>,
  },
  {
    path: 'hidden',
    handle: { title: 'Hidden page', icon: Lock },
    element: <p>hidden page</p>,
  },
];

const palette = () => screen.findByRole('dialog', { name: 'Search' });
const input = () =>
  screen.getByRole('combobox', { name: 'Search pages and actions' });
const optionNames = (groupName: string) =>
  within(screen.getByRole('group', { name: groupName }))
    .getAllByRole('option')
    .map((option) => option.textContent);
// The modal palette hides the rest of the page from assistive tech, so the
// sidebar is read with hidden: true.
const sidebarNames = () =>
  within(screen.getByRole('navigation', { name: 'Main', hidden: true }))
    .getAllByRole('link', { hidden: true })
    .map((link) => link.textContent);

async function renderShell() {
  const result = renderApp(pages, '/');
  await screen.findByRole('textbox', { name: 'Name' });
  return result;
}

describe('command palette', () => {
  describe('opening', () => {
    it.each([
      ['Ctrl+K', { ctrlKey: true }],
      ['Cmd+K', { metaKey: true }],
    ])('opens with %s and takes the key from the browser', async (_, mods) => {
      await renderShell();

      const notPrevented = fireEvent.keyDown(document.body, {
        key: 'k',
        ...mods,
      });

      expect(notPrevented).toBe(false);
      expect(await palette()).toBeInTheDocument();
    });

    it('leaves Ctrl+B to the sidebar', async () => {
      await renderShell();
      const sidebar = document.querySelector('[data-slot="sidebar"]');

      fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
      expect(sidebar).toHaveAttribute('data-state', 'expanded');
      act(() => usePaletteStore.setState({ open: false }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      fireEvent.keyDown(document.body, { key: 'b', ctrlKey: true });
      expect(sidebar).toHaveAttribute('data-state', 'collapsed');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes the mobile sidebar sheet before opening', async () => {
      setViewportWidth(500);
      const user = userEvent.setup();
      await renderShell();
      await user.click(
        document.querySelector<HTMLButtonElement>('[data-sidebar="trigger"]')!,
      );
      expect(await screen.findByRole('dialog')).toHaveAccessibleName('Sidebar');

      fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });

      await waitFor(() =>
        expect(screen.getAllByRole('dialog')).toHaveLength(1),
      );
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Search');
    });

    it('does nothing while a confirm is pending', async () => {
      await renderShell();
      act(() => confirm({ title: 'Delete team', onConfirm: vi.fn() }));
      expect(await screen.findByRole('alertdialog')).toHaveAccessibleName(
        'Delete team',
      );

      fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });

      expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
      expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
        'Delete team',
      );
      expect(usePaletteStore.getState().open).toBe(false);
    });

    it('does nothing while the palette is already open', async () => {
      const user = userEvent.setup();
      await renderShell();
      await user.keyboard('{Control>}k{/Control}');
      await palette();
      await user.type(input(), 'rep');

      await user.keyboard('{Control>}k{/Control}');

      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(input()).toHaveValue('rep');
      expect(input()).toHaveFocus();
    });

    it('opens from inside an input', async () => {
      const user = userEvent.setup();
      await renderShell();
      await user.click(screen.getByRole('textbox', { name: 'Name' }));

      await user.keyboard('{Control>}k{/Control}');

      expect(await palette()).toBeInTheDocument();
      expect(input()).toHaveFocus();
    });

    it('opens from the header button, which shows the shortcut', async () => {
      const user = userEvent.setup();
      await renderShell();
      const button = screen.getByRole('button', { name: 'Search' });
      expect(button).toHaveTextContent('Ctrl K');

      await user.click(button);

      expect(await palette()).toBeInTheDocument();
    });
  });

  describe('pages', () => {
    it('lists what the sidebar lists, in sidebar order', async () => {
      const user = userEvent.setup();
      await renderShell();
      await user.click(screen.getByRole('button', { name: 'Search' }));
      await palette();

      expect(optionNames('General')).toEqual(['Home', 'Reports']);
      expect(optionNames('General')).toEqual(sidebarNames());
      expect(screen.queryByRole('option', { name: 'Hidden page' })).toBeNull();
    });

    it('follows a role switch', async () => {
      const user = userEvent.setup();
      await renderShell();
      await user.click(screen.getByRole('button', { name: 'Search' }));
      await palette();

      act(() => setStubRole('USER'));

      expect(optionNames('General')).toEqual(['Home', 'Reports', 'Members']);
      expect(optionNames('General')).toEqual(sidebarNames());
    });
  });

  describe('search', () => {
    async function openAndType(text: string) {
      const user = userEvent.setup();
      await renderShell();
      await user.click(screen.getByRole('button', { name: 'Search' }));
      await palette();
      await user.type(input(), text);
      return user;
    }

    it('filters by title', async () => {
      await openAndType('rep');
      expect(optionNames('General')).toEqual(['Reports']);
    });

    it('filters by keyword', async () => {
      await openAndType('analytics');
      expect(optionNames('General')).toEqual(['Reports']);
    });

    it('shows No results when nothing matches', async () => {
      await openAndType('zzzz');
      expect(screen.getByText('No results')).toBeInTheDocument();
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });
  });

  describe('selecting', () => {
    it('navigates with the arrow keys and Enter, then closes', async () => {
      const user = userEvent.setup();
      await renderShell();
      await user.keyboard('{Control>}k{/Control}');
      await palette();

      await user.keyboard('{ArrowDown}{Enter}');

      expect(await screen.findByText('reports page')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('runs a theme action, then closes', async () => {
      const user = userEvent.setup();
      await renderShell();
      await user.click(screen.getByRole('button', { name: 'Search' }));
      await palette();
      expect(
        screen.getByRole('option', { name: /System theme/ }),
      ).toHaveTextContent('Current');

      await user.click(screen.getByRole('option', { name: /Dark theme/ }));

      expect(useThemeStore.getState().theme).toBe('dark');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });

  describe('closing', () => {
    it('closes on Escape and returns focus to the header button', async () => {
      const user = userEvent.setup();
      await renderShell();
      const button = screen.getByRole('button', { name: 'Search' });
      await user.click(button);
      await palette();

      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(button).toHaveFocus();
    });

    it('returns focus to the input that had it', async () => {
      const user = userEvent.setup();
      await renderShell();
      const field = screen.getByRole('textbox', { name: 'Name' });
      await user.click(field);
      await user.keyboard('{Control>}k{/Control}');
      await palette();

      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(field).toHaveFocus();
    });

    it('starts empty the next time it opens', async () => {
      const user = userEvent.setup();
      await renderShell();
      await user.keyboard('{Control>}k{/Control}');
      await palette();
      await user.type(input(), 'rep');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      await user.keyboard('{Control>}k{/Control}');
      await palette();

      expect(input()).toHaveValue('');
    });
  });
});
