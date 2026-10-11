import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { ApiError } from '@/lib/api/api-error';
import { conflict } from '@/test/error-fixtures';
import { InputField } from './fields/input-field';
import { FormSheet } from './form-sheet';

const schema = z.object({ name: z.string() });

function renderSheet(onSubmit: () => unknown, isPending = false) {
  const onOpenChange = vi.fn();
  render(
    <FormSheet
      open
      onOpenChange={onOpenChange}
      title="New team"
      schema={schema}
      submitLabel="Create"
      isPending={isPending}
      onSubmit={onSubmit}
    >
      <InputField name="name" label="Name" />
    </FormSheet>,
  );
  return { user: userEvent.setup(), onOpenChange };
}

describe('FormSheet', () => {
  it('shows a rejected submit above the actions', async () => {
    const { user } = renderSheet(() => {
      throw new ApiError({
        status: conflict.statusCode,
        code: conflict.code,
        message: conflict.message,
      });
    });

    await user.click(screen.getByRole('button', { name: 'Create' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Resource already exists');
    expect(
      alert.compareDocumentPosition(
        screen.getByRole('button', { name: 'Create' }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('closes through onOpenChange on cancel', async () => {
    const { user, onOpenChange } = renderSheet(vi.fn());

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both actions and shows the pending label while saving', () => {
    renderSheet(vi.fn(), true);

    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  const overlay = () => document.querySelector('[data-slot="sheet-overlay"]')!;

  it('closes on Escape and the overlay while idle', async () => {
    const { user, onOpenChange } = renderSheet(vi.fn());

    await user.keyboard('{Escape}');
    await user.click(overlay());

    expect(onOpenChange.mock.calls).toEqual([[false], [false]]);
  });

  it('stays open on Escape, the overlay and the close button while saving', async () => {
    const { user, onOpenChange } = renderSheet(vi.fn(), true);

    await user.keyboard('{Escape}');
    await user.click(overlay());
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: 'New team' }),
    ).toBeInTheDocument();
  });
});
