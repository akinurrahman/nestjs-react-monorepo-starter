import { Link, Outlet } from 'react-router';
import { APP_NAME } from './config';

// Placeholder until the real shell lands.
export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b px-6 py-3">
        <Link to="/" className="font-semibold text-foreground">
          {APP_NAME}
        </Link>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
