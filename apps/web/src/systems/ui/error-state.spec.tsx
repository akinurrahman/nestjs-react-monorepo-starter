import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api/api-error';
import { userNotFound } from '@/test/error-fixtures';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('shows the message from an ApiError', () => {
    render(
      <ErrorState
        error={
          new ApiError({
            status: userNotFound.statusCode,
            code: userNotFound.code,
            message: userNotFound.message,
          })
        }
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('User not found');
  });

  it('falls back to a generic message without an error', () => {
    render(<ErrorState />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
  });

  it('calls onRetry from the retry button', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('has no retry button without onRetry', () => {
    render(<ErrorState />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders its action beside retry', () => {
    render(
      <ErrorState
        onRetry={vi.fn()}
        action={<button type="button">Go home</button>}
      />,
    );

    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Retry', 'Go home']);
  });
});
