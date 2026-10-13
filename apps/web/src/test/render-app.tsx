import type { PublicUser } from '@starter/shared';
import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { toast } from 'sonner';
import { App } from '@/app/app';
import { buildRoutes } from '@/app/routes';
import { authRoutes } from '@/features/auth';
import type { AppRouteObject } from '@/systems/router';
import { endSession } from '@/systems/session';
import { signIn, testUser } from './auth-fixtures';
import { createTestQueryClient } from './render-with-query';

type RenderAppOptions = {
  // Signed in as this user, or signed out with null. Default: a test ADMIN.
  // A test about access or roles passes its user explicitly.
  user?: PublicUser | null;
  // Runs the real startup refresh instead, against an msw handler the test
  // sets up. `user` is ignored.
  restore?: boolean;
  // Renders inside StrictMode, which mounts every effect twice.
  strict?: boolean;
};

// The real app root and route tree, with test pages in place of the
// features and the real auth pages beside them, on a memory router at a
// starting URL.
export function renderApp(
  pages: AppRouteObject[],
  url = '/',
  { user = testUser(), restore = false, strict = false }: RenderAppOptions = {},
) {
  if (!restore) {
    if (user) signIn(user);
    else endSession(null);
  }

  const router = createMemoryRouter(buildRoutes(pages, authRoutes), {
    initialEntries: [url],
  });
  const queryClient = createTestQueryClient();
  // Sonner replays the active toasts of an earlier test to a new Toaster.
  toast.dismiss();
  // ScrollRestoration scrolls on every navigation, and jsdom has no scrollTo.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

  const result = render(<App router={router} queryClient={queryClient} />, {
    reactStrictMode: strict,
  });
  return { ...result, router, queryClient };
}
