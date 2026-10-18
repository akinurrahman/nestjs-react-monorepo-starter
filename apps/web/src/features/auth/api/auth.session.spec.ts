import { QueryClient } from '@tanstack/react-query';
import {
  confirm,
  useConfirmationStore,
} from '@/systems/confirmation/confirmation-store';
import { endLocalSession } from './auth.session';

describe('endLocalSession', () => {
  // A dialog opened for the last session must not stay over the next screen,
  // even where ending the session does not change the page.
  it('closes an open confirm dialog', () => {
    confirm({ title: 'Delete thing', onConfirm: vi.fn() });

    endLocalSession(new QueryClient(), 'expired');

    expect(useConfirmationStore.getState().open).toBe(false);
  });
});
