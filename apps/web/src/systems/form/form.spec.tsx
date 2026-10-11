import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ErrorResponse } from '@starter/shared';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { ApiError } from '@/lib/api/api-error';
import { conflict, validationFailed } from '@/test/error-fixtures';
import { expectNoUnhandledRejection } from '@/test/unhandled-rejections';
import { InputField } from './fields/input-field';
import { Form, FormError, type FormSchema } from './form';

function apiError(body: ErrorResponse): ApiError {
  return new ApiError({
    status: body.statusCode,
    code: body.code,
    message: body.message,
    fieldErrors: body.errors,
  });
}

const userSchema = z.object({
  name: z.string(),
  email: z.string(),
});

function renderForm<S extends FormSchema>(
  schema: S,
  onSubmit: (values: z.output<S>) => unknown,
  children: ReactNode,
) {
  render(
    <Form schema={schema} onSubmit={onSubmit}>
      {children}
      <FormError />
      <button type="submit">Save</button>
    </Form>,
  );
  return userEvent.setup();
}

function renderUserForm(onSubmit: () => unknown) {
  return renderForm(
    userSchema,
    onSubmit,
    <>
      <InputField name="name" label="Name" />
      <InputField name="email" label="Email" />
    </>,
  );
}

describe('Form', () => {
  it('submits the coerced and defaulted output', async () => {
    const schema = z.object({
      age: z.coerce.number(),
      role: z.string().default('member'),
    });
    const onSubmit = vi.fn((values: z.output<typeof schema>) => {
      expectTypeOf(values).toEqualTypeOf<{ age: number; role: string }>();
    });
    const user = renderForm(
      schema,
      onSubmit,
      <InputField name="age" label="Age" />,
    );

    await user.type(screen.getByRole('textbox', { name: 'Age' }), '42');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual({ age: 42, role: 'member' });
  });

  it('types onSubmit with the schema output and the form with its input', () => {
    const schema = z.object({ age: z.coerce.number() });

    render(
      <Form
        schema={schema}
        onSubmit={(values, form) => {
          expectTypeOf(values).toEqualTypeOf<{ age: number }>();
          expectTypeOf(form.getValues()).toEqualTypeOf<{ age: unknown }>();
        }}
      >
        {null}
      </Form>,
    );
  });

  it('puts server field errors on their fields and focuses the first', async () => {
    const user = renderUserForm(() => {
      throw apiError(validationFailed);
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const email = screen.getByRole('textbox', { name: 'Email' });
    const name = screen.getByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription('Invalid email address');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Required');
    // validationFailed lists email first.
    expect(email).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends a field error with an unknown path to FormError', async () => {
    const user = renderForm(
      userSchema,
      () => {
        throw apiError(validationFailed);
      },
      <InputField name="name" label="Name" />,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Validation failed',
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('sends a 409 to FormError', async () => {
    const user = renderUserForm(() => Promise.reject(apiError(conflict)));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Resource already exists',
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('turns a thrown non-ApiError into a FormError without an unhandled rejection', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const user = renderUserForm(async () => {
      throw new TypeError('boom');
    });

    await expectNoUnhandledRejection(async () => {
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
    expect(consoleError).toHaveBeenCalledWith(expect.any(TypeError));
    consoleError.mockRestore();
  });

  it('clears the previous FormError on the next submit', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(apiError(conflict))
      .mockResolvedValueOnce(undefined);
    const user = renderUserForm(onSubmit);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
