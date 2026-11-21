import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '@/test/render-with-router';
import { FiltersSection } from './filters-section';

describe('FiltersSection search', () => {
  it('replaces the history entry for a typed search', async () => {
    const user = userEvent.setup();
    const { router, searchParams } = renderWithRouter(<FiltersSection />, {
      withQuery: true,
    });

    await user.type(
      screen.getByRole('searchbox', { name: 'Search people' }),
      'ada',
    );

    await waitFor(() => expect(searchParams().get('search')).toBe('ada'));
    expect(router.state.historyAction).toBe('REPLACE');
  });
});
