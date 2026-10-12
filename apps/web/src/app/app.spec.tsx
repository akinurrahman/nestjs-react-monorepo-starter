import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useConfirm } from '@/systems/confirmation';
import { useThemeStore } from '@/systems/theme/theme-store';
import { renderApp } from '@/test/render-app';

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
});
