import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { apiCall } from '@/lib/api/api-call';
import { useConfirm } from '@/systems/confirmation';
import { useThemeStore } from '@/systems/theme/theme-store';
import {
  findLoginHeading,
  preloadLoginPage,
  refreshFails,
  unauthorized,
} from '@/test/auth-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render-app';

beforeAll(preloadLoginPage, 30_000);

function ProvidersPage() {
  const confirm = useConfirm();
  return (
    <>
      <button type="button" onClick={() => toast.success('Saved')}>
        Toast
      </button>
      <button
        type="button"
        onClick={() => confirm({ title: 'Delete thing', onConfirm: vi.fn() })}
      >
        Confirm
      </button>
    </>
  );
}

function ToastActionPage() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() =>
        toast('Report ready', {
          action: { label: 'Open', onClick: () => void navigate('/c') },
        })
      }
    >
      Toast
    </button>
  );
}

describe('App providers', () => {
  it('runs a toast action navigate after its page unmounts', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(
      [
        { path: 'a', Component: ToastActionPage },
        { path: 'b', element: <p>page b</p> },
        { path: 'c', element: <p>page c</p> },
      ],
      '/a',
    );

    await user.click(await screen.findByRole('button', { name: 'Toast' }));
    await screen.findByText('Report ready');
    await act(() => router.navigate('/b'));
    await screen.findByText('page b');
    expect(
      screen.queryByRole('button', { name: 'Toast' }),
    ).not.toBeInTheDocument();

    // A pointer click reaches Sonner's swipe handler, which calls
    // setPointerCapture, and jsdom has none.
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(await screen.findByText('page c')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/c');
  });

  it('renders a toast from a page', async () => {
    const user = userEvent.setup();
    renderApp([{ index: true, Component: ProvidersPage }]);

    await user.click(await screen.findByRole('button', { name: 'Toast' }));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('gives the Toaster the resolved theme', async () => {
    const user = userEvent.setup();
    useThemeStore.setState({ theme: 'dark' });
    renderApp([{ index: true, Component: ProvidersPage }]);

    await user.click(await screen.findByRole('button', { name: 'Toast' }));
    await screen.findByText('Saved');

    expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute(
      'data-sonner-theme',
      'dark',
    );
  });

  it('renders a confirm dialog from a page', async () => {
    const user = userEvent.setup();
    renderApp([{ index: true, Component: ProvidersPage }]);

    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alertdialog')).toHaveAccessibleName(
      'Delete thing',
    );
  });

  // The host sits beside the router, so nothing inside a page closes it.
  it('closes a confirm dialog when the page changes', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(
      [
        { path: 'a', Component: ProvidersPage },
        { path: 'b', element: <p>page b</p> },
      ],
      '/a',
    );
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await screen.findByRole('alertdialog');

    await act(() => router.navigate('/b'));

    await screen.findByText('page b');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('closes a confirm dialog when confirming ends the session', async () => {
    function DeletePage() {
      const confirm = useConfirm();
      return (
        <button
          type="button"
          onClick={() =>
            confirm({
              title: 'Delete thing',
              confirmText: 'Delete',
              onConfirm: async () => {
                await apiCall<null>('/things/1', { method: 'DELETE' });
              },
            })
          }
        >
          Confirm
        </button>
      );
    }
    server.use(
      http.delete('/api/things/1', () =>
        HttpResponse.json(unauthorized, { status: 401 }),
      ),
    );
    refreshFails();
    const user = userEvent.setup();
    renderApp([{ path: 'a', Component: DeletePage }], '/a');
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await screen.findByRole('alertdialog');

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await findLoginHeading()).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});
