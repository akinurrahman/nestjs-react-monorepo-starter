import { useEffect, useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import type { AppRouteObject } from '@/systems/router';
import { useSession } from '@/systems/session';
import { APP_NAME, NAV_GROUPS } from '../config';
import { buildNav } from './nav';

// NavLink sets aria-current on the active entry, so the active style keys off
// that instead of a second match.
const ACTIVE =
  'aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground';

export function AppSidebar({ routes }: { routes: readonly AppRouteObject[] }) {
  const { user } = useSession();
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const groups = useMemo(
    () => buildNav(routes, user, NAV_GROUPS),
    [routes, user],
  );

  // The mobile sheet closes once a navigation commits, whatever started it.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/" />} tooltip={APP_NAME}>
              <span
                aria-hidden="true"
                className="flex size-4 items-center justify-center rounded-sm bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground"
              >
                {APP_NAME.charAt(0)}
              </span>
              <span className="font-semibold">{APP_NAME}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Main">
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        render={
                          <NavLink to={item.path} end={item.path === '/'} />
                        }
                        tooltip={item.title}
                        className={ACTIVE}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
