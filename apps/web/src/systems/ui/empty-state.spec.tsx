import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { AccessDeniedState } from './access-denied-state';
import { EmptyState } from './empty-state';
import { NotFoundState } from './not-found-state';

describe('EmptyState', () => {
  it('titles itself with an h2, under the page h1', () => {
    render(<EmptyState icon={Inbox} title="No invoices" description="None" />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'No invoices' }),
    ).toBeInTheDocument();
  });

  it('takes the heading level from level', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No invoices"
        description="None"
        level={3}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'No invoices' }),
    ).toBeInTheDocument();
  });
});

// Both replace the whole page, so their title is the page's only heading.
describe.each([
  ['AccessDeniedState', AccessDeniedState, 'Access denied'],
  ['NotFoundState', NotFoundState, 'Not found'],
])('%s', (_, State, title) => {
  it('titles the page with an h1', () => {
    render(<State />);

    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument();
  });

  it('takes the heading level from level', () => {
    render(<State level={3} />);

    expect(
      screen.getByRole('heading', { level: 3, name: title }),
    ).toBeInTheDocument();
  });
});
