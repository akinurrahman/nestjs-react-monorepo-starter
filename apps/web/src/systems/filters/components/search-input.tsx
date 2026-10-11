import { useEffect, useEffectEvent, useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const DEFAULT_DEBOUNCE_MS = 350;

type SearchInputProps = {
  // The committed value, normally read off the URL.
  value?: string;
  // Fires after the debounce, with undefined once the box is empty.
  onChange: (value?: string) => void;
  placeholder?: string;
  // The accessible name. Defaults to the placeholder.
  label?: string;
  debounceMs?: number;
  disabled?: boolean;
  className?: string;
};

type Sent = { value: string | undefined };

/**
 * Typing stays local and reaches the URL, and so the query key, only after a
 * pause.
 *
 * A new value from outside (a reset, a link, a navigation to this list with a
 * different search) replaces the text. Filter writes replace the history
 * entry, so Back never steps through earlier searches. This
 * box's own write coming back does not: the URL can land after the person has
 * typed more, and copying it in then would eat those keystrokes. Any other
 * value that arrives is treated as outside.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  disabled,
  className,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value ?? '');
  const [synced, setSynced] = useState(value);
  const [sent, setSent] = useState<Sent | null>(null);

  // Set during render, so the box never paints the stale text in between.
  if (value !== synced) {
    setSynced(value);
    setSent(null);
    if (!sent || sent.value !== value) setDraft(value ?? '');
  }

  const send = (next: string | undefined) => {
    setSent({ value: next });
    onChange(next);
  };

  // An effect event, so a parent passing a fresh onChange each render does
  // not restart the timer mid-typing.
  const sendLater = useEffectEvent(send);

  useEffect(() => {
    const next = draft.trim() || undefined;
    if (next === (value || undefined)) return;

    const timer = setTimeout(() => sendLater(next), debounceMs);
    return () => clearTimeout(timer);
  }, [draft, value, debounceMs]);

  // Clearing is deliberate, so it skips the debounce.
  const clear = () => {
    setDraft('');
    send(undefined);
  };

  return (
    <div className={cn('relative w-full min-w-0 sm:w-64', className)}>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && draft) {
            event.preventDefault();
            clear();
          }
        }}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        autoComplete="off"
        enterKeyHint="search"
        disabled={disabled}
        className={cn(
          'pl-9',
          // The native clear button would sit under this one.
          '[&::-webkit-search-cancel-button]:appearance-none',
          draft && 'pr-10 sm:pr-9',
        )}
      />
      {draft && !disabled ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute top-0 right-0 flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-9"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
