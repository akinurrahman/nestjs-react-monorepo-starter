import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '@/test/render-with-router';
import { TableSection } from './table-section';

const clearButton = () =>
  screen.queryByRole('button', { name: 'Clear filters' });

describe('TableSection empty state', () => {
  it('offers to clear filters that left nothing, paging included', async () => {
    const user = userEvent.setup();
    const { searchParams } = renderWithRouter(<TableSection />, {
      url: '/?search=nobody-at-all&page=2&limit=50&tab=notes',
    });

    expect(screen.getByText('No people match')).toBeInTheDocument();
    await user.click(clearButton()!);

    await waitFor(() => expect(searchParams().toString()).toBe('tab=notes'));
    expect(clearButton()).not.toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2);
  });

  it('offers nothing to clear when the list is empty unfiltered', async () => {
    const user = userEvent.setup();
    renderWithRouter(<TableSection />, { url: '/?page=2&limit=50' });

    await user.click(screen.getByRole('switch', { name: 'Empty' }));

    expect(screen.getByText('No people yet')).toBeInTheDocument();
    expect(clearButton()).not.toBeInTheDocument();
  });
});
