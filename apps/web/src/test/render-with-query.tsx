import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { createQueryClient } from '@/systems/api';

// The app's retry rules, without the backoff wait between attempts.
export function createTestQueryClient() {
  const client = createQueryClient();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, retryDelay: 0 },
  });
  return client;
}

export function renderWithQuery(ui: ReactNode) {
  const client = createTestQueryClient();

  // Sonner keeps toasts in a module store and replays the active ones to a
  // new Toaster, so an earlier test's toasts would show up in this one.
  toast.dismiss();

  const result = render(
    <QueryClientProvider client={client}>
      {ui}
      <Toaster />
    </QueryClientProvider>,
  );
  return { ...result, client };
}
