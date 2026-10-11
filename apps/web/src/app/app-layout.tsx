import { Link, Outlet } from 'react-router';
import { ThemeToggle } from '@/systems/theme';
import { APP_NAME } from './config';

// Placeholder until the real shell lands.
export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link to="/" className="font-semibold text-foreground">
          {APP_NAME}
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}