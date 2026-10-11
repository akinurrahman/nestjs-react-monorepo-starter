import { Autocomplete } from '@base-ui/react/autocomplete';
import { Check, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { isAnyModalOpen } from '@/components/ui/modal-registry';
import { isMacPlatform } from '@/lib/platform';
import { setTheme, themeLookup, useTheme } from '@/systems/theme';
import type { NavGroup } from './nav';
import {
  searchGroups,
  type Searchable,
  type SearchGroup,
} from './palette-search';
import { setPaletteOpen, usePaletteStore } from './palette-store';
import { useOpenPalette } from './use-open-palette';

type PaletteItem = Searchable & {
  id: string;
  icon: ComponentType<{ className?: string }>;
  current?: boolean;
  run: () => void;
};

const THEME_KEYWORDS = ['theme', 'appearance', 'color', 'mode'];

function shortcutLabel() {
  return isMacPlatform() ? '⌘ K' : 'Ctrl K';
}

// Capture phase, so Ctrl/Cmd+K wins inside inputs and menus that handle
// their own keys. Ctrl/Cmd+B stays with the sidebar.
function usePaletteHotkey() {
  const openPalette = useOpenPalette();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || event.altKey) return;
      if (!event.metaKey && !event.ctrlKey) return;
      // Still ours while a modal is open, so the browser does not take it,
      // but the modal keeps the screen. That includes the palette itself.
      event.preventDefault();
      if (isAnyModalOpen()) return;
      openPalette();
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [openPalette]);
}

export function CommandPalette({
  navGroups,
}: {
  navGroups: readonly NavGroup[];
}) {
  usePaletteHotkey();
  const open = usePaletteStore((state) => state.open);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();

  const groups = useMemo<SearchGroup<PaletteItem>[]>(
    () => [
      ...navGroups.map((group) => ({
        label: group.label,
        items: group.items.map((item) => ({
          id: `page:${item.path}`,
          title: item.title,
          keywords: item.keywords,
          icon: item.icon,
          run: () => void navigate(item.path),
        })),
      })),
      {
        label: 'Actions',
        items: themeLookup.options.map(({ value, label }) => ({
          id: `theme:${value}`,
          title: `${label} theme`,
          keywords: THEME_KEYWORDS,
          icon: themeLookup.resolve(value)?.icon ?? Search,
          current: value === theme,
          run: () => setTheme(value),
        })),
      },
    ],
    [navGroups, navigate, theme],
  );

  const results = useMemo(() => searchGroups(groups, query), [groups, query]);

  function close() {
    setPaletteOpen(false);
    setQuery('');
  }

  function select(item: PaletteItem) {
    close();
    item.run();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setPaletteOpen(true) : close())}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Autocomplete.Root
          inline
          open
          items={groups}
          filteredItems={results}
          value={query}
          onValueChange={(value) => setQuery(value)}
          itemToStringValue={(item: PaletteItem) => item.title}
          autoHighlight="always"
        >
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Autocomplete.Input
              aria-label="Search pages and actions"
              placeholder="Search pages and actions"
              className="h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
          </div>
          <Autocomplete.Empty className="px-3 py-8 text-center text-sm text-muted-foreground empty:hidden">
            No results
          </Autocomplete.Empty>
          <Autocomplete.List className="max-h-80 overflow-y-auto p-1 empty:hidden">
            {(group: SearchGroup<PaletteItem>) => (
              <Autocomplete.Group key={group.label} items={group.items}>
                <Autocomplete.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </Autocomplete.GroupLabel>
                <Autocomplete.Collection>
                  {(item: PaletteItem) => (
                    <Autocomplete.Item
                      key={item.id}
                      value={item}
                      onClick={() => select(item)}
                      className="flex h-10 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:h-9 [&_svg]:size-4 [&_svg]:shrink-0"
                    >
                      <item.icon className="text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {item.title}
                      </span>
                      {item.current ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Check />
                          Current
                        </span>
                      ) : null}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.Collection>
              </Autocomplete.Group>
            )}
          </Autocomplete.List>
        </Autocomplete.Root>
      </DialogContent>
    </Dialog>
  );
}

export function PaletteButton() {
  const openPalette = useOpenPalette();
  const shortcut = shortcutLabel();

  return (
    <Button
      variant="outline"
      aria-label="Search"
      aria-keyshortcuts={isMacPlatform() ? 'Meta+K' : 'Control+K'}
      onClick={openPalette}
      className="size-10 justify-center text-muted-foreground sm:h-8 sm:w-auto sm:min-w-44 sm:justify-start"
    >
      <Search />
      <span className="hidden flex-1 text-left sm:inline">Search</span>
      <kbd
        aria-hidden="true"
        className="hidden rounded-sm border bg-muted px-1.5 font-sans text-xs sm:inline"
      >
        {shortcut}
      </kbd>
    </Button>
  );
}
