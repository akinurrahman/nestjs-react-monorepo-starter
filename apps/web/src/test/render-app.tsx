import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { toast } from 'sonner';
import { App } from '@/app/app';
import { buildRoutes } from '@/app/routes';
import type { AppRouteObject } from '@/systems/router';
import { createTestQueryClient } from './render-with-query';

// The real app root and route tree, with test pages in place of the
// features, on a memory router at a starting URL.
export function renderApp(pages: AppRouteObject[], url = '/') {
  const router = createMemoryRouter(buildRoutes(pages), {
    initialEntries: [url],
  });
  const queryClient = createTestQueryClient();
  // Sonner replays the active toasts of an earlier test to a new Toaster.
  toast.dismiss();
  // ScrollRestoration scrolls on every navigation, and jsdom has no scrollTo.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

  const result = render(<App router={router} queryClient={queryClient} />);
  return { ...result, router, queryClient };
}
