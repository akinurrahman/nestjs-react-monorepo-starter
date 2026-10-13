import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { loginPath, useLogout } from '@/features/auth';
import { getInitials } from '@/lib/format';
import { useSession } from '@/systems/session';

export function UserMenu() {
  const { user } = useSession();
  const navigate = useNavigate();
  const logout = useLogout();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="gap-2 px-1.5 sm:h-8"
            aria-label="User menu"
          />
        }
      >
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground sm:size-6"
        >
          {getInitials(user.name)}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate text-sm text-foreground">
            {user.name}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              // A protected page already redirects once the session is gone;
              // a public one (the 404) would otherwise stay put.
              onSettled: () => void navigate(loginPath()),
            })
          }
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
