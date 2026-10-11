import { Outlet, ScrollRestoration } from 'react-router';
import { DocumentTitle } from './document-title';
import { NavigationProgress } from './navigation-progress';

export function RootRoute() {
  return (
    <>
      <DocumentTitle />
      <NavigationProgress />
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
