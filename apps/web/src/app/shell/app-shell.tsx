import type { MouseEvent } from 'react';
import { Outlet } from 'react-router';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import type { AppRouteObject } from '@/systems/router';
import { ThemeToggle } from '@/systems/theme';
import { AppSidebar } from './app-sidebar';

const MAIN_ID = 'main-content';

// --table-offset is the space above a page's content, header plus page
// padding, for tables that size themselves to the viewport. Pages can
// override it. The value gets tuned in 5d.
const SHELL_VARS =
  '[--header-height:--spacing(14)] [--page-padding:--spacing(4)] md:[--page-padding:--spacing(6)] [--table-offset:calc(var(--header-height)+var(--page-padding))]';

// Focuses main directly instead of following the hash, which would add a
// history entry for the router and does not move focus in every browser.
function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  document.getElementById(MAIN_ID)?.focus();
}

export function AppShell({
  navRoutes,
}: {
  navRoutes: readonly AppRouteObject[];
}) {
  return (
    <SidebarProvider className={SHELL_VARS}>
      <a
        href={`#${MAIN_ID}`}
        onClick={skipToContent}
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground ring-3 ring-ring/50 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AppSidebar routes={navRoutes} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background px-(--page-padding)">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main
          id={MAIN_ID}
          tabIndex={-1}
          className="w-full flex-1 p-(--page-padding) outline-none"
        >
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
