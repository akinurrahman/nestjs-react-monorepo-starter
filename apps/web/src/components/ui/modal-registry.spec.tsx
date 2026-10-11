import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from './alert-dialog';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog';
import { isAnyModalOpen } from './modal-registry';
import { Sheet, SheetContent, SheetTitle } from './sheet';

function ControlledDialog({ open }: { open: boolean }) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogTitle>Controlled</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

describe('modal registry', () => {
  it('follows a controlled dialog', () => {
    const { rerender } = render(<ControlledDialog open={false} />);
    expect(isAnyModalOpen()).toBe(false);

    rerender(<ControlledDialog open />);
    expect(isAnyModalOpen()).toBe(true);

    rerender(<ControlledDialog open={false} />);
    expect(isAnyModalOpen()).toBe(false);
  });

  it('follows an uncontrolled dialog through onOpenChange', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Uncontrolled</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(isAnyModalOpen()).toBe(true);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(isAnyModalOpen()).toBe(false);
  });

  it('ignores an open the caller canceled', async () => {
    const user = userEvent.setup();
    render(
      <Dialog onOpenChange={(_open, details) => details.cancel()}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Blocked</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(isAnyModalOpen()).toBe(false);
  });

  it('forgets a dialog that unmounts while open', () => {
    const { unmount } = render(<ControlledDialog open />);
    expect(isAnyModalOpen()).toBe(true);

    unmount();

    expect(isAnyModalOpen()).toBe(false);
  });

  it('counts each open modal', () => {
    const { rerender } = render(
      <>
        <ControlledDialog open />
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogTitle>Alert</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      </>,
    );
    expect(isAnyModalOpen()).toBe(true);

    rerender(
      <>
        <ControlledDialog open={false} />
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogTitle>Alert</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      </>,
    );
    expect(isAnyModalOpen()).toBe(true);
  });

  it('leaves out a sheet that opts out', () => {
    render(
      <Sheet open trackModal={false}>
        <SheetContent>
          <SheetTitle>Sidebar</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(isAnyModalOpen()).toBe(false);
  });

  it('tracks a sheet by default', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Form</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(isAnyModalOpen()).toBe(true);
  });
});
