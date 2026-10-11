import { createBrowserRouter } from 'react-router';
import { homeRoutes } from '@/features/home';
import { buildRoutes } from './routes';

export function createAppRouter() {
  return createBrowserRouter(buildRoutes([...homeRoutes]));
}
