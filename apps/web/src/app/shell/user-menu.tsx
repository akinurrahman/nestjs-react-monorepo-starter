import { LogOut } from 'lucide-react';
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
import { getInitials } from '@/lib/format';
import { useSession } from '@/systems/session';
import { DevRoleSwitcher } from './dev-role-switcher';

export function UserMenu() {
  const { user } = useSession();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-10 gap-2 px-1.5 md:h-8"
            aria-label="User menu"
          />
        }
      >
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground md:size-6"
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
        {import.meta.env.DEV ? <DevRoleSwitcher role={user.role} /> : null}
        <DropdownMenuSeparator />
        {/* Enabled by the auth step. */}
        <DropdownMenuItem disabled>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
