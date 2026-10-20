import type { FieldError } from '@starter/shared';
import type { UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api/api-error';
import { applyServerError, ROOT_ERROR } from './server-errors';

function validationError(fieldErrors: FieldError[]): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
    fieldErrors,
  });
}

function fieldError(path: string, message = `${path} is wrong`): FieldError {
  return { path, message, code: 'custom' };
}

function apply(fieldErrors: FieldError[], fieldNames: string[]) {
  const setError = vi.fn();
  applyServerError(
    setError as UseFormSetError<Record<string, unknown>>,
    validationError(fieldErrors),
    new Set(fieldNames),
  );
  return setError;
}

describe('applyServerError', () => {
  it('lands an array item error on the array field', () => {
    const setError = apply([fieldError('role.0')], ['name', 'role']);

    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith(
      'role',
      { type: 'server', message: 'role.0 is wrong' },
      { shouldFocus: true },
    );
  });

  it('keeps a nested path on its own field when that field is registered', () => {
    const setError = apply(
      [fieldError('address.city')],
      ['address', 'address.city'],
    );

    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith(
      'address.city',
      { type: 'server', message: 'address.city is wrong' },
      { shouldFocus: true },
    );
  });

  it('falls back to the parent field when only the parent is registered', () => {
    const setError = apply([fieldError('address.city')], ['address']);

    expect(setError).toHaveBeenCalledWith(
      'address',
      expect.objectContaining({ message: 'address.city is wrong' }),
      { shouldFocus: true },
    );
  });

  it('keeps the first message when two errors land on one field', () => {
    const setError = apply(
      [fieldError('role.0', 'First'), fieldError('role.1', 'Second')],
      ['role'],
    );

    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith(
      'role',
      { type: 'server', message: 'First' },
      { shouldFocus: true },
    );
  });

  it('focuses only the first field marked', () => {
    const setError = apply(
      [fieldError('email'), fieldError('name')],
      ['name', 'email'],
    );

    expect(setError).toHaveBeenNthCalledWith(1, 'email', expect.anything(), {
      shouldFocus: true,
    });
    expect(setError).toHaveBeenNthCalledWith(2, 'name', expect.anything(), {
      shouldFocus: false,
    });
  });

  it.each([
    ['an unknown path', 'owner.id'],
    ['the root path', ''],
  ])('sends %s to the form-level message', (_, path) => {
    const setError = apply([fieldError(path)], ['name']);

    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith(ROOT_ERROR, {
      type: 'server',
      message: 'Validation failed',
    });
  });

  it('adds the form-level message when some errors have no field', () => {
    const setError = apply([fieldError('name'), fieldError('')], ['name']);

    expect(setError).toHaveBeenCalledWith('name', expect.anything(), {
      shouldFocus: true,
    });
    expect(setError).toHaveBeenCalledWith(ROOT_ERROR, {
      type: 'server',
      message: 'Validation failed',
    });
  });
});
