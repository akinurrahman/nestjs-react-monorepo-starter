import { ROLES, roleSchema, type Role } from '@starter/shared';
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { setStubRole } from '@/systems/session';

// Dev only. The user menu renders it behind import.meta.env.DEV, so a
// production build drops it along with this module.
export function DevRoleSwitcher({ role }: { role: Role }) {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Dev: switch role</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={role}
          onValueChange={(value: unknown) =>
            setStubRole(roleSchema.parse(value))
          }
        >
          {ROLES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {value}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </>
  );
}
