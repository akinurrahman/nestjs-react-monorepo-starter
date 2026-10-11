import type { MouseEvent } from 'react';
import { Outlet } from 'react-router';
import { Separator } from '@/components/ui/separator';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import type { AppRouteObject } from '@/systems/router';
import { ThemeToggle } from '@/systems/theme';
import { AppSidebar } from './app-sidebar';
import { Breadcrumbs } from './breadcrumbs';
import { CommandPalette, PaletteButton } from './command-palette';
import { useNavGroups } from './use-nav-groups';
import { UserMenu } from './user-menu';

const MAIN_ID = 'main-content';

// --table-offset is everything on a list page that is not the table body,
// so DataTable's max height leaves the page itself unscrolled from sm up:
// the header, padding above and below, and 12.5rem for a PageHeader with a
// description (5.125rem), a FilterBar (3.25rem) and the pagination row
// (3.8rem) plus borders. A page with other chrome sets its own value on a
// wrapper, as the theme preview's table section does.
const SHELL_VARS =
  '[--header-height:--spacing(14)] [--page-padding:--spacing(4)] md:[--page-padding:--spacing(6)] [--table-offset:calc(var(--header-height)+2*var(--page-padding)+12.5rem)]';

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
  const navGroups = useNavGroups(navRoutes);

  return (
    <SidebarProvider className={SHELL_VARS}>
      <a
        href={`#${MAIN_ID}`}
        onClick={skipToContent}
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground ring-3 ring-ring/50 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AppSidebar groups={navGroups} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background px-(--page-padding)">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4 self-center!" />
          <Breadcrumbs routes={navRoutes} />
          <div className="ml-auto flex items-center gap-1">
            <PaletteButton />
            <ThemeToggle />
            <UserMenu />
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
      <CommandPalette navGroups={navGroups} />
    </SidebarProvider>
  );
}
