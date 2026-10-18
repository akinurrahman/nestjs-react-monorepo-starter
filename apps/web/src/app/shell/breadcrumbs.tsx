import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link, matchRoutes } from 'react-router';
import { cn } from '@/lib/utils';
import { useHandleMatches, type AppRouteObject } from '@/systems/router';

// Below sm only the current page shows.
const ANCESTOR = 'hidden sm:flex';

// Whether visiting this path shows a page: the deepest route matching it,
// which is the index route when the parent has one, has no children and
// renders something itself. A parent without an index is a layout or a
// group, an empty Outlet at its own path, so its crumb is plain text.
function rendersPage(
  routes: readonly AppRouteObject[],
  pathname: string,
): boolean {
  const leaf = matchRoutes([...routes], pathname)?.at(-1)?.route;
  if (!leaf || leaf.children?.length) return false;
  return Boolean(leaf.element || leaf.Component || leaf.lazy);
}

export function Breadcrumbs({ routes }: { routes: readonly AppRouteObject[] }) {
  const matches = useHandleMatches();
  const crumbs = useMemo(
    () =>
      matches.flatMap((match) =>
        match.handle?.title
          ? [
              {
                id: match.id,
                title: match.handle.title,
                pathname: match.pathname,
                linkable: rendersPage(routes, match.pathname),
              },
            ]
          : [],
      ),
    [matches, routes],
  );

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          return (
            <li
              key={crumb.id}
              className={cn(
                'min-w-0 items-center gap-1.5',
                isCurrent ? 'flex' : ANCESTOR,
              )}
            >
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="truncate font-medium text-foreground"
                >
                  {crumb.title}
                </span>
              ) : (
                <>
                  {crumb.linkable ? (
                    // Ancestors only show from sm up, where the touch target
                    // is 32px: the link is that tall, the text truncates.
                    <Link
                      to={crumb.pathname}
                      className="flex h-8 min-w-0 items-center transition-colors hover:text-foreground"
                    >
                      <span className="truncate">{crumb.title}</span>
                    </Link>
                  ) : (
                    <span className="truncate">{crumb.title}</span>
                  )}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
