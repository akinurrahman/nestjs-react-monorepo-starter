import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectNoUnhandledRejection } from '@/test/unhandled-rejections';
import { ConfirmationHost } from './confirmation-host';
import {
  confirm,
  resetConfirmation,
  useConfirmationStore,
  type ConfirmOptions,
} from './confirmation-store';
import { useConfirm } from './use-confirm';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Trigger({ options }: { options: ConfirmOptions }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={() => confirm(options)}>
      Open {options.title}
    </button>
  );
}

function renderConfirm(options: Partial<ConfirmOptions> = {}) {
  const onConfirm = vi.fn<ConfirmOptions['onConfirm']>(options.onConfirm);
  const full: ConfirmOptions = {
    title: 'Delete team',
    description: 'This removes the team for everyone.',
    variant: 'destructive',
    ...options,
    onConfirm,
  };
  render(
    <>
      <Trigger options={full} />
      <ConfirmationHost />
    </>,
  );
  return { user: userEvent.setup(), onConfirm };
}

async function open(
  user: ReturnType<typeof userEvent.setup>,
  title = 'Delete team',
) {
  await user.click(screen.getByRole('button', { name: `Open ${title}` }));
  return screen.findByRole('alertdialog');
}

describe('confirmation', () => {
  it('opens with the title and description', async () => {
    const { user } = renderConfirm();

    const dialog = await open(user);

    expect(dialog).toHaveAccessibleName('Delete team');
    expect(dialog).toHaveAccessibleDescription(
      'This removes the team for everyone.',
    );
  });

  it('closes on cancel without confirming', async () => {
    const { user, onConfirm } = renderConfirm();
    await open(user);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on Escape while idle', async () => {
    const { user } = renderConfirm();
    await open(user);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('runs onConfirm and closes', async () => {
    const { user, onConfirm } = renderConfirm({ confirmText: 'Delete team' });
    await open(user);

    await user.click(screen.getByRole('button', { name: 'Delete team' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  describe('while onConfirm is pending', () => {
    it('disables both buttons and shows the pending label', async () => {
      const pending = deferred();
      const { user } = renderConfirm({ onConfirm: () => pending.promise });
      await open(user);

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(screen.getByRole('button', { name: 'Deleting' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      await act(async () => pending.resolve());
    });

    it('stays open on Escape and outside click', async () => {
      const pending = deferred();
      const { user } = renderConfirm({ onConfirm: () => pending.promise });
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      await user.keyboard('{Escape}');
      const overlay = document.querySelector(
        '[data-slot="alert-dialog-overlay"]',
      );
      expect(overlay).not.toBeNull();
      await user.click(overlay!);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(useConfirmationStore.getState().open).toBe(true);

      await act(async () => pending.resolve());
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    });

    it('ignores a second confirm', async () => {
      const pending = deferred();
      const { user } = renderConfirm({ onConfirm: () => pending.promise });
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      act(() => {
        confirm({ title: 'Archive team', onConfirm: vi.fn() });
      });

      expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
        'Delete team',
      );

      await act(async () => pending.resolve());
    });
  });

  it('replaces an idle dialog with a second confirm', async () => {
    const { user } = renderConfirm();
    await open(user);

    act(() => {
      confirm({ title: 'Archive team', onConfirm: vi.fn() });
    });

    expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
      'Archive team',
    );
  });

  describe('resetConfirmation', () => {
    it('closes an idle dialog', async () => {
      const { user } = renderConfirm();
      await open(user);

      act(() => resetConfirmation());

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    });

    it('closes the dialog while onConfirm is pending', async () => {
      const pending = deferred();
      const { user } = renderConfirm({ onConfirm: () => pending.promise });
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      act(() => resetConfirmation());

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(useConfirmationStore.getState().isPending).toBe(false);
      await act(async () => pending.resolve());
    });

    it('keeps a newer dialog open when the reset one finishes later', async () => {
      const pending = deferred();
      const { user } = renderConfirm({ onConfirm: () => pending.promise });
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      act(() => resetConfirmation());
      act(() => confirm({ title: 'Archive team', onConfirm: vi.fn() }));

      await act(async () => pending.resolve());

      expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
        'Archive team',
      );
      expect(useConfirmationStore.getState()).toMatchObject({
        open: true,
        isPending: false,
      });
    });
  });

  it('stays open and usable when onConfirm rejects', async () => {
    const { user, onConfirm } = renderConfirm({
      onConfirm: () => Promise.reject(new Error('Server said no')),
    });

    await expectNoUnhandledRejection(async () => {
      await open(user);

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      const confirmButton = await screen.findByRole('button', {
        name: 'Delete',
      });
      expect(confirmButton).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();

      await user.click(confirmButton);
      await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    });
  });
});
