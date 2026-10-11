import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('App providers', () => {
  it('renders a toast from a page', async () => {
    renderApp([{ index: true, Component: ProvidersPage }]);

    await userEvent.click(await screen.findByRole('button', { name: 'Toast' }));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('gives the Toaster the resolved theme', async () => {
    useThemeStore.setState({ theme: 'dark' });
    renderApp([{ index: true, Component: ProvidersPage }]);

    await userEvent.click(await screen.findByRole('button', { name: 'Toast' }));
    await screen.findByText('Saved');

    expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute(
      'data-sonner-theme',
      'dark',
    );
  });

  it('renders a confirm dialog from a page', async () => {
    renderApp([{ index: true, Component: ProvidersPage }]);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm' }),
    );

    expect(await screen.findByRole('alertdialog')).toHaveAccessibleName(
      'Delete thing',
    );
  });
});
