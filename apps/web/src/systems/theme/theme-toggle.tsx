import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setTheme, useTheme } from './theme-store';
import { themeLookup } from './theme.lookup';

export function ThemeToggle() {
  const theme = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-10 md:size-8"
            aria-label="Theme"
          />
        }
      >
        <Sun className="dark:hidden" />
        <Moon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value: unknown) => {
            const next = themeLookup.values.find((theme) => theme === value);
            if (next) setTheme(next);
          }}
        >
          {themeLookup.options.map(({ value, label }) => {
            const Icon = themeLookup.resolve(value)?.icon;
            return (
              <DropdownMenuRadioItem key={value} value={value}>
                {Icon ? <Icon /> : null}
                {label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
