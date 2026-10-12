import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test/render-with-query';
import { FormSection } from './form-section';

// The submit waits a beat before it settles, to show the pending state.
const SETTLE_MS = 3_000;

describe('FormSection', () => {
  it('shows server errors through a real submit', async () => {
    const user = userEvent.setup();
    renderWithQuery(<FormSection />);

    await user.click(
      screen.getByRole('button', { name: 'Show server errors' }),
    );

    expect(
      await screen.findByRole('alert', {}, { timeout: SETTLE_MS }),
    ).toHaveTextContent('The server rejected some of these values');
    expect(
      screen.getByRole('textbox', { name: /^Name/ }),
    ).toHaveAccessibleDescription('Input, text. The server rejected name');
  });
});
