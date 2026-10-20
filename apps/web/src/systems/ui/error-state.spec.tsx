import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api/api-error';
import { notFound } from '@/test/error-fixtures';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('shows the message from an ApiError', () => {
    render(
      <ErrorState
        error={
          new ApiError({
            status: notFound.statusCode,
            code: notFound.code,
            message: notFound.message,
          })
        }
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Resource not found');
  });

  // It replaces the page, so its title is the page's only heading.
  it('titles the page with an h1', () => {
    render(<ErrorState />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Couldn't load this data",
      }),
    ).toBeInTheDocument();
  });

  it('takes the heading level from level', () => {
    render(<ErrorState title="Failed" level={3} />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Failed' }),
    ).toBeInTheDocument();
  });

  it('falls back to a generic message without an error', () => {
    render(<ErrorState />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
  });

  it('calls onRetry from the retry button', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

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
