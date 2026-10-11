// jsdom has no matchMedia. This one answers the queries the app uses, width
// and prefers-color-scheme, from settable values, and fires change events
// when they move so live listeners can be tested.

type Listener = (event: MediaQueryListEvent) => void;

const DEFAULT_WIDTH = 1024;

const env = { width: DEFAULT_WIDTH, prefersDark: false };
const lists = new Set<{ query: string; listeners: Set<Listener> }>();

function evaluate(query: string): boolean {
  return query.split(/\s+and\s+/).every((part) => {
    const max = /max-width:\s*(\d+)px/.exec(part);
    if (max) return env.width <= Number(max[1]);
    const min = /min-width:\s*(\d+)px/.exec(part);
    if (min) return env.width >= Number(min[1]);
    const scheme = /prefers-color-scheme:\s*(dark|light)/.exec(part);
    if (scheme) return (scheme[1] === 'dark') === env.prefersDark;
    return false;
  });
}

function notify(update: () => void) {
  const before = new Map(
    [...lists].map((list) => [list, evaluate(list.query)]),
  );
  update();
  for (const [list, was] of before) {
    const matches = evaluate(list.query);
    if (matches === was) continue;
    const event = { matches, media: list.query } as MediaQueryListEvent;
    for (const listener of list.listeners) listener(event);
  }
}

export function setViewportWidth(width: number): void {
  notify(() => {
    env.width = width;
    window.innerWidth = width;
  });
}

export function setPrefersDark(prefersDark: boolean): void {
  notify(() => {
    env.prefersDark = prefersDark;
  });
}

export function installMatchMedia(): void {
  env.width = DEFAULT_WIDTH;
  env.prefersDark = false;
  window.innerWidth = DEFAULT_WIDTH;
  lists.clear();

  window.matchMedia = (query: string) => {
    const list = { query, listeners: new Set<Listener>() };
    lists.add(list);
    return {
      get matches() {
        return evaluate(query);
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: Listener) =>
        list.listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) =>
        list.listeners.delete(listener),
      addListener: (listener: Listener) => list.listeners.add(listener),
      removeListener: (listener: Listener) => list.listeners.delete(listener),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
}
